/**
 * Integration tests for authentication and authorization middleware.
 *
 * Uses jose to generate RSA key pairs and sign JWTs that mirror
 * the structure of Keycloak-issued tokens.  A local HTTP server exposes
 * a JWKS endpoint so validateKeycloak can verify signatures without
 * a running Keycloak instance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import { createAuthenticationMiddleware, authorize } from '../../src/middleware/authenticate.mjs'
import { initialiseRequestLogger } from '../../src/middleware/requestLogger.mjs'

// ── Shared key material ─────────────────────────────────────────────────────
let privateKey
let publicJwk
let jwksServer
let jwksPort

// Fake PhaseManager
function fakePhaseManager (isDevelopment = false) {
  return {
    isDevelopment: () => isDevelopment,
    getPhaseConfig: () => ({ phase: isDevelopment ? 'development' : 'production', isDevelopment })
  }
}

// Express-like mock request / response helpers
function mockRequest (overrides = {}) {
  return {
    headers: {},
    requestId: 'test-req-001',
    ...overrides
  }
}

function mockResponse () {
  let resolveEnded
  const endedPromise = new Promise((resolve) => { resolveEnded = resolve })

  const response = {
    _status: null,
    _json: null,
    _ended: false,
    statusCode: 200,
    ended: endedPromise,
    status (code) { response._status = code; return response },
    json (body) { response._json = body; resolveEnded(); return response },
    end (body) { response._ended = true; response._body = body; resolveEnded(); return response }
  }
  return response
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  // Generate RSA key pair
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  publicJwk = await exportJWK(pair.publicKey)
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  publicJwk.kid = 'test-key-1'

  // Start a minimal JWKS server
  jwksServer = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ keys: [publicJwk] }))
  })

  await new Promise((resolve) => {
    jwksServer.listen(0, '127.0.0.1', () => {
      jwksPort = jwksServer.address().port
      resolve()
    })
  })

  // Initialise the singleton Recorder so middleware doesn't NPE
  initialiseRequestLogger({ tee: false })
})

afterAll(async () => {
  if (jwksServer) {
    await new Promise((resolve) => jwksServer.close(resolve))
  }
})

// ── JWT helpers ─────────────────────────────────────────────────────────────

function keycloakUrl () {
  return `http://127.0.0.1:${jwksPort}`
}

const REALM = 'test-realm'
const AUDIENCE = 'storm-api'
const ISSUER = `${keycloakUrl()}/realms/${REALM}`

/**
 * Build a signed JWT that mimics a Keycloak access token.
 */
async function buildToken (overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sub: 'user-001',
    preferred_username: 'testuser',
    email: 'test@rescor.local',
    realm_access: { roles: ['assessor'] },
    ...overrides
  }

  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuedAt(overrides.iat || now)
    .setExpirationTime(overrides.exp || now + 300)
    .setIssuer(overrides.iss || `http://127.0.0.1:${jwksPort}/realms/${REALM}`)

  if (overrides.aud !== undefined) {
    builder = builder.setAudience(overrides.aud)
  } else {
    builder = builder.setAudience(AUDIENCE)
  }

  return builder.sign(privateKey)
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Development mode bypass
// ═══════════════════════════════════════════════════════════════════════════

describe('Development mode bypass', () => {
  it('should attach synthetic dev user without any token', async () => {
    const authenticate = createAuthenticationMiddleware({
      phaseManager: fakePhaseManager(true)
    })

    const request = mockRequest()
    const response = mockResponse()
    let called = false
    await authenticate(request, response, () => { called = true })

    expect(called).toBe(true)
    expect(request.user).toBeDefined()
    expect(request.user.sub).toBe('dev-user-0000')
    expect(request.user.preferred_username).toBe('developer')
    expect(request.user.roles).toContain('admin')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Production — valid JWT
// ═══════════════════════════════════════════════════════════════════════════

describe('Valid JWT authentication', () => {
  let authenticate

  beforeAll(() => {
    authenticate = createAuthenticationMiddleware({
      phaseManager: fakePhaseManager(false),
      oidc: { keycloakUrl: keycloakUrl(), realm: REALM, audience: AUDIENCE }
    })
  })

  it('should authenticate with a valid token', async () => {
    const token = await buildToken()
    const request = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const response = mockResponse()
    let nextCalled = false

    await new Promise((resolve) => {
      authenticate(request, response, (error) => {
        nextCalled = !error
        resolve()
      })
    })

    expect(nextCalled).toBe(true)
    expect(request.user).toBeDefined()
    expect(request.user.sub).toBe('user-001')
  })

  it('should normalise realm_access.roles to request.user.roles', async () => {
    const token = await buildToken({
      realm_access: { roles: ['assessor', 'reviewer', 'admin'] }
    })
    const request = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const response = mockResponse()

    await new Promise((resolve) => {
      authenticate(request, response, () => resolve())
    })

    expect(request.user.roles).toContain('assessor')
    expect(request.user.roles).toContain('reviewer')
    expect(request.user.roles).toContain('admin')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Missing token → 401
// ═══════════════════════════════════════════════════════════════════════════

describe('Missing or invalid Authorization header', () => {
  let authenticate

  beforeAll(() => {
    authenticate = createAuthenticationMiddleware({
      phaseManager: fakePhaseManager(false),
      oidc: { keycloakUrl: keycloakUrl(), realm: REALM, audience: AUDIENCE }
    })
  })

  it('should return 401 when no Authorization header is present', async () => {
    const request = mockRequest()
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 when Authorization header has no Bearer prefix', async () => {
    const request = mockRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Invalid / expired token → 401
// ═══════════════════════════════════════════════════════════════════════════

describe('Invalid token', () => {
  let authenticate

  beforeAll(() => {
    authenticate = createAuthenticationMiddleware({
      phaseManager: fakePhaseManager(false),
      oidc: { keycloakUrl: keycloakUrl(), realm: REALM, audience: AUDIENCE }
    })
  })

  it('should return 401 for a garbage token', async () => {
    const request = mockRequest({ headers: { authorization: 'Bearer not.a.jwt' } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 for an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 600
    const token = await buildToken({ iat: past - 300, exp: past })
    const request = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 for a token with wrong issuer', async () => {
    const token = await buildToken({ iss: 'http://evil.example.com/realms/rescor' })
    const request = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 for a token with wrong audience', async () => {
    const token = await buildToken({ aud: 'wrong-client' })
    const request = mockRequest({ headers: { authorization: `Bearer ${token}` } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. No auth configured in production → 401
// ═══════════════════════════════════════════════════════════════════════════

describe('No auth configured in production', () => {
  it('should return 401 JSON when no OIDC config is provided', async () => {
    const authenticate = createAuthenticationMiddleware({
      phaseManager: fakePhaseManager(false),
      oidc: {}
    })

    const request = mockRequest({ headers: { authorization: 'Bearer some.token.here' } })
    const response = mockResponse()

    authenticate(request, response, () => {})
    await response.ended

    expect(response._status).toBe(401)
    expect(response._json.error.code).toBe('UNAUTHORIZED')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Authorization (RBAC)
// ═══════════════════════════════════════════════════════════════════════════

describe('authorize middleware', () => {
  it('should pass when user has the required role', () => {
    const middleware = authorize('assessor')
    const request = mockRequest({ user: { sub: 'u1', roles: ['assessor'] } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(true)
  })

  it('should pass when user has admin role (implicit grant)', () => {
    const middleware = authorize('reviewer')
    const request = mockRequest({ user: { sub: 'u1', roles: ['admin'] } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(true)
  })

  it('should return 403 when user lacks the required role', () => {
    const middleware = authorize('assessor')
    const request = mockRequest({ user: { sub: 'u1', roles: ['reviewer'] } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(false)
    expect(response._status).toBe(403)
    expect(response._json.error.code).toBe('FORBIDDEN')
  })

  it('should return 403 when user has no roles at all', () => {
    const middleware = authorize('assessor')
    const request = mockRequest({ user: { sub: 'u1', roles: [] } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(false)
    expect(response._status).toBe(403)
  })

  it('should pass when user has at least one of multiple required roles', () => {
    const middleware = authorize('assessor', 'reviewer')
    const request = mockRequest({ user: { sub: 'u1', roles: ['reviewer'] } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(true)
  })

  it('should return 403 when user.roles is undefined', () => {
    const middleware = authorize('assessor')
    const request = mockRequest({ user: { sub: 'u1' } })
    const response = mockResponse()
    let called = false

    middleware(request, response, () => { called = true })

    expect(called).toBe(false)
    expect(response._status).toBe(403)
  })
})

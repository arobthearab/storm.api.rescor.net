/**
 * Authentication middleware — validates bearer tokens via @rescor-llc/core-auth.
 *
 * In development phase (determined by PhaseManager), authentication is bypassed
 * and a synthetic user is attached to the request.
 *
 * In production, delegates to @rescor-llc/core-auth validateKeycloak (JWKS + jose).
 * After successful authentication, auto-registers the user in Neo4j via UserStore.
 *
 * Recorder event codes (7020–7029):
 *   7020  Authentication succeeded   (info)
 *   7021  Authentication failed      (warning)
 *   7022  Authorization denied       (warning)
 *   7025  User auto-registered       (info)
 */

import { validateKeycloak } from '@rescor-llc/core-auth'
import { getRecorder } from './requestLogger.mjs'

// ── Event Codes ─────────────────────────────────────────────────────────────
const EVENT_AUTH_SUCCESS      = 7020
const EVENT_AUTH_FAILURE      = 7021
const EVENT_AUTH_DENIED       = 7022
const EVENT_USER_REGISTERED   = 7025

/**
 * Build authentication middleware.
 *
 * @param {object} options
 * @param {import('@rescor-llc/core-db').PhaseManager} options.phaseManager
 * @param {object} options.oidc - { keycloakUrl, realm, audience }
 * @param {import('../persistence/UserStore.mjs').UserStore} [options.userStore]
 * @returns {Function} Express middleware
 */
export function createAuthenticationMiddleware ({ phaseManager, oidc = {}, userStore = null } = {}) {
  const developmentUser = Object.freeze({
    sub: 'dev-user-0000',
    preferred_username: 'developer',
    email: 'dev@rescor.local',
    roles: ['admin'],
    iss: 'storm-dev',
    aud: 'storm-api',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  })

  let keycloakMiddleware = null

  if (!phaseManager.isDevelopment() && oidc.keycloakUrl && oidc.realm) {
    keycloakMiddleware = validateKeycloak({
      keycloakUrl: oidc.keycloakUrl,
      realm: oidc.realm,
      audience: oidc.audience
    })
  }

  return async function authenticate (request, response, next) {
    const recorder = getRecorder()

    // ── DAST scanner bypass (CI only — requires DAST_MODE + NODE_ENV=test) ──
    if (process.env.DAST_MODE === 'true' && process.env.NODE_ENV === 'test') {
      request.user = { sub: 'dast-scanner', roles: ['reader'], iss: 'dast', aud: 'storm-api' }
      next()
      return
    }

    // ── Development bypass ──────────────────────────────────────────────
    if (phaseManager.isDevelopment()) {
      request.user = { ...developmentUser }
      await autoRegister(request, userStore, recorder)
      next()
      return
    }

    // ── Production — Keycloak JWT ───────────────────────────────────────
    if (keycloakMiddleware) {
      keycloakMiddleware(request, response, async (error) => {
        if (error) {
          emitAuthFailure(recorder, request, error)
          next(error)
          return
        }

        // Normalise Keycloak realm_access.roles → flat request.user.roles
        normaliseRoles(request)
        emitAuthSuccess(recorder, request)
        await autoRegister(request, userStore, recorder)
        next()
      })
      return
    }

    // ── No auth configured in production ────────────────────────────────
    emitAuthFailure(recorder, request, new Error('Authentication not configured'))
    response.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is not configured'
      }
    })
  }
}

/**
 * Build authorization middleware that checks RBAC roles.
 *
 * @param  {...string} requiredRoles - At least one of these roles must be present
 * @returns {Function} Express middleware
 */
export function authorize (...requiredRoles) {
  return function checkAuthorization (request, response, next) {
    const userRoles = request.user?.roles || []

    const isAdmin = userRoles.includes('admin')
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))

    if (isAdmin || hasRequiredRole) {
      next()
      return
    }

    const recorder = getRecorder()
    if (recorder) {
      recorder.emit(EVENT_AUTH_DENIED, 'w', `Denied ${request.user?.sub || '-'} — needs [${requiredRoles}] has [${userRoles}]`, {
        requestId: request.requestId,
        user: request.user?.sub,
        requiredRoles,
        userRoles
      })
    }

    response.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      }
    })
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise Keycloak JWT roles to a flat array on request.user.roles.
 *
 * Keycloak stores realm roles in `realm_access.roles`.  The validate
 * middleware returns the raw JWT payload, so we normalise here.
 */
function normaliseRoles (request) {
  const user = request.user
  if (!user) return

  if (!Array.isArray(user.roles)) {
    if (user.realm_access && Array.isArray(user.realm_access.roles)) {
      user.roles = user.realm_access.roles
    } else {
      user.roles = []
    }
  }
}

/**
 * Auto-register the authenticated user in Neo4j (best-effort, non-blocking).
 */
async function autoRegister (request, userStore, recorder) {
  if (!userStore || !request.user?.sub) return

  try {
    const userRecord = await userStore.ensureUser(request.user)

    // First time registration?
    if (userRecord && userRecord.firstSeen === userRecord.lastSeen && recorder) {
      recorder.emit(EVENT_USER_REGISTERED, 'i', `User registered: ${userRecord.username} (${userRecord.sub})`, {
        requestId: request.requestId,
        sub: userRecord.sub,
        username: userRecord.username,
        email: userRecord.email
      })
    }
  } catch (error) {
    // Auto-registration is best-effort — never block the request
    console.warn('[storm] User auto-registration failed:', error.message)
  }
}

function emitAuthSuccess (recorder, request) {
  if (!recorder) return
  recorder.emit(EVENT_AUTH_SUCCESS, 'i', `Auth OK: ${request.user?.sub || '-'}`, {
    requestId: request.requestId,
    user: request.user?.sub,
    username: request.user?.preferred_username,
    roles: request.user?.roles
  })
}

function emitAuthFailure (recorder, request, error) {
  if (!recorder) return
  recorder.emit(EVENT_AUTH_FAILURE, 'w', `Auth failed: ${error?.message || 'unknown'}`, {
    requestId: request.requestId,
    error: error?.message
  })
}

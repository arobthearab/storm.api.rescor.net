/**
 * Authentication middleware — validates bearer tokens via @rescor/core-auth.
 *
 * In development phase (determined by PhaseManager), authentication is bypassed
 * and a synthetic user is attached to the request.
 */

import { validateKeycloak } from '@rescor/core-auth'

/**
 * Build authentication middleware.
 *
 * @param {object} options
 * @param {import('@rescor/core-db').PhaseManager} options.phaseManager - Phase manager instance
 * @param {object} options.oidc - OIDC configuration (keycloakUrl, realm, audience)
 * @returns {Function} Express middleware
 */
export function createAuthenticationMiddleware ({ phaseManager, oidc = {} } = {}) {
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

  return function authenticate (request, response, next) {
    if (phaseManager.isDevelopment()) {
      request.user = { ...developmentUser }
      next()
      return
    }

    if (keycloakMiddleware) {
      keycloakMiddleware(request, response, next)
      return
    }

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

    response.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      }
    })
  }
}

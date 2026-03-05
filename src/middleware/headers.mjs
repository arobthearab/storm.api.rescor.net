/**
 * Security-headers and request-tracing middleware.
 */

import { randomUUID } from 'node:crypto'

/**
 * Attach security headers per SECURITY.md requirements.
 */
export function securityHeaders (request, response, next) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

/**
 * Ensure every request has x-request-id and x-correlation-id headers.
 */
export function requestTracing (request, response, next) {
  const requestId = request.headers['x-request-id'] || randomUUID()
  const correlationId = request.headers['x-correlation-id'] || requestId

  request.requestId = requestId
  request.correlationId = correlationId

  response.setHeader('x-request-id', requestId)
  response.setHeader('x-correlation-id', correlationId)

  next()
}

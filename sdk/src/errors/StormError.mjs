/**
 * STORM SDK error hierarchy.
 *
 * Maps API error envelope codes to typed exceptions for programmatic handling.
 */

/**
 * Base error for all STORM SDK failures.
 */
export class StormError extends Error {
  /**
   * @param {string} message  - Human-readable description
   * @param {string} code     - Machine-readable error code (e.g. 'VALIDATION_ERROR')
   * @param {number} status   - HTTP status code from the API
   * @param {*}      details  - Optional structured details from the API
   */
  constructor (message, code, status, details = null) {
    super(message)
    this.name = 'StormError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/**
 * 400 — Validation failure (bad input, missing fields).
 */
export class ValidationError extends StormError {
  constructor (message, details = null) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * 401 — Missing or invalid authentication token.
 */
export class AuthenticationError extends StormError {
  constructor (message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'AuthenticationError'
  }
}

/**
 * 403 — Authenticated but insufficient privileges.
 */
export class AuthorizationError extends StormError {
  constructor (message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'AuthorizationError'
  }
}

/**
 * 404 — Requested resource does not exist or has expired.
 */
export class NotFoundError extends StormError {
  constructor (message = 'Not found') {
    super(message, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

/**
 * 5xx — Server-side failure.
 */
export class ServerError extends StormError {
  constructor (message = 'Internal server error', status = 500) {
    super(message, 'INTERNAL_ERROR', status)
    this.name = 'ServerError'
  }
}

/**
 * Network-level failure — DNS, timeout, connection refused.
 */
export class NetworkError extends StormError {
  constructor (message, cause = null) {
    super(message, 'NETWORK_ERROR', 0)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/**
 * Map an API error envelope to the appropriate StormError subclass.
 *
 * @param {number} status     - HTTP status code
 * @param {object} envelope   - Parsed JSON body with { error: { code, message, details? } }
 * @returns {StormError}
 */
export function mapApiError (status, envelope) {
  const code = envelope?.error?.code || 'UNKNOWN'
  const message = envelope?.error?.message || `HTTP ${status}`
  const details = envelope?.error?.details || null

  let result

  if (status === 400) {
    result = new ValidationError(message, details)
  } else if (status === 401) {
    result = new AuthenticationError(message)
  } else if (status === 403) {
    result = new AuthorizationError(message)
  } else if (status === 404) {
    result = new NotFoundError(message)
  } else if (status >= 500) {
    result = new ServerError(message, status)
  } else {
    result = new StormError(message, code, status, details)
  }

  return result
}

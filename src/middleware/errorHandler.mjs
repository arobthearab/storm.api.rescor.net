/**
 * Error-handling middleware — catches thrown errors and returns structured
 * JSON error responses per the STORM error envelope convention.
 */

import { ValidationError, NotFoundError, AuthenticationError, AuthorizationError } from '@rescor-llc/core-utils'

/**
 * Map known error types to HTTP status codes.
 * @param {Error} error
 * @returns {{ status: number, code: string }}
 */
function classifyError (error) {
  let classification = { status: 500, code: 'INTERNAL_ERROR' }

  if (error instanceof ValidationError) {
    classification = { status: 400, code: 'VALIDATION_ERROR' }
  } else if (error instanceof NotFoundError) {
    classification = { status: 404, code: 'NOT_FOUND' }
  } else if (error instanceof AuthenticationError) {
    classification = { status: 401, code: 'UNAUTHORIZED' }
  } else if (error instanceof AuthorizationError) {
    classification = { status: 403, code: 'FORBIDDEN' }
  } else if (error.status === 422 || error.code === 'UNPROCESSABLE_ENTITY') {
    classification = { status: 422, code: 'UNPROCESSABLE_ENTITY' }
  }

  return classification
}

/**
 * Express error-handling middleware.
 * Must be registered with four parameters per Express convention.
 */
export function errorHandler (error, request, response, _next) {
  const { status, code } = classifyError(error)

  const body = {
    error: {
      code,
      message: error.message || 'An unexpected error occurred'
    }
  }

  if (error.details) {
    body.error.details = error.details
  }

  response.status(status).json(body)
}

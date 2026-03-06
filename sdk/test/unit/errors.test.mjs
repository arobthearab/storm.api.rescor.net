/**
 * Unit tests for the StormError hierarchy and mapApiError function.
 */

import { describe, it, expect } from 'vitest'
import {
  StormError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
  NetworkError,
  mapApiError
} from '../../src/errors/StormError.mjs'

describe('StormError hierarchy', () => {
  it('should construct with all properties', () => {
    const error = new StormError('test', 'TEST_CODE', 418, { field: 'x' })
    expect(error.message).toBe('test')
    expect(error.code).toBe('TEST_CODE')
    expect(error.status).toBe(418)
    expect(error.details).toEqual({ field: 'x' })
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(StormError)
  })

  it('ValidationError should have correct defaults', () => {
    const error = new ValidationError('bad input', [{ field: 'x' }])
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.status).toBe(400)
    expect(error.details).toEqual([{ field: 'x' }])
    expect(error).toBeInstanceOf(StormError)
  })

  it('AuthenticationError should have correct defaults', () => {
    const error = new AuthenticationError()
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.status).toBe(401)
    expect(error.message).toBe('Unauthorized')
  })

  it('AuthorizationError should have correct defaults', () => {
    const error = new AuthorizationError()
    expect(error.code).toBe('FORBIDDEN')
    expect(error.status).toBe(403)
    expect(error.message).toBe('Forbidden')
  })

  it('NotFoundError should have correct defaults', () => {
    const error = new NotFoundError()
    expect(error.code).toBe('NOT_FOUND')
    expect(error.status).toBe(404)
  })

  it('ServerError should have correct defaults', () => {
    const error = new ServerError()
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.status).toBe(500)
  })

  it('ServerError should accept custom status', () => {
    const error = new ServerError('gateway timeout', 504)
    expect(error.status).toBe(504)
  })

  it('NetworkError should store cause', () => {
    const cause = new TypeError('fetch failed')
    const error = new NetworkError('connection refused', cause)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.status).toBe(0)
    expect(error.cause).toBe(cause)
  })
})

describe('mapApiError', () => {
  it('should map 400 to ValidationError', () => {
    const error = mapApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'bad' } })
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('bad')
  })

  it('should map 401 to AuthenticationError', () => {
    const error = mapApiError(401, { error: { code: 'UNAUTHORIZED', message: 'no token' } })
    expect(error).toBeInstanceOf(AuthenticationError)
  })

  it('should map 403 to AuthorizationError', () => {
    const error = mapApiError(403, { error: { code: 'FORBIDDEN', message: 'nope' } })
    expect(error).toBeInstanceOf(AuthorizationError)
  })

  it('should map 404 to NotFoundError', () => {
    const error = mapApiError(404, { error: { code: 'NOT_FOUND', message: 'gone' } })
    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('should map 500 to ServerError', () => {
    const error = mapApiError(500, { error: { code: 'INTERNAL_ERROR', message: 'boom' } })
    expect(error).toBeInstanceOf(ServerError)
  })

  it('should map 502 to ServerError with correct status', () => {
    const error = mapApiError(502, { error: { code: 'BAD_GATEWAY', message: 'upstream' } })
    expect(error).toBeInstanceOf(ServerError)
    expect(error.status).toBe(502)
  })

  it('should map unknown status to base StormError', () => {
    const error = mapApiError(418, { error: { code: 'TEAPOT', message: 'I am a teapot' } })
    expect(error).toBeInstanceOf(StormError)
    expect(error).not.toBeInstanceOf(ValidationError)
    expect(error.code).toBe('TEAPOT')
  })

  it('should handle null/missing envelope gracefully', () => {
    const error = mapApiError(500, null)
    expect(error).toBeInstanceOf(ServerError)
    expect(error.message).toBe('HTTP 500')
  })

  it('should preserve details from envelope', () => {
    const details = [{ field: 'name', message: 'required' }]
    const error = mapApiError(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid', details }
    })
    expect(error.details).toEqual(details)
  })
})

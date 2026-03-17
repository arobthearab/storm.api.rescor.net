/**
 * Unit tests for StormClient — the core HTTP transport layer.
 */

import { describe, it, expect, vi } from 'vitest'
import { StormClient } from '../../src/StormClient.mjs'
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ServerError,
  NetworkError
} from '../../src/errors/StormError.mjs'

/**
 * Create a mock fetch that returns a canned response.
 */
function mockFetch (status, body = null, options = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: body != null ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
    ...options
  })
}

describe('StormClient', () => {
  describe('constructor', () => {
    it('should use default baseUrl and timeout', () => {
      const client = new StormClient()
      expect(client.baseUrl).toBe('http://localhost:3200')
      expect(client.timeout).toBe(30000)
    })

    it('should strip trailing slashes from baseUrl', () => {
      const client = new StormClient({ baseUrl: 'https://storm.api.rescor.net///' })
      expect(client.baseUrl).toBe('https://storm.api.rescor.net')
    })
  })

  describe('GET', () => {
    it('should unwrap data envelope', async () => {
      const fetch = mockFetch(200, { data: { status: 'healthy' } })
      const client = new StormClient({ fetch })

      const result = await client.get('/health')

      expect(result).toEqual({ status: 'healthy' })
      expect(fetch).toHaveBeenCalledOnce()
      expect(fetch.mock.calls[0][0]).toBe('http://localhost:3200/health')
      expect(fetch.mock.calls[0][1].method).toBe('GET')
    })
  })

  describe('POST', () => {
    it('should send JSON body and unwrap response', async () => {
      const responseData = { aggregate: 150, measurements: [80, 60], scalingBase: 4 }
      const fetch = mockFetch(200, { data: responseData })
      const client = new StormClient({ fetch })

      const result = await client.post('/v1/rsk/vm/aggregate', {
        measurements: [80, 60],
        scalingBase: 4
      })

      expect(result).toEqual(responseData)
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
        measurements: [80, 60],
        scalingBase: 4
      })
    })
  })

  describe('PATCH', () => {
    it('should send PATCH with body', async () => {
      const fetch = mockFetch(200, { data: { id: 'fct_abc', value: 0.9 } })
      const client = new StormClient({ fetch })

      const result = await client.patch('/v1/measurements/msr_123/factors/fct_abc', { value: 0.9 })

      expect(result.value).toBe(0.9)
      expect(fetch.mock.calls[0][1].method).toBe('PATCH')
    })
  })

  describe('DELETE', () => {
    it('should return true for 204 No Content', async () => {
      const fetch = mockFetch(204)
      const client = new StormClient({ fetch })

      const result = await client.delete('/v1/measurements/msr_123')

      expect(result).toBe(true)
    })
  })

  describe('authentication', () => {
    it('should include static Bearer token', async () => {
      const fetch = mockFetch(200, { data: {} })
      const client = new StormClient({ fetch, token: 'test-jwt-token' })

      await client.get('/v1/measurements/msr_123')

      expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-jwt-token')
    })

    it('should call tokenProvider for dynamic token', async () => {
      const fetch = mockFetch(200, { data: {} })
      const provider = vi.fn().mockResolvedValue('dynamic-token')
      const client = new StormClient({ fetch, tokenProvider: provider })

      await client.get('/health')

      expect(provider).toHaveBeenCalledOnce()
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer dynamic-token')
    })

    it('should omit Authorization when no token', async () => {
      const fetch = mockFetch(200, { data: {} })
      const client = new StormClient({ fetch })

      await client.get('/health')

      expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
    })
  })

  describe('error mapping', () => {
    it('should throw ValidationError for 400', async () => {
      const fetch = mockFetch(400, {
        error: { code: 'VALIDATION_ERROR', message: 'value is required' }
      })
      const client = new StormClient({ fetch })

      await expect(client.post('/v1/rsk/vm/aggregate', {}))
        .rejects.toThrow(ValidationError)
    })

    it('should throw AuthenticationError for 401', async () => {
      const fetch = mockFetch(401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
      })
      const client = new StormClient({ fetch })

      await expect(client.get('/v1/measurements/msr_123'))
        .rejects.toThrow(AuthenticationError)
    })

    it('should throw AuthorizationError for 403', async () => {
      const fetch = mockFetch(403, {
        error: { code: 'FORBIDDEN', message: 'Insufficient privileges' }
      })
      const client = new StormClient({ fetch })

      await expect(client.get('/v1/measurements/msr_123'))
        .rejects.toThrow(AuthorizationError)
    })

    it('should throw NotFoundError for 404', async () => {
      const fetch = mockFetch(404, {
        error: { code: 'NOT_FOUND', message: 'Measurement not found' }
      })
      const client = new StormClient({ fetch })

      await expect(client.get('/v1/measurements/msr_gone'))
        .rejects.toThrow(NotFoundError)
    })

    it('should throw ServerError for 500', async () => {
      const fetch = mockFetch(500, {
        error: { code: 'INTERNAL_ERROR', message: 'Something broke' }
      })
      const client = new StormClient({ fetch })

      await expect(client.get('/health'))
        .rejects.toThrow(ServerError)
    })

    it('should include details on ValidationError', async () => {
      const fetch = mockFetch(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: [{ field: 'value', message: 'must be a number' }]
        }
      })
      const client = new StormClient({ fetch })

      try {
        await client.post('/v1/measurements', {})
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.details).toEqual([{ field: 'value', message: 'must be a number' }])
      }
    })
  })

  describe('network errors', () => {
    it('should throw NetworkError on fetch failure', async () => {
      const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
      const client = new StormClient({ fetch })

      await expect(client.get('/health'))
        .rejects.toThrow(NetworkError)
    })

    it('should throw NetworkError on timeout', async () => {
      const fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          }, 10)
        })
      })
      const client = new StormClient({ fetch, timeout: 5 })

      await expect(client.get('/health'))
        .rejects.toThrow(NetworkError)
    })
  })

  describe('headers', () => {
    it('should include User-Agent', async () => {
      const fetch = mockFetch(200, { data: {} })
      const client = new StormClient({ fetch })

      await client.get('/health')

      expect(fetch.mock.calls[0][1].headers['User-Agent']).toBe('@rescor-llc/storm-sdk/0.1.0')
    })

    it('should merge extra headers', async () => {
      const fetch = mockFetch(200, { data: {} })
      const client = new StormClient({ fetch, headers: { 'X-Trace-Id': 'trace-123' } })

      await client.get('/health')

      expect(fetch.mock.calls[0][1].headers['X-Trace-Id']).toBe('trace-123')
    })
  })
})

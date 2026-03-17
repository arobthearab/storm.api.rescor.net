/**
 * StormClient — core HTTP transport for the STORM API.
 *
 * Uses native `fetch` (Node 18+). No external HTTP dependencies.
 * Handles authentication, envelope unwrapping, error mapping, and tracing headers.
 */

import { mapApiError, NetworkError } from './errors/StormError.mjs'

const DEFAULT_BASE_URL = 'http://localhost:3200'
const DEFAULT_TIMEOUT_MILLISECONDS = 30_000
const SDK_USER_AGENT = '@rescor-llc/storm-sdk/0.1.0'

/**
 * STORM API HTTP client.
 */
export class StormClient {
  /**
   * @param {object}   options
   * @param {string}   [options.baseUrl='http://localhost:3200'] - API base URL (no trailing slash)
   * @param {string}   [options.token]                           - Bearer token for authentication
   * @param {Function} [options.tokenProvider]                   - Async function returning a fresh token
   * @param {number}   [options.timeout=30000]                   - Request timeout in milliseconds
   * @param {object}   [options.headers]                         - Extra headers merged into every request
   * @param {Function} [options.fetch]                           - Custom fetch implementation (testing)
   */
  constructor (options = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.token = options.token || null
    this.tokenProvider = options.tokenProvider || null
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MILLISECONDS
    this.extraHeaders = options.headers || {}
    this._fetch = options.fetch || globalThis.fetch
  }

  // ---------------------------------------------------------------------------
  // Public convenience methods
  // ---------------------------------------------------------------------------

  /**
   * GET request — returns unwrapped response data.
   *
   * @param {string} path    - URL path (e.g. '/v1/measurements/msr_abc')
   * @param {object} [options]
   * @returns {Promise<*>}
   */
  async get (path, options = {}) {
    const result = await this._request('GET', path, null, options)
    return result
  }

  /**
   * POST request — returns unwrapped response data.
   *
   * @param {string} path
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise<*>}
   */
  async post (path, body, options = {}) {
    const result = await this._request('POST', path, body, options)
    return result
  }

  /**
   * PATCH request — returns unwrapped response data.
   *
   * @param {string} path
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise<*>}
   */
  async patch (path, body, options = {}) {
    const result = await this._request('PATCH', path, body, options)
    return result
  }

  /**
   * DELETE request — returns true for 204, or unwrapped data otherwise.
   *
   * @param {string} path
   * @param {object} [options]
   * @returns {Promise<boolean|*>}
   */
  async delete (path, options = {}) {
    const result = await this._request('DELETE', path, null, options)
    return result
  }

  // ---------------------------------------------------------------------------
  // Core transport
  // ---------------------------------------------------------------------------

  /**
   * Execute an HTTP request against the STORM API.
   *
   * @param {string}      method  - HTTP method
   * @param {string}      path    - URL path (e.g. '/v1/measurements')
   * @param {object|null} body    - JSON body (null for GET/DELETE)
   * @param {object}      options - Per-request overrides (headers, timeout)
   * @returns {Promise<*>}
   */
  async _request (method, path, body, options = {}) {
    const url = `${this.baseUrl}${path}`
    const headers = await this._buildHeaders(options.headers)

    const fetchOptions = {
      method,
      headers
    }

    if (body != null) {
      fetchOptions.body = JSON.stringify(body)
    }

    // Timeout via AbortController
    const controller = new AbortController()
    const timeoutMilliseconds = options.timeout ?? this.timeout
    let timeoutId = null

    if (timeoutMilliseconds > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds)
      fetchOptions.signal = controller.signal
    }

    let result

    try {
      const response = await this._fetch(url, fetchOptions)

      if (timeoutId != null) {
        clearTimeout(timeoutId)
      }

      result = await this._handleResponse(response)
    } catch (error) {
      if (timeoutId != null) {
        clearTimeout(timeoutId)
      }

      if (error instanceof NetworkError || error.code || error.status) {
        throw error
      }

      if (error.name === 'AbortError') {
        throw new NetworkError(`Request timed out after ${timeoutMilliseconds}ms`)
      }

      throw new NetworkError(error.message, error)
    }

    return result
  }

  /**
   * Build the headers object for a request.
   *
   * @param {object} [perRequestHeaders]
   * @returns {Promise<object>}
   */
  async _buildHeaders (perRequestHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': SDK_USER_AGENT,
      ...this.extraHeaders,
      ...perRequestHeaders
    }

    const token = await this._resolveToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  /**
   * Resolve the current bearer token.
   *
   * If a `tokenProvider` function was supplied, call it for a fresh token.
   * Otherwise use the static `token` value.
   *
   * @returns {Promise<string|null>}
   */
  async _resolveToken () {
    let result = this.token

    if (this.tokenProvider) {
      result = await this.tokenProvider()
    }

    return result
  }

  /**
   * Process a fetch Response — unwrap the `{ data }` envelope or throw a mapped error.
   *
   * @param {Response} response
   * @returns {Promise<*>}
   */
  async _handleResponse (response) {
    // 204 No Content — nothing to parse
    if (response.status === 204) {
      return true
    }

    let parsed
    try {
      parsed = await response.json()
    } catch (_parseError) {
      parsed = null
    }

    let result

    if (response.ok) {
      result = parsed?.data ?? parsed
    } else {
      throw mapApiError(response.status, parsed)
    }

    return result
  }
}

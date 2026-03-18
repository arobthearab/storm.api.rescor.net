/**
 * KeycloakTokenProvider — client credentials token provider for the STORM SDK.
 *
 * Fetches a Keycloak access token via the OAuth2 Client Credentials Grant
 * and caches it until 60 seconds before expiry.  Transparent re-fetch on
 * expiry so the calling code never needs to manage token lifecycle.
 *
 * Usage (TC API backend → STORM):
 *
 *   import { createKeycloakTokenProvider } from '@rescor-llc/storm-sdk/auth'
 *   import { Storm } from '@rescor-llc/storm-sdk'
 *
 *   const tokenProvider = createKeycloakTokenProvider({
 *     keycloakUrl: 'http://keycloak:8080',
 *     realm:       'testingcenter',
 *     clientId:    'testingcenter-api',
 *     clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
 *   })
 *
 *   const storm = new Storm({ baseUrl: 'http://storm-api:3200', tokenProvider })
 */

import { NetworkError, AuthenticationError } from '../errors/StormError.mjs'

const EXPIRY_BUFFER_SECONDS = 60

/**
 * @param {object} options
 * @param {string} options.keycloakUrl  - Base Keycloak URL (no trailing slash)
 * @param {string} options.realm        - Keycloak realm name
 * @param {string} options.clientId     - OAuth2 client ID
 * @param {string} options.clientSecret - OAuth2 client secret
 * @param {Function} [options.fetch]    - Custom fetch (for testing)
 * @returns {Function} async tokenProvider — returns a fresh bearer token string
 */
export function createKeycloakTokenProvider ({ keycloakUrl, realm, clientId, clientSecret, fetch: customFetch } = {}) {
  if (!keycloakUrl || !realm || !clientId || !clientSecret) {
    throw new Error('createKeycloakTokenProvider requires { keycloakUrl, realm, clientId, clientSecret }')
  }

  const tokenUrl = `${keycloakUrl.replace(/\/+$/, '')}/realms/${realm}/protocol/openid-connect/token`
  const fetchFn = customFetch || globalThis.fetch

  let cachedToken = null
  let expiresAtSeconds = 0

  async function fetchToken () {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })

    let response
    try {
      response = await fetchFn(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })
    } catch (networkError) {
      throw new NetworkError(`Keycloak token fetch failed: ${networkError.message}`, networkError)
    }

    if (!response.ok) {
      let detail = ''
      try {
        const parsed = await response.json()
        detail = parsed.error_description || parsed.error || ''
      } catch {
        // no-op
      }
      throw new AuthenticationError(`Keycloak token request failed (${response.status})${detail ? ': ' + detail : ''}`)
    }

    const parsed = await response.json()
    return parsed
  }

  return async function tokenProvider () {
    const nowSeconds = Math.floor(Date.now() / 1000)

    if (cachedToken && nowSeconds < expiresAtSeconds - EXPIRY_BUFFER_SECONDS) {
      return cachedToken
    }

    const tokenResponse = await fetchToken()
    cachedToken = tokenResponse.access_token
    expiresAtSeconds = nowSeconds + (tokenResponse.expires_in || 300)

    return cachedToken
  }
}

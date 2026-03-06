/**
 * NistBuilder — fluent interface for NIST 800-30 risk-matrix endpoint.
 *
 * Usage:
 *   await storm.nist().riskMatrix({ likelihood: 'High', impact: 'Moderate' })
 */

/**
 * Fluent builder for NIST stateless computation endpoints.
 */
export class NistBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
  }

  /**
   * POST /v1/nist/risk-matrix — Compute NIST 800-30 risk level.
   *
   * @param {object} input - Risk matrix parameters (likelihood, impact, etc.)
   * @returns {Promise<object>}
   */
  async riskMatrix (input) {
    const result = await this._client.post('/v1/nist/risk-matrix', input)
    return result
  }
}

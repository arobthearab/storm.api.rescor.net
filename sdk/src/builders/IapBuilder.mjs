/**
 * IapBuilder — fluent interface for Independent Ancillary Process endpoints.
 *
 * Usage:
 *   await storm.iap().ham533({ capability: 0.8, intent: 0.7, targeting: 0.6 })
 *   await storm.iap().crve3({ complexity: 0.4, reach: 0.5, vectors: [0.3, 0.6] })
 *   await storm.iap().scep({ controls: [{ efficacy: 0.6 }, { efficacy: 0.4 }] })
 *   await storm.iap().assetValuation({ sensitivity: 0.9, criticality: 0.8 })
 */

/**
 * Fluent builder for IAP stateless computation endpoints.
 */
export class IapBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
  }

  /**
   * POST /v1/iap/ham533 — Compute HAM533 threat probability.
   * @param {object} input - HAM533 parameters
   * @returns {Promise<object>}
   */
  async ham533 (input) {
    const result = await this._client.post('/v1/iap/ham533', input)
    return result
  }

  /**
   * POST /v1/iap/crve3 — Compute CRVE3 vulnerability exposure.
   * @param {object} input - CRVE3 parameters
   * @param {number} [scalingBase] - Optional scaling base override
   * @returns {Promise<object>}
   */
  async crve3 (input, scalingBase = undefined) {
    const body = { ...input }
    if (scalingBase != null) {
      body.scalingBase = scalingBase
    }
    const result = await this._client.post('/v1/iap/crve3', body)
    return result
  }

  /**
   * POST /v1/iap/scep — Compute SCEP control efficacy.
   * @param {object} input - SCEP parameters
   * @param {number} [scalingBase] - Optional scaling base override
   * @returns {Promise<object>}
   */
  async scep (input, scalingBase = undefined) {
    const body = { ...input }
    if (scalingBase != null) {
      body.scalingBase = scalingBase
    }
    const result = await this._client.post('/v1/iap/scep', body)
    return result
  }

  /**
   * POST /v1/iap/asset-valuation — Compute asset valuation.
   * @param {object} input - Asset valuation parameters
   * @param {number} [scalingBase] - Optional scaling base override
   * @returns {Promise<object>}
   */
  async assetValuation (input, scalingBase = undefined) {
    const body = { ...input }
    if (scalingBase != null) {
      body.scalingBase = scalingBase
    }
    const result = await this._client.post('/v1/iap/asset-valuation', body)
    return result
  }
}

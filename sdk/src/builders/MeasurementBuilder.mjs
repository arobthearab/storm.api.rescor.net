/**
 * MeasurementBuilder — fluent interface for measurement lifecycle operations.
 *
 * Usage:
 *   const measurement = await storm.measurement()
 *     .name('Web App Scan')
 *     .hierarchy('security_scan')
 *     .scalingBase(4)
 *     .maximumValue(100)
 *     .ttl(86400)
 *     .create()
 *
 *   const factor = await storm.measurement(measurement.id)
 *     .factor()
 *     .value(0.80)
 *     .label('SQL Injection')
 *     .path(['External', 'web-server', '192.168.1.1', 'CVE-2024-001'])
 *     .add()
 */

/**
 * Builder for creating measurement sessions.
 */
export class MeasurementBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
    this._body = {}
  }

  /**
   * Set measurement name.
   * @param {string} value
   * @returns {MeasurementBuilder}
   */
  name (value) {
    this._body.name = value
    return this
  }

  /**
   * Set hierarchy template or custom levels array.
   * @param {string|string[]} value - Template name or array of level names
   * @returns {MeasurementBuilder}
   */
  hierarchy (value) {
    this._body.hierarchy = value
    return this
  }

  /**
   * Set scaling base (default 4).
   * @param {number} value
   * @returns {MeasurementBuilder}
   */
  scalingBase (value) {
    this._body.scalingBase = value
    return this
  }

  /**
   * Set maximum value for scaled output (default 100).
   * @param {number} value
   * @returns {MeasurementBuilder}
   */
  maximumValue (value) {
    this._body.maximumValue = value
    return this
  }

  /**
   * Set session TTL in seconds (default 86400 = 24h).
   * @param {number} seconds
   * @returns {MeasurementBuilder}
   */
  ttl (seconds) {
    this._body.ttl = seconds
    return this
  }

  /**
   * Set arbitrary metadata.
   * @param {object} value
   * @returns {MeasurementBuilder}
   */
  metadata (value) {
    this._body.metadata = value
    return this
  }

  /**
   * Create the measurement on the server.
   * @returns {Promise<object>} Created measurement data
   */
  async create () {
    const result = await this._client.post('/v1/measurements', this._body)
    return result
  }
}

/**
 * Operations on an existing measurement session.
 */
export class MeasurementSession {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   * @param {string} measurementId
   */
  constructor (client, measurementId) {
    this._client = client
    this._measurementId = measurementId
  }

  /**
   * Retrieve the full measurement with aggregates and tree.
   * @returns {Promise<object>}
   */
  async get () {
    const result = await this._client.get(`/v1/measurements/${this._measurementId}`)
    return result
  }

  /**
   * Delete the measurement and all associated data.
   * @returns {Promise<boolean>}
   */
  async delete () {
    const result = await this._client.delete(`/v1/measurements/${this._measurementId}`)
    return result
  }

  /**
   * Start building a new factor for this measurement.
   * @returns {FactorBuilder}
   */
  factor () {
    const result = new FactorBuilder(this._client, this._measurementId)
    return result
  }

  /**
   * List all factors in this measurement.
   * @returns {Promise<object>}
   */
  async listFactors () {
    const result = await this._client.get(
      `/v1/measurements/${this._measurementId}/factors`
    )
    return result
  }

  /**
   * Update an existing factor (partial update).
   * @param {string} factorId
   * @param {object} fields - { value?, label?, metadata? }
   * @returns {Promise<object>}
   */
  async updateFactor (factorId, fields) {
    const result = await this._client.patch(
      `/v1/measurements/${this._measurementId}/factors/${factorId}`,
      fields
    )
    return result
  }

  /**
   * Delete a factor.
   * @param {string} factorId
   * @returns {Promise<boolean>}
   */
  async deleteFactor (factorId) {
    const result = await this._client.delete(
      `/v1/measurements/${this._measurementId}/factors/${factorId}`
    )
    return result
  }

  /**
   * Start building a modifier for a specific factor.
   * @param {string} factorId
   * @returns {ModifierBuilder}
   */
  modifier (factorId) {
    const result = new ModifierBuilder(this._client, this._measurementId, factorId)
    return result
  }

  /**
   * Delete a modifier.
   * @param {string} modifierId
   * @returns {Promise<boolean>}
   */
  async deleteModifier (modifierId) {
    const result = await this._client.delete(
      `/v1/measurements/${this._measurementId}/modifiers/${modifierId}`
    )
    return result
  }
}

/**
 * Fluent builder for adding a V-factor to a measurement.
 */
export class FactorBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   * @param {string} measurementId
   */
  constructor (client, measurementId) {
    this._client = client
    this._measurementId = measurementId
    this._body = {}
  }

  /**
   * Set the factor's base value (probability 0-1 or percentage 1-100).
   * @param {number} value
   * @returns {FactorBuilder}
   */
  value (value) {
    this._body.value = value
    return this
  }

  /**
   * Set a descriptive label.
   * @param {string} value
   * @returns {FactorBuilder}
   */
  label (value) {
    this._body.label = value
    return this
  }

  /**
   * Set the hierarchy path (array of labels per grouping level above the leaf).
   * @param {string[]} levels
   * @returns {FactorBuilder}
   */
  path (levels) {
    this._body.path = levels
    return this
  }

  /**
   * Set arbitrary metadata.
   * @param {object} value
   * @returns {FactorBuilder}
   */
  metadata (value) {
    this._body.metadata = value
    return this
  }

  /**
   * Add the factor to the measurement.
   * @returns {Promise<object>} Created factor with DualMeasurement
   */
  async add () {
    const result = await this._client.post(
      `/v1/measurements/${this._measurementId}/factors`,
      this._body
    )
    return result
  }
}

/**
 * Fluent builder for adding a modifier to a factor.
 */
export class ModifierBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   * @param {string} measurementId
   * @param {string} factorId
   */
  constructor (client, measurementId, factorId) {
    this._client = client
    this._measurementId = measurementId
    this._factorId = factorId
    this._body = {}
  }

  /**
   * Set modifier type (e.g. 'confidence', 'control', or custom).
   * @param {string} value
   * @returns {ModifierBuilder}
   */
  type (value) {
    this._body.type = value
    return this
  }

  /**
   * Set modifier effect ('attenuate' or 'amplify').
   * @param {string} value
   * @returns {ModifierBuilder}
   */
  effect (value) {
    this._body.effect = value
    return this
  }

  /**
   * Set application mode ('direct' or 'compound').
   * @param {string} value
   * @returns {ModifierBuilder}
   */
  application (value) {
    this._body.application = value
    return this
  }

  /**
   * Set modifier value (0-1).
   * @param {number} value
   * @returns {ModifierBuilder}
   */
  value (value) {
    this._body.value = value
    return this
  }

  /**
   * Set a descriptive label.
   * @param {string} value
   * @returns {ModifierBuilder}
   */
  label (value) {
    this._body.label = value
    return this
  }

  /**
   * Set arbitrary metadata.
   * @param {object} value
   * @returns {ModifierBuilder}
   */
  metadata (value) {
    this._body.metadata = value
    return this
  }

  /**
   * Add the modifier to the factor.
   * @returns {Promise<object>} Updated factor with all modifiers
   */
  async add () {
    const result = await this._client.post(
      `/v1/measurements/${this._measurementId}/factors/${this._factorId}/modifiers`,
      this._body
    )
    return result
  }
}

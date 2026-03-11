/**
 * RskBuilder — fluent interface for RSK/VM and RSK/RM stateless computation endpoints.
 *
 * RSK/VM (Vulnerability Mode):
 *   await storm.rsk().vm().measurements([80, 60, 40]).aggregate()
 *   await storm.rsk().vm().measurements([80]).measurement(60).add()
 *   await storm.rsk().vm().raw(245).normalize()
 *   await storm.rsk().vm().measurement(75).rate()
 *   await storm.rsk().vm().measurements([80, 60]).score()
 *   await storm.rsk().vm().limit()
 *
 * RSK/RM (Risk Mode):
 *   await storm.rsk().rm().riskFactors([...]).adjust()
 *   await storm.rsk().rm().assetValue(0.8).vulnerability(0.6).controlEfficacy(0.3).sle()
 *   await storm.rsk().rm().assetValue(0.8).threatPotential(0.7).vulnerability(0.6).controlEfficacy(0.3).dle()
 *   await storm.rsk().rm().riskFactors([...]).assess()
 */

/**
 * Entry point for RSK operations. Use `.vm()` or `.rm()` to select the mode.
 */
export class RskBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
  }

  /**
   * Switch to Vulnerability Mode operations.
   * @returns {RskVmBuilder}
   */
  vm () {
    const result = new RskVmBuilder(this._client)
    return result
  }

  /**
   * Switch to Risk Mode operations.
   * @returns {RskRmBuilder}
   */
  rm () {
    const result = new RskRmBuilder(this._client)
    return result
  }
}

// =============================================================================
// RSK/VM — Vulnerability Mode
// =============================================================================

/**
 * Fluent builder for RSK/VM stateless computation endpoints.
 */
export class RskVmBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
    this._body = {}
  }

  /**
   * Set the measurement array (V-factor values).
   * @param {number[]} values
   * @returns {RskVmBuilder}
   */
  measurements (values) {
    this._body.measurements = values
    return this
  }

  /**
   * Set a single measurement value (for add / rate operations).
   * @param {number} value
   * @returns {RskVmBuilder}
   */
  measurement (value) {
    this._body.measurement = value
    return this
  }

  /**
   * Set the raw aggregate value (for normalize), or declare the measurement
   * vector as raw-space (0–1 probabilities) when called with no arguments.
   *
   * - `.raw(245)` → sets `body.raw = 245` for the normalize endpoint
   * - `.raw()`    → sets `body.inputScale = 'raw'` to override auto-detection
   *
   * @param {number} [value] - Raw aggregate value (omit to declare raw input scale)
   * @returns {RskVmBuilder}
   */
  raw (value) {
    if (value === undefined) {
      this._body.inputScale = 'raw'
    } else {
      this._body.raw = value
    }
    return this
  }

  /**
   * Declare the measurement vector as scaled-space (1–100 RU values).
   * Overrides auto-detection so that values like 1 are treated as 1 RU,
   * not as probability 1.0.
   *
   * @returns {RskVmBuilder}
   */
  scaled () {
    this._body.inputScale = 'scaled'
    return this
  }

  /**
   * Set the scaling base (default 4).
   * @param {number} value
   * @returns {RskVmBuilder}
   */
  scalingBase (value) {
    this._body.scalingBase = value
    return this
  }

  /**
   * Set the maximum value for scaling (default 100).
   * @param {number} value
   * @returns {RskVmBuilder}
   */
  maximumValue (value) {
    this._body.maximumValue = value
    return this
  }

  /**
   * Set the minimum value (for add).
   * @param {number} value
   * @returns {RskVmBuilder}
   */
  minimumValue (value) {
    this._body.minimumValue = value
    return this
  }

  /**
   * Set the rating scale ('standard' or 'alternate').
   * @param {string} value
   * @returns {RskVmBuilder}
   */
  scale (value) {
    this._body.scale = value
    return this
  }

  /**
   * Set custom rating thresholds.
   * @param {number[]} values
   * @returns {RskVmBuilder}
   */
  thresholds (values) {
    this._body.thresholds = values
    return this
  }

  /**
   * Set custom rating labels.
   * @param {string[]} values
   * @returns {RskVmBuilder}
   */
  labels (values) {
    this._body.labels = values
    return this
  }

  /**
   * Set precision for score output.
   * @param {number} value
   * @returns {RskVmBuilder}
   */
  precision (value) {
    this._body.precision = value
    return this
  }

  /**
   * POST /v1/rsk/vm/aggregate — Compute the RSK aggregate for the measurements.
   * @returns {Promise<object>}
   */
  async aggregate () {
    const result = await this._client.post('/v1/rsk/vm/aggregate', this._body)
    return result
  }

  /**
   * POST /v1/rsk/vm/add — Add a measurement to an existing vector.
   * @returns {Promise<object>}
   */
  async add () {
    const result = await this._client.post('/v1/rsk/vm/add', this._body)
    return result
  }

  /**
   * POST /v1/rsk/vm/normalize — Normalize a raw aggregate to scaled units.
   * @returns {Promise<object>}
   */
  async normalize () {
    const result = await this._client.post('/v1/rsk/vm/normalize', this._body)
    return result
  }

  /**
   * POST /v1/rsk/vm/rate — Convert a scaled measurement to a qualitative rating.
   * @returns {Promise<object>}
   */
  async rate () {
    const result = await this._client.post('/v1/rsk/vm/rate', this._body)
    return result
  }

  /**
   * POST /v1/rsk/vm/score — Full pipeline: aggregate → normalize → rate.
   * @returns {Promise<object>}
   */
  async score () {
    const result = await this._client.post('/v1/rsk/vm/score', this._body)
    return result
  }

  /**
   * POST /v1/rsk/vm/limit — Compute the theoretical upper bound.
   * @returns {Promise<object>}
   */
  async limit () {
    const result = await this._client.post('/v1/rsk/vm/limit', this._body)
    return result
  }
}

// =============================================================================
// RSK/RM — Risk Mode
// =============================================================================

/**
 * Fluent builder for RSK/RM stateless computation endpoints.
 */
export class RskRmBuilder {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   */
  constructor (client) {
    this._client = client
    this._body = {}
  }

  /**
   * Set the risk factors array.
   * @param {object[]} factors - Array of { baseMeasurement, confidence?, assetValue?, threatPotential? }
   * @returns {RskRmBuilder}
   */
  riskFactors (factors) {
    this._body.riskFactors = factors
    return this
  }

  /**
   * Set asset value (0-1) for SLE/DLE/assess.
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  assetValue (value) {
    this._body.assetValue = value
    return this
  }

  /**
   * Set threat potential (0-1) for DLE/assess.
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  threatPotential (value) {
    this._body.threatPotential = value
    return this
  }

  /**
   * Set vulnerability factor (0-1) for SLE/DLE/assess.
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  vulnerability (value) {
    this._body.vulnerability = value
    return this
  }

  /**
   * Set control efficacy (0-1) for SLE/DLE/assess.
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  controlEfficacy (value) {
    this._body.controlEfficacy = value
    return this
  }

  /**
   * Set scaling base (default 4).
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  scalingBase (value) {
    this._body.scalingBase = value
    return this
  }

  /**
   * Set maximum value for scaling (default 100).
   * @param {number} value
   * @returns {RskRmBuilder}
   */
  maximumValue (value) {
    this._body.maximumValue = value
    return this
  }

  /**
   * Set asset input — number or IAP asset-valuation object.
   * @param {number|object} value
   * @returns {RskRmBuilder}
   */
  asset (value) {
    this._body.asset = value
    return this
  }

  /**
   * Set threat input — number or IAP HAM533 object.
   * @param {number|object} value
   * @returns {RskRmBuilder}
   */
  threat (value) {
    this._body.threat = value
    return this
  }

  /**
   * Set control input — number or IAP SCEP object.
   * @param {number|object} value
   * @returns {RskRmBuilder}
   */
  control (value) {
    this._body.control = value
    return this
  }

  /**
   * POST /v1/rsk/rm/adjust — Risk-adjust a set of V-factors.
   * @returns {Promise<object>}
   */
  async adjust () {
    const result = await this._client.post('/v1/rsk/rm/adjust', this._body)
    return result
  }

  /**
   * POST /v1/rsk/rm/sle — Compute Single Loss Expectancy.
   * @returns {Promise<object>}
   */
  async sle () {
    const result = await this._client.post('/v1/rsk/rm/sle', this._body)
    return result
  }

  /**
   * POST /v1/rsk/rm/dle — Compute Distributed Loss Expectancy.
   * @returns {Promise<object>}
   */
  async dle () {
    const result = await this._client.post('/v1/rsk/rm/dle', this._body)
    return result
  }

  /**
   * POST /v1/rsk/rm/assess — Full risk assessment with IAP resolution.
   * @returns {Promise<object>}
   */
  async assess () {
    const result = await this._client.post('/v1/rsk/rm/assess', this._body)
    return result
  }
}

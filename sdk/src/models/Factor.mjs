/**
 * Factor — immutable value object representing a V-factor.
 *
 * Factors are the atomic risk observations fed into a measurement.
 * Each factor has a base probability value and an optional hierarchy path.
 */

/**
 * Immutable value object for a V-factor.
 */
export class Factor {
  /**
   * @param {object} data - Raw factor data from the API
   */
  constructor (data) {
    /** @type {string} */
    this.id = data.id

    /** @type {number} Base probability (0–1) */
    this.value = data.value

    /** @type {string} Human label */
    this.label = data.label || ''

    /** @type {string[]} Hierarchy path */
    this.path = data.path || []

    /** @type {string} Parent hierarchy node ID */
    this.nodeId = data.nodeId || null

    /** @type {Modifier[]} Attached modifiers */
    this.modifiers = (data.modifiers || []).map(m => new Modifier(m))

    /** @type {object} Arbitrary metadata */
    this.metadata = data.metadata || {}

    Object.freeze(this)
  }

  /**
   * Effective value after applying all modifiers.
   * Follows the STORM modifier algebra:
   * - direct attenuate: value × (1 − modifier)
   * - direct amplify: value × (1 + modifier)
   * - compound: applied after all directs, multiplicatively chained
   *
   * @returns {number}
   */
  get effectiveValue () {
    let effective = this.value
    const compounds = []

    for (const modifier of this.modifiers) {
      if (modifier.application === 'compound') {
        compounds.push(modifier)
      } else {
        if (modifier.effect === 'attenuate') {
          effective *= (1 - modifier.value)
        } else {
          effective *= (1 + modifier.value)
        }
      }
    }

    for (const modifier of compounds) {
      if (modifier.effect === 'attenuate') {
        effective *= (1 - modifier.value)
      } else {
        effective *= (1 + modifier.value)
      }
    }

    const result = Math.max(0, Math.min(1, effective))
    return result
  }

  /**
   * Convert to a plain object suitable for batch submission.
   * @returns {object}
   */
  toJSON () {
    const result = {
      id: this.id,
      value: this.value,
      label: this.label,
      path: this.path,
      nodeId: this.nodeId,
      modifiers: this.modifiers.map(m => m.toJSON()),
      metadata: this.metadata
    }
    return result
  }
}

/**
 * Modifier — immutable value object representing a modifier applied to a factor.
 */
export class Modifier {
  /**
   * @param {object} data - Raw modifier data from the API
   */
  constructor (data) {
    /** @type {string} */
    this.id = data.id

    /** @type {string} Modifier type (e.g. 'confidence', 'control') */
    this.type = data.type

    /** @type {'attenuate'|'amplify'} */
    this.effect = data.effect || 'attenuate'

    /** @type {'direct'|'compound'} */
    this.application = data.application || 'direct'

    /** @type {number} Modifier strength (0–1) */
    this.value = data.value

    /** @type {string} Human label */
    this.label = data.label || ''

    /** @type {object} Arbitrary metadata */
    this.metadata = data.metadata || {}

    Object.freeze(this)
  }

  /**
   * Convert to plain object.
   * @returns {object}
   */
  toJSON () {
    const result = {
      id: this.id,
      type: this.type,
      effect: this.effect,
      application: this.application,
      value: this.value,
      label: this.label,
      metadata: this.metadata
    }
    return result
  }
}

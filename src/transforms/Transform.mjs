/**
 * Transform — Abstract base class for IAP domain transforms.
 *
 * Following the StormIapProcess pattern from the legacy STORM module,
 * each transform is a class that defines its domain (threat, vulnerability,
 * control, asset), model name, factor definitions, validation, and
 * computation logic.
 *
 * Subclasses MUST override:
 *   static get domain ()  — 'threat' | 'vulnerability' | 'control' | 'asset'
 *   static get model ()   — machine name, e.g. 'ham533', 'crve3', 'cvssa', 'scep'
 *   factors ()            — returns factor definition array
 *   compute (validated)   — returns computation result object
 *
 * Subclasses MAY override:
 *   validate (input)      — custom validation (default uses factor definitions)
 */

import { ValidationError } from '@rescor/core-utils'

export class Transform {
  /**
   * @param {object} input   — raw request body (factors + options)
   * @param {object} options — shared parameters (e.g. scalingBase)
   */
  constructor (input = {}, options = {}) {
    this.input = input
    this.options = options
  }

  // -----------------------------------------------------------------------
  // Identity — subclasses MUST override
  // -----------------------------------------------------------------------

  /** Assessment domain this transform serves. */
  static get domain () {
    throw new Error('Transform.domain must be overridden')
  }

  /** Machine name of the model/algorithm. */
  static get model () {
    throw new Error('Transform.model must be overridden')
  }

  /** Human-readable description. */
  static get description () {
    return ''
  }

  // -----------------------------------------------------------------------
  // Factor definitions — subclasses MUST override
  // -----------------------------------------------------------------------

  /**
   * Return the factor definitions for this transform.
   *
   * Each factor is an object:
   * ```
   * { name, type, required, min, max, integer, defaultValue, description }
   * ```
   *
   * @returns {object[]}
   */
  factors () {
    return []
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate input against factor definitions.
   * Returns the validated + defaulted input object.
   *
   * @param {object} input
   * @returns {object}
   */
  validate (input) {
    const factorDefinitions = this.factors()
    const validated = {}

    for (const factor of factorDefinitions) {
      const value = input[factor.name]

      if (value == null) {
        if (factor.required) {
          throw new ValidationError(`'${factor.name}' is required for ${this.constructor.model}`)
        }
        validated[factor.name] = factor.defaultValue
        continue
      }

      if (factor.type === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new ValidationError(`'${factor.name}' must be a number`)
        }
        if (factor.integer && !Number.isInteger(value)) {
          throw new ValidationError(`'${factor.name}' must be an integer`)
        }
        if (factor.min != null && value < factor.min) {
          throw new ValidationError(`'${factor.name}' must be >= ${factor.min}`)
        }
        if (factor.max != null && value > factor.max) {
          throw new ValidationError(`'${factor.name}' must be <= ${factor.max}`)
        }
      } else if (factor.type === 'array') {
        if (!Array.isArray(value)) {
          throw new ValidationError(`'${factor.name}' must be an array`)
        }
      }

      validated[factor.name] = value
    }

    return validated
  }

  // -----------------------------------------------------------------------
  // Computation — subclasses MUST override
  // -----------------------------------------------------------------------

  /**
   * Run the transform computation on validated input.
   *
   * @param {object} validated
   * @returns {object} computation result
   */
  compute (validated) {
    throw new Error('Transform.compute() must be overridden')
  }

  // -----------------------------------------------------------------------
  // Execute — validate then compute
  // -----------------------------------------------------------------------

  /**
   * Full execution pipeline: validate → compute.
   *
   * @returns {object}
   */
  execute () {
    const validated = this.validate(this.input)
    const result = this.compute(validated)
    return result
  }

  // -----------------------------------------------------------------------
  // Descriptor — metadata about this transform
  // -----------------------------------------------------------------------

  /**
   * Return a descriptor of the transform for discovery/introspection.
   *
   * @returns {object}
   */
  describe () {
    const result = {
      domain: this.constructor.domain,
      model: this.constructor.model,
      description: this.constructor.description,
      factors: this.factors()
    }
    return result
  }
}

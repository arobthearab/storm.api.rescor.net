/**
 * SCEP Transform — Security Control Efficacy Profile
 *
 * Aggregate effective control strength from a set of controls,
 * each with an implementation level and correction factor.
 * Uses RSK diminishing-weight aggregation, capped at 1.0.
 *
 * Domain: control
 * Model:  scep
 */

import { Transform } from './Transform.mjs'
import { rskAggregate } from '../engines/rsk.mjs'
import { ValidationError } from '@rescor-llc/core-utils'

export class ScepTransform extends Transform {
  static get domain () { return 'control' }
  static get model () { return 'scep' }
  static get description () { return 'Security Control Efficacy Profile' }

  factors () {
    const definitions = [
      { name: 'controls', type: 'array', required: true, description: 'Array of { implemented: 0–1, correction: 0–1 }' }
    ]
    return definitions
  }

  /**
   * Custom validation — controls array needs per-element checks.
   */
  validate (input) {
    if (!input.controls || !Array.isArray(input.controls) || input.controls.length < 1) {
      throw new ValidationError("'controls' is required and must be a non-empty array")
    }

    const controls = input.controls.map((control, index) => {
      if (typeof control !== 'object') {
        throw new ValidationError(`'controls[${index}]' must be an object`)
      }

      const implemented = control.implemented
      const correction = control.correction

      if (typeof implemented !== 'number' || implemented < 0 || implemented > 1) {
        throw new ValidationError(`'controls[${index}].implemented' must be a number between 0 and 1`)
      }
      if (typeof correction !== 'number' || correction < 0 || correction > 1) {
        throw new ValidationError(`'controls[${index}].correction' must be a number between 0 and 1`)
      }

      return { implemented, correction }
    })

    const result = { controls }
    return result
  }

  compute (validated) {
    const { controls } = validated
    const scalingBase = this.options.scalingBase ?? 4

    const effectives = controls.map(control => control.implemented * control.correction)
    const rawAggregate = rskAggregate(effectives, scalingBase)
    const efficacy = Math.min(1, rawAggregate)

    const result = { efficacy, effectives }
    return result
  }
}

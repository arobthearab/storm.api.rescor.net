/**
 * AssetValuation Transform — Asset Assessment
 *
 * Combines data classification, user-base scope, and high-value
 * data indicators into a normalized asset value (0–1).
 *
 * Domain: asset
 * Model:  asset-valuation
 */

import { Transform } from './Transform.mjs'
import { rskAggregate } from '../engines/rsk.mjs'
import { ValidationError } from '@rescor/core-utils'

export class AssetValuationTransform extends Transform {
  static get domain () { return 'asset' }
  static get model () { return 'asset-valuation' }
  static get description () { return 'Asset classification, scope, and high-value data valuation' }

  factors () {
    const definitions = [
      { name: 'classification', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Data classification level (1–3)' },
      { name: 'users', type: 'number', required: true, integer: true, min: 1, max: 5, description: 'User base scope (1–5)' },
      { name: 'highValueData', type: 'array', required: true, description: 'Array of 1–6 boolean indicators' }
    ]
    return definitions
  }

  /**
   * Custom validation — highValueData array needs boolean checks.
   */
  validate (input) {
    const base = super.validate(input)

    if (!Array.isArray(base.highValueData) || base.highValueData.length < 1 || base.highValueData.length > 6) {
      throw new ValidationError("'highValueData' must have 1–6 items")
    }

    const highValueData = base.highValueData.map((item, index) => {
      if (typeof item !== 'boolean') {
        throw new ValidationError(`'highValueData[${index}]' must be a boolean`)
      }
      return item
    })

    const result = { classification: base.classification, users: base.users, highValueData }
    return result
  }

  compute (validated) {
    const { classification, users, highValueData } = validated
    const scalingBase = this.options.scalingBase ?? 4

    const trueValues = highValueData.filter(Boolean).map(() => 1)
    const highValueAggregate = trueValues.length > 0 ? rskAggregate(trueValues, scalingBase) : 0

    const maxTrue = Array(highValueData.length).fill(1)
    const highValueMax = maxTrue.length > 0 ? rskAggregate(maxTrue, scalingBase) : 1

    const assetValue = (classification * users * highValueAggregate) / (3 * 5 * highValueMax)

    const result = {
      assetValue,
      components: { classification, users, highValueAggregate, highValueMax }
    }
    return result
  }
}

/**
 * Modifier effective-measurement calculation — CONFIDENTIAL
 *
 * Computes effective measurement from base value + direct & compound modifiers.
 *
 * effective = base × Π(direct attenuations) × (1 − compound_aggregate)
 *
 * IP Classification: PROPRIETARY
 */

import { rskAggregate } from './rsk.mjs'

/**
 * Compute the effective measurement after applying modifiers.
 *
 * @param {number}   base      - Base V-factor value (0–1)
 * @param {object[]} modifiers - Array of modifier objects
 * @param {string}   modifiers[].application - "direct" or "compound"
 * @param {string}   modifiers[].effect      - "attenuate" or "amplify"
 * @param {number}   modifiers[].value       - Modifier strength (0–1)
 * @param {number}   scalingBase - For compound aggregate (default 4)
 * @returns {{ effective: number, adjustment: number, directProduct: number, compoundAggregate: number }}
 */
export function computeEffective (base, modifiers = [], scalingBase = 4) {
  const directAttenuations = []
  const compoundValues = []

  for (const modifier of modifiers) {
    if (modifier.effect === 'amplify') {
      // Reserved for future — currently no-op
      continue
    }

    if (modifier.application === 'direct') {
      directAttenuations.push(modifier.value)
    } else if (modifier.application === 'compound') {
      compoundValues.push(modifier.value)
    }
  }

  let directProduct = 1
  for (const attenuation of directAttenuations) {
    directProduct *= attenuation
  }

  let compoundAggregate = 0
  if (compoundValues.length > 0) {
    compoundAggregate = Math.min(1, rskAggregate(compoundValues, scalingBase))
  }

  const effective = base * directProduct * (1 - compoundAggregate)
  const adjustment = base - effective

  const result = { effective, adjustment, directProduct, compoundAggregate }
  return result
}

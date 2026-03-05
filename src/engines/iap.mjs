/**
 * IAP Engines — Independent Ancillary Processes
 *
 * Pure computation functions for HAM533, CRVE3, SCEP, and Asset Valuation.
 * IP Classification: PUBLIC — formulas may be published.
 */

import { rskAggregate } from './rsk.mjs'

// ---------------------------------------------------------------------------
// HAM533 — Threat Potential (dual-dimension)
// ---------------------------------------------------------------------------

/**
 * Compute HAM533 threat potential.
 *
 * @param {object} input
 * @param {number} input.history - Historical occurrence (1–5)
 * @param {number} input.access  - Threat proximity (1–3)
 * @param {number} input.means   - Resources/capabilities (1–3)
 * @returns {{ probability: number, impact: number, factors: object }}
 */
export function ham533 ({ history, access, means }) {
  const product = history * access * means
  const probability = product / 45
  const impact = (5 * access * means) / 45

  const result = {
    probability,
    impact,
    factors: { history, access, means, product }
  }
  return result
}

// ---------------------------------------------------------------------------
// CRVE3 — Vulnerability Exposure
// ---------------------------------------------------------------------------

/**
 * Compute CRVE3 vulnerability exposure.
 *
 * @param {object} input
 * @param {number} input.capabilities    - Threat actor capabilities (1–3)
 * @param {number} input.resources       - Threat actor resources (1–3)
 * @param {number} input.visibility      - Target visibility (1–3)
 * @param {number} input.confidentiality - C exposure (1–3)
 * @param {number} input.integrity       - I exposure (1–3)
 * @param {number} input.availability    - A exposure (1–3)
 * @param {number} input.scalingBase     - Aggregate scaling base (default 4)
 * @returns {{ exposure: number, basic: number, cia: number, ciaMax: number, basicMax: number }}
 */
export function crve3 ({ capabilities, resources, visibility, confidentiality, integrity, availability, scalingBase = 4 }) {
  const basic = capabilities * resources * visibility
  const basicMax = 27

  const ciaValues = [confidentiality, integrity, availability]
  const cia = rskAggregate(ciaValues, scalingBase)
  const ciaMax = rskAggregate([3, 3, 3], scalingBase)

  const exposure = (cia * basic) / (ciaMax * basicMax)

  const result = { exposure, basic, cia, ciaMax, basicMax }
  return result
}

// ---------------------------------------------------------------------------
// SCEP — Security Control Efficacy
// ---------------------------------------------------------------------------

/**
 * Compute SCEP control efficacy.
 *
 * @param {object} input
 * @param {Array<{ implemented: number, correction: number }>} input.controls - Control items
 * @param {number} input.scalingBase - Aggregate scaling base (default 4)
 * @returns {{ efficacy: number, effectives: number[] }}
 */
export function scep ({ controls, scalingBase = 4 }) {
  const effectives = controls.map(control => control.implemented * control.correction)

  const rawAggregate = rskAggregate(effectives, scalingBase)
  const efficacy = Math.min(1, rawAggregate)

  const result = { efficacy, effectives }
  return result
}

// ---------------------------------------------------------------------------
// Asset Valuation
// ---------------------------------------------------------------------------

/**
 * Compute asset valuation.
 *
 * @param {object} input
 * @param {number}    input.classification - Data classification (1–3)
 * @param {number}    input.users          - User base scope (1–5)
 * @param {boolean[]} input.highValueData  - Array of 1–6 boolean indicators
 * @param {number}    input.scalingBase    - Aggregate scaling base (default 4)
 * @returns {{ assetValue: number, components: object }}
 */
export function assetValuation ({ classification, users, highValueData, scalingBase = 4 }) {
  const trueValues = highValueData.filter(Boolean).map(() => 1)
  const highValueAggregate = trueValues.length > 0 ? rskAggregate(trueValues, scalingBase) : 0

  const maxTrue = Array(highValueData.length).fill(1)
  const highValueMax = maxTrue.length > 0 ? rskAggregate(maxTrue, scalingBase) : 1

  const assetValue = (classification * users * highValueAggregate) / (3 * 5 * highValueMax)

  const result = {
    assetValue,
    components: {
      classification,
      users,
      highValueAggregate,
      highValueMax
    }
  }
  return result
}

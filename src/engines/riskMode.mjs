/**
 * RSK/RM — Risk Mode Engine
 *
 * Per-factor adjustment and loss expectancy models.
 * IP Classification: PUBLIC (standard actuarial formulas).
 */

import { rskAggregate, rskUpperBound, rskNormalize, rskRate } from './rsk.mjs'

/**
 * Adjust risk factors: v_i = C_i × V_a_i × T_p_i × b_i
 *
 * @param {object} input
 * @param {Array<{ baseMeasurement: number, confidence?: number, assetValue?: number, threatPotential?: number }>} input.riskFactors
 * @param {number} input.scalingBase - default 4
 * @returns {{ aggregate: number, adjustedMeasurements: number[], riskFactors: object[] }}
 */
export function adjust ({ riskFactors, scalingBase = 4 }) {
  const adjustedMeasurements = riskFactors.map(factor => {
    const confidence = factor.confidence ?? 1
    const asset = factor.assetValue ?? 1
    const threat = factor.threatPotential ?? 1
    const adjusted = confidence * asset * threat * factor.baseMeasurement
    return adjusted
  })

  const aggregate = rskAggregate(adjustedMeasurements, scalingBase)

  const result = {
    aggregate,
    adjustedMeasurements: [...adjustedMeasurements].sort((a, b) => b - a),
    riskFactors
  }
  return result
}

/**
 * Single Loss Expectancy: SLE = A × V × (1 − C)
 *
 * @param {object} input
 * @param {number} input.assetValue      - A (0–1)
 * @param {number} input.vulnerability   - V (0–1)
 * @param {number} input.controlEfficacy - C (0–1)
 * @returns {{ value: number, formula: string, components: object }}
 */
export function singleLossExpectancy ({ assetValue, vulnerability, controlEfficacy }) {
  const value = assetValue * vulnerability * (1 - controlEfficacy)

  const result = {
    value,
    formula: 'SLE = A × V × (1 − C)',
    components: { assetValue, vulnerability, controlEfficacy }
  }
  return result
}

/**
 * Distributed Loss Expectancy: DLE = A × T × V × (1 − C)
 *
 * @param {object} input
 * @param {number} input.assetValue      - A (0–1)
 * @param {number} input.threatPotential - T (0–1)
 * @param {number} input.vulnerability   - V (0–1)
 * @param {number} input.controlEfficacy - C (0–1)
 * @returns {{ value: number, formula: string, components: object }}
 */
export function distributedLossExpectancy ({ assetValue, threatPotential, vulnerability, controlEfficacy }) {
  const value = assetValue * threatPotential * vulnerability * (1 - controlEfficacy)

  const result = {
    value,
    formula: 'DLE = A × T × V × (1 − C)',
    components: { assetValue, threatPotential, vulnerability, controlEfficacy }
  }
  return result
}

/**
 * Full RSK/RM assessment pipeline.
 * Accepts raw IAP inputs OR pre-computed factors, adjusts, computes composite + SLE + DLE.
 *
 * @param {object} input - AssessRequest fields
 * @returns {object} Full assessment result
 */
export function assess (input) {
  const scalingBase = input.scalingBase || 4
  const maximumValue = input.maximumValue || 100

  // Resolve factors — either pre-computed numbers or IAP computations
  const assetValueFactor = typeof input.asset === 'number' ? input.asset : 1
  const threatFactor = typeof input.threat === 'number' ? input.threat : 1
  const vulnerabilityFactor = typeof input.vulnerability === 'number' ? input.vulnerability : 1
  const controlFactor = typeof input.control === 'number' ? input.control : 0

  // Adjust each risk factor
  const { aggregate, adjustedMeasurements } = adjust({
    riskFactors: input.riskFactors.map(factor => ({
      ...factor,
      confidence: factor.confidence ?? 1,
      assetValue: factor.assetValue ?? assetValueFactor,
      threatPotential: factor.threatPotential ?? threatFactor
    })),
    scalingBase
  })

  const upperBound = rskUpperBound(maximumValue, scalingBase)
  const normalized = rskNormalize(aggregate, maximumValue, scalingBase)
  const { rating } = rskRate(aggregate)

  const sleResult = singleLossExpectancy({
    assetValue: assetValueFactor,
    vulnerability: vulnerabilityFactor,
    controlEfficacy: controlFactor
  })

  const dleResult = distributedLossExpectancy({
    assetValue: assetValueFactor,
    threatPotential: threatFactor,
    vulnerability: vulnerabilityFactor,
    controlEfficacy: controlFactor
  })

  const result = {
    aggregate,
    normalized,
    rating,
    sle: sleResult.value,
    dle: dleResult.value,
    factors: {
      assetValue: assetValueFactor,
      threatPotential: threatFactor,
      vulnerability: vulnerabilityFactor,
      controlEfficacy: controlFactor
    },
    adjustedMeasurements
  }
  return result
}

/**
 * NIST 800-30 Risk Matrix Engine
 *
 * Maps likelihood and impact to qualitative levels per NIST SP 800-30 Table D-2,
 * then derives overall risk from Table I-2 (5×5 matrix).
 *
 * IP Classification: PUBLIC — standard mapping.
 */

import { ham533, crve3, scep, assetValuation } from './iap.mjs'

/**
 * Default breakpoints for qualitative levels (Table D-2).
 * Very Low [0, 0.05), Low [0.05, 0.21), Moderate [0.21, 0.80), High [0.80, 0.96), Very High [0.96, 1.0]
 */
const DEFAULT_BREAKPOINTS = [0.05, 0.21, 0.80, 0.96]

const LEVELS = ['Very Low', 'Low', 'Moderate', 'High', 'Very High']

const LIKELIHOOD_SEMI_QUANTITATIVE = [0, 2, 5, 8, 10]
const IMPACT_SEMI_QUANTITATIVE = [0, 2, 10, 50, 100]

/**
 * NIST 800-30 Table I-2: 5×5 risk determination matrix.
 * Rows: Likelihood (Very High → Very Low, top to bottom).
 * Columns: Impact (Very Low → Very High, left to right).
 */
const RISK_MATRIX = [
  ['Very Low', 'Low',      'Moderate', 'High',     'Very High'],
  ['Very Low', 'Low',      'Moderate', 'High',     'Very High'],
  ['Very Low', 'Low',      'Moderate', 'Moderate', 'High'     ],
  ['Very Low', 'Low',      'Low',      'Low',      'Moderate' ],
  ['Very Low', 'Very Low', 'Very Low', 'Low',      'Low'      ]
]

/**
 * Map a continuous value (0–1) to a qualitative level.
 *
 * @param {number}   value       - Continuous measure (0–1)
 * @param {number[]} breakpoints - Four ascending breakpoints
 * @returns {number} Level index (0–4)
 */
function toLevelIndex (value, breakpoints) {
  let index = LEVELS.length - 1

  for (let i = 0; i < breakpoints.length; i++) {
    if (value < breakpoints[i]) {
      index = i
      break
    }
  }

  return index
}

/**
 * Compute the full NIST 800-30 risk matrix assessment.
 *
 * Supports four input modes:
 * 1. Pre-computed likelihood + impact
 * 2. RSK components (dual-dimension HAM533)
 * 3. RSK components (single-scalar threatPotential)
 * 4. Raw IAP inputs (threat, vulnerability, control, asset objects)
 *
 * @param {object} input - NistRiskMatrixRequest
 * @returns {object} Full NIST risk matrix response
 */
export function nistRiskMatrix (input) {
  const likelihoodBreakpoints = input.likelihoodBreakpoints || DEFAULT_BREAKPOINTS
  const impactBreakpoints = input.impactBreakpoints || DEFAULT_BREAKPOINTS

  // Resolve IAP inputs if provided as objects
  let threatProbability = input.threatProbability
  let threatImpact = input.threatImpact
  let vulnerabilityValue = typeof input.vulnerability === 'number' ? input.vulnerability : null
  let controlValue = typeof input.controlEfficacy === 'number' ? input.controlEfficacy : null
  let assetValue = typeof input.assetValue === 'number' ? input.assetValue : null

  // Resolve raw IAP inputs
  if (input.threat && typeof input.threat === 'object') {
    const hamResult = ham533(input.threat)
    threatProbability = hamResult.probability
    threatImpact = hamResult.impact
  }

  if (input.vulnerability && typeof input.vulnerability === 'object') {
    const crveResult = crve3(input.vulnerability)
    vulnerabilityValue = crveResult.exposure
  }

  if (input.control && typeof input.control === 'object') {
    const scepResult = scep(input.control)
    controlValue = scepResult.efficacy
  }

  if (input.asset && typeof input.asset === 'object') {
    const avResult = assetValuation(input.asset)
    assetValue = avResult.assetValue
  }

  // Single-scalar threat fallback
  if (input.threatPotential != null && threatProbability == null) {
    threatProbability = input.threatPotential
    threatImpact = threatImpact ?? 1.0
  }

  // Derive likelihood and impact
  let likelihood = input.likelihood
  let impact = input.impact

  if (likelihood == null && threatProbability != null) {
    const vulnerability = vulnerabilityValue ?? 1
    const control = controlValue ?? 0
    likelihood = threatProbability * vulnerability * (1 - control)
  }

  if (impact == null && threatImpact != null) {
    const asset = assetValue ?? 1
    impact = threatImpact * asset
  }

  likelihood = likelihood ?? 0
  impact = impact ?? 0

  // Clamp to [0, 1]
  likelihood = Math.max(0, Math.min(1, likelihood))
  impact = Math.max(0, Math.min(1, impact))

  // Map to qualitative levels
  const likelihoodIndex = toLevelIndex(likelihood, likelihoodBreakpoints)
  const impactIndex = toLevelIndex(impact, impactBreakpoints)

  // Risk from matrix — rows are VH(0)→VL(4) from top, so invert likelihood index
  const matrixRow = (LEVELS.length - 1) - likelihoodIndex
  const riskLevel = RISK_MATRIX[matrixRow][impactIndex]

  const likelihoodSemiQuantitative = LIKELIHOOD_SEMI_QUANTITATIVE[likelihoodIndex]
  const impactSemiQuantitative = IMPACT_SEMI_QUANTITATIVE[impactIndex]

  const result = {
    likelihood: {
      value: likelihood,
      level: LEVELS[likelihoodIndex],
      semiQuantitative: likelihoodSemiQuantitative
    },
    impact: {
      value: impact,
      level: LEVELS[impactIndex],
      semiQuantitative: impactSemiQuantitative
    },
    risk: {
      level: riskLevel,
      score: likelihoodSemiQuantitative * impactSemiQuantitative,
      position: {
        row: matrixRow,
        column: impactIndex
      }
    },
    matrix: {
      levels: [...LEVELS],
      likelihoodAxis: [...LEVELS].reverse(),
      impactAxis: [...LEVELS],
      cells: RISK_MATRIX.map(row => [...row])
    },
    components: {
      threatProbability: threatProbability ?? null,
      threatImpact: threatImpact ?? null,
      vulnerability: vulnerabilityValue ?? null,
      controlEfficacy: controlValue ?? null,
      assetValue: assetValue ?? null,
      derivedLikelihood: likelihood,
      derivedImpact: impact
    },
    breakpoints: {
      likelihood: likelihoodBreakpoints,
      impact: impactBreakpoints
    }
  }
  return result
}

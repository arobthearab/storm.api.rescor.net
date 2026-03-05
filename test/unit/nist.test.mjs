/**
 * Unit tests for the NIST 800-30 risk matrix engine.
 */

import { describe, it, expect } from 'vitest'
import { nistRiskMatrix } from '../../src/engines/nist.mjs'

describe('nistRiskMatrix', () => {
  it('should map pre-computed likelihood and impact', () => {
    const result = nistRiskMatrix({ likelihood: 0.5, impact: 0.5 })
    expect(result.likelihood.level).toBe('Moderate')
    expect(result.impact.level).toBe('Moderate')
    expect(result.risk.level).toBe('Moderate')
  })

  it('should map Very Low likelihood and Very High impact', () => {
    const result = nistRiskMatrix({ likelihood: 0.01, impact: 0.99 })
    expect(result.likelihood.level).toBe('Very Low')
    expect(result.impact.level).toBe('Very High')
    expect(result.risk.level).toBe('Low')
  })

  it('should map Very High likelihood and Very High impact', () => {
    const result = nistRiskMatrix({ likelihood: 0.99, impact: 0.99 })
    expect(result.likelihood.level).toBe('Very High')
    expect(result.impact.level).toBe('Very High')
    expect(result.risk.level).toBe('Very High')
  })

  it('should derive likelihood and impact from components', () => {
    const result = nistRiskMatrix({
      threatProbability: 0.8,
      threatImpact: 0.9,
      vulnerability: 0.7,
      controlEfficacy: 0.2,
      assetValue: 0.6
    })
    // likelihood = 0.8 * 0.7 * (1 - 0.2) = 0.448
    // impact = 0.9 * 0.6 = 0.54
    expect(result.components.derivedLikelihood).toBeCloseTo(0.448)
    expect(result.components.derivedImpact).toBeCloseTo(0.54)
    expect(result.likelihood.level).toBe('Moderate')
    expect(result.impact.level).toBe('Moderate')
  })

  it('should accept raw HAM533 input', () => {
    const result = nistRiskMatrix({
      threat: { history: 5, access: 3, means: 3 },
      impact: 0.5
    })
    // HAM533 with max inputs → probability = 1.0
    expect(result.components.threatProbability).toBe(1)
    expect(result.likelihood.value).toBeGreaterThan(0)
  })

  it('should use single-scalar threatPotential fallback', () => {
    const result = nistRiskMatrix({
      threatPotential: 0.6,
      impact: 0.5
    })
    expect(result.components.threatProbability).toBe(0.6)
  })

  it('should return the 5x5 matrix grid', () => {
    const result = nistRiskMatrix({ likelihood: 0.5, impact: 0.5 })
    expect(result.matrix.cells).toHaveLength(5)
    expect(result.matrix.cells[0]).toHaveLength(5)
    expect(result.matrix.levels).toHaveLength(5)
  })

  it('should include semi-quantitative values', () => {
    const result = nistRiskMatrix({ likelihood: 0.5, impact: 0.5 })
    expect(result.likelihood.semiQuantitative).toBe(5) // Moderate
    expect(result.impact.semiQuantitative).toBe(10)    // Moderate
    expect(result.risk.score).toBe(50)                 // 5 * 10
  })
})

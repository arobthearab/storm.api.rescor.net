/**
 * Unit tests for RSK/RM risk mode engine.
 */

import { describe, it, expect } from 'vitest'
import { adjust, singleLossExpectancy, distributedLossExpectancy, assess } from '../../src/engines/riskMode.mjs'

describe('adjust', () => {
  it('should pass through with default factor weights', () => {
    const result = adjust({
      riskFactors: [{ baseMeasurement: 50 }, { baseMeasurement: 30 }],
      scalingBase: 4
    })
    expect(result.aggregate).toBe(58) // 50 + 30/4 = 57.5 → ceil = 58
    expect(result.adjustedMeasurements).toEqual([50, 30])
  })

  it('should apply confidence and asset adjustments', () => {
    const result = adjust({
      riskFactors: [
        { baseMeasurement: 100, confidence: 0.5, assetValue: 0.8, threatPotential: 1 }
      ]
    })
    // 0.5 * 0.8 * 1 * 100 = 40
    expect(result.adjustedMeasurements[0]).toBeCloseTo(40)
  })
})

describe('singleLossExpectancy', () => {
  it('should compute SLE = A × V × (1 − C)', () => {
    const result = singleLossExpectancy({ assetValue: 0.8, vulnerability: 0.6, controlEfficacy: 0.3 })
    // 0.8 * 0.6 * 0.7 = 0.336
    expect(result.value).toBeCloseTo(0.336)
    expect(result.formula).toBe('SLE = A × V × (1 − C)')
  })
})

describe('distributedLossExpectancy', () => {
  it('should compute DLE = A × T × V × (1 − C)', () => {
    const result = distributedLossExpectancy({
      assetValue: 0.8, threatPotential: 0.5, vulnerability: 0.6, controlEfficacy: 0.3
    })
    // 0.8 * 0.5 * 0.6 * 0.7 = 0.168
    expect(result.value).toBeCloseTo(0.168)
  })
})

describe('assess', () => {
  it('should produce full assessment result', () => {
    const result = assess({
      riskFactors: [{ baseMeasurement: 50 }, { baseMeasurement: 30 }],
      asset: 0.8,
      threat: 0.5,
      vulnerability: 0.6,
      control: 0.2
    })
    expect(result).toHaveProperty('aggregate')
    expect(result).toHaveProperty('normalized')
    expect(result).toHaveProperty('rating')
    expect(result).toHaveProperty('sle')
    expect(result).toHaveProperty('dle')
    expect(result.factors.assetValue).toBe(0.8)
  })
})

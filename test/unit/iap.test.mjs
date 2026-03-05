/**
 * Unit tests for IAP engine functions.
 */

import { describe, it, expect } from 'vitest'
import { ham533, crve3, scep, assetValuation } from '../../src/engines/iap.mjs'

describe('ham533', () => {
  it('should compute max threat (5, 3, 3)', () => {
    const result = ham533({ history: 5, access: 3, means: 3 })
    expect(result.probability).toBe(1)
    expect(result.impact).toBe(1)
    expect(result.factors.product).toBe(45)
  })

  it('should compute min threat (1, 1, 1)', () => {
    const result = ham533({ history: 1, access: 1, means: 1 })
    expect(result.probability).toBeCloseTo(1 / 45)
    expect(result.impact).toBeCloseTo(5 / 45)
  })

  it('should produce dual-dimension output', () => {
    const result = ham533({ history: 3, access: 2, means: 2 })
    // probability = 3*2*2/45 = 12/45
    expect(result.probability).toBeCloseTo(12 / 45)
    // impact = 5*2*2/45 = 20/45
    expect(result.impact).toBeCloseTo(20 / 45)
  })
})

describe('crve3', () => {
  it('should compute exposure for max inputs', () => {
    const result = crve3({
      capabilities: 3, resources: 3, visibility: 3,
      confidentiality: 3, integrity: 3, availability: 3
    })
    expect(result.exposure).toBeCloseTo(1)
    expect(result.basic).toBe(27)
    expect(result.basicMax).toBe(27)
  })

  it('should compute exposure for min inputs', () => {
    const result = crve3({
      capabilities: 1, resources: 1, visibility: 1,
      confidentiality: 1, integrity: 1, availability: 1
    })
    expect(result.exposure).toBeGreaterThan(0)
    expect(result.exposure).toBeLessThan(1)
  })
})

describe('scep', () => {
  it('should compute efficacy for single perfect control', () => {
    const result = scep({ controls: [{ implemented: 1, correction: 1 }] })
    expect(result.efficacy).toBe(1)
    expect(result.effectives).toEqual([1])
  })

  it('should compute efficacy for partial controls', () => {
    const result = scep({
      controls: [
        { implemented: 0.8, correction: 0.5 },
        { implemented: 0.6, correction: 0.7 }
      ]
    })
    expect(result.efficacy).toBeGreaterThan(0)
    expect(result.efficacy).toBeLessThanOrEqual(1)
    expect(result.effectives[0]).toBeCloseTo(0.4)
    expect(result.effectives[1]).toBeCloseTo(0.42)
  })

  it('should cap efficacy at 1', () => {
    const result = scep({
      controls: [
        { implemented: 1, correction: 1 },
        { implemented: 1, correction: 1 },
        { implemented: 1, correction: 1 }
      ]
    })
    expect(result.efficacy).toBe(1)
  })
})

describe('assetValuation', () => {
  it('should return 0 when no high-value data', () => {
    const result = assetValuation({
      classification: 3,
      users: 5,
      highValueData: [false, false, false]
    })
    expect(result.assetValue).toBe(0)
  })

  it('should compute max asset value', () => {
    const result = assetValuation({
      classification: 3,
      users: 5,
      highValueData: [true, true, true, true, true, true]
    })
    expect(result.assetValue).toBeCloseTo(1)
  })
})

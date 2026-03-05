/**
 * Unit tests for RSK engine functions.
 *
 * Includes verification vectors from Paper-RSK-NDA-V9.1 Appendix B.
 */

import { describe, it, expect } from 'vitest'
import {
  rskAggregate,
  rskUpperBound,
  rskNormalize,
  rskRate,
  computeScore,
  autoDetectProbability
} from '../../src/engines/rsk.mjs'

describe('rskAggregate', () => {
  it('should return 0 for empty array', () => {
    expect(rskAggregate([], 4)).toBe(0)
  })

  it('should return the single value for one measurement', () => {
    expect(rskAggregate([50], 4)).toBe(50)
  })

  it('should compute Appendix B vector {20, 5, 5, 5}', () => {
    expect(rskAggregate([20, 5, 5, 5], 4)).toBe(22)
  })

  it('should compute Appendix B vector with many 5s', () => {
    // {20, 5, 5, 5, 5, 5, 5, 5, 5, 5} — still 22 due to diminishing effect
    expect(rskAggregate([20, 5, 5, 5, 5, 5, 5, 5, 5, 5], 4)).toBe(22)
  })

  it('should compute Appendix B vector {40, 10, 5, 5, 5, 5, 5, 5}', () => {
    expect(rskAggregate([40, 10, 5, 5, 5, 5, 5, 5], 4)).toBe(43)
  })

  it('should sort measurements descending', () => {
    // Same as above but unsorted
    expect(rskAggregate([5, 40, 5, 10, 5, 5, 5, 5], 4)).toBe(43)
  })

  it('should compute Appendix B vector {50, 40, 40, 20, 20, 5, 5, 5, 5, 5}', () => {
    expect(rskAggregate([50, 40, 40, 20, 20, 5, 5, 5, 5, 5], 4)).toBe(63)
  })
})

describe('rskUpperBound', () => {
  it('should compute upper bound with defaults (100, 4)', () => {
    // 100 / (1 - 1/4) = 100 / 0.75 = 133.33 → ceil = 134
    expect(rskUpperBound(100, 4)).toBe(134)
  })

  it('should compute upper bound with custom values', () => {
    // 50 / (1 - 1/2) = 50 / 0.5 = 100
    expect(rskUpperBound(50, 2)).toBe(100)
  })
})

describe('rskNormalize', () => {
  it('should normalize 0 → 0', () => {
    expect(rskNormalize(0, 100, 4)).toBe(0)
  })

  it('should cap at 100', () => {
    expect(rskNormalize(200, 100, 4)).toBe(100)
  })

  it('should normalize 67 → ~50', () => {
    const result = rskNormalize(67, 100, 4)
    expect(result).toBeCloseTo(50, 0)
  })
})

describe('rskRate', () => {
  it('should rate 0 as Low (standard)', () => {
    const { rating } = rskRate(0)
    expect(rating).toBe('Low')
  })

  it('should rate 50 as High (standard)', () => {
    const { rating } = rskRate(50)
    expect(rating).toBe('High')
  })

  it('should rate 100 as Extreme (standard)', () => {
    const { rating } = rskRate(100)
    expect(rating).toBe('Extreme')
  })

  it('should rate with alternate scale', () => {
    const { rating } = rskRate(45, { scale: 'alternate' })
    expect(rating).toBe('Medium')
  })

  it('should support custom thresholds', () => {
    const { rating } = rskRate(15, { thresholds: [10, 20], labels: ['A', 'B', 'C'] })
    expect(rating).toBe('B')
  })
})

describe('computeScore', () => {
  it('should compute full pipeline', () => {
    const result = computeScore([50, 40, 40, 20, 20, 5, 5, 5, 5, 5])
    expect(result.aggregate).toBe(63)
    expect(result.rating).toBe('High')
    expect(result.measurements[0]).toBe(50) // sorted descending
    expect(result.upperBound).toBe(134)
  })
})

describe('autoDetectProbability', () => {
  it('should pass through values <= 1.0', () => {
    expect(autoDetectProbability(0.75)).toBe(0.75)
  })

  it('should convert percentages > 1.0', () => {
    expect(autoDetectProbability(80)).toBeCloseTo(0.8)
  })

  it('should handle 1.0 as probability', () => {
    expect(autoDetectProbability(1.0)).toBe(1.0)
  })
})

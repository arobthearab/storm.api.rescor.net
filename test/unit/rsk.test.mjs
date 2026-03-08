/**
 * Unit tests for RSK engine functions.
 *
 * Includes verification vectors from Paper-RSK-NDA-V9.1 Appendix B.
 */

import { describe, it, expect } from 'vitest'
import {
  rskAggregate,
  rskAggregateRaw,
  rskUpperBound,
  rskUpperBoundRaw,
  rskNormalize,
  rskRate,
  computeScore,
  normalizeToRaw
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

describe('rskAggregateRaw', () => {
  it('should return 0 for empty array', () => {
    expect(rskAggregateRaw([], 4)).toBe(0)
  })

  it('should return full-precision accumulator', () => {
    // 20/1 + 5/4 + 5/16 + 5/64 = 20 + 1.25 + 0.3125 + 0.078125 = 21.640625
    expect(rskAggregateRaw([20, 5, 5, 5], 4)).toBeCloseTo(21.640625, 10)
  })

  it('should return value that rskAggregate would ceiling', () => {
    const raw = rskAggregateRaw([20, 5, 5, 5], 4)
    expect(Math.ceil(raw)).toBe(rskAggregate([20, 5, 5, 5], 4))
  })
})

describe('rskUpperBoundRaw', () => {
  it('should return full-precision upper bound', () => {
    // 100 / 0.75 = 133.333...
    expect(rskUpperBoundRaw(100, 4)).toBeCloseTo(133.3333, 3)
  })

  it('should return 1.333... for raw mode (vmax=1)', () => {
    expect(rskUpperBoundRaw(1, 4)).toBeCloseTo(1.3333, 3)
  })

  it('should return value that rskUpperBound would ceiling', () => {
    expect(Math.ceil(rskUpperBoundRaw(100, 4))).toBe(rskUpperBound(100, 4))
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
  it('should compute full pipeline with dual output', () => {
    const result = computeScore([50, 40, 40, 20, 20, 5, 5, 5, 5, 5])
    expect(result.scaled.aggregate).toBe(63)
    expect(result.scaled.upperBound).toBe(134)
    expect(result.rating).toBe('High')
    expect(result.measurements[0]).toBe(50) // sorted descending
    expect(result.raw.aggregate).toBeCloseTo(0.63, 2)
    expect(result.raw.upperBound).toBeCloseTo(1.3333, 3)
  })

  it('should handle raw-space inputs correctly', () => {
    const result = computeScore([0.20, 0.05, 0.05, 0.05])
    // raw.aggregate IS the raw accumulator (inputScale = 1)
    expect(result.raw.aggregate).toBeCloseTo(0.21640625, 10)
    expect(result.raw.upperBound).toBeCloseTo(1.3333, 3)
    // scaled values multiply up by maximumValue and ceiling
    expect(result.scaled.aggregate).toBe(22)
    expect(result.scaled.upperBound).toBe(134)
    expect(result.rating).toBe('Low')
  })

  it('should produce identical dual output for equivalent inputs in both spaces', () => {
    const scaledResult = computeScore([20, 5, 5, 5])
    const probabilityResult = computeScore([0.20, 0.05, 0.05, 0.05])

    expect(scaledResult.raw.aggregate).toBeCloseTo(probabilityResult.raw.aggregate, 10)
    expect(scaledResult.scaled.aggregate).toBe(probabilityResult.scaled.aggregate)
    expect(scaledResult.raw.upperBound).toBeCloseTo(probabilityResult.raw.upperBound, 10)
    expect(scaledResult.scaled.upperBound).toBe(probabilityResult.scaled.upperBound)
    expect(scaledResult.rating).toBe(probabilityResult.rating)
  })
})

describe('normalizeToRaw', () => {
  it('should pass through values <= 1.0', () => {
    expect(normalizeToRaw(0.75)).toBe(0.75)
  })

  it('should convert percentages > 1.0', () => {
    expect(normalizeToRaw(80)).toBeCloseTo(0.8)
  })

  it('should handle 1.0 as raw', () => {
    expect(normalizeToRaw(1.0)).toBe(1.0)
  })
})

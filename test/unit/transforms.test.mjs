/**
 * Unit tests for Transform classes and registry.
 */

import { describe, it, expect } from 'vitest'
import {
  Transform,
  Ham533Transform,
  Crve3Transform,
  CvssaTransform,
  ScepTransform,
  AssetValuationTransform,
  resolve,
  listModels,
  listDomains,
  listAll,
  defaultModel
} from '../../src/transforms/index.mjs'

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('transform registry', () => {
  it('should list all four domains', () => {
    const domains = listDomains()
    expect(domains).toContain('threat')
    expect(domains).toContain('vulnerability')
    expect(domains).toContain('control')
    expect(domains).toContain('asset')
  })

  it('should list models per domain', () => {
    expect(listModels('threat')).toEqual(['ham533'])
    expect(listModels('vulnerability')).toContain('crve3')
    expect(listModels('vulnerability')).toContain('cvssa')
    expect(listModels('control')).toEqual(['scep'])
    expect(listModels('asset')).toEqual(['asset-valuation'])
  })

  it('should resolve known transforms', () => {
    expect(resolve('threat', 'ham533')).toBe(Ham533Transform)
    expect(resolve('vulnerability', 'crve3')).toBe(Crve3Transform)
    expect(resolve('vulnerability', 'cvssa')).toBe(CvssaTransform)
    expect(resolve('control', 'scep')).toBe(ScepTransform)
    expect(resolve('asset', 'asset-valuation')).toBe(AssetValuationTransform)
  })

  it('should return null for unknown domain/model', () => {
    expect(resolve('threat', 'unknown')).toBeNull()
    expect(resolve('nonexistent', 'ham533')).toBeNull()
  })

  it('should provide default models', () => {
    expect(defaultModel('threat')).toBe('ham533')
    expect(defaultModel('vulnerability')).toBe('crve3')
    expect(defaultModel('control')).toBe('scep')
    expect(defaultModel('asset')).toBe('asset-valuation')
    expect(defaultModel('nonexistent')).toBeNull()
  })

  it('should list all transforms with metadata', () => {
    const all = listAll()
    expect(all.length).toBe(5)
    expect(all[0]).toHaveProperty('domain')
    expect(all[0]).toHaveProperty('model')
    expect(all[0]).toHaveProperty('description')
  })
})

// ---------------------------------------------------------------------------
// HAM533 Transform
// ---------------------------------------------------------------------------

describe('Ham533Transform', () => {
  it('should have correct identity', () => {
    expect(Ham533Transform.domain).toBe('threat')
    expect(Ham533Transform.model).toBe('ham533')
  })

  it('should compute max threat (5, 3, 3)', () => {
    const transform = new Ham533Transform({ history: 5, access: 3, means: 3 })
    const result = transform.execute()
    expect(result.probability).toBe(1)
    expect(result.impact).toBe(1)
    expect(result.factors.product).toBe(45)
  })

  it('should compute min threat (1, 1, 1)', () => {
    const transform = new Ham533Transform({ history: 1, access: 1, means: 1 })
    const result = transform.execute()
    expect(result.probability).toBeCloseTo(1 / 45)
    expect(result.impact).toBeCloseTo(5 / 45)
  })

  it('should produce dual-dimension output', () => {
    const transform = new Ham533Transform({ history: 3, access: 2, means: 2 })
    const result = transform.execute()
    expect(result.probability).toBeCloseTo(12 / 45)
    expect(result.impact).toBeCloseTo(20 / 45)
  })

  it('should reject missing required factors', () => {
    const transform = new Ham533Transform({ history: 3, access: 2 })
    expect(() => transform.execute()).toThrow("'means' is required")
  })

  it('should reject out-of-range values', () => {
    const transform = new Ham533Transform({ history: 6, access: 2, means: 2 })
    expect(() => transform.execute()).toThrow("'history' must be <= 5")
  })

  it('should describe its factors', () => {
    const transform = new Ham533Transform({})
    const description = transform.describe()
    expect(description.domain).toBe('threat')
    expect(description.model).toBe('ham533')
    expect(description.factors.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// CRVE3 Transform
// ---------------------------------------------------------------------------

describe('Crve3Transform', () => {
  it('should have correct identity', () => {
    expect(Crve3Transform.domain).toBe('vulnerability')
    expect(Crve3Transform.model).toBe('crve3')
  })

  it('should compute exposure for max inputs', () => {
    const transform = new Crve3Transform(
      { capabilities: 3, resources: 3, visibility: 3, confidentiality: 3, integrity: 3, availability: 3 },
      { scalingBase: 4 }
    )
    const result = transform.execute()
    expect(result.exposure).toBeCloseTo(1)
    expect(result.basic).toBe(27)
    expect(result.basicMax).toBe(27)
  })

  it('should compute exposure for min inputs', () => {
    const transform = new Crve3Transform(
      { capabilities: 1, resources: 1, visibility: 1, confidentiality: 1, integrity: 1, availability: 1 },
      { scalingBase: 4 }
    )
    const result = transform.execute()
    expect(result.exposure).toBeGreaterThan(0)
    expect(result.exposure).toBeLessThan(1)
  })
})

// ---------------------------------------------------------------------------
// CVSSA Transform
// ---------------------------------------------------------------------------

describe('CvssaTransform', () => {
  it('should have correct identity', () => {
    expect(CvssaTransform.domain).toBe('vulnerability')
    expect(CvssaTransform.model).toBe('cvssa')
  })

  it('should normalize base score to 0-1', () => {
    const transform = new CvssaTransform({ baseScore: 9.8 })
    const result = transform.execute()
    expect(result.normalizedBase).toBeCloseTo(0.98)
    expect(result.exposure).toBeCloseTo(0.98)
  })

  it('should apply temporal multiplier', () => {
    const transform = new CvssaTransform({ baseScore: 10, temporalMultiplier: 0.5 })
    const result = transform.execute()
    expect(result.exposure).toBeCloseTo(0.5)
  })

  it('should apply environmental multiplier', () => {
    const transform = new CvssaTransform({ baseScore: 10, environmentalMultiplier: 0.3 })
    const result = transform.execute()
    expect(result.exposure).toBeCloseTo(0.3)
  })

  it('should apply both multipliers', () => {
    const transform = new CvssaTransform({ baseScore: 10, temporalMultiplier: 0.8, environmentalMultiplier: 0.5 })
    const result = transform.execute()
    expect(result.exposure).toBeCloseTo(0.4)
  })

  it('should clamp exposure to [0, 1]', () => {
    const transform = new CvssaTransform({ baseScore: 0 })
    const result = transform.execute()
    expect(result.exposure).toBe(0)
  })

  it('should default multipliers to 1', () => {
    const transform = new CvssaTransform({ baseScore: 7.5 })
    const result = transform.execute()
    expect(result.factors.temporalMultiplier).toBe(1)
    expect(result.factors.environmentalMultiplier).toBe(1)
  })

  it('should reject base score above 10', () => {
    const transform = new CvssaTransform({ baseScore: 11 })
    expect(() => transform.execute()).toThrow("'baseScore' must be <= 10")
  })
})

// ---------------------------------------------------------------------------
// SCEP Transform
// ---------------------------------------------------------------------------

describe('ScepTransform', () => {
  it('should have correct identity', () => {
    expect(ScepTransform.domain).toBe('control')
    expect(ScepTransform.model).toBe('scep')
  })

  it('should compute efficacy for single perfect control', () => {
    const transform = new ScepTransform({ controls: [{ implemented: 1, correction: 1 }] })
    const result = transform.execute()
    expect(result.efficacy).toBe(1)
    expect(result.effectives).toEqual([1])
  })

  it('should compute efficacy for partial controls', () => {
    const transform = new ScepTransform({
      controls: [
        { implemented: 0.8, correction: 0.5 },
        { implemented: 0.6, correction: 0.7 }
      ]
    })
    const result = transform.execute()
    expect(result.efficacy).toBeGreaterThan(0)
    expect(result.efficacy).toBeLessThanOrEqual(1)
    expect(result.effectives[0]).toBeCloseTo(0.4)
    expect(result.effectives[1]).toBeCloseTo(0.42)
  })

  it('should cap efficacy at 1', () => {
    const transform = new ScepTransform({
      controls: [
        { implemented: 1, correction: 1 },
        { implemented: 1, correction: 1 },
        { implemented: 1, correction: 1 }
      ]
    })
    const result = transform.execute()
    expect(result.efficacy).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// AssetValuation Transform
// ---------------------------------------------------------------------------

describe('AssetValuationTransform', () => {
  it('should have correct identity', () => {
    expect(AssetValuationTransform.domain).toBe('asset')
    expect(AssetValuationTransform.model).toBe('asset-valuation')
  })

  it('should return 0 when no high-value data', () => {
    const transform = new AssetValuationTransform({
      classification: 3, users: 5, highValueData: [false, false, false]
    })
    const result = transform.execute()
    expect(result.assetValue).toBe(0)
  })

  it('should compute max asset value', () => {
    const transform = new AssetValuationTransform({
      classification: 3, users: 5, highValueData: [true, true, true, true, true, true]
    })
    const result = transform.execute()
    expect(result.assetValue).toBeCloseTo(1)
  })
})

// ---------------------------------------------------------------------------
// Base class enforcement
// ---------------------------------------------------------------------------

describe('Transform base class', () => {
  it('should throw on abstract domain access', () => {
    expect(() => Transform.domain).toThrow('must be overridden')
  })

  it('should throw on abstract model access', () => {
    expect(() => Transform.model).toThrow('must be overridden')
  })

  it('should throw on abstract compute call', () => {
    const transform = new Transform({})
    expect(() => transform.compute({})).toThrow('must be overridden')
  })
})

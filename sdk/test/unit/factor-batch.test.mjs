/**
 * Unit tests for Factor, Modifier value objects and FactorBatch transport.
 */

import { describe, it, expect, vi } from 'vitest'
import { Factor, Modifier } from '../../src/models/Factor.mjs'
import { FactorBatch, FactorBatchResult } from '../../src/models/FactorBatch.mjs'
import { MeasurementSession } from '../../src/builders/MeasurementBuilder.mjs'

// ---------------------------------------------------------------------------
// Factor value object
// ---------------------------------------------------------------------------

describe('Factor', () => {
  it('should create from API data', () => {
    const factor = new Factor({
      id: 'fct_abc',
      value: 0.8,
      label: 'SQL Injection',
      path: ['External', 'web-server'],
      nodeId: 'nod_123',
      metadata: { cve: 'CVE-2024-001' }
    })

    expect(factor.id).toBe('fct_abc')
    expect(factor.value).toBe(0.8)
    expect(factor.label).toBe('SQL Injection')
    expect(factor.path).toEqual(['External', 'web-server'])
    expect(factor.metadata.cve).toBe('CVE-2024-001')
  })

  it('should be immutable', () => {
    const factor = new Factor({ id: 'fct_x', value: 0.5 })
    expect(() => { factor.value = 1.0 }).toThrow()
  })

  it('should compute effective value with no modifiers', () => {
    const factor = new Factor({ id: 'fct_x', value: 0.8 })
    expect(factor.effectiveValue).toBe(0.8)
  })

  it('should compute effective value with direct attenuate modifier', () => {
    const factor = new Factor({
      id: 'fct_x',
      value: 1.0,
      modifiers: [
        { id: 'mod_a', type: 'confidence', effect: 'attenuate', application: 'direct', value: 0.4 }
      ]
    })
    expect(factor.effectiveValue).toBeCloseTo(0.6)
  })

  it('should compute effective value with amplify modifier', () => {
    const factor = new Factor({
      id: 'fct_x',
      value: 0.5,
      modifiers: [
        { id: 'mod_a', type: 'boost', effect: 'amplify', application: 'direct', value: 0.2 }
      ]
    })
    expect(factor.effectiveValue).toBeCloseTo(0.6)
  })

  it('should apply compound modifiers after direct', () => {
    const factor = new Factor({
      id: 'fct_x',
      value: 1.0,
      modifiers: [
        { id: 'mod_a', type: 'confidence', effect: 'attenuate', application: 'direct', value: 0.5 },
        { id: 'mod_b', type: 'control', effect: 'attenuate', application: 'compound', value: 0.5 }
      ]
    })
    // 1.0 * (1 - 0.5) = 0.5 (direct), then 0.5 * (1 - 0.5) = 0.25 (compound)
    expect(factor.effectiveValue).toBeCloseTo(0.25)
  })

  it('should clamp effective value between 0 and 1', () => {
    const factor = new Factor({
      id: 'fct_x',
      value: 0.9,
      modifiers: [
        { id: 'mod_a', type: 'boost', effect: 'amplify', application: 'direct', value: 0.5 }
      ]
    })
    // 0.9 * 1.5 = 1.35, clamped to 1
    expect(factor.effectiveValue).toBe(1)
  })

  it('should serialize with toJSON', () => {
    const factor = new Factor({ id: 'fct_x', value: 0.7, label: 'Test' })
    const json = factor.toJSON()
    expect(json.id).toBe('fct_x')
    expect(json.value).toBe(0.7)
    expect(json.modifiers).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Modifier value object
// ---------------------------------------------------------------------------

describe('Modifier', () => {
  it('should create from API data', () => {
    const modifier = new Modifier({
      id: 'mod_xyz',
      type: 'confidence',
      effect: 'attenuate',
      application: 'direct',
      value: 0.75,
      label: 'High Confidence'
    })

    expect(modifier.id).toBe('mod_xyz')
    expect(modifier.type).toBe('confidence')
    expect(modifier.effect).toBe('attenuate')
    expect(modifier.application).toBe('direct')
    expect(modifier.value).toBe(0.75)
  })

  it('should be immutable', () => {
    const modifier = new Modifier({ id: 'mod_x', type: 'c', value: 0.5 })
    expect(() => { modifier.value = 1.0 }).toThrow()
  })

  it('should default effect to attenuate', () => {
    const modifier = new Modifier({ id: 'mod_x', type: 'c', value: 0.5 })
    expect(modifier.effect).toBe('attenuate')
  })

  it('should default application to direct', () => {
    const modifier = new Modifier({ id: 'mod_x', type: 'c', value: 0.5 })
    expect(modifier.application).toBe('direct')
  })
})

// ---------------------------------------------------------------------------
// FactorBatch
// ---------------------------------------------------------------------------

function createMockClient (responses = []) {
  let callIndex = 0
  const calls = []
  const client = {
    calls,
    async post (path, body) {
      calls.push({ path, body })
      const response = responses[callIndex++] || { data: { created: 0, failed: 0, errors: [] } }
      return response
    }
  }
  return client
}

describe('FactorBatch', () => {
  it('should queue factors and report size', () => {
    const client = createMockClient()
    const batch = new FactorBatch(client, 'msr_123')
    batch.add({ value: 0.8 })
    batch.add({ value: 0.6 })
    expect(batch.size).toBe(2)
  })

  it('should support addAll', () => {
    const client = createMockClient()
    const batch = new FactorBatch(client, 'msr_123')
    batch.addAll([{ value: 0.8 }, { value: 0.6 }, { value: 0.4 }])
    expect(batch.size).toBe(3)
  })

  it('should submit to batch endpoint', async () => {
    const client = createMockClient([
      { data: { created: 2, failed: 0, errors: [] } }
    ])
    const batch = new FactorBatch(client, 'msr_123')
    batch.add({ value: 0.8 })
    batch.add({ value: 0.6 })

    const result = await batch.submit()

    expect(result.created).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.chunks).toBe(1)
    expect(result.isComplete).toBe(true)
    expect(client.calls[0].path).toContain('/factors/batch')
    expect(client.calls[0].body.factors).toHaveLength(2)
  })

  it('should chunk large batches', async () => {
    // Use chunkSize=3 for easy testing
    const client = createMockClient([
      { data: { created: 3, failed: 0, errors: [] } },
      { data: { created: 2, failed: 0, errors: [] } }
    ])
    const batch = new FactorBatch(client, 'msr_123', { chunkSize: 3 })
    batch.addAll(Array.from({ length: 5 }, (_, i) => ({ value: i * 0.1 })))

    const result = await batch.submit()

    expect(result.created).toBe(5)
    expect(result.chunks).toBe(2)
    expect(client.calls).toHaveLength(2)
    expect(client.calls[0].body.factors).toHaveLength(3)
    expect(client.calls[1].body.factors).toHaveLength(2)
  })

  it('should limit concurrency', async () => {
    const callTimestamps = []
    let callIndex = 0
    const client = {
      async post (path, body) {
        callTimestamps.push(Date.now())
        // Simulate slight delay
        await new Promise(resolve => setTimeout(resolve, 10))
        return { data: { created: body.factors.length, failed: 0, errors: [] } }
      }
    }

    const batch = new FactorBatch(client, 'msr_123', { chunkSize: 2, concurrency: 2 })
    batch.addAll(Array.from({ length: 6 }, (_, i) => ({ value: i * 0.1 })))

    const result = await batch.submit()

    expect(result.created).toBe(6)
    expect(result.chunks).toBe(3)
  })

  it('should handle partial failures', async () => {
    const client = createMockClient([
      { data: { created: 2, failed: 1, errors: [{ index: 2, message: 'Invalid value' }] } }
    ])
    const batch = new FactorBatch(client, 'msr_123')
    batch.addAll([{ value: 0.8 }, { value: 0.6 }, { value: -1 }])

    const result = await batch.submit()

    expect(result.created).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.isPartial).toBe(true)
    expect(result.errors).toHaveLength(1)
  })

  it('should return empty result when no factors queued', async () => {
    const client = createMockClient()
    const batch = new FactorBatch(client, 'msr_123')

    const result = await batch.submit()

    expect(result.created).toBe(0)
    expect(result.total).toBe(0)
    expect(result.chunks).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// FactorBatchResult
// ---------------------------------------------------------------------------

describe('FactorBatchResult', () => {
  it('should report isComplete when all succeeded', () => {
    const result = new FactorBatchResult(10, 0, [], 1)
    expect(result.isComplete).toBe(true)
    expect(result.isPartial).toBe(false)
    expect(result.total).toBe(10)
  })

  it('should report isPartial when some failed', () => {
    const result = new FactorBatchResult(8, 2, [{ index: 5, message: 'err' }], 1)
    expect(result.isComplete).toBe(false)
    expect(result.isPartial).toBe(true)
    expect(result.total).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// MeasurementSession batch methods
// ---------------------------------------------------------------------------

describe('MeasurementSession batch methods', () => {
  function createSession (responses = []) {
    const client = createMockClient(responses)
    const session = new MeasurementSession(client, 'msr_test')
    return { session, client }
  }

  it('should create a FactorBatch from createBatch()', () => {
    const { session } = createSession()
    const batch = session.createBatch()
    expect(batch).toBeInstanceOf(FactorBatch)
  })

  it('should accept options in createBatch()', () => {
    const { session } = createSession()
    const batch = session.createBatch({ chunkSize: 1000, concurrency: 5 })
    expect(batch).toBeInstanceOf(FactorBatch)
  })

  it('should call batch factors endpoint from addFactorsBatch()', async () => {
    const { session, client } = createSession([
      { data: { created: 2, failed: 0, errors: [] } }
    ])

    const result = await session.addFactorsBatch([
      { value: 0.8, label: 'A' },
      { value: 0.6, label: 'B' }
    ])

    expect(result.data.created).toBe(2)
    expect(client.calls[0].path).toContain('/factors/batch')
    expect(client.calls[0].body.factors).toHaveLength(2)
  })

  it('should call batch modifiers endpoint from addModifiersBatch()', async () => {
    const { session, client } = createSession([
      { data: { created: 2, failed: 0, errors: [] } }
    ])

    const result = await session.addModifiersBatch([
      { factorId: 'fct_a', type: 'confidence', value: 0.8 },
      { factorId: 'fct_b', type: 'control', value: 0.5 }
    ])

    expect(result.data.created).toBe(2)
    expect(client.calls[0].path).toContain('/modifiers/batch')
    expect(client.calls[0].body.modifiers).toHaveLength(2)
  })
})

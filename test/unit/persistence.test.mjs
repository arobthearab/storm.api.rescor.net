/**
 * Unit tests for the Neo4j measurement persistence layer.
 *
 * Uses a mock database wrapper that captures Cypher statements and
 * returns shaped rows, so tests run without a real Neo4j instance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MeasurementStore } from '../../src/persistence/MeasurementStore.mjs'

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

/**
 * Create a mock SessionPerQueryWrapper.
 * `query(cypher, params)` captures calls and returns scripted rows.
 * `transaction(callback)` passes a mock transaction to the callback.
 */
function createMockDatabase () {
  const calls = []
  let queryResults = []

  const mockDatabase = {
    calls,
    /**
     * Push expected return rows for the next N `query()` calls (FIFO).
     * Each entry is an array of row objects.
     */
    nextResults (...results) {
      queryResults.push(...results)
    },

    async query (cypher, parameters = {}) {
      calls.push({ type: 'query', cypher, parameters })
      const rows = queryResults.shift() || []
      return rows
    },

    async transaction (callback) {
      const transactionCalls = []
      const mockTransaction = {
        calls: transactionCalls,
        async run (cypher, parameters = {}) {
          transactionCalls.push({ cypher, parameters })
          calls.push({ type: 'transaction-run', cypher, parameters })
          const rows = queryResults.shift() || []
          return {
            records: rows.map(row => ({
              toObject: () => row,
              get: (key) => row[key]
            }))
          }
        }
      }
      const transactionResult = await callback(mockTransaction)
      return transactionResult
    },

    async disconnect () {}
  }

  return mockDatabase
}

// ---------------------------------------------------------------------------
// Helpers — build mock Neo4j result rows
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString()
const EXPIRES = new Date(Date.now() + 86400000).toISOString()
const TTL = Date.now() + 86400000

/**
 * Build a mock row matching `RETURN m, count(f) AS factorCount`
 * where `m` is a Measurement node.
 */
function measurementQueryRow (overrides = {}) {
  const m = {
    id: 'msr_test123',
    name: 'Test Assessment',
    template: 'default',
    levels: '["items"]',       // JSON-stringified in DB
    scalingBase: 4,
    maximumValue: 100,
    createdAt: NOW,
    expiresAt: EXPIRES,
    ttl: TTL,
    metadata: '{}',
    ...overrides
  }
  const row = { m, factorCount: overrides.factorCount ?? 0 }
  return row
}

/**
 * Build a mock row matching `RETURN f, collect(...) AS modifiers`
 * where `f` is a Factor node.
 */
function factorQueryRow (overrides = {}) {
  const f = {
    id: 'fct_test123',
    measurementId: 'msr_test123',
    nodeId: 'nod_abc',
    value: 0.75,
    path: '["root"]',          // JSON-stringified
    label: 'Test Factor',
    metadata: '{}',
    ...overrides
  }
  const row = { f, modifiers: overrides.modifiers || [] }
  return row
}

/**
 * Build a mock row matching `RETURN n.id AS nodeId`.
 */
function nodeIdRow (nodeId = 'nod_abc') {
  return { nodeId }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeasurementStore', () => {
  let database
  let store

  beforeEach(() => {
    database = createMockDatabase()
    store = new MeasurementStore(database)
  })

  describe('measurements', () => {
    it('should create a measurement and return shaped result', async () => {
      // createMeasurement calls CREATE (no return) then getMeasurement (RETURN m, factorCount)
      database.nextResults(
        [],                                       // CREATE query returns nothing
        [measurementQueryRow()]                    // getMeasurement query
      )

      const measurement = await store.createMeasurement({ name: 'Test Assessment' })

      expect(measurement.id).toBe('msr_test123')
      expect(measurement.name).toBe('Test Assessment')
      expect(measurement.hierarchy.template).toBe('default')
      expect(measurement.hierarchy.levels).toEqual(['items'])
      expect(measurement.configuration.scalingBase).toBe(4)
      expect(measurement.configuration.maximumValue).toBe(100)

      // Verify CREATE cypher was issued
      expect(database.calls[0].type).toBe('query')
      expect(database.calls[0].cypher).toContain('CREATE (m:Measurement')
    })

    it('should create with security_scan hierarchy', async () => {
      database.nextResults(
        [],
        [measurementQueryRow({
          template: 'security_scan',
          levels: '["test","horizon","host","finding","annotation"]'
        })]
      )

      const measurement = await store.createMeasurement({
        name: 'Scan',
        hierarchy: 'security_scan'
      })
      expect(measurement.hierarchy.template).toBe('security_scan')
      expect(measurement.hierarchy.levels).toEqual(['test', 'horizon', 'host', 'finding', 'annotation'])
    })

    it('should create with custom array hierarchy', async () => {
      database.nextResults(
        [],
        [measurementQueryRow({
          template: 'custom',
          levels: '["project","component","issue"]'
        })]
      )

      const measurement = await store.createMeasurement({
        name: 'Custom',
        hierarchy: ['project', 'component', 'issue']
      })
      expect(measurement.hierarchy.template).toBe('custom')
      expect(measurement.hierarchy.levels).toEqual(['project', 'component', 'issue'])
    })

    it('should retrieve a measurement', async () => {
      database.nextResults([measurementQueryRow()])

      const measurement = await store.getMeasurement('msr_test123')

      expect(measurement).not.toBeNull()
      expect(measurement.id).toBe('msr_test123')
      expect(database.calls[0].cypher).toContain('MATCH (m:Measurement')
    })

    it('should return null for nonexistent measurement', async () => {
      database.nextResults([]) // empty result

      const measurement = await store.getMeasurement('msr_nonexistent')
      expect(measurement).toBeNull()
    })

    it('should delete a measurement', async () => {
      database.nextResults([{ deleted: true }])

      const deleted = await store.deleteMeasurement('msr_test123')
      expect(deleted).toBe(true)
      expect(database.calls[0].cypher).toContain('DETACH DELETE')
    })

    it('should return false when deleting nonexistent measurement', async () => {
      database.nextResults([])

      const deleted = await store.deleteMeasurement('msr_nonexistent')
      expect(deleted).toBe(false)
    })
  })

  describe('factors', () => {
    it('should add a factor', async () => {
      // addFactor calls: getMeasurement → ensureNodePath (MERGE) → CREATE → getFactor
      database.nextResults(
        [measurementQueryRow()],                    // getMeasurement
        [nodeIdRow()],                              // ensureNodePath (MERGE root)
        [],                                         // CREATE factor
        [factorQueryRow({ label: 'SQL Injection' })] // getFactor
      )

      const factor = await store.addFactor('msr_test123', { value: 0.75, label: 'SQL Injection' })
      expect(factor.id).toBe('fct_test123')
      expect(factor.value).toBe(0.75)
      expect(factor.label).toBe('SQL Injection')
    })

    it('should list factors', async () => {
      database.nextResults([
        factorQueryRow({ id: 'fct_a', value: 0.8 }),
        factorQueryRow({ id: 'fct_b', value: 0.6 })
      ])

      const factors = await store.listFactors('msr_test123')
      expect(factors).toHaveLength(2)
    })

    it('should update a factor', async () => {
      // updateFactor calls: getFactor (existing check) → SET query → getFactor (return)
      database.nextResults(
        [factorQueryRow()],                          // getFactor (existing)
        [],                                          // SET query
        [factorQueryRow({ value: 0.9 })]             // getFactor (updated)
      )

      const updated = await store.updateFactor('msr_test123', 'fct_test123', { value: 0.9 })
      expect(updated.value).toBe(0.9)
    })

    it('should delete a factor', async () => {
      database.nextResults([{ deleted: true }])

      const deleted = await store.deleteFactor('msr_test123', 'fct_test123')
      expect(deleted).toBe(true)
    })
  })

  describe('modifiers', () => {
    it('should add a modifier and return factor with modifiers', async () => {
      const modNode = { id: 'mod_abc', type: 'confidence', effect: 'attenuate', application: 'direct', value: 0.75, label: '', metadata: '{}' }
      // addModifier calls: getFactor (existing) → CREATE → getFactor (with modifier)
      database.nextResults(
        [factorQueryRow()],                                    // getFactor (check factor exists)
        [],                                                     // CREATE modifier
        [factorQueryRow({ modifiers: [modNode] })]              // getFactor (with modifier attached)
      )

      const factor = await store.addModifier('msr_test123', 'fct_test123', {
        type: 'confidence',
        value: 0.75
      })

      expect(factor.modifiers).toHaveLength(1)
      expect(factor.modifiers[0].type).toBe('confidence')
      expect(factor.modifiers[0].application).toBe('direct')
    })

    it('should delete a modifier', async () => {
      database.nextResults([{ deleted: true }])

      const deleted = await store.deleteModifier('msr_test123', 'mod_abc')
      expect(deleted).toBe(true)
    })
  })

  describe('hierarchy tree', () => {
    it('should build tree from nodes', async () => {
      // buildTree calls: query for nodes, then listFactors
      const nodeA = { id: 'nod_a', label: 'External', level: 'test', parentId: 'none', sortOrder: 0, measurementId: 'msr_test123', metadata: '{}' }
      const nodeB = { id: 'nod_b', label: 'web-server', level: 'horizon', parentId: 'nod_a', sortOrder: 0, measurementId: 'msr_test123', metadata: '{}' }
      database.nextResults(
        [{ n: nodeA }, { n: nodeB }],    // node query
        []                                // listFactors (no factors)
      )

      const tree = await store.buildTree('msr_test123')
      expect(tree).toHaveLength(1)
      expect(tree[0].label).toBe('External')
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].label).toBe('web-server')
    })
  })

  describe('batch operations', () => {
    it('should add factors in batch via transaction', async () => {
      // addFactorsBatch calls: getMeasurement (via query), then transaction(...)
      // Inside transaction: for each factor → _ensureNodePathInTransaction (MERGE) → CREATE Factor
      database.nextResults(
        [measurementQueryRow()],                   // getMeasurement
        [{ nodeId: 'nod_a' }],                     // _ensureNodePathInTransaction → MERGE for factor 1 path
        [],                                         // CREATE factor 1
        [{ nodeId: 'nod_a' }],                     // _ensureNodePathInTransaction → MERGE for factor 2 path
        []                                          // CREATE factor 2
      )

      const batchResult = await store.addFactorsBatch('msr_test123', [
        { value: 0.8, path: ['root'] },
        { value: 0.6, path: ['root'] }
      ])

      expect(batchResult.created).toBe(2)
      expect(batchResult.failed).toBe(0)
      expect(batchResult.errors).toEqual([])
    })

    it('should add modifiers in batch via transaction', async () => {
      // addModifiersBatch calls: transaction(...)
      // Inside transaction: for each modifier → MATCH factor + CREATE modifier
      database.nextResults(
        [{ modifierId: 'mod_1' }],                 // CREATE modifier 1
        [{ modifierId: 'mod_2' }]                  // CREATE modifier 2
      )

      const batchResult = await store.addModifiersBatch('msr_test123', [
        { factorId: 'fct_a', type: 'confidence', value: 0.8, effect: 'attenuate' },
        { factorId: 'fct_b', type: 'control', value: 0.5, effect: 'attenuate' }
      ])

      expect(batchResult.created).toBe(2)
      expect(batchResult.failed).toBe(0)
      expect(batchResult.errors).toEqual([])
    })

    it('should report partial failures in modifier batch', async () => {
      // Factor not found returns empty records → reported as failure
      database.nextResults(
        [{ modifierId: 'mod_1' }],                 // modifier 1 succeeds
        []                                          // modifier 2: factor not found
      )

      const batchResult = await store.addModifiersBatch('msr_test123', [
        { factorId: 'fct_a', type: 'confidence', value: 0.8, effect: 'attenuate' },
        { factorId: 'fct_missing', type: 'control', value: 0.5, effect: 'attenuate' }
      ])

      expect(batchResult.created).toBe(1)
      expect(batchResult.failed).toBe(1)
      expect(batchResult.errors[0].index).toBe(1)
    })
  })
})

describe('Validators — batch', () => {
  // Test the validators directly
  let validateFactorBatch
  let validateModifierBatch

  beforeEach(async () => {
    const validators = await import('../../src/validators/index.mjs')
    validateFactorBatch = validators.validateFactorBatch
    validateModifierBatch = validators.validateModifierBatch
  })

  describe('validateFactorBatch', () => {
    it('should accept valid factor batch', () => {
      const result = validateFactorBatch({
        factors: [
          { value: 0.8, path: ['root', 'child'], label: 'F1' },
          { value: 0.5 }
        ]
      })
      expect(result.factors).toHaveLength(2)
      expect(result.factors[0].value).toBe(0.8)
      expect(result.factors[0].path).toEqual(['root', 'child'])
    })

    it('should accept factors with inline modifiers', () => {
      const result = validateFactorBatch({
        factors: [
          {
            value: 0.7,
            path: ['root'],
            modifiers: [
              { type: 'confidence', value: 0.9, effect: 'attenuate' }
            ]
          }
        ]
      })
      expect(result.factors[0].modifiers).toHaveLength(1)
      expect(result.factors[0].modifiers[0].type).toBe('confidence')
    })

    it('should reject empty factors array', () => {
      expect(() => validateFactorBatch({ factors: [] })).toThrow()
    })

    it('should reject missing factors key', () => {
      expect(() => validateFactorBatch({ items: [] })).toThrow()
    })

    it('should reject non-object body', () => {
      expect(() => validateFactorBatch(null)).toThrow()
    })

    it('should reject factor with missing value', () => {
      expect(() => validateFactorBatch({ factors: [{ path: ['a'] }] })).toThrow("'value' is required")
    })

    it('should reject factor with negative value', () => {
      expect(() => validateFactorBatch({ factors: [{ value: -1 }] })).toThrow()
    })

    it('should reject invalid path type', () => {
      expect(() => validateFactorBatch({ factors: [{ value: 0.5, path: 'not-array' }] })).toThrow()
    })

    it('should reject invalid inline modifier', () => {
      expect(() => validateFactorBatch({
        factors: [{ value: 0.5, modifiers: [{ type: 'x' }] }]
      })).toThrow("'value' is required")
    })

    it('should enforce batch limit', () => {
      const oversized = Array.from({ length: 10001 }, () => ({ value: 0.5 }))
      expect(() => validateFactorBatch({ factors: oversized })).toThrow('at most 10000')
    })
  })

  describe('validateModifierBatch', () => {
    it('should accept valid modifier batch', () => {
      const result = validateModifierBatch({
        modifiers: [
          { factorId: 'fct_abc', type: 'confidence', value: 0.8 },
          { factorId: 'fct_def', type: 'control', value: 0.5, effect: 'amplify' }
        ]
      })
      expect(result.modifiers).toHaveLength(2)
      expect(result.modifiers[0].factorId).toBe('fct_abc')
      expect(result.modifiers[1].effect).toBe('amplify')
    })

    it('should reject missing factorId', () => {
      expect(() => validateModifierBatch({
        modifiers: [{ type: 'confidence', value: 0.5 }]
      })).toThrow("'factorId' is required")
    })

    it('should reject empty modifiers array', () => {
      expect(() => validateModifierBatch({ modifiers: [] })).toThrow()
    })

    it('should reject modifier value > 1', () => {
      expect(() => validateModifierBatch({
        modifiers: [{ factorId: 'fct_x', type: 'c', value: 1.5 }]
      })).toThrow()
    })

    it('should reject invalid effect enum', () => {
      expect(() => validateModifierBatch({
        modifiers: [{ factorId: 'fct_x', type: 'c', value: 0.5, effect: 'invalid' }]
      })).toThrow()
    })

    it('should enforce batch limit', () => {
      const oversized = Array.from({ length: 10001 }, (_, i) => ({
        factorId: `fct_${i}`, type: 'c', value: 0.5
      }))
      expect(() => validateModifierBatch({ modifiers: oversized })).toThrow('at most 10000')
    })
  })
})

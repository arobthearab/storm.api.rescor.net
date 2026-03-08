/**
 * Unit tests for the LinkageStore suggestion engine.
 *
 * Verifies catalog-driven recommendation queries return the expected
 * shapes and handle edge cases (no asset, no matches, optional filter).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LinkageStore } from '../../src/persistence/LinkageStore.mjs'

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

function createMockDatabase () {
  const calls = []
  let queryResults = []

  const mockDatabase = {
    calls,

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
          return { records: [] }
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
// Tests
// ---------------------------------------------------------------------------

describe('LinkageStore — Suggestions', () => {
  let database
  let store

  beforeEach(() => {
    database = createMockDatabase()
    store = new LinkageStore(database)
  })

  // -----------------------------------------------------------------------
  // suggestThreatsForAsset
  // -----------------------------------------------------------------------

  describe('suggestThreatsForAsset', () => {
    it('returns threat classes that target the asset type', async () => {
      database.nextResults([
        {
          id: 'tc-adversarial-outsider',
          name: 'Adversarial — Outsider',
          description: 'External hostile actor',
          source: 'adversarial',
          iapDefaults: '{"model":"ham533","history":3,"access":1,"means":2}'
        },
        {
          id: 'tc-accidental',
          name: 'Accidental',
          description: 'Unintentional actions',
          source: 'accidental',
          iapDefaults: '{"model":"ham533","history":4,"access":2,"means":1}'
        }
      ])

      const result = await store.suggestThreatsForAsset('ast_abc123')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'tc-adversarial-outsider',
        name: 'Adversarial — Outsider',
        source: 'adversarial'
      })
      expect(result[0].iapDefaults).toEqual({
        model: 'ham533',
        history: 3,
        access: 1,
        means: 2
      })
      expect(result[1].id).toBe('tc-accidental')
    })

    it('returns empty array when no threats target asset type', async () => {
      database.nextResults([])

      const result = await store.suggestThreatsForAsset('ast_abc123')

      expect(result).toEqual([])
    })

    it('handles null iapDefaults gracefully', async () => {
      database.nextResults([
        {
          id: 'tc-structural',
          name: 'Structural',
          description: 'Failures',
          source: null,
          iapDefaults: null
        }
      ])

      const result = await store.suggestThreatsForAsset('ast_abc123')

      expect(result[0].source).toBeNull()
      expect(result[0].iapDefaults).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // suggestVulnerabilitiesForAsset
  // -----------------------------------------------------------------------

  describe('suggestVulnerabilitiesForAsset', () => {
    it('returns vulnerability classes without threat filter', async () => {
      database.nextResults([
        {
          id: 'vc-configuration',
          name: 'Configuration Management',
          description: 'Misconfiguration',
          iapDefaults: '{"model":"crve3"}'
        }
      ])

      const result = await store.suggestVulnerabilitiesForAsset('ast_abc123')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('vc-configuration')
      expect(result[0].iapDefaults).toEqual({ model: 'crve3' })
    })

    it('filters by threat when threatId is provided', async () => {
      database.nextResults([
        {
          id: 'vc-authentication',
          name: 'Authentication',
          description: 'Weak auth',
          iapDefaults: null
        }
      ])

      const result = await store.suggestVulnerabilitiesForAsset(
        'ast_abc123',
        'thr_def456'
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('vc-authentication')

      // Verify the query included threat filtering
      const lastCall = database.calls[database.calls.length - 1]
      expect(lastCall.parameters.threatId).toBe('thr_def456')
      expect(lastCall.cypher).toContain('EXPLOITED_BY')
    })

    it('returns empty array when no vulnerabilities affect asset type', async () => {
      database.nextResults([])

      const result = await store.suggestVulnerabilitiesForAsset('ast_abc123')

      expect(result).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // suggestControlsForVulnerability
  // -----------------------------------------------------------------------

  describe('suggestControlsForVulnerability', () => {
    it('returns control families that mitigate the vulnerability class', async () => {
      database.nextResults([
        {
          id: 'cf-ac',
          name: 'Access Control',
          identifier: 'AC',
          description: 'Restrict system access',
          iapDefaults: '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}'
        },
        {
          id: 'cf-ia',
          name: 'Identification and Authentication',
          identifier: 'IA',
          description: 'Authenticate users',
          iapDefaults: '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}'
        }
      ])

      const result = await store.suggestControlsForVulnerability('vul_ghi789')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'cf-ac',
        identifier: 'AC'
      })
      expect(result[0].iapDefaults.model).toBe('scep')
      expect(result[1].identifier).toBe('IA')
    })

    it('returns empty array when no controls mitigate the vulnerability', async () => {
      database.nextResults([])

      const result = await store.suggestControlsForVulnerability('vul_ghi789')

      expect(result).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // suggestControlsForAsset
  // -----------------------------------------------------------------------

  describe('suggestControlsForAsset', () => {
    it('returns control families that protect the asset type (dual binding)', async () => {
      database.nextResults([
        {
          id: 'cf-pe',
          name: 'Physical and Environmental Protection',
          identifier: 'PE',
          description: 'Physical access controls',
          iapDefaults: null
        }
      ])

      const result = await store.suggestControlsForAsset('ast_abc123')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'cf-pe',
        identifier: 'PE',
        name: 'Physical and Environmental Protection'
      })
      expect(result[0].iapDefaults).toBeNull()
    })

    it('returns empty array when no controls protect the asset type', async () => {
      database.nextResults([])

      const result = await store.suggestControlsForAsset('ast_abc123')

      expect(result).toEqual([])
    })

    it('traverses PROTECTS catalog relationship', async () => {
      database.nextResults([])

      await store.suggestControlsForAsset('ast_abc123')

      const lastCall = database.calls[database.calls.length - 1]
      expect(lastCall.cypher).toContain('PROTECTS')
      expect(lastCall.cypher).toContain('TYPED_AS')
    })
  })
})

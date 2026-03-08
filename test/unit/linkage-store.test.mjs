/**
 * Unit tests for the LinkageStore persistence layer.
 *
 * Uses a mock database wrapper that captures Cypher statements and
 * returns shaped rows, so tests run without a real Neo4j instance.
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
// Mock data builders
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString()

function assetNode (overrides = {}) {
  return {
    id: 'ast_abc123',
    name: 'Web Server',
    value: 0.75,
    metadata: '{}',
    createdAt: NOW,
    ...overrides
  }
}

function assetTypeNode (overrides = {}) {
  return {
    id: 'at-info-system',
    name: 'Information System',
    description: 'Complete information system',
    ...overrides
  }
}

function threatNode (overrides = {}) {
  return {
    id: 'thr_def456',
    name: 'External Attacker',
    likelihood: 0.6,
    metadata: '{}',
    createdAt: NOW,
    ...overrides
  }
}

function threatClassNode (overrides = {}) {
  return {
    id: 'tc-adversarial-outsider',
    name: 'Adversarial — Outsider',
    description: 'External hostile actor',
    ...overrides
  }
}

function vulnerabilityNode (overrides = {}) {
  return {
    id: 'vul_ghi789',
    name: 'Weak Authentication',
    exposure: 0.8,
    metadata: '{}',
    createdAt: NOW,
    ...overrides
  }
}

function vulnerabilityClassNode (overrides = {}) {
  return {
    id: 'vc-authentication',
    name: 'Authentication',
    description: 'Weak authentication mechanisms',
    ...overrides
  }
}

function controlNode (overrides = {}) {
  return {
    id: 'ctl_jkl012',
    name: 'MFA Policy',
    efficacy: 0.9,
    metadata: '{}',
    createdAt: NOW,
    ...overrides
  }
}

function controlFamilyNode (overrides = {}) {
  return {
    id: 'cf-ia',
    name: 'Identification and Authentication',
    description: 'Identify and authenticate users',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinkageStore', () => {
  let database
  let store

  beforeEach(() => {
    database = createMockDatabase()
    store = new LinkageStore(database)
  })

  // -----------------------------------------------------------------------
  // ID generators
  // -----------------------------------------------------------------------

  describe('ID generators', () => {
    it('generates asset IDs with correct prefix', () => {
      const id = store._assetId()
      expect(id).toMatch(/^ast_[a-f0-9]{16}$/)
    })

    it('generates threat IDs with correct prefix', () => {
      const id = store._threatId()
      expect(id).toMatch(/^thr_[a-f0-9]{16}$/)
    })

    it('generates vulnerability IDs with correct prefix', () => {
      const id = store._vulnerabilityId()
      expect(id).toMatch(/^vul_[a-f0-9]{16}$/)
    })

    it('generates control IDs with correct prefix', () => {
      const id = store._controlId()
      expect(id).toMatch(/^ctl_[a-f0-9]{16}$/)
    })
  })

  // -----------------------------------------------------------------------
  // Entity type resolution
  // -----------------------------------------------------------------------

  describe('entity type resolution', () => {
    it('resolves asset from prefix', () => {
      expect(store._resolveEntityType('ast_abc123')).toBe('asset')
    })

    it('resolves threat from prefix', () => {
      expect(store._resolveEntityType('thr_def456')).toBe('threat')
    })

    it('resolves vulnerability from prefix', () => {
      expect(store._resolveEntityType('vul_ghi789')).toBe('vulnerability')
    })

    it('resolves control from prefix', () => {
      expect(store._resolveEntityType('ctl_jkl012')).toBe('control')
    })

    it('returns null for unknown prefix', () => {
      expect(store._resolveEntityType('xxx_unknown')).toBeNull()
    })

    it('returns null for null input', () => {
      expect(store._resolveEntityType(null)).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Asset CRUD
  // -----------------------------------------------------------------------

  describe('createAsset', () => {
    it('creates asset with catalog type verification and re-read', async () => {
      const typeN = assetTypeNode()
      const entityN = assetNode()

      database.nextResults(
        [{ typeId: 'at-info-system' }],       // catalog type check
        [],                                     // CREATE
        [{ e: entityN, t: typeN }]             // _getEntity re-read
      )

      const result = await store.createAsset({
        name: 'Web Server',
        typeId: 'at-info-system',
        value: 0.75
      })

      expect(result).not.toBeNull()
      expect(result.id).toBe('ast_abc123')
      expect(result.name).toBe('Web Server')
      expect(result.value).toBe(0.75)
      expect(result.typeId).toBe('at-info-system')
      expect(result.catalogType.name).toBe('Information System')
      expect(result.metadata).toEqual({})
    })

    it('returns null when catalog type does not exist', async () => {
      database.nextResults([])  // catalog type check — empty

      const result = await store.createAsset({
        name: 'Bad Asset',
        typeId: 'at-nonexistent',
        value: 0.5
      })

      expect(result).toBeNull()
    })
  })

  describe('getAsset', () => {
    it('returns asset with catalog type', async () => {
      database.nextResults([{ e: assetNode(), t: assetTypeNode() }])

      const result = await store.getAsset('ast_abc123')

      expect(result.id).toBe('ast_abc123')
      expect(result.value).toBe(0.75)
      expect(result.typeId).toBe('at-info-system')
      expect(result.catalogType).toBeDefined()
    })

    it('returns null when not found', async () => {
      database.nextResults([])

      const result = await store.getAsset('ast_nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('listAssets', () => {
    it('lists all assets without filter', async () => {
      database.nextResults([
        { e: assetNode(), t: assetTypeNode() },
        { e: assetNode({ id: 'ast_second', name: 'DB Server' }), t: assetTypeNode({ id: 'at-data-store' }) }
      ])

      const result = await store.listAssets()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Web Server')
      expect(result[1].name).toBe('DB Server')
    })

    it('filters by typeId', async () => {
      database.nextResults([
        { e: assetNode(), t: assetTypeNode() }
      ])

      const result = await store.listAssets({ typeId: 'at-info-system' })

      expect(result).toHaveLength(1)
      // Verify filter was passed as parameter
      const lastCall = database.calls[database.calls.length - 1]
      expect(lastCall.parameters.filterCatalogId).toBe('at-info-system')
    })
  })

  describe('updateAsset', () => {
    it('performs partial update', async () => {
      const updatedNode = assetNode({ name: 'Updated Server', value: 0.9 })

      database.nextResults(
        [{ e: assetNode(), t: assetTypeNode() }],       // _getEntity existence check
        [],                                               // SET
        [{ e: updatedNode, t: assetTypeNode() }]         // _getEntity re-read
      )

      const result = await store.updateAsset('ast_abc123', {
        name: 'Updated Server',
        value: 0.9
      })

      expect(result.name).toBe('Updated Server')
      expect(result.value).toBe(0.9)
    })

    it('returns null when entity not found', async () => {
      database.nextResults([])  // _getEntity returns nothing

      const result = await store.updateAsset('ast_nonexistent', { name: 'Nope' })

      expect(result).toBeNull()
    })
  })

  describe('deleteAsset', () => {
    it('deletes with cascade and returns true', async () => {
      database.nextResults([{ deleted: true }])

      const result = await store.deleteAsset('ast_abc123')

      expect(result).toBe(true)
      const lastCall = database.calls[database.calls.length - 1]
      expect(lastCall.cypher).toContain('DETACH DELETE')
    })

    it('returns false when not found', async () => {
      database.nextResults([])

      const result = await store.deleteAsset('ast_nonexistent')

      expect(result).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Threat CRUD (smoke tests — same generic code path as Asset)
  // -----------------------------------------------------------------------

  describe('createThreat', () => {
    it('creates threat with correct scalar property', async () => {
      const typeN = threatClassNode()
      const entityN = threatNode()

      database.nextResults(
        [{ typeId: 'tc-adversarial-outsider' }],
        [],
        [{ e: entityN, t: typeN }]
      )

      const result = await store.createThreat({
        name: 'External Attacker',
        classId: 'tc-adversarial-outsider',
        likelihood: 0.6
      })

      expect(result.likelihood).toBe(0.6)
      expect(result.classId).toBe('tc-adversarial-outsider')
    })
  })

  // -----------------------------------------------------------------------
  // Vulnerability CRUD (smoke test)
  // -----------------------------------------------------------------------

  describe('createVulnerability', () => {
    it('creates vulnerability with correct scalar property', async () => {
      database.nextResults(
        [{ typeId: 'vc-authentication' }],
        [],
        [{ e: vulnerabilityNode(), t: vulnerabilityClassNode() }]
      )

      const result = await store.createVulnerability({
        name: 'Weak Authentication',
        classId: 'vc-authentication',
        exposure: 0.8
      })

      expect(result.exposure).toBe(0.8)
      expect(result.classId).toBe('vc-authentication')
    })
  })

  // -----------------------------------------------------------------------
  // Control CRUD (smoke test)
  // -----------------------------------------------------------------------

  describe('createControl', () => {
    it('creates control with correct scalar property', async () => {
      database.nextResults(
        [{ typeId: 'cf-ia' }],
        [],
        [{ e: controlNode(), t: controlFamilyNode() }]
      )

      const result = await store.createControl({
        name: 'MFA Policy',
        familyId: 'cf-ia',
        efficacy: 0.9
      })

      expect(result.efficacy).toBe(0.9)
      expect(result.familyId).toBe('cf-ia')
    })
  })

  // -----------------------------------------------------------------------
  // Linkage Management
  // -----------------------------------------------------------------------

  describe('createLinkage', () => {
    it('creates EXPOSED_TO linkage with catalog validation', async () => {
      database.nextResults(
        [{ fromTypeId: 'at-info-system', toTypeId: 'tc-adversarial-outsider' }],  // entity lookup
        [{ valid: true }],                                                          // catalog check
        []                                                                          // MERGE linkage
      )

      const result = await store.createLinkage(
        'ast_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result.fromId).toBe('ast_abc123')
      expect(result.toId).toBe('thr_def456')
      expect(result.relationship).toBe('EXPOSED_TO')
      expect(result.createdAt).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('creates APPLIED_TO linkage (control → vulnerability)', async () => {
      database.nextResults(
        [{ fromTypeId: 'cf-ac', toTypeId: 'vc-access-control' }],
        [{ valid: true }],
        []
      )

      const result = await store.createLinkage(
        'ctl_jkl012',
        'vul_ghi789',
        'APPLIED_TO'
      )

      expect(result.fromId).toBe('ctl_jkl012')
      expect(result.relationship).toBe('APPLIED_TO')
      expect(result.error).toBeUndefined()
    })

    it('rejects unknown relationship', async () => {
      const result = await store.createLinkage(
        'ast_abc123',
        'thr_def456',
        'FANTASY_REL'
      )

      expect(result.error).toContain('Unknown relationship')
    })

    it('rejects wrong entity type pair', async () => {
      const result = await store.createLinkage(
        'thr_def456',   // Threat as FROM — wrong for EXPOSED_TO
        'ast_abc123',
        'EXPOSED_TO'
      )

      expect(result.error).toContain('requires asset→threat')
    })

    it('returns error when entities not found', async () => {
      database.nextResults([])  // entity lookup returns nothing

      const result = await store.createLinkage(
        'ast_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result.error).toContain('not found')
    })

    it('returns error when catalog rule does not permit linkage', async () => {
      database.nextResults(
        [{ fromTypeId: 'at-info-system', toTypeId: 'tc-environmental' }],  // entities exist
        []                                                                  // catalog check fails
      )

      const result = await store.createLinkage(
        'ast_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result.error).toContain('Catalog rule does not permit')
    })
  })

  describe('deleteLinkage', () => {
    it('deletes existing linkage', async () => {
      database.nextResults([{ deleted: true }])

      const result = await store.deleteLinkage(
        'ast_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result).toBe(true)
    })

    it('returns false for non-existent linkage', async () => {
      database.nextResults([])

      const result = await store.deleteLinkage(
        'ast_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result).toBe(false)
    })

    it('returns false for unknown relationship', async () => {
      const result = await store.deleteLinkage(
        'ast_abc123',
        'thr_def456',
        'FANTASY_REL'
      )

      expect(result).toBe(false)
    })

    it('returns false for unknown entity prefix', async () => {
      const result = await store.deleteLinkage(
        'xxx_abc123',
        'thr_def456',
        'EXPOSED_TO'
      )

      expect(result).toBe(false)
    })
  })

  describe('getLinkedEntities', () => {
    it('returns outgoing and incoming linkages by default', async () => {
      database.nextResults(
        [{ id: 'thr_def456', name: 'Attacker', relationship: 'EXPOSED_TO' }],       // outgoing
        [{ id: 'ctl_jkl012', name: 'MFA Policy', relationship: 'GUARDS' }]           // incoming
      )

      const result = await store.getLinkedEntities('ast_abc123')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'thr_def456',
        entityType: 'threat',
        relationship: 'EXPOSED_TO',
        direction: 'outgoing'
      })
      expect(result[1]).toMatchObject({
        id: 'ctl_jkl012',
        entityType: 'control',
        relationship: 'GUARDS',
        direction: 'incoming'
      })
    })

    it('filters by direction', async () => {
      database.nextResults(
        [{ id: 'thr_def456', name: 'Attacker', relationship: 'EXPOSED_TO' }]
      )

      const result = await store.getLinkedEntities('ast_abc123', {
        direction: 'outgoing'
      })

      expect(result).toHaveLength(1)
      expect(result[0].direction).toBe('outgoing')
      // Only one query should have been made (no incoming)
      expect(database.calls).toHaveLength(1)
    })

    it('filters by relationship', async () => {
      database.nextResults(
        [{ id: 'thr_def456', name: 'Attacker', relationship: 'EXPOSED_TO' }],
        []
      )

      const result = await store.getLinkedEntities('ast_abc123', {
        relationship: 'EXPOSED_TO'
      })

      expect(result).toHaveLength(1)
      const lastOutgoingCall = database.calls[0]
      expect(lastOutgoingCall.parameters.relationships).toEqual(['EXPOSED_TO'])
    })

    it('returns empty array for unknown entity type', async () => {
      const result = await store.getLinkedEntities('xxx_unknown')

      expect(result).toEqual([])
      expect(database.calls).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // Batch operations
  // -----------------------------------------------------------------------

  describe('createAssetsBatch', () => {
    it('creates multiple assets in a transaction', async () => {
      database.nextResults(
        [{ id: 'at-info-system' }, { id: 'at-data-store' }],  // pre-validate catalog IDs
        [],   // transaction.run for first asset
        []    // transaction.run for second asset
      )

      const result = await store.createAssetsBatch([
        { name: 'Web Server', typeId: 'at-info-system', value: 0.75 },
        { name: 'DB Server', typeId: 'at-data-store', value: 0.6 }
      ])

      expect(result.created).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toEqual([])
    })

    it('reports invalid catalog IDs', async () => {
      database.nextResults(
        [{ id: 'at-info-system' }]  // only one valid catalog ID
      )

      const result = await store.createAssetsBatch([
        { name: 'Good Asset', typeId: 'at-info-system', value: 0.5 },
        { name: 'Bad Asset', typeId: 'at-nonexistent', value: 0.3 }
      ])

      expect(result.created).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors[0].index).toBe(1)
      expect(result.errors[0].message).toContain('Invalid catalog type')
    })
  })

  describe('createThreatsBatch', () => {
    it('creates threats with classId mapping', async () => {
      database.nextResults(
        [{ id: 'tc-adversarial-outsider' }],
        []
      )

      const result = await store.createThreatsBatch([
        { name: 'Attacker', classId: 'tc-adversarial-outsider', likelihood: 0.7 }
      ])

      expect(result.created).toBe(1)
      expect(result.failed).toBe(0)
    })
  })

  describe('createVulnerabilitiesBatch', () => {
    it('creates vulnerabilities with classId mapping', async () => {
      database.nextResults(
        [{ id: 'vc-authentication' }],
        []
      )

      const result = await store.createVulnerabilitiesBatch([
        { name: 'Weak Auth', classId: 'vc-authentication', exposure: 0.8 }
      ])

      expect(result.created).toBe(1)
    })
  })

  describe('createControlsBatch', () => {
    it('creates controls with familyId mapping', async () => {
      database.nextResults(
        [{ id: 'cf-ia' }],
        []
      )

      const result = await store.createControlsBatch([
        { name: 'MFA', familyId: 'cf-ia', efficacy: 0.9 }
      ])

      expect(result.created).toBe(1)
    })
  })
})

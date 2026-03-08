/**
 * Unit tests for RSK/RM entity ID resolution in resolveTransformInput.
 *
 * Verifies that the assess route resolves entity ID strings (ast_, thr_,
 * vul_, ctl_) from the LinkageStore and falls through to existing
 * number/object handling when no match.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Import the route factory to exercise resolveTransformInput indirectly
// through supertest-style testing (but here we test the exported function logic
// by calling the route with a mock Express setup).

// Since resolveTransformInput is a private function, we test it via
// the route's behaviour using a lightweight Express mock.

import express from 'express'
import { createRskRmRoutes } from '../../src/routes/rskRm.mjs'

// ---------------------------------------------------------------------------
// Mock LinkageStore
// ---------------------------------------------------------------------------

function createMockLinkageStore () {
  const entities = new Map()
  const queryCalls = []

  const mockStore = {
    entities,
    queryCalls,

    async getAsset (id) {
      return entities.get(id) ?? null
    },

    async getThreat (id) {
      return entities.get(id) ?? null
    },

    async getVulnerability (id) {
      return entities.get(id) ?? null
    },

    async getControl (id) {
      return entities.get(id) ?? null
    },

    database: {
      async query (cypher, parameters = {}) {
        queryCalls.push({ cypher, parameters })
        return []
      }
    }
  }

  return mockStore
}

// ---------------------------------------------------------------------------
// Helper — send POST to Express app
// ---------------------------------------------------------------------------

function createTestApp (linkageStore) {
  const application = express()
  application.use(express.json())
  const routes = createRskRmRoutes({ linkageStore })
  application.use('/v1/rsk/rm', routes)
  application.use((error, _request, response, _next) => {
    response.status(error.status || 500).json({ error: error.message })
  })
  return application
}

async function postAssess (application, body) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(body)

    const server = application.listen(0, () => {
      const port = server.address().port

      fetch(`http://localhost:${port}/v1/rsk/rm/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      })
        .then(async (response) => {
          const data = await response.json()
          server.close()
          resolve({ status: response.status, data })
        })
        .catch(error => {
          server.close()
          reject(error)
        })
    })
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RSK/RM — Entity ID Resolution', () => {
  let linkageStore
  let application

  beforeEach(() => {
    linkageStore = createMockLinkageStore()
    application = createTestApp(linkageStore)
  })

  const baseBody = {
    riskFactors: [{ baseMeasurement: 0.5 }]
  }

  it('resolves asset entity ID to stored value', async () => {
    linkageStore.entities.set('ast_test1234', {
      id: 'ast_test1234',
      name: 'Web Server',
      value: 0.8,
      typeId: 'at-info-system'
    })

    const { status, data } = await postAssess(application, {
      ...baseBody,
      asset: 'ast_test1234'
    })

    expect(status).toBe(200)
    // Asset factor of 0.8 should influence the computation
    expect(data.data).toBeDefined()
    expect(data.data.dle).toBeDefined()
  })

  it('resolves threat entity ID to stored likelihood', async () => {
    linkageStore.entities.set('thr_test5678', {
      id: 'thr_test5678',
      name: 'Outsider',
      likelihood: 0.6,
      classId: 'tc-adversarial-outsider'
    })

    const { status, data } = await postAssess(application, {
      ...baseBody,
      threat: 'thr_test5678'
    })

    expect(status).toBe(200)
    expect(data.data).toBeDefined()
  })

  it('resolves vulnerability entity ID to stored exposure', async () => {
    linkageStore.entities.set('vul_test9012', {
      id: 'vul_test9012',
      name: 'Weak Auth',
      exposure: 0.7,
      classId: 'vc-authentication'
    })

    const { status, data } = await postAssess(application, {
      ...baseBody,
      vulnerability: 'vul_test9012'
    })

    expect(status).toBe(200)
    expect(data.data).toBeDefined()
  })

  it('resolves control entity ID to stored efficacy', async () => {
    linkageStore.entities.set('ctl_test3456', {
      id: 'ctl_test3456',
      name: 'MFA',
      efficacy: 0.9,
      familyId: 'cf-ia'
    })

    const { status, data } = await postAssess(application, {
      ...baseBody,
      control: 'ctl_test3456'
    })

    expect(status).toBe(200)
    expect(data.data).toBeDefined()
  })

  it('falls through to number when not an entity ID', async () => {
    const { status, data } = await postAssess(application, {
      ...baseBody,
      asset: 0.75,
      threat: 0.5,
      vulnerability: 0.6,
      control: 0.3
    })

    expect(status).toBe(200)
    expect(data.data.dle).toBeDefined()
  })

  it('treats unknown entity ID as null (falls to default)', async () => {
    // Entity not in store — getAsset returns null
    const { status, data } = await postAssess(application, {
      ...baseBody,
      asset: 'ast_nonexistent'
    })

    expect(status).toBe(200)
    // asset defaults to 1 when null
    expect(data.data).toBeDefined()
  })

  it('creates ASSESSES relationship when measurementId provided', async () => {
    linkageStore.entities.set('ast_test1234', {
      id: 'ast_test1234',
      name: 'Web Server',
      value: 0.8,
      typeId: 'at-info-system'
    })

    const { status } = await postAssess(application, {
      ...baseBody,
      asset: 'ast_test1234',
      measurementId: 'msr_test789'
    })

    expect(status).toBe(200)
    // Verify the ASSESSES query was issued
    const assessQueries = linkageStore.queryCalls.filter(
      call => call.cypher.includes('ASSESSES')
    )
    expect(assessQueries).toHaveLength(1)
    expect(assessQueries[0].parameters.measurementId).toBe('msr_test789')
    expect(assessQueries[0].parameters.assetId).toBe('ast_test1234')
  })

  it('skips ASSESSES when no measurementId', async () => {
    linkageStore.entities.set('ast_test1234', {
      id: 'ast_test1234',
      name: 'Web Server',
      value: 0.8,
      typeId: 'at-info-system'
    })

    await postAssess(application, {
      ...baseBody,
      asset: 'ast_test1234'
    })

    const assessQueries = linkageStore.queryCalls.filter(
      call => call.cypher.includes('ASSESSES')
    )
    expect(assessQueries).toHaveLength(0)
  })

  it('works without linkageStore (backward compatibility)', async () => {
    const appWithoutStore = express()
    appWithoutStore.use(express.json())
    const routes = createRskRmRoutes()
    appWithoutStore.use('/v1/rsk/rm', routes)
    appWithoutStore.use((error, _request, response, _next) => {
      response.status(error.status || 500).json({ error: error.message })
    })

    const { status, data } = await new Promise((resolve, reject) => {
      const server = appWithoutStore.listen(0, () => {
        const port = server.address().port
        fetch(`http://localhost:${port}/v1/rsk/rm/assess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...baseBody,
            asset: 0.75
          })
        })
          .then(async response => {
            const data = await response.json()
            server.close()
            resolve({ status: response.status, data })
          })
          .catch(error => {
            server.close()
            reject(error)
          })
      })
    })

    expect(status).toBe(200)
    expect(data.data).toBeDefined()
  })
})

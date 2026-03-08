/**
 * Entity CRUD routes for Asset, Threat, Vulnerability, Control.
 *
 * Each entity type follows the same pattern:
 *   POST   /v1/{entities}      — create
 *   GET    /v1/{entities}      — list (optional filter by type/class/family)
 *   GET    /v1/{entities}/:id  — get with catalog type info
 *   PUT    /v1/{entities}/:id  — partial update
 *   DELETE /v1/{entities}/:id  — delete with cascade
 *   POST   /v1/{entities}/batch — batch create
 */

import { Router } from 'express'

/**
 * Create routes for all four entity types.
 * @param {{ linkageStore: import('../persistence/LinkageStore.mjs').LinkageStore }} deps
 */
export function createEntityRoutes ({ linkageStore }) {
  const router = Router()

  // -----------------------------------------------------------------------
  // Assets
  // -----------------------------------------------------------------------

  router.post('/assets', async (request, response, next) => {
    try {
      const { name, typeId, value, metadata } = request.body
      if (!name || !typeId) {
        response.status(400).json({ error: "'name' and 'typeId' are required" })
        return
      }

      const asset = await linkageStore.createAsset({ name, typeId, value, metadata })
      if (!asset) {
        response.status(400).json({ error: `Invalid asset type: ${typeId}` })
        return
      }

      response.status(201).json(asset)
    } catch (error) { next(error) }
  })

  router.get('/assets', async (request, response, next) => {
    try {
      const filters = {}
      if (request.query.typeId) filters.typeId = request.query.typeId
      const assets = await linkageStore.listAssets(filters)
      response.json({ assets })
    } catch (error) { next(error) }
  })

  router.get('/assets/:id', async (request, response, next) => {
    try {
      const asset = await linkageStore.getAsset(request.params.id)
      if (!asset) {
        response.status(404).json({ error: 'Asset not found' })
        return
      }
      response.json(asset)
    } catch (error) { next(error) }
  })

  router.put('/assets/:id', async (request, response, next) => {
    try {
      const asset = await linkageStore.updateAsset(request.params.id, request.body)
      if (!asset) {
        response.status(404).json({ error: 'Asset not found' })
        return
      }
      response.json(asset)
    } catch (error) { next(error) }
  })

  router.delete('/assets/:id', async (request, response, next) => {
    try {
      const deleted = await linkageStore.deleteAsset(request.params.id)
      if (!deleted) {
        response.status(404).json({ error: 'Asset not found' })
        return
      }
      response.status(204).end()
    } catch (error) { next(error) }
  })

  router.post('/assets/batch', async (request, response, next) => {
    try {
      const items = request.body.items
      if (!Array.isArray(items) || items.length === 0) {
        response.status(400).json({ error: "'items' must be a non-empty array" })
        return
      }
      const result = await linkageStore.createAssetsBatch(items)
      response.status(201).json(result)
    } catch (error) { next(error) }
  })

  // -----------------------------------------------------------------------
  // Threats
  // -----------------------------------------------------------------------

  router.post('/threats', async (request, response, next) => {
    try {
      const { name, classId, likelihood, metadata } = request.body
      if (!name || !classId) {
        response.status(400).json({ error: "'name' and 'classId' are required" })
        return
      }

      const threat = await linkageStore.createThreat({ name, classId, likelihood, metadata })
      if (!threat) {
        response.status(400).json({ error: `Invalid threat class: ${classId}` })
        return
      }

      response.status(201).json(threat)
    } catch (error) { next(error) }
  })

  router.get('/threats', async (request, response, next) => {
    try {
      const filters = {}
      if (request.query.classId) filters.classId = request.query.classId
      const threats = await linkageStore.listThreats(filters)
      response.json({ threats })
    } catch (error) { next(error) }
  })

  router.get('/threats/:id', async (request, response, next) => {
    try {
      const threat = await linkageStore.getThreat(request.params.id)
      if (!threat) {
        response.status(404).json({ error: 'Threat not found' })
        return
      }
      response.json(threat)
    } catch (error) { next(error) }
  })

  router.put('/threats/:id', async (request, response, next) => {
    try {
      const threat = await linkageStore.updateThreat(request.params.id, request.body)
      if (!threat) {
        response.status(404).json({ error: 'Threat not found' })
        return
      }
      response.json(threat)
    } catch (error) { next(error) }
  })

  router.delete('/threats/:id', async (request, response, next) => {
    try {
      const deleted = await linkageStore.deleteThreat(request.params.id)
      if (!deleted) {
        response.status(404).json({ error: 'Threat not found' })
        return
      }
      response.status(204).end()
    } catch (error) { next(error) }
  })

  router.post('/threats/batch', async (request, response, next) => {
    try {
      const items = request.body.items
      if (!Array.isArray(items) || items.length === 0) {
        response.status(400).json({ error: "'items' must be a non-empty array" })
        return
      }
      const result = await linkageStore.createThreatsBatch(items)
      response.status(201).json(result)
    } catch (error) { next(error) }
  })

  // -----------------------------------------------------------------------
  // Vulnerabilities
  // -----------------------------------------------------------------------

  router.post('/vulnerabilities', async (request, response, next) => {
    try {
      const { name, classId, exposure, metadata } = request.body
      if (!name || !classId) {
        response.status(400).json({ error: "'name' and 'classId' are required" })
        return
      }

      const vulnerability = await linkageStore.createVulnerability({ name, classId, exposure, metadata })
      if (!vulnerability) {
        response.status(400).json({ error: `Invalid vulnerability class: ${classId}` })
        return
      }

      response.status(201).json(vulnerability)
    } catch (error) { next(error) }
  })

  router.get('/vulnerabilities', async (request, response, next) => {
    try {
      const filters = {}
      if (request.query.classId) filters.classId = request.query.classId
      const vulnerabilities = await linkageStore.listVulnerabilities(filters)
      response.json({ vulnerabilities })
    } catch (error) { next(error) }
  })

  router.get('/vulnerabilities/:id', async (request, response, next) => {
    try {
      const vulnerability = await linkageStore.getVulnerability(request.params.id)
      if (!vulnerability) {
        response.status(404).json({ error: 'Vulnerability not found' })
        return
      }
      response.json(vulnerability)
    } catch (error) { next(error) }
  })

  router.put('/vulnerabilities/:id', async (request, response, next) => {
    try {
      const vulnerability = await linkageStore.updateVulnerability(request.params.id, request.body)
      if (!vulnerability) {
        response.status(404).json({ error: 'Vulnerability not found' })
        return
      }
      response.json(vulnerability)
    } catch (error) { next(error) }
  })

  router.delete('/vulnerabilities/:id', async (request, response, next) => {
    try {
      const deleted = await linkageStore.deleteVulnerability(request.params.id)
      if (!deleted) {
        response.status(404).json({ error: 'Vulnerability not found' })
        return
      }
      response.status(204).end()
    } catch (error) { next(error) }
  })

  router.post('/vulnerabilities/batch', async (request, response, next) => {
    try {
      const items = request.body.items
      if (!Array.isArray(items) || items.length === 0) {
        response.status(400).json({ error: "'items' must be a non-empty array" })
        return
      }
      const result = await linkageStore.createVulnerabilitiesBatch(items)
      response.status(201).json(result)
    } catch (error) { next(error) }
  })

  // -----------------------------------------------------------------------
  // Controls
  // -----------------------------------------------------------------------

  router.post('/controls', async (request, response, next) => {
    try {
      const { name, familyId, efficacy, metadata } = request.body
      if (!name || !familyId) {
        response.status(400).json({ error: "'name' and 'familyId' are required" })
        return
      }

      const control = await linkageStore.createControl({ name, familyId, efficacy, metadata })
      if (!control) {
        response.status(400).json({ error: `Invalid control family: ${familyId}` })
        return
      }

      response.status(201).json(control)
    } catch (error) { next(error) }
  })

  router.get('/controls', async (request, response, next) => {
    try {
      const filters = {}
      if (request.query.familyId) filters.familyId = request.query.familyId
      const controls = await linkageStore.listControls(filters)
      response.json({ controls })
    } catch (error) { next(error) }
  })

  router.get('/controls/:id', async (request, response, next) => {
    try {
      const control = await linkageStore.getControl(request.params.id)
      if (!control) {
        response.status(404).json({ error: 'Control not found' })
        return
      }
      response.json(control)
    } catch (error) { next(error) }
  })

  router.put('/controls/:id', async (request, response, next) => {
    try {
      const control = await linkageStore.updateControl(request.params.id, request.body)
      if (!control) {
        response.status(404).json({ error: 'Control not found' })
        return
      }
      response.json(control)
    } catch (error) { next(error) }
  })

  router.delete('/controls/:id', async (request, response, next) => {
    try {
      const deleted = await linkageStore.deleteControl(request.params.id)
      if (!deleted) {
        response.status(404).json({ error: 'Control not found' })
        return
      }
      response.status(204).end()
    } catch (error) { next(error) }
  })

  router.post('/controls/batch', async (request, response, next) => {
    try {
      const items = request.body.items
      if (!Array.isArray(items) || items.length === 0) {
        response.status(400).json({ error: "'items' must be a non-empty array" })
        return
      }
      const result = await linkageStore.createControlsBatch(items)
      response.status(201).json(result)
    } catch (error) { next(error) }
  })

  return router
}

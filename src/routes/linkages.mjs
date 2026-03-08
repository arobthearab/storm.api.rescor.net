/**
 * Linkage management and suggestion routes.
 *
 * POST   /v1/linkages                                   — create linkage (validated)
 * GET    /v1/linkages                                   — list linkages for entity
 * DELETE /v1/linkages                                   — delete linkage
 * GET    /v1/assets/:id/suggestions/threats              — suggest threats for asset
 * GET    /v1/assets/:id/suggestions/vulnerabilities      — suggest vulns for asset
 * GET    /v1/assets/:id/suggestions/controls             — suggest controls for asset
 * GET    /v1/vulnerabilities/:id/suggestions/controls    — suggest controls for vuln
 */

import { Router } from 'express'

/**
 * Create linkage and suggestion routes.
 * @param {{ linkageStore: import('../persistence/LinkageStore.mjs').LinkageStore }} deps
 */
export function createLinkageRoutes ({ linkageStore }) {
  const router = Router()

  // -----------------------------------------------------------------------
  // Linkage CRUD
  // -----------------------------------------------------------------------

  /**
   * POST /v1/linkages
   * Create an instance linkage with catalog validation.
   * Body: { fromId, toId, relationship }
   */
  router.post('/', async (request, response, next) => {
    try {
      const { fromId, toId, relationship } = request.body
      if (!fromId || !toId || !relationship) {
        response.status(400).json({
          error: "'fromId', 'toId', and 'relationship' are required"
        })
        return
      }

      const result = await linkageStore.createLinkage(fromId, toId, relationship)

      if (result.error) {
        response.status(400).json({ error: result.error })
        return
      }

      response.status(201).json(result)
    } catch (error) { next(error) }
  })

  /**
   * GET /v1/linkages?entityId=...&direction=...&relationship=...
   * List linked entities for a given entity.
   */
  router.get('/', async (request, response, next) => {
    try {
      const { entityId, direction, relationship } = request.query
      if (!entityId) {
        response.status(400).json({ error: "'entityId' query parameter is required" })
        return
      }

      const options = {}
      if (direction) options.direction = direction
      if (relationship) options.relationship = relationship

      const linked = await linkageStore.getLinkedEntities(entityId, options)
      response.json({ linked })
    } catch (error) { next(error) }
  })

  /**
   * DELETE /v1/linkages
   * Remove an instance linkage.
   * Body: { fromId, toId, relationship }
   */
  router.delete('/', async (request, response, next) => {
    try {
      const { fromId, toId, relationship } = request.body
      if (!fromId || !toId || !relationship) {
        response.status(400).json({
          error: "'fromId', 'toId', and 'relationship' are required"
        })
        return
      }

      const deleted = await linkageStore.deleteLinkage(fromId, toId, relationship)
      if (!deleted) {
        response.status(404).json({ error: 'Linkage not found' })
        return
      }

      response.status(204).end()
    } catch (error) { next(error) }
  })

  // -----------------------------------------------------------------------
  // Suggestion endpoints
  // -----------------------------------------------------------------------

  /**
   * GET /v1/assets/:id/suggestions/threats
   */
  router.get('/assets/:id/suggestions/threats', async (request, response, next) => {
    try {
      const suggestions = await linkageStore.suggestThreatsForAsset(request.params.id)
      response.json({ suggestions })
    } catch (error) { next(error) }
  })

  /**
   * GET /v1/assets/:id/suggestions/vulnerabilities?threatId=...
   */
  router.get('/assets/:id/suggestions/vulnerabilities', async (request, response, next) => {
    try {
      const threatId = request.query.threatId ?? undefined
      const suggestions = await linkageStore.suggestVulnerabilitiesForAsset(
        request.params.id,
        threatId
      )
      response.json({ suggestions })
    } catch (error) { next(error) }
  })

  /**
   * GET /v1/assets/:id/suggestions/controls
   */
  router.get('/assets/:id/suggestions/controls', async (request, response, next) => {
    try {
      const suggestions = await linkageStore.suggestControlsForAsset(request.params.id)
      response.json({ suggestions })
    } catch (error) { next(error) }
  })

  /**
   * GET /v1/vulnerabilities/:id/suggestions/controls
   */
  router.get('/vulnerabilities/:id/suggestions/controls', async (request, response, next) => {
    try {
      const suggestions = await linkageStore.suggestControlsForVulnerability(request.params.id)
      response.json({ suggestions })
    } catch (error) { next(error) }
  })

  return router
}

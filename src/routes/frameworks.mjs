/**
 * Framework catalog routes.
 *
 * GET  /v1/frameworks           — list available frameworks
 * GET  /v1/frameworks/:name     — framework detail with full catalog
 */

import { Router } from 'express'
import { resolve, list, defaultFramework } from '../frameworks/index.mjs'

export function createFrameworkRoutes () {
  const router = Router()

  /**
   * GET /v1/frameworks
   * List all registered linkage frameworks.
   */
  router.get('/', (_request, response) => {
    const frameworks = list()
    const result = {
      frameworks,
      default: defaultFramework()
    }
    response.json(result)
  })

  /**
   * GET /v1/frameworks/:name
   * Full catalog for a specific framework.
   */
  router.get('/:name', (request, response) => {
    const FrameworkClass = resolve(request.params.name)

    if (!FrameworkClass) {
      response.status(404).json({ error: `Framework not found: ${request.params.name}` })
      return
    }

    const framework = new FrameworkClass()
    const catalog = framework.describe()
    response.json(catalog)
  })

  return router
}

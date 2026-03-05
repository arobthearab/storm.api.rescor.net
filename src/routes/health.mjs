/**
 * Health and OpenAPI routes — no authentication required.
 *
 * GET /health
 * GET /v1/openapi.yaml
 */

import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createHealthRoutes ({ phaseManager }) {
  const router = Router()

  // GET /health
  router.get('/health', (request, response) => {
    const phaseConfig = phaseManager.getPhaseConfig()

    response.json({
      data: {
        status: 'healthy',
        version: '0.1.0',
        phase: phaseConfig.phase,
        timestamp: new Date().toISOString()
      }
    })
  })

  // GET /v1/openapi.yaml
  router.get('/v1/openapi.yaml', (request, response) => {
    try {
      const yamlPath = join(__dirname, '..', '..', 'docs', 'openapi.yaml')
      const content = readFileSync(yamlPath, 'utf-8')
      response.type('text/yaml').send(content)
    } catch (error) {
      response.status(404).json({
        error: { code: 'NOT_FOUND', message: 'OpenAPI spec not available' }
      })
    }
  })

  return router
}

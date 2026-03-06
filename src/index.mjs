/**
 * STORM API — Main Application Entry Point
 *
 * Wires together:
 * - @rescor/core-db PhaseManager for deployment phase detection
 * - @rescor/core-auth via authentication middleware (dev bypass when isDevelopment)
 * - Express routes for all endpoints (including batch)
 * - Neo4j persistence for measurement sessions
 *
 * Port: 3200 (per CLAUDE.md)
 */

import express from 'express'
import { PhaseManager } from '@rescor/core-db'
import { MeasurementStore, createDatabase } from './persistence/index.mjs'
import { createAuthenticationMiddleware, authorize, errorHandler, securityHeaders, requestTracing } from './middleware/index.mjs'
import {
  createHealthRoutes,
  createMeasurementRoutes,
  createFactorRoutes,
  createModifierRoutes,
  createBatchRoutes,
  createRskVmRoutes,
  createRskRmRoutes,
  createIapRoutes,
  createNistRoutes
} from './routes/index.mjs'

const PORT = 3200

/**
 * Bootstrap and start the STORM API server.
 */
async function start () {
  // -----------------------------------------------------------------------
  // 1. Phase detection via @rescor/core-db PhaseManager
  // -----------------------------------------------------------------------
  const phaseManager = new PhaseManager()
  const phaseConfig = phaseManager.getPhaseConfig()

  console.log(`[storm] Phase: ${phaseConfig.phase} (isDevelopment=${phaseConfig.isDevelopment})`)

  // -----------------------------------------------------------------------
  // 2. Persistence — Neo4j via SessionPerQueryWrapper
  // -----------------------------------------------------------------------
  const database = await createDatabase()
  const store = new MeasurementStore(database)

  console.log('[storm] Store: Neo4j (SessionPerQueryWrapper)')

  // -----------------------------------------------------------------------
  // 3. Authentication middleware
  // -----------------------------------------------------------------------
  const authenticate = createAuthenticationMiddleware({
    phaseManager,
    oidc: {
      keycloakUrl: process.env.OIDC_KEYCLOAK_URL,
      realm: process.env.OIDC_REALM,
      audience: process.env.OIDC_AUDIENCE
    }
  })

  // -----------------------------------------------------------------------
  // 4. Express application
  // -----------------------------------------------------------------------
  const application = express()

  // Global middleware — 10 MB body limit for batch payloads
  application.use(express.json({ limit: '10mb' }))
  application.use(securityHeaders)
  application.use(requestTracing)

  // -----------------------------------------------------------------------
  // 5. Public routes (no auth)
  // -----------------------------------------------------------------------
  const healthRoutes = createHealthRoutes({ phaseManager })
  application.use(healthRoutes)

  // -----------------------------------------------------------------------
  // 6. Authenticated routes
  // -----------------------------------------------------------------------
  const measurementRoutes = createMeasurementRoutes({ store })
  const factorRoutes = createFactorRoutes({ store })
  const modifierRoutes = createModifierRoutes({ store })
  const batchRoutes = createBatchRoutes({ store })
  const rskVmRoutes = createRskVmRoutes()
  const rskRmRoutes = createRskRmRoutes()
  const iapRoutes = createIapRoutes()
  const nistRoutes = createNistRoutes()

  // Measurement lifecycle — assessor role
  application.use('/v1/measurements', authenticate, authorize('assessor'), measurementRoutes)
  application.use('/v1/measurements/:measurementId/factors', authenticate, authorize('assessor'), factorRoutes)
  application.use('/v1/measurements/:measurementId/modifiers', authenticate, authorize('assessor'), modifierRoutes)

  // Batch ingestion — assessor role
  application.use('/v1/measurements/:measurementId', authenticate, authorize('assessor'), batchRoutes)

  // RSK/VM — assessor + reviewer
  application.use('/v1/rsk/vm', authenticate, authorize('assessor', 'reviewer'), rskVmRoutes)

  // RSK/RM — assessor only
  application.use('/v1/rsk/rm', authenticate, authorize('assessor'), rskRmRoutes)

  // IAP — assessor + reviewer
  application.use('/v1/iap', authenticate, authorize('assessor', 'reviewer'), iapRoutes)

  // NIST — assessor + reviewer
  application.use('/v1/nist', authenticate, authorize('assessor', 'reviewer'), nistRoutes)

  // -----------------------------------------------------------------------
  // 7. Error handler (must be last)
  // -----------------------------------------------------------------------
  application.use(errorHandler)

  // -----------------------------------------------------------------------
  // 8. Start server with graceful shutdown
  // -----------------------------------------------------------------------
  const server = application.listen(PORT, () => {
    console.log(`[storm] STORM API listening on port ${PORT}`)
    console.log(`[storm] Endpoints: 24 (2 public, 9 measurement, 2 batch, 6 RSK/VM, 4 RSK/RM, 4 IAP, 1 NIST)`)
  })

  const shutdown = async (signal) => {
    console.log(`[storm] ${signal} received — shutting down`)
    server.close()
    await database.close()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch(error => {
  console.error('[storm] Fatal startup error:', error)
  process.exit(1)
})

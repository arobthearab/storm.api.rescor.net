/**
 * STORM API — Main Application Entry Point
 *
 * Wires together:
 * - @rescor/core-db PhaseManager for deployment phase detection
 * - @rescor/core-auth via authentication middleware (dev bypass when isDevelopment)
 * - Express routes for all 22 endpoints
 * - SQLite persistence for measurement sessions
 *
 * Port: 3200 (per CLAUDE.md)
 */

import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PhaseManager, PHASES } from '@rescor/core-db'
import { MeasurementStore } from './persistence/index.mjs'
import { createAuthenticationMiddleware, authorize, errorHandler, securityHeaders, requestTracing } from './middleware/index.mjs'
import {
  createHealthRoutes,
  createMeasurementRoutes,
  createFactorRoutes,
  createModifierRoutes,
  createRskVmRoutes,
  createRskRmRoutes,
  createIapRoutes,
  createNistRoutes
} from './routes/index.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 3200
const DATABASE_PATH = join(__dirname, '..', 'data', 'storm.db')

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
  // 2. Persistence — SQLite (in-memory for development, file for others)
  // -----------------------------------------------------------------------
  const storePath = phaseConfig.isDevelopment ? ':memory:' : DATABASE_PATH
  const store = new MeasurementStore(storePath)

  console.log(`[storm] Store: ${storePath === ':memory:' ? 'in-memory' : storePath}`)

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

  // Global middleware
  application.use(express.json())
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
  const rskVmRoutes = createRskVmRoutes()
  const rskRmRoutes = createRskRmRoutes()
  const iapRoutes = createIapRoutes()
  const nistRoutes = createNistRoutes()

  // Measurement lifecycle — assessor role
  application.use('/v1/measurements', authenticate, authorize('assessor'), measurementRoutes)
  application.use('/v1/measurements/:measurementId/factors', authenticate, authorize('assessor'), factorRoutes)
  application.use('/v1/measurements/:measurementId/modifiers', authenticate, authorize('assessor'), modifierRoutes)

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
  // 8. Start server
  // -----------------------------------------------------------------------
  application.listen(PORT, () => {
    console.log(`[storm] STORM API listening on port ${PORT}`)
    console.log(`[storm] Endpoints: 22 (2 public, 9 measurement, 6 RSK/VM, 4 RSK/RM, 4 IAP, 1 NIST)`)
  })
}

start().catch(error => {
  console.error('[storm] Fatal startup error:', error)
  process.exit(1)
})

/**
 * Batch routes — high-throughput factor and modifier ingestion.
 *
 * POST /v1/measurements/:measurementId/factors/batch
 * POST /v1/measurements/:measurementId/modifiers/batch
 */

import { Router } from 'express'
import { NotFoundError } from '@rescor/core-utils'
import { autoDetectProbability } from '../engines/rsk.mjs'
import {
  validateFactorBatch,
  validateModifierBatch
} from '../validators/index.mjs'

/**
 * Create batch routes.
 *
 * @param {object} options
 * @param {import('../persistence/MeasurementStore.mjs').MeasurementStore} options.store
 * @returns {Router}
 */
export function createBatchRoutes ({ store }) {
  const router = Router({ mergeParams: true })

  // POST /v1/measurements/:measurementId/factors/batch
  router.post('/factors/batch', async (request, response, next) => {
    try {
      const measurement = await store.getMeasurement(request.params.measurementId)
      if (!measurement) {
        throw new NotFoundError('Measurement not found')
      }

      const validated = validateFactorBatch(request.body)

      // Auto-detect probability for each factor
      const normalizedFactors = validated.factors.map(factor => {
        const normalized = {
          ...factor,
          value: autoDetectProbability(factor.value)
        }
        return normalized
      })

      const startTime = Date.now()
      const batchResult = await store.addFactorsBatch(measurement.id, normalizedFactors)
      const elapsed = Date.now() - startTime

      response.status(201).json({
        data: {
          created: batchResult.created,
          failed: batchResult.failed,
          errors: batchResult.errors
        },
        meta: {
          measurementId: measurement.id,
          submitted: normalizedFactors.length,
          elapsed: `${elapsed}ms`
        }
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/measurements/:measurementId/modifiers/batch
  router.post('/modifiers/batch', async (request, response, next) => {
    try {
      const measurement = await store.getMeasurement(request.params.measurementId)
      if (!measurement) {
        throw new NotFoundError('Measurement not found')
      }

      const validated = validateModifierBatch(request.body)

      const startTime = Date.now()
      const batchResult = await store.addModifiersBatch(measurement.id, validated.modifiers)
      const elapsed = Date.now() - startTime

      response.status(201).json({
        data: {
          created: batchResult.created,
          failed: batchResult.failed,
          errors: batchResult.errors
        },
        meta: {
          measurementId: measurement.id,
          submitted: validated.modifiers.length,
          elapsed: `${elapsed}ms`
        }
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

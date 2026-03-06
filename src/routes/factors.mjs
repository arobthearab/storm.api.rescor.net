/**
 * Factor and modifier routes — nested under measurements.
 *
 * POST   /v1/measurements/:measurementId/factors
 * GET    /v1/measurements/:measurementId/factors
 * PATCH  /v1/measurements/:measurementId/factors/:factorId
 * DELETE /v1/measurements/:measurementId/factors/:factorId
 * POST   /v1/measurements/:measurementId/factors/:factorId/modifiers
 * DELETE /v1/measurements/:measurementId/modifiers/:modifierId
 */

import { Router } from 'express'
import { NotFoundError } from '@rescor/core-utils'
import { autoDetectProbability } from '../engines/rsk.mjs'
import { computeEffective } from '../engines/modifiers.mjs'
import {
  validateAddFactor,
  validateUpdateFactor,
  validateAddModifier
} from '../validators/index.mjs'

/**
 * Build a DualMeasurement for a single factor.
 */
function buildFactorDual (factor, scalingBase, maximumValue) {
  const base = autoDetectProbability(factor.value)
  const { effective } = computeEffective(base, factor.modifiers || [], scalingBase)

  const adjustment = base - effective

  const result = {
    probability: { base, adjustment, effective },
    scaled: {
      base: Math.ceil(base * maximumValue),
      adjustment: Math.ceil(adjustment * maximumValue),
      effective: Math.ceil(effective * maximumValue)
    }
  }
  return result
}

/**
 * Enrich a factor with its DualMeasurement.
 */
function enrichFactor (factor, scalingBase, maximumValue) {
  const result = {
    ...factor,
    measurement: buildFactorDual(factor, scalingBase, maximumValue)
  }
  return result
}

/**
 * Create factor and modifier routes.
 *
 * @param {object} options
 * @param {import('../persistence/MeasurementStore.mjs').MeasurementStore} options.store
 * @returns {Router}
 */
export function createFactorRoutes ({ store }) {
  const router = Router({ mergeParams: true })

  /**
   * Resolve the parent measurement or throw 404.
   */
  async function requireMeasurement (request) {
    const measurement = await store.getMeasurement(request.params.measurementId)
    if (!measurement) {
      throw new NotFoundError('Measurement not found')
    }
    return measurement
  }

  // POST /v1/measurements/:measurementId/factors
  router.post('/', async (request, response, next) => {
    try {
      const measurement = await requireMeasurement(request)
      const validated = validateAddFactor(request.body)

      // Auto-detect probability
      validated.value = autoDetectProbability(validated.value)

      const factor = await store.addFactor(measurement.id, validated)

      if (!factor) {
        throw new NotFoundError('Measurement not found')
      }

      const { scalingBase, maximumValue } = measurement.configuration
      const enriched = enrichFactor(factor, scalingBase, maximumValue)

      response.status(201).json({ data: enriched })
    } catch (error) {
      next(error)
    }
  })

  // GET /v1/measurements/:measurementId/factors
  router.get('/', async (request, response, next) => {
    try {
      const measurement = await requireMeasurement(request)
      const factors = await store.listFactors(measurement.id)
      const { scalingBase, maximumValue } = measurement.configuration

      const enriched = factors.map(factor => enrichFactor(factor, scalingBase, maximumValue))

      response.json({
        data: enriched,
        meta: { count: enriched.length }
      })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /v1/measurements/:measurementId/factors/:factorId
  router.patch('/:factorId', async (request, response, next) => {
    try {
      const measurement = await requireMeasurement(request)
      const validated = validateUpdateFactor(request.body)

      // Auto-detect probability on value update
      if (validated.value != null) {
        validated.value = autoDetectProbability(validated.value)
      }

      const factor = await store.updateFactor(measurement.id, request.params.factorId, validated)

      if (!factor) {
        throw new NotFoundError('Factor not found')
      }

      const { scalingBase, maximumValue } = measurement.configuration
      const enriched = enrichFactor(factor, scalingBase, maximumValue)

      response.json({ data: enriched })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /v1/measurements/:measurementId/factors/:factorId
  router.delete('/:factorId', async (request, response, next) => {
    try {
      await requireMeasurement(request)
      const deleted = await store.deleteFactor(request.params.measurementId, request.params.factorId)

      if (!deleted) {
        throw new NotFoundError('Factor not found')
      }

      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/measurements/:measurementId/factors/:factorId/modifiers
  router.post('/:factorId/modifiers', async (request, response, next) => {
    try {
      const measurement = await requireMeasurement(request)
      const validated = validateAddModifier(request.body)
      const factor = await store.addModifier(measurement.id, request.params.factorId, validated)

      if (!factor) {
        throw new NotFoundError('Factor not found')
      }

      const { scalingBase, maximumValue } = measurement.configuration
      const enriched = enrichFactor(factor, scalingBase, maximumValue)

      response.status(201).json({ data: enriched })
    } catch (error) {
      next(error)
    }
  })

  return router
}

/**
 * Create modifier delete route (mounted at /v1/measurements/:measurementId/modifiers).
 *
 * @param {object} options
 * @param {import('../persistence/MeasurementStore.mjs').MeasurementStore} options.store
 * @returns {Router}
 */
export function createModifierRoutes ({ store }) {
  const router = Router({ mergeParams: true })

  // DELETE /v1/measurements/:measurementId/modifiers/:modifierId
  router.delete('/:modifierId', async (request, response, next) => {
    try {
      const measurement = await store.getMeasurement(request.params.measurementId)
      if (!measurement) {
        throw new NotFoundError('Measurement not found')
      }

      const deleted = await store.deleteModifier(measurement.id, request.params.modifierId)

      if (!deleted) {
        throw new NotFoundError('Modifier not found')
      }

      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  return router
}

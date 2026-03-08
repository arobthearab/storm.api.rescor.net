/**
 * RSK/VM routes — Vulnerability Mode stateless computation endpoints.
 *
 * POST /v1/rsk/vm/aggregate
 * POST /v1/rsk/vm/add
 * POST /v1/rsk/vm/normalize
 * POST /v1/rsk/vm/rate
 * POST /v1/rsk/vm/score
 * POST /v1/rsk/vm/limit
 */

import { Router } from 'express'
import {
  rskAggregate,
  rskAggregateRaw,
  rskUpperBound,
  rskUpperBoundRaw,
  rskNormalize,
  rskRate,
  computeScore
} from '../engines/rsk.mjs'
import {
  requireBody,
  validateNumberArray,
  validateNumber,
  validateString
} from '../validators/index.mjs'

export function createRskVmRoutes () {
  const router = Router()

  /**
   * Detect whether an array of measurements is in raw space (all <= 1.0)
   * and return the input scale factor (1 for raw, maximumValue for scaled).
   */
  function detectInputScale (measurements, maximumValue) {
    const isRawScale = measurements.every(value => value <= 1.0)
    const result = isRawScale ? 1 : maximumValue
    return result
  }

  // POST /v1/rsk/vm/aggregate
  router.post('/aggregate', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurements = validateNumberArray(body, 'measurements', { required: true })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })

      const sorted = [...measurements].sort((a, b) => b - a)
      const inputScale = detectInputScale(sorted, maximumValue)

      const rawAccumulator = rskAggregateRaw(sorted, scalingBase)
      const rawAggregate = rawAccumulator / inputScale
      const scaledAggregate = Math.ceil(rawAggregate * maximumValue)

      const rawUpperBound = rskUpperBoundRaw(1, scalingBase)
      const scaledUpperBound = rskUpperBound(maximumValue, scalingBase)

      response.json({
        data: {
          raw: {
            aggregate: rawAggregate,
            upperBound: rawUpperBound
          },
          scaled: {
            aggregate: scaledAggregate,
            upperBound: scaledUpperBound
          },
          measurements: sorted,
          scalingBase,
          maximumValue
        }
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/vm/add
  router.post('/add', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurements = validateNumberArray(body, 'measurements', { required: true })
      const measurement = validateNumber(body, 'measurement', { required: true })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })

      const previousSorted = [...measurements].sort((a, b) => b - a)
      const previousInputScale = detectInputScale(previousSorted, maximumValue)
      const previousRaw = rskAggregateRaw(previousSorted, scalingBase)
      const previousRawValue = previousRaw / previousInputScale
      const previousScaled = Math.ceil(previousRawValue * maximumValue)

      const updatedMeasurements = [...measurements, measurement]
      const sorted = updatedMeasurements.sort((a, b) => b - a)
      const inputScale = detectInputScale(sorted, maximumValue)
      const rawAccumulator = rskAggregateRaw(sorted, scalingBase)
      const rawAggregate = rawAccumulator / inputScale
      const scaledAggregate = Math.ceil(rawAggregate * maximumValue)

      response.json({
        data: {
          raw: {
            aggregate: rawAggregate,
            previousAggregate: previousRawValue
          },
          scaled: {
            aggregate: scaledAggregate,
            previousAggregate: previousScaled
          },
          measurements: sorted,
          scalingBase,
          maximumValue
        }
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/vm/normalize
  router.post('/normalize', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const raw = validateNumber(body, 'raw', { required: true, min: 0 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const rawUpperBound = rskUpperBoundRaw(1, scalingBase)
      const scaledUpperBound = rskUpperBound(maximumValue, scalingBase)

      // Detect if raw is in raw space (≤ 1.0) or scaled
      const isRawScale = raw <= 1.0
      const rawValue = isRawScale ? raw : raw / maximumValue
      const rawNormalized = rawValue / rawUpperBound
      const scaledNormalized = rskNormalize(
        isRawScale ? Math.ceil(raw * maximumValue) : raw,
        maximumValue,
        scalingBase
      )

      response.json({
        data: {
          raw: {
            normalized: rawNormalized,
            upperBound: rawUpperBound
          },
          scaled: {
            normalized: scaledNormalized,
            upperBound: scaledUpperBound
          },
          raw,
          maximumValue,
          scalingBase
        }
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/vm/rate
  router.post('/rate', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurement = validateNumber(body, 'measurement', { required: true, integer: true, min: 0 })
      const scale = validateString(body, 'scale', { enum: ['standard', 'alternate'], defaultValue: 'standard' })

      const rateOptions = { scale }
      if (body.thresholds) {
        rateOptions.thresholds = body.thresholds
        rateOptions.labels = body.labels
      }

      const { rating, thresholds, labels } = rskRate(measurement, rateOptions)

      response.json({
        data: { rating, measurement, thresholds, labels }
      })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/vm/score
  router.post('/score', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurements = validateNumberArray(body, 'measurements', { required: true })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })
      const scale = validateString(body, 'scale', { enum: ['standard', 'alternate'], defaultValue: 'standard' })
      const precision = validateNumber(body, 'precision', { integer: true })

      const scoreResult = computeScore(measurements, { scalingBase, maximumValue, scale, precision })

      response.json({ data: scoreResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/vm/limit
  router.post('/limit', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const rawUpperBound = rskUpperBoundRaw(1, scalingBase)
      const scaledUpperBound = rskUpperBound(maximumValue, scalingBase)

      response.json({
        data: {
          raw: {
            upperBound: rawUpperBound
          },
          scaled: {
            upperBound: scaledUpperBound
          },
          maximumValue,
          scalingBase
        }
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

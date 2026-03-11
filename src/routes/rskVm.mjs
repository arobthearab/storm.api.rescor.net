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
  computeScore,
  resolveInputScale
} from '../engines/rsk.mjs'
import {
  requireBody,
  validateNumberArray,
  validateNumber,
  validateString
} from '../validators/index.mjs'

export function createRskVmRoutes () {
  const router = Router()

  // POST /v1/rsk/vm/aggregate
  router.post('/aggregate', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurements = validateNumberArray(body, 'measurements', { required: true })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })
      const inputScaleHint = validateString(body, 'inputScale', { enum: ['raw', 'scaled'] })

      const sorted = [...measurements].sort((a, b) => b - a)
      const resolvedScale = resolveInputScale(sorted, maximumValue, inputScaleHint)
      const scaleFactor = resolvedScale === 'raw' ? 1 : maximumValue

      const rawAccumulator = rskAggregateRaw(sorted, scalingBase)
      const rawAggregate = rawAccumulator / scaleFactor
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
          inputScale: resolvedScale,
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
      const inputScaleHint = validateString(body, 'inputScale', { enum: ['raw', 'scaled'] })

      const updatedMeasurements = [...measurements, measurement]
      const sorted = updatedMeasurements.sort((a, b) => b - a)
      const resolvedScale = resolveInputScale(sorted, maximumValue, inputScaleHint)
      const scaleFactor = resolvedScale === 'raw' ? 1 : maximumValue

      const previousSorted = [...measurements].sort((a, b) => b - a)
      const previousRaw = rskAggregateRaw(previousSorted, scalingBase)
      const previousRawValue = previousRaw / scaleFactor
      const previousScaled = Math.ceil(previousRawValue * maximumValue)

      const rawAccumulator = rskAggregateRaw(sorted, scalingBase)
      const rawAggregate = rawAccumulator / scaleFactor
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
          inputScale: resolvedScale,
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
      const inputScaleHint = validateString(body, 'inputScale', { enum: ['raw', 'scaled'] })

      const rawUpperBound = rskUpperBoundRaw(1, scalingBase)
      const scaledUpperBound = rskUpperBound(maximumValue, scalingBase)

      const resolvedScale = resolveInputScale([raw], maximumValue, inputScaleHint)
      const isRawScale = resolvedScale === 'raw'
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
          inputScale: resolvedScale,
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
      const inputScaleHint = validateString(body, 'inputScale', { enum: ['raw', 'scaled'] })

      const scoreResult = computeScore(measurements, { scalingBase, maximumValue, scale, precision, inputScale: inputScaleHint })

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

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
  rskUpperBound,
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

  // POST /v1/rsk/vm/aggregate
  router.post('/aggregate', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const measurements = validateNumberArray(body, 'measurements', { required: true })
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const sorted = [...measurements].sort((a, b) => b - a)
      const aggregate = rskAggregate(sorted, scalingBase)
      const upperBound = rskUpperBound(Math.max(...sorted), scalingBase)

      response.json({
        data: { aggregate, measurements: sorted, scalingBase, upperBound }
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
      const minimumValue = validateNumber(body, 'minimumValue', { defaultValue: 1 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })

      const previousSorted = [...measurements].sort((a, b) => b - a)
      const previousAggregate = rskAggregate(previousSorted, scalingBase)

      const updatedMeasurements = [...measurements, measurement]
      const sorted = updatedMeasurements.sort((a, b) => b - a)
      const aggregate = rskAggregate(sorted, scalingBase)

      response.json({
        data: { aggregate, measurements: sorted, previousAggregate }
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

      const upperBound = rskUpperBound(maximumValue, scalingBase)
      const normalized = rskNormalize(raw, maximumValue, scalingBase)

      response.json({
        data: { normalized, raw, upperBound }
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

      const upperBound = rskUpperBound(maximumValue, scalingBase)

      response.json({
        data: { upperBound, maximumValue, scalingBase }
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

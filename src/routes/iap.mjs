/**
 * IAP routes — Independent Ancillary Process endpoints.
 *
 * POST /v1/iap/ham533
 * POST /v1/iap/crve3
 * POST /v1/iap/scep
 * POST /v1/iap/asset-valuation
 */

import { Router } from 'express'
import { ham533, crve3, scep, assetValuation } from '../engines/iap.mjs'
import {
  requireBody,
  validateHam533,
  validateCrve3,
  validateScep,
  validateAssetValuation,
  validateNumber
} from '../validators/index.mjs'

export function createIapRoutes () {
  const router = Router()

  // POST /v1/iap/ham533
  router.post('/ham533', (request, response, next) => {
    try {
      const validated = validateHam533(request.body)
      const computedResult = ham533(validated)

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/iap/crve3
  router.post('/crve3', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const validated = validateCrve3(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const computedResult = crve3({ ...validated, scalingBase })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/iap/scep
  router.post('/scep', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const validated = validateScep(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const computedResult = scep({ ...validated, scalingBase })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/iap/asset-valuation
  router.post('/asset-valuation', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const validated = validateAssetValuation(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const computedResult = assetValuation({ ...validated, scalingBase })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  return router
}

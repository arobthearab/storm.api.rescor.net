/**
 * IAP routes — Independent Ancillary Process endpoints.
 *
 * Domain-based endpoints with model selection:
 *
 *   POST /v1/iap/threat          { model: 'ham533', ... }
 *   POST /v1/iap/vulnerability   { model: 'crve3' | 'cvssa', ... }
 *   POST /v1/iap/control         { model: 'scep', ... }
 *   POST /v1/iap/asset           { model: 'asset-valuation', ... }
 *   GET  /v1/iap/transforms      (discovery)
 *
 * Each domain has a default model used when 'model' is omitted.
 */

import { Router } from 'express'
import { resolve, defaultModel, listAll } from '../transforms/index.mjs'
import { requireBody, validateNumber, validateString } from '../validators/index.mjs'
import { ValidationError } from '@rescor-llc/core-utils'

/**
 * Build a domain route handler.
 *
 * The handler reads `model` from the body (or uses the domain default),
 * resolves the Transform class from the registry, and executes it.
 *
 * @param {string} domain
 * @returns {Function} Express route handler
 */
function domainHandler (domain) {
  return (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const modelName = validateString(body, 'model', { defaultValue: defaultModel(domain) })

      const TransformClass = resolve(domain, modelName)

      if (!TransformClass) {
        throw new ValidationError(`Unknown model '${modelName}' for domain '${domain}'`)
      }

      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const options = { scalingBase }

      const transform = new TransformClass(body, options)
      const computedResult = transform.execute()

      response.json({
        data: {
          ...computedResult,
          domain,
          model: modelName
        }
      })
    } catch (error) {
      next(error)
    }
  }
}

export function createIapRoutes () {
  const router = Router()

  // Domain endpoints
  router.post('/threat', domainHandler('threat'))
  router.post('/vulnerability', domainHandler('vulnerability'))
  router.post('/control', domainHandler('control'))
  router.post('/asset', domainHandler('asset'))

  // Discovery — list all registered transforms
  router.get('/transforms', (request, response) => {
    const transforms = listAll()
    response.json({ data: transforms })
  })

  return router
}

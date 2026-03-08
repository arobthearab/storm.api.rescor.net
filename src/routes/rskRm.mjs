/**
 * RSK/RM routes — Risk Mode stateless computation endpoints.
 *
 * POST /v1/rsk/rm/adjust
 * POST /v1/rsk/rm/sle
 * POST /v1/rsk/rm/dle
 * POST /v1/rsk/rm/assess
 */

import { Router } from 'express'
import {
  adjust,
  singleLossExpectancy,
  distributedLossExpectancy,
  assess
} from '../engines/riskMode.mjs'
import { resolve } from '../transforms/index.mjs'
import {
  requireBody,
  validateNumber,
  validateNumberArray
} from '../validators/index.mjs'
import { ValidationError } from '@rescor/core-utils'

/**
 * Validate a RiskFactor array.
 */
function validateRiskFactors (body) {
  if (!body.riskFactors || !Array.isArray(body.riskFactors) || body.riskFactors.length < 1) {
    throw new ValidationError("'riskFactors' is required and must be a non-empty array")
  }

  const riskFactors = body.riskFactors.map((factor, index) => {
    if (typeof factor !== 'object') {
      throw new ValidationError(`'riskFactors[${index}]' must be an object`)
    }
    if (factor.baseMeasurement == null || typeof factor.baseMeasurement !== 'number') {
      throw new ValidationError(`'riskFactors[${index}].baseMeasurement' is required and must be a number`)
    }
    return {
      baseMeasurement: factor.baseMeasurement,
      confidence: factor.confidence,
      assetValue: factor.assetValue,
      threatPotential: factor.threatPotential
    }
  })

  return riskFactors
}

/** Entity ID prefix → domain mapping. */
const ENTITY_PREFIX_TO_DOMAIN = {
  ast_: 'asset',
  thr_: 'threat',
  vul_: 'vulnerability',
  ctl_: 'control'
}

/** Domain → entity scalar property name. */
const DOMAIN_TO_SCALAR = {
  asset: 'value',
  threat: 'likelihood',
  vulnerability: 'exposure',
  control: 'efficacy'
}

/**
 * Resolve a field that may be a pre-computed number, an entity ID string,
 * or a raw transform input object.
 *
 * - number  → returned as-is
 * - string  → entity ID lookup from LinkageStore (async)
 * - object  → run through IAP transform
 */
async function resolveTransformInput (value, domain, linkageStore) {
  let result = null

  if (typeof value === 'number') {
    result = value
  } else if (typeof value === 'string' && linkageStore) {
    const prefix = value.slice(0, 4)
    const entityDomain = ENTITY_PREFIX_TO_DOMAIN[prefix]
    if (entityDomain === domain) {
      const getter = 'get' + domain.charAt(0).toUpperCase() + domain.slice(1)
      const entity = await linkageStore[getter](value)
      if (entity) {
        result = entity[DOMAIN_TO_SCALAR[domain]] ?? null
      }
    }
  } else if (value && typeof value === 'object') {
    const modelName = value.model ?? null
    const TransformClass = modelName ? resolve(domain, modelName) : resolve(domain, defaultModelForDomain(domain))

    if (TransformClass) {
      const transform = new TransformClass(value, { scalingBase: value.scalingBase ?? 4 })
      const output = transform.execute()
      result = extractDomainScalar(domain, output)
    }
  }

  return result
}

/**
 * Default model names per domain — duplicated here to avoid import cycle.
 */
function defaultModelForDomain (domain) {
  const defaults = { threat: 'ham533', vulnerability: 'crve3', control: 'scep', asset: 'asset-valuation' }
  const result = defaults[domain] ?? null
  return result
}

/**
 * Extract the scalar value from a transform output for the given domain.
 */
function extractDomainScalar (domain, output) {
  let result = 0

  if (domain === 'threat') {
    result = output.probability
  } else if (domain === 'vulnerability') {
    result = output.exposure
  } else if (domain === 'control') {
    result = output.efficacy
  } else if (domain === 'asset') {
    result = output.assetValue
  }

  return result
}

export function createRskRmRoutes ({ linkageStore } = {}) {
  const router = Router()

  // POST /v1/rsk/rm/adjust
  router.post('/adjust', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const riskFactors = validateRiskFactors(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })

      const computedResult = adjust({ riskFactors, scalingBase })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/rm/sle
  router.post('/sle', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const assetValue = validateNumber(body, 'assetValue', { required: true, min: 0, max: 1 })
      const vulnerability = validateNumber(body, 'vulnerability', { required: true, min: 0, max: 1 })
      const controlEfficacy = validateNumber(body, 'controlEfficacy', { required: true, min: 0, max: 1 })

      const computedResult = singleLossExpectancy({ assetValue, vulnerability, controlEfficacy })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/rm/dle
  router.post('/dle', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const assetValue = validateNumber(body, 'assetValue', { required: true, min: 0, max: 1 })
      const threatPotential = validateNumber(body, 'threatPotential', { required: true, min: 0, max: 1 })
      const vulnerability = validateNumber(body, 'vulnerability', { required: true, min: 0, max: 1 })
      const controlEfficacy = validateNumber(body, 'controlEfficacy', { required: true, min: 0, max: 1 })

      const computedResult = distributedLossExpectancy({ assetValue, threatPotential, vulnerability, controlEfficacy })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  // POST /v1/rsk/rm/assess
  router.post('/assess', async (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const riskFactors = validateRiskFactors(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })

      // Resolve IAP inputs via transform registry or entity lookup
      const assetFactor = await resolveTransformInput(body.asset, 'asset', linkageStore)
      const threatFactor = await resolveTransformInput(body.threat, 'threat', linkageStore)
      const vulnerabilityFactor = await resolveTransformInput(body.vulnerability, 'vulnerability', linkageStore)
      const controlFactor = await resolveTransformInput(body.control, 'control', linkageStore)

      const computedResult = assess({
        riskFactors,
        asset: assetFactor ?? 1,
        threat: threatFactor ?? 1,
        vulnerability: vulnerabilityFactor ?? 1,
        control: controlFactor ?? 0,
        scalingBase,
        maximumValue
      })

      // Optional: link measurement to asset for audit trail
      if (body.measurementId && typeof body.asset === 'string' && linkageStore) {
        await linkageStore.database.query(`
          MATCH (m:Measurement {id: $measurementId})
          MATCH (a:Asset {id: $assetId})
          MERGE (m)-[:ASSESSES]->(a)
        `, { measurementId: body.measurementId, assetId: body.asset })
      }

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  return router
}

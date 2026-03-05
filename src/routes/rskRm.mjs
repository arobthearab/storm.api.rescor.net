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
import { ham533, crve3, scep, assetValuation } from '../engines/iap.mjs'
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

/**
 * Resolve a field that may be a pre-computed number or a raw IAP object.
 */
function resolveIapInput (value, iapFunction, validatorFunction) {
  let result = null

  if (typeof value === 'number') {
    result = value
  } else if (value && typeof value === 'object') {
    result = iapFunction(value)
  }

  return result
}

export function createRskRmRoutes () {
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
  router.post('/assess', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const riskFactors = validateRiskFactors(body)
      const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
      const maximumValue = validateNumber(body, 'maximumValue', { defaultValue: 100 })

      // Resolve IAP inputs
      let assetFactor = typeof body.asset === 'number' ? body.asset : null
      let threatFactor = typeof body.threat === 'number' ? body.threat : null
      let vulnerabilityFactor = typeof body.vulnerability === 'number' ? body.vulnerability : null
      let controlFactor = typeof body.control === 'number' ? body.control : null

      if (body.asset && typeof body.asset === 'object') {
        const avResult = assetValuation(body.asset)
        assetFactor = avResult.assetValue
      }

      if (body.threat && typeof body.threat === 'object') {
        const hamResult = ham533(body.threat)
        threatFactor = hamResult.probability
      }

      if (body.vulnerability && typeof body.vulnerability === 'object') {
        const crveResult = crve3(body.vulnerability)
        vulnerabilityFactor = crveResult.exposure
      }

      if (body.control && typeof body.control === 'object') {
        const scepResult = scep(body.control)
        controlFactor = scepResult.efficacy
      }

      const computedResult = assess({
        riskFactors,
        asset: assetFactor ?? 1,
        threat: threatFactor ?? 1,
        vulnerability: vulnerabilityFactor ?? 1,
        control: controlFactor ?? 0,
        scalingBase,
        maximumValue
      })

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  return router
}

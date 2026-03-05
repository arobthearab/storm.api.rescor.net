/**
 * Measurement session lifecycle routes.
 *
 * POST   /v1/measurements
 * GET    /v1/measurements/:measurementId
 * DELETE /v1/measurements/:measurementId
 */

import { Router } from 'express'
import { NotFoundError } from '@rescor/core-utils'
import { validateCreateMeasurement } from '../validators/index.mjs'
import { autoDetectProbability, rskAggregate, rskUpperBound } from '../engines/rsk.mjs'
import { computeEffective } from '../engines/modifiers.mjs'

/**
 * Build a DualMeasurement from a probability value and maximumValue.
 *
 * @param {number} baseProbability      - Base probability (0–1)
 * @param {number} effectiveProbability - Effective probability (0–1)
 * @param {number} maximumValue         - v_max for scaling
 * @returns {object}
 */
function buildDualMeasurement (baseProbability, effectiveProbability, maximumValue) {
  const adjustment = baseProbability - effectiveProbability

  const result = {
    probability: {
      base: baseProbability,
      adjustment,
      effective: effectiveProbability
    },
    scaled: {
      base: Math.ceil(baseProbability * maximumValue),
      adjustment: Math.ceil(adjustment * maximumValue),
      effective: Math.ceil(effectiveProbability * maximumValue)
    }
  }
  return result
}

/**
 * Compute aggregate DualMeasurement for a set of factors.
 *
 * @param {object[]} factors          - Factor objects with value and modifiers
 * @param {number}   scalingBase
 * @param {number}   maximumValue
 * @returns {object}
 */
function computeAggregate (factors, scalingBase, maximumValue) {
  if (factors.length === 0) {
    return buildDualMeasurement(0, 0, maximumValue)
  }

  const baseValues = factors.map(factor => autoDetectProbability(factor.value))
  const effectiveValues = factors.map(factor => {
    const base = autoDetectProbability(factor.value)
    const { effective } = computeEffective(base, factor.modifiers || [], scalingBase)
    return effective
  })

  // For probability mode, use the aggregate scaled to [0,1] via upperBound
  const upperBound = rskUpperBound(1, scalingBase)
  const baseAggregate = Math.min(1, rskAggregate(baseValues, scalingBase) / upperBound)
  const effectiveAggregate = Math.min(1, rskAggregate(effectiveValues, scalingBase) / upperBound)

  const result = buildDualMeasurement(baseAggregate, effectiveAggregate, maximumValue)
  return result
}

/**
 * Enrich a measurement record with computed aggregates and tree.
 *
 * @param {object} measurement - Raw measurement from store
 * @param {object} store       - MeasurementStore instance
 * @returns {object}
 */
function enrichMeasurement (measurement, store) {
  const factors = store.listFactors(measurement.id)
  const { scalingBase, maximumValue } = measurement.configuration

  const aggregate = computeAggregate(factors, scalingBase, maximumValue)
  const tree = store.buildTree(measurement.id)

  // Enrich tree nodes with aggregates
  enrichTreeNodes(tree, store, scalingBase, maximumValue)

  // Enrich factors with DualMeasurement
  const enrichedFactors = factors.map(factor => {
    const base = autoDetectProbability(factor.value)
    const { effective } = computeEffective(base, factor.modifiers || [], scalingBase)
    return {
      ...factor,
      measurement: buildDualMeasurement(base, effective, maximumValue)
    }
  })

  // Attach enriched factors to leaf nodes in the tree
  attachFactorsToTree(tree, enrichedFactors)

  const result = {
    ...measurement,
    aggregate,
    tree,
    factorCount: factors.length
  }
  return result
}

/**
 * Recursively compute aggregates for tree nodes.
 */
function enrichTreeNodes (nodes, store, scalingBase, maximumValue) {
  for (const node of nodes) {
    // Collect all factors under this subtree
    const subtreeFactors = collectSubtreeFactors(node, store)
    node.aggregate = computeAggregate(subtreeFactors, scalingBase, maximumValue)

    if (node.children && node.children.length > 0) {
      enrichTreeNodes(node.children, store, scalingBase, maximumValue)
    }
  }
}

/**
 * Collect all factors in a subtree rooted at a node.
 */
function collectSubtreeFactors (node, store) {
  let factors = [...(node.factors || [])]

  if (node.children) {
    for (const child of node.children) {
      factors = factors.concat(collectSubtreeFactors(child, store))
    }
  }

  return factors
}

/**
 * Attach enriched factor objects to their tree nodes.
 */
function attachFactorsToTree (nodes, enrichedFactors) {
  const factorMap = new Map(enrichedFactors.map(factor => [factor.id, factor]))

  for (const node of nodes) {
    if (node.factors) {
      node.factors = node.factors.map(factor => factorMap.get(factor.id) || factor)
    }
    if (node.children) {
      attachFactorsToTree(node.children, enrichedFactors)
    }
  }
}

/**
 * Create measurement routes.
 *
 * @param {object} options
 * @param {import('../persistence/MeasurementStore.mjs').MeasurementStore} options.store
 * @returns {Router}
 */
export function createMeasurementRoutes ({ store }) {
  const router = Router()

  // POST /v1/measurements
  router.post('/', (request, response, next) => {
    try {
      const validated = validateCreateMeasurement(request.body)
      const measurement = store.createMeasurement(validated)
      const enriched = enrichMeasurement(measurement, store)

      response.status(201).json({ data: enriched })
    } catch (error) {
      next(error)
    }
  })

  // GET /v1/measurements/:measurementId
  router.get('/:measurementId', (request, response, next) => {
    try {
      const measurement = store.getMeasurement(request.params.measurementId)

      if (!measurement) {
        throw new NotFoundError('Measurement not found')
      }

      const enriched = enrichMeasurement(measurement, store)
      response.json({ data: enriched })
    } catch (error) {
      next(error)
    }
  })

  // DELETE /v1/measurements/:measurementId
  router.delete('/:measurementId', (request, response, next) => {
    try {
      const deleted = store.deleteMeasurement(request.params.measurementId)

      if (!deleted) {
        throw new NotFoundError('Measurement not found')
      }

      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  return router
}

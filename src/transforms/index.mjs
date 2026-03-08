/**
 * Transform Registry — maps (domain, model) pairs to transform classes.
 *
 * The registry is the single source of truth for which transforms are
 * available. Routes use it to resolve the correct class from a domain
 * endpoint + model parameter.
 *
 * Usage:
 *   import { resolve, listModels, listDomains } from './index.mjs'
 *   const TransformClass = resolve('threat', 'ham533')
 *   const transform = new TransformClass(input, options)
 *   const result = transform.execute()
 */

import { Ham533Transform } from './Ham533Transform.mjs'
import { Crve3Transform } from './Crve3Transform.mjs'
import { CvssaTransform } from './CvssaTransform.mjs'
import { ScepTransform } from './ScepTransform.mjs'
import { AssetValuationTransform } from './AssetValuationTransform.mjs'

// Re-export all classes
export { Transform } from './Transform.mjs'
export { Ham533Transform } from './Ham533Transform.mjs'
export { Crve3Transform } from './Crve3Transform.mjs'
export { CvssaTransform } from './CvssaTransform.mjs'
export { ScepTransform } from './ScepTransform.mjs'
export { AssetValuationTransform } from './AssetValuationTransform.mjs'

// ---------------------------------------------------------------------------
// Registry — domain → model → TransformClass
// ---------------------------------------------------------------------------

const ALL_TRANSFORMS = [
  Ham533Transform,
  Crve3Transform,
  CvssaTransform,
  ScepTransform,
  AssetValuationTransform
]

const registry = new Map()

for (const TransformClass of ALL_TRANSFORMS) {
  const domain = TransformClass.domain
  const model = TransformClass.model

  if (!registry.has(domain)) {
    registry.set(domain, new Map())
  }
  registry.get(domain).set(model, TransformClass)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a transform class by domain and model.
 *
 * @param {string} domain — 'threat' | 'vulnerability' | 'control' | 'asset'
 * @param {string} model  — e.g. 'ham533', 'crve3', 'cvssa', 'scep', 'asset-valuation'
 * @returns {typeof Transform|null} Transform class, or null if not found
 */
export function resolve (domain, model) {
  let result = null
  const domainMap = registry.get(domain)

  if (domainMap) {
    result = domainMap.get(model) ?? null
  }

  return result
}

/**
 * List all registered models for a given domain.
 *
 * @param {string} domain
 * @returns {string[]}
 */
export function listModels (domain) {
  let result = []
  const domainMap = registry.get(domain)

  if (domainMap) {
    result = [...domainMap.keys()]
  }

  return result
}

/**
 * List all registered domains.
 *
 * @returns {string[]}
 */
export function listDomains () {
  const result = [...registry.keys()]
  return result
}

/**
 * List all registered transforms with their metadata.
 *
 * @returns {object[]}
 */
export function listAll () {
  const result = ALL_TRANSFORMS.map(TransformClass => ({
    domain: TransformClass.domain,
    model: TransformClass.model,
    description: TransformClass.description
  }))
  return result
}

/**
 * Default model for each domain — used when no model is specified.
 */
const DEFAULT_MODELS = {
  threat: 'ham533',
  vulnerability: 'crve3',
  control: 'scep',
  asset: 'asset-valuation'
}

/**
 * Get the default model for a domain.
 *
 * @param {string} domain
 * @returns {string|null}
 */
export function defaultModel (domain) {
  const result = DEFAULT_MODELS[domain] ?? null
  return result
}

/**
 * Framework Registry — maps framework names to framework classes.
 *
 * The registry is the single source of truth for which linkage frameworks
 * are available. Routes use it to resolve the correct framework class
 * from a name parameter.
 *
 * Usage:
 *   import { resolve, list } from './index.mjs'
 *   const FrameworkClass = resolve('nist-800-30')
 *   const framework = new FrameworkClass()
 *   const catalog = framework.describe()
 */

import { Nist80030Framework } from './Nist80030Framework.mjs'

// Re-export all classes
export { LinkageFramework, CATALOG_RELATIONSHIPS, INSTANCE_RELATIONSHIPS, LINKAGE_VALIDATION_MAP } from './LinkageFramework.mjs'
export { Nist80030Framework } from './Nist80030Framework.mjs'

// ---------------------------------------------------------------------------
// Registry — name → FrameworkClass
// ---------------------------------------------------------------------------

const ALL_FRAMEWORKS = [
  Nist80030Framework
]

const registry = new Map()

for (const FrameworkClass of ALL_FRAMEWORKS) {
  registry.set(FrameworkClass.name, FrameworkClass)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a framework class by name.
 *
 * @param {string} name — e.g. 'nist-800-30'
 * @returns {typeof LinkageFramework|null} Framework class, or null if not found
 */
export function resolve (name) {
  const result = registry.get(name) ?? null
  return result
}

/**
 * List all registered frameworks with metadata.
 *
 * @returns {{ name: string, version: string, description: string }[]}
 */
export function list () {
  const result = ALL_FRAMEWORKS.map(FrameworkClass => ({
    name: FrameworkClass.name,
    version: FrameworkClass.version,
    description: FrameworkClass.description
  }))
  return result
}

/**
 * Return the default framework name.
 * Currently NIST 800-30 is the only and default framework.
 *
 * @returns {string}
 */
export function defaultFramework () {
  const result = 'nist-800-30'
  return result
}

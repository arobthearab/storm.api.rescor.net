/**
 * LinkageFramework — Abstract base class for ATV(1-C) linkage frameworks.
 *
 * Defines the catalog taxonomy (asset types, threat classes, vulnerability
 * classes, control families) and the linkage rules that connect them.
 * Concrete subclasses represent specific frameworks (e.g. NIST 800-30).
 *
 * Subclasses MUST override:
 *   static get name ()        — machine name, e.g. 'nist-800-30'
 *   static get version ()     — semver string
 *   static get description () — human-readable
 *   assetTypes ()             — returns asset type definitions
 *   threatClasses ()          — returns threat class definitions
 *   vulnerabilityClasses ()   — returns vulnerability class definitions
 *   controlFamilies ()        — returns control family definitions
 *   linkageRules ()           — returns the linkage rule matrix
 */

/**
 * Relationship types allowed in the linkage catalog.
 */
export const CATALOG_RELATIONSHIPS = Object.freeze({
  TARGETS: 'TARGETS',
  EXPLOITED_BY: 'EXPLOITED_BY',
  AFFECTS: 'AFFECTS',
  MITIGATES: 'MITIGATES',
  PROTECTS: 'PROTECTS',
  COUNTERS: 'COUNTERS'
})

/**
 * Instance relationship types for user-created entity linkages.
 */
export const INSTANCE_RELATIONSHIPS = Object.freeze({
  EXPOSED_TO: 'EXPOSED_TO',
  SUSCEPTIBLE_TO: 'SUSCEPTIBLE_TO',
  EXPLOITED_VIA: 'EXPLOITED_VIA',
  APPLIED_TO: 'APPLIED_TO',
  GUARDS: 'GUARDS'
})

/**
 * Maps instance relationship → required catalog relationship for validation.
 * Each entry: { fromType, toType, catalogRelationship, catalogFrom, catalogTo }
 */
export const LINKAGE_VALIDATION_MAP = Object.freeze([
  {
    instanceRelationship: 'EXPOSED_TO',
    fromType: 'asset',
    toType: 'threat',
    catalogRelationship: 'TARGETS',
    catalogFrom: 'threatClass',
    catalogTo: 'assetType'
  },
  {
    instanceRelationship: 'SUSCEPTIBLE_TO',
    fromType: 'asset',
    toType: 'vulnerability',
    catalogRelationship: 'AFFECTS',
    catalogFrom: 'vulnerabilityClass',
    catalogTo: 'assetType'
  },
  {
    instanceRelationship: 'EXPLOITED_VIA',
    fromType: 'vulnerability',
    toType: 'threat',
    catalogRelationship: 'EXPLOITED_BY',
    catalogFrom: 'vulnerabilityClass',
    catalogTo: 'threatClass'
  },
  {
    instanceRelationship: 'APPLIED_TO',
    fromType: 'control',
    toType: 'vulnerability',
    catalogRelationship: 'MITIGATES',
    catalogFrom: 'controlFamily',
    catalogTo: 'vulnerabilityClass'
  },
  {
    instanceRelationship: 'GUARDS',
    fromType: 'control',
    toType: 'asset',
    catalogRelationship: 'PROTECTS',
    catalogFrom: 'controlFamily',
    catalogTo: 'assetType'
  }
])

export class LinkageFramework {
  // -----------------------------------------------------------------------
  // Identity — subclasses MUST override
  // -----------------------------------------------------------------------

  /** Machine name of this framework (e.g. 'nist-800-30'). */
  static get name () {
    throw new Error('LinkageFramework.name must be overridden')
  }

  /** Semantic version string. */
  static get version () {
    throw new Error('LinkageFramework.version must be overridden')
  }

  /** Human-readable description. */
  static get description () {
    throw new Error('LinkageFramework.description must be overridden')
  }

  // -----------------------------------------------------------------------
  // Catalog definitions — subclasses MUST override
  // -----------------------------------------------------------------------

  /**
   * Return asset type definitions.
   *
   * Each entry:
   * ```
   * { id, name, description, iapDefaults? }
   * ```
   * @returns {object[]}
   */
  assetTypes () {
    return []
  }

  /**
   * Return threat class definitions.
   *
   * Each entry:
   * ```
   * { id, name, source, description, iapDefaults? }
   * ```
   * @returns {object[]}
   */
  threatClasses () {
    return []
  }

  /**
   * Return vulnerability class definitions.
   *
   * Each entry:
   * ```
   * { id, name, description, iapDefaults? }
   * ```
   * @returns {object[]}
   */
  vulnerabilityClasses () {
    return []
  }

  /**
   * Return control family definitions.
   *
   * Each entry:
   * ```
   * { id, name, identifier, description, iapDefaults? }
   * ```
   * @returns {object[]}
   */
  controlFamilies () {
    return []
  }

  /**
   * Return the linkage rules matrix.
   *
   * Each relationship type maps to an array of { from, to } pairs
   * where from/to are catalog entry IDs.
   *
   * @returns {{ targets: object[], exploitedBy: object[], affects: object[], mitigates: object[], protects: object[], counters: object[] }}
   */
  linkageRules () {
    const result = {
      targets: [],
      exploitedBy: [],
      affects: [],
      mitigates: [],
      protects: [],
      counters: []
    }
    return result
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Check whether a catalog linkage rule exists between two type IDs.
   *
   * @param {string} relationship — CATALOG_RELATIONSHIPS key
   * @param {string} fromId — source catalog entry ID
   * @param {string} toId — target catalog entry ID
   * @returns {boolean}
   */
  validateLinkage (relationship, fromId, toId) {
    const rules = this.linkageRules()
    const ruleKey = _catalogRelationshipToRuleKey(relationship)
    const entries = rules[ruleKey] ?? []
    const result = entries.some(entry => entry.from === fromId && entry.to === toId)
    return result
  }

  // -----------------------------------------------------------------------
  // Descriptor
  // -----------------------------------------------------------------------

  /**
   * Return a full descriptor of this framework for discovery/introspection.
   *
   * @returns {object}
   */
  describe () {
    const result = {
      name: this.constructor.name,
      version: this.constructor.version,
      description: this.constructor.description,
      assetTypes: this.assetTypes(),
      threatClasses: this.threatClasses(),
      vulnerabilityClasses: this.vulnerabilityClasses(),
      controlFamilies: this.controlFamilies(),
      linkageRules: this.linkageRules()
    }
    return result
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Map a CATALOG_RELATIONSHIPS constant to the linkageRules() key.
 */
function _catalogRelationshipToRuleKey (relationship) {
  const mapping = {
    TARGETS: 'targets',
    EXPLOITED_BY: 'exploitedBy',
    AFFECTS: 'affects',
    MITIGATES: 'mitigates',
    PROTECTS: 'protects',
    COUNTERS: 'counters'
  }
  const result = mapping[relationship] ?? null
  return result
}

/**
 * Framework tests — registry, catalog completeness, linkage validation.
 */

import { describe, it, expect } from 'vitest'
import {
  resolve,
  list,
  defaultFramework,
  LinkageFramework,
  CATALOG_RELATIONSHIPS,
  INSTANCE_RELATIONSHIPS,
  LINKAGE_VALIDATION_MAP,
  Nist80030Framework
} from '../../src/frameworks/index.mjs'

// ═══════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════

describe('framework registry', () => {
  it('should resolve nist-800-30 by name', () => {
    const FrameworkClass = resolve('nist-800-30')
    expect(FrameworkClass).toBe(Nist80030Framework)
  })

  it('should return null for unknown framework', () => {
    const result = resolve('unknown-framework')
    expect(result).toBeNull()
  })

  it('should list all frameworks', () => {
    const frameworks = list()
    expect(frameworks.length).toBeGreaterThanOrEqual(1)
    expect(frameworks[0]).toHaveProperty('name', 'nist-800-30')
    expect(frameworks[0]).toHaveProperty('version', '1.0.0')
    expect(frameworks[0]).toHaveProperty('description')
  })

  it('should provide a default framework', () => {
    const name = defaultFramework()
    expect(name).toBe('nist-800-30')
    expect(resolve(name)).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════
// Base class enforcement
// ═══════════════════════════════════════════════════════════════════

describe('LinkageFramework base class', () => {
  it('should throw on unoverridden static getters', () => {
    expect(() => LinkageFramework.name).toThrow()
    expect(() => LinkageFramework.version).toThrow()
    expect(() => LinkageFramework.description).toThrow()
  })

  it('should export catalog relationship constants', () => {
    expect(CATALOG_RELATIONSHIPS.TARGETS).toBe('TARGETS')
    expect(CATALOG_RELATIONSHIPS.EXPLOITED_BY).toBe('EXPLOITED_BY')
    expect(CATALOG_RELATIONSHIPS.AFFECTS).toBe('AFFECTS')
    expect(CATALOG_RELATIONSHIPS.MITIGATES).toBe('MITIGATES')
    expect(CATALOG_RELATIONSHIPS.PROTECTS).toBe('PROTECTS')
    expect(CATALOG_RELATIONSHIPS.COUNTERS).toBe('COUNTERS')
  })

  it('should export instance relationship constants', () => {
    expect(INSTANCE_RELATIONSHIPS.EXPOSED_TO).toBe('EXPOSED_TO')
    expect(INSTANCE_RELATIONSHIPS.SUSCEPTIBLE_TO).toBe('SUSCEPTIBLE_TO')
    expect(INSTANCE_RELATIONSHIPS.EXPLOITED_VIA).toBe('EXPLOITED_VIA')
    expect(INSTANCE_RELATIONSHIPS.APPLIED_TO).toBe('APPLIED_TO')
    expect(INSTANCE_RELATIONSHIPS.GUARDS).toBe('GUARDS')
  })

  it('should export linkage validation map', () => {
    expect(LINKAGE_VALIDATION_MAP.length).toBe(5)
    const exposedTo = LINKAGE_VALIDATION_MAP.find(entry => entry.instanceRelationship === 'EXPOSED_TO')
    expect(exposedTo.fromType).toBe('asset')
    expect(exposedTo.toType).toBe('threat')
    expect(exposedTo.catalogRelationship).toBe('TARGETS')
  })
})

// ═══════════════════════════════════════════════════════════════════
// NIST 800-30 Catalog Completeness
// ═══════════════════════════════════════════════════════════════════

describe('Nist80030Framework catalog', () => {
  const framework = new Nist80030Framework()

  it('should define 8 asset types', () => {
    const types = framework.assetTypes()
    expect(types.length).toBe(8)

    const ids = types.map(t => t.id)
    expect(ids).toContain('at-info-system')
    expect(ids).toContain('at-data-store')
    expect(ids).toContain('at-hardware')
    expect(ids).toContain('at-software')
    expect(ids).toContain('at-network')
    expect(ids).toContain('at-service')
    expect(ids).toContain('at-personnel')
    expect(ids).toContain('at-facility')
  })

  it('should define 6 threat classes', () => {
    const classes = framework.threatClasses()
    expect(classes.length).toBe(6)

    const ids = classes.map(c => c.id)
    expect(ids).toContain('tc-adversarial-outsider')
    expect(ids).toContain('tc-adversarial-insider')
    expect(ids).toContain('tc-adversarial-partner')
    expect(ids).toContain('tc-accidental')
    expect(ids).toContain('tc-structural')
    expect(ids).toContain('tc-environmental')
  })

  it('should define 8 vulnerability classes', () => {
    const classes = framework.vulnerabilityClasses()
    expect(classes.length).toBe(8)

    const ids = classes.map(c => c.id)
    expect(ids).toContain('vc-configuration')
    expect(ids).toContain('vc-authentication')
    expect(ids).toContain('vc-access-control')
    expect(ids).toContain('vc-encryption')
    expect(ids).toContain('vc-patch-management')
    expect(ids).toContain('vc-input-validation')
    expect(ids).toContain('vc-logging')
    expect(ids).toContain('vc-physical')
  })

  it('should define 20 control families', () => {
    const families = framework.controlFamilies()
    expect(families.length).toBe(20)

    const identifiers = families.map(f => f.identifier)
    expect(identifiers).toContain('AC')
    expect(identifiers).toContain('AU')
    expect(identifiers).toContain('CM')
    expect(identifiers).toContain('IA')
    expect(identifiers).toContain('IR')
    expect(identifiers).toContain('PE')
    expect(identifiers).toContain('SC')
    expect(identifiers).toContain('SI')
    expect(identifiers).toContain('SR')
  })

  it('should include iapDefaults on all catalog entries', () => {
    const allEntries = [
      ...framework.assetTypes(),
      ...framework.threatClasses(),
      ...framework.vulnerabilityClasses(),
      ...framework.controlFamilies()
    ]

    for (const entry of allEntries) {
      expect(entry.iapDefaults, `${entry.id} missing iapDefaults`).toBeDefined()
      expect(entry.iapDefaults.model, `${entry.id} missing iapDefaults.model`).toBeDefined()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// Linkage Rules
// ═══════════════════════════════════════════════════════════════════

describe('Nist80030Framework linkage rules', () => {
  const framework = new Nist80030Framework()
  const rules = framework.linkageRules()

  it('should have all six rule types', () => {
    expect(rules).toHaveProperty('targets')
    expect(rules).toHaveProperty('exploitedBy')
    expect(rules).toHaveProperty('affects')
    expect(rules).toHaveProperty('mitigates')
    expect(rules).toHaveProperty('protects')
    expect(rules).toHaveProperty('counters')
  })

  it('should have non-empty rule arrays', () => {
    expect(rules.targets.length).toBeGreaterThan(0)
    expect(rules.exploitedBy.length).toBeGreaterThan(0)
    expect(rules.affects.length).toBeGreaterThan(0)
    expect(rules.mitigates.length).toBeGreaterThan(0)
    expect(rules.protects.length).toBeGreaterThan(0)
    expect(rules.counters.length).toBeGreaterThan(0)
  })

  it('should reference valid catalog IDs in targets rules', () => {
    const threatIds = new Set(framework.threatClasses().map(c => c.id))
    const assetIds = new Set(framework.assetTypes().map(t => t.id))

    for (const rule of rules.targets) {
      expect(threatIds.has(rule.from), `Unknown threat class: ${rule.from}`).toBe(true)
      expect(assetIds.has(rule.to), `Unknown asset type: ${rule.to}`).toBe(true)
    }
  })

  it('should reference valid catalog IDs in exploitedBy rules', () => {
    const vulnIds = new Set(framework.vulnerabilityClasses().map(c => c.id))
    const threatIds = new Set(framework.threatClasses().map(c => c.id))

    for (const rule of rules.exploitedBy) {
      expect(vulnIds.has(rule.from), `Unknown vuln class: ${rule.from}`).toBe(true)
      expect(threatIds.has(rule.to), `Unknown threat class: ${rule.to}`).toBe(true)
    }
  })

  it('should reference valid catalog IDs in affects rules', () => {
    const vulnIds = new Set(framework.vulnerabilityClasses().map(c => c.id))
    const assetIds = new Set(framework.assetTypes().map(t => t.id))

    for (const rule of rules.affects) {
      expect(vulnIds.has(rule.from), `Unknown vuln class: ${rule.from}`).toBe(true)
      expect(assetIds.has(rule.to), `Unknown asset type: ${rule.to}`).toBe(true)
    }
  })

  it('should reference valid catalog IDs in mitigates rules', () => {
    const controlIds = new Set(framework.controlFamilies().map(f => f.id))
    const vulnIds = new Set(framework.vulnerabilityClasses().map(c => c.id))

    for (const rule of rules.mitigates) {
      expect(controlIds.has(rule.from), `Unknown control family: ${rule.from}`).toBe(true)
      expect(vulnIds.has(rule.to), `Unknown vuln class: ${rule.to}`).toBe(true)
    }
  })

  it('should reference valid catalog IDs in protects rules', () => {
    const controlIds = new Set(framework.controlFamilies().map(f => f.id))
    const assetIds = new Set(framework.assetTypes().map(t => t.id))

    for (const rule of rules.protects) {
      expect(controlIds.has(rule.from), `Unknown control family: ${rule.from}`).toBe(true)
      expect(assetIds.has(rule.to), `Unknown asset type: ${rule.to}`).toBe(true)
    }
  })

  it('should reference valid catalog IDs in counters rules', () => {
    const controlIds = new Set(framework.controlFamilies().map(f => f.id))
    const threatIds = new Set(framework.threatClasses().map(c => c.id))

    for (const rule of rules.counters) {
      expect(controlIds.has(rule.from), `Unknown control family: ${rule.from}`).toBe(true)
      expect(threatIds.has(rule.to), `Unknown threat class: ${rule.to}`).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// Linkage Validation
// ═══════════════════════════════════════════════════════════════════

describe('Nist80030Framework validateLinkage', () => {
  const framework = new Nist80030Framework()

  it('should validate a known TARGETS linkage', () => {
    const valid = framework.validateLinkage('TARGETS', 'tc-adversarial-outsider', 'at-info-system')
    expect(valid).toBe(true)
  })

  it('should reject an invalid TARGETS linkage', () => {
    const valid = framework.validateLinkage('TARGETS', 'tc-adversarial-outsider', 'at-facility')
    expect(valid).toBe(false)
  })

  it('should validate a known MITIGATES linkage', () => {
    const valid = framework.validateLinkage('MITIGATES', 'cf-ac', 'vc-access-control')
    expect(valid).toBe(true)
  })

  it('should reject an invalid MITIGATES linkage', () => {
    const valid = framework.validateLinkage('MITIGATES', 'cf-ac', 'vc-physical')
    expect(valid).toBe(false)
  })

  it('should validate dual-binding PROTECTS linkage', () => {
    const valid = framework.validateLinkage('PROTECTS', 'cf-pe', 'at-facility')
    expect(valid).toBe(true)
  })

  it('should validate COUNTERS linkage', () => {
    const valid = framework.validateLinkage('COUNTERS', 'cf-at', 'tc-accidental')
    expect(valid).toBe(true)
  })

  it('should return false for unknown relationship type', () => {
    const valid = framework.validateLinkage('UNKNOWN_REL', 'cf-ac', 'vc-access-control')
    expect(valid).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Describe
// ═══════════════════════════════════════════════════════════════════

describe('Nist80030Framework describe', () => {
  const framework = new Nist80030Framework()
  const descriptor = framework.describe()

  it('should include identity fields', () => {
    expect(descriptor.name).toBe('nist-800-30')
    expect(descriptor.version).toBe('1.0.0')
    expect(descriptor.description).toContain('800-30')
  })

  it('should include all catalog arrays', () => {
    expect(descriptor.assetTypes.length).toBe(8)
    expect(descriptor.threatClasses.length).toBe(6)
    expect(descriptor.vulnerabilityClasses.length).toBe(8)
    expect(descriptor.controlFamilies.length).toBe(20)
  })

  it('should include linkage rules', () => {
    expect(descriptor.linkageRules.targets.length).toBeGreaterThan(0)
    expect(descriptor.linkageRules.mitigates.length).toBeGreaterThan(0)
  })
})

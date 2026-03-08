/**
 * NIST 800-30 Rev 1 Linkage Framework
 *
 * Provides the canonical taxonomy for the NIST Special Publication 800-30
 * "Guide for Conducting Risk Assessments" risk assessment methodology.
 *
 * Asset types, threat sources/classes, vulnerability classes, and control
 * families are drawn from NIST 800-30 and NIST 800-53 Rev 5.
 *
 * iapDefaults: optional default IAP transform inputs for each catalog entry.
 * When a user creates an entity from a catalog type, these defaults can
 * pre-populate the corresponding transform factors.
 */

import { LinkageFramework } from './LinkageFramework.mjs'

export class Nist80030Framework extends LinkageFramework {
  static get name () { return 'nist-800-30' }
  static get version () { return '1.0.0' }
  static get description () { return 'NIST SP 800-30 Rev 1 — Guide for Conducting Risk Assessments' }

  // -----------------------------------------------------------------------
  // Asset Types (NIST 800-30 Table D-1, generalised)
  // -----------------------------------------------------------------------

  assetTypes () {
    const result = [
      {
        id: 'at-info-system',
        name: 'Information System',
        description: 'Complete information system (hardware, software, data, operations)',
        iapDefaults: { model: 'asset-valuation', classification: 3, users: 5, highValueData: [true, true, true, false, false, false] }
      },
      {
        id: 'at-data-store',
        name: 'Data Store',
        description: 'Database, file share, data warehouse, or data lake',
        iapDefaults: { model: 'asset-valuation', classification: 3, users: 4, highValueData: [true, true, false, false, false, false] }
      },
      {
        id: 'at-hardware',
        name: 'Hardware',
        description: 'Physical computing device (server, workstation, network appliance)',
        iapDefaults: { model: 'asset-valuation', classification: 2, users: 3, highValueData: [false, false, false, false, false, false] }
      },
      {
        id: 'at-software',
        name: 'Software Application',
        description: 'Custom or commercial software application',
        iapDefaults: { model: 'asset-valuation', classification: 2, users: 4, highValueData: [true, false, false, false, false, false] }
      },
      {
        id: 'at-network',
        name: 'Network Infrastructure',
        description: 'Network segment, communication link, or transmission medium',
        iapDefaults: { model: 'asset-valuation', classification: 2, users: 5, highValueData: [false, true, false, false, false, false] }
      },
      {
        id: 'at-service',
        name: 'Service',
        description: 'IT or business service (email, authentication, cloud)',
        iapDefaults: { model: 'asset-valuation', classification: 2, users: 4, highValueData: [true, false, false, false, false, false] }
      },
      {
        id: 'at-personnel',
        name: 'Personnel',
        description: 'Staff, contractors, or third-party personnel with access',
        iapDefaults: { model: 'asset-valuation', classification: 1, users: 3, highValueData: [false, false, false, false, false, false] }
      },
      {
        id: 'at-facility',
        name: 'Facility',
        description: 'Physical location — data centre, office, or secure area',
        iapDefaults: { model: 'asset-valuation', classification: 2, users: 3, highValueData: [false, false, true, false, false, false] }
      }
    ]
    return result
  }

  // -----------------------------------------------------------------------
  // Threat Sources / Classes (NIST 800-30 Table D-2)
  // -----------------------------------------------------------------------

  threatClasses () {
    const result = [
      {
        id: 'tc-adversarial-outsider',
        name: 'Adversarial — Outsider',
        source: 'adversarial',
        description: 'External hostile actor (cybercriminal, hacktivist, nation-state)',
        iapDefaults: { model: 'ham533', history: 3, access: 1, means: 2 }
      },
      {
        id: 'tc-adversarial-insider',
        name: 'Adversarial — Insider',
        source: 'adversarial',
        description: 'Malicious insider with authorised access',
        iapDefaults: { model: 'ham533', history: 2, access: 3, means: 1 }
      },
      {
        id: 'tc-adversarial-partner',
        name: 'Adversarial — Trusted Partner',
        source: 'adversarial',
        description: 'Hostile actor within a trusted business relationship (supply chain)',
        iapDefaults: { model: 'ham533', history: 2, access: 2, means: 2 }
      },
      {
        id: 'tc-accidental',
        name: 'Accidental',
        source: 'accidental',
        description: 'Unintentional actions by authorised users (misconfiguration, human error)',
        iapDefaults: { model: 'ham533', history: 4, access: 2, means: 1 }
      },
      {
        id: 'tc-structural',
        name: 'Structural',
        source: 'structural',
        description: 'Failures of technology, equipment, or environmental controls',
        iapDefaults: { model: 'ham533', history: 3, access: 2, means: 1 }
      },
      {
        id: 'tc-environmental',
        name: 'Environmental',
        source: 'environmental',
        description: 'Natural or man-made disaster (fire, flood, power outage)',
        iapDefaults: { model: 'ham533', history: 2, access: 1, means: 3 }
      }
    ]
    return result
  }

  // -----------------------------------------------------------------------
  // Vulnerability Classes (synthesised from NIST 800-30 + CWE top-level)
  // -----------------------------------------------------------------------

  vulnerabilityClasses () {
    const result = [
      {
        id: 'vc-configuration',
        name: 'Configuration Management',
        description: 'Misconfiguration, insecure defaults, or unpatched settings',
        iapDefaults: { model: 'crve3', capabilities: 2, resources: 2, visibility: 2, confidentiality: 2, integrity: 2, availability: 1 }
      },
      {
        id: 'vc-authentication',
        name: 'Authentication',
        description: 'Weak, missing, or bypassable authentication mechanisms',
        iapDefaults: { model: 'crve3', capabilities: 2, resources: 2, visibility: 2, confidentiality: 3, integrity: 2, availability: 1 }
      },
      {
        id: 'vc-access-control',
        name: 'Access Control',
        description: 'Broken access control, privilege escalation, or missing authorisation',
        iapDefaults: { model: 'crve3', capabilities: 2, resources: 2, visibility: 2, confidentiality: 3, integrity: 3, availability: 1 }
      },
      {
        id: 'vc-encryption',
        name: 'Cryptographic Protection',
        description: 'Weak or missing encryption, poor key management',
        iapDefaults: { model: 'crve3', capabilities: 3, resources: 2, visibility: 1, confidentiality: 3, integrity: 2, availability: 1 }
      },
      {
        id: 'vc-patch-management',
        name: 'Patch Management',
        description: 'Missing patches, outdated software, or end-of-life components',
        iapDefaults: { model: 'crve3', capabilities: 1, resources: 1, visibility: 3, confidentiality: 2, integrity: 2, availability: 2 }
      },
      {
        id: 'vc-input-validation',
        name: 'Input Validation',
        description: 'Injection flaws (SQL, XSS, command), improper input handling',
        iapDefaults: { model: 'crve3', capabilities: 2, resources: 1, visibility: 2, confidentiality: 3, integrity: 3, availability: 2 }
      },
      {
        id: 'vc-logging',
        name: 'Logging and Monitoring',
        description: 'Insufficient logging, missing alerts, or inadequate audit trails',
        iapDefaults: { model: 'crve3', capabilities: 1, resources: 1, visibility: 1, confidentiality: 1, integrity: 1, availability: 1 }
      },
      {
        id: 'vc-physical',
        name: 'Physical Security',
        description: 'Weak physical access controls, environmental hazards',
        iapDefaults: { model: 'crve3', capabilities: 2, resources: 2, visibility: 2, confidentiality: 2, integrity: 1, availability: 3 }
      }
    ]
    return result
  }

  // -----------------------------------------------------------------------
  // Control Families (NIST 800-53 Rev 5 — 20 families)
  // -----------------------------------------------------------------------

  controlFamilies () {
    const result = [
      { id: 'cf-ac', name: 'Access Control', identifier: 'AC', description: 'Restrict system access to authorised users and transactions', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-at', name: 'Awareness and Training', identifier: 'AT', description: 'Security awareness training for personnel', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-au', name: 'Audit and Accountability', identifier: 'AU', description: 'Audit record creation, protection, and review', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ca', name: 'Assessment and Authorisation', identifier: 'CA', description: 'Security control assessment and system authorisation', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-cm', name: 'Configuration Management', identifier: 'CM', description: 'Baseline configurations and change control', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-cp', name: 'Contingency Planning', identifier: 'CP', description: 'Emergency response, backup, and recovery', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ia', name: 'Identification and Authentication', identifier: 'IA', description: 'Identify and authenticate users, devices, and services', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ir', name: 'Incident Response', identifier: 'IR', description: 'Incident handling, monitoring, and reporting', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ma', name: 'Maintenance', identifier: 'MA', description: 'System maintenance procedures and tools', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-mp', name: 'Media Protection', identifier: 'MP', description: 'Media access, marking, storage, transport, and sanitisation', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-pe', name: 'Physical and Environmental Protection', identifier: 'PE', description: 'Physical access, monitoring, and environmental controls', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-pl', name: 'Planning', identifier: 'PL', description: 'Security planning and system security plan', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-pm', name: 'Program Management', identifier: 'PM', description: 'Organisation-wide information security program', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ps', name: 'Personnel Security', identifier: 'PS', description: 'Personnel screening, access agreements, and termination', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-pt', name: 'Personally Identifiable Information', identifier: 'PT', description: 'PII processing, consent, and data quality', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-ra', name: 'Risk Assessment', identifier: 'RA', description: 'Risk assessment policy, vulnerability disclosure', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-sa', name: 'System and Services Acquisition', identifier: 'SA', description: 'Supply chain risk management, system development', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-sc', name: 'System and Communications Protection', identifier: 'SC', description: 'Boundary protection, cryptographic mechanisms', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-si', name: 'System and Information Integrity', identifier: 'SI', description: 'Flaw remediation, malicious code protection, monitoring', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } },
      { id: 'cf-sr', name: 'Supply Chain Risk Management', identifier: 'SR', description: 'Supply chain controls, provenance, component authenticity', iapDefaults: { model: 'scep', controls: [{ implemented: 0.5, correction: 0.5 }] } }
    ]
    return result
  }

  // -----------------------------------------------------------------------
  // Linkage Rules Matrix
  // -----------------------------------------------------------------------

  linkageRules () {
    const result = {
      // ThreatClass → targets → AssetType
      targets: [
        // Adversarial outsider targets all technology assets
        { from: 'tc-adversarial-outsider', to: 'at-info-system' },
        { from: 'tc-adversarial-outsider', to: 'at-data-store' },
        { from: 'tc-adversarial-outsider', to: 'at-software' },
        { from: 'tc-adversarial-outsider', to: 'at-network' },
        { from: 'tc-adversarial-outsider', to: 'at-service' },
        // Adversarial insider targets everything
        { from: 'tc-adversarial-insider', to: 'at-info-system' },
        { from: 'tc-adversarial-insider', to: 'at-data-store' },
        { from: 'tc-adversarial-insider', to: 'at-hardware' },
        { from: 'tc-adversarial-insider', to: 'at-software' },
        { from: 'tc-adversarial-insider', to: 'at-network' },
        { from: 'tc-adversarial-insider', to: 'at-service' },
        { from: 'tc-adversarial-insider', to: 'at-personnel' },
        { from: 'tc-adversarial-insider', to: 'at-facility' },
        // Trusted partner targets systems, data, software, services
        { from: 'tc-adversarial-partner', to: 'at-info-system' },
        { from: 'tc-adversarial-partner', to: 'at-data-store' },
        { from: 'tc-adversarial-partner', to: 'at-software' },
        { from: 'tc-adversarial-partner', to: 'at-service' },
        // Accidental targets all except facility
        { from: 'tc-accidental', to: 'at-info-system' },
        { from: 'tc-accidental', to: 'at-data-store' },
        { from: 'tc-accidental', to: 'at-hardware' },
        { from: 'tc-accidental', to: 'at-software' },
        { from: 'tc-accidental', to: 'at-network' },
        { from: 'tc-accidental', to: 'at-service' },
        { from: 'tc-accidental', to: 'at-personnel' },
        // Structural targets hardware, network, facility
        { from: 'tc-structural', to: 'at-hardware' },
        { from: 'tc-structural', to: 'at-network' },
        { from: 'tc-structural', to: 'at-facility' },
        { from: 'tc-structural', to: 'at-info-system' },
        // Environmental targets physical assets
        { from: 'tc-environmental', to: 'at-hardware' },
        { from: 'tc-environmental', to: 'at-network' },
        { from: 'tc-environmental', to: 'at-facility' }
      ],

      // VulnerabilityClass → exploitedBy → ThreatClass
      exploitedBy: [
        // Configuration vulnerabilities exploited by adversarial + accidental
        { from: 'vc-configuration', to: 'tc-adversarial-outsider' },
        { from: 'vc-configuration', to: 'tc-adversarial-insider' },
        { from: 'vc-configuration', to: 'tc-accidental' },
        // Authentication exploited by adversarial actors
        { from: 'vc-authentication', to: 'tc-adversarial-outsider' },
        { from: 'vc-authentication', to: 'tc-adversarial-insider' },
        { from: 'vc-authentication', to: 'tc-adversarial-partner' },
        // Access control exploited by adversarial + accidental
        { from: 'vc-access-control', to: 'tc-adversarial-outsider' },
        { from: 'vc-access-control', to: 'tc-adversarial-insider' },
        { from: 'vc-access-control', to: 'tc-accidental' },
        // Encryption exploited by adversarial
        { from: 'vc-encryption', to: 'tc-adversarial-outsider' },
        { from: 'vc-encryption', to: 'tc-adversarial-insider' },
        { from: 'vc-encryption', to: 'tc-adversarial-partner' },
        // Patch management exploited by adversarial + structural
        { from: 'vc-patch-management', to: 'tc-adversarial-outsider' },
        { from: 'vc-patch-management', to: 'tc-adversarial-insider' },
        { from: 'vc-patch-management', to: 'tc-structural' },
        // Input validation exploited by adversarial
        { from: 'vc-input-validation', to: 'tc-adversarial-outsider' },
        { from: 'vc-input-validation', to: 'tc-adversarial-insider' },
        // Logging exploited by adversarial (to hide tracks)
        { from: 'vc-logging', to: 'tc-adversarial-outsider' },
        { from: 'vc-logging', to: 'tc-adversarial-insider' },
        // Physical exploited by adversarial, structural, environmental
        { from: 'vc-physical', to: 'tc-adversarial-outsider' },
        { from: 'vc-physical', to: 'tc-adversarial-insider' },
        { from: 'vc-physical', to: 'tc-structural' },
        { from: 'vc-physical', to: 'tc-environmental' }
      ],

      // VulnerabilityClass → affects → AssetType
      affects: [
        // Configuration affects technology assets
        { from: 'vc-configuration', to: 'at-info-system' },
        { from: 'vc-configuration', to: 'at-hardware' },
        { from: 'vc-configuration', to: 'at-software' },
        { from: 'vc-configuration', to: 'at-network' },
        { from: 'vc-configuration', to: 'at-service' },
        // Authentication affects systems, software, services
        { from: 'vc-authentication', to: 'at-info-system' },
        { from: 'vc-authentication', to: 'at-software' },
        { from: 'vc-authentication', to: 'at-service' },
        // Access control affects all digital assets
        { from: 'vc-access-control', to: 'at-info-system' },
        { from: 'vc-access-control', to: 'at-data-store' },
        { from: 'vc-access-control', to: 'at-software' },
        { from: 'vc-access-control', to: 'at-service' },
        // Encryption affects data, systems, network
        { from: 'vc-encryption', to: 'at-info-system' },
        { from: 'vc-encryption', to: 'at-data-store' },
        { from: 'vc-encryption', to: 'at-network' },
        // Patch management affects hardware, software, systems
        { from: 'vc-patch-management', to: 'at-info-system' },
        { from: 'vc-patch-management', to: 'at-hardware' },
        { from: 'vc-patch-management', to: 'at-software' },
        // Input validation affects software, services
        { from: 'vc-input-validation', to: 'at-software' },
        { from: 'vc-input-validation', to: 'at-service' },
        // Logging affects systems, services
        { from: 'vc-logging', to: 'at-info-system' },
        { from: 'vc-logging', to: 'at-service' },
        // Physical affects hardware, facility, network
        { from: 'vc-physical', to: 'at-hardware' },
        { from: 'vc-physical', to: 'at-facility' },
        { from: 'vc-physical', to: 'at-network' }
      ],

      // ControlFamily → mitigates → VulnerabilityClass
      mitigates: [
        // AC mitigates access control + authentication
        { from: 'cf-ac', to: 'vc-access-control' },
        { from: 'cf-ac', to: 'vc-authentication' },
        // AT mitigates accidental errors (configuration, access control)
        { from: 'cf-at', to: 'vc-configuration' },
        { from: 'cf-at', to: 'vc-access-control' },
        // AU mitigates logging
        { from: 'cf-au', to: 'vc-logging' },
        // CA mitigates overall configuration
        { from: 'cf-ca', to: 'vc-configuration' },
        // CM mitigates configuration + patch management
        { from: 'cf-cm', to: 'vc-configuration' },
        { from: 'cf-cm', to: 'vc-patch-management' },
        // CP mitigates physical + structural gaps
        { from: 'cf-cp', to: 'vc-physical' },
        // IA mitigates authentication
        { from: 'cf-ia', to: 'vc-authentication' },
        // IR mitigates logging (incident detection)
        { from: 'cf-ir', to: 'vc-logging' },
        // MA mitigates configuration + patch management
        { from: 'cf-ma', to: 'vc-configuration' },
        { from: 'cf-ma', to: 'vc-patch-management' },
        // MP mitigates encryption (media data protection)
        { from: 'cf-mp', to: 'vc-encryption' },
        // PE mitigates physical
        { from: 'cf-pe', to: 'vc-physical' },
        // PS mitigates access control (personnel vetting)
        { from: 'cf-ps', to: 'vc-access-control' },
        // RA mitigates overall (identifies vulnerabilities)
        { from: 'cf-ra', to: 'vc-configuration' },
        { from: 'cf-ra', to: 'vc-patch-management' },
        // SA mitigates input validation + configuration (SDLC)
        { from: 'cf-sa', to: 'vc-input-validation' },
        { from: 'cf-sa', to: 'vc-configuration' },
        // SC mitigates encryption + network vulns
        { from: 'cf-sc', to: 'vc-encryption' },
        { from: 'cf-sc', to: 'vc-input-validation' },
        // SI mitigates patch management + input validation
        { from: 'cf-si', to: 'vc-patch-management' },
        { from: 'cf-si', to: 'vc-input-validation' },
        // SR mitigates supply chain configuration risks
        { from: 'cf-sr', to: 'vc-configuration' }
      ],

      // ControlFamily → protects → AssetType
      protects: [
        // AC protects systems, data, software, services
        { from: 'cf-ac', to: 'at-info-system' },
        { from: 'cf-ac', to: 'at-data-store' },
        { from: 'cf-ac', to: 'at-software' },
        { from: 'cf-ac', to: 'at-service' },
        // AT protects personnel
        { from: 'cf-at', to: 'at-personnel' },
        // AU protects systems, services
        { from: 'cf-au', to: 'at-info-system' },
        { from: 'cf-au', to: 'at-service' },
        // CM protects hardware, software, systems
        { from: 'cf-cm', to: 'at-info-system' },
        { from: 'cf-cm', to: 'at-hardware' },
        { from: 'cf-cm', to: 'at-software' },
        // CP protects systems, data
        { from: 'cf-cp', to: 'at-info-system' },
        { from: 'cf-cp', to: 'at-data-store' },
        // IA protects systems, software, services
        { from: 'cf-ia', to: 'at-info-system' },
        { from: 'cf-ia', to: 'at-software' },
        { from: 'cf-ia', to: 'at-service' },
        // IR protects systems, services
        { from: 'cf-ir', to: 'at-info-system' },
        { from: 'cf-ir', to: 'at-service' },
        // MA protects hardware
        { from: 'cf-ma', to: 'at-hardware' },
        // MP protects data
        { from: 'cf-mp', to: 'at-data-store' },
        // PE protects hardware, facility
        { from: 'cf-pe', to: 'at-hardware' },
        { from: 'cf-pe', to: 'at-facility' },
        // PS protects personnel
        { from: 'cf-ps', to: 'at-personnel' },
        // SC protects network, systems
        { from: 'cf-sc', to: 'at-network' },
        { from: 'cf-sc', to: 'at-info-system' },
        // SI protects software, systems
        { from: 'cf-si', to: 'at-software' },
        { from: 'cf-si', to: 'at-info-system' },
        // SR protects software, hardware (supply chain)
        { from: 'cf-sr', to: 'at-software' },
        { from: 'cf-sr', to: 'at-hardware' }
      ],

      // ControlFamily → counters → ThreatClass
      counters: [
        // AC counters adversarial actors
        { from: 'cf-ac', to: 'tc-adversarial-outsider' },
        { from: 'cf-ac', to: 'tc-adversarial-insider' },
        { from: 'cf-ac', to: 'tc-adversarial-partner' },
        // AT counters accidental threats
        { from: 'cf-at', to: 'tc-accidental' },
        // AU counters adversarial (detection)
        { from: 'cf-au', to: 'tc-adversarial-outsider' },
        { from: 'cf-au', to: 'tc-adversarial-insider' },
        // CM counters accidental + structural
        { from: 'cf-cm', to: 'tc-accidental' },
        { from: 'cf-cm', to: 'tc-structural' },
        // CP counters structural + environmental
        { from: 'cf-cp', to: 'tc-structural' },
        { from: 'cf-cp', to: 'tc-environmental' },
        // IA counters adversarial
        { from: 'cf-ia', to: 'tc-adversarial-outsider' },
        { from: 'cf-ia', to: 'tc-adversarial-insider' },
        { from: 'cf-ia', to: 'tc-adversarial-partner' },
        // IR counters all adversarial
        { from: 'cf-ir', to: 'tc-adversarial-outsider' },
        { from: 'cf-ir', to: 'tc-adversarial-insider' },
        // PE counters adversarial + environmental
        { from: 'cf-pe', to: 'tc-adversarial-outsider' },
        { from: 'cf-pe', to: 'tc-adversarial-insider' },
        { from: 'cf-pe', to: 'tc-environmental' },
        // PS counters insider threat
        { from: 'cf-ps', to: 'tc-adversarial-insider' },
        { from: 'cf-ps', to: 'tc-accidental' },
        // SC counters outsider + partner
        { from: 'cf-sc', to: 'tc-adversarial-outsider' },
        { from: 'cf-sc', to: 'tc-adversarial-partner' },
        // SI counters outsider + structural
        { from: 'cf-si', to: 'tc-adversarial-outsider' },
        { from: 'cf-si', to: 'tc-structural' },
        // SR counters partner (supply chain)
        { from: 'cf-sr', to: 'tc-adversarial-partner' }
      ]
    }
    return result
  }
}

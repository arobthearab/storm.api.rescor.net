// ═══════════════════════════════════════════════════════════════════
// NIST 800-30 Linkage Framework — Catalog Seed Data
// ═══════════════════════════════════════════════════════════════════
// Seeds the linkage catalog: Framework, AssetType, ThreatClass,
// VulnerabilityClass, ControlFamily nodes plus all catalog
// relationships (TARGETS, EXPLOITED_BY, AFFECTS, MITIGATES,
// PROTECTS, COUNTERS).
//
// All statements are idempotent (MERGE).
// Run via: npm run cypher:setup
// ═══════════════════════════════════════════════════════════════════

// ── Framework ─────────────────────────────────────────────────────

MERGE (fw:Framework { id: 'nist-800-30' })
SET fw.name        = 'NIST SP 800-30 Rev 1',
    fw.version     = '1.0.0',
    fw.description = 'Guide for Conducting Risk Assessments',
    fw.seededAt    = datetime();

// ── Asset Types ───────────────────────────────────────────────────

MERGE (at:AssetType { id: 'at-info-system' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Information System',
    at.description = 'Complete information system (hardware, software, data, operations)',
    at.iapDefaults = '{"model":"asset-valuation","classification":3,"users":5,"highValueData":[true,true,true,false,false,false]}';

MERGE (at:AssetType { id: 'at-data-store' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Data Store',
    at.description = 'Database, file share, data warehouse, or data lake',
    at.iapDefaults = '{"model":"asset-valuation","classification":3,"users":4,"highValueData":[true,true,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-hardware' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Hardware',
    at.description = 'Physical computing device (server, workstation, network appliance)',
    at.iapDefaults = '{"model":"asset-valuation","classification":2,"users":3,"highValueData":[false,false,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-software' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Software Application',
    at.description = 'Custom or commercial software application',
    at.iapDefaults = '{"model":"asset-valuation","classification":2,"users":4,"highValueData":[true,false,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-network' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Network Infrastructure',
    at.description = 'Network segment, communication link, or transmission medium',
    at.iapDefaults = '{"model":"asset-valuation","classification":2,"users":5,"highValueData":[false,true,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-service' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Service',
    at.description = 'IT or business service (email, authentication, cloud)',
    at.iapDefaults = '{"model":"asset-valuation","classification":2,"users":4,"highValueData":[true,false,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-personnel' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Personnel',
    at.description = 'Staff, contractors, or third-party personnel with access',
    at.iapDefaults = '{"model":"asset-valuation","classification":1,"users":3,"highValueData":[false,false,false,false,false,false]}';

MERGE (at:AssetType { id: 'at-facility' })
SET at.frameworkId = 'nist-800-30',
    at.name        = 'Facility',
    at.description = 'Physical location — data centre, office, or secure area',
    at.iapDefaults = '{"model":"asset-valuation","classification":2,"users":3,"highValueData":[false,false,true,false,false,false]}';

// ── Threat Classes ────────────────────────────────────────────────

MERGE (tc:ThreatClass { id: 'tc-adversarial-outsider' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Adversarial — Outsider',
    tc.source      = 'adversarial',
    tc.description = 'External hostile actor (cybercriminal, hacktivist, nation-state)',
    tc.iapDefaults = '{"model":"ham533","history":3,"access":1,"means":2}';

MERGE (tc:ThreatClass { id: 'tc-adversarial-insider' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Adversarial — Insider',
    tc.source      = 'adversarial',
    tc.description = 'Malicious insider with authorised access',
    tc.iapDefaults = '{"model":"ham533","history":2,"access":3,"means":1}';

MERGE (tc:ThreatClass { id: 'tc-adversarial-partner' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Adversarial — Trusted Partner',
    tc.source      = 'adversarial',
    tc.description = 'Hostile actor within a trusted business relationship (supply chain)',
    tc.iapDefaults = '{"model":"ham533","history":2,"access":2,"means":2}';

MERGE (tc:ThreatClass { id: 'tc-accidental' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Accidental',
    tc.source      = 'accidental',
    tc.description = 'Unintentional actions by authorised users (misconfiguration, human error)',
    tc.iapDefaults = '{"model":"ham533","history":4,"access":2,"means":1}';

MERGE (tc:ThreatClass { id: 'tc-structural' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Structural',
    tc.source      = 'structural',
    tc.description = 'Failures of technology, equipment, or environmental controls',
    tc.iapDefaults = '{"model":"ham533","history":3,"access":2,"means":1}';

MERGE (tc:ThreatClass { id: 'tc-environmental' })
SET tc.frameworkId = 'nist-800-30',
    tc.name        = 'Environmental',
    tc.source      = 'environmental',
    tc.description = 'Natural or man-made disaster (fire, flood, power outage)',
    tc.iapDefaults = '{"model":"ham533","history":2,"access":1,"means":3}';

// ── Vulnerability Classes ─────────────────────────────────────────

MERGE (vc:VulnerabilityClass { id: 'vc-configuration' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Configuration Management',
    vc.description = 'Misconfiguration, insecure defaults, or unpatched settings',
    vc.iapDefaults = '{"model":"crve3","capabilities":2,"resources":2,"visibility":2,"confidentiality":2,"integrity":2,"availability":1}';

MERGE (vc:VulnerabilityClass { id: 'vc-authentication' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Authentication',
    vc.description = 'Weak, missing, or bypassable authentication mechanisms',
    vc.iapDefaults = '{"model":"crve3","capabilities":2,"resources":2,"visibility":2,"confidentiality":3,"integrity":2,"availability":1}';

MERGE (vc:VulnerabilityClass { id: 'vc-access-control' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Access Control',
    vc.description = 'Broken access control, privilege escalation, or missing authorisation',
    vc.iapDefaults = '{"model":"crve3","capabilities":2,"resources":2,"visibility":2,"confidentiality":3,"integrity":3,"availability":1}';

MERGE (vc:VulnerabilityClass { id: 'vc-encryption' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Cryptographic Protection',
    vc.description = 'Weak or missing encryption, poor key management',
    vc.iapDefaults = '{"model":"crve3","capabilities":3,"resources":2,"visibility":1,"confidentiality":3,"integrity":2,"availability":1}';

MERGE (vc:VulnerabilityClass { id: 'vc-patch-management' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Patch Management',
    vc.description = 'Missing patches, outdated software, or end-of-life components',
    vc.iapDefaults = '{"model":"crve3","capabilities":1,"resources":1,"visibility":3,"confidentiality":2,"integrity":2,"availability":2}';

MERGE (vc:VulnerabilityClass { id: 'vc-input-validation' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Input Validation',
    vc.description = 'Injection flaws (SQL, XSS, command), improper input handling',
    vc.iapDefaults = '{"model":"crve3","capabilities":2,"resources":1,"visibility":2,"confidentiality":3,"integrity":3,"availability":2}';

MERGE (vc:VulnerabilityClass { id: 'vc-logging' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Logging and Monitoring',
    vc.description = 'Insufficient logging, missing alerts, or inadequate audit trails',
    vc.iapDefaults = '{"model":"crve3","capabilities":1,"resources":1,"visibility":1,"confidentiality":1,"integrity":1,"availability":1}';

MERGE (vc:VulnerabilityClass { id: 'vc-physical' })
SET vc.frameworkId = 'nist-800-30',
    vc.name        = 'Physical Security',
    vc.description = 'Weak physical access controls, environmental hazards',
    vc.iapDefaults = '{"model":"crve3","capabilities":2,"resources":2,"visibility":2,"confidentiality":2,"integrity":1,"availability":3}';

// ── Control Families ──────────────────────────────────────────────

MERGE (cf:ControlFamily { id: 'cf-ac' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Access Control', cf.identifier = 'AC',
    cf.description = 'Restrict system access to authorised users and transactions',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-at' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Awareness and Training', cf.identifier = 'AT',
    cf.description = 'Security awareness training for personnel',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-au' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Audit and Accountability', cf.identifier = 'AU',
    cf.description = 'Audit record creation, protection, and review',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ca' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Assessment and Authorisation', cf.identifier = 'CA',
    cf.description = 'Security control assessment and system authorisation',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-cm' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Configuration Management', cf.identifier = 'CM',
    cf.description = 'Baseline configurations and change control',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-cp' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Contingency Planning', cf.identifier = 'CP',
    cf.description = 'Emergency response, backup, and recovery',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ia' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Identification and Authentication', cf.identifier = 'IA',
    cf.description = 'Identify and authenticate users, devices, and services',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ir' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Incident Response', cf.identifier = 'IR',
    cf.description = 'Incident handling, monitoring, and reporting',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ma' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Maintenance', cf.identifier = 'MA',
    cf.description = 'System maintenance procedures and tools',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-mp' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Media Protection', cf.identifier = 'MP',
    cf.description = 'Media access, marking, storage, transport, and sanitisation',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-pe' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Physical and Environmental Protection', cf.identifier = 'PE',
    cf.description = 'Physical access, monitoring, and environmental controls',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-pl' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Planning', cf.identifier = 'PL',
    cf.description = 'Security planning and system security plan',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-pm' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Program Management', cf.identifier = 'PM',
    cf.description = 'Organisation-wide information security program',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ps' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Personnel Security', cf.identifier = 'PS',
    cf.description = 'Personnel screening, access agreements, and termination',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-pt' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Personally Identifiable Information', cf.identifier = 'PT',
    cf.description = 'PII processing, consent, and data quality',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-ra' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Risk Assessment', cf.identifier = 'RA',
    cf.description = 'Risk assessment policy, vulnerability disclosure',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-sa' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'System and Services Acquisition', cf.identifier = 'SA',
    cf.description = 'Supply chain risk management, system development',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-sc' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'System and Communications Protection', cf.identifier = 'SC',
    cf.description = 'Boundary protection, cryptographic mechanisms',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-si' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'System and Information Integrity', cf.identifier = 'SI',
    cf.description = 'Flaw remediation, malicious code protection, monitoring',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

MERGE (cf:ControlFamily { id: 'cf-sr' })
SET cf.frameworkId = 'nist-800-30', cf.name = 'Supply Chain Risk Management', cf.identifier = 'SR',
    cf.description = 'Supply chain controls, provenance, component authenticity',
    cf.iapDefaults = '{"model":"scep","controls":[{"implemented":0.5,"correction":0.5}]}';

// ── Catalog Relationships: TARGETS (ThreatClass → AssetType) ─────

MATCH (tc:ThreatClass { id: 'tc-adversarial-outsider' }), (at:AssetType { id: 'at-info-system' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-outsider' }), (at:AssetType { id: 'at-data-store' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-outsider' }), (at:AssetType { id: 'at-software' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-outsider' }), (at:AssetType { id: 'at-network' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-outsider' }), (at:AssetType { id: 'at-service' }) MERGE (tc)-[:TARGETS]->(at);

MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-info-system' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-data-store' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-hardware' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-software' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-network' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-service' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-personnel' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-insider' }), (at:AssetType { id: 'at-facility' }) MERGE (tc)-[:TARGETS]->(at);

MATCH (tc:ThreatClass { id: 'tc-adversarial-partner' }), (at:AssetType { id: 'at-info-system' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-partner' }), (at:AssetType { id: 'at-data-store' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-partner' }), (at:AssetType { id: 'at-software' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-adversarial-partner' }), (at:AssetType { id: 'at-service' }) MERGE (tc)-[:TARGETS]->(at);

MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-info-system' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-data-store' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-hardware' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-software' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-network' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-service' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-accidental' }), (at:AssetType { id: 'at-personnel' }) MERGE (tc)-[:TARGETS]->(at);

MATCH (tc:ThreatClass { id: 'tc-structural' }), (at:AssetType { id: 'at-hardware' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-structural' }), (at:AssetType { id: 'at-network' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-structural' }), (at:AssetType { id: 'at-facility' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-structural' }), (at:AssetType { id: 'at-info-system' }) MERGE (tc)-[:TARGETS]->(at);

MATCH (tc:ThreatClass { id: 'tc-environmental' }), (at:AssetType { id: 'at-hardware' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-environmental' }), (at:AssetType { id: 'at-network' }) MERGE (tc)-[:TARGETS]->(at);
MATCH (tc:ThreatClass { id: 'tc-environmental' }), (at:AssetType { id: 'at-facility' }) MERGE (tc)-[:TARGETS]->(at);

// ── Catalog Relationships: EXPLOITED_BY (VulnerabilityClass → ThreatClass) ──

MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (tc:ThreatClass { id: 'tc-accidental' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (tc:ThreatClass { id: 'tc-accidental' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (tc:ThreatClass { id: 'tc-structural' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-input-validation' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-input-validation' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-logging' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-logging' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (tc:ThreatClass { id: 'tc-structural' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);
MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (tc:ThreatClass { id: 'tc-environmental' }) MERGE (vc)-[:EXPLOITED_BY]->(tc);

// ── Catalog Relationships: AFFECTS (VulnerabilityClass → AssetType) ──

MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (at:AssetType { id: 'at-hardware' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (at:AssetType { id: 'at-software' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (at:AssetType { id: 'at-network' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-configuration' }), (at:AssetType { id: 'at-service' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (at:AssetType { id: 'at-software' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-authentication' }), (at:AssetType { id: 'at-service' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (at:AssetType { id: 'at-data-store' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (at:AssetType { id: 'at-software' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-access-control' }), (at:AssetType { id: 'at-service' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (at:AssetType { id: 'at-data-store' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-encryption' }), (at:AssetType { id: 'at-network' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (at:AssetType { id: 'at-hardware' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-patch-management' }), (at:AssetType { id: 'at-software' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-input-validation' }), (at:AssetType { id: 'at-software' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-input-validation' }), (at:AssetType { id: 'at-service' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-logging' }), (at:AssetType { id: 'at-info-system' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-logging' }), (at:AssetType { id: 'at-service' }) MERGE (vc)-[:AFFECTS]->(at);

MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (at:AssetType { id: 'at-hardware' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (at:AssetType { id: 'at-facility' }) MERGE (vc)-[:AFFECTS]->(at);
MATCH (vc:VulnerabilityClass { id: 'vc-physical' }), (at:AssetType { id: 'at-network' }) MERGE (vc)-[:AFFECTS]->(at);

// ── Catalog Relationships: MITIGATES (ControlFamily → VulnerabilityClass) ──

MATCH (cf:ControlFamily { id: 'cf-ac' }), (vc:VulnerabilityClass { id: 'vc-access-control' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (vc:VulnerabilityClass { id: 'vc-authentication' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-at' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-at' }), (vc:VulnerabilityClass { id: 'vc-access-control' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-au' }), (vc:VulnerabilityClass { id: 'vc-logging' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ca' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-cm' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-cm' }), (vc:VulnerabilityClass { id: 'vc-patch-management' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-cp' }), (vc:VulnerabilityClass { id: 'vc-physical' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ia' }), (vc:VulnerabilityClass { id: 'vc-authentication' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ir' }), (vc:VulnerabilityClass { id: 'vc-logging' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ma' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-ma' }), (vc:VulnerabilityClass { id: 'vc-patch-management' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-mp' }), (vc:VulnerabilityClass { id: 'vc-encryption' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-pe' }), (vc:VulnerabilityClass { id: 'vc-physical' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ps' }), (vc:VulnerabilityClass { id: 'vc-access-control' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-ra' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-ra' }), (vc:VulnerabilityClass { id: 'vc-patch-management' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-sa' }), (vc:VulnerabilityClass { id: 'vc-input-validation' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-sa' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-sc' }), (vc:VulnerabilityClass { id: 'vc-encryption' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-sc' }), (vc:VulnerabilityClass { id: 'vc-input-validation' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-si' }), (vc:VulnerabilityClass { id: 'vc-patch-management' }) MERGE (cf)-[:MITIGATES]->(vc);
MATCH (cf:ControlFamily { id: 'cf-si' }), (vc:VulnerabilityClass { id: 'vc-input-validation' }) MERGE (cf)-[:MITIGATES]->(vc);

MATCH (cf:ControlFamily { id: 'cf-sr' }), (vc:VulnerabilityClass { id: 'vc-configuration' }) MERGE (cf)-[:MITIGATES]->(vc);

// ── Catalog Relationships: PROTECTS (ControlFamily → AssetType) ──

MATCH (cf:ControlFamily { id: 'cf-ac' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (at:AssetType { id: 'at-data-store' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (at:AssetType { id: 'at-software' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (at:AssetType { id: 'at-service' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-at' }), (at:AssetType { id: 'at-personnel' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-au' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-au' }), (at:AssetType { id: 'at-service' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-cm' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-cm' }), (at:AssetType { id: 'at-hardware' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-cm' }), (at:AssetType { id: 'at-software' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-cp' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-cp' }), (at:AssetType { id: 'at-data-store' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-ia' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ia' }), (at:AssetType { id: 'at-software' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ia' }), (at:AssetType { id: 'at-service' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-ir' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-ir' }), (at:AssetType { id: 'at-service' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-ma' }), (at:AssetType { id: 'at-hardware' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-mp' }), (at:AssetType { id: 'at-data-store' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-pe' }), (at:AssetType { id: 'at-hardware' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-pe' }), (at:AssetType { id: 'at-facility' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-ps' }), (at:AssetType { id: 'at-personnel' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-sc' }), (at:AssetType { id: 'at-network' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-sc' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-si' }), (at:AssetType { id: 'at-software' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-si' }), (at:AssetType { id: 'at-info-system' }) MERGE (cf)-[:PROTECTS]->(at);

MATCH (cf:ControlFamily { id: 'cf-sr' }), (at:AssetType { id: 'at-software' }) MERGE (cf)-[:PROTECTS]->(at);
MATCH (cf:ControlFamily { id: 'cf-sr' }), (at:AssetType { id: 'at-hardware' }) MERGE (cf)-[:PROTECTS]->(at);

// ── Catalog Relationships: COUNTERS (ControlFamily → ThreatClass) ──

MATCH (cf:ControlFamily { id: 'cf-ac' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ac' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-at' }), (tc:ThreatClass { id: 'tc-accidental' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-au' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-au' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-cm' }), (tc:ThreatClass { id: 'tc-accidental' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-cm' }), (tc:ThreatClass { id: 'tc-structural' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-cp' }), (tc:ThreatClass { id: 'tc-structural' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-cp' }), (tc:ThreatClass { id: 'tc-environmental' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-ia' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ia' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ia' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-ir' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ir' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-pe' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-pe' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-pe' }), (tc:ThreatClass { id: 'tc-environmental' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-ps' }), (tc:ThreatClass { id: 'tc-adversarial-insider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-ps' }), (tc:ThreatClass { id: 'tc-accidental' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-sc' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-sc' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-si' }), (tc:ThreatClass { id: 'tc-adversarial-outsider' }) MERGE (cf)-[:COUNTERS]->(tc);
MATCH (cf:ControlFamily { id: 'cf-si' }), (tc:ThreatClass { id: 'tc-structural' }) MERGE (cf)-[:COUNTERS]->(tc);

MATCH (cf:ControlFamily { id: 'cf-sr' }), (tc:ThreatClass { id: 'tc-adversarial-partner' }) MERGE (cf)-[:COUNTERS]->(tc);

// ═══════════════════════════════════════════════════════════════════
// STORM Neo4j Schema — Constraints and Indexes
// ═══════════════════════════════════════════════════════════════════
// Run via: npm run cypher:setup
// All statements are idempotent (IF NOT EXISTS).
// ═══════════════════════════════════════════════════════════════════

// ── Uniqueness Constraints ────────────────────────────────────────

CREATE CONSTRAINT measurement_id_unique IF NOT EXISTS
FOR (m:Measurement) REQUIRE m.id IS UNIQUE;

CREATE CONSTRAINT hierarchy_node_id_unique IF NOT EXISTS
FOR (n:HierarchyNode) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT factor_id_unique IF NOT EXISTS
FOR (f:Factor) REQUIRE f.id IS UNIQUE;

CREATE CONSTRAINT modifier_id_unique IF NOT EXISTS
FOR (mod:Modifier) REQUIRE mod.id IS UNIQUE;

CREATE CONSTRAINT user_sub_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.sub IS UNIQUE;

// ── Performance Indexes ───────────────────────────────────────────

CREATE INDEX factor_measurement_idx IF NOT EXISTS
FOR (f:Factor) ON (f.measurementId);

CREATE INDEX hierarchy_node_measurement_idx IF NOT EXISTS
FOR (n:HierarchyNode) ON (n.measurementId);

CREATE INDEX hierarchy_node_lookup_idx IF NOT EXISTS
FOR (n:HierarchyNode) ON (n.measurementId, n.level, n.label);

CREATE INDEX modifier_factor_idx IF NOT EXISTS
FOR (mod:Modifier) ON (mod.factorId);

CREATE INDEX user_email_idx IF NOT EXISTS
FOR (u:User) ON (u.email);

// ── TTL Index for APOC Auto-Purge ─────────────────────────────────
// APOC TTL looks for nodes with a `ttl` property (epoch millis).
// Measurements that expire are auto-deleted on the APOC schedule.

CREATE INDEX measurement_ttl_idx IF NOT EXISTS
FOR (m:Measurement) ON (m.ttl);

// ═══════════════════════════════════════════════════════════════════
// ATV(1-C) Linkage Framework — Catalog + Instance Entities
// ═══════════════════════════════════════════════════════════════════

// ── Catalog Node Constraints ──────────────────────────────────────

CREATE CONSTRAINT framework_id_unique IF NOT EXISTS
FOR (fw:Framework) REQUIRE fw.id IS UNIQUE;

CREATE CONSTRAINT asset_type_id_unique IF NOT EXISTS
FOR (at:AssetType) REQUIRE at.id IS UNIQUE;

CREATE CONSTRAINT threat_class_id_unique IF NOT EXISTS
FOR (tc:ThreatClass) REQUIRE tc.id IS UNIQUE;

CREATE CONSTRAINT vulnerability_class_id_unique IF NOT EXISTS
FOR (vc:VulnerabilityClass) REQUIRE vc.id IS UNIQUE;

CREATE CONSTRAINT control_family_id_unique IF NOT EXISTS
FOR (cf:ControlFamily) REQUIRE cf.id IS UNIQUE;

// ── Instance Node Constraints ─────────────────────────────────────

CREATE CONSTRAINT asset_id_unique IF NOT EXISTS
FOR (a:Asset) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT threat_id_unique IF NOT EXISTS
FOR (t:Threat) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT vulnerability_id_unique IF NOT EXISTS
FOR (v:Vulnerability) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT control_id_unique IF NOT EXISTS
FOR (c:Control) REQUIRE c.id IS UNIQUE;

// ── Catalog Performance Indexes ───────────────────────────────────

CREATE INDEX asset_type_framework_idx IF NOT EXISTS
FOR (at:AssetType) ON (at.frameworkId);

CREATE INDEX threat_class_framework_idx IF NOT EXISTS
FOR (tc:ThreatClass) ON (tc.frameworkId);

CREATE INDEX vulnerability_class_framework_idx IF NOT EXISTS
FOR (vc:VulnerabilityClass) ON (vc.frameworkId);

CREATE INDEX control_family_framework_idx IF NOT EXISTS
FOR (cf:ControlFamily) ON (cf.frameworkId);

// ── Instance Performance Indexes ──────────────────────────────────

CREATE INDEX asset_framework_idx IF NOT EXISTS
FOR (a:Asset) ON (a.frameworkId);

CREATE INDEX threat_framework_idx IF NOT EXISTS
FOR (t:Threat) ON (t.frameworkId);

CREATE INDEX vulnerability_framework_idx IF NOT EXISTS
FOR (v:Vulnerability) ON (v.frameworkId);

CREATE INDEX control_framework_idx IF NOT EXISTS
FOR (c:Control) ON (c.frameworkId);

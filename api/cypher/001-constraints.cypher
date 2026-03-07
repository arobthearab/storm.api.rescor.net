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

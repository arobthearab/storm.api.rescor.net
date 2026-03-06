# Claude Instructions — storm.api.rescor.net

## Mandatory: Read Cross-Project Patterns First

Before writing any code or making any changes, read:

```
/Volumes/Overflow/Repositories/core.rescor.net/docs/PROJECT-PATTERNS.md
```

This file defines mandatory patterns for all RESCOR projects:
- Code style (single return point, full words, short functions)
- Secrets policy (Infisical-first, no .env for application config)
- Configuration-First Runtime Policy
- Source control discipline (scoped commits)
- CLI usage patterns
- Build-vs-Buy disclosure

## Project-Specific Patterns

See [docs/PROJECT-PATTERNS.md](docs/PROJECT-PATTERNS.md) for STORM API conventions:
- RSK/VM and RSK/RM modes
- Engine architecture (calculators, assessments, processes)
- API Gateway compatibility (AWS, Azure, GCP)
- Authentication & authorization (OAuth 2.0, OIDC, JWT, mTLS, RBAC)

## Key Facts

- API: Express 4 + @rescor/core-* (ESM `.mjs`, port 3200)
- Runtime: Node 18+
- Database: Neo4j 5.15 Community — dev container `storm-neo4j` on localhost:17787 (Bolt) / 17574 (HTTP), creds: neo4j/stormdev123
- Dev container: `docker compose up -d` → `storm-neo4j`
- Persistence: SessionPerQueryWrapper around @rescor/core-db Neo4jOperations (APOC TTL plugin for auto-purge)
- Test framework: vitest — 82 tests (6 files: API persistence + validators + SDK)
- Auth: OAuth 2.0 / OIDC bearer tokens (JWT) + mTLS for service-to-service
- RBAC roles: admin, assessor, reviewer, auditor
- Engines: RSK/VM (vulnerability mode), RSK/RM (risk mode), HAM533, CRVE3, SCEP
- Measurement lifecycle stored in Neo4j (Measurement→HierarchyNode→Factor→Modifier graph)
- Batch endpoints: POST /v1/measurements/:id/factors/batch (max 10K items), POST /v1/measurements/:id/modifiers/batch
- All parameters configurable per-request — zero hardcoded constants
- Cypher DDL: api/cypher/001-constraints (4 uniqueness constraints, 4 indexes, TTL index)
- SDK: `@rescor/storm-sdk` with Factor/Modifier value objects, FactorBatch (auto-chunk 5K, 3 concurrent)
- Dev: `npm run dev` (root), `npm run cypher:setup` (seed Neo4j), `npm test` (vitest)
- Process integration: `rescor process start --project storm` brings up Neo4j then API

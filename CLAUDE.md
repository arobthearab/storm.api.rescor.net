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
- Test framework: vitest
- Auth: OAuth 2.0 / OIDC bearer tokens (JWT) + mTLS for service-to-service
- RBAC roles: admin, assessor, reviewer, auditor
- No database required — stateless computation engine (consumers persist state)
- Engines: RSK/VM (vulnerability mode), RSK/RM (risk mode), HAM533, CRVE3, SCEP
- All parameters configurable per-request — zero hardcoded constants
- Dev: `npm run dev` (root), `npm test` (vitest)

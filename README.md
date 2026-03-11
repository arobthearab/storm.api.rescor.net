# STORM API — RSK Risk & Vulnerability Scoring Engine

A REST API implementing the STORM (Scaled Threat-Oriented Risk Methodology) framework and its RSK (Risk Scoring Kernel) computation engine, backed by Neo4j for measurement session persistence and entity management.

## Modes

| Mode | Purpose | Components |
|------|---------|------------|
| **RSK/VM** | Vulnerability / compliance scoring | Measurement vectors + diminishing-returns aggregate |
| **RSK/RM** | Full risk assessment | Asset(A) × Threat(T) × Vulnerability(V) × Control(C) → SLE / DLE |
| **IAP** | Independent ancillary processes | Domain-based transform endpoints (threat, vulnerability, control, asset) |
| **NIST** | Standards-aligned risk matrix | NIST 800-30 likelihood × impact → qualitative risk |
| **ATV(1-C)** | Entity linkage framework | Asset/Threat/Vulnerability/Control graph with catalog-validated relationships |

## Quick Start

```bash
npm install
docker compose up -d    # Neo4j on localhost:17787
npm run cypher:setup    # seed constraints + framework catalog
npm run dev             # Express on :3200
npm test                # vitest (233 tests)
```

## Configuration

All runtime configuration is loaded from **Infisical** at startup.  The only
environment variables are the Infisical bootstrap credentials in `.env`.

1. Copy `.env.example` → `.env` and fill in Infisical credentials.
2. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full reference
   (bootstrap vars, runtime keys, credential rotation, troubleshooting).

## Architecture

The API combines **stateless computation** (RSK/VM, RSK/RM, IAP, NIST) with **measurement session persistence** and **entity management** via Neo4j. Computation endpoints carry all inputs per-request; measurement and entity endpoints persist data in a Neo4j graph.

- [docs/API-REFERENCE.md](docs/API-REFERENCE.md) — Endpoint documentation
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — Token acquisition, RBAC, dev-mode bypass
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — Bootstrap credentials, Infisical keys, rotation
- [docs/PROJECT-PATTERNS.md](docs/PROJECT-PATTERNS.md) — STORM-specific conventions
- [docs/SECURITY.md](docs/SECURITY.md) — Authentication, authorization, and gateway integration
- [docs/openapi.yaml](docs/openapi.yaml) — OpenAPI 3.1 specification

## Directory Structure

```
storm.api.rescor.net/
├── docs/                    # All documentation
│   ├── openapi.yaml         # OpenAPI 3.1 spec
│   ├── API-REFERENCE.md     # Endpoint reference
│   ├── AUTHENTICATION.md    # Token & RBAC guide
│   ├── CONFIGURATION.md     # Bootstrap & runtime config
│   ├── PROJECT-PATTERNS.md  # STORM-specific patterns
│   └── SECURITY.md          # Auth & gateway docs
├── api/
│   └── cypher/              # Neo4j DDL & seed scripts
│       ├── 001-constraints.cypher
│       └── 004-seed-framework-nist80030.cypher
├── src/
│   ├── index.mjs            # Express app bootstrap
│   ├── engines/             # Pure computation functions
│   │   ├── rsk.mjs          # Diminishing-returns aggregate
│   │   ├── riskMode.mjs     # RSK/RM adjust, SLE, DLE, assess
│   │   ├── modifiers.mjs    # Modifier algebra
│   │   ├── nist.mjs         # NIST 800-30 risk matrix
│   │   └── iap.mjs          # IAP processor
│   ├── transforms/          # IAP transform classes
│   │   ├── Transform.mjs    # Abstract base class
│   │   ├── Ham533Transform.mjs
│   │   ├── Crve3Transform.mjs
│   │   ├── CvssaTransform.mjs
│   │   ├── ScepTransform.mjs
│   │   └── AssetValuationTransform.mjs
│   ├── frameworks/          # ATV(1-C) linkage frameworks
│   │   ├── LinkageFramework.mjs   # Abstract base class
│   │   └── Nist80030Framework.mjs # NIST 800-30 catalog
│   ├── persistence/         # Neo4j stores
│   │   ├── MeasurementStore.mjs
│   │   ├── LinkageStore.mjs
│   │   ├── UserStore.mjs
│   │   └── database.mjs
│   ├── routes/              # Express route handlers
│   ├── middleware/           # Auth, validation, error handling
│   └── validators/          # Input validation
├── sdk/                     # @rescor/storm-sdk (Node.js)
├── test/
│   ├── unit/                # Engine + persistence + framework tests
│   └── integration/         # Auth integration tests
├── CLAUDE.md
└── README.md
```

## References

- [Core Project Patterns](../core.rescor.net/docs/PROJECT-PATTERNS.md)
- [ASR Implementation](../asr.rescor.net/) — RSK/VM reference integration
- [HAM533 Calculator](../ham533.rescor.net/) — Standalone threat assessment UI

# STORM API — RSK Risk & Vulnerability Scoring Engine

A stateless REST API implementing the STORM (Scaled Threat-Oriented Risk Methodology) framework and its RSK (Risk Scoring Kernel) computation engine.

## Modes

| Mode | Purpose | Components |
|------|---------|------------|
| **RSK/VM** | Vulnerability / compliance scoring | Measurement vectors + diminishing-returns aggregate |
| **RSK/RM** | Full risk assessment | Asset(A) × Threat(T) × Vulnerability(V) × Control(C) → SLE / DLE |

## Quick Start

```bash
npm install
npm run dev          # Express on :3200
npm test             # vitest
```

## Architecture

The API is a **stateless computation engine** — it accepts input parameters, computes results, and returns them. No database is required. Consumers (ASR, SRA, TestingCenter, etc.) are responsible for persistence.

- [docs/API-REFERENCE.md](docs/API-REFERENCE.md) — Endpoint documentation
- [docs/PROJECT-PATTERNS.md](docs/PROJECT-PATTERNS.md) — STORM-specific conventions
- [docs/SECURITY.md](docs/SECURITY.md) — Authentication, authorization, and gateway integration
- [docs/openapi.yaml](docs/openapi.yaml) — OpenAPI 3.1 specification

## Directory Structure

```
storm.api.rescor.net/
├── docs/                    # All documentation
│   ├── openapi.yaml         # OpenAPI 3.1 spec
│   ├── API-REFERENCE.md     # Endpoint reference
│   ├── PROJECT-PATTERNS.md  # STORM-specific patterns
│   └── SECURITY.md          # Auth & gateway docs
├── src/
│   ├── server.mjs           # Express app bootstrap
│   ├── engines/             # Pure computation functions
│   │   ├── rskAggregate.mjs # Diminishing-returns aggregate
│   │   ├── rskNormalize.mjs # Raw → normalized scaling
│   │   ├── ham533.mjs       # HAM533 threat assessment
│   │   ├── crve3.mjs        # CRVE3 vulnerability assessment
│   │   ├── scep.mjs         # SCEP control assessment
│   │   └── lossExpectancy.mjs # SLE / DLE formulas
│   ├── models/              # Request/response schemas
│   ├── routes/              # Express route handlers
│   ├── middleware/           # Auth, validation, error handling
│   └── validators/          # Input validation
├── test/
│   ├── unit/                # Engine unit tests
│   └── integration/         # API integration tests
├── CLAUDE.md
└── README.md
```

## References

- [Core Project Patterns](../core.rescor.net/docs/PROJECT-PATTERNS.md)
- [ASR Implementation](../asr.rescor.net/) — RSK/VM reference integration
- [HAM533 Calculator](../ham533.rescor.net/) — Standalone threat assessment UI

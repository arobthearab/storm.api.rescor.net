# STORM API — Project Patterns

> Cross-project patterns (secrets, code style, CLI) are in
> **[core.rescor.net/docs/PROJECT-PATTERNS.md](../../core.rescor.net/docs/PROJECT-PATTERNS.md)**.
> This file contains STORM API-specific content only.

---

## Architecture

| Layer      | Stack                          | Port |
|------------|--------------------------------|------|
| API        | Express 4 + @rescor/core-*     | 3200 |
| Database   | Neo4j 5.15 Community (APOC)    | 17787 (Bolt) / 17574 (HTTP) |
| Runtime    | Node 18+ (ESM `.mjs`)         | —    |
| Auth       | OAuth 2.0 / OIDC / JWT / mTLS | —    |
| Gateway    | AWS API Gateway / Azure APIM / GCP Cloud Endpoints | — |

### Hybrid Engine Design

The STORM API combines **stateless computation** (RSK/VM, RSK/RM, IAP, NIST)
with **measurement session persistence** via Neo4j. Computation endpoints carry
all inputs per-request; measurement endpoints persist factor/modifier data
in a Neo4j graph for aggregation and analysis.

---

## Intellectual Property Classification

### Proprietary (Confidential)

The following are trade secrets of RESCOR LLC and **must never appear** in
public-facing documentation, API specifications, error messages, or log output:

| Asset | Description |
|-------|-------------|
| **RSK aggregate function** | The composite measurement algorithm (formula, constants, derivation) |
| **Bounds formula** | Theoretical upper-bound calculation |
| **T-V-A aggregation pipeline** | How adjusted measurements are composed into composite scores |
| **Scaling-base semantics** | The mathematical role of `scalingBase` in the aggregate |
| **Core assumptions text** | The three assumptions (worst-case, multiple vulnerability, diminishing effect) |

### Public (Unrestricted)

| Asset | Rationale |
|-------|----------|
| IAP models (HAM533, CRVE3, SCEP, AsrValuation) | Straightforward scaling functions; formulas may be published |
| Loss expectancy (SLE, DLE) | Standard actuarial formulas |
| NIST 800-30 mapping | Public standard; breakpoints are configurable |
| RSK/RM per-factor adjustment ($C \times V_a \times T_p \times b$) | Standard probability product |
| Parameter names and defaults | Required for API usability |

### Enforcement Rules

1. **`openapi.yaml` is publicly served** (`GET /v1/openapi.yaml`, no auth) —
   it must contain zero proprietary formulas or algorithm descriptions.
2. **API-REFERENCE.md** is consumer-facing — same restrictions as `openapi.yaml`.
3. **This file** (PROJECT-PATTERNS.md) is internal developer documentation —
   proprietary formulas appear below, clearly marked **CONFIDENTIAL**.
4. **API responses** must not include algorithm metadata (formula strings,
   intermediate series terms) beyond the declared schema fields.
5. **Error messages** must not reveal algorithm internals
   (e.g., ~~"geometric series overflow"~~ → "computation exceeds bounds").
6. **Abuse detection** (future): successive probing vectors
   (e.g., `[1,1,1,1]`, `[2,2,2,2]`, incrementing patterns) should be flagged
   for review as potential reverse-engineering attempts.

---

## RSK Modes

> Reference: *Paper-RSK-NDA-V9.1*, A. T. Robinson (December 2007, NMI LLC).

### Measurement Unit

All RSK measurements are expressed in the synthetic unit **RU** (Risk Unit).
A larger measurement indicates greater risk.

### Testing Domain Hierarchy

RSK defines a hierarchical organization for the testing domain (from broad to narrow):

| Level | Description |
|-------|-------------|
| **Horizon** | Set of assets visible from a specific testing location (e.g., Internet horizon) |
| **Host** | Specifically identifiable interface within a horizon (e.g., IP address) |
| **Service** | Network-accessible application identified by host + protocol + application |
| **Risk Factor** | Individual vulnerability measurement from the RSK Risk Factor Database |

Each level's measurement is a **composite** calculated from its subcomponents.

### RSK/VM — Vulnerability Mode

Security testing mode. Enumerates vulnerabilities from visible properties; assumes
all assets are of equal value and a single hostile threat agent that is 100%
effective at exploiting any identified risk factors.

**Parameters:**

| Parameter | Symbol | Default | Description |
|-----------|--------|---------|-------------|
| `scalingBase` | a | 4 | Divisor base for diminishing returns |
| `minimumValue` | v_min | 1 | Minimum risk factor base measurement |
| `maximumValue` | v_max | 100 | Maximum risk factor base measurement |
| `ratingThresholds` | — | [25, 50, 75, 100] | RU breakpoints (from white paper Table IA) |
| `ratingLabels` | — | [Low, Moderate, High, Very High, Extreme] | Rating per threshold band |

> **⚠ CONFIDENTIAL — Do not reproduce in public-facing documentation.**

**Core assumptions (from white paper):**
1. **Worst-case risk** — overall risk ≥ most severe risk factor
2. **Multiple vulnerability** — risk increases with number of risk factors
3. **Diminishing effect** — most severe predominates; each successive factor has less impact

**Composite measurement function** $f(V, a)$:

$$h_i = f(V_i, a) = \left\lceil \sum_{j=0}^{|V_i|-1} \frac{V_{ij}}{a^j} \right\rceil$$

Where $V_i = \{v_0, v_1, \ldots\}$ is the **decreasing ordered set** of all
risk factor measurements associated with entity $i$.

**Bounds:**

$$V_{i0} \leq f(V_i, a) \leq \frac{v_{max}}{1 - \frac{1}{a}}$$

With defaults ($v_{max}=100$, $a=4$): bounds are $[V_{i0},\ 134]$ RU.

**Relative Risk Levels (Table IA):**

| Level | Low RU | High RU |
|-------|--------|---------|
| Low | 0 | 24 |
| Moderate | 25 | 49 |
| High | 50 | 74 |
| Very High | 75 | 99 |
| Extreme | 100 | + |

**Alternate Relative Risk Levels (Table IB):**

| Level | Low RU | High RU |
|-------|--------|---------|
| Low | 0 | 39 |
| Medium | 40 | 69 |
| High | 70 | + |

**Case study verification (Appendix B, $a=4$):**

| Vector | Expected |
|--------|----------|
| {20, 5, 5, 5} | 22 |
| {20, 5, 5, 5, 5, 5, 5, 5, 5, 5} | 22 |
| {40, 10, 5, 5, 5, 5, 5, 5} | 43 |
| {50} | 50 |
| {50, 40, 40, 20, 20, 5, …, 5} | 63 |

### RSK/RM — Risk Mode

Full risk assessment incorporating asset value, threat potential, vulnerability,
and finding confidence. Extends RSK/VM by adjusting each base measurement:

$$v_i = C_i \times V_{a_i} \times T_{p_i} \times b_i$$

Where:
- $C_i$ = finding confidence (probability the vulnerability exists; 1.0 for RSK/VM)
- $V_{a_i}$ = asset value (0–1, percentage of organization's total value; 1.0 for RSK/VM)
- $T_{p_i}$ = threat potential (probability a given threat will be realized; 1.0 for RSK/VM)
- $b_i$ = base RSK measurement from risk factor database

**Components (IAP assessments):**

| Symbol | Name | Assessment Model | Factors |
|--------|------|------------------|---------|
| A | Asset Value | AsrValuation | Classification × Users × High-Value Data |
| T | Threat | HAM533 | History × Access × Means (5-3-3) |
| V | Vulnerability | CRVE3 | Capabilities × Resources × Visibility + CIA Exposure |
| C | Control | SCEP | Mitigates × ControlType × Implemented × Correction |

**Loss expectancy formulas:**

$$SLE = A \times 1 \times V \times (1 - C)$$
$$DLE = A \times T \times V \times (1 - C)$$

---

## Independent Ancillary Processes (IAP)

The STORM framework organizes risk component assessments as **IAPs** — self-contained
processes that each produce a normalized 0–1 factor value from their own inputs.

RSK/RM uses IAPs to produce the $C$, $V_{a}$, and $T_{p}$ adjustment factors
described in the white paper. Each IAP is independently callable via the API —
you can use HAM533 without running a full RSK/RM assessment.

| IAP | RSK/RM Factor | Inputs | Output (0–1) |
|-----|---------------|--------|--------------|
| HAM533 | Threat potential $T_p$ | History(1–5), Access(1–3), Means(1–3) | probability, impact |
| CRVE3 | Vulnerability $V_a$ | Capabilities(1–3), Resources(1–3), Visibility(1–3), C/I/A Exposure(1–3 each) | exposure |
| CVSSA | Vulnerability $V_a$ | (alternate vulnerability model) | exposure |
| SCEP | Control $C$ | controls[] (each: implemented 0–1, correction 0–1) | efficacy |
| AsrValuation | Asset value $A$ | Classification(1–3), Users(1–5), HighValueData(6 categories) | assetValue |

### Transform Architecture

IAPs are implemented as **Transforms** — a class hierarchy that standardizes
input validation, factor definition, and computation:

```
Transform (abstract base)
├── Ham533Transform     (domain: threat, model: ham533)
├── Crve3Transform      (domain: vulnerability, model: crve3)
├── CvssaTransform      (domain: vulnerability, model: cvssa)
├── ScepTransform       (domain: control, model: scep)
└── AssetValuationTransform (domain: asset, model: asset-valuation)
```

The **Transform Registry** (`src/transforms/index.mjs`) maps (domain, model)
pairs to Transform classes. Each domain has a default model used when the
caller omits the `model` parameter.

API endpoints are **domain-based**: `POST /v1/iap/threat`, `/vulnerability`,
`/control`, `/asset`. A `GET /v1/iap/transforms` discovery endpoint lists all
registered transforms.

---

## ATV(1-C) Linkage Framework

The **ATV(1-C)** system models the relationships between Assets, Threats,
Vulnerabilities, and Controls in a persistent Neo4j graph with catalog-validated
linkage rules.

### Framework Catalog

A **LinkageFramework** (e.g., NIST 800-30) defines:
- **Asset types** (e.g., Information System, Network)
- **Threat classes** (e.g., Adversarial, Environmental)
- **Vulnerability classes** (e.g., Technical, Operational)
- **Control families** (e.g., Access Control, Audit)
- **Linkage rules** — which catalog entries may be linked by which relationships

Catalog nodes carry `iapDefaults` — suggested IAP inputs for that type.

### Entity & Linkage Lifecycle

Instance entities (Asset, Threat, Vulnerability, Control) reference their
catalog type. Linkages between instances are validated against the catalog rules.

| Layer | Relationships |
|-------|---------------|
| Catalog | TARGETS, EXPLOITED_BY, AFFECTS, MITIGATES, PROTECTS, COUNTERS |
| Instance | EXPOSED_TO, SUSCEPTIBLE_TO, EXPLOITED_VIA, APPLIED_TO, GUARDS |
| Audit | ASSESSES (Measurement → Asset) |

### Persistence

- **LinkageStore** (`src/persistence/LinkageStore.mjs`) — full CRUD for entities
  and linkages, batch operations, suggestion queries
- **Cypher DDL**: `001-constraints.cypher` (14 constraints, 14 indexes),
  `004-seed-framework-nist80030.cypher` (catalog seed data)

### HAM533

The "533" refers to factor scale maximums: History max 5, Access max 3, Means max 3.

$$\text{probability} = \frac{H \times A \times M}{45} \qquad \text{impact} = \frac{5 \times A \times M}{45}$$

### CRVE3

Basic component: $\text{basic} = C \times R \times V$ (max 27).
CIA aggregate: diminishing-returns aggregate of confidentiality, integrity, availability exposures.
Final: $\text{exposure} = \frac{\text{cia} \times \text{basic}}{\text{ciaMax} \times \text{basicMax}}$

### SCEP

Per-control effective: $\text{effective} = \text{implemented} \times \text{correction}$.
Aggregate efficacy: $\min(1,\ f(\text{effectives}, a=4))$ using the RSK aggregate function.

---

## NIST SP 800-30 Risk Matrix Integration

The STORM API provides a standards-aligned endpoint that maps RSK quantitative
measurements to the NIST SP 800-30 Rev 1 qualitative risk determination matrix.

### Dual-Dimension Threat Assessment

HAM533 produces two distinct threat outputs that map directly to the NIST 5×5
matrix axes. This is the key insight linking RSK to NIST:

| HAM533 Output | Formula | H Value | Maps To |
|---------------|---------|---------|---------|
| **probability** | $H \times A \times M / 45$ | Actuarial (1–5) | **Likelihood** axis |
| **impact** | $5 \times A \times M / 45$ | Max (certainty) | **Impact** axis |

- **Likelihood** (probability of adverse event): $T_{probability} \times V \times (1 - C)$
- **Impact** (severity if event occurs): $T_{impact} \times A$

### Qualitative Mapping (NIST 800-30 Table D-2)

Default breakpoints for mapping RSK probabilities (0–1) to NIST qualitative levels:

| Level | Range | Semi-Quant. (Likelihood) | Semi-Quant. (Impact) |
|-------|-------|--------------------------|---------------------|
| Very Low | [0, 0.05) | 0 | 0 |
| Low | [0.05, 0.21) | 2 | 2 |
| Moderate | [0.21, 0.80) | 5 | 10 |
| High | [0.80, 0.96) | 8 | 50 |
| Very High | [0.96, 1.0] | 10 | 100 |

Breakpoints are configurable per-request to adapt to domain-specific risk
scales (e.g., financial risk may use different impact thresholds than
cybersecurity, operational safety, or reputational risk).

### Risk Determination Matrix (NIST 800-30 Table I-2)

The 5×5 grid of qualitative risk levels (likelihood rows × impact columns)
is included in every response for presentation rendering:

|  | VL Impact | L Impact | M Impact | H Impact | VH Impact |
|---|---|---|---|---|---|
| **VH Likelihood** | Very Low | Low | Moderate | High | Very High |
| **H Likelihood** | Very Low | Low | Moderate | High | Very High |
| **M Likelihood** | Very Low | Low | Moderate | Moderate | High |
| **L Likelihood** | Very Low | Low | Low | Low | Moderate |
| **VL Likelihood** | Very Low | Very Low | Very Low | Low | Low |

### Domain Agnosticism

Because STORM assesses all forms of risk (not just technology), the NIST
matrix endpoint accepts custom breakpoints. The same engine produces
NIST-compliant matrices for cybersecurity, financial, operational, strategic,
or any other risk domain — the qualitative mapping changes, the math does not.

---

## Measurement Lifecycle (MVP)

### Session Model

STORM measurements are **server-managed sessions** that hold a risk assessment's
V-factor vector, hierarchy structure, and modifiers. The stateless computation
functions (RSK/VM, IAP) remain available independently — the measurement
lifecycle builds on top of them.

| Operation | Endpoint | Description |
|-----------|----------|-------------|
| Create | `POST /v1/measurements` | Initialize measurement with hierarchy + config |
| Retrieve | `GET /v1/measurements/:id` | Full hierarchy with computed aggregates |
| Delete | `DELETE /v1/measurements/:id` | Remove measurement and all associated data |
| Add factor | `POST /v1/measurements/:id/factors` | Add V-factor at a hierarchy position |
| List factors | `GET /v1/measurements/:id/factors` | All factors with base, modifiers, effective |
| Edit factor | `PATCH /v1/measurements/:id/factors/:fid` | Update value, label, or metadata |
| Remove factor | `DELETE /v1/measurements/:id/factors/:fid` | Remove factor from vector |
| Add modifier | `POST /v1/measurements/:id/factors/:fid/modifiers` | Attach modifier to a factor |
| Remove modifier | `DELETE /v1/measurements/:id/modifiers/:mid` | Detach modifier from its factor |

### Hierarchy Templates

A **hierarchy** defines the grouping structure for V-factors. Factors are always
added at the **leaf** (deepest) level; aggregate measurements roll upward
through each level to the root.

| Template | Levels | Use Case |
|----------|--------|----------|
| `default` | `[items]` | Flat list of vulnerability measurements |
| `basic_questionnaire` | `[questionnaire, section, question]` | Questionnaire-based risk assessment |
| `security_scan` | `[test, horizon, host, finding, annotation]` | Security / penetration testing |

**Custom hierarchies:** provide an array of 1–8 level names instead of a
template name.

Intermediate hierarchy nodes are **created automatically** when a factor
specifies a `path` array (one label per grouping level above the leaf).
With the default single-level hierarchy, no `path` is needed.

**Example — security_scan (5 levels):**

```
POST /v1/measurements/:id/factors
{
  "path": ["External", "Internet", "192.168.1.117", "SQL Injection"],
  "value": 1.0,
  "label": "HTTP endpoint on port 80"
}
```

Creates nodes: test/External → horizon/Internet → host/192.168.1.117 →
finding/SQL Injection, with the annotation factor at the leaf.

### Modifier Taxonomy

> **⚠ CONFIDENTIAL — compound modifier aggregation uses the proprietary RSK function.**

A **modifier** is any adjustment applied to a V-factor's base measurement.
Modifiers are classified along two axes:

**Effect** (direction of adjustment):
- `attenuate` — reduces the effective measurement (risk mitigation)
- `amplify` — increases the effective measurement (risk aggravation; reserved for future)

**Application** (how multiple modifiers of the same type combine):
- `direct` — each modifier multiplies independently
- `compound` — values are aggregated using the RSK function, then applied once

**Default modifier types:**

| Type | Effect | Application | Semantics |
|------|--------|-------------|-----------|
| `confidence` | attenuate | direct | Probability the vulnerability exists |
| `control` | attenuate | compound | Mitigation effectiveness (aggregated) |

**Effective measurement computation (CONFIDENTIAL):**

$$\text{effective} = \text{base} \times \prod(\text{direct attenuations}) \times (1 - \text{compound attenuation aggregate})$$

**Example:**

| Component | Value | Notes |
|-----------|-------|-------|
| Base measurement | 1.0 | Input V-factor |
| Confidence | 0.75 | Direct attenuation |
| Controls | [0.4, 0.3, 0.2] | Compound: $0.4 + 0.3/4 + 0.2/16 = 0.4875$ |
| **Effective** | **0.384375** | $1.0 \times 0.75 \times (1 - 0.4875)$ |

**Dual output representation:**

| View | Base | Adjustment | Effective |
|------|------|------------|-----------|
| Probability | 1.0 | 0.615625 | 0.384375 |
| Scaled ($v_{max}=100$) | 100 | 62 | 38 |

### Persistence Policy

- Measurements are stored in **SQLite** (file-based, no external DB dependency)
- Each measurement has a `ttl` (default: 86 400 s = 24 h, max: 604 800 s = 7 d)
- Expired measurements are **purged automatically**
- `DELETE` removes immediately
- Consumers should export data via `GET /v1/measurements/:id` before expiry
- The server **must not promise permanent storage** — this is a computation API,
  not a database; consumers are responsible for persisting their own data

---

## Engine Functions

> **⚠ CONFIDENTIAL — The `rskAggregate` output column reveals the proprietary formula.
> Do not reproduce this table in public-facing documentation.**

All engine functions are **pure** (no side effects, no I/O):

| Function | Input | Output |
|----------|-------|--------|
| `rskAggregate` | measurements[], scalingBase | ceil(Σ V_j / a^j) |
| `rskNormalize` | raw, maximumValue | min(100, raw/max × 100) |
| `rskRate` | normalized, thresholds[], labels[] | rating string |
| `ham533` | history, access, means | { probability, impact } |
| `crve3` | capabilities, resources, visibility, confidentiality, integrity, availability | { exposure, basic, cia } |
| `scep` | controls[] (each: implemented, correction) | { efficacy } |
| `assetValuation` | classification, users, highValueData[] | { assetValue, assetShare } |
| `singleLossExpectancy` | asset, vulnerability, controlEfficacy | SLE |
| `distributedLossExpectancy` | asset, threat, vulnerability, controlEfficacy | DLE |
| `nistRiskMatrix` | likelihood/impact (or components/IAPs), breakpoints | { likelihood, impact, risk, matrix } |
| `computeScore` | measurements[], configuration | { raw, normalized, rating } |

---

## API Versioning

- URL prefix: `/v1/` (e.g., `/v1/rsk/vm/aggregate`)
- Versioning is mandatory for gateway compatibility
- Breaking changes require a new version (`/v2/`)

---

## Request/Response Conventions

- All request bodies are JSON
- All responses are JSON with consistent envelope: `{ data, meta }` or `{ error }`
- HTTP status codes follow REST conventions (200, 201, 400, 401, 403, 422, 500)
- Computation endpoints are **POST** (they accept input, not idempotent lookup)
- Configuration/health endpoints are **GET**
- All numeric outputs use full precision unless `precision` parameter is specified

---

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "scalingBase must be a positive number",
    "details": [
      { "field": "scalingBase", "constraint": "positive", "received": -1 }
    ]
  }
}
```

---

## Gateway Compatibility

The API is structured for deployment behind cloud API gateways:

### AWS API Gateway
- Lambda proxy integration or ECS/Fargate target
- `x-request-id` header propagation
- CORS preflight handled at gateway level
- API key + usage plan for rate limiting

### Azure API Management
- OAuth 2.0 token validation policy
- Rate limiting and quota policies
- Backend pool targeting Express service

### GCP Cloud Endpoints / API Gateway
- OpenAPI spec deployment
- Service account authentication
- Cloud Run backend

### Common Patterns
- Health check at `GET /health` (no auth required)
- OpenAPI spec at `GET /v1/openapi.yaml` (no auth required)
- All computation endpoints require bearer token
- Request ID propagation via `x-request-id` header
- CORS headers set at gateway, not in application code

---

## References

- [Core Project Patterns](../../core.rescor.net/docs/PROJECT-PATTERNS.md)
- [API Reference](API-REFERENCE.md)
- [Security](SECURITY.md)
- [OpenAPI Spec](openapi.yaml)

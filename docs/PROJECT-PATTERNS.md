# STORM API — Project Patterns

> Cross-project patterns (secrets, code style, CLI) are in
> **[core.rescor.net/docs/PROJECT-PATTERNS.md](../../core.rescor.net/docs/PROJECT-PATTERNS.md)**.
> This file contains STORM API-specific content only.

---

## Architecture

| Layer      | Stack                          | Port |
|------------|--------------------------------|------|
| API        | Express 4 + @rescor/core-*     | 3200 |
| Runtime    | Node 18+ (ESM `.mjs`)         | —    |
| Auth       | OAuth 2.0 / OIDC / JWT / mTLS | —    |
| Gateway    | AWS API Gateway / Azure APIM / GCP Cloud Endpoints | — |

### Stateless Engine Design

The STORM API is a **pure computation service** — no database, no persistent state.
Every request carries all necessary inputs; every response carries complete outputs.
This design enables:

- Horizontal scaling (any instance can serve any request)
- API Gateway caching and rate limiting
- Easy integration testing (no setup/teardown)
- Multiple consumers sharing one engine (ASR, SRA, TC, etc.)

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
| SCEP | Control $C$ | controls[] (each: implemented 0–1, correction 0–1) | efficacy |
| AsrValuation | Asset value $A$ | Classification(1–3), Users(1–5), HighValueData(6 categories) | assetValue |

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

## Engine Functions

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

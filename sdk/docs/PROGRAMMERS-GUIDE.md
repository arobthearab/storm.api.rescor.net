# STORM SDK — Programmer's Guide (Node.js)

> A practical, end-to-end guide for integrating the STORM Risk Computation
> Engine into Node.js applications. Covers installation, authentication,
> every builder pattern, dual output interpretation, batch operations,
> error handling, and production deployment recipes.

**SDK Version:** 0.1.0  
**Runtime:** Node.js 18+  
**Transport:** Native `fetch` — zero external HTTP dependencies

---

## Table of Contents

1. [Installation](#1-installation)
2. [Quick Start](#2-quick-start)
3. [Client Configuration](#3-client-configuration)
4. [Authentication](#4-authentication)
5. [Understanding Dual Output](#5-understanding-dual-output)
6. [RSK/VM — Vulnerability Mode](#6-rskvm--raw--scaled-computation)
7. [RSK/RM — Risk Mode](#7-rskrm--risk-mode)
8. [IAP — Independent Ancillary Processes](#8-iap--independent-ancillary-processes)
9. [NIST 800-30 Risk Matrix](#9-nist-800-30-risk-matrix)
10. [Measurement Sessions](#10-measurement-sessions)
11. [Factors](#11-factors)
12. [Modifiers](#12-modifiers)
13. [Batch Operations](#13-batch-operations)
14. [Value Objects](#14-value-objects)
15. [Error Handling](#15-error-handling)
16. [Recipes](#16-recipes)
17. [API Coverage Matrix](#17-api-coverage-matrix)
18. [Appendix — Mathematical Reference](#appendix--mathematical-reference)

---

## 1. Installation

```bash
npm install @rescor/storm-sdk
```

The SDK is a pure ESM package. Import the `Storm` facade and any types you need:

```javascript
import { Storm } from '@rescor/storm-sdk'
```

Or import specific exports directly:

```javascript
import {
  Storm,
  StormClient,
  Factor,
  Modifier,
  FactorBatch,
  FactorBatchResult,
  StormError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
  NetworkError
} from '@rescor/storm-sdk'
```

---

## 2. Quick Start

```javascript
import { Storm } from '@rescor/storm-sdk'

// In dev mode (PHASE=development), no token is required.
// In production, supply a token or tokenProvider (see §4).
const storm = new Storm({ baseUrl: 'http://localhost:3200' })

// Verify connectivity
const health = await storm.health()
console.log(health.status)  // "healthy"

// Compute a composite risk score from a vector of findings
const result = await storm.rsk().vm()
  .measurements([80, 60, 45, 30])
  .score()

console.log(result.raw.aggregate)  // 0.8573... (full precision)
console.log(result.scaled.aggregate)       // 86        (ceiling-rounded RU)
console.log(result.rating)                 // "Very High"
```

---

## 3. Client Configuration

The `Storm` constructor accepts a single options object:

```javascript
const storm = new Storm({
  baseUrl: 'https://storm.example.com',   // API base URL (no trailing slash)
  token: 'eyJhbGci...',                   // Static bearer token
  tokenProvider: async () => refreshJwt(), // OR: dynamic token callback
  timeout: 15_000,                        // Request timeout (ms), default: 30000
  headers: { 'X-Trace-Id': 'abc123' },    // Extra headers merged into every request
  fetch: customFetch                       // Custom fetch (for testing)
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `http://localhost:3200` | API root URL |
| `token` | `string` | — | Static JWT token |
| `tokenProvider` | `async () => string` | — | Called before each request for a fresh token |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `headers` | `object` | `{}` | Extra headers for every request |
| `fetch` | `Function` | `globalThis.fetch` | Custom fetch implementation |

When both `token` and `tokenProvider` are supplied, `tokenProvider` takes
precedence — the static `token` is ignored.

### Direct Client Access

For lower-level control, use `StormClient` directly:

```javascript
import { StormClient } from '@rescor/storm-sdk'

const client = new StormClient({ baseUrl: 'http://localhost:3200' })
const data = await client.post('/v1/rsk/vm/aggregate', {
  measurements: [80, 60, 45]
})
```

The client unwraps the `{ data: ... }` envelope automatically — you receive
the payload directly.

---

## 4. Authentication

### Development Mode (No Token Required)

When the STORM API runs in `development` phase (the default), authentication
is bypassed. A synthetic admin user is injected into every request. No
`Authorization` header is needed:

```javascript
const storm = new Storm({ baseUrl: 'http://localhost:3200' })
// No token — works in dev mode
```

### Static Token

For production or UAT, obtain a Keycloak JWT and pass it at construction:

```javascript
const storm = new Storm({
  baseUrl: 'https://storm.example.com',
  token: 'eyJhbGciOiJSUzI1NiIs...'
})
```

### Dynamic Token Provider

For long-running services where tokens expire, supply a provider function.
The SDK calls it before every request:

```javascript
let cachedToken = null
let expiresAt = 0

async function getToken () {
  const now = Date.now()
  if (cachedToken && now < expiresAt - 30_000) {
    return cachedToken
  }

  const response = await fetch(
    'http://keycloak.example.com/realms/rescor/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'storm-api',
        client_secret: process.env.STORM_CLIENT_SECRET
      })
    }
  )
  const data = await response.json()
  cachedToken = data.access_token
  expiresAt = now + (data.expires_in * 1000)
  return cachedToken
}

const storm = new Storm({
  baseUrl: 'https://storm.example.com',
  tokenProvider: getToken
})
```

### RBAC

The API enforces role-based access control. Tokens must include
realm roles from this set:

| Role | Access |
|------|--------|
| `admin` | All endpoints (implicit grant) |
| `assessor` | All computation + measurement endpoints |
| `reviewer` | Read-only computation (RSK/VM, IAP, NIST) |
| `auditor` | Audit trail and configuration |

A missing or insufficient role produces a `403 Forbidden` →
`AuthorizationError` in the SDK.

---

## 5. Understanding Dual Output

All RSK/VM endpoints return two parallel views of the same measurement:

| View | Key | Rounding | Range (defaults) | Use Case |
|------|-----|----------|------------------|----------|
| **Raw** | `raw` | None (full precision) | 0 – ~1.333 | Downstream computation, chaining |
| **Scaled** | `scaled` | `Math.ceil` | 0 – 134 | Dashboard display, human reporting |

> **These ranges assume the defaults: `scalingBase = 4`, `maximumValue = 100`.**
> The upper bound is derived as `vmax / (1 − 1/a)`. Changing either parameter
> changes the ceiling — for example, `scalingBase = 2` doubles it to ~267.
> If you override these parameters, adjust your display logic and thresholds
> accordingly; the built-in rating scales are calibrated for the defaults.

Example response from `/v1/rsk/vm/aggregate`:

```json
{
  "raw": {
    "aggregate": 0.21640625,
    "upperBound": 1.3333333333333333
  },
  "scaled": {
    "aggregate": 22,
    "upperBound": 134
  },
  "measurements": [20, 5, 5, 5],
  "scalingBase": 4,
  "maximumValue": 100
}
```

### Input-Space Auto-Detection

The API auto-detects whether your inputs are:

- **Raw space** (all values ≤ 1.0): `[0.20, 0.05, 0.05, 0.05]`
- **Scaled space** (any value > 1.0): `[20, 5, 5, 5]`

Both produce identical dual output — use whichever representation your
data source provides:

```javascript
// These produce the same result:
await storm.rsk().vm().measurements([20, 5, 5, 5]).aggregate()
await storm.rsk().vm().measurements([0.20, 0.05, 0.05, 0.05]).aggregate()
// → raw.aggregate = 0.21640625
// → scaled.aggregate = 22
```

### Accessing Dual Values

```javascript
const result = await storm.rsk().vm()
  .measurements([80, 60, 45, 30])
  .score()

// For computation chaining — use raw (full precision)
const rawScore = result.raw.aggregate              // 0.8573...
const normalizedRatio  = result.raw.normalized     // 0.6430...

// For display — use scaled (integer RU)
const displayScore = result.scaled.aggregate   // 86
const displayMax   = result.scaled.upperBound  // 134 (with default scalingBase=4, maximumValue=100)
const ratingLabel  = result.rating             // "Very High"
```

---

## 6. RSK/VM — Raw & Scaled Computation

RSK/VM (Vulnerability Mode) computes composite risk measurements from a vector
of V-factors using a proprietary diminishing-weight geometric series.

Access via `storm.rsk().vm()`:

```javascript
const vm = storm.rsk().vm()
```

### Builder Methods (Chainable)

| Method | Type | Description |
|--------|------|-------------|
| `.measurements(values)` | `number[]` | V-factor vector |
| `.measurement(value)` | `number` | Single value (for `add` and `rate`) |
| `.raw(value)` | `number` | Raw aggregate (for `normalize`) |
| `.scalingBase(value)` | `number` | Decay base, default 4 (must be > 1) |
| `.maximumValue(value)` | `number` | v_max for scaling, default 100 |
| `.scale(value)` | `string` | Rating scale: `'standard'` or `'alternate'` |
| `.thresholds(values)` | `number[]` | Custom rating breakpoints |
| `.labels(values)` | `string[]` | Custom rating labels |
| `.precision(value)` | `number` | Decimal places for normalized output |

### Terminal Methods

Each terminal method sends the built request and returns the unwrapped response.

#### `aggregate()` — Composite Measurement

Computes the diminishing-weight aggregate of a measurement vector.

```javascript
const result = await storm.rsk().vm()
  .measurements([80, 60, 45, 30, 20])
  .scalingBase(4)
  .aggregate()

result.raw.aggregate   // 0.8856... (full precision)
result.raw.upperBound  // 1.3333...
result.scaled.aggregate        // 89 (ceiling-rounded)
result.scaled.upperBound       // 134
result.measurements            // [80, 60, 45, 30, 20] (sorted descending)
```

#### `add()` — Add a Measurement to an Existing Vector

Appends a new V-factor and returns the updated aggregate alongside the previous one.

```javascript
const result = await storm.rsk().vm()
  .measurements([80, 60, 45])
  .measurement(30)
  .add()

result.raw.aggregate          // new aggregate
result.raw.previousAggregate  // before adding 30
result.scaled.aggregate               // ceiling-rounded new
result.scaled.previousAggregate       // ceiling-rounded previous
```

#### `normalize()` — Scale Raw to 0–100

Normalizes a raw aggregate value relative to the theoretical upper bound.

```javascript
const result = await storm.rsk().vm()
  .raw(43)
  .maximumValue(100)
  .scalingBase(4)
  .normalize()

result.raw.normalized  // 0.3225 (proportion of theoretical max)
result.raw.upperBound  // 1.3333...
result.scaled.normalized       // 32.09
result.scaled.upperBound       // 134
```

#### `rate()` — Qualitative Rating

Maps a score to a human-readable risk label.

```javascript
// Standard scale: Low, Moderate, High, Very High, Extreme
const result = await storm.rsk().vm()
  .measurement(75)
  .rate()

result.rating      // "Very High"
result.thresholds  // [25, 50, 75, 100]
result.labels      // ["Low", "Moderate", "High", "Very High", "Extreme"]
```

```javascript
// Alternate scale: Low, Medium, High
const result = await storm.rsk().vm()
  .measurement(45)
  .scale('alternate')
  .rate()

result.rating  // "Medium"
```

```javascript
// Custom thresholds
const result = await storm.rsk().vm()
  .measurement(65)
  .thresholds([30, 60, 90])
  .labels(['Green', 'Yellow', 'Red', 'Critical'])
  .rate()

result.rating  // "Red"
```

#### `score()` — Full Pipeline

Combines aggregate → normalize → rate in one request.

```javascript
const result = await storm.rsk().vm()
  .measurements([80, 60, 40])
  .scalingBase(4)
  .maximumValue(100)
  .score()

result.raw.aggregate    // 0.8573...
result.raw.normalized   // 0.6430...
result.raw.upperBound   // 1.3333...
result.scaled.aggregate         // 86
result.scaled.normalized        // 64.18
result.scaled.upperBound        // 134
result.rating                   // "Very High"
result.measurements             // [80, 60, 40]
```

#### `limit()` — Theoretical Upper Bound

Returns the theoretical maximum aggregate for the given configuration.

```javascript
const result = await storm.rsk().vm()
  .maximumValue(100)
  .scalingBase(4)
  .limit()

result.raw.upperBound  // 1.3333... (vmax / (1 - 1/a))
result.scaled.upperBound       // 134
```

---

## 7. RSK/RM — Risk Mode

RSK/RM computes risk-adjusted values by incorporating asset value,
threat potential, vulnerability exposure, and control efficacy.

Access via `storm.rsk().rm()`:

```javascript
const rm = storm.rsk().rm()
```

### Builder Methods (Chainable)

| Method | Type | Description |
|--------|------|-------------|
| `.riskFactors(factors)` | `object[]` | Array of risk factor objects |
| `.assetValue(value)` | `number` | Asset value (0–1) |
| `.threatPotential(value)` | `number` | Threat likelihood (0–1) |
| `.vulnerability(value)` | `number` | Vulnerability exposure (0–1) |
| `.controlEfficacy(value)` | `number` | Control strength (0–1) |
| `.scalingBase(value)` | `number` | Decay base |
| `.maximumValue(value)` | `number` | v_max |
| `.asset(value)` | `number\|object` | Direct or IAP asset |
| `.threat(value)` | `number\|object` | Direct or IAP threat |
| `.control(value)` | `number\|object` | Direct or IAP control |

### Terminal Methods

#### `adjust()` — Risk-Adjust a Factor Vector

```javascript
const result = await storm.rsk().rm()
  .riskFactors([
    { baseMeasurement: 0.8, confidence: 0.9 },
    { baseMeasurement: 0.6, confidence: 0.7 },
    { baseMeasurement: 0.4, confidence: 0.95 }
  ])
  .adjust()
```

#### `sle()` — Single Loss Expectancy

```javascript
const result = await storm.rsk().rm()
  .assetValue(0.85)
  .vulnerability(0.70)
  .controlEfficacy(0.35)
  .sle()
```

#### `dle()` — Distributed Loss Expectancy

```javascript
const result = await storm.rsk().rm()
  .assetValue(0.85)
  .threatPotential(0.60)
  .vulnerability(0.70)
  .controlEfficacy(0.35)
  .dle()
```

#### `assess()` — Full Risk Assessment with IAP Resolution

Pass numbers directly or IAP descriptor objects — the API resolves them:

```javascript
const result = await storm.rsk().rm()
  .asset({ sensitivity: 0.9, criticality: 0.8 })           // IAP asset-valuation
  .threat({ capability: 0.8, intent: 0.7, targeting: 0.6 }) // IAP HAM533
  .vulnerability(0.70)
  .control({ controls: [{ efficacy: 0.6 }, { efficacy: 0.4 }] }) // IAP SCEP
  .assess()
```

---

## 8. IAP — Independent Ancillary Processes

IAP processes are standalone computation models whose outputs feed into
RSK/RM as inputs. Access via `storm.iap()`:

### HAM533 — Threat Probability

Hostile Actor Model: threat = (H × A × M) / 45, factors max 5-3-3.

```javascript
const result = await storm.iap().threat({
  history: 3,
  access: 2,
  means: 2
})
// result.probability = 0.2667, result.impact = 0.4444
```

To use a non-default model, pass `model`:

```javascript
const result = await storm.iap().threat({ model: 'ham533', history: 3, access: 2, means: 2 })
```

### CRVE3 — Vulnerability Exposure

Capabilities, Resources, Visibility + CIA exposure:

```javascript
const result = await storm.iap().vulnerability({
  capabilities: 2,
  resources: 2,
  visibility: 2,
  confidentiality: 2,
  integrity: 1,
  availability: 2
})
// result.exposure = 0.2222
```

### SCEP — Control Efficacy

Security Control Efficacy Profile:

```javascript
const result = await storm.iap().control({
  controls: [
    { implemented: 0.75, correction: 0.50 },
    { implemented: 0.90, correction: 0.80 }
  ]
})
// result.efficacy = 0.5563
```

### Asset Valuation

```javascript
const result = await storm.iap().asset({
  classification: 2,
  users: 3,
  highValueData: [true, false, true, false, true, false]
})
// result.assetValue = 0.2647
```

### Transform Discovery

```javascript
const transforms = await storm.iap().transforms()
// Returns all registered transforms with domains, models, and factor definitions
```

---

## 9. NIST 800-30 Risk Matrix

Compute a NIST 800-30 risk level from likelihood and impact:

```javascript
const result = await storm.nist().riskMatrix({
  likelihood: 'High',
  impact: 'Moderate'
})
```

The 5×5 matrix supports qualitative levels:
`Very Low`, `Low`, `Moderate`, `High`, `Very High`.

---

## 10. Measurement Sessions

Measurement sessions are server-side stateful containers for building up
a risk profile incrementally. They store V-factors in a hierarchy,
apply modifiers, and compute rolling aggregates.

### Lifecycle

```
Create → Add Factors → Attach Modifiers → Get (with aggregates) → Delete
```

### Create

```javascript
const measurement = await storm.measurement()
  .name('Q1 2026 Penetration Test')
  .hierarchy('security_scan')       // or 'default', 'basic_questionnaire', or custom array
  .scalingBase(4)
  .maximumValue(100)
  .ttl(86400)                       // 24 hours (max: 604800 = 7 days)
  .metadata({ engagement: 'PEN-2026-Q1' })
  .create()

console.log(measurement.id)           // "msr_a1b2c3d4e5f67890..."
console.log(measurement.expiresAt)    // ISO 8601 expiration timestamp
```

### Hierarchy Templates

| Template | Levels |
|----------|--------|
| `default` | Category → Subcategory → Item |
| `basic_questionnaire` | Domain → Question |
| `security_scan` | Scope → Network → Host → Finding |
| Custom array | Your own level names |

```javascript
// Custom hierarchy
const m = await storm.measurement()
  .name('Custom Assessment')
  .hierarchy(['Business Unit', 'Department', 'System', 'Control Gap'])
  .create()
```

### Retrieve

```javascript
const session = storm.measurement(measurement.id)
const full = await session.get()

full.id              // measurement ID
full.name            // "Q1 2026 Penetration Test"
full.factorCount     // 47
full.aggregate       // { raw: { base, adjustment, effective }, scaled: { ... } }
full.tree            // hierarchy tree with aggregates at each node
full.hierarchy       // { template: 'security_scan', levels: [...] }
full.configuration   // { scalingBase: 4, maximumValue: 100 }
```

### Delete

```javascript
const deleted = await session.delete()  // true
```

---

## 11. Factors

Factors are the atomic risk observations fed into a measurement. Each factor
represents a single finding with a raw value and an optional
hierarchy path.

### Add a Factor

```javascript
const session = storm.measurement(measurementId)

const factor = await session
  .factor()
  .value(0.80)
  .label('SQL Injection — login form')
  .path(['External', 'Internet', '10.0.1.50', 'SQL Injection'])
  .metadata({ cve: 'CVE-2025-1234', cvss: 9.8 })
  .add()

factor.id                               // "fct_a1b2c3d4e5f67890"
factor.measurement.raw.base     // 0.80
factor.measurement.raw.effective // 0.80 (no modifiers yet)
factor.measurement.scaled.base          // 80
```

### List Factors

```javascript
const factors = await session.listFactors()
```

### Update a Factor

```javascript
const updated = await session.updateFactor(factorId, {
  value: 0.65,
  label: 'Updated severity'
})
```

### Delete a Factor

```javascript
await session.deleteFactor(factorId)  // true
```

---

## 12. Modifiers

Modifiers adjust a factor's effective value. They model assessor confidence
and security controls.

### Modifier Algebra

| Type | Application | Effect | Formula |
|------|-------------|--------|---------|
| `confidence` | `direct` | `attenuate` | `value × (1 − modifier)` |
| `control` | `compound` | `attenuate` | Applied multiplicatively after all directs |
| Custom | `direct` or `compound` | `attenuate` or `amplify` | As specified |

Processing order:
1. All `direct` modifiers applied first
2. All `compound` modifiers applied after, multiplicatively chained

### Add Modifiers

```javascript
const session = storm.measurement(measurementId)

// Confidence modifier — assessor is 90% confident
await session
  .modifier(factorId)
  .type('confidence')
  .value(0.90)
  .label('Assessor confidence')
  .add()

// Control modifier — WAF mitigates 40%
await session
  .modifier(factorId)
  .type('control')
  .effect('attenuate')
  .value(0.40)
  .label('WAF')
  .add()

// Amplifying modifier (rare — increases risk)
await session
  .modifier(factorId)
  .type('environmental')
  .effect('amplify')
  .application('direct')
  .value(0.15)
  .label('Internet-facing, no WAF')
  .add()
```

### Delete a Modifier

```javascript
await session.deleteModifier(modifierId)  // true
```

---

## 13. Batch Operations

For high-throughput ingestion (vulnerability scanners, SIEM exports),
the SDK provides two batch mechanisms:

### FactorBatch (Recommended)

Auto-chunks large arrays and submits with bounded parallelism:

```javascript
const session = storm.measurement(measurementId)

// Default: 5,000 factors per chunk, 3 concurrent requests
const batch = session.createBatch()

// Queue individual factors
batch.add({ value: 0.80, label: 'Finding A', path: ['Net', 'Host1', 'A'] })
batch.add({ value: 0.65, label: 'Finding B', path: ['Net', 'Host1', 'B'] })

// Or queue many at once
batch.addAll(findings.map(f => ({
  value: f.probability,
  label: f.title,
  path: f.hierarchyPath,
  metadata: { cve: f.cve },
  modifiers: f.controls.map(c => ({
    type: 'control',
    value: c.efficacy,
    label: c.name
  }))
})))

console.log(batch.size)  // total queued

const result = await batch.submit()
console.log(result.created)     // e.g. 89000
console.log(result.failed)      // e.g. 0
console.log(result.chunks)      // e.g. 18 (89000 / 5000)
console.log(result.isComplete)  // true (all succeeded)
```

Custom chunk size and concurrency:

```javascript
const batch = session.createBatch({
  chunkSize: 2000,
  concurrency: 5
})
```

#### Batch Result Properties

| Property | Type | Description |
|----------|------|-------------|
| `created` | `number` | Successfully created factors |
| `failed` | `number` | Failed factors |
| `errors` | `object[]` | Error details per failed chunk |
| `chunks` | `number` | Total chunks submitted |
| `total` | `number` | `created + failed` |
| `isComplete` | `boolean` | `failed === 0` |
| `isPartial` | `boolean` | `failed > 0 && created > 0` |

### Direct Batch (Low-Level)

Submit a raw factors array without auto-chunking:

```javascript
const result = await session.addFactorsBatch([
  { value: 0.8, label: 'A' },
  { value: 0.6, label: 'B' }
])
```

Submit modifier batches for existing factors:

```javascript
const result = await session.addModifiersBatch([
  { factorId: 'fct_abc...', type: 'control', value: 0.4 },
  { factorId: 'fct_def...', type: 'confidence', value: 0.9 }
])
```

---

## 14. Value Objects

The SDK provides immutable value objects for client-side computation
and inspection.

### Factor

```javascript
import { Factor, Modifier } from '@rescor/storm-sdk'

const factor = new Factor({
  id: 'fct_a1b2c3d4e5f67890',
  value: 0.80,
  label: 'SQL Injection',
  path: ['External', 'Internet', '10.0.1.50'],
  modifiers: [
    { id: 'mod_001', type: 'confidence', effect: 'attenuate', application: 'direct', value: 0.90 },
    { id: 'mod_002', type: 'control', effect: 'attenuate', application: 'compound', value: 0.40 }
  ]
})

factor.value           // 0.80 (base)
factor.effectiveValue  // computed: base × (1 - 0.90) × (1 - 0.40) = 0.048
factor.modifiers       // [Modifier, Modifier]
factor.toJSON()        // plain object for serialization

// Factor is frozen — mutations throw TypeError
factor.value = 0.5     // TypeError: Cannot assign to read only property
```

### Modifier

```javascript
const mod = new Modifier({
  id: 'mod_abc',
  type: 'control',
  effect: 'attenuate',
  application: 'compound',
  value: 0.40,
  label: 'WAF'
})

mod.type         // "control"
mod.effect       // "attenuate"
mod.application  // "compound"
mod.value        // 0.40
```

---

## 15. Error Handling

All SDK errors extend `StormError`. Use `instanceof` checks for
programmatic handling:

```javascript
import {
  Storm,
  StormError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
  NetworkError
} from '@rescor/storm-sdk'

try {
  await storm.measurement('msr_nonexistent').get()
} catch (error) {
  if (error instanceof NotFoundError) {
    // 404 — measurement expired or doesn't exist
    console.log(error.message)  // "Measurement not found"
    console.log(error.code)     // "NOT_FOUND"
    console.log(error.status)   // 404
  } else if (error instanceof ValidationError) {
    // 400 — bad request body
    console.log(error.details)  // structured validation errors
  } else if (error instanceof AuthenticationError) {
    // 401 — missing or invalid token
  } else if (error instanceof AuthorizationError) {
    // 403 — valid token but insufficient role
  } else if (error instanceof ServerError) {
    // 5xx — server failure
  } else if (error instanceof NetworkError) {
    // DNS failure, timeout, connection refused
    console.log(error.cause)  // underlying error
  }
}
```

### Error Hierarchy

```
StormError (base)
├── ValidationError      (400)
├── AuthenticationError  (401)
├── AuthorizationError   (403)
├── NotFoundError        (404)
├── ServerError          (5xx)
└── NetworkError         (no HTTP — DNS, timeout, etc.)
```

### Error Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable description |
| `code` | `string` | Machine code: `VALIDATION_ERROR`, `UNAUTHORIZED`, etc. |
| `status` | `number` | HTTP status (0 for network errors) |
| `details` | `any` | Optional structured details (validation errors, etc.) |

---

## 16. Recipes

### Security Scanner Integration

Ingest a Nessus/Qualys/Burp export and produce a scored risk profile:

```javascript
import { Storm } from '@rescor/storm-sdk'
import { readFile } from 'node:fs/promises'

const storm = new Storm({
  baseUrl: 'https://storm.example.com',
  tokenProvider: getToken
})

// 1. Create measurement session
const measurement = await storm.measurement()
  .name('Nessus Scan — 2026-Q1')
  .hierarchy('security_scan')
  .ttl(86400)
  .create()

const session = storm.measurement(measurement.id)

// 2. Batch-load findings
const scanData = JSON.parse(await readFile('nessus-export.json', 'utf8'))
const batch = session.createBatch({ chunkSize: 5000, concurrency: 3 })

for (const finding of scanData.findings) {
  batch.add({
    value: finding.cvss / 10,     // CVSS 0-10 → raw 0-1
    label: finding.title,
    path: [finding.scope, finding.network, finding.host, finding.plugin],
    metadata: { cve: finding.cve, severity: finding.severity }
  })
}

const batchResult = await batch.submit()
console.log(`Loaded ${batchResult.created} findings`)

// 3. Retrieve scored measurement
const scored = await session.get()
console.log('Risk aggregate (scaled):', scored.aggregate.scaled.effective)
console.log('Hierarchy:', scored.tree)
```

### Compliance Questionnaire

Map questionnaire answers to V-factors:

```javascript
const measurement = await storm.measurement()
  .name('ISO 27001 Readiness')
  .hierarchy('basic_questionnaire')
  .create()

const session = storm.measurement(measurement.id)

// Each "No" answer becomes a V-factor
const gaps = [
  { domain: 'A.5 Information Security Policies', question: 'Formal policy document?', risk: 0.7 },
  { domain: 'A.6 Organization', question: 'Security roles assigned?', risk: 0.5 },
  { domain: 'A.8 Asset Management', question: 'Asset inventory complete?', risk: 0.85 }
]

for (const gap of gaps) {
  await session
    .factor()
    .value(gap.risk)
    .label(gap.question)
    .path([gap.domain, gap.question])
    .add()
}

const result = await session.get()
console.log(`Compliance risk: ${result.aggregate.scaled.effective}`)
```

### Risk Dashboard with Periodic Refresh

```javascript
import { Storm, NetworkError } from '@rescor/storm-sdk'

const storm = new Storm({
  baseUrl: 'https://storm.example.com',
  tokenProvider: getToken,
  timeout: 10_000
})

async function computeDashboardMetrics (findings) {
  const score = await storm.rsk().vm()
    .measurements(findings.map(f => f.probability))
    .score()

  return {
    overallRisk: score.rating,
    riskScore: score.scaled.aggregate,
    riskRaw: score.raw.aggregate,
    normalizedPercent: score.scaled.normalized,
    theoreticalMax: score.scaled.upperBound,
    findingCount: findings.length
  }
}

// Retry with exponential backoff on network failures
async function withRetry (operation, maxAttempts = 3) {
  let lastError
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!(error instanceof NetworkError)) throw error
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
```

---

## 17. API Coverage Matrix

The SDK covers all STORM API endpoints:

### Session Endpoints (Stateful)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/measurements` | `storm.measurement().create()` |
| `GET` | `/v1/measurements/:id` | `storm.measurement(id).get()` |
| `DELETE` | `/v1/measurements/:id` | `storm.measurement(id).delete()` |
| `POST` | `/v1/measurements/:id/factors` | `session.factor().add()` |
| `GET` | `/v1/measurements/:id/factors` | `session.listFactors()` |
| `PATCH` | `/v1/measurements/:id/factors/:fid` | `session.updateFactor(fid, fields)` |
| `DELETE` | `/v1/measurements/:id/factors/:fid` | `session.deleteFactor(fid)` |
| `POST` | `/v1/measurements/:id/factors/:fid/modifiers` | `session.modifier(fid).add()` |
| `DELETE` | `/v1/measurements/:id/modifiers/:mid` | `session.deleteModifier(mid)` |

### Batch Endpoints (High-Throughput)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/measurements/:id/factors/batch` | `session.createBatch().submit()` or `session.addFactorsBatch(factors)` |
| `POST` | `/v1/measurements/:id/modifiers/batch` | `session.addModifiersBatch(modifiers)` |

### RSK/VM (Stateless)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/rsk/vm/aggregate` | `storm.rsk().vm().aggregate()` |
| `POST` | `/v1/rsk/vm/add` | `storm.rsk().vm().add()` |
| `POST` | `/v1/rsk/vm/normalize` | `storm.rsk().vm().normalize()` |
| `POST` | `/v1/rsk/vm/rate` | `storm.rsk().vm().rate()` |
| `POST` | `/v1/rsk/vm/score` | `storm.rsk().vm().score()` |
| `POST` | `/v1/rsk/vm/limit` | `storm.rsk().vm().limit()` |

### RSK/RM (Stateless)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/rsk/rm/adjust` | `storm.rsk().rm().adjust()` |
| `POST` | `/v1/rsk/rm/sle` | `storm.rsk().rm().sle()` |
| `POST` | `/v1/rsk/rm/dle` | `storm.rsk().rm().dle()` |
| `POST` | `/v1/rsk/rm/assess` | `storm.rsk().rm().assess()` |

### IAP (Stateless)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/iap/threat` | `storm.iap().threat(input)` |
| `POST` | `/v1/iap/vulnerability` | `storm.iap().vulnerability(input)` |
| `POST` | `/v1/iap/control` | `storm.iap().control(input)` |
| `POST` | `/v1/iap/asset` | `storm.iap().asset(input)` |
| `GET`  | `/v1/iap/transforms` | `storm.iap().transforms()` |

### NIST (Stateless)

| Method | Path | SDK Method |
|--------|------|------------|
| `POST` | `/v1/nist/risk-matrix` | `storm.nist().riskMatrix(input)` |

### Infrastructure

| Method | Path | SDK Method |
|--------|------|------------|
| `GET` | `/health` | `storm.health()` |

---

## Appendix — Mathematical Reference

### RSK Aggregate (Diminishing-Weight Series)

Given a sorted (descending) measurement vector $[V_0, V_1, \ldots, V_{n-1}]$
and scaling base $a$:

$$\text{aggregate} = \sum_{i=0}^{n-1} \frac{V_i}{a^i}$$

The largest measurement contributes fully ($a^0 = 1$), each successive
measurement contributes $\frac{1}{a}$ of the previous one's weight.

### Upper Bound (Geometric Series Limit)

When every $V_i = v_\text{max}$, the series converges to:

$$\text{upperBound} = \frac{v_\text{max}}{1 - \frac{1}{a}}$$

For $v_\text{max} = 100$, $a = 4$ (the defaults): upper bound = $\frac{100}{0.75} = 133.\overline{3}$

> **Both $v_\text{max}$ and $a$ are caller-configurable.** The concrete values
> 134 (scaled) and ~1.333 (raw) used throughout this guide assume the
> defaults. Overriding `scalingBase` or `maximumValue` changes the theoretical
> ceiling — for instance, $a = 2$ yields an upper bound of $2 \times v_\text{max}$.
> The built-in rating thresholds and label scales are calibrated for the
> default parameters; if you change them, you should supply custom thresholds
> and labels via `.thresholds()` and `.labels()` as well.

### Scaling Base Effect

The scaling base $a$ controls only the decay rate:

| $a$ | Decay Factor | UB (as multiple of $v_\text{max}$) |
|-----|--------------|-------------------------------------|
| 2 | $\frac{1}{2}$ | 2.000× |
| 4 | $\frac{1}{4}$ | 1.333× |
| 10 | $\frac{1}{10}$ | 1.111× |

Larger $a$ → faster decay → composite stays closer to the single
largest measurement.

### Dual Output Derivation

For inputs in **scaled space** (values 0–`maximumValue`):

$$p_\text{aggregate} = \frac{\text{rawAccumulator}}{\text{maximumValue}}$$

For inputs in **raw space** (all values ≤ 1.0):

$$p_\text{aggregate} = \text{rawAccumulator}$$

Then the scaled view is:

$$s_\text{aggregate} = \lceil p_\text{aggregate} \times \text{maximumValue} \rceil$$

Upper bounds are always vmax-based (not dependent on observed values):

$$p_\text{upperBound} = \frac{1}{1 - \frac{1}{a}} \qquad s_\text{upperBound} = \left\lceil\frac{\text{maximumValue}}{1 - \frac{1}{a}}\right\rceil$$

---

## References

- [API Reference](../../docs/API-REFERENCE.md) — endpoint documentation
- [Authentication Guide](../../docs/AUTHENTICATION.md) — token acquisition, RBAC
- [Security Architecture](../../docs/SECURITY.md) — mTLS, gateway, rate limiting
- [OpenAPI Spec](../../docs/openapi.yaml) — machine-readable API definition
- [SDK Contract](SDK-CONTRACT.md) — cross-language portability specification
- [SDK Demo](../examples/demo.mjs) — runnable 11-step demonstration

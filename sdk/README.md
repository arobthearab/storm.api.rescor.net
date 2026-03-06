# @rescor/storm-sdk

Node.js SDK for the [STORM Risk Computation Engine API](../docs/API-REFERENCE.md).

Uses native `fetch` (Node 18+) — zero external HTTP dependencies.

## Install

```bash
npm install @rescor/storm-sdk
```

## Quick Start

```javascript
import { Storm } from '@rescor/storm-sdk'

const storm = new Storm({ baseUrl: 'http://localhost:3200' })

// Health check
const health = await storm.health()

// Create a measurement session
const measurement = await storm.measurement()
  .name('Web Application Scan')
  .hierarchy('security_scan')
  .create()

// Add a V-factor
const factor = await storm.measurement(measurement.id)
  .factor()
  .value(0.80)
  .label('SQL Injection')
  .path(['External', 'Internet', '192.168.1.1', 'SQL Injection'])
  .add()

// Add a modifier
await storm.measurement(measurement.id)
  .modifier(factor.id)
  .type('confidence')
  .value(0.75)
  .add()

// Retrieve full measurement with aggregates
const full = await storm.measurement(measurement.id).get()
console.log(full.aggregate.scaled.effective) // e.g. 38

// Batch factor submission (89K findings in ~18 requests)
const batch = storm.measurement(measurement.id).createBatch()
findings.forEach(f => batch.add({
  value: f.probability,
  path: f.hierarchy,
  label: f.title,
  modifiers: f.controls.map(c => ({ type: 'control', value: c.efficacy }))
}))
const batchResult = await batch.submit()
console.log(batchResult.created) // e.g. 89000

// Stateless RSK/VM computation
const score = await storm.rsk().vm()
  .measurements([80, 60, 40])
  .score()
console.log(score.rating) // e.g. "High"

// IAP computation
const threat = await storm.iap().ham533({
  capability: 0.8, intent: 0.7, targeting: 0.6
})

// NIST risk matrix
const risk = await storm.nist().riskMatrix({
  likelihood: 'High', impact: 'Moderate'
})
```

## Authentication

```javascript
// Static token
const storm = new Storm({ token: 'your-jwt-token' })

// Dynamic token provider (called before each request)
const storm = new Storm({
  tokenProvider: async () => {
    const token = await refreshOidcToken()
    return token
  }
})
```

## Error Handling

```javascript
import { Storm, NotFoundError, ValidationError } from '@rescor/storm-sdk'

try {
  await storm.measurement('msr_nonexistent').get()
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Measurement expired or not found')
  } else if (error instanceof ValidationError) {
    console.log('Bad input:', error.details)
  }
}
```

## API Coverage

All 24 STORM API endpoints are covered:

- **Measurements** — create, get, delete
- **Factors** — add, list, update, delete
- **Modifiers** — add, delete
- **Batch** — factors/batch, modifiers/batch (with SDK auto-chunking: 5K items, 3 concurrent)
- **RSK/VM** — aggregate, add, normalize, rate, score, limit
- **RSK/RM** — adjust, sle, dle, assess
- **IAP** — ham533, crve3, scep, asset-valuation
- **NIST** — risk-matrix
- **Health** — health check

## Value Objects

```javascript
import { Factor, Modifier } from '@rescor/storm-sdk'

// Factor wraps API response data with computed effectiveValue
const factor = new Factor(apiResponse)
console.log(factor.effectiveValue) // Base value with all modifiers applied

// FactorBatch auto-chunks and parallelizes large submissions
import { FactorBatch } from '@rescor/storm-sdk'
const batch = new FactorBatch(client, measurementId, { chunkSize: 5000, concurrency: 3 })
batch.addAll(factors)
const result = await batch.submit()
```

## Cross-Language Portability

See [docs/SDK-CONTRACT.md](docs/SDK-CONTRACT.md) for the behavioral contract
that any STORM SDK implementation must follow.

## License

UNLICENSED — proprietary to RESCOR LLC.

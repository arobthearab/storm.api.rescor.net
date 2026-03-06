# STORM SDK Contract

> Cross-language portability specification for STORM API client implementations.

This document defines the behavioral contract that any STORM SDK must follow,
regardless of implementation language (Node.js, Python, Java, Go, Rust, etc.).

---

## Transport Layer

### HTTP Client

- HTTP/1.1 minimum; HTTP/2 recommended where available.
- All requests use JSON (`Content-Type: application/json`).
- Timeouts must be configurable (default: 30 seconds).
- Connection failures must surface as a typed `NetworkError`.

### Authentication

- Bearer token authentication: `Authorization: Bearer <token>`.
- SDKs must support both:
  1. **Static token** — set once at construction time.
  2. **Token provider** — a callback/function invoked before each request for dynamic tokens.
- When no token is configured, omit the `Authorization` header entirely.

### User-Agent

Every request must include:
```
User-Agent: @rescor/storm-sdk/<version>
```

Replace `<version>` with the SDK's semantic version and adjust the prefix for
the target language (e.g. `rescor-storm-sdk-python/0.1.0`).

---

## Envelope Convention

### Success Responses

All successful responses return:
```json
{ "data": <payload> }
```

SDKs must **unwrap** the envelope automatically — callers should receive `<payload>` directly,
never the full `{ "data": ... }` wrapper.

### 204 No Content

`DELETE` operations return 204 with no body. SDKs must return `true` or the
language equivalent (boolean success).

### Error Responses

All error responses return:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [...]
  }
}
```

The `details` field is optional and may be absent.

---

## Error Hierarchy

SDKs must provide a typed error hierarchy for programmatic handling:

| HTTP Status | Error Class          | Code                |
|-------------|----------------------|---------------------|
| 400         | `ValidationError`    | `VALIDATION_ERROR`  |
| 401         | `AuthenticationError`| `UNAUTHORIZED`      |
| 403         | `AuthorizationError` | `FORBIDDEN`         |
| 404         | `NotFoundError`      | `NOT_FOUND`         |
| 500+        | `ServerError`        | `INTERNAL_ERROR`    |
| Network     | `NetworkError`       | `NETWORK_ERROR`     |

All error classes must extend a common `StormError` base that exposes:
- `message` (string)
- `code` (string)
- `status` (integer — 0 for network errors)
- `details` (optional, any)

---

## ID Format

### Measurement IDs
- Format: `msr_` + 32 lowercase hex digits (full UUIDv4 without dashes)
- Example: `msr_a1b2c3d4e5f67890a1b2c3d4e5f67890`
- Total length: 36 characters

### Child IDs (nodes, factors, modifiers)
- Format: `<prefix>_` + 16 lowercase hex digits (truncated UUIDv4)
- Prefixes: `nod_`, `fct_`, `mod_`
- Example: `fct_a1b2c3d4e5f67890`
- Total length: 20 characters
- Scoped within their parent measurement (unique within set, not globally guaranteed)

---

## Builder Pattern

SDKs should provide a fluent builder interface following these patterns:

### Measurement Lifecycle

```
storm.measurement()           → MeasurementBuilder (create)
storm.measurement(id)         → MeasurementSession (get/delete/factors/modifiers)
storm.measurement(id).factor() → FactorBuilder
storm.measurement(id).modifier(factorId) → ModifierBuilder
```

### Stateless Computation

```
storm.rsk().vm()  → RskVmBuilder  (aggregate/add/normalize/rate/score/limit)
storm.rsk().rm()  → RskRmBuilder  (adjust/sle/dle/assess)
storm.iap()       → IapBuilder    (ham533/crve3/scep/assetValuation)
storm.nist()      → NistBuilder   (riskMatrix)
```

### Builder Method Names

Builder setter methods must:
- Return `this` (or the builder instance) for chaining.
- Use the same names as the JSON fields they set.

Terminal methods (`.create()`, `.add()`, `.aggregate()`, etc.) must:
- Execute the HTTP request.
- Return the unwrapped response data (not the builder).

---

## Endpoint Coverage

Every SDK must support all 22 STORM API endpoints:

### Session Endpoints (stateful)
| Method | Path | Builder Terminal |
|--------|------|------------------|
| POST   | `/v1/measurements` | `MeasurementBuilder.create()` |
| GET    | `/v1/measurements/:id` | `MeasurementSession.get()` |
| DELETE | `/v1/measurements/:id` | `MeasurementSession.delete()` |
| POST   | `/v1/measurements/:id/factors` | `FactorBuilder.add()` |
| GET    | `/v1/measurements/:id/factors` | `MeasurementSession.listFactors()` |
| PATCH  | `/v1/measurements/:id/factors/:fid` | `MeasurementSession.updateFactor()` |
| DELETE | `/v1/measurements/:id/factors/:fid` | `MeasurementSession.deleteFactor()` |
| POST   | `/v1/measurements/:id/factors/:fid/modifiers` | `ModifierBuilder.add()` |
| DELETE | `/v1/measurements/:id/modifiers/:mid` | `MeasurementSession.deleteModifier()` |

### Computation Endpoints (stateless)
| Method | Path | Builder Terminal |
|--------|------|------------------|
| POST   | `/v1/rsk/vm/aggregate` | `RskVmBuilder.aggregate()` |
| POST   | `/v1/rsk/vm/add` | `RskVmBuilder.add()` |
| POST   | `/v1/rsk/vm/normalize` | `RskVmBuilder.normalize()` |
| POST   | `/v1/rsk/vm/rate` | `RskVmBuilder.rate()` |
| POST   | `/v1/rsk/vm/score` | `RskVmBuilder.score()` |
| POST   | `/v1/rsk/vm/limit` | `RskVmBuilder.limit()` |
| POST   | `/v1/rsk/rm/adjust` | `RskRmBuilder.adjust()` |
| POST   | `/v1/rsk/rm/sle` | `RskRmBuilder.sle()` |
| POST   | `/v1/rsk/rm/dle` | `RskRmBuilder.dle()` |
| POST   | `/v1/rsk/rm/assess` | `RskRmBuilder.assess()` |
| POST   | `/v1/iap/ham533` | `IapBuilder.ham533()` |
| POST   | `/v1/iap/crve3` | `IapBuilder.crve3()` |
| POST   | `/v1/iap/scep` | `IapBuilder.scep()` |
| POST   | `/v1/iap/asset-valuation` | `IapBuilder.assetValuation()` |
| POST   | `/v1/nist/risk-matrix` | `NistBuilder.riskMatrix()` |

### Infrastructure Endpoints
| Method | Path | Method |
|--------|------|--------|
| GET    | `/health` | `Storm.health()` |
| GET    | `/v1/openapi.yaml` | (direct HTTP — no builder needed) |

---

## Testing Requirements

- All builders must be testable with a mocked HTTP transport.
- Error mapping must be tested for each status code.
- Network failure handling must be tested (connection refused, timeout).
- No tests should require a running API server.

---

## Versioning

SDKs follow semantic versioning. Major version increments indicate breaking API changes.
Minor versions add new endpoints or builder methods. Patch versions fix bugs.

The SDK version is independent of the API version. The API version is declared in
`/health` (`version` field) and the OpenAPI spec.

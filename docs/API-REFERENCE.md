# STORM API Reference

> Version 1.0.0 — Implements the RSK risk measurement process
> (Paper-RSK-NDA-V9.1, A. T. Robinson, December 2007, NMI LLC).

All measurements are expressed in **Risk Units (RU)**. A larger value indicates greater risk.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local dev | `http://localhost:3200` |
| Production | `https://storm.api.rescor.net` |

## Authentication

All `/v1/*` endpoints require a JWT bearer token:

```
Authorization: Bearer <token>
```

See [AUTHENTICATION.md](AUTHENTICATION.md) for how to obtain and use tokens
(including dev-mode bypass). See [SECURITY.md](SECURITY.md) for OAuth 2.0 /
OIDC / mTLS architecture details.

---

## Health & Configuration

### `GET /health`

No authentication required.

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

### `GET /v1/openapi.yaml`

Returns the OpenAPI specification (YAML). No authentication required.

---

## Measurements — Session Lifecycle

Measurements are server-managed sessions that hold a risk factor vector,
hierarchy structure, and modifiers. Each measurement expires after a configurable
TTL; consumers should export data before expiry.

### Hierarchy Templates

Measurements support configurable hierarchy levels. V-factors are always added at
the **leaf** (deepest) level; aggregates roll upward through each level to the root.

| Template | Levels | Use Case |
|----------|--------|----------|
| `default` | `[items]` | Flat list of vulnerability measurements |
| `basic_questionnaire` | `[questionnaire, section, question]` | Questionnaire-based risk assessment |
| `security_scan` | `[test, horizon, host, finding, annotation]` | Security / penetration testing |

Custom hierarchies: provide an array of 1–8 level names.

### Modifiers

A **modifier** is any adjustment applied to a V-factor's base measurement.
Modifiers are classified by **effect** (direction) and **application** (combination method):

| Type | Effect | Application | Behavior |
|------|--------|-------------|----------|
| `confidence` | `attenuate` | `direct` | Multiplies base by value independently |
| `control` | `attenuate` | `compound` | Multiple controls are aggregated, then applied as `(1 − aggregate)` |

Custom modifier types may be created with either effect and application mode.

**Dual output** — every measurement is returned in both representations:

| View | Base | Adjustment | Effective |
|------|------|------------|-----------|
| Raw | 1.0 | 0.615625 | 0.384375 |
| Scaled (v\_max=100) | 100 | 62 | 38 |

---

### `POST /v1/measurements`

Create a new measurement session.

**Request (flat default hierarchy):**

```json
{
  "name": "Web Application Scan"
}
```

**Request (security_scan template with custom TTL):**

```json
{
  "name": "Q3 2026 Penetration Test",
  "hierarchy": "security_scan",
  "scalingBase": 4,
  "maximumValue": 100,
  "ttl": 604800
}
```

**Response (201):**

```json
{
  "data": {
    "id": "msr_a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "name": "Q3 2026 Penetration Test",
    "hierarchy": {
      "template": "security_scan",
      "levels": ["test", "horizon", "host", "finding", "annotation"]
    },
    "configuration": {
      "scalingBase": 4,
      "maximumValue": 100
    },
    "factorCount": 0,
    "createdAt": "2026-03-05T14:00:00.000Z",
    "expiresAt": "2026-03-12T14:00:00.000Z"
  }
}
```

---

### `GET /v1/measurements/{measurementId}`

Retrieve the full measurement with hierarchy tree, all factors, modifiers,
and computed aggregates at every level.

**Response (200):**

```json
{
  "data": {
    "id": "msr_a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "name": "Q3 2026 Penetration Test",
    "hierarchy": {
      "template": "security_scan",
      "levels": ["test", "horizon", "host", "finding", "annotation"]
    },
    "configuration": { "scalingBase": 4, "maximumValue": 100 },
    "aggregate": {
      "raw": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
      "scaled": { "base": 100, "adjustment": 62, "effective": 38 }
    },
    "tree": [
      {
        "id": "nod_ext01",
        "level": "test",
        "label": "External",
        "aggregate": {
          "raw": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
          "scaled": { "base": 100, "adjustment": 62, "effective": 38 }
        },
        "children": [
          {
            "id": "nod_inet01",
            "level": "horizon",
            "label": "Internet",
            "aggregate": { "...": "..." },
            "children": [
              {
                "id": "nod_host01",
                "level": "host",
                "label": "192.168.1.117",
                "aggregate": { "...": "..." },
                "children": [
                  {
                    "id": "nod_find01",
                    "level": "finding",
                    "label": "SQL Injection",
                    "aggregate": { "...": "..." },
                    "factors": [
                      {
                        "id": "fct_001",
                        "nodeId": "nod_find01",
                        "path": ["External", "Internet", "192.168.1.117", "SQL Injection"],
                        "value": 1.0,
                        "label": "HTTP endpoint on port 80",
                        "modifiers": [
                          { "id": "mod_001", "type": "confidence", "effect": "attenuate", "application": "direct", "value": 0.75 },
                          { "id": "mod_002", "type": "control", "effect": "attenuate", "application": "compound", "value": 0.40, "label": "WAF" },
                          { "id": "mod_003", "type": "control", "effect": "attenuate", "application": "compound", "value": 0.30, "label": "Input Validation" },
                          { "id": "mod_004", "type": "control", "effect": "attenuate", "application": "compound", "value": 0.20, "label": "Parameterized Queries" }
                        ],
                        "measurement": {
                          "raw": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
                          "scaled": { "base": 100, "adjustment": 62, "effective": 38 }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "factorCount": 1,
    "createdAt": "2026-03-05T14:00:00.000Z",
    "expiresAt": "2026-03-12T14:00:00.000Z"
  }
}
```

---

### `DELETE /v1/measurements/{measurementId}`

Permanently removes a measurement and all associated data. Returns `204 No Content`.

---

### `POST /v1/measurements/{measurementId}/factors`

Add a V-factor at the leaf level. For multi-level hierarchies, provide a `path`
array (one label per grouping level above the leaf); intermediate nodes are
created automatically. Values > 1.0 are auto-detected as percentages (80 → 0.80).

**Request (flat hierarchy):**

```json
{
  "value": 0.80,
  "label": "SQL Injection"
}
```

**Request (security_scan with path and metadata):**

```json
{
  "path": ["External", "Internet", "192.168.1.117", "SQL Injection"],
  "value": 1.0,
  "label": "HTTP endpoint on port 80",
  "metadata": { "cve": "CVE-2025-1234", "cvss": 9.8 }
}
```

**Response (201):**

```json
{
  "data": {
    "id": "fct_001",
    "nodeId": "nod_find01",
    "path": ["External", "Internet", "192.168.1.117", "SQL Injection"],
    "value": 1.0,
    "label": "HTTP endpoint on port 80",
    "modifiers": [],
    "measurement": {
      "raw": { "base": 1.0, "adjustment": 0.0, "effective": 1.0 },
      "scaled": { "base": 100, "adjustment": 0, "effective": 100 }
    },
    "metadata": { "cve": "CVE-2025-1234", "cvss": 9.8 }
  }
}
```

---

### `GET /v1/measurements/{measurementId}/factors`

List all factors with their modifiers and effective measurements.

**Response (200):**

```json
{
  "data": [
    {
      "id": "fct_001",
      "nodeId": "nod_find01",
      "path": ["External", "Internet", "192.168.1.117", "SQL Injection"],
      "value": 1.0,
      "label": "HTTP endpoint on port 80",
      "modifiers": [
        { "id": "mod_001", "type": "confidence", "effect": "attenuate", "application": "direct", "value": 0.75 },
        { "id": "mod_002", "type": "control", "effect": "attenuate", "application": "compound", "value": 0.40, "label": "WAF" }
      ],
      "measurement": {
        "raw": { "base": 1.0, "adjustment": 0.6, "effective": 0.4 },
        "scaled": { "base": 100, "adjustment": 60, "effective": 40 }
      }
    }
  ]
}
```

---

### `PATCH /v1/measurements/{measurementId}/factors/{factorId}`

Update a factor's value, label, or metadata. Only provided fields are changed.

**Request:**

```json
{
  "value": 0.60,
  "label": "SQL Injection (re-assessed)"
}
```

**Response (200):** Returns the updated `FactorDetail` (same shape as add response).

---

### `DELETE /v1/measurements/{measurementId}/factors/{factorId}`

Remove a factor and all its modifiers. Returns `204 No Content`.

---

### `POST /v1/measurements/{measurementId}/factors/{factorId}/modifiers`

Attach a modifier to a V-factor. Built-in types (`confidence`, `control`) have
preset effect and application modes; custom types default to `attenuate` / `direct`.

**Request (confidence):**

```json
{
  "type": "confidence",
  "value": 0.75
}
```

**Request (control with label):**

```json
{
  "type": "control",
  "value": 0.40,
  "label": "Web Application Firewall"
}
```

**Response (201):** Returns the full updated `FactorDetail` including all modifiers
and the recomputed effective measurement.

---

### `DELETE /v1/measurements/{measurementId}/modifiers/{modifierId}`

Remove a modifier. The factor's effective measurement is recomputed without it.
Returns `204 No Content`.

---

## Batch Endpoints

High-throughput factor and modifier ingestion. Designed for large-scale scans
(89K+ findings) where one-at-a-time submission is impractical.

- Maximum **10,000 items** per request.
- Body limit: **10 MB**.
- Partial-success semantics: valid items are committed, failures are reported.
- SDK auto-chunks at 5,000 items with 3 concurrent requests.

---

### `POST /v1/measurements/{measurementId}/factors/batch`

Add up to 10,000 factors in a single request. Each factor can include
optional inline modifiers.

**Request:**

```json
{
  "factors": [
    {
      "value": 0.8,
      "path": ["External", "web-server", "192.168.1.1", "CVE-2024-001"],
      "label": "SQL Injection",
      "modifiers": [
        { "type": "confidence", "value": 0.9, "effect": "attenuate" },
        { "type": "control", "value": 0.4, "effect": "attenuate" }
      ]
    },
    {
      "value": 0.6,
      "label": "XSS Reflected"
    }
  ]
}
```

**Response (201):**

```json
{
  "data": {
    "created": 2,
    "failed": 0,
    "errors": []
  },
  "meta": {
    "measurementId": "msr_abc123...",
    "submitted": 2,
    "elapsed": "45ms"
  }
}
```

On partial failure:

```json
{
  "data": {
    "created": 1,
    "failed": 1,
    "errors": [
      { "index": 1, "message": "Invalid factor value" }
    ]
  }
}
```

---

### `POST /v1/measurements/{measurementId}/modifiers/batch`

Add up to 10,000 modifiers to existing factors.

**Request:**

```json
{
  "modifiers": [
    { "factorId": "fct_abc123", "type": "confidence", "value": 0.8 },
    { "factorId": "fct_def456", "type": "control", "value": 0.5, "effect": "amplify" }
  ]
}
```

**Response (201):** Same shape as factors/batch — `{ data: { created, failed, errors }, meta }`.

---

## RSK/VM — Vulnerability Mode

RSK/VM computes composite risk measurements from vulnerability vectors.
All assets are assumed to be of equal value, and the threat is assumed to be a
single hostile agent that is 100% effective.

All RSK/VM endpoints return **dual output** — both raw-space
(full precision, no rounding) and scaled (ceiling-rounded integer RU) views:

| View | Rounding | Example aggregate | Example upperBound |
|------|----------|-------------------|-----------------|
| `raw` | None (full precision) | 0.42830... | 1.3333... |
| `scaled` | `Math.ceil` | 43 | 134 |

Raw values are derived by dividing the raw accumulator by `maximumValue`.
Scaled values apply `Math.ceil` for integer RU output.

### Computation Model

The composite measurement is computed using a **proprietary aggregation algorithm**
(Paper-RSK-NDA-V9.1). The measurement vector is sorted internally; the result is
a single integer value in Risk Units (RU). A configuration parameter (`scalingBase`)
controls the aggregation behavior.

---

### `POST /v1/rsk/vm/aggregate`

Compute the composite measurement from a risk factor vector.

**Request:**

```json
{
  "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
  "scalingBase": 4
}
```

**With explicit input scale** (required when the vector is ambiguous, e.g. all
values are exactly 1):

```json
{
  "measurements": [1, 1, 1],
  "inputScale": "scaled"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `measurements` | `number[]` | *(required)* | V-factor vector |
| `scalingBase` | `number` | `4` | Decay base (must be > 1) |
| `maximumValue` | `number` | `100` | v_max |
| `inputScale` | `string` | auto-detect | `"raw"` (0–1) or `"scaled"` (1–v_max). If omitted, values ≤ 1.0 → raw, any > 1.0 → scaled. Mixed vectors without explicit `inputScale` are rejected. |

**Response:**

```json
{
  "data": {
    "raw": {
      "aggregate": 0.4283040364583333,
      "upperBound": 1.3333333333333335
    },
    "scaled": {
      "aggregate": 43,
      "upperBound": 134
    },
    "inputScale": "scaled",
    "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
    "scalingBase": 4,
    "maximumValue": 100
  }
}
```

---

### `POST /v1/rsk/vm/add`

Add a risk factor base measurement to an existing vector and return the updated aggregate.

**Request:**

```json
{
  "measurements": [20, 5, 5, 5],
  "measurement": 30,
  "scalingBase": 4
}
```

The `inputScale` field is supported with the same semantics as `/aggregate`.

**Response:**

```json
{
  "data": {
    "raw": {
      "aggregate": 0.3289713541666667,
      "previousAggregate": 0.21640625
    },
    "scaled": {
      "aggregate": 33,
      "previousAggregate": 22
    },
    "inputScale": "scaled",
    "measurements": [30, 20, 5, 5, 5],
    "scalingBase": 4,
    "maximumValue": 100
  }
}
```

The new measurement is inserted and the vector is re-sorted descending.

---

### `POST /v1/rsk/vm/normalize`

Scale a raw composite measurement to 0–100 using the theoretical upper bound.

$$\text{normalized} = \min\left(100,\ \frac{\text{raw}}{\text{upperBound}} \times 100\right)$$

**Request:**

```json
{
  "raw": 43,
  "maximumValue": 100,
  "scalingBase": 4
}
```

The `inputScale` field is supported with the same semantics as `/aggregate`.

**Response:**

```json
{
  "data": {
    "raw": {
      "normalized": 0.32250000000000006,
      "upperBound": 1.3333333333333335
    },
    "scaled": {
      "normalized": 32.09,
      "upperBound": 134
    },
    "raw": 43,
    "maximumValue": 100,
    "scalingBase": 4
  }
}
```

---

### `POST /v1/rsk/vm/rate`

Map a composite measurement to a Relative Risk Level.

**Standard scale:**

| Level | Low RU | High RU |
|-------|--------|---------|
| Low | 0 | 24 |
| Moderate | 25 | 49 |
| High | 50 | 74 |
| Very High | 75 | 99 |
| Extreme | 100 | + |

**Alternate scale:**

| Level | Low RU | High RU |
|-------|--------|---------|
| Low | 0 | 39 |
| Medium | 40 | 69 |
| High | 70 | + |

**Request:**

```json
{
  "measurement": 43,
  "scale": "standard"
}
```

**Response:**

```json
{
  "data": {
    "rating": "Moderate",
    "measurement": 43,
    "thresholds": [25, 50, 75, 100],
    "labels": ["Low", "Moderate", "High", "Very High", "Extreme"]
  }
}
```

Custom thresholds and labels may be provided to override the built-in scales.

---

### `POST /v1/rsk/vm/score`

Full RSK/VM pipeline: **aggregate → normalize → rate** in one request.

**Request:**

```json
{
  "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
  "scalingBase": 4,
  "maximumValue": 100,
  "scale": "standard"
}
```

The `inputScale` field is supported with the same semantics as `/aggregate`.

**Response:**

```json
{
  "data": {
    "raw": {
      "aggregate": 0.4283040364583333,
      "normalized": 0.32122802734375,
      "upperBound": 1.3333333333333335
    },
    "scaled": {
      "aggregate": 43,
      "normalized": 32.09,
      "upperBound": 134
    },
    "rating": "Moderate",
    "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
    "scalingBase": 4,
    "maximumValue": 100
  }
}
```

---

### `POST /v1/rsk/vm/limit`

Calculate the theoretical upper bound of the composite measurement for a
given configuration.

**Request:**

```json
{
  "maximumValue": 100,
  "scalingBase": 4
}
```

**Response:**

```json
{
  "data": {
    "raw": {
      "upperBound": 1.3333333333333335
    },
    "scaled": {
      "upperBound": 134
    },
    "maximumValue": 100,
    "scalingBase": 4
  }
}
```

---

## RSK/RM — Risk Mode

RSK Risk Mode extends RSK/VM with confidence, asset value, and threat potential.
Each base measurement is adjusted before aggregation:

$$v_i = C_i \times V_{a_i} \times T_{p_i} \times b_i$$

---

### `POST /v1/rsk/rm/adjust`

Apply RSK/RM factor adjustments to a vector of risk factors.

**Request:**

```json
{
  "riskFactors": [
    { "baseMeasurement": 100, "confidence": 0.90, "assetValue": 0.75, "threatPotential": 0.9 },
    { "baseMeasurement": 100, "confidence": 0.90, "assetValue": 0.75, "threatPotential": 0.9 },
    { "baseMeasurement": 40,  "confidence": 0.90, "assetValue": 0.75, "threatPotential": 0.9 },
    { "baseMeasurement": 30,  "confidence": 0.75, "assetValue": 0.75, "threatPotential": 0.9 }
  ],
  "scalingBase": 4
}
```

Each factor defaults to 1.0 (RSK/VM behavior) if omitted.

**Response:**

```json
{
  "data": {
    "aggregate": 102,
    "adjustedMeasurements": [61, 61, 25, 17],
    "riskFactors": [...]
  }
}
```

---

### `POST /v1/rsk/rm/sle`

**Single Loss Expectancy** — risk from a single threat event.

$$SLE = A \times 1 \times V \times (1 - C)$$

**Request:**

```json
{
  "assetValue": 0.2647,
  "vulnerability": 0.4092,
  "controlEfficacy": 0.40625
}
```

**Response:**

```json
{
  "data": {
    "value": 0.0643,
    "formula": "A × V × (1 - C)",
    "components": {
      "assetValue": 0.2647,
      "vulnerability": 0.4092,
      "controlEfficacy": 0.40625
    }
  }
}
```

---

### `POST /v1/rsk/rm/dle`

**Distributed Loss Expectancy** — risk including threat probability.

$$DLE = A \times T \times V \times (1 - C)$$

**Request:**

```json
{
  "assetValue": 0.2647,
  "threatPotential": 0.5333,
  "vulnerability": 0.4092,
  "controlEfficacy": 0.40625
}
```

**Response:**

```json
{
  "data": {
    "value": 0.0343,
    "formula": "A × T × V × (1 - C)",
    "components": {
      "assetValue": 0.2647,
      "threatPotential": 0.5333,
      "vulnerability": 0.4092,
      "controlEfficacy": 0.40625
    }
  }
}
```

---

### `POST /v1/rsk/rm/assess`

Full RSK/RM pipeline: accepts raw IAP inputs (or pre-computed factor values),
adjusts base measurements, computes the composite measurement, and calculates
SLE and DLE.

Each of `asset`, `threat`, `vulnerability`, and `control` can be provided as:
- A **number** (pre-computed 0–1 factor value)
- An **object** (raw IAP inputs — the transform is auto-invoked)
- An **entity ID string** (e.g., `"ast_a1b2c3d4e5f67890"` — resolved from the
  entity graph's `iapDefaults` via LinkageStore)

**Request (with inline IAP inputs):**

```json
{
  "riskFactors": [
    { "baseMeasurement": 100, "confidence": 0.90 },
    { "baseMeasurement": 50,  "confidence": 0.75 }
  ],
  "asset": {
    "classification": 2,
    "users": 3,
    "highValueData": [true, false, true, false, true, false]
  },
  "threat": {
    "history": 3,
    "access": 2,
    "means": 2
  },
  "vulnerability": {
    "capabilities": 2,
    "resources": 2,
    "visibility": 2,
    "confidentiality": 2,
    "integrity": 1,
    "availability": 2
  },
  "control": {
    "controls": [
      { "implemented": 0.75, "correction": 0.50 },
      { "implemented": 0.90, "correction": 0.80 }
    ]
  },
  "scalingBase": 4,
  "maximumValue": 100
}
```

**Request (with pre-computed factors):**

```json
{
  "riskFactors": [
    { "baseMeasurement": 100, "confidence": 0.90 },
    { "baseMeasurement": 50,  "confidence": 0.75 }
  ],
  "asset": 0.2647,
  "threat": 0.5333,
  "vulnerability": 0.4092,
  "control": 0.40625,
  "scalingBase": 4,
  "maximumValue": 100
}
```

**Response:**

```json
{
  "data": {
    "aggregate": 28,
    "normalized": 20.90,
    "rating": "Moderate",
    "sle": 0.0643,
    "dle": 0.0343,
    "factors": {
      "assetValue": 0.2647,
      "threatPotential": 0.5333,
      "vulnerability": 0.4092,
      "controlEfficacy": 0.40625
    },
    "adjustedMeasurements": [24, 10]
  }
}
```

---

## IAP — Independent Ancillary Processes

IAPs are self-contained assessment models that each produce a normalized 0–1
factor value. They correspond to the RSK/RM adjustment factors.

IAP endpoints are **domain-based** — you post to the domain (`/threat`,
`/vulnerability`, `/control`, `/asset`) and optionally specify a `model`
parameter to select a specific transform. If `model` is omitted, the
domain's default transform is used.

Every response includes a `domain` and `model` field confirming which
transform was applied.

---

### `GET /v1/iap/transforms`

Discover all registered transforms with their domains, default models, and
factor definitions.

**Response (200):**

```json
{
  "data": [
    {
      "domain": "threat",
      "model": "ham533",
      "isDefault": true,
      "description": "Hostile Actor Model (5-3-3) threat assessment",
      "factors": [
        { "name": "history", "type": "number", "min": 1, "max": 5 },
        { "name": "access", "type": "number", "min": 1, "max": 3 },
        { "name": "means", "type": "number", "min": 1, "max": 3 }
      ]
    },
    { "domain": "vulnerability", "model": "crve3", "isDefault": true, "..." : "..." },
    { "domain": "vulnerability", "model": "cvssa", "isDefault": false, "..." : "..." },
    { "domain": "control", "model": "scep", "isDefault": true, "..." : "..." },
    { "domain": "asset", "model": "asset-valuation", "isDefault": true, "..." : "..." }
  ]
}
```

---

### `POST /v1/iap/threat`

**HAM533 — Threat potential assessment** (default model for `threat` domain).

The "533" refers to factor scale maximums: History max 5, Access max 3, Means max 3.

$$\text{probability} = \frac{H \times A \times M}{45} \qquad \text{impact} = \frac{5 \times A \times M}{45}$$

**Request:**

```json
{
  "history": 3,
  "access": 2,
  "means": 2
}
```

**Response:**

```json
{
  "data": {
    "probability": 0.2667,
    "impact": 0.4444,
    "factors": {
      "history": 3,
      "access": 2,
      "means": 2,
      "product": 12
    },
    "domain": "threat",
    "model": "ham533"
  }
}
```

---

### `POST /v1/iap/vulnerability`

**CRVE3 — Vulnerability exposure assessment** (default model for `vulnerability` domain).

Basic component: $C \times R \times V$ (max 27).
CIA aggregate: proprietary aggregate of C/I/A exposures.
Final exposure: $\frac{\text{cia} \times \text{basic}}{\text{ciaMax} \times \text{basicMax}}$

Where $\text{ciaMax} = f([3, 3, 3], 4) = 4$ and $\text{basicMax} = 27$.

**Request:**

```json
{
  "capabilities": 2,
  "resources": 2,
  "visibility": 2,
  "confidentiality": 2,
  "integrity": 1,
  "availability": 2
}
```

An alternate model (`cvssa`) is available by providing `"model": "cvssa"`.

**Response:**

```json
{
  "data": {
    "exposure": 0.2222,
    "basic": 8,
    "cia": 3,
    "ciaMax": 4,
    "basicMax": 27,
    "domain": "vulnerability",
    "model": "crve3"
  }
}
```

---

### `POST /v1/iap/control`

**SCEP — Control efficacy assessment** (default model for `control` domain).

Per-control effective: $\text{effective} = \text{implemented} \times \text{correction}$.
Aggregate efficacy: proprietary aggregate of per-control effectives, capped at 1.0.

**Request:**

```json
{
  "controls": [
    { "implemented": 0.75, "correction": 0.50 },
    { "implemented": 0.90, "correction": 0.80 }
  ]
}
```

**Response:**

```json
{
  "data": {
    "efficacy": 0.5563,
    "effectives": [0.72, 0.375],
    "domain": "control",
    "model": "scep"
  }
}
```

---

### `POST /v1/iap/asset`

**AsrValuation — Asset value assessment** (default model for `asset` domain).

$$A = \frac{\text{classification} \times \text{users} \times \text{hvAggregate}}{3 \times 5 \times \text{hvMax}}$$

High-value data categories (6 booleans) are aggregated using a proprietary
function to produce `hvAggregate`; `hvMax` is the aggregate of all-true values.

**Request:**

```json
{
  "classification": 2,
  "users": 3,
  "highValueData": [true, false, true, false, true, false]
}
```

**Response:**

```json
{
  "data": {
    "assetValue": 0.2647,
    "components": {
      "classification": 2,
      "users": 3,
      "highValueAggregate": 1.3125,
      "highValueMax": 1.984375
    },
    "domain": "asset",
    "model": "asset-valuation"
  }
}
```

---

## NIST — Standards-Aligned Risk Matrix

Maps RSK quantitative measurements to the NIST SP 800-30 Rev 1 qualitative risk
determination matrix (Table I-2). The 5×5 matrix evaluates **Likelihood × Impact**
to produce a qualitative risk level.

### Dual-Dimension Threat Assessment (HAM533)

HAM533 produces two distinct threat outputs that map directly to the NIST axes:

| Dimension | HAM533 Formula | H Value | Purpose |
|-----------|---------------|---------|---------|
| **Probability** | $H \times A \times M / 45$ | Actuarial (1–5) | Estimate of threat frequency |
| **Impact** | $5 \times A \times M / 45$ | Max (certainty) | Result of threat success |

### NIST Axis Derivation from RSK Components

$$\text{likelihood} = T_{probability} \times V \times (1 - C)$$
$$\text{impact} = T_{impact} \times A$$

Where:
- $T_{probability}$ = HAM533 probability output (actuarial H)
- $T_{impact}$ = HAM533 impact output (H = max)
- $V$ = vulnerability exposure (from CRVE3)
- $C$ = control efficacy (from SCEP)
- $A$ = asset value (from AsrValuation)

### NIST 800-30 Qualitative Scale (Table D-2)

| Level | Range | Semi-Quantitative (Likelihood) | Semi-Quantitative (Impact) |
|-------|-------|-------------------------------|---------------------------|
| Very Low | [0, 0.05) | 0 | 0 |
| Low | [0.05, 0.21) | 2 | 2 |
| Moderate | [0.21, 0.80) | 5 | 10 |
| High | [0.80, 0.96) | 8 | 50 |
| Very High | [0.96, 1.0] | 10 | 100 |

### Risk Determination Matrix (Table I-2)

|  | **VL Impact** | **L Impact** | **M Impact** | **H Impact** | **VH Impact** |
|---|---|---|---|---|---|
| **VH Likelihood** | Very Low | Low | Moderate | High | Very High |
| **H Likelihood** | Very Low | Low | Moderate | High | Very High |
| **M Likelihood** | Very Low | Low | Moderate | Moderate | High |
| **L Likelihood** | Very Low | Low | Low | Low | Moderate |
| **VL Likelihood** | Very Low | Very Low | Very Low | Low | Low |

---

### `POST /v1/nist/risk-matrix`

Compute a NIST SP 800-30 risk determination from RSK measurements.

**Request (pre-computed values):**

```json
{
  "likelihood": 0.35,
  "impact": 0.25
}
```

**Request (RSK components with dual-dimension threat):**

```json
{
  "threatProbability": 0.2667,
  "threatImpact": 0.4444,
  "vulnerability": 0.4092,
  "controlEfficacy": 0.40625,
  "assetValue": 0.2647
}
```

**Request (raw IAP inputs — HAM533 auto-produces both dimensions):**

```json
{
  "threat": { "history": 3, "access": 2, "means": 2 },
  "vulnerability": {
    "capabilities": 2, "resources": 2, "visibility": 2,
    "confidentiality": 2, "integrity": 1, "availability": 2
  },
  "control": {
    "controls": [
      { "implemented": 0.75, "correction": 0.50 },
      { "implemented": 0.90, "correction": 0.80 }
    ]
  },
  "asset": {
    "classification": 2, "users": 3,
    "highValueData": [true, false, true, false, true, false]
  }
}
```

**Response:**

```json
{
  "data": {
    "likelihood": {
      "value": 0.0649,
      "level": "Low",
      "semiQuantitative": 2
    },
    "impact": {
      "value": 0.1177,
      "level": "Low",
      "semiQuantitative": 2
    },
    "risk": {
      "level": "Low",
      "score": 4,
      "position": { "row": 3, "column": 1 }
    },
    "matrix": {
      "levels": ["Very Low", "Low", "Moderate", "High", "Very High"],
      "likelihoodAxis": ["Very High", "High", "Moderate", "Low", "Very Low"],
      "impactAxis": ["Very Low", "Low", "Moderate", "High", "Very High"],
      "cells": [
        ["Very Low", "Low",      "Moderate",  "High",     "Very High"],
        ["Very Low", "Low",      "Moderate",  "High",     "Very High"],
        ["Very Low", "Low",      "Moderate",  "Moderate", "High"],
        ["Very Low", "Low",      "Low",       "Low",      "Moderate"],
        ["Very Low", "Very Low", "Very Low",  "Low",      "Low"]
      ]
    },
    "components": {
      "threatProbability": 0.2667,
      "threatImpact": 0.4444,
      "vulnerability": 0.2222,
      "controlEfficacy": 0.5563,
      "assetValue": 0.2647,
      "derivedLikelihood": 0.0649,
      "derivedImpact": 0.1177
    },
    "breakpoints": {
      "likelihood": [0.05, 0.21, 0.80, 0.96],
      "impact": [0.05, 0.21, 0.80, 0.96]
    }
  }
}
```

> **Derivation trace (raw IAP → NIST):**
> - HAM533(H=3, A=2, M=2): probability = 12/45 = 0.2667, impact = 20/45 = 0.4444
> - CRVE3: exposure = 0.2222
> - SCEP: efficacy = 0.5563
> - AsrValuation: assetValue = 0.2647
> - likelihood = 0.2667 × 0.2222 × (1 − 0.5563) = 0.0263 → **Very Low**
> - impact = 0.4444 × 0.2647 = 0.1177 → **Low**
> - Matrix[VL likelihood, L impact] = **Low**

Custom breakpoints may be provided to adjust the qualitative mapping for
domain-specific scales (e.g., financial risk may use different impact breakpoints
than cybersecurity risk).

---

## Frameworks — ATV(1-C) Linkage Catalog

Linkage frameworks define the catalog of asset types, threat classes,
vulnerability classes, and control families — along with the rules governing
which types can be linked (e.g., which threats target which asset types).

---

### `GET /v1/frameworks`

List all registered linkage frameworks.

**Response (200):**

```json
{
  "data": {
    "frameworks": [
      { "name": "nist-800-30", "version": "1.0.0", "description": "NIST SP 800-30 Rev 1 taxonomy", "isDefault": true }
    ],
    "default": "nist-800-30"
  }
}
```

---

### `GET /v1/frameworks/{name}`

Full catalog for a specific framework: all types, classes, families, and
linkage rules.

**Response (200):**

```json
{
  "data": {
    "name": "nist-800-30",
    "version": "1.0.0",
    "assetTypes": [ { "id": "ast_type_info_sys", "name": "Information System", "iapDefaults": { "..." : "..." } } ],
    "threatClasses": [ { "id": "thr_cls_adversarial", "name": "Adversarial", "..." : "..." } ],
    "vulnerabilityClasses": [ { "id": "vul_cls_technical", "name": "Technical", "..." : "..." } ],
    "controlFamilies": [ { "id": "ctl_fam_ac", "name": "Access Control (AC)", "..." : "..." } ],
    "linkageRules": {
      "TARGETS": [ ["thr_cls_adversarial", "ast_type_info_sys"], "..." ],
      "EXPLOITED_BY": [ "..." ],
      "AFFECTS": [ "..." ],
      "MITIGATES": [ "..." ],
      "PROTECTS": [ "..." ],
      "COUNTERS": [ "..." ]
    }
  }
}
```

---

## Entities — Asset, Threat, Vulnerability, Control CRUD

Four entity types with identical CRUD patterns. Each entity references a
catalog type from the active framework.

Entity ID prefixes: `ast_`, `thr_`, `vul_`, `ctl_` (16 hex chars).

---

### `POST /v1/assets`   (also `/threats`, `/vulnerabilities`, `/controls`)

Create an entity of the given type.

**Request:**

```json
{
  "name": "Production Web Server",
  "typeId": "ast_type_info_sys",
  "frameworkId": "nist-800-30"
}
```

**Response (201):** `{ "data": { "id": "ast_a1b2c3d4e5f67890", "name": "...", ... } }`

---

### `GET /v1/assets`   (also `/threats`, `/vulnerabilities`, `/controls`)

List all entities of the given type.

---

### `GET /v1/assets/{id}`

Retrieve a single entity by ID.

---

### `PUT /v1/assets/{id}`

Update entity properties (name, metadata).

---

### `DELETE /v1/assets/{id}`

Remove an entity and its linkages. Returns `204`.

---

### `POST /v1/assets/batch`   (also `/threats/batch`, `/vulnerabilities/batch`, `/controls/batch`)

Batch-create entities. Validates all catalog type IDs upfront.

**Request:**

```json
{
  "items": [
    { "name": "Server A", "typeId": "ast_type_info_sys" },
    { "name": "Server B", "typeId": "ast_type_info_sys" }
  ]
}
```

**Response (201):** `{ "data": { "created": 2, "failed": 0, "errors": [], "items": [...] } }`

---

## Linkages — Entity Relationship Management

Create and query relationships between entities. The API validates every
linkage against the framework's catalog rules (e.g., only threats with a
TARGETS rule for the asset's type may be linked).

---

### `POST /v1/linkages`

Create a linkage between two entities.

**Request:**

```json
{
  "sourceId": "thr_a1b2c3d4e5f67890",
  "targetId": "ast_b2c3d4e5f67890a1",
  "relationship": "EXPOSED_TO"
}
```

**Response (201):** `{ "data": { "source": "...", "target": "...", "relationship": "EXPOSED_TO" } }`

---

### `GET /v1/linkages`

Query linked entities.

**Query parameters:**
- `entityId` — (required) the entity whose links to retrieve
- `direction` — `outgoing` | `incoming` | `both` (default: `both`)
- `relationship` — filter to a specific relationship type

---

### `DELETE /v1/linkages`

Remove a specific linkage.

**Request:** `{ "sourceId": "...", "targetId": "...", "relationship": "EXPOSED_TO" }`

**Response:** `204 No Content`

---

## Suggestions — Catalog-Driven Recommendations

Suggest potential linkage partners for an entity based on the framework's
catalog rules.

---

### `GET /v1/assets/{id}/suggestions/threats`

Suggest threats that could target this asset, based on catalog TARGETS rules.

### `GET /v1/assets/{id}/suggestions/vulnerabilities`

Suggest vulnerabilities that could affect this asset. Optional `?threatId=`
query parameter to narrow via EXPLOITED_BY rules.

### `GET /v1/assets/{id}/suggestions/controls`

Suggest controls that could protect this asset, based on catalog PROTECTS rules.

### `GET /v1/vulnerabilities/{id}/suggestions/controls`

Suggest controls that could mitigate this vulnerability, based on catalog
MITIGATES rules.

---

## Error Responses

All errors use a consistent envelope:

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

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Malformed or invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token |
| 403 | `FORBIDDEN` | Token valid but insufficient roles |
| 422 | `UNPROCESSABLE_ENTITY` | Valid structure but semantic error |
| 500 | `INTERNAL_ERROR` | Unexpected server-side failure |

---

## Parameters Reference

| Parameter | Default | Domain | Description |
|-----------|---------|--------|-------------|
| `scalingBase` | 4 | $a > 1$ | Aggregation tuning parameter |
| `minimumValue` | 1 | $v_{min} \geq 0$ | Minimum valid risk factor base measurement |
| `maximumValue` | 100 | $v_{max} > v_{min}$ | Maximum valid risk factor base measurement |
| `scale` | `"standard"` | `standard` \| `alternate` | Relative Risk Level scale (5-level or 3-level) |
| `precision` | null | integer $\geq 0$ | Decimal places for normalized value |

---

## References

- Paper-RSK-NDA-V9.1 — *A Process for Measuring Information Security Risk*, A. T. Robinson, NMI LLC, December 2007
- [OpenAPI Spec](openapi.yaml)
- [Security](SECURITY.md)
- [Project Patterns](PROJECT-PATTERNS.md)

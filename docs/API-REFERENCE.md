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

See [SECURITY.md](SECURITY.md) for OAuth 2.0 / OIDC / mTLS details.

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
| Probability | 1.0 | 0.615625 | 0.384375 |
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
      "probability": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
      "scaled": { "base": 100, "adjustment": 62, "effective": 38 }
    },
    "tree": [
      {
        "id": "nod_ext01",
        "level": "test",
        "label": "External",
        "aggregate": {
          "probability": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
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
                          "probability": { "base": 1.0, "adjustment": 0.615625, "effective": 0.384375 },
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
      "probability": { "base": 1.0, "adjustment": 0.0, "effective": 1.0 },
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
        "probability": { "base": 1.0, "adjustment": 0.6, "effective": 0.4 },
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

## RSK/VM — Vulnerability Mode

RSK/VM computes composite risk measurements from vulnerability vectors.
All assets are assumed to be of equal value, and the threat is assumed to be a
single hostile agent that is 100% effective.

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

**Response:**

```json
{
  "data": {
    "aggregate": 43,
    "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
    "scalingBase": 4,
    "upperBound": 134
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

**Response:**

```json
{
  "data": {
    "aggregate": 33,
    "measurements": [30, 20, 5, 5, 5],
    "previousAggregate": 22
  }
}
```

The new measurement is inserted and the vector is re-sorted descending. The
measurement must be between `minimumValue` (default 1) and `maximumValue` (default 100).

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

**Response:**

```json
{
  "data": {
    "normalized": 32.09,
    "raw": 43,
    "upperBound": 134
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

**Response:**

```json
{
  "data": {
    "aggregate": 43,
    "normalized": 32.09,
    "rating": "Moderate",
    "measurements": [40, 10, 5, 5, 5, 5, 5, 5],
    "upperBound": 134,
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
    "upperBound": 134,
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

---

### `POST /v1/iap/ham533`

**HAM533 — Threat potential assessment.**

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
    }
  }
}
```

---

### `POST /v1/iap/crve3`

**CRVE3 — Vulnerability exposure assessment.**

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

**Response:**

```json
{
  "data": {
    "exposure": 0.2222,
    "basic": 8,
    "cia": 3,
    "ciaMax": 4,
    "basicMax": 27
  }
}
```

---

### `POST /v1/iap/scep`

**SCEP — Control efficacy assessment.**

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
    "effectives": [0.72, 0.375]
  }
}
```

---

### `POST /v1/iap/asset-valuation`

**AsrValuation — Asset value assessment.**

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
    }
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

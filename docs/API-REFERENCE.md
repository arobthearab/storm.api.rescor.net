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

## RSK/VM — Vulnerability Mode

RSK/VM computes composite risk measurements from vulnerability vectors.
All assets are assumed to be of equal value, and the threat is assumed to be a
single hostile agent that is 100% effective (Paper-RSK-NDA-V9.1 §V).

### Core Formula

$$h_i = f(V_i, a) = \left\lceil \sum_{j=0}^{|V_i|-1} \frac{V_{ij}}{a^j} \right\rceil$$

Where $V_i = \{v_0, v_1, \ldots\}$ is **sorted descending**, $a$ is the scaling base (default 4).

**Bounds:** $V_{i0} \leq f(V_i, a) \leq \lceil v_{max} / (1 - 1/a) \rceil$

With defaults ($v_{max}=100$, $a=4$): upper bound = **134 RU**.

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

**White paper verification (Appendix B, $a=4$):**

| Vector | Result |
|--------|--------|
| `[20, 5, 5, 5]` | 22 RU |
| `[20, 5, 5, 5, 5, 5, 5, 5, 5, 5]` | 22 RU |
| `[40, 10, 5, 5, 5, 5, 5, 5]` | 43 RU |
| `[50]` | 50 RU |
| `[50, 40, 40, 20, 20, 10, 10, 5, ...]` | 63 RU |

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

Map a composite measurement to a Relative Risk Level (Paper-RSK-NDA-V9.1 Tables IA/IB).

**Standard scale (Table IA):**

| Level | Low RU | High RU |
|-------|--------|---------|
| Low | 0 | 24 |
| Moderate | 25 | 49 |
| High | 50 | 74 |
| Very High | 75 | 99 |
| Extreme | 100 | + |

**Alternate scale (Table IB):**

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

Calculate the theoretical upper bound of the composite measurement.

$$\text{upperBound} = \left\lceil \frac{v_{max}}{1 - \frac{1}{a}} \right\rceil$$

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
Each base measurement is adjusted before aggregation (Paper-RSK-NDA-V9.1 §XIII.G):

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
factor value. They correspond to the RSK/RM adjustment factors defined in
Paper-RSK-NDA-V9.1 §XIII.G.

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
CIA aggregate: diminishing-returns aggregate of C/I/A exposures using $a=4$.
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
Aggregate efficacy: $\min(1,\ f(\text{effectives},\ a=4))$ using the RSK aggregate function.

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

High-value data categories (6 booleans) are aggregated using the RSK diminishing-returns
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
| `scalingBase` | 4 | $a > 1$ | Divisor base controlling diminishing returns |
| `minimumValue` | 1 | $v_{min} \geq 0$ | Minimum valid risk factor base measurement |
| `maximumValue` | 100 | $v_{max} > v_{min}$ | Maximum valid risk factor base measurement |
| `scale` | `"standard"` | `standard` \| `alternate` | Relative Risk Level table (IA or IB) |
| `precision` | null | integer $\geq 0$ | Decimal places for normalized value |

---

## References

- Paper-RSK-NDA-V9.1 — *A Process for Measuring Information Security Risk*, A. T. Robinson, NMI LLC, December 2007
- [OpenAPI Spec](openapi.yaml)
- [Security](SECURITY.md)
- [Project Patterns](PROJECT-PATTERNS.md)

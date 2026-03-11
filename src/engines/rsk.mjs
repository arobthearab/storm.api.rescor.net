/**
 * RSK Aggregate Engine — CONFIDENTIAL
 *
 * Pure computation functions for the RSK Vulnerability Mode scoring model.
 * No side effects, no I/O, no state.
 *
 * IP Classification: PROPRIETARY — do not expose formulas in public docs or API responses.
 */

/**
 * Compute the raw (pre-ceiling) RSK aggregate from a vector of V-factors.
 *
 * Sorts measurements descending, then applies the proprietary diminishing-weight series.
 *
 * @param {number[]} measurements - Array of risk factor measurements (RU or 0–1)
 * @param {number}   scalingBase  - Geometric decay base (default 4, must be > 1)
 * @returns {number} Full-precision composite measurement (no rounding)
 */
export function rskAggregateRaw (measurements, scalingBase = 4) {
  let result = 0

  if (measurements.length === 0) {
    return result
  }

  const sorted = [...measurements].sort((a, b) => b - a)

  let accumulator = 0
  for (let index = 0; index < sorted.length; index++) {
    accumulator += sorted[index] / Math.pow(scalingBase, index)
  }

  result = accumulator
  return result
}

/**
 * Compute the RSK aggregate measurement from a vector of V-factors.
 *
 * Sorts measurements descending, then applies the proprietary diminishing-weight series.
 * Returns the ceiling-rounded value suitable for scaled (integer RU) output.
 *
 * @param {number[]} measurements - Array of risk factor measurements (RU or 0–1)
 * @param {number}   scalingBase  - Geometric decay base (default 4, must be > 1)
 * @returns {number} Ceiling-rounded composite measurement
 */
export function rskAggregate (measurements, scalingBase = 4) {
  const result = Math.ceil(rskAggregateRaw(measurements, scalingBase))
  return result
}

/**
 * Compute the raw (pre-ceiling) theoretical upper bound for a given v_max and scaling base.
 *
 * @param {number} maximumValue - Maximum single measurement (v_max)
 * @param {number} scalingBase  - Geometric decay base
 * @returns {number} Full-precision upper bound (no rounding)
 */
export function rskUpperBoundRaw (maximumValue = 100, scalingBase = 4) {
  const result = maximumValue / (1 - 1 / scalingBase)
  return result
}

/**
 * Compute the theoretical upper bound for a given v_max and scaling base.
 *
 * Returns the ceiling-rounded value suitable for scaled (integer RU) output.
 *
 * @param {number} maximumValue - Maximum single measurement (v_max)
 * @param {number} scalingBase  - Geometric decay base
 * @returns {number} Ceiling-rounded upper bound
 */
export function rskUpperBound (maximumValue = 100, scalingBase = 4) {
  const result = Math.ceil(rskUpperBoundRaw(maximumValue, scalingBase))
  return result
}

/**
 * Normalize a raw composite measurement to a 0–100 scale.
 *
 * @param {number} raw          - Raw composite (RU)
 * @param {number} maximumValue - v_max
 * @param {number} scalingBase  - Scaling base
 * @returns {number} Normalized value (0–100)
 */
export function rskNormalize (raw, maximumValue = 100, scalingBase = 4) {
  const upperBound = rskUpperBound(maximumValue, scalingBase)
  const result = Math.min(100, (raw / upperBound) * 100)
  return result
}

/**
 * Map a normalized measurement to a qualitative rating.
 *
 * Standard thresholds: [25, 50, 75, 100] → [Low, Moderate, High, Very High, Extreme]
 * Alternate thresholds: [40, 70]          → [Low, Medium, High]
 *
 * @param {number}   measurement - Composite in RU (min 0)
 * @param {object}   options
 * @param {string}   options.scale      - "standard" or "alternate"
 * @param {number[]} options.thresholds - Custom breakpoints (overrides scale)
 * @param {string[]} options.labels     - Custom labels (must be thresholds.length + 1)
 * @returns {{ rating: string, thresholds: number[], labels: string[] }}
 */
export function rskRate (measurement, options = {}) {
  let thresholds
  let labels

  if (options.thresholds && options.labels) {
    thresholds = options.thresholds
    labels = options.labels
  } else if (options.scale === 'alternate') {
    thresholds = [40, 70]
    labels = ['Low', 'Medium', 'High']
  } else {
    thresholds = [25, 50, 75, 100]
    labels = ['Low', 'Moderate', 'High', 'Very High', 'Extreme']
  }

  let rating = labels[labels.length - 1]

  for (let index = 0; index < thresholds.length; index++) {
    if (measurement < thresholds[index]) {
      rating = labels[index]
      break
    }
  }

  const result = { rating, thresholds, labels }
  return result
}

/**
 * Full scoring pipeline: aggregate → normalize → rate.
 *
 * @param {number[]} measurements  - V-factor measurements
 * @param {object}   configuration
 * @param {number}   configuration.scalingBase  - default 4
 * @param {number}   configuration.maximumValue - default 100
 * @param {string}   configuration.inputScale   - 'raw' | 'scaled' | undefined (auto-detect)
 * @param {string}   configuration.scale        - "standard" or "alternate"
 * @param {number}   configuration.precision    - decimal places (null for full)
 * @returns {object} Complete score result
 */
export function computeScore (measurements, configuration = {}) {
  const scalingBase = configuration.scalingBase || 4
  const maximumValue = configuration.maximumValue || 100
  const sorted = [...measurements].sort((a, b) => b - a)

  const resolvedInputScale = resolveInputScale(sorted, maximumValue, configuration.inputScale)
  const scaleFactor = resolvedInputScale === 'raw' ? 1 : maximumValue

  const rawAccumulator = rskAggregateRaw(sorted, scalingBase)
  const rawAggregate = rawAccumulator / scaleFactor
  const scaledAggregate = Math.ceil(rawAggregate * maximumValue)

  const rawUpperBound = rskUpperBoundRaw(1, scalingBase)
  const scaledUpperBound = rskUpperBound(maximumValue, scalingBase)

  const rawNormalized = rawAggregate / rawUpperBound
  let scaledNormalized = rskNormalize(scaledAggregate, maximumValue, scalingBase)
  if (configuration.precision != null) {
    scaledNormalized = Number(scaledNormalized.toFixed(configuration.precision))
  }

  const { rating } = rskRate(scaledAggregate, { scale: configuration.scale })

  const result = {
    raw: {
      aggregate: rawAggregate,
      normalized: rawNormalized,
      upperBound: rawUpperBound
    },
    scaled: {
      aggregate: scaledAggregate,
      normalized: scaledNormalized,
      upperBound: scaledUpperBound
    },
    rating,
    inputScale: resolvedInputScale,
    measurements: sorted,
    scalingBase,
    maximumValue
  }
  return result
}

/**
 * Resolve the input scale for a measurement vector.
 *
 * When an explicit inputScale is provided ('raw' | 'scaled'), it is returned
 * directly after validation.  Otherwise, auto-detection is used:
 *   - all values <= 1.0 → 'raw'
 *   - all values > 1.0  → 'scaled'
 *   - mix of both       → throws Error (caller must specify inputScale)
 *
 * @param {number[]} sorted       - Measurements sorted descending
 * @param {number}   maximumValue - Maximum scaled value (for context in errors)
 * @param {string}   [inputScale] - Explicit override: 'raw' | 'scaled'
 * @returns {'raw'|'scaled'} Resolved input scale
 * @throws {Error} If the vector is ambiguous without an explicit inputScale,
 *                 or if inputScale='raw' but values exceed 1.0
 */
export function resolveInputScale (sorted, maximumValue, inputScale) {
  let result

  if (inputScale === 'raw') {
    const hasScaledValues = sorted.some(value => value > 1.0)
    if (hasScaledValues) {
      throw new Error("inputScale 'raw' requires all measurements to be in 0–1 range")
    }
    result = 'raw'
  } else if (inputScale === 'scaled') {
    result = 'scaled'
  } else {
    const hasRawValues = sorted.some(value => value <= 1.0)
    const hasScaledValues = sorted.some(value => value > 1.0)

    if (hasRawValues && hasScaledValues) {
      throw new Error(
        'Measurement vector contains values both above and at-or-below 1.0 — ' +
        "specify inputScale ('raw' or 'scaled') to resolve the ambiguity"
      )
    }

    result = hasScaledValues ? 'scaled' : 'raw'
  }

  return result
}

/**
 * Normalize a value to raw space (0–1).
 * Values > 1.0 are assumed to be scaled and are divided by 100.
 *
 * @param {number} value - Input value (raw 0–1 or scaled >1)
 * @returns {number} Value in 0–1 raw space
 */
export function normalizeToRaw (value) {
  const result = value > 1.0 ? value / 100 : value
  return result
}

/**
 * RSK Aggregate Engine — CONFIDENTIAL
 *
 * Pure computation functions for the RSK Vulnerability Mode scoring model.
 * No side effects, no I/O, no state.
 *
 * IP Classification: PROPRIETARY — do not expose formulas in public docs or API responses.
 */

/**
 * Compute the RSK aggregate measurement from a vector of V-factors.
 *
 * Sorts measurements descending, then applies the proprietary diminishing-weight series.
 *
 * @param {number[]} measurements - Array of risk factor measurements (RU or 0–1)
 * @param {number}   scalingBase  - Geometric decay base (default 4, must be > 1)
 * @returns {number} Ceiling-rounded composite measurement
 */
export function rskAggregate (measurements, scalingBase = 4) {
  let result = 0

  if (measurements.length === 0) {
    return result
  }

  const sorted = [...measurements].sort((a, b) => b - a)

  let accumulator = 0
  for (let index = 0; index < sorted.length; index++) {
    accumulator += sorted[index] / Math.pow(scalingBase, index)
  }

  result = Math.ceil(accumulator)
  return result
}

/**
 * Compute the theoretical upper bound for a given v_max and scaling base.
 *
 * @param {number} maximumValue - Maximum single measurement (v_max)
 * @param {number} scalingBase  - Geometric decay base
 * @returns {number} Ceiling-rounded upper bound
 */
export function rskUpperBound (maximumValue = 100, scalingBase = 4) {
  const result = Math.ceil(maximumValue / (1 - 1 / scalingBase))
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
 * @param {number[]} measurements - V-factor measurements
 * @param {object}   configuration
 * @param {number}   configuration.scalingBase  - default 4
 * @param {number}   configuration.maximumValue - default 100
 * @param {string}   configuration.scale        - "standard" or "alternate"
 * @param {number}   configuration.precision    - decimal places (null for full)
 * @returns {object} Complete score result
 */
export function computeScore (measurements, configuration = {}) {
  const scalingBase = configuration.scalingBase || 4
  const maximumValue = configuration.maximumValue || 100
  const sorted = [...measurements].sort((a, b) => b - a)

  const aggregate = rskAggregate(sorted, scalingBase)
  const upperBound = rskUpperBound(maximumValue, scalingBase)

  let normalized = rskNormalize(aggregate, maximumValue, scalingBase)
  if (configuration.precision != null) {
    normalized = Number(normalized.toFixed(configuration.precision))
  }

  const { rating } = rskRate(aggregate, { scale: configuration.scale })

  const result = {
    aggregate,
    normalized,
    rating,
    measurements: sorted,
    upperBound,
    scalingBase,
    maximumValue
  }
  return result
}

/**
 * Auto-detect whether a value is a probability (0–1) or a percentage (>1).
 * Values > 1.0 are divided by 100.
 *
 * @param {number} value - Raw input value
 * @returns {number} Probability in 0–1 range
 */
export function autoDetectProbability (value) {
  const result = value > 1.0 ? value / 100 : value
  return result
}

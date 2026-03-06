/**
 * JSDoc type definitions for the STORM SDK.
 *
 * These types define the shapes of all API request and response objects.
 * They serve as documentation and enable IntelliSense in supported editors.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * @typedef {object} StormOptions
 * @property {string}   [baseUrl='http://localhost:3200'] - API base URL
 * @property {string}   [token]                           - Static bearer token
 * @property {Function} [tokenProvider]                   - Async function returning a fresh token
 * @property {number}   [timeout=30000]                   - Request timeout in milliseconds
 * @property {object}   [headers]                         - Extra headers for every request
 * @property {Function} [fetch]                           - Custom fetch implementation (testing)
 */

// =============================================================================
// Measurements
// =============================================================================

/**
 * @typedef {object} CreateMeasurementRequest
 * @property {string}          [name]           - Human-readable name
 * @property {string|string[]} [hierarchy]      - Template name or custom levels array
 * @property {number}          [scalingBase=4]  - Convergence base (a > 1)
 * @property {number}          [maximumValue=100] - v_max for scaled output
 * @property {number}          [ttl=86400]      - Session TTL in seconds
 * @property {object}          [metadata]       - Arbitrary metadata
 */

/**
 * @typedef {object} Measurement
 * @property {string}           id            - Measurement ID (msr_ + 32 hex)
 * @property {string}           name
 * @property {HierarchyConfig}  hierarchy
 * @property {ScalingConfig}    configuration
 * @property {DualMeasurement}  aggregate
 * @property {HierarchyNode[]}  tree
 * @property {number}           factorCount
 * @property {string}           createdAt     - ISO 8601 timestamp
 * @property {string}           expiresAt     - ISO 8601 timestamp
 * @property {object}           metadata
 */

/**
 * @typedef {object} HierarchyConfig
 * @property {string}   template - Template name or 'custom'
 * @property {string[]} levels   - Level names from root to leaf
 */

/**
 * @typedef {object} ScalingConfig
 * @property {number} scalingBase  - Convergence base
 * @property {number} maximumValue - v_max
 */

// =============================================================================
// Factors
// =============================================================================

/**
 * @typedef {object} AddFactorRequest
 * @property {number}   value       - Base probability (0-1) or percentage (> 1 auto-detected)
 * @property {string}   [label]     - Descriptive label
 * @property {string[]} [path]      - Hierarchy path labels (one per grouping level)
 * @property {object}   [metadata]  - Arbitrary metadata
 */

/**
 * @typedef {object} Factor
 * @property {string}          id          - Factor ID (fct_ + 16 hex)
 * @property {string}          nodeId      - Parent hierarchy node ID
 * @property {string[]}        path        - Hierarchy path labels
 * @property {number}          value       - Base probability
 * @property {string}          label
 * @property {Modifier[]}      modifiers
 * @property {DualMeasurement} measurement - Computed dual measurement
 * @property {object}          metadata
 */

/**
 * @typedef {object} UpdateFactorRequest
 * @property {number} [value]    - New base probability
 * @property {string} [label]    - New label
 * @property {object} [metadata] - New metadata
 */

// =============================================================================
// Modifiers
// =============================================================================

/**
 * @typedef {object} AddModifierRequest
 * @property {string} type           - Modifier type (e.g. 'confidence', 'control')
 * @property {number} value          - Modifier value (0-1)
 * @property {string} [effect='attenuate']     - 'attenuate' or 'amplify'
 * @property {string} [application]  - 'direct' or 'compound' (auto-detected from type)
 * @property {string} [label]        - Descriptive label
 * @property {object} [metadata]     - Arbitrary metadata
 */

/**
 * @typedef {object} Modifier
 * @property {string} id          - Modifier ID (mod_ + 16 hex)
 * @property {string} type
 * @property {string} effect
 * @property {string} application
 * @property {number} value
 * @property {string} label
 * @property {object} metadata
 */

// =============================================================================
// Dual Measurement
// =============================================================================

/**
 * @typedef {object} DualMeasurement
 * @property {MeasurementView} probability - Probability view (0-1 scale)
 * @property {MeasurementView} scaled      - Scaled view (0-maximumValue)
 */

/**
 * @typedef {object} MeasurementView
 * @property {number} base       - Base value before modifiers
 * @property {number} adjustment - Modifier adjustment (base - effective)
 * @property {number} effective  - Effective value after modifiers
 */

// =============================================================================
// Hierarchy
// =============================================================================

/**
 * @typedef {object} HierarchyNode
 * @property {string}          id        - Node ID (nod_ + 16 hex)
 * @property {string}          level     - Level name
 * @property {string}          label     - Node label
 * @property {DualMeasurement} aggregate - Subtree aggregate
 * @property {HierarchyNode[]} children  - Child nodes
 * @property {Factor[]}        factors   - Leaf factors (only on deepest level)
 * @property {object}          metadata
 */

// =============================================================================
// RSK/VM
// =============================================================================

/**
 * @typedef {object} AggregateResult
 * @property {number}   aggregate    - RSK aggregate value
 * @property {number[]} measurements - Sorted measurement array
 * @property {number}   scalingBase
 * @property {number}   upperBound
 */

/**
 * @typedef {object} AddResult
 * @property {number}   aggregate         - New aggregate
 * @property {number[]} measurements      - Updated sorted measurements
 * @property {number}   previousAggregate - Aggregate before addition
 */

/**
 * @typedef {object} NormalizeResult
 * @property {number} normalized - Normalized value (0 to maximumValue)
 * @property {number} raw        - Input raw aggregate
 * @property {number} upperBound
 */

/**
 * @typedef {object} RateResult
 * @property {string}   rating      - Qualitative rating label
 * @property {number}   measurement - Input measurement
 * @property {number[]} thresholds
 * @property {string[]} labels
 */

/**
 * @typedef {object} ScoreResult
 * @property {number}   aggregate
 * @property {number}   normalized
 * @property {string}   rating
 * @property {number[]} measurements - Sorted input
 * @property {number}   scalingBase
 * @property {number}   maximumValue
 */

/**
 * @typedef {object} LimitResult
 * @property {number} upperBound
 * @property {number} maximumValue
 * @property {number} scalingBase
 */

// =============================================================================
// RSK/RM
// =============================================================================

/**
 * @typedef {object} RiskFactor
 * @property {number} baseMeasurement  - Base V-factor value
 * @property {number} [confidence]     - Confidence modifier
 * @property {number} [assetValue]     - Asset value
 * @property {number} [threatPotential] - Threat potential
 */

/**
 * @typedef {object} SleResult
 * @property {number} singleLossExpectancy
 * @property {number} assetValue
 * @property {number} vulnerability
 * @property {number} controlEfficacy
 */

/**
 * @typedef {object} DleResult
 * @property {number} distributedLossExpectancy
 * @property {number} assetValue
 * @property {number} threatPotential
 * @property {number} vulnerability
 * @property {number} controlEfficacy
 */

// =============================================================================
// IAP
// =============================================================================

/**
 * @typedef {object} Ham533Result
 * @property {number} probability - Computed threat probability
 */

/**
 * @typedef {object} Crve3Result
 * @property {number} exposure - Computed vulnerability exposure
 */

/**
 * @typedef {object} ScepResult
 * @property {number} efficacy - Computed control efficacy
 */

/**
 * @typedef {object} AssetValuationResult
 * @property {number} assetValue - Computed asset value
 */

// =============================================================================
// NIST
// =============================================================================

/**
 * @typedef {object} NistRiskMatrixResult
 * @property {string} riskLevel  - Qualitative risk level
 * @property {number} likelihood - Numeric likelihood
 * @property {number} impact     - Numeric impact
 */

// =============================================================================
// Errors
// =============================================================================

/**
 * @typedef {object} ApiErrorEnvelope
 * @property {object} error
 * @property {string} error.code    - Machine-readable code (e.g. 'VALIDATION_ERROR')
 * @property {string} error.message - Human-readable message
 * @property {*}      [error.details] - Optional structured details
 */

export default {}

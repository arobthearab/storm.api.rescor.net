/**
 * @rescor-llc/storm-sdk — Node.js SDK for the STORM Risk Computation Engine API.
 *
 * Usage:
 *   import { Storm } from '@rescor-llc/storm-sdk'
 *
 *   const storm = new Storm({ baseUrl: 'http://localhost:3200', token: 'dev' })
 *
 *   // Measurement lifecycle
 *   const measurement = await storm.measurement()
 *     .name('Web App Scan')
 *     .hierarchy('security_scan')
 *     .create()
 *
 *   // Add factors and modifiers fluently
 *   const factor = await storm.measurement(measurement.id)
 *     .factor()
 *     .value(0.80)
 *     .label('SQL Injection')
 *     .add()
 *
 *   // Stateless RSK/VM computations
 *   const score = await storm.rsk().vm().measurements([80, 60, 40]).score()
 *
 *   // IAP processes
 *   const threat = await storm.iap().ham533({ capability: 0.8, intent: 0.7, targeting: 0.6 })
 *
 *   // NIST risk matrix
 *   const risk = await storm.nist().riskMatrix({ likelihood: 'High', impact: 'Moderate' })
 *
 *   // Health check
 *   const health = await storm.health()
 */

import { StormClient } from './StormClient.mjs'
import { MeasurementBuilder, MeasurementSession } from './builders/MeasurementBuilder.mjs'
import { RskBuilder } from './builders/RskBuilder.mjs'
import { IapBuilder } from './builders/IapBuilder.mjs'
import { NistBuilder } from './builders/NistBuilder.mjs'

/**
 * Top-level SDK entry point — wraps StormClient with fluent builder access.
 */
export class Storm {
  /**
   * @param {import('./models/types.mjs').StormOptions} options
   */
  constructor (options = {}) {
    this.client = new StormClient(options)
  }

  /**
   * Start a measurement operation.
   *
   * Without an ID: returns a MeasurementBuilder for creating a new measurement.
   * With an ID: returns a MeasurementSession for operating on an existing measurement.
   *
   * @param {string} [measurementId] - Existing measurement ID
   * @returns {MeasurementBuilder|MeasurementSession}
   */
  measurement (measurementId) {
    let result

    if (measurementId) {
      result = new MeasurementSession(this.client, measurementId)
    } else {
      result = new MeasurementBuilder(this.client)
    }

    return result
  }

  /**
   * Access RSK computation builders.
   * @returns {RskBuilder}
   */
  rsk () {
    const result = new RskBuilder(this.client)
    return result
  }

  /**
   * Access IAP computation builders.
   * @returns {IapBuilder}
   */
  iap () {
    const result = new IapBuilder(this.client)
    return result
  }

  /**
   * Access NIST computation builders.
   * @returns {NistBuilder}
   */
  nist () {
    const result = new NistBuilder(this.client)
    return result
  }

  /**
   * GET /health — check API health.
   * @returns {Promise<object>}
   */
  async health () {
    const result = await this.client.get('/health')
    return result
  }
}

// Re-export everything for direct consumption
export { StormClient } from './StormClient.mjs'
export {
  MeasurementBuilder,
  MeasurementSession,
  FactorBuilder,
  ModifierBuilder
} from './builders/MeasurementBuilder.mjs'
export { RskBuilder, RskVmBuilder, RskRmBuilder } from './builders/RskBuilder.mjs'
export { IapBuilder } from './builders/IapBuilder.mjs'
export { NistBuilder } from './builders/NistBuilder.mjs'
export { Factor, Modifier } from './models/Factor.mjs'
export { FactorBatch, FactorBatchResult } from './models/FactorBatch.mjs'
export {
  StormError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
  NetworkError,
  mapApiError
} from './errors/StormError.mjs'
export { createKeycloakTokenProvider } from './auth/KeycloakTokenProvider.mjs'

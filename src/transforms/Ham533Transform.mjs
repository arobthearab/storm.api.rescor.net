/**
 * HAM533 Transform — Threat Assessment
 *
 * Hostile Actor Model: History × Access × Means
 * Factor scales: H(1–5), A(1–3), M(1–3) → max product = 45
 *
 * Domain: threat
 * Model:  ham533
 */

import { Transform } from './Transform.mjs'

export class Ham533Transform extends Transform {
  static get domain () { return 'threat' }
  static get model () { return 'ham533' }
  static get description () { return 'Hostile Actor Model (5-3-3) threat assessment' }

  factors () {
    const definitions = [
      { name: 'history', type: 'number', required: true, integer: true, min: 1, max: 5, description: 'Historical occurrence (1=Improbable … 5=Continuous)' },
      { name: 'access', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Threat proximity (1=Outsider … 3=Privileged)' },
      { name: 'means', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Resources/capabilities (1=Individual … 3=Nation State)' }
    ]
    return definitions
  }

  compute (validated) {
    const { history, access, means } = validated
    const product = history * access * means
    const probability = product / 45
    const impact = (5 * access * means) / 45

    const result = {
      probability,
      impact,
      factors: { history, access, means, product }
    }
    return result
  }
}

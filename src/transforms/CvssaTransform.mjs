/**
 * CVSSA Transform — Vulnerability Assessment (Technical)
 *
 * CVSS Adaptation: converts a CVSS v3/v4 base score (0–10) into
 * the STORM raw space (0–1), with optional environmental and
 * temporal adjustment multipliers.
 *
 * Domain: vulnerability
 * Model:  cvssa
 */

import { Transform } from './Transform.mjs'

export class CvssaTransform extends Transform {
  static get domain () { return 'vulnerability' }
  static get model () { return 'cvssa' }
  static get description () { return 'CVSS Adaptation — technical vulnerability assessment' }

  factors () {
    const definitions = [
      { name: 'baseScore', type: 'number', required: true, min: 0, max: 10, description: 'CVSS base score (0.0–10.0)' },
      { name: 'temporalMultiplier', type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Temporal adjustment (0–1, default 1 = no adjustment)' },
      { name: 'environmentalMultiplier', type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Environmental relevance (0–1, default 1 = fully applicable)' }
    ]
    return definitions
  }

  compute (validated) {
    const { baseScore, temporalMultiplier, environmentalMultiplier } = validated

    const normalizedBase = baseScore / 10
    const adjustedScore = normalizedBase * temporalMultiplier * environmentalMultiplier
    const exposure = Math.min(1, Math.max(0, adjustedScore))

    const result = {
      exposure,
      normalizedBase,
      adjustedScore,
      factors: { baseScore, temporalMultiplier, environmentalMultiplier }
    }
    return result
  }
}

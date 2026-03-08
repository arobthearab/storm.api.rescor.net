/**
 * CRVE3 Transform — Vulnerability Exposure (Non-Technical)
 *
 * Capabilities × Resources × Visibility combined with CIA exposure
 * via RSK aggregate. Basic factors are multiplicative (3×3×3=27 max),
 * CIA factors use diminishing-weight aggregation.
 *
 * Domain: vulnerability
 * Model:  crve3
 */

import { Transform } from './Transform.mjs'
import { rskAggregate } from '../engines/rsk.mjs'

export class Crve3Transform extends Transform {
  static get domain () { return 'vulnerability' }
  static get model () { return 'crve3' }
  static get description () { return 'Capabilities, Resources, Visibility + CIA Exposure (non-technical vulnerability)' }

  factors () {
    const definitions = [
      { name: 'capabilities', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Threat actor capabilities (1=Expert … 3=Unskilled)' },
      { name: 'resources', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Threat actor resources (1=Nation State … 3=Individual)' },
      { name: 'visibility', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Target visibility (1=Need-to-Know … 3=Public)' },
      { name: 'confidentiality', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Confidentiality exposure (1=Minimal … 3=Extensive)' },
      { name: 'integrity', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Integrity exposure (1=Minimal … 3=Extensive)' },
      { name: 'availability', type: 'number', required: true, integer: true, min: 1, max: 3, description: 'Availability exposure (1=Minimal … 3=Extensive)' }
    ]
    return definitions
  }

  compute (validated) {
    const { capabilities, resources, visibility, confidentiality, integrity, availability } = validated
    const scalingBase = this.options.scalingBase ?? 4

    const basic = capabilities * resources * visibility
    const basicMax = 27

    const ciaValues = [confidentiality, integrity, availability]
    const cia = rskAggregate(ciaValues, scalingBase)
    const ciaMax = rskAggregate([3, 3, 3], scalingBase)

    const exposure = (cia * basic) / (ciaMax * basicMax)

    const result = { exposure, basic, cia, ciaMax, basicMax }
    return result
  }
}

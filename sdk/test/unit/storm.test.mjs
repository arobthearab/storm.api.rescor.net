/**
 * Unit tests for the Storm facade and fluent builders.
 */

import { describe, it, expect, vi } from 'vitest'
import { Storm } from '../../src/index.mjs'
import { MeasurementBuilder, MeasurementSession } from '../../src/builders/MeasurementBuilder.mjs'
import { RskBuilder } from '../../src/builders/RskBuilder.mjs'
import { IapBuilder } from '../../src/builders/IapBuilder.mjs'
import { NistBuilder } from '../../src/builders/NistBuilder.mjs'

/**
 * Create a Storm instance with a mock fetch.
 */
function createStorm (status, body) {
  const fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  })
  const storm = new Storm({ fetch })
  return { storm, fetch }
}

describe('Storm facade', () => {
  it('should return MeasurementBuilder when no ID given', () => {
    const { storm } = createStorm(200, { data: {} })
    const builder = storm.measurement()
    expect(builder).toBeInstanceOf(MeasurementBuilder)
  })

  it('should return MeasurementSession when ID given', () => {
    const { storm } = createStorm(200, { data: {} })
    const session = storm.measurement('msr_abc123')
    expect(session).toBeInstanceOf(MeasurementSession)
  })

  it('should return RskBuilder from rsk()', () => {
    const { storm } = createStorm(200, { data: {} })
    expect(storm.rsk()).toBeInstanceOf(RskBuilder)
  })

  it('should return IapBuilder from iap()', () => {
    const { storm } = createStorm(200, { data: {} })
    expect(storm.iap()).toBeInstanceOf(IapBuilder)
  })

  it('should return NistBuilder from nist()', () => {
    const { storm } = createStorm(200, { data: {} })
    expect(storm.nist()).toBeInstanceOf(NistBuilder)
  })

  it('should call GET /health', async () => {
    const { storm, fetch } = createStorm(200, { data: { status: 'healthy' } })
    const result = await storm.health()
    expect(result.status).toBe('healthy')
    expect(fetch.mock.calls[0][0]).toContain('/health')
  })
})

describe('MeasurementBuilder', () => {
  it('should build and POST a create request', async () => {
    const responseData = {
      id: 'msr_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      name: 'Web App Scan',
      hierarchy: { template: 'security_scan', levels: ['test', 'horizon', 'host', 'finding', 'annotation'] }
    }
    const { storm, fetch } = createStorm(201, { data: responseData })

    const result = await storm.measurement()
      .name('Web App Scan')
      .hierarchy('security_scan')
      .scalingBase(4)
      .maximumValue(100)
      .ttl(86400)
      .metadata({ project: 'test' })
      .create()

    expect(result.id).toMatch(/^msr_/)
    expect(result.name).toBe('Web App Scan')

    const requestBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(requestBody.name).toBe('Web App Scan')
    expect(requestBody.hierarchy).toBe('security_scan')
    expect(requestBody.scalingBase).toBe(4)
    expect(requestBody.maximumValue).toBe(100)
    expect(requestBody.ttl).toBe(86400)
    expect(requestBody.metadata).toEqual({ project: 'test' })
  })
})

describe('MeasurementSession', () => {
  it('should GET measurement by ID', async () => {
    const { storm, fetch } = createStorm(200, { data: { id: 'msr_abc', factorCount: 5 } })
    const result = await storm.measurement('msr_abc').get()
    expect(result.id).toBe('msr_abc')
    expect(fetch.mock.calls[0][0]).toContain('/v1/measurements/msr_abc')
  })

  it('should DELETE measurement', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    const storm = new Storm({ fetch })
    const result = await storm.measurement('msr_abc').delete()
    expect(result).toBe(true)
  })

  it('should build and POST a factor', async () => {
    const factorData = { id: 'fct_001', value: 0.8, label: 'SQL Injection' }
    const { storm, fetch } = createStorm(201, { data: factorData })

    const result = await storm.measurement('msr_abc')
      .factor()
      .value(0.8)
      .label('SQL Injection')
      .path(['External', 'web-server'])
      .metadata({ cve: 'CVE-2025-1234' })
      .add()

    expect(result.id).toBe('fct_001')
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(requestBody.value).toBe(0.8)
    expect(requestBody.label).toBe('SQL Injection')
    expect(requestBody.path).toEqual(['External', 'web-server'])
  })

  it('should list factors', async () => {
    const { storm, fetch } = createStorm(200, { data: [{ id: 'fct_001' }, { id: 'fct_002' }] })
    const result = await storm.measurement('msr_abc').listFactors()
    expect(result).toHaveLength(2)
    expect(fetch.mock.calls[0][0]).toContain('/factors')
  })

  it('should PATCH a factor', async () => {
    const { storm, fetch } = createStorm(200, { data: { id: 'fct_001', value: 0.9 } })
    const result = await storm.measurement('msr_abc').updateFactor('fct_001', { value: 0.9 })
    expect(result.value).toBe(0.9)
    expect(fetch.mock.calls[0][1].method).toBe('PATCH')
  })

  it('should DELETE a factor', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    const storm = new Storm({ fetch })
    const result = await storm.measurement('msr_abc').deleteFactor('fct_001')
    expect(result).toBe(true)
  })

  it('should build and POST a modifier', async () => {
    const factorData = {
      id: 'fct_001',
      modifiers: [{ id: 'mod_001', type: 'confidence', value: 0.75 }]
    }
    const { storm, fetch } = createStorm(201, { data: factorData })

    const result = await storm.measurement('msr_abc')
      .modifier('fct_001')
      .type('confidence')
      .effect('attenuate')
      .application('direct')
      .value(0.75)
      .label('Expert confidence')
      .metadata({ source: 'assessment' })
      .add()

    expect(result.modifiers).toHaveLength(1)
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(requestBody.type).toBe('confidence')
    expect(requestBody.value).toBe(0.75)
  })

  it('should DELETE a modifier', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    const storm = new Storm({ fetch })
    const result = await storm.measurement('msr_abc').deleteModifier('mod_001')
    expect(result).toBe(true)
  })
})

describe('RSK/VM builder', () => {
  it('should POST aggregate request', async () => {
    const { storm, fetch } = createStorm(200, {
      data: { aggregate: 150, measurements: [80, 60], scalingBase: 4, upperBound: 133 }
    })

    const result = await storm.rsk().vm()
      .measurements([80, 60])
      .scalingBase(4)
      .aggregate()

    expect(result.aggregate).toBe(150)
    expect(fetch.mock.calls[0][0]).toContain('/v1/rsk/vm/aggregate')
  })

  it('should POST add request', async () => {
    const { storm } = createStorm(200, { data: { aggregate: 200, measurements: [80, 60, 40] } })
    const result = await storm.rsk().vm()
      .measurements([80, 60])
      .measurement(40)
      .add()
    expect(result.measurements).toEqual([80, 60, 40])
  })

  it('should POST normalize request', async () => {
    const { storm } = createStorm(200, { data: { normalized: 75, raw: 245 } })
    const result = await storm.rsk().vm().raw(245).normalize()
    expect(result.normalized).toBe(75)
  })

  it('should POST rate request', async () => {
    const { storm } = createStorm(200, { data: { rating: 'High', measurement: 75 } })
    const result = await storm.rsk().vm().measurement(75).rate()
    expect(result.rating).toBe('High')
  })

  it('should POST score request', async () => {
    const { storm } = createStorm(200, { data: { aggregate: 150, normalized: 75, rating: 'High' } })
    const result = await storm.rsk().vm()
      .measurements([80, 60])
      .scalingBase(4)
      .maximumValue(100)
      .score()
    expect(result.rating).toBe('High')
  })

  it('should POST limit request', async () => {
    const { storm } = createStorm(200, { data: { upperBound: 133, maximumValue: 100, scalingBase: 4 } })
    const result = await storm.rsk().vm()
      .maximumValue(100)
      .scalingBase(4)
      .limit()
    expect(result.upperBound).toBe(133)
  })
})

describe('RSK/RM builder', () => {
  it('should POST adjust request', async () => {
    const { storm, fetch } = createStorm(200, { data: { adjusted: [0.6] } })

    const result = await storm.rsk().rm()
      .riskFactors([{ baseMeasurement: 0.8 }])
      .scalingBase(4)
      .adjust()

    expect(result).toBeDefined()
    expect(fetch.mock.calls[0][0]).toContain('/v1/rsk/rm/adjust')
  })

  it('should POST sle request', async () => {
    const { storm } = createStorm(200, { data: { singleLossExpectancy: 0.336 } })
    const result = await storm.rsk().rm()
      .assetValue(0.8)
      .vulnerability(0.6)
      .controlEfficacy(0.3)
      .sle()
    expect(result.singleLossExpectancy).toBe(0.336)
  })

  it('should POST dle request', async () => {
    const { storm } = createStorm(200, { data: { distributedLossExpectancy: 0.235 } })
    const result = await storm.rsk().rm()
      .assetValue(0.8)
      .threatPotential(0.7)
      .vulnerability(0.6)
      .controlEfficacy(0.3)
      .dle()
    expect(result.distributedLossExpectancy).toBe(0.235)
  })

  it('should POST assess request', async () => {
    const { storm, fetch } = createStorm(200, { data: { riskScore: 42 } })
    const result = await storm.rsk().rm()
      .riskFactors([{ baseMeasurement: 0.8 }])
      .asset(0.9)
      .threat(0.7)
      .vulnerability(0.6)
      .control(0.3)
      .scalingBase(4)
      .maximumValue(100)
      .assess()
    expect(result.riskScore).toBe(42)
    expect(fetch.mock.calls[0][0]).toContain('/v1/rsk/rm/assess')
  })
})

describe('IAP builder', () => {
  it('should POST ham533 request', async () => {
    const { storm, fetch } = createStorm(200, { data: { probability: 0.65 } })
    const result = await storm.iap().ham533({ capability: 0.8, intent: 0.7, targeting: 0.6 })
    expect(result.probability).toBe(0.65)
    expect(fetch.mock.calls[0][0]).toContain('/v1/iap/ham533')
  })

  it('should POST crve3 request with scalingBase', async () => {
    const { storm, fetch } = createStorm(200, { data: { exposure: 0.55 } })
    const result = await storm.iap().crve3({ complexity: 0.4, reach: 0.5 }, 4)
    expect(result.exposure).toBe(0.55)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.scalingBase).toBe(4)
  })

  it('should POST scep request', async () => {
    const { storm, fetch } = createStorm(200, { data: { efficacy: 0.7 } })
    const result = await storm.iap().scep({ controls: [{ efficacy: 0.6 }] })
    expect(result.efficacy).toBe(0.7)
    expect(fetch.mock.calls[0][0]).toContain('/v1/iap/scep')
  })

  it('should POST asset-valuation request', async () => {
    const { storm, fetch } = createStorm(200, { data: { assetValue: 0.85 } })
    const result = await storm.iap().assetValuation({ sensitivity: 0.9, criticality: 0.8 })
    expect(result.assetValue).toBe(0.85)
    expect(fetch.mock.calls[0][0]).toContain('/v1/iap/asset-valuation')
  })
})

describe('NIST builder', () => {
  it('should POST risk-matrix request', async () => {
    const { storm, fetch } = createStorm(200, { data: { riskLevel: 'High' } })
    const result = await storm.nist().riskMatrix({ likelihood: 'High', impact: 'Moderate' })
    expect(result.riskLevel).toBe('High')
    expect(fetch.mock.calls[0][0]).toContain('/v1/nist/risk-matrix')
  })
})

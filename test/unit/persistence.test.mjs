/**
 * Unit tests for the measurement persistence layer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MeasurementStore } from '../../src/persistence/MeasurementStore.mjs'

describe('MeasurementStore', () => {
  let store

  beforeEach(() => {
    store = new MeasurementStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  describe('measurements', () => {
    it('should create and retrieve a measurement', () => {
      const measurement = store.createMeasurement({ name: 'Test Assessment' })
      expect(measurement.id).toMatch(/^msr_/)
      expect(measurement.name).toBe('Test Assessment')
      expect(measurement.hierarchy.template).toBe('default')
      expect(measurement.hierarchy.levels).toEqual(['items'])
      expect(measurement.configuration.scalingBase).toBe(4)
      expect(measurement.configuration.maximumValue).toBe(100)
    })

    it('should create with custom hierarchy', () => {
      const measurement = store.createMeasurement({
        name: 'Scan',
        hierarchy: 'security_scan'
      })
      expect(measurement.hierarchy.template).toBe('security_scan')
      expect(measurement.hierarchy.levels).toEqual(['test', 'horizon', 'host', 'finding', 'annotation'])
    })

    it('should create with custom array hierarchy', () => {
      const measurement = store.createMeasurement({
        name: 'Custom',
        hierarchy: ['project', 'component', 'issue']
      })
      expect(measurement.hierarchy.template).toBe('custom')
      expect(measurement.hierarchy.levels).toEqual(['project', 'component', 'issue'])
    })

    it('should delete a measurement', () => {
      const measurement = store.createMeasurement({ name: 'Temp' })
      expect(store.deleteMeasurement(measurement.id)).toBe(true)
      expect(store.getMeasurement(measurement.id)).toBeNull()
    })

    it('should return null for nonexistent measurement', () => {
      expect(store.getMeasurement('msr_nonexistent')).toBeNull()
    })
  })

  describe('factors', () => {
    let measurementId

    beforeEach(() => {
      const measurement = store.createMeasurement({ name: 'Test' })
      measurementId = measurement.id
    })

    it('should add a factor', () => {
      const factor = store.addFactor(measurementId, { value: 0.75, label: 'SQL Injection' })
      expect(factor.id).toMatch(/^fct_/)
      expect(factor.value).toBe(0.75)
      expect(factor.label).toBe('SQL Injection')
    })

    it('should list factors', () => {
      store.addFactor(measurementId, { value: 0.8 })
      store.addFactor(measurementId, { value: 0.6 })
      const factors = store.listFactors(measurementId)
      expect(factors).toHaveLength(2)
    })

    it('should update a factor', () => {
      const factor = store.addFactor(measurementId, { value: 0.5 })
      const updated = store.updateFactor(measurementId, factor.id, { value: 0.9 })
      expect(updated.value).toBe(0.9)
    })

    it('should delete a factor', () => {
      const factor = store.addFactor(measurementId, { value: 0.5 })
      expect(store.deleteFactor(measurementId, factor.id)).toBe(true)
      expect(store.listFactors(measurementId)).toHaveLength(0)
    })

    it('should create nodes from path', () => {
      store.addFactor(measurementId, {
        value: 0.7,
        path: ['root']
      })
      const tree = store.buildTree(measurementId)
      expect(tree.length).toBeGreaterThan(0)
    })
  })

  describe('modifiers', () => {
    let measurementId
    let factorId

    beforeEach(() => {
      const measurement = store.createMeasurement({ name: 'Test' })
      measurementId = measurement.id
      const factor = store.addFactor(measurementId, { value: 0.8 })
      factorId = factor.id
    })

    it('should add a confidence modifier', () => {
      const factor = store.addModifier(measurementId, factorId, {
        type: 'confidence',
        value: 0.75
      })
      expect(factor.modifiers).toHaveLength(1)
      expect(factor.modifiers[0].type).toBe('confidence')
      expect(factor.modifiers[0].application).toBe('direct')
    })

    it('should add a control modifier', () => {
      const factor = store.addModifier(measurementId, factorId, {
        type: 'control',
        value: 0.5
      })
      expect(factor.modifiers[0].application).toBe('compound')
    })

    it('should delete a modifier', () => {
      const factor = store.addModifier(measurementId, factorId, {
        type: 'confidence',
        value: 0.9
      })
      const modifierId = factor.modifiers[0].id
      expect(store.deleteModifier(measurementId, modifierId)).toBe(true)
    })
  })

  describe('hierarchy tree', () => {
    it('should build tree with security_scan template', () => {
      const measurement = store.createMeasurement({
        name: 'Pen Test',
        hierarchy: 'security_scan'
      })

      store.addFactor(measurement.id, {
        value: 0.8,
        path: ['External', 'web-server', '192.168.1.1', 'CVE-2024-001']
      })

      store.addFactor(measurement.id, {
        value: 0.5,
        path: ['External', 'web-server', '192.168.1.1', 'CVE-2024-002']
      })

      const tree = store.buildTree(measurement.id)
      expect(tree).toHaveLength(1) // One root: "External"
      expect(tree[0].label).toBe('External')
      expect(tree[0].children).toHaveLength(1) // "web-server"
    })
  })
})

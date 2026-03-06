/**
 * SQLite persistence for measurement sessions.
 *
 * Provides CRUD operations for measurements, factors, and modifiers.
 * TTL-based auto-purge of expired sessions.
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

const HIERARCHY_TEMPLATES = {
  default: ['items'],
  basic_questionnaire: ['questionnaire', 'section', 'question'],
  security_scan: ['test', 'horizon', 'host', 'finding', 'annotation']
}

/**
 * Measurement store backed by SQLite.
 */
export class MeasurementStore {
  /**
   * @param {string} databasePath - Path to SQLite file (default: in-memory)
   */
  constructor (databasePath = ':memory:') {
    this.database = new Database(databasePath)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this._createSchema()
  }

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  _createSchema () {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        template      TEXT NOT NULL DEFAULT 'default',
        levels        TEXT NOT NULL DEFAULT '["items"]',
        scaling_base  REAL NOT NULL DEFAULT 4,
        maximum_value REAL NOT NULL DEFAULT 100,
        metadata      TEXT DEFAULT '{}',
        created_at    TEXT NOT NULL,
        expires_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id              TEXT PRIMARY KEY,
        measurement_id  TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
        parent_id       TEXT REFERENCES nodes(id) ON DELETE CASCADE,
        level           TEXT NOT NULL,
        label           TEXT NOT NULL DEFAULT '',
        sort_order      INTEGER NOT NULL DEFAULT 0,
        metadata        TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_measurement ON nodes(measurement_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);

      CREATE TABLE IF NOT EXISTS factors (
        id              TEXT PRIMARY KEY,
        measurement_id  TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
        node_id         TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        value           REAL NOT NULL,
        label           TEXT NOT NULL DEFAULT '',
        path            TEXT NOT NULL DEFAULT '[]',
        metadata        TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_factors_measurement ON factors(measurement_id);
      CREATE INDEX IF NOT EXISTS idx_factors_node ON factors(node_id);

      CREATE TABLE IF NOT EXISTS modifiers (
        id              TEXT PRIMARY KEY,
        factor_id       TEXT NOT NULL REFERENCES factors(id) ON DELETE CASCADE,
        measurement_id  TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
        type            TEXT NOT NULL,
        effect          TEXT NOT NULL DEFAULT 'attenuate',
        application     TEXT NOT NULL DEFAULT 'direct',
        value           REAL NOT NULL,
        label           TEXT NOT NULL DEFAULT '',
        metadata        TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_modifiers_factor ON modifiers(factor_id);
      CREATE INDEX IF NOT EXISTS idx_modifiers_measurement ON modifiers(measurement_id);
    `)
  }

  // -------------------------------------------------------------------------
  // ID generators
  // -------------------------------------------------------------------------

  _measurementId () { return 'msr_' + randomUUID().replace(/-/g, '') }
  _nodeId ()        { return 'nod_' + randomUUID().replace(/-/g, '').slice(0, 16) }
  _factorId ()      { return 'fct_' + randomUUID().replace(/-/g, '').slice(0, 16) }
  _modifierId ()    { return 'mod_' + randomUUID().replace(/-/g, '').slice(0, 16) }

  // -------------------------------------------------------------------------
  // Measurements
  // -------------------------------------------------------------------------

  /**
   * Create a new measurement session.
   *
   * @param {object} input - CreateMeasurementRequest fields
   * @returns {object} Created measurement record
   */
  createMeasurement (input) {
    const id = this._measurementId()
    const now = new Date()
    const ttl = input.ttl || 86400
    const expiresAt = new Date(now.getTime() + ttl * 1000)

    let template
    let levels
    if (Array.isArray(input.hierarchy)) {
      template = 'custom'
      levels = input.hierarchy
    } else {
      template = input.hierarchy || 'default'
      levels = HIERARCHY_TEMPLATES[template] || HIERARCHY_TEMPLATES.default
    }

    this.database.prepare(`
      INSERT INTO measurements (id, name, template, levels, scaling_base, maximum_value, metadata, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name || '',
      template,
      JSON.stringify(levels),
      input.scalingBase || 4,
      input.maximumValue || 100,
      JSON.stringify(input.metadata || {}),
      now.toISOString(),
      expiresAt.toISOString()
    )

    const result = this.getMeasurement(id)
    return result
  }

  /**
   * Retrieve a measurement by ID.
   *
   * @param {string} id - Measurement ID
   * @returns {object|null} Measurement record or null if not found / expired
   */
  getMeasurement (id) {
    this._purgeExpired()

    const row = this.database.prepare('SELECT * FROM measurements WHERE id = ?').get(id)

    let result = null

    if (row) {
      result = {
        id: row.id,
        name: row.name,
        hierarchy: {
          template: row.template,
          levels: JSON.parse(row.levels)
        },
        configuration: {
          scalingBase: row.scaling_base,
          maximumValue: row.maximum_value
        },
        factorCount: this._countFactors(row.id),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        metadata: JSON.parse(row.metadata)
      }
    }

    return result
  }

  /**
   * Delete a measurement and all children.
   *
   * @param {string} id - Measurement ID
   * @returns {boolean} True if deleted
   */
  deleteMeasurement (id) {
    const info = this.database.prepare('DELETE FROM measurements WHERE id = ?').run(id)
    const result = info.changes > 0
    return result
  }

  // -------------------------------------------------------------------------
  // Nodes (hierarchy)
  // -------------------------------------------------------------------------

  /**
   * Find or create a hierarchy node for the given path.
   *
   * @param {string}   measurementId - Parent measurement
   * @param {string[]} path          - Labels for each grouping level above the leaf
   * @param {string[]} levels        - Hierarchy level names
   * @returns {string} Leaf-parent node ID
   */
  ensureNodePath (measurementId, path, levels) {
    let parentId = null

    // Walk down from the root, creating intermediate nodes as needed
    for (let depth = 0; depth < path.length; depth++) {
      const level = levels[depth] || `level_${depth}`
      const label = path[depth]

      let existing
      if (parentId == null) {
        existing = this.database.prepare(
          'SELECT id FROM nodes WHERE measurement_id = ? AND level = ? AND label = ? AND parent_id IS NULL'
        ).get(measurementId, level, label)
      } else {
        existing = this.database.prepare(
          'SELECT id FROM nodes WHERE measurement_id = ? AND level = ? AND label = ? AND parent_id = ?'
        ).get(measurementId, level, label, parentId)
      }

      if (existing) {
        parentId = existing.id
      } else {
        const nodeId = this._nodeId()
        this.database.prepare(
          'INSERT INTO nodes (id, measurement_id, parent_id, level, label) VALUES (?, ?, ?, ?, ?)'
        ).run(nodeId, measurementId, parentId, level, label)
        parentId = nodeId
      }
    }

    // If no path was given, use a default root node
    if (parentId == null) {
      const rootLevel = levels[0] || 'items'
      let rootNode = this.database.prepare(
        'SELECT id FROM nodes WHERE measurement_id = ? AND level = ? AND parent_id IS NULL'
      ).get(measurementId, rootLevel)

      if (!rootNode) {
        const rootId = this._nodeId()
        this.database.prepare(
          'INSERT INTO nodes (id, measurement_id, parent_id, level, label) VALUES (?, ?, ?, ?, ?)'
        ).run(rootId, measurementId, null, rootLevel, 'root')
        parentId = rootId
      } else {
        parentId = rootNode.id
      }
    }

    const result = parentId
    return result
  }

  // -------------------------------------------------------------------------
  // Factors
  // -------------------------------------------------------------------------

  /**
   * Add a V-factor to a measurement.
   *
   * @param {string} measurementId - Parent measurement
   * @param {object} input         - AddFactorRequest
   * @returns {object} Created factor record
   */
  addFactor (measurementId, input) {
    const measurement = this.getMeasurement(measurementId)
    if (!measurement) {
      return null
    }

    const levels = measurement.hierarchy.levels
    const path = input.path || []
    const nodeId = this.ensureNodePath(measurementId, path, levels)

    const factorId = this._factorId()

    this.database.prepare(`
      INSERT INTO factors (id, measurement_id, node_id, value, label, path, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      factorId,
      measurementId,
      nodeId,
      input.value,
      input.label || '',
      JSON.stringify(path),
      JSON.stringify(input.metadata || {})
    )

    const result = this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Get a factor by ID.
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @returns {object|null}
   */
  getFactor (measurementId, factorId) {
    const row = this.database.prepare(
      'SELECT * FROM factors WHERE id = ? AND measurement_id = ?'
    ).get(factorId, measurementId)

    let result = null

    if (row) {
      const modifierRows = this.database.prepare(
        'SELECT * FROM modifiers WHERE factor_id = ?'
      ).all(factorId)

      result = {
        id: row.id,
        nodeId: row.node_id,
        path: JSON.parse(row.path),
        value: row.value,
        label: row.label,
        modifiers: modifierRows.map(m => ({
          id: m.id,
          type: m.type,
          effect: m.effect,
          application: m.application,
          value: m.value,
          label: m.label,
          metadata: JSON.parse(m.metadata)
        })),
        metadata: JSON.parse(row.metadata)
      }
    }

    return result
  }

  /**
   * List all factors for a measurement.
   *
   * @param {string} measurementId
   * @returns {object[]}
   */
  listFactors (measurementId) {
    const rows = this.database.prepare(
      'SELECT id FROM factors WHERE measurement_id = ? ORDER BY rowid'
    ).all(measurementId)

    const result = rows.map(row => this.getFactor(measurementId, row.id))
    return result
  }

  /**
   * Update a factor (partial update).
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @param {object} input - UpdateFactorRequest fields
   * @returns {object|null}
   */
  updateFactor (measurementId, factorId, input) {
    const existing = this.getFactor(measurementId, factorId)
    if (!existing) {
      return null
    }

    const updates = []
    const parameters = []

    if (input.value != null) {
      updates.push('value = ?')
      parameters.push(input.value)
    }

    if (input.label != null) {
      updates.push('label = ?')
      parameters.push(input.label)
    }

    if (input.metadata != null) {
      updates.push('metadata = ?')
      parameters.push(JSON.stringify(input.metadata))
    }

    if (updates.length > 0) {
      parameters.push(factorId, measurementId)
      this.database.prepare(
        `UPDATE factors SET ${updates.join(', ')} WHERE id = ? AND measurement_id = ?`
      ).run(...parameters)
    }

    const result = this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Delete a factor.
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @returns {boolean}
   */
  deleteFactor (measurementId, factorId) {
    const info = this.database.prepare(
      'DELETE FROM factors WHERE id = ? AND measurement_id = ?'
    ).run(factorId, measurementId)
    const result = info.changes > 0
    return result
  }

  // -------------------------------------------------------------------------
  // Modifiers
  // -------------------------------------------------------------------------

  /**
   * Add a modifier to a factor.
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @param {object} input - AddModifierRequest
   * @returns {object|null}
   */
  addModifier (measurementId, factorId, input) {
    const factor = this.getFactor(measurementId, factorId)
    if (!factor) {
      return null
    }

    let application = input.application
    if (!application) {
      if (input.type === 'confidence') {
        application = 'direct'
      } else if (input.type === 'control') {
        application = 'compound'
      } else {
        application = 'direct'
      }
    }

    const modifierId = this._modifierId()

    this.database.prepare(`
      INSERT INTO modifiers (id, factor_id, measurement_id, type, effect, application, value, label, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      modifierId,
      factorId,
      measurementId,
      input.type,
      input.effect || 'attenuate',
      application,
      input.value,
      input.label || '',
      JSON.stringify(input.metadata || {})
    )

    // Return the updated factor
    const result = this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Delete a modifier by ID.
   *
   * @param {string} measurementId
   * @param {string} modifierId
   * @returns {boolean}
   */
  deleteModifier (measurementId, modifierId) {
    const info = this.database.prepare(
      'DELETE FROM modifiers WHERE id = ? AND measurement_id = ?'
    ).run(modifierId, measurementId)
    const result = info.changes > 0
    return result
  }

  // -------------------------------------------------------------------------
  // Hierarchy tree
  // -------------------------------------------------------------------------

  /**
   * Build the full hierarchy tree for a measurement (used in GET response).
   *
   * @param {string} measurementId
   * @returns {object[]} Tree of HierarchyNode objects
   */
  buildTree (measurementId) {
    const allNodes = this.database.prepare(
      'SELECT * FROM nodes WHERE measurement_id = ? ORDER BY sort_order'
    ).all(measurementId)

    const allFactors = this.listFactors(measurementId)

    const nodeMap = new Map()
    for (const node of allNodes) {
      nodeMap.set(node.id, {
        id: node.id,
        level: node.level,
        label: node.label,
        children: [],
        factors: [],
        metadata: JSON.parse(node.metadata)
      })
    }

    // Attach factors to their parent nodes
    for (const factor of allFactors) {
      const parentNode = nodeMap.get(factor.nodeId)
      if (parentNode) {
        parentNode.factors.push(factor)
      }
    }

    // Build parent→child relationships
    const roots = []
    for (const node of allNodes) {
      const mapped = nodeMap.get(node.id)
      if (node.parent_id == null) {
        roots.push(mapped)
      } else {
        const parent = nodeMap.get(node.parent_id)
        if (parent) {
          parent.children.push(mapped)
        }
      }
    }

    const result = roots
    return result
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  _countFactors (measurementId) {
    const row = this.database.prepare(
      'SELECT COUNT(*) as count FROM factors WHERE measurement_id = ?'
    ).get(measurementId)
    return row.count
  }

  _purgeExpired () {
    const now = new Date().toISOString()
    this.database.prepare('DELETE FROM measurements WHERE expires_at < ?').run(now)
  }

  /**
   * Close the database connection.
   */
  close () {
    this.database.close()
  }
}

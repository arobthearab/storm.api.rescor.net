/**
 * Neo4j persistence for measurement sessions.
 *
 * Provides CRUD operations for measurements, factors, and modifiers.
 * TTL-based auto-purge via APOC TTL plugin.
 *
 * Node labels: Measurement, HierarchyNode, Factor, Modifier
 * Relationships: PART_OF, CHILD_OF, BELONGS_TO, MODIFIES
 */

import { randomUUID } from 'node:crypto'

const HIERARCHY_TEMPLATES = {
  default: ['items'],
  basic_questionnaire: ['questionnaire', 'section', 'question'],
  security_scan: ['test', 'horizon', 'host', 'finding', 'annotation']
}

/**
 * Measurement store backed by Neo4j.
 */
export class MeasurementStore {
  /**
   * @param {import('./database.mjs').SessionPerQueryWrapper} database
   */
  constructor (database) {
    this.database = database
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
   * @returns {Promise<object>} Created measurement record
   */
  async createMeasurement (input) {
    const id = this._measurementId()
    const now = new Date()
    const ttlSeconds = input.ttl || 86400
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    let template
    let levels
    if (Array.isArray(input.hierarchy)) {
      template = 'custom'
      levels = input.hierarchy
    } else {
      template = input.hierarchy || 'default'
      levels = HIERARCHY_TEMPLATES[template] || HIERARCHY_TEMPLATES.default
    }

    await this.database.query(`
      CREATE (m:Measurement {
        id:           $id,
        name:         $name,
        template:     $template,
        levels:       $levels,
        scalingBase:  $scalingBase,
        maximumValue: $maximumValue,
        metadata:     $metadata,
        createdAt:    $createdAt,
        expiresAt:    $expiresAt,
        ttl:          $ttl
      })
    `, {
      id,
      name: input.name || '',
      template,
      levels: JSON.stringify(levels),
      scalingBase: input.scalingBase || 4,
      maximumValue: input.maximumValue || 100,
      metadata: JSON.stringify(input.metadata || {}),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttl: expiresAt.getTime()
    })

    const result = await this.getMeasurement(id)
    return result
  }

  /**
   * Retrieve a measurement by ID.
   *
   * @param {string} id - Measurement ID
   * @returns {Promise<object|null>} Measurement record or null
   */
  async getMeasurement (id) {
    const rows = await this.database.query(`
      MATCH (m:Measurement { id: $id })
      WHERE m.expiresAt > $now
      OPTIONAL MATCH (f:Factor { measurementId: $id })
      RETURN m, count(f) AS factorCount
    `, { id, now: new Date().toISOString() })

    let result = null

    if (rows.length > 0) {
      const row = rows[0]
      const m = row.m
      result = {
        id: m.id,
        name: m.name,
        hierarchy: {
          template: m.template,
          levels: JSON.parse(m.levels)
        },
        configuration: {
          scalingBase: m.scalingBase,
          maximumValue: m.maximumValue
        },
        factorCount: row.factorCount,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
        metadata: JSON.parse(m.metadata)
      }
    }

    return result
  }

  /**
   * Delete a measurement and all children (nodes, factors, modifiers).
   *
   * @param {string} id - Measurement ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteMeasurement (id) {
    const rows = await this.database.query(`
      MATCH (m:Measurement { id: $id })
      OPTIONAL MATCH (n:HierarchyNode { measurementId: $id })
      OPTIONAL MATCH (f:Factor { measurementId: $id })
      OPTIONAL MATCH (mod:Modifier { measurementId: $id })
      WITH m, collect(DISTINCT n) AS nodes, collect(DISTINCT f) AS factors, collect(DISTINCT mod) AS modifiers
      FOREACH (mod IN modifiers | DETACH DELETE mod)
      FOREACH (f IN factors | DETACH DELETE f)
      FOREACH (n IN nodes | DETACH DELETE n)
      DETACH DELETE m
      RETURN true AS deleted
    `, { id })

    const result = rows.length > 0
    return result
  }

  // -------------------------------------------------------------------------
  // Nodes (hierarchy)
  // -------------------------------------------------------------------------

  /**
   * Find or create a hierarchy node for the given path.
   *
   * Walks down from root, creating nodes as needed via MERGE.
   *
   * @param {string}   measurementId - Parent measurement
   * @param {string[]} path          - Labels for each grouping level above the leaf
   * @param {string[]} levels        - Hierarchy level names
   * @returns {Promise<string>} Leaf-parent node ID
   */
  async ensureNodePath (measurementId, path, levels) {
    if (path.length === 0) {
      // Default root node
      const rootLevel = levels[0] || 'items'
      const rows = await this.database.query(`
        MERGE (n:HierarchyNode { measurementId: $measurementId, level: $rootLevel, label: 'root', parentId: 'none' })
          ON CREATE SET n.id = $nodeId, n.sortOrder = 0, n.metadata = '{}'
        WITH n
        MERGE (n)-[:PART_OF]->(:Measurement { id: $measurementId })
        RETURN n.id AS nodeId
      `, {
        measurementId,
        rootLevel,
        nodeId: this._nodeId()
      })

      const result = rows[0].nodeId
      return result
    }

    // Walk down, creating each level as needed
    let parentId = 'none'
    let nodeId = null

    for (let depth = 0; depth < path.length; depth++) {
      const level = levels[depth] || `level_${depth}`
      const label = path[depth]
      const candidateId = this._nodeId()
      const isRoot = depth === 0

      const rows = await this.database.query(`
        MERGE (n:HierarchyNode { measurementId: $measurementId, level: $level, label: $label, parentId: $parentId })
          ON CREATE SET n.id = $candidateId, n.sortOrder = 0, n.metadata = '{}'
        WITH n
        CALL {
          WITH n
          WITH n WHERE $isRoot = true
          MERGE (m:Measurement { id: $measurementId })
          MERGE (n)-[:PART_OF]->(m)
        }
        CALL {
          WITH n
          WITH n WHERE $isRoot = false
          MATCH (parent:HierarchyNode { measurementId: $measurementId, id: $parentNodeId })
          MERGE (n)-[:CHILD_OF]->(parent)
        }
        RETURN n.id AS nodeId
      `, {
        measurementId,
        level,
        label,
        parentId,
        candidateId,
        isRoot,
        parentNodeId: parentId === 'none' ? '' : parentId
      })

      nodeId = rows[0].nodeId
      parentId = nodeId
    }

    const result = nodeId
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
   * @returns {Promise<object|null>} Created factor record
   */
  async addFactor (measurementId, input) {
    const measurement = await this.getMeasurement(measurementId)
    if (!measurement) {
      return null
    }

    const levels = measurement.hierarchy.levels
    const path = input.path || []
    const nodeId = await this.ensureNodePath(measurementId, path, levels)

    const factorId = this._factorId()

    await this.database.query(`
      MATCH (n:HierarchyNode { id: $nodeId })
      CREATE (f:Factor {
        id:            $factorId,
        measurementId: $measurementId,
        nodeId:        $nodeId,
        value:         $value,
        label:         $label,
        path:          $path,
        metadata:      $metadata
      })-[:BELONGS_TO]->(n)
    `, {
      nodeId,
      factorId,
      measurementId,
      value: input.value,
      label: input.label || '',
      path: JSON.stringify(path),
      metadata: JSON.stringify(input.metadata || {})
    })

    const result = await this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Get a factor by ID, including its modifiers.
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @returns {Promise<object|null>}
   */
  async getFactor (measurementId, factorId) {
    const rows = await this.database.query(`
      MATCH (f:Factor { id: $factorId, measurementId: $measurementId })
      OPTIONAL MATCH (mod:Modifier)-[:MODIFIES]->(f)
      RETURN f,
             collect(CASE WHEN mod IS NOT NULL THEN mod END) AS modifiers
    `, { factorId, measurementId })

    let result = null

    if (rows.length > 0) {
      const row = rows[0]
      const f = row.f

      result = {
        id: f.id,
        nodeId: f.nodeId,
        path: JSON.parse(f.path),
        value: f.value,
        label: f.label,
        modifiers: row.modifiers
          .filter(m => m != null)
          .map(m => ({
            id: m.id,
            type: m.type,
            effect: m.effect,
            application: m.application,
            value: m.value,
            label: m.label,
            metadata: JSON.parse(m.metadata)
          })),
        metadata: JSON.parse(f.metadata)
      }
    }

    return result
  }

  /**
   * List all factors for a measurement, each with modifiers.
   * Single query eliminates the N+1 pattern.
   *
   * @param {string} measurementId
   * @returns {Promise<object[]>}
   */
  async listFactors (measurementId) {
    const rows = await this.database.query(`
      MATCH (f:Factor { measurementId: $measurementId })
      OPTIONAL MATCH (mod:Modifier)-[:MODIFIES]->(f)
      RETURN f,
             collect(CASE WHEN mod IS NOT NULL THEN mod END) AS modifiers
      ORDER BY f.id
    `, { measurementId })

    const result = rows.map(row => {
      const f = row.f
      return {
        id: f.id,
        nodeId: f.nodeId,
        path: JSON.parse(f.path),
        value: f.value,
        label: f.label,
        modifiers: row.modifiers
          .filter(m => m != null)
          .map(m => ({
            id: m.id,
            type: m.type,
            effect: m.effect,
            application: m.application,
            value: m.value,
            label: m.label,
            metadata: JSON.parse(m.metadata)
          })),
        metadata: JSON.parse(f.metadata)
      }
    })

    return result
  }

  /**
   * Update a factor (partial update).
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @param {object} input - UpdateFactorRequest fields
   * @returns {Promise<object|null>}
   */
  async updateFactor (measurementId, factorId, input) {
    const existing = await this.getFactor(measurementId, factorId)
    if (!existing) {
      return null
    }

    const setClauses = []
    const parameters = { factorId, measurementId }

    if (input.value != null) {
      setClauses.push('f.value = $newValue')
      parameters.newValue = input.value
    }

    if (input.label != null) {
      setClauses.push('f.label = $newLabel')
      parameters.newLabel = input.label
    }

    if (input.metadata != null) {
      setClauses.push('f.metadata = $newMetadata')
      parameters.newMetadata = JSON.stringify(input.metadata)
    }

    if (setClauses.length > 0) {
      await this.database.query(
        `MATCH (f:Factor { id: $factorId, measurementId: $measurementId })
         SET ${setClauses.join(', ')}`,
        parameters
      )
    }

    const result = await this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Delete a factor and its modifiers.
   *
   * @param {string} measurementId
   * @param {string} factorId
   * @returns {Promise<boolean>}
   */
  async deleteFactor (measurementId, factorId) {
    const rows = await this.database.query(`
      MATCH (f:Factor { id: $factorId, measurementId: $measurementId })
      OPTIONAL MATCH (mod:Modifier)-[:MODIFIES]->(f)
      DETACH DELETE mod, f
      RETURN true AS deleted
    `, { factorId, measurementId })

    const result = rows.length > 0
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
   * @returns {Promise<object|null>}
   */
  async addModifier (measurementId, factorId, input) {
    const factor = await this.getFactor(measurementId, factorId)
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

    await this.database.query(`
      MATCH (f:Factor { id: $factorId, measurementId: $measurementId })
      CREATE (mod:Modifier {
        id:            $modifierId,
        factorId:      $factorId,
        measurementId: $measurementId,
        type:          $type,
        effect:        $effect,
        application:   $application,
        value:         $value,
        label:         $label,
        metadata:      $metadata
      })-[:MODIFIES]->(f)
    `, {
      factorId,
      measurementId,
      modifierId,
      type: input.type,
      effect: input.effect || 'attenuate',
      application,
      value: input.value,
      label: input.label || '',
      metadata: JSON.stringify(input.metadata || {})
    })

    // Return the updated factor
    const result = await this.getFactor(measurementId, factorId)
    return result
  }

  /**
   * Delete a modifier by ID.
   *
   * @param {string} measurementId
   * @param {string} modifierId
   * @returns {Promise<boolean>}
   */
  async deleteModifier (measurementId, modifierId) {
    const rows = await this.database.query(`
      MATCH (mod:Modifier { id: $modifierId, measurementId: $measurementId })
      DETACH DELETE mod
      RETURN true AS deleted
    `, { modifierId, measurementId })

    const result = rows.length > 0
    return result
  }

  // -------------------------------------------------------------------------
  // Hierarchy tree
  // -------------------------------------------------------------------------

  /**
   * Build the full hierarchy tree for a measurement.
   *
   * Single query fetches all nodes, factors, and modifiers, then
   * assembles the tree in memory.
   *
   * @param {string} measurementId
   * @returns {Promise<object[]>} Tree of HierarchyNode objects
   */
  async buildTree (measurementId) {
    // Fetch all nodes
    const nodeRows = await this.database.query(`
      MATCH (n:HierarchyNode { measurementId: $measurementId })
      RETURN n
      ORDER BY n.sortOrder
    `, { measurementId })

    // Fetch all factors with modifiers in one query
    const allFactors = await this.listFactors(measurementId)

    const nodeMap = new Map()
    for (const row of nodeRows) {
      const n = row.n
      nodeMap.set(n.id, {
        id: n.id,
        level: n.level,
        label: n.label,
        children: [],
        factors: [],
        metadata: JSON.parse(n.metadata)
      })
    }

    // Attach factors to their parent nodes
    for (const factor of allFactors) {
      const parentNode = nodeMap.get(factor.nodeId)
      if (parentNode) {
        parentNode.factors.push(factor)
      }
    }

    // Build parent→child relationships using parentId property
    const roots = []
    for (const row of nodeRows) {
      const n = row.n
      const mapped = nodeMap.get(n.id)
      if (n.parentId === 'none') {
        roots.push(mapped)
      } else {
        const parent = nodeMap.get(n.parentId)
        if (parent) {
          parent.children.push(mapped)
        }
      }
    }

    const result = roots
    return result
  }

  // -------------------------------------------------------------------------
  // Batch operations
  // -------------------------------------------------------------------------

  /**
   * Add multiple factors (with optional inline modifiers) in a single transaction.
   *
   * Partial-success semantics: valid items are committed, invalid items are
   * collected in the errors array.
   *
   * @param {string}   measurementId - Parent measurement
   * @param {object[]} factorInputs  - Array of AddFactorRequest (with optional modifiers[])
   * @returns {Promise<{ created: number, failed: number, errors: object[] }>}
   */
  async addFactorsBatch (measurementId, factorInputs) {
    const measurement = await this.getMeasurement(measurementId)
    if (!measurement) {
      return { created: 0, failed: factorInputs.length, errors: [{ index: -1, message: 'Measurement not found' }] }
    }

    const levels = measurement.hierarchy.levels
    let created = 0
    const errors = []

    // Use a transaction for the entire batch
    await this.database.transaction(async (transaction) => {
      for (let index = 0; index < factorInputs.length; index++) {
        const input = factorInputs[index]

        try {
          const path = input.path || []
          const factorId = this._factorId()

          // Ensure hierarchy node path
          const nodeId = await this._ensureNodePathInTransaction(
            transaction, measurementId, path, levels
          )

          // Create the factor
          await transaction.run(`
            MATCH (n:HierarchyNode { id: $nodeId })
            CREATE (f:Factor {
              id:            $factorId,
              measurementId: $measurementId,
              nodeId:        $nodeId,
              value:         $value,
              label:         $label,
              path:          $path,
              metadata:      $metadata
            })-[:BELONGS_TO]->(n)
          `, {
            nodeId,
            factorId,
            measurementId,
            value: input.value,
            label: input.label || '',
            path: JSON.stringify(path),
            metadata: JSON.stringify(input.metadata || {})
          })

          // Inline modifiers for this factor
          if (Array.isArray(input.modifiers)) {
            for (const modifierInput of input.modifiers) {
              const modifierId = this._modifierId()

              let application = modifierInput.application
              if (!application) {
                if (modifierInput.type === 'confidence') {
                  application = 'direct'
                } else if (modifierInput.type === 'control') {
                  application = 'compound'
                } else {
                  application = 'direct'
                }
              }

              await transaction.run(`
                MATCH (f:Factor { id: $factorId })
                CREATE (mod:Modifier {
                  id:            $modifierId,
                  factorId:      $factorId,
                  measurementId: $measurementId,
                  type:          $type,
                  effect:        $effect,
                  application:   $application,
                  value:         $value,
                  label:         $label,
                  metadata:      $metadata
                })-[:MODIFIES]->(f)
              `, {
                factorId,
                measurementId,
                modifierId,
                type: modifierInput.type,
                effect: modifierInput.effect || 'attenuate',
                application,
                value: modifierInput.value,
                label: modifierInput.label || '',
                metadata: JSON.stringify(modifierInput.metadata || {})
              })
            }
          }

          created++
        } catch (itemError) {
          errors.push({ index, message: itemError.message })
        }
      }
    })

    const result = { created, failed: errors.length, errors }
    return result
  }

  /**
   * Add multiple modifiers to existing factors in a single transaction.
   *
   * @param {string}   measurementId  - Parent measurement
   * @param {object[]} modifierInputs - Array of { factorId, type, effect, application, value, label, metadata }
   * @returns {Promise<{ created: number, failed: number, errors: object[] }>}
   */
  async addModifiersBatch (measurementId, modifierInputs) {
    let created = 0
    const errors = []

    await this.database.transaction(async (transaction) => {
      for (let index = 0; index < modifierInputs.length; index++) {
        const input = modifierInputs[index]

        try {
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

          const result = await transaction.run(`
            MATCH (f:Factor { id: $factorId, measurementId: $measurementId })
            CREATE (mod:Modifier {
              id:            $modifierId,
              factorId:      $factorId,
              measurementId: $measurementId,
              type:          $type,
              effect:        $effect,
              application:   $application,
              value:         $value,
              label:         $label,
              metadata:      $metadata
            })-[:MODIFIES]->(f)
            RETURN mod.id AS modifierId
          `, {
            factorId: input.factorId,
            measurementId,
            modifierId,
            type: input.type,
            effect: input.effect || 'attenuate',
            application,
            value: input.value,
            label: input.label || '',
            metadata: JSON.stringify(input.metadata || {})
          })

          if (result.records && result.records.length > 0) {
            created++
          } else {
            errors.push({ index, message: `Factor '${input.factorId}' not found` })
          }
        } catch (itemError) {
          errors.push({ index, message: itemError.message })
        }
      }
    })

    const result = { created, failed: errors.length, errors }
    return result
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * ensureNodePath within an explicit transaction (for batch operations).
   *
   * @private
   */
  async _ensureNodePathInTransaction (transaction, measurementId, path, levels) {
    if (path.length === 0) {
      const rootLevel = levels[0] || 'items'
      const candidateId = this._nodeId()
      const result = await transaction.run(`
        MERGE (n:HierarchyNode { measurementId: $measurementId, level: $rootLevel, label: 'root', parentId: 'none' })
          ON CREATE SET n.id = $candidateId, n.sortOrder = 0, n.metadata = '{}'
        RETURN n.id AS nodeId
      `, { measurementId, rootLevel, candidateId })

      return result.records[0].get('nodeId')
    }

    let parentId = 'none'
    let nodeId = null

    for (let depth = 0; depth < path.length; depth++) {
      const level = levels[depth] || `level_${depth}`
      const label = path[depth]
      const candidateId = this._nodeId()

      const result = await transaction.run(`
        MERGE (n:HierarchyNode { measurementId: $measurementId, level: $level, label: $label, parentId: $parentId })
          ON CREATE SET n.id = $candidateId, n.sortOrder = 0, n.metadata = '{}'
        RETURN n.id AS nodeId
      `, { measurementId, level, label, parentId, candidateId })

      nodeId = result.records[0].get('nodeId')
      parentId = nodeId
    }

    return nodeId
  }

  /**
   * Close the database connection.
   */
  async close () {
    await this.database.disconnect()
  }
}

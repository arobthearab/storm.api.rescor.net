/**
 * Neo4j persistence for ATV(1-C) entities and linkages.
 *
 * Provides CRUD operations for Asset, Threat, Vulnerability, Control
 * entities and their instance linkages. Linkage creation is validated
 * against the catalog layer (framework-defined type relationships).
 *
 * Node labels: Asset, Threat, Vulnerability, Control
 * Relationships: TYPED_AS, CLASSIFIED_AS, EXPOSED_TO, SUSCEPTIBLE_TO,
 *                EXPLOITED_VIA, APPLIED_TO, GUARDS
 */

import { randomUUID } from 'node:crypto'
import { LINKAGE_VALIDATION_MAP } from '../frameworks/LinkageFramework.mjs'

// ---------------------------------------------------------------------------
// Entity configuration — maps logical type to Neo4j labels and properties
// ---------------------------------------------------------------------------

const ENTITY_CONFIG = Object.freeze({
  asset: {
    label: 'Asset',
    prefix: 'ast_',
    typeLabel: 'AssetType',
    typeRelationship: 'TYPED_AS',
    catalogIdProperty: 'typeId',
    scalarProperty: 'value'
  },
  threat: {
    label: 'Threat',
    prefix: 'thr_',
    typeLabel: 'ThreatClass',
    typeRelationship: 'CLASSIFIED_AS',
    catalogIdProperty: 'classId',
    scalarProperty: 'likelihood'
  },
  vulnerability: {
    label: 'Vulnerability',
    prefix: 'vul_',
    typeLabel: 'VulnerabilityClass',
    typeRelationship: 'CLASSIFIED_AS',
    catalogIdProperty: 'classId',
    scalarProperty: 'exposure'
  },
  control: {
    label: 'Control',
    prefix: 'ctl_',
    typeLabel: 'ControlFamily',
    typeRelationship: 'CLASSIFIED_AS',
    catalogIdProperty: 'familyId',
    scalarProperty: 'efficacy'
  }
})

/** Map ID prefix → entity type key. */
const PREFIX_TO_TYPE = Object.freeze(
  Object.fromEntries(
    Object.entries(ENTITY_CONFIG).map(([key, config]) => [config.prefix, key])
  )
)

/** Map catalog name (from LINKAGE_VALIDATION_MAP) → entity type key. */
const CATALOG_NAME_TO_TYPE = Object.freeze({
  assetType: 'asset',
  threatClass: 'threat',
  vulnerabilityClass: 'vulnerability',
  controlFamily: 'control'
})

/** Map catalog name → Neo4j label. */
const CATALOG_NAME_TO_LABEL = Object.freeze({
  assetType: 'AssetType',
  threatClass: 'ThreatClass',
  vulnerabilityClass: 'VulnerabilityClass',
  controlFamily: 'ControlFamily'
})

/** Instance relationship names for filtering in getLinkedEntities. */
const INSTANCE_RELATIONSHIP_NAMES = Object.freeze([
  'EXPOSED_TO', 'SUSCEPTIBLE_TO', 'EXPLOITED_VIA', 'APPLIED_TO', 'GUARDS'
])

// ---------------------------------------------------------------------------
// LinkageStore
// ---------------------------------------------------------------------------

export class LinkageStore {

  /**
   * @param {import('./database.mjs').SessionPerQueryWrapper} database
   */
  constructor (database) {
    this.database = database
  }

  // -----------------------------------------------------------------------
  // ID generators
  // -----------------------------------------------------------------------

  _assetId ()         { return 'ast_' + randomUUID().replace(/-/g, '').slice(0, 16) }
  _threatId ()        { return 'thr_' + randomUUID().replace(/-/g, '').slice(0, 16) }
  _vulnerabilityId () { return 'vul_' + randomUUID().replace(/-/g, '').slice(0, 16) }
  _controlId ()       { return 'ctl_' + randomUUID().replace(/-/g, '').slice(0, 16) }

  // -----------------------------------------------------------------------
  // Entity type resolution from ID prefix
  // -----------------------------------------------------------------------

  _resolveEntityType (entityId) {
    const prefix = entityId?.slice(0, 4) ?? ''
    const result = PREFIX_TO_TYPE[prefix] ?? null
    return result
  }

  // -----------------------------------------------------------------------
  // Assets
  // -----------------------------------------------------------------------

  async createAsset (input) {
    const result = await this._createEntity('asset', {
      name: input.name,
      catalogId: input.typeId,
      scalar: input.value ?? 0,
      metadata: input.metadata
    })
    return result
  }

  async getAsset (id) {
    const result = await this._getEntity('asset', id)
    return result
  }

  async listAssets (filters = {}) {
    const mapped = filters.typeId ? { catalogId: filters.typeId } : {}
    const result = await this._listEntities('asset', mapped)
    return result
  }

  async updateAsset (id, input) {
    const mapped = {}
    if (input.name != null) mapped.name = input.name
    if (input.value != null) mapped.scalar = input.value
    if (input.metadata != null) mapped.metadata = input.metadata
    const result = await this._updateEntity('asset', id, mapped)
    return result
  }

  async deleteAsset (id) {
    const result = await this._deleteEntity('asset', id)
    return result
  }

  // -----------------------------------------------------------------------
  // Threats
  // -----------------------------------------------------------------------

  async createThreat (input) {
    const result = await this._createEntity('threat', {
      name: input.name,
      catalogId: input.classId,
      scalar: input.likelihood ?? 0,
      metadata: input.metadata
    })
    return result
  }

  async getThreat (id) {
    const result = await this._getEntity('threat', id)
    return result
  }

  async listThreats (filters = {}) {
    const mapped = filters.classId ? { catalogId: filters.classId } : {}
    const result = await this._listEntities('threat', mapped)
    return result
  }

  async updateThreat (id, input) {
    const mapped = {}
    if (input.name != null) mapped.name = input.name
    if (input.likelihood != null) mapped.scalar = input.likelihood
    if (input.metadata != null) mapped.metadata = input.metadata
    const result = await this._updateEntity('threat', id, mapped)
    return result
  }

  async deleteThreat (id) {
    const result = await this._deleteEntity('threat', id)
    return result
  }

  // -----------------------------------------------------------------------
  // Vulnerabilities
  // -----------------------------------------------------------------------

  async createVulnerability (input) {
    const result = await this._createEntity('vulnerability', {
      name: input.name,
      catalogId: input.classId,
      scalar: input.exposure ?? 0,
      metadata: input.metadata
    })
    return result
  }

  async getVulnerability (id) {
    const result = await this._getEntity('vulnerability', id)
    return result
  }

  async listVulnerabilities (filters = {}) {
    const mapped = filters.classId ? { catalogId: filters.classId } : {}
    const result = await this._listEntities('vulnerability', mapped)
    return result
  }

  async updateVulnerability (id, input) {
    const mapped = {}
    if (input.name != null) mapped.name = input.name
    if (input.exposure != null) mapped.scalar = input.exposure
    if (input.metadata != null) mapped.metadata = input.metadata
    const result = await this._updateEntity('vulnerability', id, mapped)
    return result
  }

  async deleteVulnerability (id) {
    const result = await this._deleteEntity('vulnerability', id)
    return result
  }

  // -----------------------------------------------------------------------
  // Controls
  // -----------------------------------------------------------------------

  async createControl (input) {
    const result = await this._createEntity('control', {
      name: input.name,
      catalogId: input.familyId,
      scalar: input.efficacy ?? 0,
      metadata: input.metadata
    })
    return result
  }

  async getControl (id) {
    const result = await this._getEntity('control', id)
    return result
  }

  async listControls (filters = {}) {
    const mapped = filters.familyId ? { catalogId: filters.familyId } : {}
    const result = await this._listEntities('control', mapped)
    return result
  }

  async updateControl (id, input) {
    const mapped = {}
    if (input.name != null) mapped.name = input.name
    if (input.efficacy != null) mapped.scalar = input.efficacy
    if (input.metadata != null) mapped.metadata = input.metadata
    const result = await this._updateEntity('control', id, mapped)
    return result
  }

  async deleteControl (id) {
    const result = await this._deleteEntity('control', id)
    return result
  }

  // -----------------------------------------------------------------------
  // Linkage Management
  // -----------------------------------------------------------------------

  /**
   * Create an instance linkage between two entities, validated against
   * the catalog layer. Returns the linkage record on success,
   * or an object with `error` on failure.
   *
   * @param {string} fromId — source entity ID
   * @param {string} toId   — target entity ID
   * @param {string} relationship — INSTANCE_RELATIONSHIPS key
   * @returns {Promise<{ fromId, toId, relationship, createdAt } | { error: string }>}
   */
  async createLinkage (fromId, toId, relationship) {
    const rule = LINKAGE_VALIDATION_MAP.find(
      r => r.instanceRelationship === relationship
    )
    if (!rule) {
      const result = { error: `Unknown relationship: ${relationship}` }
      return result
    }

    const fromType = this._resolveEntityType(fromId)
    const toType = this._resolveEntityType(toId)
    if (fromType !== rule.fromType || toType !== rule.toType) {
      const result = {
        error: `${relationship} requires ${rule.fromType}→${rule.toType}, got ${fromType}→${toType}`
      }
      return result
    }

    const fromConfig = ENTITY_CONFIG[fromType]
    const toConfig = ENTITY_CONFIG[toType]

    // Look up both entities and their catalog type IDs
    const entityRows = await this.database.query(`
      MATCH (fe:${fromConfig.label} {id: $fromId})-[:${fromConfig.typeRelationship}]->(ft:${fromConfig.typeLabel})
      MATCH (te:${toConfig.label} {id: $toId})-[:${toConfig.typeRelationship}]->(tt:${toConfig.typeLabel})
      RETURN ft.id AS fromTypeId, tt.id AS toTypeId
    `, { fromId, toId })

    if (entityRows.length === 0) {
      const result = { error: 'One or both entities not found' }
      return result
    }

    const { fromTypeId, toTypeId } = entityRows[0]

    // Determine catalog relationship direction.
    // catalogFrom/catalogTo in the validation map define which catalog
    // nodes participate and in what order. Map them back to the instance
    // entities' catalog type IDs.
    const catalogFromEntityType = CATALOG_NAME_TO_TYPE[rule.catalogFrom]
    const catalogFromIsInstanceFrom = catalogFromEntityType === fromType
    const catalogFromId = catalogFromIsInstanceFrom ? fromTypeId : toTypeId
    const catalogToId = catalogFromIsInstanceFrom ? toTypeId : fromTypeId
    const catalogFromLabel = CATALOG_NAME_TO_LABEL[rule.catalogFrom]
    const catalogToLabel = CATALOG_NAME_TO_LABEL[rule.catalogTo]

    // Validate that the catalog rule exists
    const catalogRows = await this.database.query(`
      MATCH (:${catalogFromLabel} {id: $catalogFromId})-[:${rule.catalogRelationship}]->(:${catalogToLabel} {id: $catalogToId})
      RETURN true AS valid
    `, { catalogFromId, catalogToId })

    if (catalogRows.length === 0) {
      const result = {
        error: `Catalog rule does not permit ${relationship} between these entity types`
      }
      return result
    }

    // Create instance linkage (MERGE for idempotency)
    await this.database.query(`
      MATCH (fe:${fromConfig.label} {id: $fromId})
      MATCH (te:${toConfig.label} {id: $toId})
      MERGE (fe)-[:${relationship}]->(te)
    `, { fromId, toId })

    const result = {
      fromId,
      toId,
      relationship,
      createdAt: new Date().toISOString()
    }
    return result
  }

  /**
   * Delete an instance linkage.
   *
   * @param {string} fromId
   * @param {string} toId
   * @param {string} relationship
   * @returns {Promise<boolean>}
   */
  async deleteLinkage (fromId, toId, relationship) {
    if (!INSTANCE_RELATIONSHIP_NAMES.includes(relationship)) {
      return false
    }

    const fromType = this._resolveEntityType(fromId)
    const toType = this._resolveEntityType(toId)
    if (!fromType || !toType) {
      return false
    }

    const fromConfig = ENTITY_CONFIG[fromType]
    const toConfig = ENTITY_CONFIG[toType]

    const rows = await this.database.query(`
      MATCH (fe:${fromConfig.label} {id: $fromId})-[r:${relationship}]->(te:${toConfig.label} {id: $toId})
      DELETE r
      RETURN true AS deleted
    `, { fromId, toId })

    const result = rows.length > 0
    return result
  }

  /**
   * Retrieve entities linked to the given entity via instance relationships.
   *
   * @param {string} entityId
   * @param {{ direction?: 'outgoing'|'incoming'|'both', relationship?: string }} options
   * @returns {Promise<{ id, name, entityType, relationship, direction }[]>}
   */
  async getLinkedEntities (entityId, options = {}) {
    const entityType = this._resolveEntityType(entityId)
    if (!entityType) {
      return []
    }

    const config = ENTITY_CONFIG[entityType]
    const direction = options.direction ?? 'both'
    const relationshipFilter = options.relationship
      ? [options.relationship]
      : [...INSTANCE_RELATIONSHIP_NAMES]

    const entries = []

    if (direction === 'both' || direction === 'outgoing') {
      const outRows = await this.database.query(`
        MATCH (e:${config.label} {id: $entityId})-[r]->(other)
        WHERE type(r) IN $relationships
        RETURN other.id AS id, other.name AS name, type(r) AS relationship
      `, { entityId, relationships: relationshipFilter })

      for (const row of outRows) {
        entries.push({
          id: row.id,
          name: row.name,
          entityType: this._resolveEntityType(row.id),
          relationship: row.relationship,
          direction: 'outgoing'
        })
      }
    }

    if (direction === 'both' || direction === 'incoming') {
      const inRows = await this.database.query(`
        MATCH (other)-[r]->(e:${config.label} {id: $entityId})
        WHERE type(r) IN $relationships
        RETURN other.id AS id, other.name AS name, type(r) AS relationship
      `, { entityId, relationships: relationshipFilter })

      for (const row of inRows) {
        entries.push({
          id: row.id,
          name: row.name,
          entityType: this._resolveEntityType(row.id),
          relationship: row.relationship,
          direction: 'incoming'
        })
      }
    }

    const result = entries
    return result
  }

  // -----------------------------------------------------------------------
  // Suggestion Engine — catalog-driven recommendations
  // -----------------------------------------------------------------------

  /**
   * Suggest threat classes that target the given asset's type.
   * Walks: Asset→TYPED_AS→AssetType←TARGETS←ThreatClass
   *
   * @param {string} assetId
   * @returns {Promise<object[]>} Array of ThreatClass catalog entries
   */
  async suggestThreatsForAsset (assetId) {
    const rows = await this.database.query(`
      MATCH (a:Asset {id: $assetId})-[:TYPED_AS]->(at:AssetType)
      MATCH (tc:ThreatClass)-[:TARGETS]->(at)
      RETURN tc.id AS id, tc.name AS name, tc.description AS description,
             tc.source AS source, tc.iapDefaults AS iapDefaults
      ORDER BY tc.name
    `, { assetId })

    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      source: row.source ?? null,
      iapDefaults: _parseOptionalJson(row.iapDefaults)
    }))
    return result
  }

  /**
   * Suggest vulnerability classes that affect the given asset's type.
   * Optionally filters by threat class via EXPLOITED_BY.
   * Walks: Asset→TYPED_AS→AssetType←AFFECTS←VulnerabilityClass
   *        (optional filter: VulnerabilityClass→EXPLOITED_BY→ThreatClass)
   *
   * @param {string} assetId
   * @param {string} [threatId] — optional threat to narrow by EXPLOITED_BY
   * @returns {Promise<object[]>}
   */
  async suggestVulnerabilitiesForAsset (assetId, threatId) {
    let cypher
    const parameters = { assetId }

    if (threatId) {
      parameters.threatId = threatId
      cypher = `
        MATCH (a:Asset {id: $assetId})-[:TYPED_AS]->(at:AssetType)
        MATCH (vc:VulnerabilityClass)-[:AFFECTS]->(at)
        MATCH (t:Threat {id: $threatId})-[:CLASSIFIED_AS]->(tc:ThreatClass)
        MATCH (vc)-[:EXPLOITED_BY]->(tc)
        RETURN vc.id AS id, vc.name AS name, vc.description AS description,
               vc.iapDefaults AS iapDefaults
        ORDER BY vc.name
      `
    } else {
      cypher = `
        MATCH (a:Asset {id: $assetId})-[:TYPED_AS]->(at:AssetType)
        MATCH (vc:VulnerabilityClass)-[:AFFECTS]->(at)
        RETURN vc.id AS id, vc.name AS name, vc.description AS description,
               vc.iapDefaults AS iapDefaults
        ORDER BY vc.name
      `
    }

    const rows = await this.database.query(cypher, parameters)

    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      iapDefaults: _parseOptionalJson(row.iapDefaults)
    }))
    return result
  }

  /**
   * Suggest control families that mitigate the given vulnerability's class.
   * Walks: Vulnerability→CLASSIFIED_AS→VulnerabilityClass←MITIGATES←ControlFamily
   *
   * @param {string} vulnerabilityId
   * @returns {Promise<object[]>}
   */
  async suggestControlsForVulnerability (vulnerabilityId) {
    const rows = await this.database.query(`
      MATCH (v:Vulnerability {id: $vulnerabilityId})-[:CLASSIFIED_AS]->(vc:VulnerabilityClass)
      MATCH (cf:ControlFamily)-[:MITIGATES]->(vc)
      RETURN cf.id AS id, cf.name AS name, cf.identifier AS identifier,
             cf.description AS description, cf.iapDefaults AS iapDefaults
      ORDER BY cf.identifier
    `, { vulnerabilityId })

    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier ?? null,
      description: row.description,
      iapDefaults: _parseOptionalJson(row.iapDefaults)
    }))
    return result
  }

  /**
   * Suggest control families that protect the given asset's type.
   * Dual binding path: Asset→TYPED_AS→AssetType←PROTECTS←ControlFamily
   *
   * @param {string} assetId
   * @returns {Promise<object[]>}
   */
  async suggestControlsForAsset (assetId) {
    const rows = await this.database.query(`
      MATCH (a:Asset {id: $assetId})-[:TYPED_AS]->(at:AssetType)
      MATCH (cf:ControlFamily)-[:PROTECTS]->(at)
      RETURN cf.id AS id, cf.name AS name, cf.identifier AS identifier,
             cf.description AS description, cf.iapDefaults AS iapDefaults
      ORDER BY cf.identifier
    `, { assetId })

    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier ?? null,
      description: row.description,
      iapDefaults: _parseOptionalJson(row.iapDefaults)
    }))
    return result
  }

  // -----------------------------------------------------------------------
  // Batch operations
  // -----------------------------------------------------------------------

  async createAssetsBatch (items) {
    const mapped = items.map(item => ({
      name: item.name,
      catalogId: item.typeId,
      scalar: item.value ?? 0,
      metadata: item.metadata
    }))
    const result = await this._createEntitiesBatch('asset', mapped)
    return result
  }

  async createThreatsBatch (items) {
    const mapped = items.map(item => ({
      name: item.name,
      catalogId: item.classId,
      scalar: item.likelihood ?? 0,
      metadata: item.metadata
    }))
    const result = await this._createEntitiesBatch('threat', mapped)
    return result
  }

  async createVulnerabilitiesBatch (items) {
    const mapped = items.map(item => ({
      name: item.name,
      catalogId: item.classId,
      scalar: item.exposure ?? 0,
      metadata: item.metadata
    }))
    const result = await this._createEntitiesBatch('vulnerability', mapped)
    return result
  }

  async createControlsBatch (items) {
    const mapped = items.map(item => ({
      name: item.name,
      catalogId: item.familyId,
      scalar: item.efficacy ?? 0,
      metadata: item.metadata
    }))
    const result = await this._createEntitiesBatch('control', mapped)
    return result
  }

  // -----------------------------------------------------------------------
  // Generic CRUD helpers (private)
  // -----------------------------------------------------------------------

  /**
   * Create an entity node with a relationship to its catalog type.
   * Returns null when the catalog type ID is invalid.
   */
  async _createEntity (entityType, input) {
    const config = ENTITY_CONFIG[entityType]
    const id = this['_' + entityType + 'Id']()
    const now = new Date().toISOString()

    // Verify the catalog type exists
    const typeRows = await this.database.query(
      `MATCH (t:${config.typeLabel} {id: $catalogId}) RETURN t.id AS typeId`,
      { catalogId: input.catalogId }
    )

    if (typeRows.length === 0) {
      return null
    }

    await this.database.query(`
      CREATE (e:${config.label} {
        id:        $id,
        name:      $name,
        ${config.scalarProperty}: $scalar,
        metadata:  $metadata,
        createdAt: $createdAt
      })
      WITH e
      MATCH (t:${config.typeLabel} {id: $catalogId})
      CREATE (e)-[:${config.typeRelationship}]->(t)
    `, {
      id,
      name: input.name || '',
      scalar: input.scalar,
      metadata: JSON.stringify(input.metadata || {}),
      createdAt: now,
      catalogId: input.catalogId
    })

    const result = await this._getEntity(entityType, id)
    return result
  }

  /**
   * Retrieve an entity by ID with its catalog type information.
   */
  async _getEntity (entityType, id) {
    const config = ENTITY_CONFIG[entityType]

    const rows = await this.database.query(`
      MATCH (e:${config.label} {id: $id})
      OPTIONAL MATCH (e)-[:${config.typeRelationship}]->(t:${config.typeLabel})
      RETURN e, t
    `, { id })

    let result = null

    if (rows.length > 0) {
      const row = rows[0]
      const entity = row.e
      const catalogType = row.t

      result = {
        id: entity.id,
        name: entity.name,
        [config.scalarProperty]: entity[config.scalarProperty],
        [config.catalogIdProperty]: catalogType?.id ?? null,
        catalogType: catalogType ? {
          id: catalogType.id,
          name: catalogType.name,
          description: catalogType.description
        } : null,
        createdAt: entity.createdAt,
        metadata: JSON.parse(entity.metadata)
      }
    }

    return result
  }

  /**
   * List entities with optional catalog filter.
   */
  async _listEntities (entityType, filters = {}) {
    const config = ENTITY_CONFIG[entityType]
    const parameters = {}
    let cypher

    if (filters.catalogId) {
      parameters.filterCatalogId = filters.catalogId
      cypher = `
        MATCH (e:${config.label})-[:${config.typeRelationship}]->(t:${config.typeLabel} {id: $filterCatalogId})
        RETURN e, t
        ORDER BY e.name
      `
    } else {
      cypher = `
        MATCH (e:${config.label})
        OPTIONAL MATCH (e)-[:${config.typeRelationship}]->(t:${config.typeLabel})
        RETURN e, t
        ORDER BY e.name
      `
    }

    const rows = await this.database.query(cypher, parameters)

    const result = rows.map(row => {
      const entity = row.e
      const catalogType = row.t
      return {
        id: entity.id,
        name: entity.name,
        [config.scalarProperty]: entity[config.scalarProperty],
        [config.catalogIdProperty]: catalogType?.id ?? null,
        catalogType: catalogType ? {
          id: catalogType.id,
          name: catalogType.name,
          description: catalogType.description
        } : null,
        createdAt: entity.createdAt,
        metadata: JSON.parse(entity.metadata)
      }
    })

    return result
  }

  /**
   * Partial update of an entity. Returns null when entity is not found.
   */
  async _updateEntity (entityType, id, input) {
    const config = ENTITY_CONFIG[entityType]

    const existing = await this._getEntity(entityType, id)
    if (!existing) {
      return null
    }

    const setClauses = []
    const parameters = { id }

    if (input.name != null) {
      setClauses.push('e.name = $newName')
      parameters.newName = input.name
    }

    if (input.scalar != null) {
      setClauses.push(`e.${config.scalarProperty} = $newScalar`)
      parameters.newScalar = input.scalar
    }

    if (input.metadata != null) {
      setClauses.push('e.metadata = $newMetadata')
      parameters.newMetadata = JSON.stringify(input.metadata)
    }

    if (setClauses.length > 0) {
      await this.database.query(
        `MATCH (e:${config.label} {id: $id}) SET ${setClauses.join(', ')}`,
        parameters
      )
    }

    const result = await this._getEntity(entityType, id)
    return result
  }

  /**
   * Delete an entity and cascade-remove all its relationships.
   */
  async _deleteEntity (entityType, id) {
    const config = ENTITY_CONFIG[entityType]

    const rows = await this.database.query(`
      MATCH (e:${config.label} {id: $id})
      DETACH DELETE e
      RETURN true AS deleted
    `, { id })

    const result = rows.length > 0
    return result
  }

  /**
   * Batch-create entities with transaction isolation and partial-success
   * semantics. Pre-validates all catalog IDs in one query.
   */
  async _createEntitiesBatch (entityType, items) {
    const config = ENTITY_CONFIG[entityType]
    const idGenerator = '_' + entityType + 'Id'

    // Pre-validate all catalog IDs in one query
    const catalogIds = [...new Set(items.map(item => item.catalogId).filter(Boolean))]
    const validTypeRows = await this.database.query(
      `MATCH (t:${config.typeLabel}) WHERE t.id IN $catalogIds RETURN t.id AS id`,
      { catalogIds }
    )
    const validCatalogIds = new Set(validTypeRows.map(row => row.id))

    let created = 0
    const errors = []

    await this.database.transaction(async (transaction) => {
      for (let index = 0; index < items.length; index++) {
        const item = items[index]

        try {
          if (!validCatalogIds.has(item.catalogId)) {
            errors.push({ index, message: `Invalid catalog type: ${item.catalogId}` })
            continue
          }

          const id = this[idGenerator]()
          const now = new Date().toISOString()

          await transaction.run(`
            CREATE (e:${config.label} {
              id:        $id,
              name:      $name,
              ${config.scalarProperty}: $scalar,
              metadata:  $metadata,
              createdAt: $createdAt
            })
            WITH e
            MATCH (t:${config.typeLabel} {id: $catalogId})
            CREATE (e)-[:${config.typeRelationship}]->(t)
          `, {
            id,
            name: item.name || '',
            scalar: item.scalar,
            metadata: JSON.stringify(item.metadata || {}),
            createdAt: now,
            catalogId: item.catalogId
          })

          created++
        } catch (itemError) {
          errors.push({ index, message: itemError.message })
        }
      }
    })

    const result = { created, failed: errors.length, errors }
    return result
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON string if present, otherwise return null.
 * Catalog nodes store iapDefaults as JSON strings.
 */
function _parseOptionalJson (value) {
  if (value == null) {
    return null
  }

  try {
    const result = JSON.parse(value)
    return result
  } catch {
    return null
  }
}

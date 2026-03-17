// ════════════════════════════════════════════════════════════════════
// Neo4j Database Connection
// ════════════════════════════════════════════════════════════════════
// Wraps Neo4jOperations with per-query session management so
// concurrent HTTP requests never collide on a single session.
// ════════════════════════════════════════════════════════════════════

import neo4j from 'neo4j-driver'
import { Neo4jOperations } from '@rescor-llc/core-db'

// ────────────────────────────────────────────────────────────────────
// SessionPerQueryWrapper — opens a fresh session for every query()
// call, then closes it immediately. The underlying driver manages the
// connection pool so this is cheap.
// ────────────────────────────────────────────────────────────────────

class SessionPerQueryWrapper {
  constructor (operations) {
    this._operations = operations
    this._driver = operations.driver
    this._database = operations.database
  }

  /** True when the underlying driver is live. */
  get isConnected () {
    return this._operations.isConnected
  }

  /**
   * Execute a Cypher query in its own session.
   * Delegates record→row conversion to the underlying operations instance.
   */
  async query (cypher, parameters = {}) {
    const session = this._driver.session({
      database: this._database,
      defaultAccessMode: neo4j.session.WRITE
    })

    try {
      const result = await session.run(cypher, parameters)
      return this._operations._recordsToRows(result.records)
    } finally {
      await session.close()
    }
  }

  /** Delegate transaction to a dedicated session. */
  async transaction (callback) {
    const session = this._driver.session({
      database: this._database,
      defaultAccessMode: neo4j.session.WRITE
    })

    const transaction = session.beginTransaction()
    try {
      const transactionResult = await callback(transaction)
      await transaction.commit()
      return transactionResult
    } catch (error) {
      await transaction.rollback()
      throw error
    } finally {
      await session.close()
    }
  }

  /** Disconnect the underlying driver and session. */
  async disconnect () {
    return this._operations.disconnect()
  }
}

// ────────────────────────────────────────────────────────────────────
// createDatabase — connect to Neo4j via core-db, return safe wrapper
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// createConfiguration — shared Infisical Configuration instance
// Exported so other modules (auth, IDP config) can re-use it without
// creating a second Infisical connection.
// ────────────────────────────────────────────────────────────────────

export async function createConfiguration () {
  const { Configuration } = await import('@rescor-llc/core-config')

  const configuration = new Configuration({
    enableInfisical: true,
    requireInfisical: false,
    enableCache: true,
    infisicalOptions: {
      projectId: process.env.INFISICAL_PROJECT_ID,
      coreProjectId: process.env.INFISICAL_CORE_PROJECT_ID,
      clientId: process.env.INFISICAL_CLIENT_ID,
      clientSecret: process.env.INFISICAL_CLIENT_SECRET
    }
  })

  await configuration.initialize()
  return configuration
}

// ────────────────────────────────────────────────────────────────────
// createDatabase — connect to Neo4j via core-db, return safe wrapper
// ────────────────────────────────────────────────────────────────────

export async function createDatabase (configuration) {
  // Load all Neo4j configuration from Infisical via @rescor-llc/core-config.
  // No process.env reads — Configuration-First Runtime Policy.

  const uri = await configuration.getConfig('neo4j', 'uri') || 'bolt://localhost:17787'
  const database = await configuration.getConfig('neo4j', 'database') || 'neo4j'
  const password = await configuration.getConfig('neo4j', 'password')

  const operations = new Neo4jOperations({
    schema: database,
    uri,
    username: 'neo4j',
    password,
    config: configuration
  })

  await operations.connect()
  console.log(`[storm] Connected to Neo4j (${database} database)`)

  const result = new SessionPerQueryWrapper(operations)
  return result
}

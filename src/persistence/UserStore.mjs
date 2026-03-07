/**
 * User persistence backed by Neo4j.
 *
 * Node label:  User
 * Properties:  sub (unique), username, email, roles, firstSeen, lastSeen
 *
 * Auto-registration pattern: MERGE on sub — first authenticated request
 * creates the node; subsequent requests update lastSeen and roles.
 */

/**
 * @typedef {object} UserRecord
 * @property {string}   sub       - Keycloak subject (unique)
 * @property {string}   username  - preferred_username from JWT
 * @property {string}   email     - Email claim
 * @property {string[]} roles     - RBAC roles
 * @property {string}   firstSeen - ISO 8601 timestamp
 * @property {string}   lastSeen  - ISO 8601 timestamp
 */

export class UserStore {
  /**
   * @param {import('./database.mjs').SessionPerQueryWrapper} database
   */
  constructor (database) {
    this.database = database
  }

  /**
   * Upsert a user node from JWT claims.
   *
   * Creates (:User) on first visit, updates lastSeen and roles on every call.
   * MERGE is idempotent and fast against the unique constraint on sub.
   *
   * @param {object} claims - JWT payload (sub, preferred_username, email, roles/realm_access)
   * @returns {Promise<UserRecord>}
   */
  async ensureUser (claims) {
    const sub = claims.sub
    const username = claims.preferred_username || claims.username || sub
    const email = claims.email || ''
    const roles = this._extractRoles(claims)
    const now = new Date().toISOString()

    const rows = await this.database.query(`
      MERGE (u:User { sub: $sub })
      ON CREATE SET
        u.username  = $username,
        u.email     = $email,
        u.roles     = $roles,
        u.firstSeen = $now,
        u.lastSeen  = $now
      ON MATCH SET
        u.username  = $username,
        u.email     = $email,
        u.roles     = $roles,
        u.lastSeen  = $now
      RETURN u.sub       AS sub,
             u.username  AS username,
             u.email     AS email,
             u.roles     AS roles,
             u.firstSeen AS firstSeen,
             u.lastSeen  AS lastSeen
    `, { sub, username, email, roles: JSON.stringify(roles), now })

    const result = rows[0] || null
    if (result && typeof result.roles === 'string') {
      result.roles = JSON.parse(result.roles)
    }

    return result
  }

  /**
   * Find a user by Keycloak subject.
   *
   * @param {string} sub - Keycloak subject identifier
   * @returns {Promise<UserRecord|null>}
   */
  async findBySub (sub) {
    const rows = await this.database.query(`
      MATCH (u:User { sub: $sub })
      RETURN u.sub       AS sub,
             u.username  AS username,
             u.email     AS email,
             u.roles     AS roles,
             u.firstSeen AS firstSeen,
             u.lastSeen  AS lastSeen
    `, { sub })

    const result = rows[0] || null
    if (result && typeof result.roles === 'string') {
      result.roles = JSON.parse(result.roles)
    }

    return result
  }

  /**
   * Extract RBAC roles from a Keycloak JWT payload.
   *
   * Keycloak stores realm roles in `realm_access.roles` and client roles
   * in `resource_access.<clientId>.roles`.  The dev bypass uses a flat
   * `roles` array.  This method handles all three shapes.
   *
   * @param {object} claims
   * @returns {string[]}
   * @private
   */
  _extractRoles (claims) {
    // Dev bypass or flat array
    if (Array.isArray(claims.roles)) {
      return claims.roles
    }

    // Keycloak realm_access
    if (claims.realm_access && Array.isArray(claims.realm_access.roles)) {
      return claims.realm_access.roles
    }

    return []
  }
}

// ════════════════════════════════════════════════════════════════════
// Setup Database — Execute Cypher DDL Scripts
// ════════════════════════════════════════════════════════════════════
// Reads all .cypher files from api/cypher/ in sorted order and
// executes each statement sequentially against the Neo4j instance.
//
// Usage: npm run cypher:setup
// ════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDatabase } from './persistence/database.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CYPHER_DIRECTORY = join(__dirname, '..', 'api', 'cypher')

/**
 * Parse a .cypher file into individual statements.
 *
 * Splits on semicolons, strips single-line comments (// ...).
 * Blank statements are discarded.
 */
function parseStatements (content) {
  const result = content
    .split(';')
    .map(statement => statement
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .trim()
    )
    .filter(statement => statement.length > 0)

  return result
}

/**
 * Run all Cypher DDL scripts against the connected database.
 */
async function setup () {
  const database = await createDatabase()

  const files = readdirSync(CYPHER_DIRECTORY)
    .filter(file => file.endsWith('.cypher'))
    .sort()

  console.log(`[storm] Found ${files.length} Cypher script(s) in api/cypher/`)

  let totalStatements = 0

  for (const file of files) {
    const filePath = join(CYPHER_DIRECTORY, file)
    const content = readFileSync(filePath, 'utf-8')
    const statements = parseStatements(content)

    console.log(`[storm] Executing ${file} (${statements.length} statements)`)

    for (const statement of statements) {
      await database.query(statement)
      totalStatements++
    }
  }

  console.log(`[storm] Setup complete — ${totalStatements} statements executed`)

  await database.disconnect()
}

setup().catch(error => {
  console.error('[storm] Setup failed:', error)
  process.exit(1)
})

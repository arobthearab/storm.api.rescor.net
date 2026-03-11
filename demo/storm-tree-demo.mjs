#!/usr/bin/env node
/**
 * STORM Tree Calculation Demo — CONFIDENTIAL
 *
 * Standalone program that demonstrates RSK/STORM calculations on a
 * TestingCenter-shaped findings tree.  Imports only from the STORM
 * engine modules — no TestingCenter code, no database, no network.
 *
 * Usage:
 *   node demo/storm-tree-demo.mjs                        # built-in sample data
 *   node demo/storm-tree-demo.mjs path/to/tree.json      # custom tree file
 *   node demo/storm-tree-demo.mjs --auth                 # authenticate first
 *   node demo/storm-tree-demo.mjs --auth tree.json       # both
 *
 * Authentication (--auth):
 *   Acquires a JWT from Keycloak before running calculations.
 *   Keycloak credentials are loaded from Infisical via @rescor/core-config
 *   (Configuration-First Runtime Policy).  The .env file must contain
 *   Infisical bootstrap credentials — see docs/CONFIGURATION.md.
 *
 *   Infisical keys used:
 *     idp.base_url     → Keycloak base URL  (default: http://localhost:8080)
 *     idp.realm         → Keycloak realm      (default: rescor)
 *     idp.client_id     → OIDC client ID      (required)
 *     idp.client_secret → OIDC client secret   (required for client_credentials)
 *
 *   For password grant, set env vars (dev/testing only):
 *     KEYCLOAK_USERNAME  (required for password grant)
 *     KEYCLOAK_PASSWORD  (required for password grant)
 *
 *   If KEYCLOAK_USERNAME is set, password grant is used;
 *   otherwise client_credentials grant is used.
 *
 * Output: enriched JSON tree with correct STORM aggregate measurements,
 *         RSK normalized scores, qualitative ratings, annotation
 *         corrections, and per-node computation details.
 *
 * IP Classification: PROPRIETARY — do not redistribute.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rskAggregate, rskNormalize, rskUpperBound, rskRate, computeScore } from '../src/engines/rsk.mjs'
import { computeEffective } from '../src/engines/modifiers.mjs'
import { decodeToken } from '@rescor/core-auth'

// ════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════

const SCALING_BASE = 4
const MAXIMUM_VALUE = 100

// ════════════════════════════════════════════════════════════════════
// Weighted Correction (annotation diminishing-returns series)
// ════════════════════════════════════════════════════════════════════

/**
 * Compute the cumulative correction from an array of annotation
 * correction values using the RSK diminishing-weight series.
 *
 * Sorted descending, then: min(1, Σ c_j / a^j)
 *
 * @param {number[]} corrections - Per-annotation correction values (0–1)
 * @param {number}   scalingBase - Geometric decay base (default 4)
 * @returns {number} Capped cumulative correction (0–1)
 */
function weightedCorrection (corrections, scalingBase = SCALING_BASE) {
  let result = 0

  if (!corrections || corrections.length === 0) {
    return result
  }

  const sorted = corrections
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)

  if (sorted.length === 0) {
    return result
  }

  let accumulator = 0
  for (let index = 0; index < sorted.length; index++) {
    accumulator += sorted[index] / Math.pow(scalingBase, index)
  }

  result = Math.min(1, accumulator)
  return result
}

// ════════════════════════════════════════════════════════════════════
// Tree Walk — bottom-up STORM aggregate calculation
// ════════════════════════════════════════════════════════════════════

/**
 * Collect all effective finding measurements beneath a node.
 *
 * @param {object} node - Tree node (host, horizon, or test)
 * @returns {number[]} Array of effective measurements (post-correction)
 */
function collectFindingMeasurements (node) {
  const measurements = []

  function walk (current) {
    if (current.type === 'finding') {
      measurements.push(current.measurement || 0)
    } else if (current.children) {
      for (const child of current.children) {
        walk(child)
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      walk(child)
    }
  }

  return measurements
}

/**
 * Walk the tree bottom-up and compute STORM aggregates at every level.
 *
 * Mutates the tree in-place, adding `_storm` metadata to each node.
 *
 * @param {object} node - Tree node (test, horizon, host, finding, annotation)
 * @returns {number} The calculated measurement for this node
 */
function calculateNode (node) {
  // Process children first (bottom-up)
  if (node.children) {
    for (const child of node.children) {
      calculateNode(child)
    }
  }

  // ── Annotation ──────────────────────────────────────────────────
  if (node.type === 'annotation') {
    const correctionValue = Number(node.measurement ?? node.data?.correction ?? 0)
    node._storm = {
      type: 'annotation',
      correction: correctionValue,
      description: `${(correctionValue * 100).toFixed(0)}% remediation`
    }
    return correctionValue
  }

  // ── Finding ─────────────────────────────────────────────────────
  if (node.type === 'finding') {
    const originalMeasurement = Number(
      node.originalMeasurement ?? node.data?.originalMeasurement ?? node.measurement ?? 0
    )
    node.originalMeasurement = originalMeasurement

    let effectiveMeasurement = originalMeasurement

    const annotations = (node.children || []).filter(child => child.type === 'annotation')
    const correctionValues = annotations.map(annotation =>
      Number(annotation._storm?.correction ?? annotation.measurement ?? annotation.data?.correction ?? 0)
    )

    const cumulativeCorrection = weightedCorrection(correctionValues, SCALING_BASE)

    if (correctionValues.length > 0) {
      effectiveMeasurement = originalMeasurement * (1 - cumulativeCorrection)
    }

    node.measurement = effectiveMeasurement

    node._storm = {
      type: 'finding',
      originalMeasurement,
      effectiveMeasurement,
      annotationCount: annotations.length,
      correctionValues,
      cumulativeCorrection,
      formula: correctionValues.length > 0
        ? `${originalMeasurement} × (1 − ${cumulativeCorrection.toFixed(4)}) = ${effectiveMeasurement.toFixed(2)}`
        : `${originalMeasurement} (no corrections)`
    }

    return effectiveMeasurement
  }

  // ── Host ────────────────────────────────────────────────────────
  if (node.type === 'host') {
    const findingMeasurements = collectFindingMeasurements(node)
    const aggregate = rskAggregate(findingMeasurements, SCALING_BASE)
    const normalized = rskNormalize(aggregate, MAXIMUM_VALUE, SCALING_BASE)
    const { rating } = rskRate(aggregate, { scale: 'alternate' })
    const upperBound = rskUpperBound(MAXIMUM_VALUE, SCALING_BASE)

    node.measurement = aggregate
    node._storm = {
      type: 'host',
      aggregate,
      normalized: Number(normalized.toFixed(2)),
      rating,
      upperBound,
      findingCount: findingMeasurements.length,
      vector: [...findingMeasurements].sort((a, b) => b - a),
      formula: `⌈Σ V_j / ${SCALING_BASE}^j⌉ = ${aggregate} RU (${normalized.toFixed(1)}% normalized → ${rating})`
    }

    return aggregate
  }

  // ── Horizon ─────────────────────────────────────────────────────
  if (node.type === 'horizon') {
    const findingMeasurements = collectFindingMeasurements(node, true)
    const aggregate = rskAggregate(findingMeasurements, SCALING_BASE)
    const normalized = rskNormalize(aggregate, MAXIMUM_VALUE, SCALING_BASE)
    const { rating } = rskRate(aggregate, { scale: 'alternate' })
    const upperBound = rskUpperBound(MAXIMUM_VALUE, SCALING_BASE)

    node.measurement = aggregate
    node._storm = {
      type: 'horizon',
      aggregate,
      normalized: Number(normalized.toFixed(2)),
      rating,
      upperBound,
      findingCount: findingMeasurements.length,
      vector: [...findingMeasurements].sort((a, b) => b - a),
      formula: `⌈Σ V_j / ${SCALING_BASE}^j⌉ = ${aggregate} RU (${normalized.toFixed(1)}% normalized → ${rating})`
    }

    return aggregate
  }

  // ── Test (root) ─────────────────────────────────────────────────
  if (node.type === 'test') {
    const findingMeasurements = collectFindingMeasurements(node, true)
    const score = computeScore(findingMeasurements, {
      scalingBase: SCALING_BASE,
      maximumValue: MAXIMUM_VALUE,
      scale: 'alternate'
    })

    node.measurement = score.aggregate
    node._storm = {
      type: 'test',
      ...score,
      findingCount: findingMeasurements.length,
      vector: score.measurements,
      formula: `⌈Σ V_j / ${SCALING_BASE}^j⌉ = ${score.aggregate} RU (${score.normalized.toFixed(1)}% → ${score.rating})`
    }

    return score.aggregate
  }

  return node.measurement || 0
}

// ════════════════════════════════════════════════════════════════════
// Summary — flat table of every node
// ════════════════════════════════════════════════════════════════════

/**
 * Walk the enriched tree and produce a flat summary array.
 *
 * @param {object} node - Root of the enriched tree
 * @param {number} depth - Current depth
 * @returns {object[]} Flat array of summary rows
 */
function flattenSummary (node, depth = 0) {
  const rows = []

  const row = {
    depth,
    type: node.type,
    id: node.id,
    name: node.name,
    measurement: node.measurement
  }

  if (node._storm) {
    if (node._storm.normalized !== undefined) row.normalized = node._storm.normalized
    if (node._storm.rating !== undefined) row.rating = node._storm.rating
    if (node._storm.originalMeasurement !== undefined) row.original = node._storm.originalMeasurement
    if (node._storm.cumulativeCorrection !== undefined) row.correction = Number(node._storm.cumulativeCorrection.toFixed(4))
    if (node._storm.findingCount !== undefined) row.findings = node._storm.findingCount
    if (node._storm.formula) row.formula = node._storm.formula
  }

  rows.push(row)

  if (node.children) {
    for (const child of node.children) {
      rows.push(...flattenSummary(child, depth + 1))
    }
  }

  return rows
}

// ════════════════════════════════════════════════════════════════════
// Built-in Sample Data
// ════════════════════════════════════════════════════════════════════

/**
 * Sample findings tree matching the TestingCenter tree shape:
 * Test → Horizon → Host → Finding → Annotation
 *
 * Six findings across two horizons (External, Internal), four hosts.
 * Each finding has one annotation with a correction value.
 */
function buildSampleTree () {
  const tree = {
    id: 1001,
    type: 'test',
    name: 'Nessus Network Scan',
    description: 'Full network vulnerability assessment',
    measurement: 0,
    children: [
      {
        id: 0,
        type: 'horizon',
        name: 'External',
        description: 'Internet-accessible assets',
        measurement: 0,
        children: [
          {
            id: 'host-1',
            type: 'host',
            name: 'web-srv-01.corp.example.com',
            description: 'Primary web server',
            measurement: 0,
            children: [
              {
                id: 'finding-1',
                type: 'finding',
                name: 'Nessus 35932',
                description: 'Server uses outdated TLS 1.0',
                measurement: 75,
                children: [
                  { id: 'ann-1', type: 'annotation', name: 'Accept Risk', measurement: 0.35 }
                ]
              },
              {
                id: 'finding-2',
                type: 'finding',
                name: 'Nessus 35933',
                description: 'Security headers not present',
                measurement: 53,
                children: [
                  { id: 'ann-2', type: 'annotation', name: 'External Control', measurement: 0.65 }
                ]
              }
            ]
          },
          {
            id: 'host-2',
            type: 'host',
            name: 'db-srv-02.internal.corp',
            description: 'Database server (DMZ)',
            measurement: 0,
            children: [
              {
                id: 'finding-3',
                type: 'finding',
                name: 'Nessus 35934',
                description: 'SQL injection in search parameter',
                measurement: 98,
                children: [
                  { id: 'ann-3', type: 'annotation', name: 'Remediate', measurement: 0.80 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 1,
        type: 'horizon',
        name: 'Internal Network',
        description: 'Internal-only assets',
        measurement: 0,
        children: [
          {
            id: 'host-3',
            type: 'host',
            name: 'fileshare-01.corp.local',
            description: 'Internal file server',
            measurement: 0,
            children: [
              {
                id: 'finding-4',
                type: 'finding',
                name: 'Nessus 35935',
                description: 'Default admin credentials on database',
                measurement: 95,
                children: [
                  { id: 'ann-4', type: 'annotation', name: 'Transfer Risk', measurement: 0.45 }
                ]
              },
              {
                id: 'finding-5',
                type: 'finding',
                name: 'Nessus 35936',
                description: 'Database not using encryption',
                measurement: 81,
                children: [
                  { id: 'ann-5', type: 'annotation', name: 'Avoid Risk', measurement: 0.55 }
                ]
              }
            ]
          },
          {
            id: 'host-4',
            type: 'host',
            name: 'mail-srv-03.corp.local',
            description: 'Internal mail relay',
            measurement: 0,
            children: [
              {
                id: 'finding-6',
                type: 'finding',
                name: 'Nessus 35937',
                description: 'Mail server software outdated',
                measurement: 58,
                children: [
                  { id: 'ann-6', type: 'annotation', name: 'Mitigate Risk', measurement: 0.70 }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  return tree
}

// ════════════════════════════════════════════════════════════════════
// Authentication — optional Keycloak token acquisition
// ════════════════════════════════════════════════════════════════════

/**
 * Parse CLI arguments.
 *
 * @param {string[]} argv - process.argv (first 2 entries skipped)
 * @returns {{ auth: boolean, inputPath: string|null }}
 */
function parseArguments (argv) {
  const args = argv.slice(2)
  let auth = false
  let inputPath = null

  for (const arg of args) {
    if (arg === '--auth') {
      auth = true
    } else if (!arg.startsWith('-')) {
      inputPath = arg
    }
  }

  return { auth, inputPath }
}

/**
 * Acquire a JWT from Keycloak using either password or client_credentials grant.
 *
 * Keycloak connection details are loaded from Infisical via @rescor/core-config.
 * Only KEYCLOAK_USERNAME / KEYCLOAK_PASSWORD may come from env vars (dev/testing).
 *
 * @returns {Promise<{ accessToken: string, claims: object, grantType: string }>}
 */
async function acquireToken () {
  // Load Keycloak config from Infisical (Configuration-First Runtime Policy)
  const { createConfiguration } = await import('../src/persistence/database.mjs')
  const configuration = await createConfiguration()

  const keycloakUrl = ((await configuration.getConfig('idp', 'base_url')) || 'http://localhost:8080').replace(/\/$/, '')
  const realm = (await configuration.getConfig('idp', 'realm')) || 'rescor'
  const clientId = await configuration.getConfig('idp', 'client_id')
  const clientSecret = await configuration.getConfig('idp', 'client_secret')

  // Username/password only for dev/testing password grant
  const username = process.env.KEYCLOAK_USERNAME
  const password = process.env.KEYCLOAK_PASSWORD

  if (!clientId) {
    throw new Error('KEYCLOAK_CLIENT_ID is required when --auth is specified')
  }

  const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`
  const params = new URLSearchParams()
  params.set('client_id', clientId)

  let grantType

  if (username && password) {
    // Resource Owner Password grant (direct, for dev/testing)
    grantType = 'password'
    params.set('grant_type', 'password')
    params.set('username', username)
    params.set('password', password)
    if (clientSecret) {
      params.set('client_secret', clientSecret)
    }
  } else if (clientSecret) {
    // Client Credentials grant (service-to-service)
    grantType = 'client_credentials'
    params.set('grant_type', 'client_credentials')
    params.set('client_secret', clientSecret)
  } else {
    throw new Error(
      'Provide KEYCLOAK_USERNAME + KEYCLOAK_PASSWORD (password grant) ' +
      'or KEYCLOAK_CLIENT_SECRET (client_credentials grant)'
    )
  }

  console.error(`[storm-demo] Requesting token from ${tokenUrl} (grant_type=${grantType})`)

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Token request failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  const accessToken = data.access_token
  const claims = decodeToken(accessToken)

  console.error(`[storm-demo] Token acquired — sub=${claims?.sub}, expires_in=${data.expires_in}s`)

  const result = { accessToken, claims, grantType }
  return result
}

// ════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════

async function main () {
  const { auth, inputPath } = parseArguments(process.argv)

  // ── Optional authentication ───────────────────────────────────
  let authContext = null

  if (auth) {
    const tokenResult = await acquireToken()
    authContext = {
      grantType: tokenResult.grantType,
      sub: tokenResult.claims?.sub,
      preferredUsername: tokenResult.claims?.preferred_username,
      email: tokenResult.claims?.email,
      roles: tokenResult.claims?.realm_access?.roles || tokenResult.claims?.roles || [],
      issuedAt: tokenResult.claims?.iat ? new Date(tokenResult.claims.iat * 1000).toISOString() : null,
      expiresAt: tokenResult.claims?.exp ? new Date(tokenResult.claims.exp * 1000).toISOString() : null,
      issuer: tokenResult.claims?.iss
    }
    console.error(`[storm-demo] Authenticated as ${authContext.preferredUsername || authContext.sub} (roles: ${authContext.roles.join(', ') || 'none'})`)
  }

  // ── Load tree ─────────────────────────────────────────────────
  let tree
  if (inputPath) {
    const absolutePath = resolve(inputPath)
    const raw = readFileSync(absolutePath, 'utf-8')
    tree = JSON.parse(raw)
    console.error(`[storm-demo] Loaded tree from ${absolutePath}`)
  } else {
    tree = buildSampleTree()
    console.error('[storm-demo] Using built-in sample data (6 findings, 4 hosts, 2 horizons)')
  }

  // ── Run STORM calculations ────────────────────────────────────
  calculateNode(tree)

  // ── Produce output ────────────────────────────────────────────
  const summary = flattenSummary(tree)

  const output = {
    engine: 'STORM RSK/VM',
    scalingBase: SCALING_BASE,
    maximumValue: MAXIMUM_VALUE,
    upperBound: rskUpperBound(MAXIMUM_VALUE, SCALING_BASE),
    ratingScale: 'alternate',
    thresholds: { Low: '< 40 RU', Medium: '40–69 RU', High: '≥ 70 RU' },
    ...(authContext ? { auth: authContext } : {}),
    tree,
    summary
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch(error => {
  console.error(`[storm-demo] Fatal: ${error.message}`)
  process.exit(1)
})

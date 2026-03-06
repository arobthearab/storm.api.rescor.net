#!/usr/bin/env node

/**
 * STORM SDK Demo — Penetration Test Risk Assessment
 *
 * Demonstrates every major SDK capability against a running STORM API:
 *
 *   1. Health check
 *   2. Create a security_scan measurement session
 *   3. Add V-factors with hierarchy paths
 *   4. Attach confidence and control modifiers
 *   5. Retrieve the full measurement with aggregates
 *   6. Stateless RSK/VM computations (aggregate, score, rate, limit)
 *   7. Stateless RSK/RM computations (SLE, DLE)
 *   8. NIST 800-30 risk matrix
 *   9. Error handling demonstration
 *  10. Cleanup (delete measurement)
 *
 * Usage:
 *   node sdk/examples/demo.mjs
 */

import { Storm, NotFoundError, ValidationError } from '../src/index.mjs'

const DIVIDER = '─'.repeat(60)

function heading (title) {
  console.log(`\n${DIVIDER}`)
  console.log(`  ${title}`)
  console.log(DIVIDER)
}

function show (label, value) {
  console.log(`  ${label}: ${JSON.stringify(value)}`)
}

async function main () {
  const storm = new Storm({ baseUrl: 'http://localhost:3200' })

  // ── 1. Health Check ──────────────────────────────────────────
  heading('1. Health Check')
  const health = await storm.health()
  show('Status', health.status)
  show('Version', health.version)
  show('Phase', health.phase)

  // ── 2. Create Measurement Session ────────────────────────────
  heading('2. Create Measurement — Q1 2026 Pen Test')
  const measurement = await storm.measurement()
    .name('Q1 2026 Penetration Test')
    .hierarchy('security_scan')
    .scalingBase(4)
    .maximumValue(100)
    .ttl(3600)
    .metadata({ engagement: 'STRIDE-2026-Q1', assessor: 'demo' })
    .create()

  show('Measurement ID', measurement.id)
  show('Template', measurement.hierarchy.template)
  show('Levels', measurement.hierarchy.levels)
  show('Expires', measurement.expiresAt)

  const session = storm.measurement(measurement.id)

  // ── 3. Add V-Factors ────────────────────────────────────────
  heading('3. Add V-Factors (findings from scan)')

  const sqlInjection = await session
    .factor()
    .value(1.0)
    .label('SQL Injection — login form')
    .path(['External', 'Internet', '10.0.1.50', 'SQL Injection'])
    .metadata({ cve: 'CVE-2025-1234', cvss: 9.8, port: 443 })
    .add()
  show('Factor 1 (SQLi)', `${sqlInjection.id} → base ${sqlInjection.measurement.probability.base}`)

  const xss = await session
    .factor()
    .value(0.75)
    .label('Reflected XSS — search endpoint')
    .path(['External', 'Internet', '10.0.1.50', 'XSS'])
    .metadata({ cve: 'CVE-2025-5678', cvss: 6.1, port: 443 })
    .add()
  show('Factor 2 (XSS)', `${xss.id} → base ${xss.measurement.probability.base}`)

  const misconfig = await session
    .factor()
    .value(0.60)
    .label('TLS 1.0 enabled')
    .path(['External', 'Internet', '10.0.1.51', 'TLS Misconfiguration'])
    .metadata({ port: 8443 })
    .add()
  show('Factor 3 (TLS)', `${misconfig.id} → base ${misconfig.measurement.probability.base}`)

  // ── 4. Attach Modifiers ─────────────────────────────────────
  heading('4. Attach Modifiers to SQL Injection factor')

  // Confidence modifier — assessor is 90% confident in the finding
  await session
    .modifier(sqlInjection.id)
    .type('confidence')
    .value(0.90)
    .label('Assessor confidence')
    .add()
  console.log('  + confidence modifier (0.90)')

  // Control modifiers — existing mitigations
  await session
    .modifier(sqlInjection.id)
    .type('control')
    .effect('attenuate')
    .value(0.40)
    .label('Web Application Firewall')
    .add()
  console.log('  + control modifier: WAF (0.40)')

  await session
    .modifier(sqlInjection.id)
    .type('control')
    .effect('attenuate')
    .value(0.30)
    .label('Input validation')
    .add()
  console.log('  + control modifier: Input Validation (0.30)')

  await session
    .modifier(sqlInjection.id)
    .type('control')
    .effect('attenuate')
    .value(0.20)
    .label('Parameterized queries')
    .add()
  console.log('  + control modifier: Parameterized Queries (0.20)')

  // ── 5. List Factors ─────────────────────────────────────────
  heading('5. List All Factors')
  const factorList = await session.listFactors()
  const factors = factorList.data || factorList
  const factorArray = Array.isArray(factors) ? factors : []

  for (const factor of factorArray) {
    const probability = factor.measurement?.probability
    const modCount = factor.modifiers?.length || 0
    console.log(`  ${factor.id}  ${factor.label}`)
    console.log(`    base=${probability?.base}  effective=${probability?.effective}  modifiers=${modCount}`)
  }

  // ── 6. Retrieve Full Measurement ────────────────────────────
  heading('6. Full Measurement with Aggregates')
  const full = await session.get()
  show('Factor Count', full.factorCount)
  show('Aggregate (probability)', full.aggregate.probability)
  show('Aggregate (scaled)', full.aggregate.scaled)
  console.log(`\n  Hierarchy tree (${full.tree?.length || 0} root nodes):`)
  printTree(full.tree, 2)

  // ── 7. Stateless RSK/VM Computations ────────────────────────
  heading('7. RSK/VM — Stateless Computations')

  const scoreResult = await storm.rsk().vm()
    .measurements([80, 60, 45, 30])
    .scalingBase(4)
    .maximumValue(100)
    .score()
  show('Score (aggregate)', scoreResult.aggregate)
  show('Score (normalized)', scoreResult.normalized)
  show('Score (rating)', scoreResult.rating)

  const aggResult = await storm.rsk().vm()
    .measurements([80, 60, 45])
    .scalingBase(4)
    .aggregate()
  show('Aggregate', aggResult.aggregate)
  show('Upper Bound', aggResult.upperBound)

  const limitResult = await storm.rsk().vm()
    .maximumValue(100)
    .scalingBase(4)
    .limit()
  show('Theoretical Limit', limitResult.upperBound)

  const rateResult = await storm.rsk().vm()
    .measurement(75)
    .rate()
  show('Rating for 75', rateResult.rating)

  // ── 8. RSK/RM — Risk Mode ──────────────────────────────────
  heading('8. RSK/RM — Single & Distributed Loss Expectancy')

  const sleResult = await storm.rsk().rm()
    .assetValue(0.85)
    .vulnerability(0.70)
    .controlEfficacy(0.35)
    .sle()
  show('SLE', sleResult)

  const dleResult = await storm.rsk().rm()
    .assetValue(0.85)
    .threatPotential(0.60)
    .vulnerability(0.70)
    .controlEfficacy(0.35)
    .dle()
  show('DLE', dleResult)

  // ── 9. NIST 800-30 Risk Matrix ─────────────────────────────
  heading('9. NIST 800-30 Risk Matrix')
  const nistResult = await storm.nist().riskMatrix({
    likelihood: 'High',
    impact: 'Moderate'
  })
  show('NIST Result', nistResult)

  // ── 10. Error Handling ──────────────────────────────────────
  heading('10. Error Handling')

  try {
    await storm.measurement('msr_does_not_exist_at_all_00000000').get()
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log(`  Caught NotFoundError: "${error.message}" (${error.code}, HTTP ${error.status})`)
    }
  }

  try {
    await storm.rsk().vm().measurements([]).aggregate()
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log(`  Caught ValidationError: "${error.message}" (${error.code}, HTTP ${error.status})`)
    }
  }

  // ── 11. Cleanup ─────────────────────────────────────────────
  heading('11. Cleanup')
  const deleted = await session.delete()
  show('Deleted', deleted)

  // Verify deletion
  try {
    await session.get()
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log('  Confirmed: measurement no longer exists')
    }
  }

  heading('Demo Complete')
  console.log('  All SDK features exercised successfully.\n')
}

/**
 * Recursively print a measurement hierarchy tree.
 */
function printTree (nodes, indent) {
  if (!nodes) return
  const prefix = ' '.repeat(indent)

  for (const node of nodes) {
    const agg = node.aggregate?.scaled
    const aggStr = agg ? ` [base=${agg.base} adj=${agg.adjustment} eff=${agg.effective}]` : ''
    const factorCount = node.factors?.length || 0
    console.log(`${prefix}├─ ${node.level}: "${node.label}"${aggStr}  (${factorCount} factors)`)

    if (node.children?.length > 0) {
      printTree(node.children, indent + 3)
    }
  }
}

main().catch(error => {
  console.error('\nFATAL:', error.message)
  console.error(error)
  process.exitCode = 1
})

export const meta = {
  name: 'workflow-sdlc-automation',
  description: 'Autonomous SDLC pipeline — runs SRS → HLD → LLD → IMP∥TST without human interruption after upfront grilling',
  phases: [
    { title: 'SRS', detail: 'Software requirements specification with Gherkin scenarios' },
    { title: 'HLD', detail: 'High-level design — architecture, ADRs, C4 diagrams (optional)' },
    { title: 'LLD', detail: 'Low-level design — per-service tech design, API contracts (optional)' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications in parallel' },
    { title: 'Report', detail: 'Synthesize results, verify gates, generate final report' },
  ],
}

// ═══════════════════════════════════════════
// GATE CRITERIA — inline, không phụ thuộc skill references/
// ═══════════════════════════════════════════

const GATE_CRITERIA = {
  SRS: {
    required: 4,
    criteria: [
      'All FRs have Gherkin Scenario Outlines with Given/When/Then',
      'All NFRs have quantitative thresholds (p95 < Xms, availability: 99.X%)',
      'Traceability matrix complete (BR → FR → NFR)',
      'No service names, API paths, or implementation details',
    ],
    criticalIfMissing: ['No FRs defined', 'Traceability completely missing'],
  },
  HLD: {
    required: 7,
    criteria: [
      'C4 Container diagram complete (not just System Context)',
      'All ADRs have: Context, Decision, Rationale, Consequences, Alternatives Considered',
      'ADR index (agent_docs/adrs/README.md) exists with status tracking',
      'Superseded ADRs link to replacement ADR',
      'Bounded context map for each service boundary',
      'Event taxonomy + hard boundaries between services',
      'No per-service internals (reserved for LLD)',
    ],
    criticalIfMissing: ['Wrong service boundary (bounded context mismatch)'],
  },
  LLD: {
    required: 3,
    criteria: [
      'All 9 sections: Domain Model, API Contracts, REST Clients, Caching, Transaction Boundaries, Error Flows, Degraded Modes, Work Packages, Routing Overlay',
      'No new architectural decisions (belongs in HLD)',
      'Each FR has work package with routing overlay',
    ],
    criticalIfMissing: ['Missing API contracts for new services'],
  },
  IMP: {
    required: 6,
    criteria: [
      'Execution flow for each feature (step-by-step)',
      'Business rules mapped to code paths',
      'Data impact: schema changes, migrations, indexes',
      'Error mapping: exception → HTTP status → error response body',
      'Security: authz rules, input validation points, data sanitization',
      'References LLD work packages and tech-design',
    ],
    criticalIfMissing: [],
  },
  TST: {
    required: 6,
    criteria: [
      'Unit test cases with concrete inputs/expected outputs',
      'Integration test cases (Testcontainers specs)',
      'E2E test scenarios (Playwright user flows)',
      'Performance test thresholds (p95, p99)',
      'Test fixtures and mock definitions',
      'References IMP specs for feature behavior',
    ],
    criticalIfMissing: [],
  },
}

// ── Safe-parse args (MANDATORY) ──
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const {
  flow = 'task',
  featureName = 'Unnamed Feature',
  featureDescription = '',
  phases = ['SRS', 'HLD', 'LLD', 'IMP', 'TST'],
  requirements = {},
  repoPath = process.env.HOME + '/projects/AI/Kit/toolkit',
  sprintUpdate = true,
} = _args

// ── Phase Selection ──
const runSRS = phases.includes('SRS')
const runHLD = phases.includes('HLD')
const runLLD = phases.includes('LLD')
const runIMP = phases.includes('IMP')
const runTST = phases.includes('TST')

// ═══════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════

const PHASE_RESULT = {
  type: 'object',
  properties: {
    phase: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'failed', 'skipped'] },
    gate: { type: 'string', enum: ['PASS', 'PASS_WITH_WARNINGS', 'FAIL', 'CRITICAL_FAIL'] },
    gateChecked: { type: 'number' },
    gatePassed: { type: 'number' },
    outputs: { type: 'array', items: { type: 'string' } },
    frIds: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    retries: { type: 'number' },
  },
  required: ['phase', 'status', 'gate'],
}

const PIPELINE_REPORT = {
  type: 'object',
  properties: {
    flow: { type: 'string' },
    featureName: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'failed'] },
    phases: { type: 'object' },
    artifacts: { type: 'object' },
    summary: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    nextStep: { type: 'string' },
  },
  required: ['flow', 'featureName', 'status', 'phases', 'summary'],
}

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

function featureContext(extra = '') {
  return `## Feature Context
- **Feature**: ${featureName}
- **Description**: ${featureDescription}
- **Flow**: ${flow}

${extra}`
}

function srsPrompt() {
  return `You are writing a Software Requirements Specification. This is AUTOMATION MODE — no human review will follow. Be thorough.

${featureContext(`## Business Requirements
${requirements.businessRequirements || 'Derive from feature description above.'}

## Non-Functional Requirements
${requirements.nfrs || 'Define measurable thresholds for performance, availability, security, and scale.'}`)}

## Expected Outputs
1. agent_docs/features/FR-{DOMAIN}-{NNN}.md — one per functional requirement with:
   - FR-ID, title, priority (P0-P3), actor
   - Business requirement traceability
   - Detailed description
   - Acceptance criteria (numbered list)
   - Gherkin Scenario Outline with Given/When/Then
2. agent_docs/features/README.md — feature index with traceability matrix (BR → FR → NFR)
3. agent_docs/features/FR-{DOMAIN}-{NNN}.feature — Gherkin feature files

## CRITICAL RULES
- WHAT the system does, NOT HOW — no service names, no API paths, no tech stack
- Every FR must have at least one Gherkin Scenario Outline
- Every NFR must have a quantitative threshold (p95 < Xms, 99.X%, etc.)
- Use domain-specific FR-ID prefix based on feature area (AUTH, ORDER, PAYMENT, etc.)
- Assign FR-NNN sequentially starting from existing FRs in agent_docs/features/

## Gate Self-Check
Before finishing, verify:
- [ ] All FRs have Gherkin Scenario Outlines with Given/When/Then
- [ ] All NFRs have quantitative thresholds
- [ ] Traceability matrix complete (BR → FR → NFR)
- [ ] No service names, API paths, or implementation details

Report: "Gate: [PASS/FAIL] ([N]/[M] criteria met)". Return structured output.`
}

function hldPrompt(srsOutputs) {
  const srsSummary = srsOutputs
    ? `## SRS Outputs\n${srsOutputs.frIds ? srsOutputs.frIds.map(id => `- ${id}`).join('\n') : 'SRS completed — see agent_docs/features/'}\n\nFeature files: ${(srsOutputs.outputs || []).join(', ')}`
    : 'SRS outputs pending — read agent_docs/features/ for feature specs.'

  return `You are designing system architecture. This is AUTOMATION MODE — no human review will follow. Be thorough.

${featureContext(`## Architecture Requirements
${requirements.architecture || 'Derive from feature requirements. Identify services, boundaries, and architectural decisions.'}

${srsSummary}`)}

## Expected Outputs
1. agent_docs/adrs/ADR-{NNN}--{title}.md — one per architectural decision with:
   - Status (proposed, accepted, deprecated, superseded)
   - Context, Decision, Rationale, Consequences
   - Alternatives Considered (at least 2 alternatives with pros/cons)
2. agent_docs/adrs/README.md — ADR index with status tracking, links to superseded ADRs
3. agent_docs/diagrams/c4-container-{context}.puml — C4 Container diagram (PlantUML)

## CRITICAL RULES
- Architecture ONLY — no per-service internals, no code, no API paths
- Every ADR must list alternatives considered — not just the chosen approach
- ADR numbering: check agent_docs/adrs/ for highest existing number, increment
- C4 Container level: show services, databases, message brokers, external systems
- Define bounded context map for each service boundary
- Define event taxonomy if async communication is used
- Hard boundaries between services — no direct DB access across services

## Gate Self-Check
Before finishing, verify:
- [ ] C4 Container diagram complete (not just System Context)
- [ ] All ADRs have: Context, Decision, Rationale, Consequences, Alternatives Considered
- [ ] ADR index exists with status tracking
- [ ] Superseded ADRs link to replacement
- [ ] Bounded context map for each service boundary
- [ ] Event taxonomy + hard boundaries between services
- [ ] No per-service internals

Report: "Gate: [PASS/FAIL] ([N]/[M] criteria met)". Return structured output.`
}

function lldPrompt(srsOutputs, hldOutputs) {
  const contextParts = []
  if (srsOutputs) {
    contextParts.push(`## SRS Outputs\nFR-IDs: ${(srsOutputs.frIds || []).join(', ')}\nFiles: ${(srsOutputs.outputs || []).join(', ')}`)
  }
  if (hldOutputs) {
    contextParts.push(`## HLD Outputs\nADRs: ${(hldOutputs.outputs || []).join(', ')}`)
  }

  return `You are writing per-service technical design. This is AUTOMATION MODE — no human review will follow.

${featureContext(`## Service Requirements
${requirements.architecture || 'Derive from SRS feature specs and HLD architecture.'}

${contextParts.join('\n\n')}`)}

## Expected Outputs
For EACH affected service, create:
1. agent_docs/{backend,frontend}/{service,app}/tech-design/FR-{DOMAIN}-{NNN}-design.md
2. agent_docs/contracts/api-{domain}.yaml — OpenAPI 3.0 contracts

## 9 Required Sections per Tech Design
1. **Domain Model** — entities, value objects, aggregates, domain events
2. **API Contracts** — endpoints, request/response schemas, status codes
3. **REST Clients** — external service calls with circuit breaker configs
4. **Caching Strategy** — cache keys, TTL, invalidation patterns
5. **Transaction Boundaries** — unit of work scope, saga patterns for distributed tx
6. **Error Flows** — exception hierarchy, error responses, retry policies
7. **Degraded Modes** — fallback behavior khi dependencies không available
8. **Work Packages** — mỗi FR một work package với estimated effort
9. **Routing Overlay** — API gateway routes, path prefixes, middleware

## CRITICAL RULES
- Service internals ONLY — no new architectural decisions (those belong in HLD)
- Every FR from SRS must have at least one work package
- API contracts phải là OpenAPI 3.0 hợp lệ
- Circuit breaker configs: specific thresholds (failureRate ≥ 50%, waitDuration ≥ 30s)

## Gate Self-Check
Before finishing, verify:
- [ ] All 9 sections present
- [ ] No new architectural decisions
- [ ] Each FR has work package with routing overlay

Report: "Gate: [PASS/FAIL] ([N]/[M] criteria met)". Return structured output.`
}

function impPrompt(srsOutputs, lldOutputs) {
  const contextParts = []
  if (srsOutputs) {
    contextParts.push(`## SRS Outputs\nFR-IDs: ${(srsOutputs.frIds || []).join(', ')}`)
  }
  if (lldOutputs) {
    contextParts.push(`## LLD Outputs\nFiles: ${(lldOutputs.outputs || []).join(', ')}`)
  }

  return `You are writing implementation specifications. This is AUTOMATION MODE — no human review will follow.

${featureContext(`## Implementation Context
${requirements.implementation || 'Derive from SRS + LLD. Define execution flows, business rules, error mapping, and security.'}

${contextParts.join('\n\n')}`)}

## Expected Outputs
For EACH feature (FR-ID), create:
- agent_docs/{backend,frontend}/{service,app}/implementation/FR-{DOMAIN}-{NNN}-impl.md

## Required Content per IMP Spec
1. **Execution Flow** — step-by-step, mỗi step: input → processing → output
2. **Business Rules** — mapped đến specific code paths
3. **Data Impact** — schema changes, migrations, new indexes
4. **Error Mapping** — exception type → HTTP status → error response body
5. **Security** — authz rules, input validation points, data sanitization
6. **References** — LLD work packages, tech-design sections

## CRITICAL RULES
- Specifications ONLY — no actual code
- Every business rule must trace to a specific code path
- Error mapping must be exhaustive (all exception types covered)
- Security section must address: authz, input validation, data sanitization

## Gate Self-Check
Before finishing, verify:
- [ ] Execution flow for each feature (step-by-step)
- [ ] Business rules mapped to code paths
- [ ] Data impact documented (schema, migrations, indexes)
- [ ] Error mapping: exception → HTTP status → error body
- [ ] Security: authz rules, input validation, data sanitization
- [ ] References LLD work packages

Report: "Gate: [PASS/FAIL] ([N]/[M] criteria met)". Return structured output.`
}

function tstPrompt(srsOutputs, impOutputs) {
  const contextParts = []
  if (srsOutputs) {
    contextParts.push(`## SRS Outputs\nFR-IDs: ${(srsOutputs.frIds || []).join(', ')}`)
  }
  if (impOutputs) {
    contextParts.push(`## IMP Outputs\nFiles: ${(impOutputs.outputs || []).join(', ')}`)
  }

  return `You are writing test specifications. This is AUTOMATION MODE — no human review will follow. TDD-first approach.

${featureContext(`## Test Requirements
${requirements.implementation || 'Derive from SRS + IMP. Define unit, integration, E2E, and performance tests.'}

${contextParts.join('\n\n')}`)}

## Expected Outputs
For EACH feature (FR-ID), create:
- agent_docs/{backend,frontend}/{service,app}/test-specs/FR-{DOMAIN}-{NNN}-test.md

## Required Content per TST Spec
1. **Unit Test Cases** — concrete inputs → expected outputs. Cover: happy path, BVA, error cases.
2. **Integration Test Cases** — Testcontainers specs, WireMock stubs, DB fixtures
3. **E2E Test Scenarios** — Playwright user flows, page objects, assertions
4. **Performance Test Thresholds** — p95 < Xms, p99 < Xms, target RPS
5. **Test Fixtures** — sample data, mock definitions, factory methods
6. **References** — IMP specs cho feature behavior

## CRITICAL RULES
- Test specifications ONLY — no test code
- Every test case must have concrete input values and expected output values
- Integration tests: specify Docker images, WireMock mappings, DB seed data
- Performance thresholds must be quantitative

## Gate Self-Check
Before finishing, verify:
- [ ] Unit test cases with concrete inputs/expected outputs
- [ ] Integration test cases (Testcontainers specs)
- [ ] E2E test scenarios (Playwright user flows)
- [ ] Performance test thresholds (p95, p99)
- [ ] Test fixtures and mock definitions
- [ ] References IMP specs

Report: "Gate: [PASS/FAIL] ([N]/[M] criteria met)". Return structured output.`
}

// ── Gate Result Parser ──
function parseGateResult(reportText) {
  if (!reportText) return { gate: 'FAIL', checked: 0, passed: 0 }
  const match = reportText.match(/Gate:\s*(PASS|PASS_WITH_WARNINGS|FAIL|CRITICAL_FAIL)\s*\(?(\d+)\/(\d+)/i)
  if (match) {
    return { gate: match[1], passed: parseInt(match[2]), checked: parseInt(match[3]) }
  }
  // Fallback: search for gate language
  if (reportText.includes('CRITICAL_FAIL')) return { gate: 'CRITICAL_FAIL', passed: 0, checked: 0 }
  if (reportText.includes('PASS')) return { gate: 'PASS', passed: 0, checked: 0 }
  return { gate: 'FAIL', passed: 0, checked: 0 }
}

function extractOutputs(reportText) {
  if (!reportText) return []
  const outputs = []
  const patterns = [
    /agent_docs\/[^\s,\)]+\.md/g,
    /agent_docs\/[^\s,\)]+\.yaml/g,
    /agent_docs\/[^\s,\)]+\.puml/g,
    /agent_docs\/[^\s,\)]+\.feature/g,
  ]
  for (const pattern of patterns) {
    const matches = reportText.matchAll(pattern)
    for (const m of matches) {
      if (!outputs.includes(m[0])) outputs.push(m[0])
    }
  }
  return outputs
}

function extractFrIds(reportText) {
  if (!reportText) return []
  const matches = reportText.matchAll(/FR-[A-Z]+-\d+/g)
  return [...new Set([...matches].map(m => m[0]))]
}

// ── Phase Runner with Retry ──
async function runPhase(phaseName, agentType, prompt, dependsOn = null) {
  if (dependsOn && dependsOn.status === 'failed') {
    log(`SKIP ${phaseName} — dependency ${dependsOn.phase} failed`)
    return {
      phase: phaseName,
      status: 'skipped',
      gate: 'FAIL',
      gateChecked: 0,
      gatePassed: 0,
      outputs: [],
      frIds: [],
      issues: [`Skipped due to failed dependency: ${dependsOn.phase}`],
      retries: 0,
    }
  }

  const MAX_RETRIES = 1
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const label = attempt > 0 ? `${phaseName}-retry${attempt}` : phaseName
    try {
      log(`${attempt > 0 ? 'RETRY ' : ''}Spawning ${agentType} agent for ${phaseName}...`)

      const result = await agent(prompt, {
        label: label,
        phase: phaseName,
        agentType: agentType,
        model: 'fable',
      })

      if (!result) {
        lastError = `${agentType} agent returned null/empty`
        if (attempt < MAX_RETRIES) {
          log(`WARNING: ${lastError} — retrying (${attempt + 1}/${MAX_RETRIES})`)
          continue
        }
        return {
          phase: phaseName,
          status: 'failed',
          gate: 'FAIL',
          gateChecked: 0,
          gatePassed: 0,
          outputs: [],
          frIds: [],
          issues: [lastError],
          retries: attempt,
        }
      }

      const reportText = typeof result === 'string' ? result : JSON.stringify(result)
      const gateResult = parseGateResult(reportText)
      const outputs = extractOutputs(reportText)
      const frIds = extractFrIds(reportText)

      const isPassing = gateResult.gate === 'PASS' || gateResult.gate === 'PASS_WITH_WARNINGS'
      log(`${isPassing ? '✅' : '⚠️'} ${phaseName} complete — gate: ${gateResult.gate} (${gateResult.passed}/${gateResult.checked})`)

      if (outputs.length > 0) {
        log(`  📄 Outputs: ${outputs.join(', ')}`)
      }

      return {
        phase: phaseName,
        status: gateResult.gate === 'CRITICAL_FAIL' ? 'failed' : 'completed',
        gate: gateResult.gate,
        gateChecked: gateResult.checked,
        gatePassed: gateResult.passed,
        outputs: outputs,
        frIds: frIds,
        issues: gateResult.gate === 'FAIL' || gateResult.gate === 'CRITICAL_FAIL'
          ? [`Gate ${gateResult.gate}: ${gateResult.passed}/${gateResult.checked} criteria met`]
          : [],
        retries: attempt,
      }
    } catch (e) {
      lastError = e.message || String(e)
      if (attempt < MAX_RETRIES) {
        log(`ERROR: ${lastError} — retrying (${attempt + 1}/${MAX_RETRIES})`)
        continue
      }
      log(`FAIL: ${phaseName} after ${MAX_RETRIES + 1} attempt(s): ${lastError}`)
      return {
        phase: phaseName,
        status: 'failed',
        gate: 'FAIL',
        gateChecked: 0,
        gatePassed: 0,
        outputs: [],
        frIds: [],
        issues: [`Agent error after ${MAX_RETRIES + 1} attempts: ${lastError}`],
        retries: attempt,
      }
    }
  }
}

// ═══════════════════════════════════════════
// PIPELINE EXECUTION
// ═══════════════════════════════════════════

log(`🏁 Automation pipeline started: ${featureName}`)
log(`📋 Flow: ${flow} | Phases: ${phases.join(' → ')}`)
log(`📂 Repo: ${repoPath}`)

const results = {}
const warnings = []

// ── Phase 1: SRS ──
let srsResult = null
if (runSRS) {
  phase('SRS')
  srsResult = await runPhase('SRS', 'sdlc-srs', srsPrompt())
  results.SRS = srsResult

  if (srsResult.status === 'failed' && srsResult.gate === 'CRITICAL_FAIL') {
    log('🛑 CRITICAL: SRS failed — cannot continue pipeline')
    return buildReport('failed', results, warnings)
  }
} else {
  results.SRS = { phase: 'SRS', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
}

// ── Phase 2: HLD ──
let hldResult = null
if (runHLD) {
  phase('HLD')
  hldResult = await runPhase('HLD', 'sdlc-hld', hldPrompt(srsResult), srsResult)
  results.HLD = hldResult

  if (hldResult.status === 'failed' && hldResult.gate === 'CRITICAL_FAIL') {
    warnings.push('HLD critical failure — LLD và downstream phases sẽ thiếu architectural context')
  }
} else {
  results.HLD = { phase: 'HLD', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
}

// ── Phase 3: LLD ──
let lldResult = null
if (runLLD) {
  phase('LLD')
  lldResult = await runPhase('LLD', 'sdlc-lld', lldPrompt(srsResult, hldResult), srsResult)
  results.LLD = lldResult

  if (lldResult.status === 'failed') {
    warnings.push('LLD failure — IMP sẽ thiếu API contracts')
  }
} else {
  results.LLD = { phase: 'LLD', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
}

// ── Phase 4: IMP ∥ TST ──
if (runIMP || runTST) {
  phase('IMP+TST')

  const parallelTasks = []

  if (runIMP) {
    parallelTasks.push(async () => {
      const result = await runPhase('IMP', 'sdlc-imp', impPrompt(srsResult, lldResult))
      results.IMP = result
    })
  } else {
    results.IMP = { phase: 'IMP', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (runTST) {
    parallelTasks.push(async () => {
      const result = await runPhase('TST', 'sdlc-tst', tstPrompt(srsResult, null))
      results.TST = result
    })
  } else {
    results.TST = { phase: 'TST', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (parallelTasks.length > 0) {
    log(`Spawning ${parallelTasks.length} agent(s) in parallel: ${[runIMP && 'IMP', runTST && 'TST'].filter(Boolean).join(' + ')}`)
    await parallel(parallelTasks)
  }
}

// ── Phase 5: Synthesize Report ──
phase('Report')

return buildReport('completed', results, warnings)

// ═══════════════════════════════════════════
// REPORT BUILDER
// ═══════════════════════════════════════════

function buildReport(status, results, warnings) {
  const allOutputs = []
  const allFrIds = new Set()
  let totalGateChecked = 0
  let totalGatePassed = 0
  let hasFailures = false

  for (const [phase, result] of Object.entries(results)) {
    if (result.status === 'completed' || result.status === 'failed') {
      totalGateChecked += result.gateChecked || 0
      totalGatePassed += result.gatePassed || 0
      if (result.outputs) allOutputs.push(...result.outputs)
      if (result.frIds) result.frIds.forEach(id => allFrIds.add(id))
      if (result.status === 'failed' || result.gate === 'FAIL' || result.gate === 'CRITICAL_FAIL') {
        hasFailures = true
      }
    }
  }

  const finalStatus = status === 'failed' ? 'failed'
    : hasFailures ? 'partial'
    : 'completed'

  const summaryParts = []
  const phaseList = Object.entries(results)
    .map(([p, r]) => `${p}: ${r.status} (gate: ${r.gate})`)
    .join(', ')
  summaryParts.push(`Phases: ${phaseList}`)
  if (totalGateChecked > 0) {
    summaryParts.push(`Gate criteria: ${totalGatePassed}/${totalGateChecked} met overall`)
  }
  if (allFrIds.size > 0) {
    summaryParts.push(`FR-IDs: ${[...allFrIds].sort().join(', ')}`)
  }
  if (warnings.length > 0) {
    summaryParts.push(`Warnings: ${warnings.length}`)
  }

  const artifacts = {
    features: [...allFrIds].sort(),
    outputs: allOutputs,
  }

  const nextStep = finalStatus === 'failed'
    ? 'Khắc phục SRS issues và chạy lại automation, hoặc chuyển sang sdlc-orchestrator để có human review'
    : 'flow cook để triển khai code từ specs'

  log(`🏁 Pipeline ${finalStatus}: ${featureName}`)
  log(`   ${summaryParts.join(' | ')}`)
  if (warnings.length > 0) {
    warnings.forEach(w => log(`   ⚠️ ${w}`))
  }
  log(`   🔗 Next: ${nextStep}`)

  return {
    flow: flow,
    featureName: featureName,
    status: finalStatus,
    phases: results,
    artifacts: artifacts,
    summary: summaryParts.join(' | '),
    warnings: warnings,
    nextStep: nextStep,
  }
}

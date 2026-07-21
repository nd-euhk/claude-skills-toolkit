export const meta = {
  name: 'workflow-sdlc-automation',
  description: 'Autonomous SDLC pipeline — runs SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST with independent sdlc-gate verification after each phase, without human interruption after upfront grilling',
  phases: [
    { title: 'SRS', detail: 'Software requirements specification with Gherkin scenarios' },
    { title: 'HLD', detail: 'High-level design — architecture, ADRs, C4 diagrams (optional)' },
    { title: 'LLD', detail: 'Low-level design — per-service tech design, API contracts (optional)' },
    { title: 'CROSS-CUTTING', detail: 'System-wide standards — error handling, caching, performance, frontend' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications in parallel' },
    { title: 'Gate', detail: 'Independent sdlc-gate verification — read-only, per-phase criteria, retry with regression detection' },
    { title: 'Report', detail: 'Synthesize results, generate final report' },
  ],
}

// ═══════════════════════════════════════════
// GATE VERIFICATION — delegated to sdlc-gate agent
// See gateCheck() below — spawns dedicated read-only gate agent
// ═══════════════════════════════════════════

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
  crossCutting = {},
} = _args

// ── Phase Selection ──
const runSRS = phases.includes('SRS')
const runHLD = phases.includes('HLD')
const runLLD = phases.includes('LLD')
const runCROSS_CUTTING = phases.includes('CROSS-CUTTING')
const runIMP = phases.includes('IMP')
const runTST = phases.includes('TST')

// ── Cross-Cutting Scope Detection ──
// Dựa trên crossCutting flags từ grilling (ưu tiên) hoặc auto-detect từ phase context
const ccScope = {
  errorHandling: crossCutting.errorHandling !== false,       // default true nếu có backend
  cachingStrategy: crossCutting.cachingStrategy === true,    // default false — cần explicit opt-in
  performanceTest: crossCutting.performanceTest === true,    // default false — cần NFR-PERF targets
  frontendArchitecture: crossCutting.frontendArchitecture === true,  // default false — cần FE service
  frontendTestStrategy: crossCutting.frontendTestStrategy === true,  // default false — cần FE arch + error-handling
}
const ccEnabled = Object.values(ccScope).some(v => v === true)

// ═══════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════

const PHASE_RESULT = {
  type: 'object',
  properties: {
    phase: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'failed', 'skipped'] },
    gate: { type: 'string', enum: ['PASS', 'FAIL'] },
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

Return structured output with list of created files and FR-IDs.`
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

Return structured output with list of created files.`
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
1. **agent_docs/tech-design/{name}-service.md** — one per service, all 9 sections (step 1)
2. **agent_docs/tech-design/cross-cutting.md** — shared concerns: auth, logging, tracing, correlation IDs (step 2)
3. **agent_docs/contracts/api-{domain}.yaml** — OpenAPI 3.0 contracts per domain (step 3)
4. **agent_docs/contracts/error-codes.md** — error code catalog organized by domain (step 3)
5. **agent_docs/features/FR-*.md** — enriched with routing overlay: backend_service, api_endpoints, frontend_pages, scope (step 4)
6. **agent_docs/features/README.md** — feature index with priority list + dependency graph in Mermaid (step 5)
7. **agent_docs/frontend/{app}/api-routing.md** — page-to-API mapping, data requirements per page (step 6, if frontend exists)

## 9 Required Sections per Tech Design (step 1)
1. **Service Boundary** — what this service owns: aggregates, data, responsibilities
2. **Internal Architecture** — layered/hexagonal/clean: controllers → services → repositories
3. **Domain Model** — aggregates, entities, value objects, enums, state machines, invariants
4. **REST Clients** — external service calls: timeout, retry, circuit breaker (threshold, half-open, fallback)
5. **Transaction Boundaries** — unit of work scope, rollback triggers, compensating actions
6. **Integration Points** — inbound APIs, outbound calls, event publishers/consumers
7. **Caching Strategy** — what to cache, TTL, invalidation, cache-aside vs write-through
8. **Performance & Scale** — expected QPS, bottleneck analysis, scaling strategy
9. **Error Flows & Degraded Mode** — error taxonomy, retry policies, graceful degradation, user-facing messages

## CRITICAL RULES
- Service internals ONLY — no new architectural decisions (those belong in HLD)
- Every FR from SRS must be enriched with routing overlay (step 4)
- API contracts must be valid OpenAPI 3.0
- Circuit breaker configs: concrete thresholds (failureRate ≥ 50%, waitDuration ≥ 30s)
- All .md files MUST have YAML frontmatter

Return structured output with list of created files and enriched FR-IDs.`
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

Return structured output with list of created files and FR-IDs.`
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

Return structured output with list of created files and FR-IDs.`
}

function crossCuttingPrompt(agentType, srsOutputs, hldOutputs, lldOutputs) {
  const contextParts = []
  if (srsOutputs) {
    contextParts.push(`## SRS Outputs\nFR-IDs: ${(srsOutputs.frIds || []).join(', ')}\nFiles: ${(srsOutputs.outputs || []).join(', ')}`)
  }
  if (hldOutputs) {
    contextParts.push(`## HLD Outputs\nADRs: ${(hldOutputs.outputs || []).join(', ')}`)
  }
  if (lldOutputs) {
    contextParts.push(`## LLD Outputs\nFiles: ${(lldOutputs.outputs || []).join(', ')}`)
  }

  const agentDescriptions = {
    'sdlc-lld-error-handling': 'synthesize system-wide error handling standards from per-service LLD error flows',
    'sdlc-lld-caching-strategy': 'synthesize system-wide caching strategy from per-service LLD cache plans and HLD architecture',
    'sdlc-lld-performance-test': 'create performance test plan from SRS NFRs and per-service LLD performance targets',
    'sdlc-lld-frontend-architecture': 'synthesize frontend architecture decisions from HLD architecture and LLD routing',
    'sdlc-lld-frontend-test-strategy': 'synthesize frontend test strategy from frontend-architecture decisions and error handling standards',
  }

  return `You are a cross-cutting synthesis agent. This is AUTOMATION MODE — no human review will follow. Your task: ${agentDescriptions[agentType] || 'synthesize system-wide standards from per-service outputs'}.

${featureContext(`## Cross-Cutting Context
${requirements.architecture || 'Derive from SRS + HLD + LLD outputs.'}

${contextParts.join('\n\n')}`)}

## CRITICAL RULES
- Read ALL relevant per-service files before synthesizing
- Never invent standards not present in source files
- Cross-reference architecture.md, tech-design files, and hard-boundaries.md
- Follow the template structure exactly (load from .claude/templates/supporting/)
- All sections must be populated — no "TODO" or placeholder text
- Be consistent with per-service LLD outputs — no contradictions

Return structured output with path to the created file.`
}

// ── Gate Result Parser (sdlc-gate structured output) ──
function parseGateVerdict(reportText) {
  if (!reportText) return { gate: 'FAIL', checked: 0, passed: 0, critical: false }
  // Parse GATE_VERDICT: PASS|FAIL (first line of sdlc-gate output)
  const verdictMatch = reportText.match(/GATE_VERDICT:\s*(PASS|FAIL)/i)
  const gate = verdictMatch ? verdictMatch[1] : 'FAIL'
  // Parse summary: "## Summary: PASS — 4/4 criteria met" or similar
  const summaryMatch = reportText.match(/Summary:.*?(\d+)\/(\d+)/)
  const passed = summaryMatch ? parseInt(summaryMatch[1]) : 0
  const checked = summaryMatch ? parseInt(summaryMatch[2]) : 0
  // Detect critical failure
  const critical = /CRITICAL/i.test(reportText) || gate === 'FAIL' && checked === 0
  return { gate, checked, passed, critical }
}

// ── Gate Check — spawn sdlc-gate for independent verification ──
async function gateCheck(phaseName, outputs, attempt = 1, previousFailure = null, opts = {}) {
  const { crossCuttingScope = null, services = [], domains = [] } = opts

  let prompt = `Verify ${phaseName} phase outputs against gate criteria.

Phase: ${phaseName}
Attempt: ${attempt}/3

Expected outputs:
${outputs.length > 0 ? outputs.map(f => `- ${f}`).join('\n') : '(auto-detect from agent_docs/)'}`

  if (services.length > 0) {
    prompt += `\n\nServices:\n${services.map(s => `- ${s}`).join('\n')}`
  }
  if (domains.length > 0) {
    prompt += `\n\nDomains:\n${domains.map(d => `- ${d}`).join('\n')}`
  }
  if (crossCuttingScope) {
    const ccFlags = Object.entries(crossCuttingScope)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .join(', ')
    prompt += `\n\nCross-cutting scope (only validate these files): ${ccFlags}`
  }
  if (previousFailure) {
    prompt += `\n\nPrevious gate failure (attempt ${attempt - 1}):\n${previousFailure}\nFocus on previously failed criteria. Flag any regression: criteria that passed before but fail now.`
  }

  try {
    const result = await agent(prompt, {
      label: `gate-${phaseName}${attempt > 1 ? `-r${attempt}` : ''}`,
      phase: `Gate-${phaseName}`,
      agentType: 'sdlc-gate',
      model: 'sonnet',
    })

    if (!result) {
      return { gate: 'FAIL', checked: 0, passed: 0, critical: false, details: 'sdlc-gate returned null' }
    }

    const reportText = typeof result === 'string' ? result : JSON.stringify(result)
    const verdict = parseGateVerdict(reportText)
    verdict.details = reportText
    return verdict
  } catch (e) {
    log(`ERROR: sdlc-gate crash for ${phaseName}: ${e.message || String(e)}`)
    return { gate: 'FAIL', checked: 0, passed: 0, critical: false, details: `sdlc-gate error: ${e.message || String(e)}` }
  }
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

// ── Phase Runner with Gate ──
// Spawns writing agent → extracts outputs → spawns sdlc-gate for independent verification
// Set skipGate=true for phases where gate is handled separately (e.g., cross-cutting)
async function runPhase(phaseName, agentType, prompt, dependsOn = null, opts = {}) {
  const { skipGate = false, gateOpts = {} } = opts

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
  let previousFailure = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const label = attempt > 0 ? `${phaseName}-retry${attempt}` : phaseName
    try {
      // ── Step 1: Spawn writing agent ──
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
      const outputs = extractOutputs(reportText)
      const frIds = extractFrIds(reportText)

      log(`${agentType} complete — ${outputs.length} output(s), ${frIds.length} FR(s)`)

      // ── Step 2: Spawn sdlc-gate for independent verification ──
      if (skipGate) {
        log(`⏭️  Gate skipped for ${phaseName} (deferred to separate gate phase)`)
        return {
          phase: phaseName,
          status: 'completed',
          gate: 'PASS',
          gateChecked: 0,
          gatePassed: 0,
          outputs: outputs,
          frIds: frIds,
          issues: [],
          retries: attempt,
        }
      }

      log(`Spawning sdlc-gate for ${phaseName} verification...`)
      const gateResult = await gateCheck(
        phaseName.toLowerCase(),
        outputs,
        attempt + 1,
        previousFailure,
        gateOpts,
      )

      const isPassing = gateResult.gate === 'PASS'
      log(`${isPassing ? '✅' : '⚠️'} ${phaseName} gate: ${gateResult.gate} (${gateResult.passed}/${gateResult.checked})`)

      if (outputs.length > 0) {
        log(`  📄 Outputs: ${outputs.join(', ')}`)
      }

      if (isPassing) {
        return {
          phase: phaseName,
          status: 'completed',
          gate: gateResult.gate,
          gateChecked: gateResult.checked,
          gatePassed: gateResult.passed,
          outputs: outputs,
          frIds: frIds,
          issues: [],
          retries: attempt,
        }
      }

      // Gate FAIL — prepare retry context
      const failSummary = `Gate FAIL: ${gateResult.passed}/${gateResult.checked} criteria met`
      if (attempt < MAX_RETRIES) {
        log(`⚠️  ${failSummary} — retrying with failure context (${attempt + 1}/${MAX_RETRIES})`)
        previousFailure = failSummary + '\n' + (gateResult.details || '')
        continue
      }

      // Max retries exhausted
      return {
        phase: phaseName,
        status: gateResult.critical ? 'failed' : 'completed',
        gate: gateResult.gate,
        gateChecked: gateResult.checked,
        gatePassed: gateResult.passed,
        outputs: outputs,
        frIds: frIds,
        issues: [`${failSummary} after ${MAX_RETRIES + 1} attempts`],
        retries: attempt,
      }

    } catch (e) {
      lastError = e.message || String(e)
      if (attempt < MAX_RETRIES) {
        log(`ERROR: ${lastError} — retrying (${attempt + 1}/${MAX_RETRIES})`)
        previousFailure = `Agent error: ${lastError}`
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
if (runCROSS_CUTTING) {
  const ccList = Object.entries(ccScope).filter(([, v]) => v).map(([k]) => k).join(', ')
  log(`🔀 Cross-cutting: ${ccList}`)
}
log(`📂 Repo: ${repoPath}`)

const results = {}
const warnings = []

// ── Phase 1: SRS ──
let srsResult = null
if (runSRS) {
  phase('SRS')
  srsResult = await runPhase('SRS', 'sdlc-srs', srsPrompt())
  results.SRS = srsResult

  if (srsResult.status === 'failed') {
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

  if (hldResult.status === 'failed') {
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

// ── Phase 4: CROSS-CUTTING ──
let ccResults = {}
if (runCROSS_CUTTING && ccEnabled) {
  phase('CROSS-CUTTING')

  // ── Scope Detection & Validation ──
  // Nếu LLD bị skip nhưng CROSS-CUTTING được yêu cầu, cảnh báo
  if (!runLLD && ccScope.errorHandling) {
    warnings.push('CROSS-CUTTING: error-handling được yêu cầu nhưng LLD bị skip — agent sẽ thiếu per-service error flows')
  }
  if (!runLLD && ccScope.cachingStrategy) {
    warnings.push('CROSS-CUTTING: caching-strategy được yêu cầu nhưng LLD bị skip — agent sẽ thiếu per-service cache plans')
  }
  if (!runSRS && ccScope.performanceTest) {
    warnings.push('CROSS-CUTTING: performance-test được yêu cầu nhưng SRS bị skip — agent sẽ thiếu NFR-PERF targets')
  }

  // ── Stage 1: Spawn 4 agents song song (chỉ spawn những agent được chọn) ──
  const stage1Tasks = []
  const stage1AgentTypes = []

  if (ccScope.errorHandling) {
    stage1AgentTypes.push('sdlc-lld-error-handling')
    stage1Tasks.push(async () => {
      const result = await runPhase('CC-error-handling', 'sdlc-lld-error-handling',
        crossCuttingPrompt('sdlc-lld-error-handling', srsResult, hldResult, lldResult), null, { skipGate: true })
      ccResults.errorHandling = result
    })
  } else {
    ccResults.errorHandling = { phase: 'CC-error-handling', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (ccScope.cachingStrategy) {
    stage1AgentTypes.push('sdlc-lld-caching-strategy')
    stage1Tasks.push(async () => {
      const result = await runPhase('CC-caching-strategy', 'sdlc-lld-caching-strategy',
        crossCuttingPrompt('sdlc-lld-caching-strategy', srsResult, hldResult, lldResult), null, { skipGate: true })
      ccResults.cachingStrategy = result
    })
  } else {
    ccResults.cachingStrategy = { phase: 'CC-caching-strategy', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (ccScope.performanceTest) {
    stage1AgentTypes.push('sdlc-lld-performance-test')
    stage1Tasks.push(async () => {
      const result = await runPhase('CC-performance-test', 'sdlc-lld-performance-test',
        crossCuttingPrompt('sdlc-lld-performance-test', srsResult, hldResult, lldResult), null, { skipGate: true })
      ccResults.performanceTest = result
    })
  } else {
    ccResults.performanceTest = { phase: 'CC-performance-test', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (ccScope.frontendArchitecture) {
    stage1AgentTypes.push('sdlc-lld-frontend-architecture')
    stage1Tasks.push(async () => {
      const result = await runPhase('CC-frontend-architecture', 'sdlc-lld-frontend-architecture',
        crossCuttingPrompt('sdlc-lld-frontend-architecture', srsResult, hldResult, lldResult), null, { skipGate: true })
      ccResults.frontendArchitecture = result
    })
  } else {
    ccResults.frontendArchitecture = { phase: 'CC-frontend-architecture', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  if (stage1Tasks.length > 0) {
    log(`Spawning ${stage1Tasks.length} cross-cutting agent(s) in parallel (Stage 1): ${stage1AgentTypes.join(' + ')}`)
    await parallel(stage1Tasks)
  }

  // ── Stage 2: frontend-test-strategy (phụ thuộc frontend-architecture + error-handling) ──
  const feArchDone = ccResults.frontendArchitecture && ccResults.frontendArchitecture.status === 'completed'
  const errHandlingDone = ccResults.errorHandling && ccResults.errorHandling.status === 'completed'

  if (ccScope.frontendTestStrategy) {
    if (!feArchDone) {
      warnings.push('CROSS-CUTTING: frontend-test-strategy bị skip — frontend-architecture chưa hoàn thành')
      ccResults.frontendTestStrategy = {
        phase: 'CC-frontend-test-strategy', status: 'skipped', gate: 'FAIL',
        outputs: [], frIds: [], issues: ['Dependency not met: frontend-architecture.md missing']
      }
    } else if (!errHandlingDone) {
      warnings.push('CROSS-CUTTING: frontend-test-strategy bị skip — error-handling chưa hoàn thành')
      ccResults.frontendTestStrategy = {
        phase: 'CC-frontend-test-strategy', status: 'skipped', gate: 'FAIL',
        outputs: [], frIds: [], issues: ['Dependency not met: error-handling.md missing']
      }
    } else {
      log('Spawning frontend-test-strategy (Stage 2 — depends on frontend-architecture + error-handling)')
      const result = await runPhase('CC-frontend-test-strategy', 'sdlc-lld-frontend-test-strategy',
        crossCuttingPrompt('sdlc-lld-frontend-test-strategy', srsResult, hldResult, lldResult), null, { skipGate: true })
      ccResults.frontendTestStrategy = result
    }
  } else {
    ccResults.frontendTestStrategy = { phase: 'CC-frontend-test-strategy', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
  }

  // ── Single sdlc-gate for ALL cross-cutting outputs ──
  const ccValues = Object.values(ccResults)
  const allCCOutputs = ccValues.flatMap(r => r.outputs || [])
  const ccAgentFailed = ccValues.some(r => r.status === 'failed')

  let ccGateResult = { gate: 'PASS', checked: 0, passed: 0 }
  if (!ccAgentFailed && allCCOutputs.length > 0) {
    log(`Spawning sdlc-gate for CROSS-CUTTING verification (${allCCOutputs.length} outputs)...`)
    ccGateResult = await gateCheck('cross-cutting', allCCOutputs, 1, null, {
      crossCuttingScope: ccScope,
    })
    log(`${ccGateResult.gate === 'PASS' ? '✅' : '⚠️'} CROSS-CUTTING gate: ${ccGateResult.gate} (${ccGateResult.passed}/${ccGateResult.checked})`)
  } else if (ccAgentFailed) {
    log('⚠️  Skipping CROSS-CUTTING gate — one or more agents failed')
  }

  results.CROSS_CUTTING = {
    phase: 'CROSS-CUTTING',
    status: ccAgentFailed ? 'failed'
      : ccValues.some(r => r.status === 'completed') ? 'completed' : 'skipped',
    gate: ccAgentFailed ? 'FAIL' : ccGateResult.gate,
    gateChecked: ccGateResult.checked,
    gatePassed: ccGateResult.passed,
    outputs: allCCOutputs,
    frIds: [],
    issues: ccAgentFailed
      ? ccValues.filter(r => r.status === 'failed').flatMap(r => r.issues || [])
      : (ccGateResult.gate === 'FAIL' ? [`CROSS-CUTTING gate FAIL: ${ccGateResult.passed}/${ccGateResult.checked}`] : []),
    subPhases: ccResults,
  }

  // Log CROSS-CUTTING summary
  for (const [name, r] of Object.entries(ccResults)) {
    if (r.status !== 'skipped') {
      log(`  ${r.status === 'completed' ? '✅' : '⚠️'} CC-${name}: ${r.status}`)
    }
  }
} else {
  results.CROSS_CUTTING = { phase: 'CROSS-CUTTING', status: 'skipped', gate: 'PASS', outputs: [], frIds: [], issues: [] }
}

// ── Phase 5: IMP ∥ TST ──
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

// ── Phase 6: Synthesize Report ──
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
      if (result.status === 'failed' || result.gate === 'FAIL') {
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

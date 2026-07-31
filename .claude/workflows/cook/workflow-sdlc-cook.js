export const meta = {
  name: 'workflow-sdlc-cook',
  description: 'Autonomous TDD cook pipeline — baseline → per-TC RED→GREEN→REFACTOR-light (with INTERFERENCE-LIGHT) → GATE light (with INTERFERENCE-FULL) → REFACTOR full → GATE full',
  phases: [
    { title: 'TDD Cycle', detail: 'Per-testcase RED → GREEN → INTERFERENCE-LIGHT → REFACTOR-light' },
    { title: 'GATE Light', detail: '4 critical checks + INTERFERENCE-FULL (baseline comparison)' },
    { title: 'REFACTOR Full', detail: '6 categories: security, data, perf, resilience, observability, quality' },
    { title: 'GATE Full', detail: 'All 10 gates: L1-L4 + F5-F10 (INTERFERENCE-FULL skipped)' },
    { title: 'Report', detail: 'Synthesize results, verify all gates, generate final report' },
  ],
}

// ── Safe-parse args (MANDATORY) ──
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const {
  flow = 'cook',
  featureName = 'Unnamed Feature',
  frId = 'FR-UNKNOWN',
  service = 'unknown-service',
  layer = 'backend',
  testCases = [],
  baseline = null,
  repoPath = '',
  agents = {},
  // ── Idempotent resume (dispatcher sets these when re-running after partial failure) ──
  resumeFrom = null,  // { completedTcIds: ['1','2'], gateLightPass: true, refactorDone: true, gateFullPass: false }
} = _args

// Caller chịu trách nhiệm chọn đúng agent type — workflow không suy diễn từ layer.
const RED = agents.red || (layer === 'frontend' ? 'sdlc-tdd-fe-red' : 'sdlc-tdd-be-red')
const GREEN = agents.green || (layer === 'frontend' ? 'sdlc-tdd-fe-green' : 'sdlc-tdd-be-green')
const REFACTOR = agents.refactor || (layer === 'frontend' ? 'sdlc-tdd-fe-refactor' : 'sdlc-tdd-be-refactor')
const GATE = agents.gate || (layer === 'frontend' ? 'sdlc-tdd-fe-gate' : 'sdlc-tdd-be-gate')

// ── Baseline info (pre-captured by orchestrator / automation skill) ──
const BASELINE_PATH = baseline?.path || null
const BASELINE_TC_INDEX = baseline?.tcIndex || {}
const BASELINE_PRE_EXISTING = baseline?.preExistingFailures || []
const BASELINE_BY_FILE = baseline?.byFile || {}

// ═══════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════

const TC_RESULT = {
  type: 'object',
  properties: {
    tcId: { type: 'string' },
    tcName: { type: 'string' },
    status: { type: 'string', enum: ['DONE', 'SKIPPED', 'BLOCKED', 'STALE', 'ERROR', 'INTERFERENCE'] },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testFile: { type: 'string' },
    skipReason: { type: 'string' },
    errorDetail: { type: 'string' },
  },
  required: ['tcId', 'status'],
}

const GATE_RESULT = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['light', 'full'] },
    status: { type: 'string', enum: ['PASS', 'FAIL'] },
    passed: { type: 'number' },
    total: { type: 'number' },
    failures: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['mode', 'status', 'passed', 'total'],
}

const REFACTOR_RESULT = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['light', 'full'] },
    categoriesRun: { type: 'array', items: { type: 'string' } },
    findingsFixed: { type: 'number' },
    findingsFlagged: { type: 'number' },
    testSuiteStillPassing: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['mode', 'findingsFixed', 'findingsFlagged', 'testSuiteStillPassing'],
}

const COOK_REPORT = {
  type: 'object',
  properties: {
    flow: { type: 'string' },
    featureName: { type: 'string' },
    frId: { type: 'string' },
    service: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'failed'] },
    tcResults: { type: 'array' },
    gateLight: { type: 'object' },
    refactorFull: { type: 'object' },
    gateFull: { type: 'object' },
    summary: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    nextStep: { type: 'string' },
  },
  required: ['flow', 'featureName', 'frId', 'status'],
}

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

function featureContext() {
  return `## Cook Context
- **Feature**: ${featureName}
- **FR-ID**: ${frId}
- **Service**: ${service}
- **Layer**: ${layer}
- **Agents**: RED=${RED} | GREEN=${GREEN} | REFACTOR=${REFACTOR} | GATE=${GATE}`
}

function tcContext(tc, prevResults) {
  const prevSummary = prevResults && prevResults.length > 0
    ? `## Previous TC Results
${prevResults.map(r => `- ${r.tcId}: ${r.status} — ${r.tcName} (files: ${(r.filesChanged || []).join(', ') || 'none'})`).join('\n')}`
    : '## Previous TC Results\n(First test case — no prior results)'

  return `## Test Case
- **TC**: ${tc.id} — ${tc.name}
- **Layer**: ${tc.layer || 'unit'}
- **Risk**: ${tc.risk || 'MEDIUM'}

${prevSummary}`
}

// ── Nhóm GATE failures theo file để tránh 2 agent ghi cùng file song song ──
// Failure messages thường chứa pattern: "path/to/file.ext:line" hoặc "trong path/to/file.ext"
function groupFailuresByFile(failures) {
  const groups = {}
  const filePattern = /([\w./-]+\.[\w]{1,6})(?::\d+|\)|\s|$)/

  for (const f of failures) {
    const match = f.match(filePattern)
    const file = match ? match[1] : 'unknown'
    if (!groups[file]) groups[file] = []
    groups[file].push(f)
  }
  return groups
}

// ═══════════════════════════════════════════
// TDD AGENT PROMPTS
// ═══════════════════════════════════════════

function redAgentPrompt(tc, prevResults) {
  // Baseline context: map test file → known TCs for INTERFERENCE-LIGHT
  const tcFiles = Object.keys(BASELINE_BY_FILE)
  const baselineTcList = Object.entries(BASELINE_TC_INDEX)
    .map(([id, info]) => `  - TC-${id}: ${info}`)
    .join('\n')
  const preExistingList = BASELINE_PRE_EXISTING.length > 0
    ? BASELINE_PRE_EXISTING.map(f => `  - ${f}`).join('\n')
    : '  (none)'

  return `You are the RED phase mini-orchestrator for ONE test case. Write the test, verify it fails, check for INTERFERENCE-LIGHT, then spawn GREEN + REFACTOR-light.

${featureContext()}
${tcContext(tc, prevResults)}

## Baseline Snapshot (pre-TDD)
- **Baseline file**: ${BASELINE_PATH || '(no baseline — interference detection unavailable)'}
- **Pre-existing failures** (NOT caused by this feature):
${preExistingList}

## Baseline TC Index (all tests before TDD)
${baselineTcList || '  (no baseline data)'}

## Baseline by File (for INTERFERENCE-LIGHT)
${tcFiles.map(f => `  - ${f}: TCs [${(BASELINE_BY_FILE[f] || []).join(', ')}]`).join('\n') || '  (no file groupings)'}

## Required Reading
- **TST spec**: agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/test-specs/${frId}-test.md
- **IMP spec**: agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/implementation/${frId}-impl.md
- **Tech design**: agent_docs/tech-design/${service}-service.md
- **Hard boundaries**: agent_docs/hard-boundaries.md
- **Conventions**: agent_docs/conventions.md

## Your Task (Mini-Orchestrator)

1. **Write TEST code** for test case "${tc.name}" (${tc.id})
   - Layer: ${tc.layer || 'unit'}
   - Write ONLY test code — no implementation
   - Follow project conventions for test structure

2. **Verify RED** — run the test, confirm it FAILS
   - If test PASSES unexpectedly → accidental green detection:
     a. Sanity check — verify this is truly the right test
     b. Explore — find the existing implementation that makes it pass
     c. Sabotage — temporarily break the implementation to confirm test catches it
     d. Verify — confirm test now fails after sabotage
     e. Revert — restore the implementation to working state
     f. Return SKIPPED status

3. **Spawn GREEN agent** (only if test is truly RED):
   - Agent type: ${GREEN}
   - Task: Implement MINIMAL code to pass this specific test case
   - Context: TST spec, IMP spec, tech-design, hard-boundaries, conventions

4. **INTERFERENCE-LIGHT Check** (only if GREEN succeeded):
   After GREEN implements code, run ALL tests in the SAME file as this TC to detect same-file interference:
   - Identify the test file this TC belongs to (use baseline byFile map above)
   - Run ONLY that test file (not the full suite): e.g. \`npx jest <test-file>\` or \`./gradlew :{service}:test --tests "*"\`
   - Check results: does any OTHER test (not this TC, not pre-existing failures) now FAIL?
   - If YES → **this TC's implementation broke another test in the same file**
     → Return status: INTERFERENCE
     → Include in errorDetail: which test broke, what assertion failed, what file/line
   - If NO → proceed to step 5

   **Important rules for INTERFERENCE-LIGHT:**
   - Pre-existing failures (listed above) are NOT interference — they were already broken
   - The TC's own test is NOT interference — only OTHER tests in the same file
   - If no baseline data → run all tests in the same file, flag any unexpected failure as interference

5. **Spawn REFACTOR-light agent** (only if GREEN succeeded + no interference):
   - Agent type: ${REFACTOR}
   - Mode: --mode=light
   - Task: Extract methods/functions, rename for clarity, inline trivial helpers ONLY
   - Must keep ALL tests passing

## Return Structured Output
Return a TC_RESULT object with:
- tcId: "${tc.id}"
- tcName: "${tc.name}"
- status: DONE | SKIPPED | BLOCKED | STALE | ERROR | INTERFERENCE
- filesChanged: list of all files modified/created
- testFile: path to the test file created
- skipReason: if SKIPPED, explain why (accidental green details)
- errorDetail: if BLOCKED/STALE/ERROR/INTERFERENCE, explain what went wrong
`

}

function gateAgentPrompt(mode, tcResults, techStackHint) {
  const tcSummary = tcResults
    .map(r => `- ${r.tcId}: ${r.status} — ${r.tcName} (files: ${(r.filesChanged || []).join(', ') || 'none'})`)
    .join('\n')

  const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]
  const culpritInfo = tcResults
    .filter(r => r.filesChanged && r.filesChanged.length > 0)
    .map(r => `- ${r.tcId}: ${(r.filesChanged || []).join(', ')}`)
    .join('\n')

  const baselineSection = BASELINE_PATH
    ? `## Baseline (for INTERFERENCE-FULL)
- **Baseline file**: ${BASELINE_PATH}
- **Pre-existing failures** (exclude from interference): ${BASELINE_PRE_EXISTING.length > 0 ? BASELINE_PRE_EXISTING.join(', ') : 'none'}
- **Culprit TCs + files changed**:
${culpritInfo || '  (none)'}`
    : '## Baseline\n❌ **CRITICAL: No baseline file — INTERFERENCE-LIGHT and INTERFERENCE-FULL are both DISABLED.** Cross-TC interference will NOT be detected. Run `.claude/scripts/baseline parse ...` in the worktree before dispatching the workflow.'

  return `You are a GATE verifier. Run ${mode} mode gate checks on the completed TDD cycle.

${featureContext()}

## TDD Cycle Summary
${tcSummary}

## All Changed Files
${allFiles.map(f => `- ${f}`).join('\n')}

${baselineSection}

## Tech Stack
${techStackHint || 'Detect from project conventions and framework'}

## ${mode === 'light' ? 'LIGHT MODE — 4 Critical Checks + INTERFERENCE-FULL' : 'FULL MODE — All 10 Gates (INTERFERENCE-FULL skipped)'}

${mode === 'light' ? `
### L1: Test Suite + INTERFERENCE-FULL (baseline comparison)
- Run the full test suite — all tests must pass (exit code 0)
- All test files from the test spec exist and pass
- No skipped/disabled tests that should run

**INTERFERENCE-FULL: Cross-file Baseline Comparison**

If baseline file exists (${BASELINE_PATH || 'MISSING'}), use the \`.claude/scripts/baseline compare\` harness:
1. Re-run tests to get current state (same command as baseline capture)
2. Run: \`.claude/scripts/baseline compare --baseline ${BASELINE_PATH} --current <current-output> --framework <detected> --culprit "${culpritInfo || 'unknown'}"\`
3. The script cross-references: baseline pass → current fail = interference
4. It auto-excludes: pre-existing failures, same-status skipped tests, feature's own new tests

**Interference impact on L1 result:**
- Tests pass + no interference → L1 PASS ✅
- Tests pass + interference detected → L1 FAIL ❌ (interference is a hard failure)
- Tests fail → L1 FAIL ❌

If no baseline file → skip INTERFERENCE-FULL, only run normal L1 checks. Note: "No baseline file — interference detection skipped."

### L2: Hard Boundaries
- No cross-service database access
- No direct table access to other service schemas
- All inter-service communication via APIs or message broker

### L3: Query Safety
- No raw SQL string concatenation
- Parameterized queries or ORM methods used throughout
- No dynamic table/column names from user input

### L4: External Call Resilience
- All external HTTP calls have timeout configured
- Circuit breaker or retry with backoff on external dependencies
- Graceful degradation when external service is unavailable
` : `
### L1-L4: Critical Checks (from light mode)
Re-verify all 4 light gates still pass after refactoring.

**⚠️ INTERFERENCE-FULL is SKIPPED in full mode.** By this point:
- INTERFERENCE-LIGHT already caught same-file interference per TC
- INTERFERENCE-FULL in GATE light already caught cross-file interference
- REFACTOR full may have renamed/reorganized tests → baseline comparison would produce false positives
- L1 in full mode only verifies: all tests pass (exit code 0), no skipped critical tests

### F5: Security
- All user inputs validated at boundary (type, range, format)
- Auth checks on every protected endpoint/operation
- No sensitive data exposed in API responses or log messages
- No injection vulnerabilities (SQL, XSS, command, path traversal)

### F6: Data Integrity
- Transaction boundaries correct on all write paths
- Cascade operations properly defined (no orphaned records)
- Database constraints enforced at application layer (unique, foreign key, check)
- Idempotency keys on non-idempotent operations (payment, creation)

### F7: Observability
- Log level appropriate for each path (no DEBUG on production hot paths)
- Correlation ID / trace ID propagated through all service calls
- Structured logging format consistent across all changed code
- Metric or log event on critical business operations

### F8: Error Handling
- Error codes canonical — matches project error taxonomy in agent_docs/error-handling.md
- Error messages do not leak internal details (stack traces, SQL, file paths)
- All exception paths caught and mapped to appropriate HTTP/gRPC status codes
- Graceful degradation when external dependencies are unavailable

### F9: Performance
- No blocking I/O on hot/synchronous code paths
- No N+1 queries introduced (check ORM fetch strategy, loop queries)
- Connection/thread pools properly closed (no leaks in new code)
- Appropriate cache or batch strategy for repeated identical queries

### F10: Code Quality
- Naming conventions match existing codebase patterns
- Test readability — test name clearly states business intent (not implementation detail)
- No dead code, commented-out blocks, or debug artifacts in committed files
- No framework-specific anti-patterns (Detected framework: ${techStackHint || 'auto-detect'})
`}

## Required Reading
- **Hard boundaries**: agent_docs/hard-boundaries.md
- **Conventions**: agent_docs/conventions.md
- **Tech design**: agent_docs/tech-design/${service}-service.md

## Return Structured Output
Return a GATE_RESULT with: mode, status (PASS/FAIL), passed, total, failures array, summary.
Include INTERFERENCE-FULL details in the result if applicable (broken test table: test name, file:line, baseline, now, likely culprit, files changed by culprit).`

}

function refactorAgentPrompt(mode, tcResults, gateLightPassed) {
  const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]

  const gateStatus = gateLightPassed
    ? 'GATE light: PASS (4/4) — proceed with full refactoring'
    : 'GATE light: FAIL — refactor only to fix gate failures'

  return `You are a REFACTOR agent. Improve code quality while keeping ALL tests green.

${featureContext()}

## TDD Cycle Summary
${tcResults.map(r => `- ${r.tcId}: ${r.status} — ${r.tcName}`).join('\n')}

## All Changed Files
${allFiles.map(f => `- ${f}`).join('\n')}

## Gate Status
${gateStatus}

## Mode: ${mode}

${mode === 'light' ? `
### Light Mode — Per-TC Cleanup (3 operations only)
1. **Extract Method/Function** — pull out reusable logic into named functions
2. **Rename** — improve variable/function names for clarity
3. **Inline** — inline trivial one-line helpers that obscure rather than clarify

IMPORTANT: Do NOT restructure architecture, change APIs, or modify test logic.
` : `
### Full Mode — 6 Categories + Framework-Specific

1. **Security** — input validation, injection prevention, auth checks, RBAC enforcement, sensitive data handling
2. **Data Integrity** — transaction boundaries, idempotency keys, optimistic locking, cascading operations
3. **Performance** — N+1 query elimination, missing indexes, connection leak prevention, fetch strategy optimization
4. **Resilience** — circuit breaker verification, timeout configuration, retry with backoff, graceful degradation paths
5. **Observability** — correlation ID propagation, structured logging, meaningful error responses, health check endpoints
6. **Code Quality** — lint compliance, format consistency, duplication removal, meaningful naming, dead code elimination
7. **Framework-Specific** — compliance with detected framework conventions and best practices
`}

## Critical Rule
**Keep ALL tests green through every change.** If any refactoring breaks a test:
1. Immediately revert that specific change
2. Log the reverted change
3. Continue with remaining refactoring

## Required Reading
- **IMP spec**: agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/implementation/${frId}-impl.md
- **Tech design**: agent_docs/tech-design/${service}-service.md
- **Hard boundaries**: agent_docs/hard-boundaries.md
- **Conventions**: agent_docs/conventions.md

## Return Structured Output
Return a REFACTOR_RESULT with: mode, categoriesRun, findingsFixed, findingsFlagged, testSuiteStillPassing, summary.

`
}

// ═══════════════════════════════════════════
// GATE RUNNER (DRY — shared by light + full)
// ═══════════════════════════════════════════

const MAX_GATE_RETRIES = 2

async function runGateWithRetry(mode, totalChecks, phaseName, tcResultsFiltered, techStackHint, allFiles) {
  const modeLabel = mode.toUpperCase()
  const phaseDisplay = `GATE ${modeLabel}`

  // ── Initial run ──
  let result = null
  try {
    result = await agent(gateAgentPrompt(mode, tcResultsFiltered, techStackHint), {
      label: `GATE-${mode}`,
      phase: phaseDisplay,
      agentType: GATE,
      schema: GATE_RESULT,
    })
  } catch (e) {
    log(`GATE ${mode} error: ${e.message || e}`)
    result = { mode, status: 'FAIL', passed: 0, total: totalChecks, failures: [`Agent error: ${e.message || e}`], summary: `GATE ${mode} failed to execute` }
  }
  if (!result) {
    result = { mode, status: 'FAIL', passed: 0, total: totalChecks, failures: ['Agent returned null'], summary: `GATE ${mode} agent returned null` }
  }

  log(`${result.status === 'PASS' ? '✅' : '❌'} GATE ${mode}: ${result.status} (${result.passed}/${result.total})`)
  if (result.failures && result.failures.length > 0) {
    result.failures.forEach(f => log(`  ❌ ${f}`))
  }

  // ── Retry loop ──
  let retries = 0
  while (result.status === 'FAIL' && retries < MAX_GATE_RETRIES) {
    retries++
    log(`🔄 GATE ${mode} retry ${retries}/${MAX_GATE_RETRIES}...`)

    // ── Nhóm failures theo file để tránh 2 agent ghi cùng file song song ──
    const fileGroups = groupFailuresByFile(result.failures || [])

    if (Object.keys(fileGroups).length > 0) {
      await parallel(
        Object.entries(fileGroups).map(([file, failures]) => () => {
          const combinedPrompt = `Fix ALL of the following GATE ${mode} failures in the same file:

**File**: ${file}

${failures.map((f, i) => `**Failure ${i + 1}**: ${f}`).join('\n\n')}

**Feature**: ${featureName} (${frId})
**Service**: ${service}

Fix all issues while keeping all tests passing. Make minimal changes.`

          return agent(combinedPrompt, {
            label: `fix-gate-${mode}-${file.split('/').pop() || 'unknown'}`,
            phase: phaseDisplay,
            agentType: GREEN,
          })
        })
      )
    }

    result = await agent(gateAgentPrompt(mode, tcResultsFiltered, techStackHint), {
      label: `GATE-${mode}-retry${retries}`,
      phase: phaseDisplay,
      agentType: GATE,
      schema: GATE_RESULT,
    })

    if (!result) {
      result = { mode, status: 'FAIL', passed: 0, total: totalChecks, failures: ['Agent returned null on retry'], summary: `GATE ${mode} retry returned null` }
    }

    log(`${result.status === 'PASS' ? '✅' : '❌'} GATE ${mode} retry ${retries}: ${result.status} (${result.passed}/${result.total})`)
  }

  return { result, retries }
}

// ═══════════════════════════════════════════
// TDD CYCLE EXECUTION
// ═══════════════════════════════════════════

log(`🏁 Cook automation started: ${featureName}`)
log(`📋 FR-ID: ${frId} | Service: ${service} | Layer: ${layer}`)
log(`🧪 Test Cases: ${testCases.length} (${testCases.map(tc => tc.id).join(', ')})`)
log('🔀 Strategy: Sequential (each TC builds on previous — TDD requires ordered execution)')

// ── Idempotent resume: skip phases already completed in prior run ──
const completedTcIds = new Set(resumeFrom?.completedTcIds || [])
const skipGateLight = resumeFrom?.gateLightPass === true
const skipRefactor = resumeFrom?.refactorDone === true
const skipGateFull = resumeFrom?.gateFullPass === true

const tcResults = []
const warnings = []
let allTestsPass = true

if (completedTcIds.size > 0) {
  log(`⏭️ Resuming: ${completedTcIds.size} TCs already done → ${[...completedTcIds].join(', ')}`)
  for (const tc of testCases) {
    if (completedTcIds.has(tc.id)) {
      tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'DONE', filesChanged: [], testFile: '' })
    }
  }
}
if (skipGateLight) log('⏭️ Skipping GATE light (already PASS)')
if (skipRefactor) log('⏭️ Skipping REFACTOR full (already done)')
if (skipGateFull) log('⏭️ Skipping GATE full (already PASS)')

// ── Phase 1: Per-TC TDD Cycle (LUÔN tuần tự) ──
// Mỗi TC build trên code của TC trước — không thể chạy song song.
// parallelTCs đã bị loại bỏ vì automation không có human verify "TCs thực sự độc lập".
phase('TDD Cycle')

for (const tc of testCases) {
  // Skip TCs already completed in prior run
  if (completedTcIds.has(tc.id)) {
    log(`⏭️ ${tc.id}: ${tc.name} — already DONE (resumed)`)
    continue
  }

  const result = await agent(redAgentPrompt(tc, tcResults), {
    label: `RED ${tc.id}`,
    phase: 'TDD Cycle',
    agentType: RED,
    schema: TC_RESULT,
  })

  if (result) {
    tcResults.push(result)
    const emoji = result.status === 'DONE' ? '✅' : result.status === 'SKIPPED' ? '⏭️' : result.status === 'INTERFERENCE' ? '⚠️' : '❌'
    log(`${emoji} ${result.tcId}: ${result.status} — ${result.tcName}`)
    if (result.filesChanged && result.filesChanged.length > 0) {
      log(`  📄 Files: ${result.filesChanged.join(', ')}`)
    }
    if (result.status === 'INTERFERENCE') {
      allTestsPass = false
      log(`  ⚠️ INTERFERENCE-LIGHT: ${result.errorDetail || 'TC broke another test in the same file'}`)
      warnings.push(`${result.tcId} INTERFERENCE-LIGHT: ${result.errorDetail || 'TC broke another test in the same file'}`)
      log(`  🛑 Stopping TDD cycle — ${testCases.length - testCases.indexOf(tc) - 1} remaining TCs not executed (codebase may be compromised)`)
      break
    }
    if (result.status === 'BLOCKED' || result.status === 'STALE' || result.status === 'ERROR') {
      allTestsPass = false
      warnings.push(`${result.tcId} ${result.status}: ${result.errorDetail || result.skipReason || 'Unknown error'}`)
    }
  } else {
    tcResults.push({
      tcId: tc.id,
      tcName: tc.name,
      status: 'ERROR',
      filesChanged: [],
      errorDetail: 'RED agent returned null — likely skipped by user or crashed',
    })
    allTestsPass = false
    warnings.push(`${tc.id} ERROR: Agent returned null`)
  }
}

// ── TC Summary ──
const doneCount = tcResults.filter(r => r.status === 'DONE').length
const skippedCount = tcResults.filter(r => r.status === 'SKIPPED').length
const interferenceCount = tcResults.filter(r => r.status === 'INTERFERENCE').length
const failedCount = tcResults.filter(r => ['BLOCKED', 'STALE', 'ERROR'].includes(r.status)).length

log(`\n📊 TC Summary: ${doneCount} DONE, ${skippedCount} SKIPPED, ${interferenceCount} INTERFERENCE, ${failedCount} FAILED`)

// ═══════════════════════════════════════════
// TECH STACK DETECTION
// ═══════════════════════════════════════════

// Build tech stack hint from TC files
const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]
let techStackHint = ''
if (allFiles.some(f => f.endsWith('.java'))) techStackHint = 'Java/Spring Boot'
else if (allFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) techStackHint = 'TypeScript/Node.js'
else if (allFiles.some(f => f.endsWith('.py'))) techStackHint = 'Python'
else if (allFiles.some(f => f.endsWith('.go'))) techStackHint = 'Go'
else if (allFiles.some(f => f.endsWith('.rs'))) techStackHint = 'Rust'
log(`🔧 Detected tech stack: ${techStackHint || 'Unknown'}`)

// ═══════════════════════════════════════════
// EARLY EXIT CHECK
// ═══════════════════════════════════════════

if (!allTestsPass && doneCount === 0) {
  log('🛑 All TCs failed — cannot proceed to GATE. Check errors above.')
  return {
    flow,
    featureName,
    frId,
    service,
    status: 'failed',
    tcResults,
    summary: `All ${testCases.length} TCs failed. ${interferenceCount} INTERFERENCE, ${failedCount} BLOCKED/STALE/ERROR. Cannot proceed to GATE.`,
    warnings,
    nextStep: 'Review TC failures. Fix ambiguous specs, interference, or blocked TCs. Retry cook.',
  }
}

if (interferenceCount > 0) {
  log(`⚠️ ${interferenceCount} TC(s) caused INTERFERENCE-LIGHT — pipeline cannot continue`)
  log('  INTERFERENCE means a TC broke another test in the same file. Human must resolve.')
  warnings.push(`${interferenceCount} TC(s) caused same-file interference. Review and fix before re-running.`)
}

if (failedCount > 0) {
  log(`⚠️ ${failedCount} TC(s) failed — proceeding with ${doneCount + skippedCount} successful TCs`)
  log('  BLOCKED/STALE TCs will be excluded from GATE checks')
}

// Stop if INTERFERENCE detected — human must resolve
if (interferenceCount > 0) {
  return {
    flow,
    featureName,
    frId,
    service,
    status: 'failed',
    tcResults,
    summary: `${interferenceCount} TC(s) caused INTERFERENCE-LIGHT (same-file test breakage). Must be resolved by human.`,
    warnings,
    nextStep: 'Review INTERFERENCE TCs. Human decides: revert culprit TC or fix broken test. Re-run cook after resolution.',
  }
}

// ── Phase 2: GATE Light ──
phase('GATE Light')

const lightTcFilter = r => r.status !== 'ERROR' && r.status !== 'INTERFERENCE'

let gateLightResult, gateLightRetries
if (skipGateLight) {
  gateLightResult = { mode: 'light', status: 'PASS', passed: 4, total: 4, failures: [], summary: 'Resumed — already PASS in prior run' }
  gateLightRetries = 0
  log('⏭️ GATE light skipped (already PASS)')
} else {
  log(`🔍 Running GATE light (4 critical checks + INTERFERENCE-FULL baseline comparison)...`)
  log(`  Baseline: ${BASELINE_PATH || 'MISSING — interference detection skipped'}`)

  const gateLight = await runGateWithRetry('light', 4, 'GATE Light', tcResults.filter(lightTcFilter), techStackHint, allFiles)
  gateLightResult = gateLight.result
  gateLightRetries = gateLight.retries
}

if (gateLightResult.status !== 'PASS') {
  warnings.push(`GATE light FAIL after ${gateLightRetries} retries: ${(gateLightResult.failures || []).join('; ')}`)
  log('⚠️ GATE light failed after max retries — cannot proceed to REFACTOR full')
  return {
    flow,
    featureName,
    frId,
    service,
    status: 'failed',
    tcResults,
    gateLight: gateLightResult,
    summary: `GATE light FAIL after ${gateLightRetries} retries. ${gateLightResult.passed}/${gateLightResult.total} gates passed.`,
    warnings,
    nextStep: 'Review GATE light failures manually. Fix issues and re-run cook.',
  }
}

// ── Phase 3: REFACTOR Full ──
phase('REFACTOR Full')

let refactorResult
if (skipRefactor) {
  refactorResult = { mode: 'full', categoriesRun: ['resumed'], findingsFixed: 0, findingsFlagged: 0, testSuiteStillPassing: true, summary: 'Resumed — already done in prior run' }
  log('⏭️ REFACTOR full skipped (already done)')
} else {
  log('🔧 Running REFACTOR full (6 categories + framework-specific)...')

  try {
    refactorResult = await agent(refactorAgentPrompt('full', tcResults.filter(lightTcFilter), true), {
      label: 'REFACTOR-full',
      phase: 'REFACTOR Full',
      agentType: REFACTOR,
      schema: REFACTOR_RESULT,
    })
  } catch (e) {
    log(`REFACTOR error: ${e.message || e}`)
    refactorResult = { mode: 'full', categoriesRun: [], findingsFixed: 0, findingsFlagged: 0, testSuiteStillPassing: false, summary: `Agent error: ${e.message || e}` }
  }

  if (!refactorResult) {
    refactorResult = { mode: 'full', categoriesRun: [], findingsFixed: 0, findingsFlagged: 0, testSuiteStillPassing: false, summary: 'Agent returned null' }
  }
}

log(`🔧 REFACTOR full: ${refactorResult.findingsFixed} fixed, ${refactorResult.findingsFlagged} flagged`)
log(`  Categories: ${(refactorResult.categoriesRun || []).join(', ') || 'none reported'}`)
log(`  Test suite: ${refactorResult.testSuiteStillPassing ? '✅ Still passing' : '⚠️ May have failures'}`)

if (!refactorResult.testSuiteStillPassing) {
  warnings.push('REFACTOR full may have caused test failures — verify test suite manually')
}

if (refactorResult.findingsFlagged > 0) {
  warnings.push(`${refactorResult.findingsFlagged} findings were flagged but not fixed during refactoring`)
}

// ── Phase 4: GATE Full ──
phase('GATE Full')

let gateFullResult, gateFullRetries
if (skipGateFull) {
  gateFullResult = { mode: 'full', status: 'PASS', passed: 10, total: 10, failures: [], summary: 'Resumed — already PASS in prior run' }
  gateFullRetries = 0
  log('⏭️ GATE full skipped (already PASS)')
} else {
  log('🔍 Running GATE full (10 gates)...')

  const gateFull = await runGateWithRetry('full', 10, 'GATE Full', tcResults.filter(lightTcFilter), techStackHint, allFiles)
  gateFullResult = gateFull.result
  gateFullRetries = gateFull.retries
}

if (gateFullResult.status !== 'PASS') {
  warnings.push(`GATE full FAIL after ${gateFullRetries} retries: ${(gateFullResult.failures || []).join('; ')}`)
}

// ═══════════════════════════════════════════
// REPORT SYNTHESIS
// ═══════════════════════════════════════════

phase('Report')

const overallStatus = gateFullResult.status === 'PASS'
  ? 'completed'
  : (gateLightResult.status === 'PASS' ? 'partial' : 'failed')

const report = {
  flow,
  featureName,
  frId,
  service,
  status: overallStatus,
  tcResults,
  gateLight: gateLightResult,
  refactorFull: refactorResult,
  gateFull: gateFullResult,
  summary: buildSummary(),
  warnings,
  nextStep: buildNextStep(overallStatus),
}

log(`\n${'='.repeat(60)}`)
log(`🏁 Cook Pipeline: ${overallStatus.toUpperCase()}`)
log(`${'='.repeat(60)}`)
log(`📋 ${featureName} (${frId})`)
log(`🧪 TCs: ${doneCount} DONE, ${skippedCount} SKIPPED, ${interferenceCount} INTERFERENCE, ${failedCount} FAILED`)
log(`🚦 GATE light: ${gateLightResult.status} (${gateLightResult.passed}/${gateLightResult.total})${BASELINE_PATH ? ' + INTERFERENCE-FULL' : ''}`)
log(`🔧 REFACTOR: ${refactorResult.findingsFixed} fixed, ${refactorResult.findingsFlagged} flagged`)
log(`🚦 GATE full: ${gateFullResult.status} (${gateFullResult.passed}/${gateFullResult.total})`)
log(`📦 ${allFiles.length} files changed`)
if (warnings.length > 0) {
  log(`\n⚠️ Warnings:`)
  warnings.forEach(w => log(`  - ${w}`))
}
log(`\n🔗 Next: ${report.nextStep}`)

return report

// ═══════════════════════════════════════════
// REPORT HELPERS
// ═══════════════════════════════════════════

function buildSummary() {
  const parts = []
  parts.push(`${featureName} (${frId}) — ${doneCount}/${testCases.length} TCs DONE`)
  if (skippedCount > 0) parts.push(`${skippedCount} SKIPPED (accidental green)`)
  if (interferenceCount > 0) parts.push(`${interferenceCount} INTERFERENCE (same-file breakage)`)
  if (failedCount > 0) parts.push(`${failedCount} FAILED`)
  parts.push(`GATE light: ${gateLightResult.status === 'PASS' ? 'ALL PASS' : `${gateLightResult.passed}/${gateLightResult.total}`}`)
  parts.push(`GATE full: ${gateFullResult.status === 'PASS' ? 'ALL PASS' : `${gateFullResult.passed}/${gateFullResult.total}`}`)
  return parts.join(' | ')
}

function buildNextStep(status) {
  if (status === 'completed') {
    return 'All gates PASS. Orchestrator: run code review, git push, sprint update.'
  }
  if (interferenceCount > 0) {
    return `INTERFERENCE-LIGHT detected on ${interferenceCount} TC(s). Human must resolve (revert culprit or fix broken test), then re-run cook.`
  }
  if (status === 'partial') {
    return `GATE full FAIL with ${gateFullResult.passed}/${gateFullResult.total} passed. Review failures manually or re-run cook after fixes.`
  }
  return 'Pipeline failed. Review TC errors and GATE failures. Consider sdlc-orchestrator for human-in-the-loop debugging.'
}

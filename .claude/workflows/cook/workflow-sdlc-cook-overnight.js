export const meta = {
  name: 'workflow-sdlc-cook-overnight',
  description: 'Overnight phased-batch TDD cook — RED batch (write all tests, verify RED, detect accidental-green) → GREEN chunked (implement + INTERFERENCE-LIGHT) → GATE light → REFACTOR full → GATE full. Tách khỏi workflow-sdlc-cook.js (per-TC) — overnight trade speed for granularity.',
  phases: [
    { title: 'RED Batch', detail: 'Write all test code, verify RED in one run, detect accidental-green (light)' },
    { title: 'GREEN Chunks', detail: 'Implement minimal code per chunk + INTERFERENCE-LIGHT (same-file)' },
    { title: 'GATE Light', detail: '4 critical checks + INTERFERENCE-FULL (baseline comparison)' },
    { title: 'REFACTOR Full', detail: '6 categories: security, data, perf, resilience, observability, quality' },
    { title: 'GATE Full', detail: 'All 10 gates: L1-L4 + F5-F10' },
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
  specRoot = '',
  agents = {},
  // ── Phased-batch tuning ──
  redBatchSize = 0,    // 0 = một RED agent viết TẤT CẢ test; >0 = chunk theo size
  greenChunkSize = 4,  // số TC mỗi GREEN chunk (3-5 khuyến nghị)
  // ── Idempotent resume ──
  resumeFrom = null,  // { completedTcIds: ['1','2'], completedTcFiles: {'1': ['a.java','b.java']}, gateLightPass: true, refactorDone: true, gateFullPass: false }
} = _args

// Caller chịu trách nhiệm chọn đúng agent type — workflow không suy diễn từ layer.
// Overnight dùng agent BATCH (khác sdlc-cook dùng per-TC mini-orchestrator).
const RED_BATCH = agents.redBatch || (layer === 'frontend' ? 'sdlc-tdd-fe-red-overnight' : 'sdlc-tdd-be-red-overnight')
const GREEN_CHUNK = agents.greenChunk || (layer === 'frontend' ? 'sdlc-tdd-fe-green-overnight' : 'sdlc-tdd-be-green-overnight')
const REFACTOR = agents.refactor || (layer === 'frontend' ? 'sdlc-tdd-fe-refactor-overnight' : 'sdlc-tdd-be-refactor-overnight')
const GATE = agents.gate || (layer === 'frontend' ? 'sdlc-tdd-fe-gate-overnight' : 'sdlc-tdd-be-gate-overnight')

// ── Baseline info (pre-captured by orchestrator) ──
const BASELINE_PATH = baseline?.path || null
const BASELINE_TC_INDEX = baseline?.tcIndex || {}
const BASELINE_PRE_EXISTING = baseline?.preExistingFailures || []
const BASELINE_BY_FILE = baseline?.byFile || {}

// ── Working directories — controller KHÔNG cd; agents cd trong shell của chúng ──
const CODE_DIR = repoPath || '.'
const SPECS_ROOT = specRoot || '.'

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

// RED batch + GREEN chunk đều trả về list per-TC results; GREEN thêm interference list.
const BATCH_RESULT = {
  type: 'object',
  properties: {
    tcResults: { type: 'array', items: TC_RESULT },
    interference: { type: 'array', items: { type: 'string' } },
  },
  required: ['tcResults'],
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

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function featureContext() {
  return `## Cook Context
- **Feature**: ${featureName}
- **FR-ID**: ${frId}
- **Service**: ${service}
- **Layer**: ${layer}
- **Agents**: RED_BATCH=${RED_BATCH} | GREEN_CHUNK=${GREEN_CHUNK} | REFACTOR=${REFACTOR} | GATE=${GATE}

## Working Directory (quyết định nơi chạy lệnh — đọc kỹ)
- **Code directory**: \`${CODE_DIR}\` — mọi lệnh test/build PHẢI chạy với CWD = đây:
  \`cd ${CODE_DIR} && <cmd>\` hoặc \`git -C ${CODE_DIR}\`.
- **Specs directory**: \`${SPECS_ROOT}/agent_docs\` — đọc mọi spec từ đây (TST, IMP,
  tech-design, hard-boundaries, conventions).`
}

function tcListMarkdown(tcs) {
  return tcs.map(tc => `- ${tc.id}: ${tc.name} (layer: ${tc.layer || 'unit'}, risk: ${tc.risk || 'MEDIUM'})`).join('\n')
}

function prevResultsMarkdown(prevResults) {
  if (!prevResults || prevResults.length === 0) return '(none — first batch)'
  return prevResults.map(r => `- ${r.tcId}: ${r.status} — ${r.tcName} (files: ${(r.filesChanged || []).join(', ') || 'none'})`).join('\n')
}

// ── Nhóm GATE failures theo file để tránh 2 agent ghi cùng file song song ──
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

function redBatchAgentPrompt(tcs, prevResults) {
  const baselineTcList = Object.entries(BASELINE_TC_INDEX)
    .map(([id, info]) => `  - TC-${id}: ${info}`)
    .join('\n')
  const preExistingList = BASELINE_PRE_EXISTING.length > 0
    ? BASELINE_PRE_EXISTING.map(f => `  - ${f}`).join('\n')
    : '  (none)'
  const tcFiles = Object.keys(BASELINE_BY_FILE)

  return `You are the RED-batch phase. Write test code for a BATCH of test cases (not implementation), verify they all FAIL (RED) in one run, and detect accidental-green.

${featureContext()}

## Your Batch (${tcs.length} test cases)
${tcListMarkdown(tcs)}

## Prior Batch Results (already-processed TCs — do NOT re-write these)
${prevResultsMarkdown(prevResults)}

## Baseline Snapshot (pre-TDD)
- **Baseline file**: ${BASELINE_PATH || '(no baseline — interference detection unavailable)'}
- **Pre-existing failures** (NOT caused by this feature):
${preExistingList}

## Baseline TC Index (all tests before TDD)
${baselineTcList || '  (no baseline data)'}

## Baseline by File (for INTERFERENCE-LIGHT later)
${tcFiles.map(f => `  - ${f}: TCs [${(BASELINE_BY_FILE[f] || []).join(', ')}]`).join('\n') || '  (no file groupings)'}

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **TST spec**: ${SPECS_ROOT}/agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/test-specs/${frId}-test.md
- **IMP spec**: ${SPECS_ROOT}/agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/implementation/${frId}-impl.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md

## Your Task (Batch RED)

1. **Write test code** for ALL ${tcs.length} test cases in your batch.
   - Write ONLY test code — no implementation.
   - Follow project conventions for test structure.
   - If a test spec is ambiguous for a given TC → mark that TC STALE (do not write it).

2. **Verify RED in ONE run** — run the full test suite (or the new test files) ONCE:
   - **Gradle:** \`./gradlew :{service}:test\`
   - **Maven:** \`./mvnw test\` (or \`./mvnw -pl :{service} test\`)
   - **Node.js:** \`npx vitest run\` (or jest equivalent)
   - **Python:** \`pytest\`
   - **Go:** \`go test ./...\`
   - **Rust:** \`cargo test\`
   Every test you wrote MUST fail (exit code != 0). A test that FAILS = DONE (RED confirmed).
   - **Multi-batch note** (redBatchSize > 1): tests written by PRIOR RED batches are still RED (not yet
     implemented) — their failures are expected and do NOT count toward your batch. Only your batch's
     tests determine RED confirmation for this batch.

3. **Detect accidental-green (LIGHT — no sabotage).** For any new test that PASSES unexpectedly:
   - Sanity-check: is the test trivially true (e.g. \`assertTrue(true)\`)? If yes → rewrite once, re-run, re-check.
   - If genuinely passing against existing code → mark SKIPPED with skipReason "accidental green — test already passes; needs human review (no sabotage in batch mode)".
   - Do NOT sabotage. Do NOT spawn GREEN. Batch RED trades the sabotage×3 confirmation for speed; the accidental-green TC is flagged for human review in the morning.

## Return Structured Output
Return a BATCH_RESULT with:
- tcResults: one entry per TC in your batch:
  - status: DONE (red-confirmed) | SKIPPED (accidental green) | STALE (ambiguous spec) | BLOCKED | ERROR
  - tcId, tcName, testFile, filesChanged (list of test files created)
  - skipReason (if SKIPPED), errorDetail (if STALE/BLOCKED/ERROR)
- interference: empty array (RED writes no implementation, so no interference yet)
`
}

function greenChunkAgentPrompt(tcs, redResults) {
  const allResults = redResults.map(r => `- ${r.tcId}: ${r.status} — ${r.tcName}`).join('\n')
  const preExistingList = BASELINE_PRE_EXISTING.length > 0
    ? BASELINE_PRE_EXISTING.map(f => `  - ${f}`).join('\n')
    : '  (none)'
  const tcFiles = Object.keys(BASELINE_BY_FILE)

  return `You are the GREEN-chunk phase. Implement minimal code to pass a CHUNK of test cases (already RED-verified), then check for INTERFERENCE-LIGHT.

${featureContext()}

## Your Chunk (${tcs.length} test cases — implement ALL of them)
${tcListMarkdown(tcs)}

## All RED Results (for context)
${allResults}

## Baseline Snapshot (for INTERFERENCE-LIGHT)
- **Pre-existing failures** (NOT interference — exclude): ${preExistingList}
- **Baseline by File**: ${tcFiles.map(f => `  - ${f}: TCs [${(BASELINE_BY_FILE[f] || []).join(', ')}]`).join('\n') || '  (no file groupings)'}

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **IMP spec**: ${SPECS_ROOT}/agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/implementation/${frId}-impl.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md

## Your Task (Chunk GREEN)

1. **Implement minimal code** for all ${tcs.length} TCs in this chunk.
   - Write ONLY implementation — never modify tests.
   - Follow the IMP spec + existing code patterns.
   - Implement bottom-up, test incrementally (max 5 iterations per failing TC).

2. **Verify the chunk passes** — run the tests for your chunk. All ${tcs.length} TCs must pass.

3. **INTERFERENCE-LIGHT** — after the chunk passes, run ALL tests in every file touched by this chunk:
   - Identify the test file(s) your TCs belong to (use baseline byFile map + your own filesChanged).
   - Run those files: \`./gradlew :{service}:test --tests "{TestClass}"\` / \`./mvnw test -Dtest="{TestClass}"\` / \`npx vitest run <file>\`.
   - If any test OTHER than (a) a TC in this chunk, (b) a pre-existing failure, (c) an accidental-green SKIPPED TC now FAILS → that is INTERFERENCE. Record which test broke + what file/line + likely culprit.
   - Pre-existing failures are NOT interference — they were already broken before this cook.

## Return Structured Output
Return a BATCH_RESULT with:
- tcResults: one entry per TC in your chunk — status DONE (implemented + passing) | ERROR (stuck after iterations), plus tcId, tcName, filesChanged (implementation files).
- interference: array of strings — one per broken test: "should_validate_email in UserServiceTest.java:45 — broken by chunk [files]". Empty array if no interference.
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
    : `## Baseline\n❌ **CRITICAL: No baseline file — INTERFERENCE-FULL is DISABLED.** Cross-file interference will NOT be detected. Run \`${SPECS_ROOT}/.claude/scripts/baseline parse ...\` before dispatching the workflow.`

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
2. Run (từ ${SPECS_ROOT}, nơi có \`.claude/scripts/\`): \`cd ${SPECS_ROOT} && .claude/scripts/baseline compare --baseline ${BASELINE_PATH} --current <current-output> --framework <detected> --culprit "${culpritInfo || 'unknown'}"\`
3. The script cross-references: baseline pass → current fail = interference
4. It auto-excludes: pre-existing failures, same-status skipped tests, feature's own new tests

**Interference impact on L1 result:**
- Tests pass + no interference → L1 PASS ✅
- Tests pass + interference detected → L1 FAIL ❌
- Tests fail → L1 FAIL ❌

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

**⚠️ INTERFERENCE-FULL is SKIPPED in full mode.** L1 in full mode only verifies all tests pass (exit code 0).

### F5: Security
- All user inputs validated at boundary (type, range, format)
- Auth checks on every protected endpoint/operation
- No sensitive data exposed in API responses or log messages
- No injection vulnerabilities (SQL, XSS, command, path traversal)

### F6: Data Integrity
- Transaction boundaries correct on all write paths
- Cascade operations properly defined (no orphaned records)
- Database constraints enforced at application layer
- Idempotency keys on non-idempotent operations

### F7: Observability
- Log level appropriate for each path
- Correlation ID / trace ID propagated through all service calls
- Structured logging format consistent
- Metric or log event on critical business operations

### F8: Error Handling
- Error codes canonical — matches ${SPECS_ROOT}/agent_docs/error-handling.md
- Error messages do not leak internal details
- All exception paths caught and mapped to appropriate status codes
- Graceful degradation when external dependencies unavailable

### F9: Performance
- No blocking I/O on hot/synchronous code paths
- No N+1 queries introduced
- Connection/thread pools properly closed
- Appropriate cache or batch strategy for repeated queries

### F10: Code Quality
- Naming conventions match existing codebase patterns
- Test readability — test name clearly states business intent
- No dead code, commented-out blocks, or debug artifacts
- No framework-specific anti-patterns (Detected framework: ${techStackHint || 'auto-detect'})
`}

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md

## Return Structured Output
Return a GATE_RESULT with: mode, status (PASS/FAIL), passed, total, failures array, summary.`
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
1. **Security** — input validation, injection prevention, auth checks, RBAC enforcement
2. **Data Integrity** — transaction boundaries, idempotency keys, optimistic locking
3. **Performance** — N+1 query elimination, missing indexes, connection leak prevention
4. **Resilience** — circuit breaker verification, timeout configuration, retry with backoff
5. **Observability** — correlation ID propagation, structured logging, health check endpoints
6. **Code Quality** — lint compliance, format consistency, duplication removal, dead code elimination
7. **Framework-Specific** — compliance with detected framework conventions
`}

## Critical Rule
**Keep ALL tests green through every change.** If any refactoring breaks a test:
1. Immediately revert that specific change
2. Log the reverted change
3. Continue with remaining refactoring

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **IMP spec**: ${SPECS_ROOT}/agent_docs/${layer === 'frontend' ? 'frontend' : 'backend'}/${service}/implementation/${frId}-impl.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md

## Return Structured Output
Return a REFACTOR_RESULT with: mode, categoriesRun, findingsFixed, findingsFlagged, testSuiteStillPassing, summary.`
}

// ═══════════════════════════════════════════
// GATE RUNNER (DRY — shared by light + full)
// ═══════════════════════════════════════════

const MAX_GATE_RETRIES = 2

async function runGateWithRetry(mode, totalChecks, phaseName, tcResultsFiltered, techStackHint) {
  const modeLabel = mode.toUpperCase()
  const phaseDisplay = `GATE ${modeLabel}`

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

  let retries = 0
  while (result.status === 'FAIL' && retries < MAX_GATE_RETRIES) {
    retries++
    log(`🔄 GATE ${mode} retry ${retries}/${MAX_GATE_RETRIES}...`)

    const fileGroups = groupFailuresByFile(result.failures || [])
    if (Object.keys(fileGroups).length > 0) {
      await parallel(
        Object.entries(fileGroups).map(([file, failures]) => () => {
          const combinedPrompt = `Fix ALL of the following GATE ${mode} failures in the same file:

**File**: ${file}

${failures.map((f, i) => `**Failure ${i + 1}**: ${f}`).join('\n\n')}

**Feature**: ${featureName} (${frId})
**Service**: ${service}

This is a TARGETED FIX — fix ONLY the failures listed above. Do NOT run the full 6-category refactor sweep. Fix all issues while keeping all tests passing. Make minimal changes.`

          return agent(combinedPrompt, {
            label: `fix-gate-${mode}-${file.split('/').pop() || 'unknown'}`,
            phase: phaseDisplay,
            agentType: REFACTOR,
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
// PHASED-BATCH TDD EXECUTION
// ═══════════════════════════════════════════

log(`🏁 Overnight cook started (phased-batch): ${featureName}`)
log(`📋 FR-ID: ${frId} | Service: ${service} | Layer: ${layer}`)
log(`🧪 Test Cases: ${testCases.length} (${testCases.map(tc => tc.id).join(', ')})`)
log(`🔀 Strategy: PHASED-BATCH — RED batch (redBatchSize=${redBatchSize || 'all'}) → GREEN chunks (size=${greenChunkSize}) → REFACTOR/GATE once`)

// ── Idempotent resume: skip phases already completed in prior run ──
const completedTcIds = new Set(resumeFrom?.completedTcIds || [])
const completedTcFiles = resumeFrom?.completedTcFiles || {}  // { tcId: [files] } — từ COOK_REPORT trước (preserves filesChanged trên resume)
const skipGateLight = resumeFrom?.gateLightPass === true
const skipRefactor = resumeFrom?.refactorDone === true
const skipGateFull = resumeFrom?.gateFullPass === true

const tcResults = []
const warnings = []
let allTestsPass = true
let interferenceCount = 0

if (completedTcIds.size > 0) {
  log(`⏭️ Resuming: ${completedTcIds.size} TCs already done → ${[...completedTcIds].join(', ')}`)
  for (const tc of testCases) {
    if (completedTcIds.has(tc.id)) {
      const files = completedTcFiles[tc.id] || []
      // testFile không thể recover chính xác từ filesChanged (filesChanged gộp test+impl) → để rỗng (trung thực hơn là đoán).
      tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'DONE', filesChanged: files, testFile: '' })
    }
  }
}
if (skipGateLight) log('⏭️ Skipping GATE light (already PASS)')
if (skipRefactor) log('⏭️ Skipping REFACTOR full (already done)')
if (skipGateFull) log('⏭️ Skipping GATE full (already PASS)')

if (testCases.length === 0) {
  log('🛑 No test cases provided — cannot cook an empty feature.')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults: [], gateLight: null, refactorFull: null, gateFull: null,
    summary: 'No test cases extracted from TST spec. Nothing to cook.',
    warnings: ['No test cases provided — check TST spec for this feature.'],
    nextStep: 'Review TST spec — may be empty or malformed. Fix spec then re-run cook.',
  }
}

// ── Phase 1: RED Batch (viết hết test, verify RED 1 lần, detect accidental-green) ──
phase('RED Batch')

const pendingTcs = testCases.filter(tc => !completedTcIds.has(tc.id))
const redBatches = redBatchSize > 0 ? chunk(pendingTcs, redBatchSize) : (pendingTcs.length > 0 ? [pendingTcs] : [])

for (const batch of redBatches) {
  const result = await agent(redBatchAgentPrompt(batch, tcResults), {
    label: `RED-batch ${batch.length}TCs`,
    phase: 'RED Batch',
    agentType: RED_BATCH,
    schema: BATCH_RESULT,
  })

  if (result && result.tcResults) {
    for (const r of result.tcResults) {
      tcResults.push(r)
      const emoji = r.status === 'DONE' ? '🔴' : r.status === 'SKIPPED' ? '⏭️' : '❌'
      log(`${emoji} ${r.tcId}: ${r.status} — ${r.tcName}`)
      if (r.status === 'SKIPPED') {
        warnings.push(`${r.tcId} accidental-green (no sabotage in batch): ${r.skipReason || 'test already passes'}`)
      }
      if (['BLOCKED', 'STALE', 'ERROR'].includes(r.status)) {
        allTestsPass = false
        warnings.push(`${r.tcId} ${r.status}: ${r.errorDetail || r.skipReason || 'Unknown error'}`)
      }
    }
  } else {
    for (const tc of batch) {
      tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'ERROR', filesChanged: [], errorDetail: 'RED batch agent returned null — likely skipped or crashed' })
      allTestsPass = false
      warnings.push(`${tc.id} ERROR: RED batch agent returned null`)
    }
  }
}

const redDoneCount = tcResults.filter(r => r.status === 'DONE').length
const redSkippedCount = tcResults.filter(r => r.status === 'SKIPPED').length
log(`\n📊 RED batch summary: ${redDoneCount} RED-confirmed, ${redSkippedCount} accidental-green, ${tcResults.filter(r => ['BLOCKED','STALE','ERROR'].includes(r.status)).length} failed`)

// ── Phase 2: GREEN Chunks (implement RED-confirmed TCs theo chunk + INTERFERENCE-LIGHT) ──
phase('GREEN Chunks')

const toImplement = tcResults.filter(r => r.status === 'DONE' && !completedTcIds.has(r.tcId))
const greenChunks = chunk(toImplement, Math.max(1, greenChunkSize))

for (const [ci, gchunk] of greenChunks.entries()) {
  const result = await agent(greenChunkAgentPrompt(gchunk, tcResults), {
    label: `GREEN-chunk ${gchunk.map(tc => tc.id).join(',')}`,
    phase: 'GREEN Chunks',
    agentType: GREEN_CHUNK,
    schema: BATCH_RESULT,
  })

  if (result) {
    // Merge per-TC statuses back into master list
    const byId = new Map((result.tcResults || []).map(r => [r.tcId, r]))
    for (const r of tcResults) {
      if (byId.has(r.tcId)) {
        const g = byId.get(r.tcId)
        r.status = g.status === 'DONE' ? 'DONE' : (g.status || 'ERROR')
        r.filesChanged = [...new Set([...(r.filesChanged || []), ...(g.filesChanged || [])])]
        if (g.errorDetail) r.errorDetail = g.errorDetail
        if (g.status === 'ERROR') {
          allTestsPass = false
          warnings.push(`${r.tcId} GREEN ${g.status || 'ERROR'}: ${g.errorDetail || 'stuck'}`)
        }
      }
    }

    // Interference from this chunk
    if (result.interference && result.interference.length > 0) {
      interferenceCount += result.interference.length
      // Do NOT clobber per-TC status to INTERFERENCE — TCs that passed stay DONE.
      // Interference is a chunk-level signal: the chunk's own TCs DID pass, but they broke
      // OTHER tests. Detail lives in warnings[], and the feature-level status is set to
      // 'failed' by the interferenceCount > 0 guard below.
      result.interference.forEach(i => {
        log(`  ⚠️ INTERFERENCE-LIGHT: ${i}`)
        warnings.push(`INTERFERENCE-LIGHT (chunk ${gchunk.map(tc => tc.id).join(',')}): ${i}`)
      })
      log(`  🛑 Stopping GREEN — ${gchunk.map(tc => tc.id).join(',')} caused same-file interference`)
      // Mark TCs in later chunks as not-implemented (they were RED'd but GREEN never ran)
      for (let rj = ci + 1; rj < greenChunks.length; rj++) {
        for (const tc of greenChunks[rj]) {
          const r = tcResults.find(x => x.tcId === tc.id)
          if (r && r.status === 'DONE') {
            r.status = 'ERROR'
            r.errorDetail = 'GREEN not run — stopped after INTERFERENCE in prior chunk'
          }
        }
      }
      break
    }
  } else {
    for (const tc of gchunk) {
      const r = tcResults.find(x => x.tcId === tc.id)
      if (r) { r.status = 'ERROR'; r.errorDetail = 'GREEN chunk agent returned null' }
      allTestsPass = false
      warnings.push(`${tc.id} ERROR: GREEN chunk agent returned null`)
    }
  }
}

// ── TC Summary ──
const doneCount = tcResults.filter(r => r.status === 'DONE').length
const skippedCount = tcResults.filter(r => r.status === 'SKIPPED').length
const failedCount = tcResults.filter(r => ['BLOCKED', 'STALE', 'ERROR'].includes(r.status)).length

log(`\n📊 TC Summary: ${doneCount} DONE, ${skippedCount} SKIPPED (accidental-green), ${interferenceCount} INTERFERENCE, ${failedCount} FAILED`)

// ── Tech stack detection ──
const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]
let techStackHint = ''
if (allFiles.some(f => f.endsWith('.java'))) techStackHint = 'Java/Spring Boot'
else if (allFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) techStackHint = 'TypeScript/Node.js'
else if (allFiles.some(f => f.endsWith('.py'))) techStackHint = 'Python'
else if (allFiles.some(f => f.endsWith('.go'))) techStackHint = 'Go'
else if (allFiles.some(f => f.endsWith('.rs'))) techStackHint = 'Rust'
log(`🔧 Detected tech stack: ${techStackHint || 'Unknown'}`)

// ── Early exit checks ──
if (!allTestsPass && doneCount === 0) {
  log('🛑 All TCs failed — cannot proceed to GATE.')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: null, refactorFull: null, gateFull: null,
    summary: `All ${testCases.length} TCs failed. ${interferenceCount} INTERFERENCE, ${failedCount} BLOCKED/STALE/ERROR. Cannot proceed to GATE.`,
    warnings,
    nextStep: 'Review TC failures. Fix ambiguous specs, interference, or blocked TCs. Retry cook.',
  }
}

if (doneCount === 0 && skippedCount > 0 && failedCount === 0) {
  log('⚠️ All TCs accidental-green (SKIPPED) — no implementation produced. Feature cannot be "completed".')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: null, refactorFull: null, gateFull: null,
    summary: `All ${testCases.length} TCs accidental-green — tests already pass without implementation. Needs spec review (tests may be wrong or feature already implemented).`,
    warnings,
    nextStep: 'Review TST spec for this feature. Accidental-green across all TCs suggests wrong/misplaced tests or pre-existing implementation. Fix spec then re-run cook.',
  }
}

if (interferenceCount > 0) {
  log(`⚠️ ${interferenceCount} INTERFERENCE-LIGHT — pipeline cannot continue`)
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: null, refactorFull: null, gateFull: null,
    summary: `${interferenceCount} same-file interference detected during GREEN chunks. Must be resolved by human.`,
    warnings,
    nextStep: 'Review INTERFERENCE TCs. Human decides: revert culprit or fix broken test. Re-run cook after resolution.',
  }
}

if (failedCount > 0) {
  log(`⚠️ ${failedCount} TC(s) failed — proceeding with ${doneCount + skippedCount} successful TCs`)
}

// ── Phase 3: GATE Light ──
phase('GATE Light')

const lightTcFilter = r => ['DONE', 'SKIPPED'].includes(r.status)

let gateLightResult, gateLightRetries
if (skipGateLight) {
  gateLightResult = { mode: 'light', status: 'PASS', passed: 4, total: 4, failures: [], summary: 'Resumed — already PASS in prior run' }
  gateLightRetries = 0
  log('⏭️ GATE light skipped (already PASS)')
} else {
  log(`🔍 Running GATE light (4 critical checks + INTERFERENCE-FULL baseline comparison)...`)
  log(`  Baseline: ${BASELINE_PATH || 'MISSING — interference detection skipped'}`)
  const gateLight = await runGateWithRetry('light', 4, 'GATE Light', tcResults.filter(lightTcFilter), techStackHint)
  gateLightResult = gateLight.result
  gateLightRetries = gateLight.retries
}

if (gateLightResult.status !== 'PASS') {
  warnings.push(`GATE light FAIL after ${gateLightRetries} retries: ${(gateLightResult.failures || []).join('; ')}`)
  log('⚠️ GATE light failed after max retries — cannot proceed to REFACTOR full')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: gateLightResult, refactorFull: null, gateFull: null,
    summary: `GATE light FAIL after ${gateLightRetries} retries. ${gateLightResult.passed}/${gateLightResult.total} gates passed.`,
    warnings,
    nextStep: 'Review GATE light failures manually. Fix issues and re-run cook.',
  }
}

// ── Phase 4: REFACTOR Full ──
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

// ── Phase 5: GATE Full ──
phase('GATE Full')

let gateFullResult, gateFullRetries
if (skipGateFull) {
  gateFullResult = { mode: 'full', status: 'PASS', passed: 10, total: 10, failures: [], summary: 'Resumed — already PASS in prior run' }
  gateFullRetries = 0
  log('⏭️ GATE full skipped (already PASS)')
} else {
  log('🔍 Running GATE full (10 gates)...')
  const gateFull = await runGateWithRetry('full', 10, 'GATE Full', tcResults.filter(lightTcFilter), techStackHint)
  gateFullResult = gateFull.result
  gateFullRetries = gateFull.retries
}

if (gateFullResult.status !== 'PASS') {
  warnings.push(`GATE full FAIL after ${gateFullRetries} retries: ${(gateFullResult.failures || []).join('; ')}`)
}

// ── Phase 6: Report ──
phase('Report')

const overallStatus = (gateFullResult.status === 'PASS' && failedCount === 0 && interferenceCount === 0)
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
log(`🏁 Overnight Cook Pipeline: ${overallStatus.toUpperCase()}`)
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
    return `INTERFERENCE-LIGHT detected on ${interferenceCount} test(s). Human must resolve (revert culprit or fix broken test), then re-run cook.`
  }
  if (status === 'partial') {
    const reasons = []
    if (failedCount > 0) reasons.push(`${failedCount} TC(s) BLOCKED/STALE/ERROR`)
    if (gateFullResult.status !== 'PASS') reasons.push(`GATE full FAIL with ${gateFullResult.passed}/${gateFullResult.total} passed`)
    return `${reasons.join('; ')}. Review failures manually or re-run cook after fixes.`
  }
  return 'Pipeline failed. Review TC errors and GATE failures. Consider sdlc-orchestrator for human-in-the-loop debugging.'
}

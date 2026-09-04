export const meta = {
  name: 'workflow-sdlc-cook-overnight',
  description: 'Overnight per-chunk TDD cook — per chunk: RED (write tests, verify RED, detect accidental-green) → GREEN (implement + INTERFERENCE-LIGHT) → GATE light (L2-L4 structural) → REFACTOR light; then REFACTOR full → GATE full (delta-gate). Tách khỏi workflow-sdlc-cook.js (per-TC) — overnight trade speed for granularity.',
  phases: [
    { title: 'TDD Chunks', detail: 'Per chunk: RED → GREEN (+INTERFERENCE-LIGHT) → GATE light (L2-L4 structural) → REFACTOR light' },
    { title: 'REFACTOR Full', detail: '6 categories: security, data, perf, resilience, observability, quality' },
    { title: 'GATE Full', detail: 'All 10 gates: L1 delta-gate (INTERFERENCE-FULL) + L2-L4 + F5-F10' },
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
  chunkSize = 4,  // số TC mỗi RED chunk VÀ GREEN chunk (3-5 khuyến nghị) — RED chunk như GREEN
  // ── Idempotent resume ──
  resumeFrom = null,  // { completedTcIds: ['1','2'], completedTcFiles: {'1': ['a.java','b.java']}, refactorDone: true, gateFullPass: false }
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

// Delta-gate bucket item — verbatim element from `baseline compare --json`.
const DELTA_BUCKET_ITEM = {
  type: 'object',
  properties: {
    test: { type: 'string' },
    file: { type: 'string' },
    baseline_status: { type: 'string' },
    current_status: { type: 'string' },
    error: { type: 'string' },
  },
  required: ['test'],
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
    // Delta-gate 3 buckets (from `baseline compare --json`), forwarded verbatim.
    // Only populated in modes that run the INTERFERENCE-FULL delta compare (L1).
    interference: { type: 'array', items: DELTA_BUCKET_ITEM },
    preExistingStillFailing: { type: 'array', items: DELTA_BUCKET_ITEM },
    notInBaselineNowFailing: { type: 'array', items: DELTA_BUCKET_ITEM },
    // Flaky guard: tests that failed on the full-suite run but passed on a targeted
    // re-run (retry-before-fail) — transient, NOT a regression. Tolerated by L1.
    flaky: { type: 'array', items: DELTA_BUCKET_ITEM },
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
    preExistingFailures: { type: 'array', items: { type: 'string' } },
    // Delta-gate buckets forwarded from GATE full (INTERFERENCE-FULL delta-gate).
    interference: { type: 'array', items: DELTA_BUCKET_ITEM },
    preExistingStillFailing: { type: 'array', items: DELTA_BUCKET_ITEM },
    notInBaselineNowFailing: { type: 'array', items: DELTA_BUCKET_ITEM },
    flaky: { type: 'array', items: DELTA_BUCKET_ITEM },
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

  return `You are the RED-chunk phase. Write test code for a CHUNK of test cases (not implementation), verify they all FAIL (RED) in one run, and detect accidental-green.

${featureContext()}

## Your Chunk (${tcs.length} test cases)
${tcListMarkdown(tcs)}

## Prior Chunk Results (already-processed TCs — do NOT re-write these)
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

## Your Task (Chunk RED)

1. **Write test code** for ALL ${tcs.length} test cases in your chunk.
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
   Confirm RED by PARSING the run output — do NOT rely on \`exit code != 0\` (the suite has
   pre-existing failures, so a nonzero exit may come from them, not from your tests). Verify
   EACH test you wrote appears in the FAILED list of the output. A test that FAILS = DONE
   (RED confirmed). A test you wrote that is ABSENT from the failed list (i.e. passed) is
   accidental-green — handle in step 3.
   - **Multi-chunk note** (chunkSize > 0): tests written by PRIOR RED chunks are still RED (not yet
     implemented) — their failures are expected and do NOT count toward your chunk. Only your chunk's
     tests determine RED confirmation for this chunk.

3. **Detect accidental-green (LIGHT — no sabotage).** For any new test that PASSES unexpectedly:
   - Sanity-check: is the test trivially true (e.g. \`assertTrue(true)\`)? If yes → rewrite once, re-run, re-check.
   - If genuinely passing against existing code → mark SKIPPED with skipReason "accidental green — test already passes; needs human review (no sabotage in batch mode)".
   - Do NOT sabotage. Do NOT spawn GREEN. Chunk RED trades the sabotage×3 confirmation for speed; the accidental-green TC is flagged for human review in the morning.

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
${tcs.map(tc => `- ${tc.tcId}: ${tc.tcName}`).join('\n')}

## All RED Results (for context)
${allResults}

## Baseline Snapshot (for INTERFERENCE-LIGHT)
- **Pre-existing failures** (NOT interference — exclude): ${preExistingList}
- **Baseline by File**: ${tcFiles.map(f => `  - ${f}: TCs [${(BASELINE_BY_FILE[f] || []).join(', ')}]`).join('\n') || '  (no file groupings)'}

## Other Chunks (later chunks — tests NOT yet written)
In the per-chunk loop, later chunks' tests do not exist yet (each chunk finishes RED→GREEN before
the next chunk starts), so they cannot appear in your run. Interference only sees: this chunk's
TCs, pre-existing failures, accidental-green SKIPPED TCs, and tests from PREVIOUS chunks.

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
   Confirm by parsing the run output, NOT by exit code — pre-existing failures (below) keep the
   exit code nonzero regardless of your chunk. A TC is DONE only when its test shows PASSED in the
   output; a TC still failing after 5 iterations → ERROR.

3. **INTERFERENCE-LIGHT** — after the chunk passes, run ALL tests in every file touched by this chunk:
   - Identify the test file(s) your TCs belong to (use baseline byFile map + your own filesChanged).
   - Run those files: \`./gradlew :{service}:test --tests "{TestClass}"\` / \`./mvnw test -Dtest="{TestClass}"\` / \`npx vitest run <file>\`.
   - If any test OTHER than (a) a TC in this chunk, (b) a pre-existing failure, or (c) an accidental-green SKIPPED TC now FAILS → that is INTERFERENCE (this includes a test from a PREVIOUS chunk that was already green — your change broke it). Record which test broke + what file/line + likely culprit.
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

## ${mode === 'light' ? 'LIGHT MODE — 4 Critical Checks + INTERFERENCE-FULL' : 'FULL MODE — All 10 Gates + INTERFERENCE-FULL delta-gate'}

${mode === 'light' ? `
### L1: Delta Gate — Regression Check vs Baseline (INTERFERENCE-FULL)

The suite may have **pre-existing failures** (tolerated red TCs already failing before this cook). They keep the exit code nonzero, so **exit code is NOT a clean signal** — the L1 verdict comes from a **status-delta comparison against the baseline**, not from "all green".

1. Re-run the full test suite (same command + output dir as baseline capture) to produce current results.
2. Run the machine-readable delta compare:
   - junit-xml: \`cd ${SPECS_ROOT} && .claude/scripts/baseline compare --baseline ${BASELINE_PATH} --framework junit-xml --test-output-dir <current-output-dir> --json\`
   - json frameworks: \`cd ${SPECS_ROOT} && .claude/scripts/baseline compare --baseline ${BASELINE_PATH} --framework <jest-json|vitest-json|pytest-json> --current <current-output.json> --json\`
3. The compare returns 3 buckets for every currently-FAILING test:
   - \`interference\` — baseline PASS → current FAIL (regression introduced by this feature)
   - \`preExistingStillFailing\` — baseline FAIL → current FAIL (tolerated red, NOT a regression)
   - \`notInBaselineNowFailing\` — no baseline entry + current FAIL (new test failing, or partial/incomplete capture)
4. Return the 3 arrays **verbatim** in your GATE_RESULT as \`interference\`, \`preExistingStillFailing\`, \`notInBaselineNowFailing\` (each element = one object from the \`--json\` output, untouched). Do NOT collapse them into \`summary\` only — the workflow forwards them into the morning report so the human can distinguish "still red after cook" (needs a separate ticket) from "accidentally fixed by cook" (no ticket).
5. **Retry-before-fail (flaky guard)** — for every test currently in \`interference\` or \`notInBaselineNowFailing\`, re-run JUST that single test once (targeted, not the whole suite — e.g. Gradle \`--tests "TestClass.testMethod"\`, Maven \`-Dtest="TestClass#testMethod"\`, Jest/Vitest \`-t "<name>"\`, pytest \`<file>::<test>\`). If it PASSES on re-run, it was transient/flaky — MOVE it out of its bucket into a separate \`flaky\` array (do NOT fail L1 for it). If it still FAILS, keep it in its bucket.

**L1 verdict (delta-gate, after the flaky guard):**
- \`interference\` EMPTY **and** \`notInBaselineNowFailing\` EMPTY → L1 PASS ✅
- \`interference\` non-empty → L1 FAIL ❌ (feature broke a previously-passing test — and it failed again on re-run)
- \`notInBaselineNowFailing\` non-empty → L1 FAIL ❌ (a test with no baseline entry is now failing and failed again on re-run — feature's own new test never went green, or capture was incomplete)
- \`preExistingStillFailing\` non-empty → **tolerated, does NOT fail L1** (carried forward to the report; human reviews in the morning)
- \`flaky\` non-empty → **tolerated, does NOT fail L1** (failed once, passed on targeted re-run — transient; report to human for stabilization)

Do NOT report L1 PASS from exit code 0 — with pre-existing failures the exit code is always nonzero. The compare \`--json\` output is the objective verdict.

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
### L1: Delta Gate — Regression Check vs Baseline (INTERFERENCE-FULL)

**⚠️ This is the PRIMARY INTERFERENCE-FULL delta-gate.** L1 runs the full regression check vs baseline — the per-chunk GATE light only ran L2-L4 structural checks and did NOT do the baseline compare (compare current failures vs the baseline pre-existing list; a newly-failing test = regression). Exit code is NOT the signal when pre-existing failures exist. Re-run \`baseline compare --json\`, apply the same retry-before-fail (re-run each failing test once; pass → move to \`flaky\`), and return the same 3 buckets plus \`flaky\` (\`interference\`, \`preExistingStillFailing\`, \`notInBaselineNowFailing\`, \`flaky\`) verbatim in your GATE_RESULT.

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
- Controller/handler-layer discipline: business logic lives in the service layer, NOT the controller — no controller/route handler injects a Repository/Feign/cache client, holds private helpers that make external calls and swallow exceptions, or runs inline business orchestration (resolve/degrade/fallback). Controller stays thin: parse/validate → call ONE service → map errors to the envelope. Grep the changed controller files and cite file:line in failures.
`}

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md

## Return Structured Output
Return a GATE_RESULT with: mode, status (PASS/FAIL), passed, total, failures array, summary — plus the 4 delta-gate buckets \`interference\`, \`preExistingStillFailing\`, \`notInBaselineNowFailing\`, \`flaky\` (verbatim objects from \`baseline compare --json\`; \`flaky\` = tests that failed the full-suite run but passed the targeted re-run).`
}

// Per-chunk GATE light — L2-L4 structural checks ONLY (no delta-gate/baseline compare).
// The delta-gate (INTERFERENCE-FULL) can only run meaningfully once ALL chunks are GREEN —
// while later chunks are still RED, their new failing tests would false-trip L1's
// `notInBaselineNowFailing` bucket. Delta-gate is deferred to GATE full.
function gateChunkLightPrompt(tcResults, techStackHint) {
  const tcSummary = tcResults
    .map(r => `- ${r.tcId}: ${r.status} — ${r.tcName} (files: ${(r.filesChanged || []).join(', ') || 'none'})`)
    .join('\n')

  const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]

  return `You are a GATE verifier. Run LIGHT mode structural gate checks (L2-L4) on the current chunk of the TDD cycle.

${featureContext()}

## Chunk Summary
${tcSummary}

## Files Changed in This Chunk
${allFiles.map(f => `- ${f}`).join('\n')}

## Tech Stack
${techStackHint || 'Detect from project conventions and framework'}

## LIGHT MODE — 3 Structural Checks (L2-L4, per-chunk)
NOTE: This is a NON-BLOCKING early structural check on the chunk's changed files. It does NOT run the baseline delta-gate (INTERFERENCE-FULL) — that happens once in GATE full after all chunks are GREEN. Report the violations you see; the final GATE full re-verifies them.

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

## Required Reading (đường dẫn relative tới ${SPECS_ROOT}/agent_docs)
- **Hard boundaries**: ${SPECS_ROOT}/agent_docs/hard-boundaries.md
- **Conventions**: ${SPECS_ROOT}/agent_docs/conventions.md
- **Tech design**: ${SPECS_ROOT}/agent_docs/tech-design/${service}-service.md

## Return Structured Output
Return a GATE_RESULT with: mode ("light"), status (PASS/FAIL), passed, total (3), failures array, summary. Do NOT populate the delta-gate buckets (interference/preExistingStillFailing/notInBaselineNowFailing/flaky) — leave them empty; GATE full owns the delta-gate.`
}

function refactorAgentPrompt(mode, tcResults, gateLightPassed) {
  const allFiles = [...new Set(tcResults.flatMap(r => r.filesChanged || []))]
  const gateStatus = gateLightPassed
    ? 'GATE light: PASS'
    : 'GATE light: FAIL — refactor to address structural violations'

  const preExistingList = BASELINE_PRE_EXISTING.length > 0
    ? BASELINE_PRE_EXISTING.map(f => `  - ${f}`).join('\n')
    : '  (none)'

  return `You are a REFACTOR agent. Improve code quality while introducing NO NEW test failures.

${featureContext()}

## TDD Cycle Summary
${tcResults.map(r => `- ${r.tcId}: ${r.status} — ${r.tcName}`).join('\n')}

## All Changed Files
${allFiles.map(f => `- ${f}`).join('\n')}

## Pre-existing Failures (tolerated red — NOT your concern)
These were already red before this cook. Keep them failing (do NOT fix, do NOT count as breakage). They keep the exit code nonzero — judge breakage by PARSE OUTPUT, not exit code.
${preExistingList}

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
**Introduce NO NEW failures.** A test that was green (or is a feature TC) and now FAILS = breakage → revert that change. Pre-existing failures (above) are tolerated and are NOT breakage. Judge by PARSE OUTPUT — exit code is always nonzero with pre-existing failures.
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
  const phaseDisplay = phaseName  // must match a meta.phases title exactly (e.g. 'GATE Full')

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

// Per-chunk GATE light — L2-L4 structural checks ONLY, run ONCE per chunk (non-blocking,
// no retry/targeted-fix). The delta-gate (INTERFERENCE-FULL baseline compare) is deferred
// to GATE full because later chunks are still RED and would false-trip L1.
async function runChunkGateLight(chunkTcResults, techStackHint) {
  let result
  try {
    result = await agent(gateChunkLightPrompt(chunkTcResults, techStackHint), {
      label: 'GATE-light-chunk',
      phase: 'TDD Chunks',
      agentType: GATE,
      schema: GATE_RESULT,
    })
  } catch (e) {
    log(`GATE light (chunk) error: ${e.message || e}`)
    result = { mode: 'light', status: 'FAIL', passed: 0, total: 3, failures: [`Agent error: ${e.message || e}`], summary: 'GATE light chunk failed to execute' }
  }
  if (!result) {
    result = { mode: 'light', status: 'FAIL', passed: 0, total: 3, failures: ['Agent returned null'], summary: 'GATE light chunk agent returned null' }
  }
  log(`${result.status === 'PASS' ? '✅' : '⚠️'} GATE light (chunk): ${result.status} (${result.passed}/${result.total}) — non-blocking`)
  if (result.failures && result.failures.length > 0) {
    result.failures.forEach(f => log(`  ❌ ${f}`))
  }
  return result
}

// ═══════════════════════════════════════════
// PER-CHUNK LOOP TDD EXECUTION
// ═══════════════════════════════════════════

log(`🏁 Overnight cook started (per-chunk loop): ${featureName}`)
log(`📋 FR-ID: ${frId} | Service: ${service} | Layer: ${layer}`)
log(`🧪 Test Cases: ${testCases.length} (${testCases.map(tc => tc.id).join(', ')})`)
log(`🔀 Strategy: PER-CHUNK LOOP — per chunk: RED → GREEN (+INTERFERENCE-LIGHT) → GATE light (L2-L4) → REFACTOR light; then REFACTOR full → GATE full (delta-gate). Mỗi bước là một agent do workflow spawn (không spawn từ RED). chunkSize=${chunkSize}`)

// ── Idempotent resume: skip TCs already completed in prior run ──
const completedTcIds = new Set(resumeFrom?.completedTcIds || [])
const completedTcFiles = resumeFrom?.completedTcFiles || {}  // { tcId: [files] } — từ COOK_REPORT trước (preserves filesChanged trên resume)
const skipRefactor = resumeFrom?.refactorDone === true
const skipGateFull = resumeFrom?.gateFullPass === true

const tcResults = []
const warnings = []
let allTestsPass = true
let interferenceCount = 0
const allFiles = []
let techStackHint = ''

// Recompute tech-stack hint from accumulated changed files (agents tự detect nếu hint rỗng).
function updateTechStack(files) {
  for (const f of files || []) allFiles.push(f)
  const uniq = [...new Set(allFiles)]
  if (uniq.some(f => f.endsWith('.java'))) techStackHint = 'Java/Spring Boot'
  else if (uniq.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) techStackHint = 'TypeScript/Node.js'
  else if (uniq.some(f => f.endsWith('.py'))) techStackHint = 'Python'
  else if (uniq.some(f => f.endsWith('.go'))) techStackHint = 'Go'
  else if (uniq.some(f => f.endsWith('.rs'))) techStackHint = 'Rust'
}

if (completedTcIds.size > 0) {
  log(`⏭️ Resuming: ${completedTcIds.size} TCs already done → ${[...completedTcIds].join(', ')}`)
  for (const tc of testCases) {
    if (completedTcIds.has(tc.id)) {
      const files = completedTcFiles[tc.id] || []
      // testFile không thể recover chính xác từ filesChanged (filesChanged gộp test+impl) → để rỗng (trung thực hơn là đoán).
      tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'DONE', filesChanged: files, testFile: '' })
      updateTechStack(files)
    }
  }
}
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

// ── Per-chunk loop: RED → GREEN (+INTERFERENCE-LIGHT) → GATE light (L2-L4) → REFACTOR light ──
phase('TDD Chunks')

const pendingTcs = testCases.filter(tc => !completedTcIds.has(tc.id))
const chunks = chunk(pendingTcs, Math.max(1, chunkSize))
const gateLightChunks = []  // per-chunk GATE light results (non-blocking)

for (const [ci, chunkTcs] of chunks.entries()) {
  log(`\n── Chunk ${ci + 1}/${chunks.length}: [${chunkTcs.map(tc => tc.id).join(', ')}] ──`)

  // 1. RED chunk (workflow-spawned)
  const redResult = await agent(redBatchAgentPrompt(chunkTcs, tcResults), {
    label: `RED-${chunkTcs.map(tc => tc.id).join(',')}`,
    phase: 'TDD Chunks',
    agentType: RED_BATCH,
    schema: BATCH_RESULT,
  })

  if (redResult && redResult.tcResults) {
    for (const r of redResult.tcResults) {
      tcResults.push(r)
      updateTechStack(r.filesChanged)
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
    // Reconciliation (No silent skip): any TC in this chunk the agent did NOT return
    // would otherwise vanish from tcResults — surface it as ERROR, not silent loss.
    const returnedIds = new Set(redResult.tcResults.map(r => r.tcId))
    for (const tc of chunkTcs) {
      if (!returnedIds.has(tc.id)) {
        tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'ERROR', filesChanged: [], errorDetail: 'RED chunk agent returned no result for this TC — lost in chunk response' })
        allTestsPass = false
        warnings.push(`${tc.id} ERROR: RED chunk agent returned no result — TC lost in chunk response`)
      }
    }
  } else {
    for (const tc of chunkTcs) {
      tcResults.push({ tcId: tc.id, tcName: tc.name, status: 'ERROR', filesChanged: [], errorDetail: 'RED batch agent returned null — likely skipped or crashed' })
      allTestsPass = false
      warnings.push(`${tc.id} ERROR: RED batch agent returned null`)
    }
  }

  // 2. GREEN chunk (workflow-spawned) — implement RED-confirmed TCs in THIS chunk
  const toImplement = tcResults.filter(r => r.status === 'DONE' && chunkTcs.some(tc => tc.id === r.tcId))
  let chunkInterfered = false

  if (toImplement.length > 0) {
    const greenResult = await agent(greenChunkAgentPrompt(toImplement, tcResults), {
      label: `GREEN-${toImplement.map(tc => tc.tcId).join(',')}`,
      phase: 'TDD Chunks',
      agentType: GREEN_CHUNK,
      schema: BATCH_RESULT,
    })

    if (greenResult) {
      // Merge per-TC statuses back into master list
      const byId = new Map((greenResult.tcResults || []).map(r => [r.tcId, r]))
      for (const r of tcResults) {
        if (byId.has(r.tcId)) {
          const g = byId.get(r.tcId)
          r.status = g.status === 'DONE' ? 'DONE' : (g.status || 'ERROR')
          r.filesChanged = [...new Set([...(r.filesChanged || []), ...(g.filesChanged || [])])]
          updateTechStack(g.filesChanged)
          if (g.errorDetail) r.errorDetail = g.errorDetail
          if (g.status === 'ERROR') {
            allTestsPass = false
            warnings.push(`${r.tcId} GREEN ${g.status || 'ERROR'}: ${g.errorDetail || 'stuck'}`)
          }
        }
      }

      // Reconciliation (No silent skip): any TC in this chunk the GREEN agent did NOT return
      // keeps its RED 'DONE' status → falsely counted as implemented. Mark ERROR.
      for (const tc of toImplement) {
        if (!byId.has(tc.tcId)) {
          const r = tcResults.find(x => x.tcId === tc.tcId)
          if (r) {
            r.status = 'ERROR'
            r.errorDetail = 'GREEN chunk agent returned no result for this TC — implementation not confirmed'
            allTestsPass = false
            warnings.push(`${tc.tcId} ERROR: GREEN chunk agent returned no result — implementation not confirmed`)
          }
        }
      }

      // Interference from this chunk (same-file breakage)
      if (greenResult.interference && greenResult.interference.length > 0) {
        interferenceCount += greenResult.interference.length
        greenResult.interference.forEach(i => {
          log(`  ⚠️ INTERFERENCE-LIGHT: ${i}`)
          warnings.push(`INTERFERENCE-LIGHT (chunk ${toImplement.map(tc => tc.tcId).join(',')}): ${i}`)
        })
        log(`  🛑 Stopping loop — ${toImplement.map(tc => tc.tcId).join(',')} caused same-file interference`)
        chunkInterfered = true
      }
    } else {
      for (const tc of toImplement) {
        const r = tcResults.find(x => x.tcId === tc.tcId)
        if (r) { r.status = 'ERROR'; r.errorDetail = 'GREEN chunk agent returned null' }
        allTestsPass = false
        warnings.push(`${tc.tcId} ERROR: GREEN chunk agent returned null`)
      }
    }
  }

  if (chunkInterfered) {
    // Later chunks were never RED/GREEN'd (per-chunk loop stops before them) — mark them not-cooked.
    for (let rj = ci + 1; rj < chunks.length; rj++) {
      for (const tc of chunks[rj]) {
        const r = tcResults.find(x => x.tcId === tc.id)
        if (r && r.status === 'DONE') {
          r.status = 'ERROR'
          r.errorDetail = 'Cook not run — stopped after INTERFERENCE in prior chunk'
        }
      }
    }
    break
  }

  // 3. GATE light (per-chunk, L2-L4 structural, NON-BLOCKING) — workflow-spawned
  const chunkDone = tcResults.filter(r => chunkTcs.some(tc => tc.id === r.tcId) && ['DONE', 'SKIPPED'].includes(r.status))
  let chunkGateLight = null
  if (chunkDone.length > 0) {
    chunkGateLight = await runChunkGateLight(chunkDone, techStackHint)
    gateLightChunks.push(chunkGateLight)
  }

  // 4. REFACTOR light (per-chunk cleanup, 3 ops) — workflow-spawned
  if (chunkDone.length > 0) {
    let rl = null
    try {
      rl = await agent(refactorAgentPrompt('light', chunkDone, chunkGateLight ? chunkGateLight.status === 'PASS' : true), {
        label: `REFACTOR-light-${chunkDone.map(tc => tc.tcId).join(',')}`,
        phase: 'TDD Chunks',
        agentType: REFACTOR,
        schema: REFACTOR_RESULT,
      })
    } catch (e) {
      log(`REFACTOR light error: ${e.message || e}`)
      rl = { mode: 'light', categoriesRun: [], findingsFixed: 0, findingsFlagged: 0, testSuiteStillPassing: true, summary: `Agent error: ${e.message || e}` }
    }
    if (rl) {
      log(`🔧 REFACTOR light (chunk): ${rl.findingsFixed} fixed, ${rl.findingsFlagged} flagged${rl.testSuiteStillPassing ? '' : ' — ⚠️ may have failures'}`)
      if (!rl.testSuiteStillPassing) warnings.push(`REFACTOR light (chunk ${chunkDone.map(tc => tc.tcId).join(',')}) may have caused test failures`)
    }
  }
}

// ── TC Summary ──
const doneCount = tcResults.filter(r => r.status === 'DONE').length
const skippedCount = tcResults.filter(r => r.status === 'SKIPPED').length
const failedCount = tcResults.filter(r => ['BLOCKED', 'STALE', 'ERROR'].includes(r.status)).length

log(`\n📊 TC Summary: ${doneCount} DONE, ${skippedCount} SKIPPED (accidental-green), ${interferenceCount} INTERFERENCE, ${failedCount} FAILED`)
log(`🔧 Detected tech stack: ${techStackHint || 'Unknown'}`)

// ── Aggregate per-chunk GATE light (non-blocking) ──
const gateLightResult = {
  mode: 'light',
  status: gateLightChunks.length === 0 || gateLightChunks.every(g => g.status === 'PASS') ? 'PASS' : 'FAIL',
  passed: gateLightChunks.reduce((s, g) => s + (g.passed || 0), 0),
  total: gateLightChunks.reduce((s, g) => s + (g.total || 0), 0),
  failures: gateLightChunks.flatMap(g => g.failures || []),
  summary: `Per-chunk L2-L4 structural gate — ${gateLightChunks.length} chunk(s) checked (non-blocking; delta-gate deferred to GATE full)`,
}
if (gateLightResult.status !== 'PASS') {
  warnings.push(`GATE light (per-chunk L2-L4) had failures — non-blocking, re-verified at GATE full: ${gateLightResult.failures.join('; ')}`)
}

// ── Early exit checks ──
if (!allTestsPass && doneCount === 0) {
  log('🛑 All TCs failed — cannot proceed to GATE.')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: gateLightResult, refactorFull: null, gateFull: null,
    summary: `All ${testCases.length} TCs failed. ${interferenceCount} INTERFERENCE, ${failedCount} BLOCKED/STALE/ERROR. Cannot proceed to GATE.`,
    warnings,
    nextStep: 'Review TC failures. Fix ambiguous specs, interference, or blocked TCs. Retry cook.',
  }
}

if (doneCount === 0 && skippedCount > 0 && failedCount === 0) {
  log('⚠️ All TCs accidental-green (SKIPPED) — no implementation produced. Feature cannot be "completed".')
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: gateLightResult, refactorFull: null, gateFull: null,
    summary: `All ${testCases.length} TCs accidental-green — tests already pass without implementation. Needs spec review (tests may be wrong or feature already implemented).`,
    warnings,
    nextStep: 'Review TST spec for this feature. Accidental-green across all TCs suggests wrong/misplaced tests or pre-existing implementation. Fix spec then re-run cook.',
  }
}

if (interferenceCount > 0) {
  log(`⚠️ ${interferenceCount} INTERFERENCE-LIGHT — pipeline cannot continue`)
  return {
    flow, featureName, frId, service,
    status: 'failed', tcResults, gateLight: gateLightResult, refactorFull: null, gateFull: null,
    summary: `${interferenceCount} same-file interference detected during GREEN chunks. Must be resolved by human.`,
    warnings,
    nextStep: 'Review INTERFERENCE TCs. Human decides: revert culprit or fix broken test. Re-run cook after resolution.',
  }
}

if (failedCount > 0) {
  log(`⚠️ ${failedCount} TC(s) failed — proceeding with ${doneCount + skippedCount} successful TCs`)
}

// ── REFACTOR Full ──
phase('REFACTOR Full')

const lightTcFilter = r => ['DONE', 'SKIPPED'].includes(r.status)

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

// ── GATE Full ──
phase('GATE Full')

let gateFullResult, gateFullRetries
if (skipGateFull) {
  gateFullResult = { mode: 'full', status: 'PASS', passed: 10, total: 10, failures: [], summary: 'Resumed — already PASS in prior run' }
  gateFullRetries = 0
  log('⏭️ GATE full skipped (already PASS)')
} else {
  log('🔍 Running GATE full (10 gates + INTERFERENCE-FULL delta-gate)...')
  const gateFull = await runGateWithRetry('full', 10, 'GATE Full', tcResults.filter(lightTcFilter), techStackHint)
  gateFullResult = gateFull.result
  gateFullRetries = gateFull.retries
}

if (gateFullResult.status !== 'PASS') {
  warnings.push(`GATE full FAIL after ${gateFullRetries} retries: ${(gateFullResult.failures || []).join('; ')}`)
}

// ── Report ──
phase('Report')

const overallStatus = (gateFullResult.status === 'PASS' && failedCount === 0 && interferenceCount === 0)
  ? 'completed'
  : 'partial'

const deltaBuckets = deltaBucketsFrom(gateLightResult, gateFullResult)

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
  preExistingFailures: BASELINE_PRE_EXISTING,
  interference: deltaBuckets.interference,
  preExistingStillFailing: deltaBuckets.preExistingStillFailing,
  notInBaselineNowFailing: deltaBuckets.notInBaselineNowFailing,
  flaky: deltaBuckets.flaky,
  nextStep: buildNextStep(overallStatus),
}

log(`\n${'='.repeat(60)}`)
log(`🏁 Overnight Cook Pipeline: ${overallStatus.toUpperCase()}`)
log(`${'='.repeat(60)}`)
log(`📋 ${featureName} (${frId})`)
log(`🧪 TCs: ${doneCount} DONE, ${skippedCount} SKIPPED, ${interferenceCount} INTERFERENCE, ${failedCount} FAILED`)
log(`🚦 GATE light (per-chunk L2-L4): ${gateLightResult.status} (${gateLightResult.passed}/${gateLightResult.total})`)
log(`🔧 REFACTOR: ${refactorResult.findingsFixed} fixed, ${refactorResult.findingsFlagged} flagged`)
log(`🚦 GATE full: ${gateFullResult.status} (${gateFullResult.passed}/${gateFullResult.total})`)
log(`📦 ${allFiles.length} files changed`)
if (BASELINE_PRE_EXISTING.length > 0) {
  const stillFailing = deltaBuckets.preExistingStillFailing.length
  const accidentallyFixed = BASELINE_PRE_EXISTING.length - stillFailing
  log(`🔴 ${BASELINE_PRE_EXISTING.length} pre-existing failures: ${stillFailing} still red (separate ticket), ${accidentallyFixed} accidentally fixed by cook`)
}
if (deltaBuckets.flaky.length > 0) log(`🟡 ${deltaBuckets.flaky.length} flaky test(s) — failed suite run, passed targeted re-run (report for stabilization)`)
if (warnings.length > 0) {
  log(`\n⚠️ Warnings:`)
  warnings.forEach(w => log(`  - ${w}`))
}
log(`\n🔗 Next: ${report.nextStep}`)

return report

// ═══════════════════════════════════════════
// REPORT HELPERS
// ═══════════════════════════════════════════

// Pick the delta-gate buckets from the gate result that ran the baseline compare.
// Only GATE full runs INTERFERENCE-FULL (per-chunk GATE light is L2-L4 structural only).
// Returns empty arrays when no compare ran.
function deltaBucketsFrom(...gateResults) {
  for (const r of gateResults) {
    if (r && [r.interference, r.preExistingStillFailing, r.notInBaselineNowFailing, r.flaky].some(Array.isArray)) {
      return {
        interference: r.interference || [],
        preExistingStillFailing: r.preExistingStillFailing || [],
        notInBaselineNowFailing: r.notInBaselineNowFailing || [],
        flaky: r.flaky || [],
      }
    }
  }
  return { interference: [], preExistingStillFailing: [], notInBaselineNowFailing: [], flaky: [] }
}

function buildSummary() {
  const parts = []
  parts.push(`${featureName} (${frId}) — ${doneCount}/${testCases.length} TCs DONE`)
  if (skippedCount > 0) parts.push(`${skippedCount} SKIPPED (accidental green)`)
  if (interferenceCount > 0) parts.push(`${interferenceCount} INTERFERENCE (same-file breakage)`)
  if (failedCount > 0) parts.push(`${failedCount} FAILED`)
  parts.push(`GATE light: ${gateLightResult.status === 'PASS' ? 'ALL PASS' : `${gateLightResult.passed}/${gateLightResult.total}`}`)
  parts.push(`GATE full: ${gateFullResult.status === 'PASS' ? 'ALL PASS' : `${gateFullResult.passed}/${gateFullResult.total}`}`)
  if (BASELINE_PRE_EXISTING.length > 0) parts.push(`${BASELINE_PRE_EXISTING.length} pre-existing failures carried forward (tolerated red)`)
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

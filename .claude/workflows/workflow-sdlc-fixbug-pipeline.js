export const meta = {
  name: 'workflow-sdlc-fixbug-pipeline',
  description: 'Fixbug verify pipeline: preFix→parallel checks→code review→sideEffect→prevention→artifacts. Used by sdlc:fixbug skill.',
  phases: [
    { title: 'Verify', detail: 'Pre-fix state verification + parallel typecheck/lint/build/test' },
    { title: 'Code Review', detail: 'Code reviewer agent verifies fix quality' },
    { title: 'Prevention', detail: 'Side-effect sweep + prevention gate validation' },
    { title: 'Artifacts', detail: 'Write gate artifacts to .work/bugs/' },
  ],
}

// ── Args (safe parse: handles both object and JSON-string) ──
// {
//   bugId, rootCause, blastRadius, affectedFiles, fixFiles,
//   projectType, preFixState, verifyCommands, language, workflowMode
// }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const {
  bugId,
  rootCause,
  blastRadius = [],
  affectedFiles = [],
  fixFiles = [],
  projectType = 'unknown',
  preFixState = '',
  verifyCommands = [],
  language = 'vi',
  workflowMode = 'standard',
} = _args

const useEnglish = language === 'en'
const langInstr = useEnglish
  ? 'Write all output in English. Keep technical terms and code identifiers in their original form.'
  : 'Viết tất cả output bằng tiếng Việt. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'
const isQuick = workflowMode === 'quick'
const isDeep = workflowMode === 'deep'

// ── Schemas ──

const PRE_FIX_VERIFY = {
  type: 'object',
  properties: {
    symptomFixed: { type: 'boolean', description: 'Does the original symptom still reproduce?' },
    output: { type: 'string', description: 'Actual command output (trimmed to key lines)' },
    matchesExpected: { type: 'boolean', description: 'Output matches expected success behavior' },
  },
  required: ['symptomFixed', 'output', 'matchesExpected'],
}

const PARALLEL_CHECKS = {
  type: 'object',
  properties: {
    typecheck: { type: 'boolean', description: 'Typecheck passed without new errors' },
    lint: { type: 'boolean', description: 'Lint passed without new errors' },
    build: { type: 'boolean', description: 'Build succeeded' },
    test: { type: 'boolean', description: 'All tests pass' },
    errors: { type: 'string', description: 'Error details if any check failed' },
  },
  required: ['typecheck', 'lint', 'build', 'test'],
}

const CODE_REVIEW = {
  type: 'object',
  properties: {
    passed: { type: 'boolean', description: 'Review gate passed overall' },
    score: { type: 'integer', description: 'Quality score out of 10' },
    feedback: { type: 'string', description: 'Specific issues found or approval summary' },
    rootCauseAddressed: { type: 'boolean', description: 'Root cause actually fixed, not symptom-patched' },
    noBusinessRegression: { type: 'boolean', description: 'No business logic broken in blast radius' },
    noNewFailureModes: { type: 'boolean', description: 'No new failure modes introduced' },
    followsExistingPatterns: { type: 'boolean', description: 'Fix follows patterns from scout' },
  },
  required: ['passed', 'score', 'feedback', 'rootCauseAddressed', 'noBusinessRegression', 'noNewFailureModes', 'followsExistingPatterns'],
}

const SIDE_EFFECT = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    pathsChecked: { type: 'integer' },
    brokenPaths: { type: 'array', items: { type: 'string' } },
    details: { type: 'string' },
  },
  required: ['passed', 'pathsChecked', 'brokenPaths'],
}

const PREVENTION_GATE = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    testsAdded: { type: 'integer' },
    guardsAdded: { type: 'integer' },
    missingItems: { type: 'array', items: { type: 'string' } },
  },
  required: ['passed', 'testsAdded', 'guardsAdded'],
}

// ── Helpers ──

const ARTIFACTS_DIR = `.work/bugs/${bugId}`
const BLAST_FILES = blastRadius.length > 0 ? blastRadius : affectedFiles

/** List changed files for the review agent */
function changedFileList() {
  if (fixFiles.length > 0) return fixFiles.join(', ')
  // fallback: use git diff
  return 'git diff --name-only HEAD'
}

/** Build the full verify command list as a single string */
function verifyCommandsStr() {
  if (verifyCommands.length === 0) return '(run standard test suite)'
  return verifyCommands.map((c, i) => `${i + 1}. ${c}`).join('\n')
}

// ═══════════════════════════════════════════
// PHASE: Verify
// ═══════════════════════════════════════════
phase('Verify')

// ── Pre-fix state verification ──
log('Verifying original symptom no longer reproduces...')

const preFixResult = await agent(
  `${langInstr}
You are verifying a bug fix. The fix was applied to files: ${fixFiles.join(', ') || 'unknown'}.

BUG ID: ${bugId}
ROOT CAUSE: ${rootCause}
PRE-FIX SYMPTOM: ${preFixState}

VERIFY COMMANDS (run these exact commands to check the symptom is gone):
${verifyCommandsStr()}

INSTRUCTIONS:
1. Run each verify command exactly as listed
2. Compare output to the pre-fix symptom above
3. Determine if the symptom still reproduces or is now fixed
4. Check that the output matches expected success behavior (not just "no error")
5. Report: symptomFixed (boolean), actual output, matchesExpected (boolean)

IMPORTANT: If the fix introduced a DIFFERENT error, that counts as symptomFixed=false because the original symptom may be gone but the fix is broken.`,
  { label: 'pre-fix-verify', phase: 'Verify', agentType: 'general-purpose', schema: PRE_FIX_VERIFY }
)

if (!preFixResult) {
  log('✗ Pre-fix verify: agent error')
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'preFixVerify',
    feedback: 'Agent failed to execute',
  }
}

log(`Pre-fix verify: symptomFixed=${preFixResult.symptomFixed}, matchesExpected=${preFixResult.matchesExpected}`)

if (!preFixResult.symptomFixed) {
  log(`✗ Symptom still reproduces! Output: ${preFixResult.output}`)
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'preFixVerify',
    feedback: 'Symptom still reproduces after fix',
    details: preFixResult,
  }
}

if (!preFixResult.matchesExpected) {
  log(`✗ Output does not match expected success behavior: ${preFixResult.output}`)
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'preFixVerify',
    feedback: 'Fix prevented the error but output does not match expected behavior',
    details: preFixResult,
  }
}

log('✓ Pre-fix verify: symptom resolved')

// ── Parallel checks ──
log('Running parallel checks: typecheck + lint + build + test...')

const parallelTasks = [
  () => agent(
    `Run typecheck on the project (${projectType}). Report pass/fail and any new errors introduced by the fix in: ${fixFiles.join(', ') || 'recent changes'}. Ignore pre-existing type errors unrelated to the fix. ${langInstr}`,
    { label: 'typecheck', phase: 'Verify', schema: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'string' } }, required: ['passed'] } }
  ),
  () => agent(
    `Run linter on the project (${projectType}). Report pass/fail and any new warnings/errors introduced by the fix in: ${fixFiles.join(', ') || 'recent changes'}. Ignore pre-existing lint issues unrelated to the fix. ${langInstr}`,
    { label: 'lint', phase: 'Verify', schema: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'string' } }, required: ['passed'] } }
  ),
  () => agent(
    `Run the project build (${projectType}). Report pass/fail. ${langInstr}`,
    { label: 'build', phase: 'Verify', schema: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'string' } }, required: ['passed'] } }
  ),
]

// Quick mode: skip test (type system is the guard)
if (!isQuick) {
  parallelTasks.push(
    () => agent(
      `Run tests for these areas: ${BLAST_FILES.join(', ')}. Verify all tests pass. Report any failures with details. If specific test commands are available, use them: ${verifyCommandsStr()}. ${langInstr}`,
      { label: 'test', phase: 'Verify', schema: { type: 'object', properties: { passed: { type: 'boolean' }, failures: { type: 'string' } }, required: ['passed'] } }
    )
  )
}

const parallelResults = await parallel(parallelTasks)

const typecheckOk = parallelResults[0] || { passed: false, errors: 'agent error' }
const lintOk = parallelResults[1] || { passed: false, errors: 'agent error' }
const buildOk = parallelResults[2] || { passed: false, errors: 'agent error' }
const testOk = isQuick ? { passed: true, failures: 'skipped (quick mode)' } : (parallelResults[3] || { passed: false, failures: 'agent error' })

const parallelChecks = {
  typecheck: typecheckOk.passed,
  lint: lintOk.passed,
  build: buildOk.passed,
  test: testOk.passed,
  errors: [
    !typecheckOk.passed ? `typecheck: ${typecheckOk.errors || 'failed'}` : '',
    !lintOk.passed ? `lint: ${lintOk.errors || 'failed'}` : '',
    !buildOk.passed ? `build: ${buildOk.errors || 'failed'}` : '',
    !testOk.passed ? `test: ${testOk.failures || 'failed'}` : '',
  ].filter(Boolean).join('; '),
}

const parallelAllPassed = parallelChecks.typecheck && parallelChecks.lint && parallelChecks.build && parallelChecks.test

if (!parallelAllPassed) {
  log(`✗ Parallel checks failed: ${parallelChecks.errors}`)
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'parallelChecks',
    feedback: parallelChecks.errors,
    details: parallelChecks,
  }
}

log('✓ Parallel checks: all passed')

// ── Skip remaining phases for quick mode ──
if (isQuick) {
  log('Quick mode: skipping code review, side-effect sweep, prevention gate')
  return {
    mode: 'fixbug-verify',
    status: 'passed',
    results: {
      preFixVerify: preFixResult,
      parallelChecks,
      codeReview: { passed: true, score: null, feedback: 'skipped (quick mode)', rootCauseAddressed: null, noBusinessRegression: null, noNewFailureModes: null, followsExistingPatterns: null },
      sideEffectSweep: { passed: true, pathsChecked: 0, brokenPaths: [], details: 'skipped (quick mode)' },
      preventionGate: { passed: true, testsAdded: 0, guardsAdded: 0, missingItems: [] },
      artifacts: [],
    },
  }
}

// ═══════════════════════════════════════════
// PHASE: Code Review
// ═══════════════════════════════════════════
phase('Code Review')

const reviewResult = await agent(
  `${langInstr}
Review the fix for BUG: ${bugId}.

ROOT CAUSE: ${rootCause}

FIX FILES: ${fixFiles.join(', ') || changedFileList()}
AFFECTED FILES (blast radius): ${affectedFiles.join(', ') || 'unknown'}
PROJECT TYPE: ${projectType}

SCOUT SUMMARY:
- Pre-fix symptom: ${preFixState}
- Verify commands passed: typecheck=${parallelChecks.typecheck}, lint=${parallelChecks.lint}, build=${parallelChecks.build}, test=${parallelChecks.test}

REVIEW CHECKLIST (answer each explicitly):
1. ROOT CAUSE ACTUALLY ADDRESSED? (not symptom-patched) — check that the fix targets the root cause, not just the surface symptom
2. NO BUSINESS LOGIC REGRESSION? — check each affected file in blast radius for broken workflows
3. NO NEW FAILURE MODES? — verify error handling is correct, no silent failures, no unhandled paths
4. FOLLOWS EXISTING PATTERNS? — fix matches codebase conventions found during scout

Report: passed (boolean — true only if ALL 4 checks pass), score (1-10 integers), feedback (specific findings), and each checklist item as a boolean.`,
  { label: 'code-review', phase: 'Code Review', agentType: 'code-reviewer', schema: CODE_REVIEW }
)

const codeReview = reviewResult || {
  passed: false,
  score: 0,
  feedback: 'agent error',
  rootCauseAddressed: false,
  noBusinessRegression: false,
  noNewFailureModes: false,
  followsExistingPatterns: false,
}

log(`Code review: ${codeReview.passed ? 'PASSED' : 'FAILED'} (${codeReview.score}/10) — ${codeReview.feedback}`)

if (!codeReview.passed) {
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'codeReview',
    feedback: codeReview.feedback,
    details: codeReview,
  }
}

// ═══════════════════════════════════════════
// PHASE: Prevention
// ═══════════════════════════════════════════
phase('Prevention')

// ── Side-effect sweep ──
log('Running side-effect sweep on blast radius...')

const sideEffectResult = await agent(
  `${langInstr}
Verify NO side effects from the fix for BUG: ${bugId}.

FIX FILES: ${fixFiles.join(', ')}
BLAST RADIUS (all code paths that depend on changed behavior): ${BLAST_FILES.join(', ')}

INSTRUCTIONS:
1. Walk each code path in the blast radius
2. For each path, verify the fix does NOT break expected behavior
3. Check public contracts: function signatures, exported types, response shapes, DB schemas, env vars — are they unchanged?
4. Run tests in modules that share files/contracts with the fix

Report: passed (boolean — true only if ALL paths clean), pathsChecked (integer), brokenPaths (array of strings — which paths broke and why), details (summary of what was checked).

IMPORTANT: If any blast-radius code path is broken, passed=false and list it in brokenPaths.`,
  { label: 'side-effect-sweep', phase: 'Prevention', agentType: 'general-purpose', schema: SIDE_EFFECT }
)

const sideEffectSweep = sideEffectResult || {
  passed: false,
  pathsChecked: 0,
  brokenPaths: ['agent error'],
  details: 'Agent failed to execute',
}

log(`Side-effect sweep: ${sideEffectSweep.passed ? 'PASSED' : 'FAILED'} — ${sideEffectSweep.pathsChecked} paths checked, ${sideEffectSweep.brokenPaths.length} broken`)

if (!sideEffectSweep.passed) {
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'sideEffectSweep',
    feedback: `Side effects detected in ${sideEffectSweep.brokenPaths.length} paths: ${sideEffectSweep.brokenPaths.join(', ')}`,
    details: sideEffectSweep,
  }
}

// ── Prevention gate ──
log('Checking prevention gate...')

const preventionResult = await agent(
  `${langInstr}
Validate the prevention gate for BUG: ${bugId}.

ROOT CAUSE: ${rootCause}
PROJECT TYPE: ${projectType}
FIX FILES: ${fixFiles.join(', ')}

PREVENTION CHECKLIST (check what was applied):
1. Regression test: Is there a test that FAILS without the fix and PASSES with it? If no test framework exists, was a runtime assertion added?
2. Defense-in-depth layers applied (check each that applies):
   - Entry point validation (if user/external input is involved)
   - Business logic validation (if data processing is involved)
   - Environment guards (if env-sensitive operations)
   - Debug instrumentation (if the bug was hard to diagnose)
3. Type safety: Were types strengthened? (null checks, type guards, required fields)
4. Error handling: Was error handling improved? (try/catch, error boundaries, logging)

Report: passed (boolean), testsAdded (integer), guardsAdded (integer), missingItems (array of strings — what's still missing).

Be pragmatic — not every fix needs every layer. Only flag truly missing prevention that directly relates to the root cause. A type-error fix doesn't need an entry-point guard.`,
  { label: 'prevention-gate', phase: 'Prevention', agentType: 'general-purpose', schema: PREVENTION_GATE }
)

const preventionGate = preventionResult || {
  passed: false,
  testsAdded: 0,
  guardsAdded: 0,
  missingItems: ['agent error'],
}

log(`Prevention gate: ${preventionGate.passed ? 'PASSED' : 'INCOMPLETE'} — ${preventionGate.testsAdded} tests, ${preventionGate.guardsAdded} guards added`)

if (!preventionGate.passed) {
  return {
    mode: 'fixbug-verify',
    status: 'failed',
    phase: 'preventionGate',
    feedback: `Missing prevention: ${preventionGate.missingItems.join(', ')}`,
    details: preventionGate,
  }
}

// ═══════════════════════════════════════════
// PHASE: Artifacts
// ═══════════════════════════════════════════
phase('Artifacts')

log(`Writing gate artifacts to ${ARTIFACTS_DIR}/`)

await agent(
  `Write verification artifacts for BUG: ${bugId} to ${ARTIFACTS_DIR}/. Create the directory with mkdir -p first. ${langInstr}

Write these 4 JSON files:

1. ${ARTIFACTS_DIR}/verification.json:
\`\`\`json
{
  "bugId": "${bugId}",
  "timestamp": "(agent: fill current ISO timestamp)",
  "preFixState": ${JSON.stringify(preFixState)},
  "preFixVerify": ${JSON.stringify(preFixResult)},
  "parallelChecks": ${JSON.stringify(parallelChecks)},
  "beforeAfter": {
    "before": ${JSON.stringify(preFixState)},
    "after": "${preFixResult.output}"
  }
}
\`\`\`

2. ${ARTIFACTS_DIR}/review-decision.json:
\`\`\`json
{
  "bugId": "${bugId}",
  "codeReview": ${JSON.stringify(codeReview)},
  "verdict": "${codeReview.passed ? 'APPROVED' : 'REJECTED'}",
  "confidenceScore": ${codeReview.score}
}
\`\`\`

3. ${ARTIFACTS_DIR}/side-effect-sweep.json:
\`\`\`json
{
  "bugId": "${bugId}",
  "sideEffectSweep": ${JSON.stringify(sideEffectSweep)},
  "blastRadius": ${JSON.stringify(blastRadius)},
  "pathsChecked": ${sideEffectSweep.pathsChecked}
}
\`\`\`

4. ${ARTIFACTS_DIR}/risk-gate.json:
\`\`\`json
{
  "bugId": "${bugId}",
  "preventionGate": ${JSON.stringify(preventionGate)},
  "codeReviewScore": ${codeReview.score},
  "allChecksPassed": ${parallelAllPassed},
  "overallVerdict": "${codeReview.passed && sideEffectSweep.passed && preventionGate.passed ? 'PASS' : 'FAIL'}"
}
\`\`\`

Use the Write tool to create each file. Generate the current ISO timestamp for the "timestamp" field (run `date -u +%Y-%m-%dT%H:%M:%SZ` if needed). Ensure the directory exists first with mkdir -p.`,
  { label: 'write-artifacts', phase: 'Artifacts' }
)

// ── Deep mode: brainstormer verification ──
let deepVerifyResult = null
if (isDeep) {
  log('Deep mode: running brainstormer for architectural verification...')
  deepVerifyResult = await agent(
    `${langInstr}
Perform architectural-level verification of the fix for BUG: ${bugId}.

ROOT CAUSE: ${rootCause}
FIX FILES: ${fixFiles.join(', ')}
BLAST RADIUS: ${BLAST_FILES.join(', ')}

TASK: Think like an architect reviewing this fix. Consider:
- Does this fix align with system architecture?
- Could this fix create technical debt?
- Are there alternative approaches that would be cleaner?
- Is the fix at the right layer of abstraction?

Provide a brief assessment. This is deep-mode verification — flag concerns the standard review might miss.`,
    { label: 'deep-verify', phase: 'Prevention' }
  )
}

// ═══════════════════════════════════════════
// RETURN
// ═══════════════════════════════════════════

return {
  mode: 'fixbug-verify',
  status: 'passed',
  results: {
    preFixVerify: preFixResult,
    parallelChecks,
    codeReview,
    sideEffectSweep,
    preventionGate,
    deepVerify: deepVerifyResult,
    artifacts: [
      `${ARTIFACTS_DIR}/verification.json`,
      `${ARTIFACTS_DIR}/review-decision.json`,
      `${ARTIFACTS_DIR}/side-effect-sweep.json`,
      `${ARTIFACTS_DIR}/risk-gate.json`,
    ],
  },
}

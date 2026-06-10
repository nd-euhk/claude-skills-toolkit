export const meta = {
  name: 'workflow-sdlc-cook-pipeline',
  description: 'Cook TDD Pipeline: red→green→gate:light→refactor→gate:full for BE+FE in parallel. Used by sdlc:workflow skill.',
  phases: [
    { title: 'TDD-RED', detail: 'Write failing tests (BE+FE)' },
    { title: 'TDD-GREEN', detail: 'Implement to pass tests (BE+FE)' },
    { title: 'TDD-GATE-LIGHT', detail: '4 critical checks (BE+FE)' },
    { title: 'TDD-REFACTOR', detail: 'Refactor for quality (BE+FE)' },
    { title: 'TDD-GATE-FULL', detail: '10 comprehensive checks (BE+FE)' },
  ],
}

// ── Args ──
// { taskId, taskTitle, planFile, language?: 'vi'|'en', runDate, slug, beAffected: bool, feAffected: bool, tstPath, impPath }
const { taskId, taskTitle, planFile, language, beAffected, feAffected, tstPath, impPath } = args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

const runBE = beAffected === true
const runFE = feAffected === true

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

// ── Helpers ──

/** Spawn TDD gate agent with mode (light or full) */
async function tddGateCheck(track, mode) {
  const gateLabel = `tdd-${track}-gate`
  const modeFlag = mode === 'full' ? '--mode=full' : '--mode=light'
  return agent(
    `Verify ${track.toUpperCase()} TDD ${mode.toUpperCase()} gate for task ${taskId}: ${taskTitle}. ${modeFlag}. Read-only — do not modify any files. Report pass/fail with specific evidence.`,
    { label: `${gateLabel}-${mode}`, phase: `TDD-GATE-${mode.toUpperCase()}`, agentType: `tdd-${track}-gate`, schema: GATE }
  )
}

/** Run a single TDD phase without gate (red, green, refactor) */
async function runTddPhase(label, agentType, prompt, track) {
  log(`${label} (${track}): starting...`)
  await agent(prompt, { label: `${label}-${track}`, phase: `TDD-${label.toUpperCase()}`, agentType })
  log(`${label} (${track}): done`)
  return true
}

/** Run GREEN with light-gate retry loop. On light-gate rejection, re-spawn GREEN (not RED). */
async function runGreenWithLightGate(track, greenPrompt) {
  // Step 1: Run GREEN
  await agent(greenPrompt(), { label: `green-${track}`, phase: 'TDD-GREEN', agentType: `tdd-${track}-green` })

  // Step 2: Light gate check with retry
  let gate = await tddGateCheck(track, 'light')
  for (let retry = 0; !gate.passed && retry < 3; retry++) {
    log(`GREEN-${track}: light gate rejected (${retry + 1}/3) — ${gate.feedback}`)
    // Light gate catches implementation issues → re-spawn GREEN, not RED
    let retryPrompt = greenPrompt(gate.feedback, retry + 1)
    await agent(retryPrompt, { label: `green-${track}-r${retry + 1}`, phase: 'TDD-GREEN', agentType: `tdd-${track}-green` })
    gate = await tddGateCheck(track, 'light')
  }

  if (!gate.passed) {
    log(`✗ ${track.toUpperCase()}: Light gate FAILED after 3 retries`)
    return { passed: false, feedback: gate.feedback }
  }
  log(`✓ ${track.toUpperCase()}: Light gate PASSED`)
  return { passed: true }
}

/** Run REFACTOR with full-gate retry loop. On full-gate rejection, re-spawn REFACTOR (not GREEN). */
async function runRefactorWithFullGate(track, refactorPrompt) {
  // Step 1: Run REFACTOR
  await agent(refactorPrompt(), { label: `refactor-${track}`, phase: 'TDD-REFACTOR', agentType: `tdd-${track}-refactor` })

  // Step 2: Full gate check with retry
  let gate = await tddGateCheck(track, 'full')
  for (let retry = 0; !gate.passed && retry < 3; retry++) {
    log(`REFACTOR-${track}: full gate rejected (${retry + 1}/3) — ${gate.feedback}`)
    // Full gate catches refactor deficiencies → re-spawn REFACTOR, not GREEN
    let retryPrompt = refactorPrompt(gate.feedback, retry + 1)
    await agent(retryPrompt, { label: `refactor-${track}-r${retry + 1}`, phase: 'TDD-REFACTOR', agentType: `tdd-${track}-refactor` })
    gate = await tddGateCheck(track, 'full')
  }

  if (!gate.passed) {
    log(`✗ ${track.toUpperCase()}: Full gate FAILED after 3 retries`)
    return { passed: false, feedback: gate.feedback }
  }
  log(`✓ ${track.toUpperCase()}: Full gate PASSED`)
  return { passed: true }
}

// ── Prompt builders ──

function redPrompt(track) {
  const agentType = `tdd-${track}-red`
  return `${langInstr}
Context: Task ${taskId}: ${taskTitle} — READY for implementation. ${track.toUpperCase()} track.
Inputs: TST spec at ${tstPath}, IMP spec at ${impPath}
Task: Write failing ${track === 'be' ? 'backend' : 'frontend'} tests (${track === 'be' ? 'JUnit/Testcontainers/WireMock' : 'Vitest/Testing Library/Playwright'}) from the test specifications.
Output: Tests in the project's standard test directory
Constraints: Tests must FAIL before implementation exists. Do not write implementation code.`
}

function greenPromptMaker(track) {
  const agentType = `tdd-${track}-green`
  return (feedback, retryNum) => {
    let prefix = feedback
      ? `RETRY #${retryNum}: Previous implementation failed light gate. Feedback: ${feedback}\nFix these specific issues in your implementation. Do NOT modify the tests.\n\n`
      : ''
    return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. ${track.toUpperCase()} track. Failing tests exist — your job is to make them pass.
Inputs: Failing tests (read from test directory), TST spec at ${tstPath}, IMP spec at ${impPath}
Task: Write minimal ${track === 'be' ? 'backend' : 'frontend'} implementation to make all tests pass.
Output: Implementation in the project's standard source directory
Constraints: Only write enough code to pass tests. Do not refactor yet. Do not modify tests.`
  }
}

function refactorPromptMaker(track) {
  const agentType = `tdd-${track}-refactor`
  return (feedback, retryNum) => {
    let prefix = feedback
      ? `RETRY #${retryNum}: Previous refactor failed full gate. Feedback: ${feedback}\nFix these specific issues and re-refactor.\n\n`
      : ''
    return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. ${track.toUpperCase()} track. All tests passing (GREEN, light gate passed) — your job is to refactor safely.
Inputs: Implementation and tests (read from project directories)
Task: Refactor for ${track === 'be' ? 'safety, performance, and maintainability. Run security/perf/resilience checks.' : 'accessibility, UX, performance, and security.'}
Constraints: Keep all tests green through every change. Any test failure = revert and re-think.`
  }
}

// ── Run a single TDD track (all 5 phases sequentially) ──
async function runTddTrack(track) {
  const t = track.toUpperCase()
  log(`Starting ${t} TDD pipeline...`)

  // Phase 1: RED — write failing tests
  await runTddPhase('red', `tdd-${track}-red`, redPrompt(track), t)

  // Phase 2: GREEN + LIGHT GATE (with re-spawn loop)
  const lightResult = await runGreenWithLightGate(track, greenPromptMaker(track))
  if (!lightResult.passed) {
    return { track, error: 'Light gate failed after 3 retries', feedback: lightResult.feedback, completed: ['red'] }
  }

  // Phase 3: REFACTOR + FULL GATE (with re-spawn loop)
  const fullResult = await runRefactorWithFullGate(track, refactorPromptMaker(track))
  if (!fullResult.passed) {
    return { track, error: 'Full gate failed after 3 retries', feedback: fullResult.feedback, completed: ['red', 'green', 'light'] }
  }

  log(`✓ ${t} TDD pipeline: COMPLETE`)
  return { track, passed: true, completed: ['red', 'green', 'light', 'refactor', 'full'] }
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// Build track list based on impact assessment
const tracks = []
if (runBE) tracks.push('be')
if (runFE) tracks.push('fe')

if (tracks.length === 0) {
  return { mode: 'cook', error: 'Neither BE nor FE affected — nothing to cook', completed: [] }
}

log(`TDD tracks: ${tracks.map(t => t.toUpperCase()).join(' + ')}`)

// Run tracks in pipeline — BE and FE progress independently
const trackResults = await pipeline(
  tracks,
  async (track) => await runTddTrack(track)
)

// Collect results
const beResult = trackResults.find(r => r && r.track === 'be') || null
const feResult = trackResults.find(r => r && r.track === 'fe') || null

const beFailed = beResult && beResult.error
const feFailed = feResult && feResult.error

// ── Return ──
return {
  mode: 'cook',
  completed: tracks.map(t => `TDD-${t.toUpperCase()}`),
  results: {
    be: beResult ? { passed: !beFailed, error: beResult.error, feedback: beResult.feedback } : null,
    fe: feResult ? { passed: !feFailed, error: feResult.error, feedback: feResult.feedback } : null,
  },
  overall: {
    beRan: runBE,
    feRan: runFE,
    bePassed: runBE ? !beFailed : null,
    fePassed: runFE ? !feFailed : null,
    allPassed: (!runBE || !beFailed) && (!runFE || !feFailed),
  }
}

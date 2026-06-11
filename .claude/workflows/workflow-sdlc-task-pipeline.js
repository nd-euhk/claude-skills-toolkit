export const meta = {
  name: 'workflow-sdlc-task-pipeline',
  description: 'Task SDLC Pipeline: SRS→HLD→LLD→IMP+TST with gate verification for new features. Used by sdlc:workflow skill.',
  phases: [
    { title: 'SRS', detail: 'Software requirements specification' },
    { title: 'Gate SRS', detail: 'Verify SRS quality gates' },
    { title: 'HLD', detail: 'High-level architecture design' },
    { title: 'Gate HLD', detail: 'Verify HLD quality gates' },
    { title: 'LLD', detail: 'Low-level technical design' },
    { title: 'Gate LLD', detail: 'Verify LLD quality gates' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications' },
    { title: 'Gate IMP+TST', detail: 'Verify IMP+TST quality gates' },
  ],
}

// ── Args ──
// { taskId, taskTitle, taskDescription, planFile, language?: 'vi'|'en', runDate, slug, fromPhase?: 'SRS'|'HLD'|'LLD'|'IMP+TST' }
// When fromPhase='IMP+TST': SRS, HLD, LLD are force-skipped; IMP and TST are force-run.
const { taskId, taskTitle, taskDescription, planFile, language, fromPhase } = args
const useEnglish = language === 'en'
// Canonical langInstr for DOCUMENTATION pipelines (task, CR, explore).
// Code-generating pipelines (cook) use an extended version — see workflow-sdlc-cook-pipeline.js.
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

// Phase ordering for --from-phase logic
const PHASE_ORDER = ['SRS', 'HLD', 'LLD', 'IMP+TST', 'IMP', 'TST']
function isBeforePhase(phaseName) {
  if (!fromPhase) return false
  const fromIdx = PHASE_ORDER.indexOf(fromPhase)
  if (fromIdx === -1) return false
  // Compound phase 'IMP+TST': phases before LLD are before both IMP and TST
  if (fromPhase === 'IMP+TST' && PHASE_ORDER.indexOf(phaseName) <= PHASE_ORDER.indexOf('LLD')) return true
  return PHASE_ORDER.indexOf(phaseName) < fromIdx
}
function isTargetPhase(phaseName) {
  if (!fromPhase) return false
  // Compound phase 'IMP+TST': targets both IMP and TST individually
  if (fromPhase === 'IMP+TST' && (phaseName === 'IMP' || phaseName === 'TST')) return true
  return fromPhase === phaseName
}

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

// ── Helpers ──
// Canonical source for GATE schema, gateCheck, runWithGate — keep in sync with:
//   workflow-sdlc-cr-pipeline.js, workflow-sdlc-cook-pipeline.js

/** Check which phases have valid output already. Returns { srs, hld, lld, imp, tst } all boolean. */
async function checkPhaseStatus() {
  const result = await agent(
    `Check which SDLC phases have already produced valid output files for task ${taskId}: ${taskTitle}.

Check each phase:
- SRS: docs/product/SRS.md exists and has substantial content (not empty, not just template boilerplate)
- HLD: docs/architecture/system-architecture.md AND agent_docs/domain-service-mapping.yaml exist with substantial content
- LLD: agent_docs/tech-design/README.md exists with substantial content
- IMP: At least one file matching pattern agent_docs/backend/*/implementation/FR-*-impl.md exists
- TST: At least one file matching pattern agent_docs/backend/*/test-specs/FR-*-test.md exists

For each phase, read the file(s) and verify they contain real content (not just headers/templates).
Return { srs: boolean, hld: boolean, lld: boolean, imp: boolean, tst: boolean }`,
    { label: 'phase-status-check', agentType: 'Explore', schema: {
      type: 'object',
      properties: {
        srs: { type: 'boolean' },
        hld: { type: 'boolean' },
        lld: { type: 'boolean' },
        imp: { type: 'boolean' },
        tst: { type: 'boolean' },
      },
      required: ['srs', 'hld', 'lld', 'imp', 'tst']
    }}
  )
  return result || { srs: false, hld: false, lld: false, imp: false, tst: false }
}

/** Spawn gate-verifier agent, return { passed, feedback } */
async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for task ${taskId}: ${taskTitle}. Check against gate criteria for this phase type. Read-only — do not modify any files. Report pass/fail with specific evidence from the output files.`,
    { label: `gate-${phaseName.replace(/\s+/g, '-').toLowerCase()}`, phase: 'Gate', agentType: 'gate-verifier', schema: GATE }
  )
}

/** Run a single phase with gate retry loop. Returns { passed, feedback } */
async function runWithGate(label, agentType, promptFn, gateLabel, maxRetries) {
  maxRetries = maxRetries || 3
  gateLabel = gateLabel || label

  let prompt = typeof promptFn === 'function' ? promptFn() : promptFn
  await agent(prompt, { label, agentType })

  let gate = await gateCheck(gateLabel)

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`${label}: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    let retryPrompt = typeof promptFn === 'function' ? promptFn(gate.feedback, retry + 1) : promptFn
    await agent(retryPrompt, { label: `${label}-r${retry + 1}`, agentType })
    gate = await gateCheck(gateLabel)
  }

  if (!gate.passed) {
    log(`✗ ${label}: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log(`✓ ${label}: PASSED`)
  return { passed: true }
}

// ── Prompt builders ──

function srsPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous SRS rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}
Inputs: Plan file at ${planFile}. Read it for full scope and requirements.
Task: Transform the business requirements from the plan into precise, testable software specifications with Gherkin Scenario Outlines, quantified NFRs, and full traceability matrices.
Output: docs/product/SRS.md and agent_docs/traceability/requirements-matrix.md
Constraints: Output will be gate-verified for completeness, traceability, and testability. Use your default templates.`
}

function hldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous HLD rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. SRS phase complete and gate-verified.
Inputs: SRS at docs/product/SRS.md, Plan at ${planFile}
Task: Design system architecture with C4 diagrams, Architecture Decision Records, bounded context mapping, and service decomposition.
Output: docs/architecture/system-architecture.md, docs/architecture/ADRs/*.md, agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md
Constraints: No implementation details, no code, no per-service internals. Output must reference all SRS requirements. Use your default templates.`
}

function lldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. SRS and HLD complete and gate-verified.
Inputs: HLD at agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md. SRS at docs/product/SRS.md.
Task: Produce per-service technical design with domain models, transaction boundaries, REST client specs, caching strategies, error flows, and feature work packages.
Output: agent_docs/tech-design/README.md, agent_docs/tech-design/{name}-service.md (per service), agent_docs/tech-design/cross-cutting.md, agent_docs/contracts/api-{domain}.yaml, agent_docs/features/FR-*.md
Constraints: Service internals only. No new architectural decisions — follow HLD boundaries. Use your default templates.`
}

function impPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous IMP rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. SRS, HLD, LLD complete and gate-verified.
Inputs: LLD at agent_docs/tech-design/ (all files), agent_docs/features/FR-*.md
Task: Write implementation specifications for each feature covering execution flow, business rules, data impact, error mapping, and security considerations.
Output: agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md
Constraints: Specifications only — no actual code. References LLD work packages. Use your default templates.`
}

function tstPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous TST rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle}. IMP phase running in parallel. SRS, HLD, LLD complete and gate-verified.
Inputs: IMP specs (as they become available), LLD at agent_docs/tech-design/, SRS NFR thresholds from docs/product/SRS.md
Task: Write test specifications with concrete test cases for unit, integration, E2E, and performance testing following TDD-first approach.
Output: agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md
Constraints: Test specifications only — no implementation code. References IMP specs for feature behavior. Use your default templates.`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// Check which phases are already complete (for idempotent re-runs)
const done = await checkPhaseStatus()
const skipped = []
const completed = []

// Helper: decide whether to skip or run a phase
// forceRun > auto-detect > forceSkip
function shouldSkip(phaseName) {
  if (isTargetPhase(phaseName)) return false   // --from-phase target → always run
  if (isBeforePhase(phaseName)) return true     // before --from-phase → force skip
  return done[phaseName.toLowerCase()]          // after target → auto-detect
}
function skipReason(phaseName) {
  if (isBeforePhase(phaseName)) return `--from-phase ${fromPhase} → skipping`
  return 'output already exists — skipping'
}

if (shouldSkip('SRS')) {
  log(`✓ SRS: ${skipReason('SRS')}`)
  skipped.push('SRS')
} else {
  phase('SRS')
  const srsResult = await runWithGate('SRS', 'srs', srsPrompt, 'SRS')
  if (!srsResult.passed) {
    return { mode: 'task', phase: 'SRS', error: 'Gate failed after 3 retries', feedback: srsResult.feedback, skipped, completed, fromPhase }
  }
  completed.push('SRS')
}

if (shouldSkip('HLD')) {
  log(`✓ HLD: ${skipReason('HLD')}`)
  skipped.push('HLD')
} else {
  phase('HLD')
  const hldResult = await runWithGate('HLD', 'hld', hldPrompt, 'HLD')
  if (!hldResult.passed) {
    return { mode: 'task', phase: 'HLD', error: 'Gate failed after 3 retries', feedback: hldResult.feedback, skipped, completed, fromPhase }
  }
  completed.push('HLD')
}

if (shouldSkip('LLD')) {
  log(`✓ LLD: ${skipReason('LLD')}`)
  skipped.push('LLD')
} else {
  phase('LLD')
  const lldResult = await runWithGate('LLD', 'lld', lldPrompt, 'LLD')
  if (!lldResult.passed) {
    return { mode: 'task', phase: 'LLD', error: 'Gate failed after 3 retries', feedback: lldResult.feedback, skipped, completed, fromPhase }
  }
  completed.push('LLD')
}

// ── Phase 4: IMP + TST (parallel, with skip detection) ──
phase('IMP+TST')
const [impResult, tstResult] = await parallel([
  async () => {
    if (shouldSkip('IMP')) {
      log(`✓ IMP: ${skipReason('IMP')}`)
      skipped.push('IMP')
      return { passed: true }
    }
    const r = await runWithGate('IMP', 'imp', impPrompt, 'IMP')
    if (r.passed) completed.push('IMP')
    return r
  },
  async () => {
    if (shouldSkip('TST')) {
      log(`✓ TST: ${skipReason('TST')}`)
      skipped.push('TST')
      return { passed: true }
    }
    const r = await runWithGate('TST', 'tst', tstPrompt, 'TST')
    if (r.passed) completed.push('TST')
    return r
  },
])

const impOk = impResult || { passed: false, feedback: 'agent error' }
const tstOk = tstResult || { passed: false, feedback: 'agent error' }

// ── Return ──
return {
  mode: 'task',
  completed: [...skipped, ...completed],
  skipped,
  ran: completed,
  results: {
    srs: { passed: done.srs || completed.includes('SRS') },
    hld: { passed: done.hld || completed.includes('HLD') },
    lld: { passed: done.lld || completed.includes('LLD') },
    impTst: {
      impPassed: impOk.passed,
      impFeedback: impOk.feedback,
      tstPassed: tstOk.passed,
      tstFeedback: tstOk.feedback,
    },
  }
}

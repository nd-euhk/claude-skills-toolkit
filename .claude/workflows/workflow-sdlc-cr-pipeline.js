export const meta = {
  name: 'workflow-sdlc-cr-pipeline',
  description: 'Change Request SDLC Pipeline: HLD(opt)→LLD(opt)→IMP+TST with gate verification. Used by sdlc:workflow skill.',
  phases: [
    { title: 'HLD', detail: 'Revise architecture (if affected)' },
    { title: 'Gate HLD', detail: 'Verify HLD quality gates' },
    { title: 'LLD', detail: 'Revise technical design (if affected)' },
    { title: 'Gate LLD', detail: 'Verify LLD quality gates' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications' },
    { title: 'Gate IMP+TST', detail: 'Verify IMP+TST quality gates' },
  ],
}

// ── Args ──
// { taskId, taskTitle, taskDescription, planFile, language?: 'vi'|'en', runDate, slug, hldAffected: bool, lldAffected: bool }
const { taskId, taskTitle, taskDescription, planFile, language, hldAffected, lldAffected } = args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

const runHld = hldAffected === true
const runLld = lldAffected === true

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

// ── Helpers ──

async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for change request on task ${taskId}: ${taskTitle}. Check against gate criteria for this phase type. Read-only — do not modify any files. Report pass/fail with specific evidence from the output files.`,
    { label: `gate-${phaseName.replace(/\s+/g, '-').toLowerCase()}`, phase: 'Gate', agentType: 'gate-verifier', schema: GATE }
  )
}

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

function hldCrPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous HLD revision rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Change Request for task ${taskId}: ${taskTitle} — ${taskDescription || ''}. The plan (${planFile}) determined HLD is affected.
Inputs: Plan at ${planFile}, existing HLD at docs/architecture/system-architecture.md, agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md
Task: Revise the HLD artifacts to reflect the change. Create new ADRs if needed for decisions changed. Update C4 diagrams, bounded contexts, and service boundaries. Do NOT touch artifacts that are unaffacted.
Output: Updated HLD files (same paths). New ADRs at docs/architecture/ADRs/*.md if needed.
Constraints: Only modify what the plan identifies as affected. Preserve existing architecture decisions unless explicitly changed. Use your default templates.`
}

function lldCrPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD revision rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Change Request for task ${taskId}: ${taskTitle}. The plan (${planFile}) determined LLD is affected. ${runHld ? 'HLD has been revised and gate-verified.' : 'HLD is not affected — use existing HLD artifacts.'}
Inputs: Plan at ${planFile}, existing LLD at agent_docs/tech-design/, agent_docs/features/. HLD at agent_docs/hard-boundaries.md, agent_docs/contracts/.
Task: Revise the LLD artifacts to reflect the change. Update domain models, API contracts, error flows, caching strategies. Add/modify feature work packages for affected FRs. Create new features files as needed.
Output: Updated LLD files (same paths). New feature files at agent_docs/features/FR-*.md if needed.
Constraints: Only modify what the plan identifies as affected. No new architectural decisions — follow HLD boundaries. Use your default templates.`
}

function impCrPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous IMP rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Change Request for task ${taskId}: ${taskTitle}. ${runLld ? 'LLD revised and gate-verified.' : 'LLD not affected — using existing artifacts.'} ${runHld ? 'HLD revised and gate-verified.' : 'HLD not affected — using existing artifacts.'}
Inputs: LLD at agent_docs/tech-design/, agent_docs/features/FR-*.md. Plan at ${planFile}.
Task: Write implementation specifications for each FR affected by this change request. Cover: execution flow changes, business rules, data impact, error mapping, security considerations.
Output: agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md (new or updated for affected FRs)
Constraints: Specifications only — no actual code. Mark unchanged FRs as "No change — see existing impl spec". Use your default templates.`
}

function tstCrPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous TST rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Change Request for task ${taskId}: ${taskTitle}. IMP phase running in parallel.
Inputs: IMP specs (as they become available), LLD at agent_docs/tech-design/, SRS NFR thresholds from docs/product/SRS.md
Task: Write test specifications for FRs affected by this change. Cover: unit, integration, E2E, and performance tests. Include regression test updates.
Output: agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md (new or updated for affected FRs)
Constraints: Test specifications only — no implementation code. Use your default templates.`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

const completed = []
const results = {}

// ── Phase 1: HLD (conditional) ──
if (runHld) {
  phase('HLD')
  results.hld = await runWithGate('HLD-CR', 'hld', hldCrPrompt, 'HLD-revision')
  if (!results.hld.passed) {
    return { mode: 'cr', phase: 'HLD', error: 'Gate failed after 3 retries', feedback: results.hld.feedback, conditional: { hld: true, lld: runLld }, completed }
  }
  completed.push('HLD')
  log('HLD revision: SKIPPED (not affected by this CR)')
} else {
  log('HLD revision: SKIPPED (not affected by this CR)')
}

// ── Phase 2: LLD (conditional) ──
if (runLld) {
  phase('LLD')
  results.lld = await runWithGate('LLD-CR', 'lld', lldCrPrompt, 'LLD-revision')
  if (!results.lld.passed) {
    return { mode: 'cr', phase: 'LLD', error: 'Gate failed after 3 retries', feedback: results.lld.feedback, conditional: { hld: runHld, lld: true }, completed }
  }
  completed.push('LLD')
  log('LLD revision: SKIPPED (not affected by this CR)')
} else {
  log('LLD revision: SKIPPED (not affected by this CR)')
}

// ── Phase 3: IMP + TST (always, parallel) ──
phase('IMP+TST')
const [impResult, tstResult] = await parallel([
  () => runWithGate('IMP-CR', 'imp', impCrPrompt, 'IMP-CR'),
  () => runWithGate('TST-CR', 'tst', tstCrPrompt, 'TST-CR'),
])

const impOk = impResult || { passed: false, feedback: 'agent error' }
const tstOk = tstResult || { passed: false, feedback: 'agent error' }

completed.push('IMP', 'TST')

// ── Return ──
return {
  mode: 'cr',
  completed,
  conditional: { hld: runHld, lld: runLld },
  results: {
    hld: results.hld || null,
    lld: results.lld || null,
    impTst: {
      impPassed: impOk.passed,
      impFeedback: impOk.feedback,
      tstPassed: tstOk.passed,
      tstFeedback: tstOk.feedback,
    },
  }
}

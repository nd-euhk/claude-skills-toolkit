export const meta = {
  name: 'workflow-auto-imp-tst',
  description: 'Auto IMP+TST Parallel: IMP and TST specialists run in parallel with Agent(Explore) gate verify each. Supports idempotent phase skip for resume. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'IMP+TST', detail: 'Implementation + Test specifications running in parallel' },
    { title: 'Gate', detail: 'Agent(Explore) quality gate verification for both IMP and TST' },
  ],
}

// ── Args (safe parse) ──
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { taskId, taskTitle, taskDescription, language, slug, noGate, brainstormingContext } = _args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

const PHASE_STATUS = {
  type: 'object',
  properties: {
    imp: { type: 'boolean', description: 'IMP output exists and is valid' },
    impFiles: { type: 'string', description: 'Brief summary of IMP output files found' },
    tst: { type: 'boolean', description: 'TST output exists and is valid' },
    tstFiles: { type: 'string', description: 'Brief summary of TST output files found' },
  },
  required: ['imp', 'tst']
}

// ── Idempotent Phase Skip ──

/** One agent checks BOTH IMP and TST outputs — re-run skips completed phases */
async function checkPhaseStatus() {
  if (noGate) {
    log('⊘ Phase status check SKIPPED (--no-gate): both IMP and TST will run fresh')
    return { imp: false, tst: false }
  }

  const result = await agent(
    `Check which phases have already produced valid output for task ${taskId} (${taskTitle}):

IMP — check for substantial content in:
- agent_docs/backend/*/implementation/FR-*-impl.md (any backend implementation specs)
- agent_docs/frontend/*/implementation/FR-*-impl.md (any frontend implementation specs)

TST — check for substantial content in:
- agent_docs/backend/*/test-specs/FR-*-test.md (any backend test specs)
- agent_docs/frontend/*/test-specs/FR-*-test.md (any frontend test specs)
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md

A phase is "done" if at least one output file exists with substantial content (not just a template/placeholder).
Return { imp: boolean, impFiles: brief summary, tst: boolean, tstFiles: brief summary }.
Read-only. Do not modify any files.`,
    { label: 'phase-status-check', agentType: 'Explore', schema: PHASE_STATUS }
  )
  return result || { imp: false, tst: false }
}

// ── Helpers ──

/** IMP gate check using Agent(Explore) with direct verifier prompt */
async function impGateCheck() {
  return agent(
    `Đọc file tiêu chí gate IMP tại .claude/agents/_shared/gate-verifier/gate-verifier-imp.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/backend/{service}/implementation/FR-*-impl.md (tất cả đặc tả triển khai backend)
- agent_docs/frontend/{app}/implementation/FR-*-impl.md (tất cả đặc tả triển khai frontend)

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: IMP

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Độ Phủ Đặc Tả
| FR ID | BE Spec | FE Spec | Kết luận |
|-------|---------|---------|---------|
| FR-... | Có/Không | Có/Không | ĐẠT/THIẾU |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.`,
    { label: 'gate-imp', phase: 'Gate', agentType: 'Explore', schema: GATE }
  )
}

/** TST gate check using Agent(Explore) with direct verifier prompt */
async function tstGateCheck() {
  return agent(
    `Đọc file tiêu chí gate TST tại .claude/agents/_shared/gate-verifier/gate-verifier-tst.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/backend/{service}/test-specs/FR-*-test.md (tất cả đặc tả kiểm thử backend)
- agent_docs/frontend/{app}/test-specs/FR-*-test.md (tất cả đặc tả kiểm thử frontend)
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: TST

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Độ Phủ Kiểm Thử
| FR ID | Test Spec | Risk Level | Unit Tests | API Tests | Kết luận |
|-------|-----------|------------|------------|-----------|---------|
| FR-... | Có/Không | CRITICAL/HIGH/MEDIUM/LOW | N | 200,400,401,403,404,409 | ĐẠT/THIẾU |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.`,
    { label: 'gate-tst', phase: 'Gate', agentType: 'Explore', schema: GATE }
  )
}

/** Run a single auto phase with gate retry */
async function runSingleAutoPhase(label, agentType, promptFn, gateCheckFn, maxRetries) {
  maxRetries = maxRetries || 3

  log(`▶ ${label} specialist starting...`)
  let prompt = typeof promptFn === 'function' ? promptFn() : promptFn
  const specialistResult = await agent(prompt, { label, agentType })
  if (!specialistResult) {
    log(`✗ ${label}: specialist agent was skipped or errored`)
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log(`✓ ${label} specialist completed, starting gate verification...`)

  if (noGate) {
    log(`⊘ ${label}: gate verification SKIPPED (--no-gate)`)
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheckFn()
  if (!gate) {
    log(`✗ ${label}: gate check agent was skipped or errored`)
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`${label}: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    let retryPrompt = typeof promptFn === 'function' ? promptFn(gate.feedback, retry + 1) : promptFn
    const retryResult = await agent(retryPrompt, { label: `${label}-r${retry + 1}`, agentType })
    if (!retryResult) {
      log(`✗ ${label}: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheckFn()
    if (!gate) {
      log(`✗ ${label}: gate check agent was skipped or errored`)
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ ${label}: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log(`✓ ${label}: PASSED`)
  return { passed: true }
}

// ── Prompt builders ──

function impPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous IMP rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (from calling skill):\n${brainstormingContext}\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}. SRS, HLD, LLD complete and gate-verified.${context}
Inputs:
- LLD: agent_docs/tech-design/ (all files), agent_docs/features/FR-*.md
- API contracts: agent_docs/contracts/api-{domain}.yaml
- Hard boundaries: agent_docs/hard-boundaries.md
Task: Write implementation specifications for each feature covering execution flow, business rules, data impact, error mapping, and security considerations.
Output:
- agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md (10 sections each)
- agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}-impl.md (10 sections each)
Constraints: Specifications only — no actual code. One spec per FR. Every spec must have all 10 sections filled. Error mapping must cover: validation error, not-found, unauthorized, internal error. Use your default templates.`
}

function tstPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous TST rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (from calling skill):\n${brainstormingContext}\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}. SRS, HLD, LLD complete and gate-verified. IMP phase running in parallel.${context}
Inputs:
- IMP specs (as they become available)
- LLD: agent_docs/tech-design/ (transaction boundaries, circuit breakers, error flows)
- SRS NFR thresholds from docs/product/SRS.md
Task: Write test specifications with concrete test cases for unit, integration, E2E, and performance testing following TDD-first approach.
Output:
- agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md (per FR)
- agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}-test.md (per FR)
- agent_docs/performance/nfr-mapping.md, agent_docs/performance/baseline.md
Constraints: Test specifications only — no implementation code. Each section must have risk level marked. API tests must cover 200,400,401,403,404,409. Every quantified NFR must have performance test. Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN — IMP and TST run in PARALLEL with idempotent phase skip
// ═══════════════════════════════════════════

const done = await checkPhaseStatus()
const skipped = []
const ran = []

// Determine what to run
const runImp = !done.imp
const runTst = !done.tst

if (!runImp && !runTst) {
  log('✓ IMP: output already exists — skipping')
  log('✓ TST: output already exists — skipping')
  return {
    phase: 'IMP+TST',
    impPassed: true,
    impGateSkipped: false,
    impSkipped: true,
    impOutputFiles: done.impFiles || 'existing output',
    tstPassed: true,
    tstGateSkipped: false,
    tstSkipped: true,
    tstOutputFiles: done.tstFiles || 'existing output',
    skipped: ['IMP', 'TST'],
    ran: [],
  }
}

if (runImp) { ran.push('IMP') } else { skipped.push('IMP'); log(`✓ IMP: output already exists — skipping (${done.impFiles})`) }
if (runTst) { ran.push('TST') } else { skipped.push('TST'); log(`✓ TST: output already exists — skipping (${done.tstFiles})`) }

phase('IMP+TST')

// Build parallel thunks — only run phases that need running
const thunks = []
if (runImp) {
  thunks.push(async () => {
    const r = await runSingleAutoPhase('IMP', 'imp', impPrompt, impGateCheck)
    return r || { passed: false, feedback: 'agent error' }
  })
}
if (runTst) {
  thunks.push(async () => {
    const r = await runSingleAutoPhase('TST', 'tst', tstPrompt, tstGateCheck)
    return r || { passed: false, feedback: 'agent error' }
  })
}

const parallelResults = thunks.length > 0 ? await parallel(thunks) : []

// Map results back — if a phase was skipped, its result is already known good
let impResult = runImp ? parallelResults[runTst ? 0 : 0] : { passed: true, skipped: true }
let tstResult = runTst ? parallelResults[runImp ? 1 : 0] : { passed: true, skipped: true }

// Handle case where only one ran and the array index mapping
if (runImp && !runTst) { impResult = parallelResults[0] }
if (!runImp && runTst) { tstResult = parallelResults[0] }

return {
  phase: 'IMP+TST',
  impPassed: impResult ? impResult.passed : false,
  impFeedback: impResult ? impResult.feedback : undefined,
  impGateSkipped: noGate || (impResult && impResult.gateSkipped) || !runImp || false,
  impSkipped: !runImp,
  tstPassed: tstResult ? tstResult.passed : false,
  tstFeedback: tstResult ? tstResult.feedback : undefined,
  tstGateSkipped: noGate || (tstResult && tstResult.gateSkipped) || !runTst || false,
  tstSkipped: !runTst,
  skipped,
  ran,
}

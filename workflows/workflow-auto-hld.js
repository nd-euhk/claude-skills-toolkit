export const meta = {
  name: 'workflow-auto-hld',
  description: 'Auto HLD: phase-hld-specialist → Agent(Explore) gate verify → retry. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'HLD', detail: 'High-level architecture design by phase-hld-specialist' },
    { title: 'Gate', detail: 'Agent(Explore) quality gate verification' },
  ],
}

// ── Args (safe parse) ──
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { taskId, taskTitle, taskDescription, planFile, language, slug, noGate, brainstormingContext } = _args
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

// ── Helpers ──

/** Gate check using Agent(Explore) with direct verifier prompt — NOT gate-verifier agent */
async function gateCheck() {
  return agent(
    `Đọc file tiêu chí gate HLD tại .claude/agents/_shared/gate-verifier/gate-verifier-hld.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/* (tất cả file ADR)
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md
- docs/architecture/diagrams/*

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: HLD

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra ADR
| ADR | Kết luận | Vấn đề |
|-----|---------|-------|
| ADR-001.md | ĐẠT/KHÔNG ĐẠT | Thiếu phần "rationale" / phần "consequences" trống |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.`,
    { label: 'gate-hld', phase: 'Gate', agentType: 'Explore', schema: GATE }
  )
}

/** Run HLD phase with gate retry loop */
async function runAutoPhase(maxRetries) {
  maxRetries = maxRetries || 3

  log('▶ HLD specialist starting...')
  const specialistResult = await agent(hldPrompt(), { label: 'HLD', agentType: 'hld' })
  if (!specialistResult) {
    log('✗ HLD: specialist agent was skipped or errored')
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log('✓ HLD specialist completed, starting gate verification...')

  if (noGate) {
    log('⊘ HLD: gate verification SKIPPED (--no-gate)')
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheck()
  if (!gate) {
    log('✗ HLD: gate check agent was skipped or errored')
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`HLD: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    const retryResult = await agent(hldPrompt(gate.feedback, retry + 1), { label: `HLD-r${retry + 1}`, agentType: 'hld' })
    if (!retryResult) {
      log(`✗ HLD: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheck()
    if (!gate) {
      log('✗ HLD: gate check agent was skipped or errored')
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ HLD: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log('✓ HLD: PASSED')
  return { passed: true }
}

// ── Prompt builders ──

function hldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous HLD rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (from calling skill):\n${brainstormingContext}\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}. SRS phase complete and gate-verified.${context}
Inputs: SRS at docs/product/SRS.md, Plan at ${planFile}
Task: Design system architecture with C4 diagrams, Architecture Decision Records, bounded context mapping, and service decomposition.
Output:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/ADR-001.md, ADR-002.md, ADR-003.md (minimum) + additional ADRs
- docs/architecture/diagrams/system-context.mermaid, container-diagram.mermaid, data-flow.mermaid
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md
Constraints: Architecture only — no implementation details, no code, no per-service internals (that belongs to LLD). Every FR must be mappable to exactly one service via domain-service-mapping.yaml. Hard boundaries must explicitly list data ownership and forbidden shortcuts. Output must reference all SRS requirements. Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

phase('HLD')
const result = await runAutoPhase()

return {
  phase: 'HLD',
  passed: result.passed,
  gateSkipped: noGate || result.gateSkipped || false,
  gateResult: result,
}

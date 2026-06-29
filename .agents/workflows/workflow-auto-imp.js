export const meta = {
  name: 'workflow-auto-imp',
  description: 'Auto IMP: phase-imp-specialist → Agent(Explore) gate verify → retry. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'IMP', detail: 'Implementation specifications by phase-imp-specialist' },
    { title: 'Gate', detail: 'Agent(Explore) quality gate verification' },
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

// ── Helpers ──

/** Gate check using Agent(Explore) with direct verifier prompt — NOT gate-verifier agent */
async function gateCheck() {
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

/** Run IMP phase with gate retry loop */
async function runAutoPhase(maxRetries) {
  maxRetries = maxRetries || 3

  log('▶ IMP specialist starting...')
  const specialistResult = await agent(impPrompt(), { label: 'IMP', agentType: 'imp' })
  if (!specialistResult) {
    log('✗ IMP: specialist agent was skipped or errored')
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log('✓ IMP specialist completed, starting gate verification...')

  if (noGate) {
    log('⊘ IMP: gate verification SKIPPED (--no-gate)')
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheck()
  if (!gate) {
    log('✗ IMP: gate check agent was skipped or errored')
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`IMP: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    const retryResult = await agent(impPrompt(gate.feedback, retry + 1), { label: `IMP-r${retry + 1}`, agentType: 'imp' })
    if (!retryResult) {
      log(`✗ IMP: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheck()
    if (!gate) {
      log('✗ IMP: gate check agent was skipped or errored')
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ IMP: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log('✓ IMP: PASSED')
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
Task: Write implementation specifications for each feature covering execution flow, business rules, data impact, error mapping, and security considerations. Determine BE vs FE from work package routing overlays.
Output:
- agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md (10 sections each)
- agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}-impl.md (10 sections each)
Constraints: Specifications only — no actual code. One spec per FR. Every spec must have all 10 sections filled (no "TBD"). Execution flows must name specific layers/modules (not vague). Error mapping must cover at least: validation error, not-found, unauthorized, internal error. Business rules must use WHEN/THEN format and trace to Gherkin scenarios. Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

phase('IMP')
const result = await runAutoPhase()

return {
  phase: 'IMP',
  passed: result.passed,
  gateSkipped: noGate || result.gateSkipped || false,
  gateResult: result,
}

export const meta = {
  name: 'workflow-auto-srs',
  description: 'Auto SRS: phase-srs-specialist → Agent(Explore) gate verify → retry. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'SRS', detail: 'Software requirements specification by phase-srs-specialist' },
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
    `Đọc file tiêu chí gate SRS tại .claude/agents/_shared/gate-verifier/gate-verifier-srs.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- docs/product/SRS.md
- docs/product/features/*/FR-*.md (tất cả file FR)
- agent_docs/traceability/requirements-matrix.md

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: SRS

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Độ Chi Tiết FR
| File FR | Kết luận | Vấn đề |
|---------|---------|-------|
| FR-...md | QUÁ THÔ | "Xác thực" — tách thành Đăng nhập, Đăng ký, Đặt lại mật khẩu |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.`,
    { label: 'gate-srs', phase: 'Gate', agentType: 'Explore', schema: GATE }
  )
}

/** Run SRS phase with gate retry loop */
async function runAutoPhase(maxRetries) {
  maxRetries = maxRetries || 3

  log('▶ SRS specialist starting...')
  const specialistResult = await agent(srsPrompt(), { label: 'SRS', agentType: 'srs' })
  if (!specialistResult) {
    log('✗ SRS: specialist agent was skipped or errored')
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log('✓ SRS specialist completed, starting gate verification...')

  if (noGate) {
    log('⊘ SRS: gate verification SKIPPED (--no-gate)')
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheck()
  if (!gate) {
    log('✗ SRS: gate check agent was skipped or errored')
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`SRS: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    const retryResult = await agent(srsPrompt(gate.feedback, retry + 1), { label: `SRS-r${retry + 1}`, agentType: 'srs' })
    if (!retryResult) {
      log(`✗ SRS: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheck()
    if (!gate) {
      log('✗ SRS: gate check agent was skipped or errored')
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ SRS: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log('✓ SRS: PASSED')
  return { passed: true }
}

// ── Prompt builders ──

function srsPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous SRS rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (from calling skill):\n${brainstormingContext}\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}${context}
Inputs: Plan file at ${planFile}. Read it for full scope and requirements.
Task: Transform the business requirements from the plan into precise, testable software specifications with Gherkin Scenario Outlines, quantified NFRs, and full traceability matrices.
Output:
- docs/product/SRS.md
- docs/product/features/{epic-slug}/FR-{epic}-{NNN}--{slug}.md (one per functional requirement)
- agent_docs/traceability/requirements-matrix.md
Constraints: WHAT the system does, not HOW. No architecture decisions, no service names, no API paths, no database schemas. Every FR must have >=1 Gherkin Scenario Outline with Examples. All NFRs must be quantified with measurable thresholds. Output will be gate-verified for completeness, traceability, and testability. Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

phase('SRS')
const result = await runAutoPhase()

return {
  phase: 'SRS',
  passed: result.passed,
  gateSkipped: noGate || result.gateSkipped || false,
  gateResult: result,
}

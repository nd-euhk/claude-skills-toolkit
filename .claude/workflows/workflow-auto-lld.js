export const meta = {
  name: 'workflow-auto-lld',
  description: 'Auto LLD: phase-lld-specialist → Agent(Explore) gate verify → retry. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'LLD', detail: 'Low-level technical design by phase-lld-specialist' },
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
    `Đọc file tiêu chí gate LLD tại .claude/agents/_shared/gate-verifier/gate-verifier-lld.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/tech-design/README.md
- agent_docs/tech-design/{name}-service.md (tất cả dịch vụ)
- agent_docs/tech-design/cross-cutting.md
- agent_docs/contracts/api-{domain}.yaml (tất cả API)
- docs/product/features/*/FR-*.md (tất cả gói công việc)

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: LLD

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Tech Design Từng Dịch Vụ
| Dịch vụ | Kết luận | Phần thiếu |
|---------|---------|-----------|
| {tên-dịch-vụ} | ĐẠT/KHÔNG ĐẠT | Thiếu phần 5 (Transaction Boundaries) / phần 9 (Error Flows) trống |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.`,
    { label: 'gate-lld', phase: 'Gate', agentType: 'Explore', schema: GATE }
  )
}

/** Run LLD phase with gate retry loop */
async function runAutoPhase(maxRetries) {
  maxRetries = maxRetries || 3

  log('▶ LLD specialist starting...')
  const specialistResult = await agent(lldPrompt(), { label: 'LLD', agentType: 'lld' })
  if (!specialistResult) {
    log('✗ LLD: specialist agent was skipped or errored')
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log('✓ LLD specialist completed, starting gate verification...')

  if (noGate) {
    log('⊘ LLD: gate verification SKIPPED (--no-gate)')
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheck()
  if (!gate) {
    log('✗ LLD: gate check agent was skipped or errored')
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`LLD: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    const retryResult = await agent(lldPrompt(gate.feedback, retry + 1), { label: `LLD-r${retry + 1}`, agentType: 'lld' })
    if (!retryResult) {
      log(`✗ LLD: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheck()
    if (!gate) {
      log('✗ LLD: gate check agent was skipped or errored')
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ LLD: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log('✓ LLD: PASSED')
  return { passed: true }
}

// ── Prompt builders ──

function lldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD rejected by gate. Feedback: ${feedback}\nFix these specific issues before re-submitting. Do not change anything that was not flagged.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (from calling skill):\n${brainstormingContext}\n`
    : ''
  return `${prefix}${langInstr}
Context: Task ${taskId}: ${taskTitle} — ${taskDescription || 'No additional description provided.'}. SRS and HLD complete and gate-verified.${context}
Inputs:
- HLD: agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md
- SRS: docs/product/SRS.md
Task: Produce per-service technical design with domain models, transaction boundaries, REST client specs with circuit breakers, caching strategies, error flows, degraded modes, and feature work packages with routing overlays.
Output:
- agent_docs/tech-design/README.md
- agent_docs/tech-design/{name}-service.md (per service, 9 sections each)
- agent_docs/tech-design/cross-cutting.md
- agent_docs/contracts/api-{domain}.yaml (OpenAPI 3.0 per service)
- docs/product/features/*/FR-*.md (enriched with routing overlays)
Constraints: Service internals only — no new architectural decisions (those belong in HLD ADRs). Follow HLD service boundaries. Each service must have all 9 sections filled. Every REST client must have circuit breaker config. Every cross-service integration must have fallback/degraded mode defined. Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

phase('LLD')
const result = await runAutoPhase()

return {
  phase: 'LLD',
  passed: result.passed,
  gateSkipped: noGate || result.gateSkipped || false,
  gateResult: result,
}

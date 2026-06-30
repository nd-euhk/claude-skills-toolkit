export const meta = {
  name: 'workflow-auto-tst',
  description: 'Auto TST: phase-tst-specialist → Agent(Explore) gate verify → retry. Used by sdlc-phase-auto skill.',
  phases: [
    { title: 'TST', detail: 'Test specifications by phase-tst-specialist' },
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

/** Run TST phase with gate retry loop */
async function runAutoPhase(maxRetries) {
  maxRetries = maxRetries || 3

  log('▶ TST specialist starting...')
  const specialistResult = await agent(tstPrompt(), { label: 'TST', agentType: 'tst' })
  if (!specialistResult) {
    log('✗ TST: specialist agent was skipped or errored')
    return { passed: false, feedback: 'Specialist agent did not complete' }
  }
  log('✓ TST specialist completed, starting gate verification...')

  if (noGate) {
    log('⊘ TST: gate verification SKIPPED (--no-gate)')
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheck()
  if (!gate) {
    log('✗ TST: gate check agent was skipped or errored')
    return { passed: false, feedback: 'Gate verification agent did not complete' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`TST: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    const retryResult = await agent(tstPrompt(gate.feedback, retry + 1), { label: `TST-r${retry + 1}`, agentType: 'tst' })
    if (!retryResult) {
      log(`✗ TST: retry specialist agent was skipped or errored (attempt ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent did not complete (attempt ${retry + 1})` }
    }
    gate = await gateCheck()
    if (!gate) {
      log('✗ TST: gate check agent was skipped or errored')
      return { passed: false, feedback: 'Gate verification agent did not complete' }
    }
  }

  if (!gate.passed) {
    log(`✗ TST: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log('✓ TST: PASSED')
  return { passed: true }
}

// ── Prompt builders ──

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
- IMP specs: agent_docs/backend/{service}/implementation/FR-*-impl.md, agent_docs/frontend/{app}/implementation/FR-*-impl.md (as they become available)
- LLD: agent_docs/tech-design/ (transaction boundaries, circuit breakers, error flows)
- SRS: docs/product/SRS.md (NFR thresholds)
Task: Write test specifications with concrete test cases for unit, integration, E2E, and performance testing following TDD-first approach.
Output:
- agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md (per FR)
- agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}-test.md (per FR)
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md
Constraints: Test specifications only — no implementation code. Each section must have risk level marked [CRITICAL]/[HIGH]/[MEDIUM]/[LOW]. Unit tests must cover every WHEN/THEN business rule from impl spec. API tests must cover 200, 400, 401, 403, 404, 409 for every endpoint. Boundary value analysis applied to all numeric/date/range inputs. Circuit breaker tests for every REST client. Every quantified NFR must have corresponding performance test. Test data/fixtures must have concrete values (not placeholders). Use your default templates.`
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

phase('TST')
const result = await runAutoPhase()

return {
  phase: 'TST',
  passed: result.passed,
  gateSkipped: noGate || result.gateSkipped || false,
  gateResult: result,
}

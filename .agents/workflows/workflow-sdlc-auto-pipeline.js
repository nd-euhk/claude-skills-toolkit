export const meta = {
  name: 'workflow-sdlc-auto-pipeline',
  description: 'SDLC Auto Pipeline: SRS → Gate → HLD → Gate → LLD → Gate → IMP+TST(parallel) → Gate → Summary Report',
  phases: [
    { title: 'Preflight', detail: 'Kiểm tra phase outputs hiện có, bỏ qua phase đã hoàn thành' },
    { title: 'SRS', detail: 'Đặc tả yêu cầu phần mềm' },
    { title: 'Gate', detail: 'Xác minh chất lượng' },
    { title: 'HLD', detail: 'Thiết kế High Level Design' },
    { title: 'LLD', detail: 'Thiết kế Low Level Design' },
    { title: 'IMP+TST', detail: 'Đặc tả triển khai + kiểm thử song song' },
    { title: 'Report', detail: 'Tổng hợp báo cáo' },
  ],
}

// ── Args (safe parse: handles both object and JSON-string) ──
// {
//   taskId, taskTitle, taskDescription, planFile, slug, runDate,
//   noGate?: boolean,                         // bỏ qua tất cả gate check
//   phases?: ['srs'|'hld'|'lld'|'imp'|'tst'], // chỉ chạy các phase được chỉ định, mặc định all
//   brainstormingContext?: string,            // context từ skill gọi (sdlc-phase-auto)
// }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { taskId, taskTitle, taskDescription, planFile, slug, noGate, brainstormingContext } = _args

// ── Xác định phases cần chạy ──
const ALL_PHASES = ['srs', 'hld', 'lld', 'imp', 'tst']
const requestedPhases = _args.phases
  ? (Array.isArray(_args.phases) ? _args.phases : [_args.phases])
  : ALL_PHASES
// Chuẩn hóa về lowercase
const phases = requestedPhases.map(p => p.toLowerCase()).filter(p => ALL_PHASES.includes(p))
if (phases.length === 0) {
  log('⚠ Không có phase hợp lệ nào được chỉ định. Sử dụng tất cả phases.')
  phases.push(...ALL_PHASES)
}
const runSrs = phases.includes('srs')
const runHld = phases.includes('hld')
const runLld = phases.includes('lld')
const runImp = phases.includes('imp')
const runTst = phases.includes('tst')

// ── Ngày chạy ──
const runDate = _args.runDate || new Date().toISOString().split('T')[0].replace(/-/g, '')
const effectiveSlug = slug || taskId || 'unknown'

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

const PHASE_STATUS = {
  type: 'object',
  properties: {
    srs: { type: 'boolean' },
    hld: { type: 'boolean' },
    lld: { type: 'boolean' },
    imp: { type: 'boolean' },
    tst: { type: 'boolean' },
  },
  required: ['srs', 'hld', 'lld', 'imp', 'tst']
}

// ── Helpers ──

/** Kiểm tra phase nào đã có output hợp lệ */
async function checkPhaseStatus() {
  if (noGate) {
    log('⊘ Kiểm tra phase status BỎ QUA (--no-gate): tất cả phase sẽ chạy mới')
    return { srs: false, hld: false, lld: false, imp: false, tst: false }
  }

  const result = await agent(
    `Kiểm tra những phase SDLC nào đã tạo output hợp lệ cho task ${taskId}: ${taskTitle}.

Kiểm tra từng phase:
- SRS: docs/product/SRS.md tồn tại và có nội dung thực chất (không rỗng, không chỉ là template)
- HLD: docs/architecture/system-architecture.md VÀ agent_docs/domain-service-mapping.yaml tồn tại với nội dung thực chất
- LLD: agent_docs/tech-design/README.md tồn tại với nội dung thực chất
- IMP: Có ít nhất một file khớp pattern agent_docs/backend/*/implementation/FR-*-impl.md hoặc agent_docs/frontend/*/implementation/FR-*-impl.md
- TST: Có ít nhất một file khớp pattern agent_docs/backend/*/test-specs/FR-*-test.md hoặc agent_docs/frontend/*/test-specs/FR-*-test.md

Với mỗi phase, đọc file và xác minh có nội dung thực (không chỉ headers/templates).
Trả về { srs: boolean, hld: boolean, lld: boolean, imp: boolean, tst: boolean }`,
    { label: 'phase-status-check', agentType: 'Explore', schema: PHASE_STATUS }
  )
  return result || { srs: false, hld: false, lld: false, imp: false, tst: false }
}

// ── Gate check functions (mỗi phase một hàm riêng, dùng Agent(Explore)) ──

async function srsGateCheck() {
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

async function hldGateCheck() {
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

async function lldGateCheck() {
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

// ── Chạy một phase đơn với gate retry loop ──
// Dùng chung cho SRS, HLD, LLD, IMP, TST
async function runAutoPhase(label, agentType, promptFn, gateCheckFn, maxRetries) {
  maxRetries = maxRetries || 3

  log(`▶ ${label} specialist đang chạy...`)
  let prompt = typeof promptFn === 'function' ? promptFn() : promptFn
  const specialistResult = await agent(prompt, { label, agentType })
  if (!specialistResult) {
    log(`✗ ${label}: specialist agent bị bỏ qua hoặc lỗi`)
    return { passed: false, feedback: 'Specialist agent không hoàn thành' }
  }
  log(`✓ ${label} specialist hoàn thành, đang xác minh gate...`)

  if (noGate) {
    log(`⊘ ${label}: gate verification BỎ QUA (--no-gate)`)
    return { passed: true, gateSkipped: true }
  }

  let gate = await gateCheckFn()
  if (!gate) {
    log(`✗ ${label}: gate check agent bị bỏ qua hoặc lỗi`)
    return { passed: false, feedback: 'Gate verification agent không hoàn thành' }
  }

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`${label}: gate từ chối (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    let retryPrompt = typeof promptFn === 'function' ? promptFn(gate.feedback, retry + 1) : promptFn
    const retryResult = await agent(retryPrompt, { label: `${label}-r${retry + 1}`, agentType })
    if (!retryResult) {
      log(`✗ ${label}: retry specialist agent bị bỏ qua hoặc lỗi (lần ${retry + 1})`)
      return { passed: false, feedback: `Retry specialist agent không hoàn thành (lần ${retry + 1})` }
    }
    gate = await gateCheckFn()
    if (!gate) {
      log(`✗ ${label}: gate check agent bị bỏ qua hoặc lỗi`)
      return { passed: false, feedback: 'Gate verification agent không hoàn thành' }
    }
  }

  if (!gate.passed) {
    log(`✗ ${label}: THẤT BẠI sau ${maxRetries} lần thử`)
    return { passed: false, feedback: gate.feedback }
  }

  log(`✓ ${label}: ĐẠT`)
  return { passed: true }
}

// ── Prompt builders (100% tiếng Việt) ──

function srsPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `THỬ LẠI #${retryNum}: SRS trước bị gate từ chối. Phản hồi: ${feedback}\nSửa chính xác những vấn đề này trước khi nộp lại. Không thay đổi những gì không bị gắn cờ.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (từ skill gọi):\n${brainstormingContext}\n`
    : ''
  return `${prefix}Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.

Bối cảnh: Task ${taskId}: ${taskTitle} — ${taskDescription || 'Không có mô tả bổ sung.'}${context}
Đầu vào: File kế hoạch tại ${planFile}. Đọc nó để biết phạm vi và yêu cầu đầy đủ.
Nhiệm vụ: Chuyển đổi yêu cầu nghiệp vụ từ kế hoạch thành đặc tả phần mềm chính xác, có thể kiểm thử với Gherkin Scenario Outlines, NFR định lượng, và ma trận truy xuất nguồn gốc đầy đủ.
Đầu ra:
- docs/product/SRS.md
- docs/product/features/{epic-slug}/FR-{epic}-{NNN}--{slug}.md (mỗi yêu cầu chức năng một file)
- agent_docs/traceability/requirements-matrix.md
Ràng buộc: Mô tả hệ thống LÀM GÌ, không phải LÀM THẾ NÀO. Không quyết định kiến trúc, không tên dịch vụ, không đường dẫn API, không schema cơ sở dữ liệu. Mỗi FR phải có >=1 Gherkin Scenario Outline với Examples. Tất cả NFR phải được định lượng với ngưỡng đo được. Output sẽ được gate-verify về tính đầy đủ, truy xuất nguồn gốc, và khả năng kiểm thử. Sử dụng template mặc định của bạn.`
}

function hldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `THỬ LẠI #${retryNum}: HLD trước bị gate từ chối. Phản hồi: ${feedback}\nSửa chính xác những vấn đề này trước khi nộp lại. Không thay đổi những gì không bị gắn cờ.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (từ skill gọi):\n${brainstormingContext}\n`
    : ''
  return `${prefix}Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.

Bối cảnh: Task ${taskId}: ${taskTitle} — ${taskDescription || 'Không có mô tả bổ sung.'}. Phase SRS đã hoàn thành và gate-verified.${context}
Đầu vào: SRS tại docs/product/SRS.md, Kế hoạch tại ${planFile}
Nhiệm vụ: Thiết kế kiến trúc hệ thống với C4 diagrams, Architecture Decision Records, bounded context mapping, và phân rã dịch vụ.
Đầu ra:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/ADR-001.md, ADR-002.md, ADR-003.md (tối thiểu) + các ADR bổ sung
- docs/architecture/diagrams/system-context.mermaid, container-diagram.mermaid, data-flow.mermaid
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md
Ràng buộc: Chỉ kiến trúc — không chi tiết triển khai, không code, không nội bộ từng dịch vụ (việc đó thuộc LLD). Mỗi FR phải ánh xạ được đến chính xác một dịch vụ qua domain-service-mapping.yaml. Hard boundaries phải liệt kê rõ ràng data ownership và forbidden shortcuts. Output phải tham chiếu tất cả yêu cầu SRS. Sử dụng template mặc định của bạn.`
}

function lldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `THỬ LẠI #${retryNum}: LLD trước bị gate từ chối. Phản hồi: ${feedback}\nSửa chính xác những vấn đề này trước khi nộp lại. Không thay đổi những gì không bị gắn cờ.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (từ skill gọi):\n${brainstormingContext}\n`
    : ''
  return `${prefix}Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.

Bối cảnh: Task ${taskId}: ${taskTitle} — ${taskDescription || 'Không có mô tả bổ sung.'}. SRS và HLD đã hoàn thành và gate-verified.${context}
Đầu vào:
- HLD: agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md
- SRS: docs/product/SRS.md
Nhiệm vụ: Tạo thiết kế kỹ thuật cho từng dịch vụ với domain models, transaction boundaries, REST client specs với circuit breakers, caching strategies, error flows, degraded modes, và feature work packages với routing overlays.
Đầu ra:
- agent_docs/tech-design/README.md
- agent_docs/tech-design/{name}-service.md (mỗi dịch vụ, 9 sections)
- agent_docs/tech-design/cross-cutting.md
- agent_docs/contracts/api-{domain}.yaml (OpenAPI 3.0 mỗi dịch vụ)
- docs/product/features/*/FR-*.md (đã enrich với routing overlays)
Ràng buộc: Chỉ nội bộ dịch vụ — không quyết định kiến trúc mới (việc đó thuộc HLD ADRs). Tuân theo ranh giới dịch vụ HLD. Mỗi dịch vụ phải có đầy đủ 9 sections. Mỗi REST client phải có cấu hình circuit breaker. Mỗi tích hợp cross-service phải có fallback/degraded mode. Sử dụng template mặc định của bạn.`
}

function impPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `THỬ LẠI #${retryNum}: IMP trước bị gate từ chối. Phản hồi: ${feedback}\nSửa chính xác những vấn đề này trước khi nộp lại. Không thay đổi những gì không bị gắn cờ.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (từ skill gọi):\n${brainstormingContext}\n`
    : ''
  return `${prefix}Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.

Bối cảnh: Task ${taskId}: ${taskTitle} — ${taskDescription || 'Không có mô tả bổ sung.'}. SRS, HLD, LLD đã hoàn thành và gate-verified.${context}
Đầu vào:
- LLD: agent_docs/tech-design/ (tất cả file), agent_docs/features/FR-*.md
- API contracts: agent_docs/contracts/api-{domain}.yaml
- Hard boundaries: agent_docs/hard-boundaries.md
Nhiệm vụ: Viết đặc tả triển khai cho từng tính năng bao gồm execution flow, business rules, data impact, error mapping, và security considerations. Xác định BE vs FE từ work package routing overlays.
Đầu ra:
- agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md (mỗi FR, 10 sections)
- agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}-impl.md (mỗi FR, 10 sections)
Ràng buộc: Chỉ đặc tả — không viết code. Một spec cho mỗi FR. Mỗi spec phải có đầy đủ 10 sections (không "TBD"). Execution flows phải gọi tên layer/module cụ thể (không mơ hồ). Error mapping phải bao phủ ít nhất: validation error, not-found, unauthorized, internal error. Business rules phải dùng định dạng WHEN/THEN và truy xuất đến Gherkin scenarios. Sử dụng template mặc định của bạn.`
}

function tstPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `THỬ LẠI #${retryNum}: TST trước bị gate từ chối. Phản hồi: ${feedback}\nSửa chính xác những vấn đề này trước khi nộp lại. Không thay đổi những gì không bị gắn cờ.\n\n`
    : ''
  const context = brainstormingContext
    ? `\nBRAINSTORMING CONTEXT (từ skill gọi):\n${brainstormingContext}\n`
    : ''
  return `${prefix}Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics). Ví dụ: "được" không phải "duoc", "không" không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.

Bối cảnh: Task ${taskId}: ${taskTitle} — ${taskDescription || 'Không có mô tả bổ sung.'}. SRS, HLD, LLD đã hoàn thành và gate-verified. Phase IMP đang chạy song song.${context}
Đầu vào:
- IMP specs: agent_docs/backend/{service}/implementation/FR-*-impl.md, agent_docs/frontend/{app}/implementation/FR-*-impl.md (khi có sẵn)
- LLD: agent_docs/tech-design/ (transaction boundaries, circuit breakers, error flows)
- SRS: docs/product/SRS.md (NFR thresholds)
Nhiệm vụ: Viết đặc tả kiểm thử với test cases cụ thể cho unit, integration, E2E, và performance testing theo phương pháp TDD-first.
Đầu ra:
- agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md (mỗi FR)
- agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}-test.md (mỗi FR)
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md
Ràng buộc: Chỉ đặc tả kiểm thử — không viết code. Mỗi section phải có risk level [CRITICAL]/[HIGH]/[MEDIUM]/[LOW]. Unit tests phải bao phủ mọi WHEN/THEN business rule từ impl spec. API tests phải bao phủ 200, 400, 401, 403, 404, 409 cho mỗi endpoint. Boundary value analysis cho tất cả numeric/date/range inputs. Circuit breaker tests cho mỗi REST client. Mỗi NFR định lượng phải có performance test tương ứng. Test data/fixtures phải có giá trị cụ thể (không placeholder). Sử dụng template mặc định của bạn.`
}

// ═══════════════════════════════════════════
// PIPELINE CHÍNH
// ═══════════════════════════════════════════

// ── Preflight: Kiểm tra phase nào đã hoàn thành (idempotent re-run) ──
phase('Preflight')
const done = await checkPhaseStatus()
const skipped = []
const completed = []
const failed = []

function shouldSkip(phaseName) {
  // Nếu phase không nằm trong danh sách yêu cầu → luôn skip
  if (!phases.includes(phaseName)) return true
  // Nếu output đã tồn tại → skip
  return done[phaseName]
}

function skipReason(phaseName) {
  if (!phases.includes(phaseName)) return 'không có trong phases[] yêu cầu — bỏ qua'
  return 'output đã tồn tại — bỏ qua'
}

// ── Phase 1: SRS ──
if (shouldSkip('srs')) {
  log(`✓ SRS: ${skipReason('srs')}`)
  skipped.push('SRS')
} else {
  phase('SRS')
  const srsResult = await runAutoPhase('SRS', 'phase-srs-specialist', srsPrompt, srsGateCheck)
  if (!srsResult.passed) {
    log('✗ SRS: THẤT BẠI — dừng pipeline')
    failed.push('SRS')
    // Vẫn tiếp tục để tạo báo cáo
  } else {
    completed.push('SRS')
  }
}

// ── Phase 2: HLD (chỉ chạy nếu SRS không thất bại) ──
if (failed.includes('SRS')) {
  log('⊘ HLD: BỊ CHẶN — SRS thất bại')
  skipped.push('HLD')
} else if (shouldSkip('hld')) {
  log(`✓ HLD: ${skipReason('hld')}`)
  skipped.push('HLD')
} else {
  phase('HLD')
  const hldResult = await runAutoPhase('HLD', 'phase-hld-specialist', hldPrompt, hldGateCheck)
  if (!hldResult.passed) {
    log('✗ HLD: THẤT BẠI — dừng pipeline')
    failed.push('HLD')
  } else {
    completed.push('HLD')
  }
}

// ── Phase 3: LLD (chỉ chạy nếu HLD không thất bại) ──
if (failed.includes('HLD')) {
  log('⊘ LLD: BỊ CHẶN — HLD thất bại')
  skipped.push('LLD')
} else if (shouldSkip('lld')) {
  log(`✓ LLD: ${skipReason('lld')}`)
  skipped.push('LLD')
} else {
  phase('LLD')
  const lldResult = await runAutoPhase('LLD', 'phase-lld-specialist', lldPrompt, lldGateCheck)
  if (!lldResult.passed) {
    log('✗ LLD: THẤT BẠI — dừng pipeline')
    failed.push('LLD')
  } else {
    completed.push('LLD')
  }
}

// ── Phase 4: IMP + TST (luôn song song) ──
// Chỉ chạy nếu LLD không thất bại
const blockImpTst = failed.includes('LLD') || (!runImp && !runTst)

if (blockImpTst) {
  if (failed.includes('LLD')) {
    log('⊘ IMP+TST: BỊ CHẶN — LLD thất bại')
  }
  if (!runImp && !runTst) {
    log('⊘ IMP+TST: không có trong phases[] yêu cầu — bỏ qua')
  }
  skipped.push('IMP', 'TST')
} else {
  phase('IMP+TST')

  // Xác định phase nào cần chạy
  const doRunImp = runImp && !shouldSkip('imp')
  const doRunTst = runTst && !shouldSkip('tst')

  if (!doRunImp && !doRunTst) {
    if (shouldSkip('imp')) log(`✓ IMP: ${skipReason('imp')}`)
    if (shouldSkip('tst')) log(`✓ TST: ${skipReason('tst')}`)
    skipped.push('IMP', 'TST')
    completed.push('IMP', 'TST') // coi như đã có sẵn
  } else {
    if (shouldSkip('imp')) { log(`✓ IMP: ${skipReason('imp')}`); skipped.push('IMP') }
    if (shouldSkip('tst')) { log(`✓ TST: ${skipReason('tst')}`); skipped.push('TST') }

    // Build parallel thunks
    const thunks = []
    if (doRunImp) {
      thunks.push(async () => {
        const r = await runAutoPhase('IMP', 'phase-imp-specialist', impPrompt, impGateCheck)
        return { phase: 'IMP', ...(r || { passed: false, feedback: 'agent error' }) }
      })
    }
    if (doRunTst) {
      thunks.push(async () => {
        const r = await runAutoPhase('TST', 'phase-tst-specialist', tstPrompt, tstGateCheck)
        return { phase: 'TST', ...(r || { passed: false, feedback: 'agent error' }) }
      })
    }

    const parallelResults = thunks.length > 0 ? await parallel(thunks) : []

    // Map kết quả về đúng phase
    for (const r of parallelResults) {
      if (!r) continue
      if (r.phase === 'IMP') {
        if (r.passed) completed.push('IMP'); else failed.push('IMP')
      }
      if (r.phase === 'TST') {
        if (r.passed) completed.push('TST'); else failed.push('TST')
      }
    }
  }
}

// ═══════════════════════════════════════════
// PHASE CUỐI: Báo cáo tổng hợp
// ═══════════════════════════════════════════
phase('Report')

const reportFile = `.work/reports/workflow-sdlc-auto-pipeline/workflow-report-${runDate}--${effectiveSlug}.md`

const allPhases = ['SRS', 'HLD', 'LLD', 'IMP', 'TST']
const phaseResults = {}
for (const p of allPhases) {
  const key = p.toLowerCase()
  if (skipped.includes(p)) phaseResults[key] = 'SKIPPED'
  else if (completed.includes(p)) phaseResults[key] = 'PASSED'
  else if (failed.includes(p)) phaseResults[key] = 'FAILED'
  else if (!phases.includes(key)) phaseResults[key] = 'NOT_REQUESTED'
  else phaseResults[key] = 'UNKNOWN'
}

const pipelineStatus = failed.length > 0 ? 'PARTIAL_FAILURE' : (completed.length > 0 ? 'SUCCESS' : 'ALL_SKIPPED')

const summaryResult = await agent(
  `Viết tất cả output bằng tiếng Việt, có dấu đầy đủ (full diacritics).

Bạn là người tổng hợp báo cáo cho pipeline SDLC Auto. Tạo báo cáo tổng kết về kết quả chạy pipeline.

Thông tin pipeline:
- Task: ${taskId} — ${taskTitle}
- Mô tả: ${taskDescription || 'Không có'}
- Ngày chạy: ${runDate}
- Slug: ${effectiveSlug}
- Trạng thái pipeline: ${pipelineStatus}

Kết quả từng phase:
| Phase | Trạng thái |
|-------|-----------|
| SRS   | ${phaseResults.srs} |
| HLD   | ${phaseResults.hld} |
| LLD   | ${phaseResults.lld} |
| IMP   | ${phaseResults.imp} |
| TST   | ${phaseResults.tst} |

Cấu hình:
- Các phase được yêu cầu: ${phases.join(', ')}
- noGate: ${noGate ? 'true' : 'false'}
- Gate bị bỏ qua: ${noGate ? 'TẤT CẢ' : 'không'}

Nhiệm vụ của bạn:
1. Đọc các file output của từng phase đã hoàn thành để hiểu nội dung đã tạo ra
2. Tổng hợp thành báo cáo có cấu trúc, viết vào file: ${reportFile}

Cấu trúc báo cáo:
# Báo Cáo Pipeline SDLC Auto: ${taskTitle}

**Ngày:** ${runDate}
**Task:** ${taskId}
**Trạng thái:** ${pipelineStatus}

## 1. Tổng Quan Pipeline
- Mô tả ngắn về pipeline đã chạy
- Các phase đã thực thi và kết quả
- Cấu hình đã dùng (noGate, phases)

## 2. Kết Quả Từng Phase
### 2.1 SRS — ${phaseResults.srs}
[Tóm tắt những gì SRS đã tạo ra: số lượng FR, NFR chính, phạm vi]

### 2.2 HLD — ${phaseResults.hld}
[Tóm tắt kiến trúc: số lượng dịch vụ, ADR chính, hard boundaries]

### 2.3 LLD — ${phaseResults.lld}
[Tóm tắt thiết kế kỹ thuật: số lượng service designs, API specs, work packages]

### 2.4 IMP — ${phaseResults.imp}
[Tóm tắt đặc tả triển khai: số lượng impl specs BE/FE, phạm vi]

### 2.5 TST — ${phaseResults.tst}
[Tóm tắt đặc tả kiểm thử: số lượng test specs BE/FE, performance tests]

## 3. Thống Kê
- Tổng số file được tạo
- Số lượng FR được bao phủ
- Số lượng dịch vụ
- Số lượng test cases

## 4. Các Vấn Đề & Khuyến Nghị
- Phase thất bại và lý do (nếu có)
- Phase bị bỏ qua và lý do
- Khuyến nghị cho bước tiếp theo

Viết báo cáo vào file ${reportFile}. Đảm bảo thư mục .work/reports/workflow-sdlc-auto-pipeline/ tồn tại trước khi viết.`,
  { label: 'summary-report', agentType: 'general-purpose' }
)

log(`📄 Báo cáo đã được tạo: ${reportFile}`)

// ═══════════════════════════════════════════
// RETURN
// ═══════════════════════════════════════════
return {
  mode: 'auto-pipeline',
  status: pipelineStatus,
  runDate,
  slug: effectiveSlug,
  phases: {
    srs: phaseResults.srs,
    hld: phaseResults.hld,
    lld: phaseResults.lld,
    imp: phaseResults.imp,
    tst: phaseResults.tst,
  },
  completed,
  skipped,
  failed,
  noGate: noGate || false,
  requestedPhases: phases,
  reportFile,
}

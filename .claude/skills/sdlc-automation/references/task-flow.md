# Task Automation Flow — Chi Tiết

Quy trình tự động hoá cho flow `task`: grill MỘT lần → dispatch workflow → monitor.
Dành cho feature mới, greenfield work, hoặc major change với requirements rõ ràng.

---

## Giai đoạn 1: Grilling Toàn Diện (MỘT lần duy nhất)

Đây là **lần duy nhất** tương tác với human. Phải cover đủ cho toàn bộ pipeline.

**4 rounds, hỏi tuần tự** — mỗi lần một câu, đợi trả lời rồi hỏi tiếp:

| Round | Nội dung | Cho phase |
|-------|----------|-----------|
| 1. Business Requirements | Tổng quan, users, user flows, AC, business rules, edge cases | SRS |
| 2. Non-Functional Reqs | Performance, availability, security, scale | SRS + HLD |
| 3. Architecture & Integration | Services, APIs, data, dependencies, deployment | HLD + LLD |
| 4. Implementation Context | Tech stack, tests, constraints, existing code | IMP + TST |

> **Chi tiết từng round** — câu hỏi mẫu, AskUserQuestion templates, exit criteria:
> → `references/grilling-templates.md`

> **Exit criteria đầy đủ** → `references/grilling-templates.md#grilling-exit-criteria-tổng-hợp`.
> Thiếu criteria → hỏi thêm. Không đủ sau 2 attempts → fallback (xem `references/error-handling.md#e21`).

---

## Giai đoạn 2: Xác Nhận Automation Scope

Dựa trên grilling, xác định phase cần chạy:

| Thay đổi | Phase |
|---|---|
| Business requirements mới | SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST |
| Service/ADR/boundary mới | HLD → LLD → CROSS-CUTTING → IMP∥TST |
| API contract hoặc domain model | LLD → CROSS-CUTTING → IMP∥TST |
| Cross-cutting standards (error-handling, caching, frontend, performance) | CROSS-CUTTING (sau LLD) |
| Chỉ implementation detail | IMP∥TST |
| Chỉ test coverage | TST |

> **Không chạy phase không bị ảnh hưởng.**

Xác nhận với human:

```javascript
AskUserQuestion({
  questions: [{
    question: `Pipeline scope: [các phase]. Xác nhận chạy autonomously?`,
    header: "Scope",
    options: [
      { label: "Chạy automation", description: "Dispatch workflow, không cần review từng phase" },
      { label: "Chỉnh sửa scope", description: "Tôi muốn bỏ qua/thêm phase" },
      { label: "Chuyển orchestrator", description: "Dùng sdlc-orchestrator để review từng phase" }
    ],
    multiSelect: false
  }]
})
```

---

## Giai đoạn 3: Dispatch Automation Workflow

**Trước khi dispatch, resolve `repoPath`:**
```bash
git rev-parse --show-toplevel
```
Lưu output vào biến `repoRoot` và pass vào args bên dưới.

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-automation.js",
  args: {
    flow: "task",
    featureName: "[từ grilling]",
    featureDescription: "[tóm tắt]",
    phases: ["SRS", "HLD", "LLD", "CROSS-CUTTING", "IMP", "TST"],  // chỉ phase được chọn
    crossCutting: {
      errorHandling: true,           // từ architecture.md scope detection hoặc grilling
      cachingStrategy: true|false,   // có Redis/Caffeine trong architecture.md §6?
      performanceTest: true|false,   // có NFR-PERF-* targets trong SRS?
      frontendArchitecture: true|false,  // có frontend service trong architecture.md?
      frontendTestStrategy: true|false,  // frontend-architecture + FE test configured?
    },
    requirements: {
      businessRequirements: "[từ Round 1]",
      nfrs: "[từ Round 2]",
      architecture: "[từ Round 3]",
      implementation: "[từ Round 4]"
    },
    repoPath: repoRoot,   // output của git rev-parse --show-toplevel
    sprintUpdate: true
  }
})
```

Nếu dispatch fail → `references/error-handling.md#e3`

---

## Giai đoạn 4: Monitor & Report

Workflow chạy autonomously. Khi complete, báo cáo:

```
🏁 Automation Pipeline hoàn thành — [feature name]
   ✅ SRS: [FR-IDs] — [file]
   ✅ HLD: [ADRs, diagrams] (nếu chạy)
   ✅ LLD: [work packages] (nếu chạy)
   ✅ CROSS-CUTTING: [error-handling, caching, performance, frontend-arch, frontend-test] (nếu chạy)
   ✅ IMP: [spec files]
   ✅ TST: [spec files]
   🚦 Gates (verified by sdlc-gate): [PASS/FAIL] per phase
   ⚠️  Issues: [list hoặc "Không có"]
   📋 Sprint: [board/backlog updates]
```

### Sau khi Pipeline Hoàn Thành

Khi specs pipeline kết thúc thành công, hỏi human về bước tiếp theo:

```
AskUserQuestion({
  questions: [{
    question: "Automation pipeline đã hoàn thành specs. Bạn muốn làm gì tiếp?",
    header: "Next Step",
    options: [
      { label: "Implement code", description: "Chạy sdlc-cook để thực thi TDD code từ specs vừa tạo." },
      { label: "Tiếp tục task/CR khác", description: "Ở lại automation để làm task hoặc CR tiếp theo." },
      { label: "Dừng", description: "Kết thúc pipeline ở đây." }
    ],
    multiSelect: false
  }]
})

Nếu human chọn "Implement code" → Skill("sdlc-cook", "FR-xxx")
Nếu "Tiếp tục" → quay lại SKILL.md Bước 2 (Flow Detection)
Nếu "Dừng" → kết thúc
```

Gate fail → workflow tự retry với previousFailure context (max 2 attempts). Nếu vẫn fail → báo cáo phase nào fail + lý do + đề xuất orchestrator. Xem `references/error-handling.md#e4`.

# Procedures — sdlc-orchestrator

Templates, shared procedures, gate criteria, error handling, progress reporting,
và test patterns cho tất cả flow. Orchestrator đọc file này khi cần: tạo prompt
cho subagent, thực thi shared steps, kiểm tra gate pass/fail, hoặc debug flow routing.

---

## 1. Agent Spawn Templates

### 1.1 Specs Pipeline (SRS/HLD/LLD/CROSS-CUTTING/IMP/TST)

```
Agent({
  subagent_type: "sdlc-{phase}",
  description: "{phase} specs cho {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    [Context: các file agent_docs/ liên quan]
    [Expected outputs: đường dẫn file + mô tả nội dung]
    [Gate criteria: xem Section 5 bên dưới — chọn đúng phase]

    Làm theo procedure của bạn. Self-check gate trước khi finish.
    Báo cáo những gì đã tạo/cập nhật và các vấn đề phát hiện.
  "
})
```

#### Cross-Cutting Phase — Two-Stage Spawn

Sau LLD, cross-cutting agents chạy theo 2 stage:

**Stage 1 (∥ 4 agent song song):**
```
// Spawn đồng thời các agent được chọn từ scope detection
Agent({
  subagent_type: "sdlc-lld-error-handling",
  description: "Error handling standards",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/architecture.md §1+§6, agent_docs/contracts/api-conventions.md,
             agent_docs/contracts/error-codes.md, agent_docs/tech-design/*-service.md §9
    Expected output: agent_docs/error-handling.md
    Template: templates/supporting/error-handling-TEMPLATE.md
    Gate: Section 4.3b
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
Agent({
  subagent_type: "sdlc-lld-caching-strategy",
  description: "Caching strategy",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/architecture.md §1+§6, agent_docs/tech-design/*-service.md §7
    Expected output: agent_docs/caching-strategy.md
    Template: templates/supporting/caching-strategy-TEMPLATE.md
    Gate: Section 4.3b
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
Agent({
  subagent_type: "sdlc-lld-performance-test",
  description: "Performance test plan",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/architecture.md §1, agent_docs/features/FR-*.md (NFR-PERF-*),
             agent_docs/tech-design/*-service.md §8
    Expected output: agent_docs/performance-test.md
    Template: templates/supporting/performance-test-TEMPLATE.md
    Gate: Section 4.3b
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
Agent({
  subagent_type: "sdlc-lld-frontend-architecture",
  description: "Frontend architecture",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/architecture.md §1 (frontend services),
             agent_docs/frontend/{app}/api-routing.md, agent_docs/hard-boundaries.md
    Expected output: agent_docs/frontend-architecture.md
    Template: templates/supporting/frontend-architecture-TEMPLATE.md
    Gate: Section 4.3b
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
```

**Barrier:** Đợi error-handling + frontend-architecture hoàn thành (nếu frontend-test-strategy được chọn).

**Stage 2 (1 agent):**
```
Agent({
  subagent_type: "sdlc-lld-frontend-test-strategy",
  description: "Frontend test strategy",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/frontend-architecture.md (required — defines patterns),
             agent_docs/error-handling.md (error UX mappings),
             agent_docs/frontend/{app}/api-routing.md
    Expected output: agent_docs/frontend-test-strategy.md
    Template: templates/supporting/frontend-test-strategy-TEMPLATE.md
    Gate: Section 4.3b
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
```

**Quy tắc:**
- Mỗi agent chỉ spawn nếu scope detection xác định cần
- Stage 2 chỉ chạy nếu cả frontend-architecture + error-handling đã chọn ở Stage 1
- Gate criteria: Section 4.3b
- Retry: mỗi agent độc lập — nếu 1 agent fail, agent khác vẫn tiếp tục

### 1.2 TDD Fix Cycle — fixbug

Fix bug dùng TDD mini-cycle (per-bug, không per-TC như cook flow).
Thay vì spawn developer agent đơn lẻ, orchestrator điều phối TDD subagents:

```
Agent({
  subagent_type: "sdlc-tdd-be-red",  // hoặc sdlc-tdd-fe-red
  description: "Fix BUG-{NNN}: {title}",
  permissionMode: "acceptEdits",
  prompt: "
    Đây là TDD fix cycle cho MỘT bug (không phải feature mới).

    Bug document: agent_docs/{backend,frontend}/{service,app}/bugs/BUG-{NNN}--{slug}.md
    Feature: {FR-ID}
    Service: {service}

    Root cause: [từ bug doc]
    Proposed fix: [từ grilling/problem-solving]

    Đọc IMP spec: agent_docs/{backend,frontend}/{service,app}/implementation/FR-{DOMAIN}-{NNN}-impl.md
    Đọc TST spec: agent_docs/{backend,frontend}/{service,app}/test-specs/FR-{DOMAIN}-{NNN}-test.md
    Đọc tech-design: agent_docs/tech-design/{service}-service.md
    Đọc hard-boundaries: agent_docs/hard-boundaries.md
    Đọc conventions: agent_docs/conventions.md

    Thực hiện TDD fix cycle:
    1. VIẾT regression test — test phải FAIL (tái hiện bug)
       - Nếu test PASS (bug không tái hiện được) → accidental green detection
       - Sanity check → explore → sabotage → verify → revert nếu cần
    2. Nếu test RED (bug confirmed) → spawn sdlc-tdd-be-green để fix code
       - GREEN agent: implement fix TỐI THIỂU để pass test
       - Không refactor code không liên quan đến bug
    3. Sau GREEN → spawn sdlc-tdd-be-refactor --mode=light
       - Chỉ cleanup code liên quan đến fix
    4. Return kết quả: DONE|BLOCKED|STALE
       - DONE: fix hoàn thành, regression test pass
       - BLOCKED: không thể fix sau 3 attempts
       - STALE: bug doc hoặc spec không đủ rõ

    Sau khi DONE → cập nhật bug document status thành 'fixed'.
  "
})
```

**Khác biệt với cook flow TDD:**
- **1 bug = 1 TDD cycle** (không per-TC)
- **Regression test** thay vì feature test
- **Fix tối thiểu** — không implement feature mới
- **REFACTOR light chỉ cleanup fix area** — không refactor toàn bộ file
- **Không có GATE light/full** sau fix (code đã có sẵn, chỉ verify fix + regression)

**Verify fix (orchestrator thực hiện sau khi RED return DONE):**
1. Chạy test suite — tất cả tests pass (cũ + mới)
2. Bug doc status = 'fixed'
3. Regression test cover đúng root cause
4. IMP/TST specs nhất quán với fix

### 1.3 TDD Agent Templates (cook flow)

Tất cả template spawn TDD agents (RED, GREEN, REFACTOR, GATE) và BE+FE ordering nằm trong
`references/flow-cook.md` Bước 4. **Flow cook là canonical source duy nhất cho mọi TDD procedure.**
Không duplicate template ở đây — load `flow-cook.md` khi vào cook flow.

---

## 2. Output Templates

### 2.1 Bug Document

File: `agent_docs/{backend,frontend}/{service,app}/bugs/BUG-{NNN}--{slug}.md`

```markdown
---
bug-id: BUG-{service}-{NNN}
severity: P0 | P1 | P2 | P3
status: open | in-progress | fixed | verified
affected-fr: [FR-IDs]
discovered: YYYY-MM-DD
resolved: YYYY-MM-DD (nếu đã fix)
---

# BUG-{NNN}: {title}

## Symptoms
[Mô tả những gì user thấy — error messages, wrong behavior, performance issues]

## Reproduction
[Hướng dẫn từng bước để tái hiện bug]

## Root Cause
[Giải thích kỹ thuật — component nào, tại sao]

## Fix
[Tóm tắt những gì đã thay đổi — file nào, approach gì]

## Regression Tests Added
- [Test case 1]
- [Test case 2]

## Related
- FR-{DOMAIN}-{NNN}
- [Các bug hoặc feature liên quan khác]
```

**Xác định BUG-NNN:** ls `agent_docs/{backend,frontend}/*/bugs/BUG-*.md`, tăng NNN lên 1. Chưa có bug nào → bắt đầu BUG-001.

### 2.2 README Routing Table

File: `agent_docs/README.md`

```markdown
---
phase: routing-table
updated: YYYY-MM-DD
pipeline: task | cr
---

# Agent Docs — Routing Table

## Active Features

| FR-ID | Title | Status | SRS | HLD | LLD | CROSS | IMP | TST | Sprint |
|---|---|---|---|---|---|---|---|---|
| FR-AUTH-001 | Login | specs-ready | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sprint 2 |
| FR-ORDER-003 | Payment | in-spec | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sprint 3 |

## Pipeline Status

- **Last SRS run**: YYYY-MM-DD (FR-xxx)
- **Last HLD run**: YYYY-MM-DD
- **Last LLD run**: YYYY-MM-DD
- **Last Cross-Cutting run**: YYYY-MM-DD
- **Last IMP run**: YYYY-MM-DD
- **Last TST run**: YYYY-MM-DD
- **Last cook**: YYYY-MM-DD (FR-xxx, commit abc123)

## Bug Registry

| Bug ID | Severity | Affected FR | Status |
|---|---|---|---|
| BUG-order-001 | P1 | FR-ORDER-003 | fixed |

## Open Issues / Notes

- [Các blockers hoặc decisions đang pending]
```

---

## 3. Shared Procedures

### 3.1 Flow Confirmation (khi ambiguous)

Dùng template AskUserQuestion trong SKILL.md, Preflight Bước 2. Template đầy đủ nằm ở đó — không duplicate ở đây.

### 3.2 Impact Assessment (fixbug)

1. Check bug ảnh hưởng task nào:
   - Đọc `.work/board.md`, match affected component với FR-IDs
   - Đọc IMP specs: `agent_docs/{backend,frontend}/*/implementation/FR-*-impl.md`
   - Đọc TST specs: `agent_docs/{backend,frontend}/*/test-specs/FR-*-test.md`
2. Xác định cần cập nhật:
   - **IMP spec** → thêm error handling, execution flow, validation, data impact
   - **TST spec** → thêm regression tests (BVA, error scenarios, edge cases)
   - **Không ảnh hưởng** → báo cáo human
3. Báo cáo: "Bug BUG-{NNN} ảnh hưởng: [FR-IDs]. Cần cập nhật: [IMP/TST/cả hai/không]."
4. Nếu bug tiết lộ gap trong higher-level specs → flag: "Có gap trong [phase] specs. Cân nhắc chạy [phase] update."

### 3.3 Spec Update (fixbug)

1. **EnterPlanMode** → Plan agent mô tả IMP/TST spec changes
2. Human review → approve
3. Spawn agent(s): `sdlc-imp` và/hoặc `sdlc-tst`
4. **Minor updates** (<~20 dòng, 1 edge case): orchestrator Edit trực tiếp. Lớn hơn → spawn subagent.

### 3.4 Fix + Verify Pattern (fixbug)

**Fix — TDD Mini-Cycle (per-bug):**

Orchestrator spawn RED agent làm mini-orchestrator cho fix cycle:

```
Cho mỗi bug:
  RED (sdlc-tdd-be-red hoặc sdlc-tdd-fe-red)
  ├─ Viết regression test (tái hiện bug)
  ├─ Verify RED (test fails — bug confirmed)
  ├─ Accidental green? → sanity→explore→sabotage→verify→revert
  ├─ Spawn GREEN (fix code tối thiểu)
  └─ Spawn REFACTOR-light (cleanup fix area only)
```

**Routing:**
- Backend bug → spawn `sdlc-tdd-be-red` (RED agent tự spawn GREEN + REFACTOR)
- Frontend bug → spawn `sdlc-tdd-fe-red`
- Cả hai → tuần tự (backend trước, frontend sau)
- Dùng template Section 1.2

**Verify (orchestrator thực hiện sau RED DONE):**
1. RED agent return DONE
2. Chạy test suite: `sdlc-tdd-be-gate --mode=light` (4 critical checks)
   - L1: Tất cả tests pass (cũ + regression mới)
   - L2: Hard Boundaries không bị vi phạm
   - L3: Query Safety (không SQL injection trong fix)
   - L4: External Call Resilience (timeout + fallback)
3. Bug `status` → `fixed`
4. IMP/TST specs nhất quán với fix
5. Update sprint artifacts nếu bug ảnh hưởng board tasks

**Nếu GATE light FAIL:**
- Báo cáo failures cho human
- Spawn developer fix từng failure
- Chạy lại GATE light (max 2 lần)
- Nếu vẫn fail → human quyết định: skip gate, manual verify, hoặc abort

**Khác biệt với cook flow verify:**
- **Chỉ GATE light** (4 checks) — không REFACTOR full, không GATE full
- **Regression-focused** — verify bug không tái xuất + không regression
- **Fix area only** — không kiểm tra toàn bộ feature code

### 3.5 Sprint Artifact Update

1. Invoke `Skill(sprint, "--all")` để cập nhật board, backlog, roadmap
2. Write `agent_docs/README.md` — file duy nhất orchestrator được phép Write

**⚠️ Orchestrator KHÔNG BAO GIỜ tự sửa `.work/board.md`, `.work/backlog.md`, `agent_docs/roadmap.md`.**

### 3.6 TDD Per-TC Cycle (cook flow)

Procedure chi tiết cho TDD per-testcase cycle — trích xuất TCs, quyết định tuần tự/song song,
spawn RED agent, parse kết quả, tổng hợp, GATE→REFACTOR→GATE sequence, và error recovery —
nằm trong `references/flow-cook.md` Bước 4. **Flow cook là canonical source.**

---

## 4. Gate Criteria

Orchestrator kiểm tra subagent self-check report sau mỗi phase. Nếu gate fail → báo cáo human, không proceed.

### 4.1 SRS Gate
- [ ] Tất cả FRs có Gherkin Scenario Outlines với Given/When/Then
- [ ] Tất cả NFRs có ngưỡng định lượng (performance: p95 < Xms, availability: 99.X%)
- [ ] Traceability matrix đầy đủ (BR → FR → NFR)
- [ ] Không có service names, API paths, hoặc implementation details

### 4.2 HLD Gate
- [ ] C4 Container diagram hoàn chỉnh (không chỉ System Context)
- [ ] Tất cả ADRs có: Context, Decision, Rationale, Consequences, Alternatives Considered
- [ ] ADR index (`agent_docs/adrs/README.md`) tồn tại với status tracking
- [ ] ADR bị superseded có link đến ADR thay thế
- [ ] Bounded context map cho mỗi service boundary
- [ ] Event taxonomy + hard boundaries giữa các service
- [ ] Không có per-service internals (để dành cho LLD)

### 4.3 LLD Gate
- [ ] Đủ 9 sections: Domain Model, API Contracts, REST Clients, Caching, Transaction Boundaries, Error Flows, Degraded Modes, Work Packages, Routing Overlay
- [ ] Không có architectural decisions mới (thuộc HLD)
- [ ] Mỗi FR có work package với routing overlay

### 4.3b Cross-Cutting Gate
- [ ] `error-handling.md`: error taxonomy ≥8 categories, HTTP status mapping, security rules (nếu applicable)
- [ ] `caching-strategy.md`: cache architecture L0-L3, inventory per service (nếu applicable)
- [ ] `performance-test.md`: NFR targets quantified, 5 test types (nếu applicable)
- [ ] `frontend-architecture.md`: rendering strategy, state management, data fetching (nếu applicable)
- [ ] `frontend-test-strategy.md`: test pyramid, MSW patterns, coverage targets (nếu applicable)
- [ ] Tất cả file YAML frontmatter có `depends_on` + `referenced_by`
- [ ] File được chọn = file được sinh (không thiếu, không thừa)

### 4.4 IMP Gate
- [ ] Execution flow cho mỗi feature (step-by-step)
- [ ] Business rules mapped đến code paths
- [ ] Data impact: schema changes, migrations, indexes
- [ ] Error mapping: exception → HTTP status → error response body
- [ ] Security: authz rules, input validation points, data sanitization
- [ ] References LLD work packages và tech-design

### 4.5 TST Gate
- [ ] Unit test cases với concrete inputs/expected outputs
- [ ] Integration test cases (Testcontainers specs)
- [ ] E2E test scenarios (Playwright user flows)
- [ ] Performance test thresholds (p95, p99)
- [ ] Test fixtures và mock definitions
- [ ] References IMP specs cho feature behavior

---

## 5. Error Handling Patterns

### 5.1 Subagent Failure

1. Báo cáo: "[Phase] agent fail: [error]."
2. Hỏi human: "Retry, skip phase, hay abort pipeline?"
3. **Không tự retry** nếu không có human approval.
4. Skip phase → ghi nhận trong `agent_docs/README.md` Open Issues.

### 5.2 Missing Prerequisites

| Thiếu file | Hành động |
|---|---|
| `.work/board.md` | "Chạy `Skill(sprint, "--init")` để khởi tạo board." |
| `agent_docs/` | "Project mới? Foundation Gate trong Preflight (SKILL.md Bước 3) sẽ invoke sdlc-preflight." |
| `agent_docs/project-overview.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--project-overview')`" |
| `agent_docs/user-context.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--user-context')`" |
| `agent_docs/conventions.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--conventions')` (cho task flow)" |
| Feature spec | "FR-{ID} không tồn tại. Tạo mới từ SRS?" |

### 5.3 Git State Conflicts

Nếu human chọn tiếp tục với dirty working tree:
1. Ghi nhận cảnh báo
2. Không tự stash/commit
3. Cảnh báo trước mỗi git operation

### 5.4 Ambiguous Board Status

| Flow + Status | Hành động |
|---|---|
| task + in-progress | "Đang in-progress. Chuyển sang CR?" |
| cook + TODO | "Chưa có specs. Chạy flow task trước." |
| cook + done | "Đã done. Nếu cần sửa → fixbug." |

### 5.5 Pipeline Abort & Cleanup

Khi pipeline bị abort (human cancel hoặc unrecoverable error):

1. **Dừng tất cả subagents đang chạy** — báo cáo subagent nào đã finish, subagent nào đang dở
2. **Ghi nhận trạng thái** trong `agent_docs/README.md` Open Issues:
   - Phase đã hoàn thành: [list]
   - Phase đang dở: [phase] — outputs đã tạo: [file list]
   - Lý do abort: [human cancel / error / other]
3. **Không revert hoặc xóa** outputs đã tạo — human quyết định giữ hay bỏ
4. **Board status** — không tự thay đổi. Human tự cập nhật nếu cần

### 5.6 Retry Pattern (có Human Approval)

Khi subagent fail và human chọn retry:

1. **Giữ nguyên context** — không xóa outputs hiện có
2. **Spawn subagent mới** với cùng prompt + thêm: "Previous attempt failed: [error]. Hãy thử approach khác."
3. **Giới hạn retry**: đề xuất tối đa 2 lần retry. Sau đó → skip hoặc abort
4. **Báo cáo**: "Retry {N}/2: [phase] agent. Previous error: [error]."

### 5.7 Degraded Mode (Skip Phase)

Khi human chọn skip phase sau subagent failure:

1. Ghi nhận: "[Phase] bị skip — gate KHÔNG pass."
2. Risk: "Các phase sau có thể thiếu context từ [phase]. Rủi ro: [specific risks]."
3. Human phải xác nhận: "Tôi hiểu rủi ro và muốn skip."
4. Đánh dấu trong `agent_docs/README.md`: "⚠️ [Phase] skipped — gate not passed"

---

## 6. Progress Reporting

### 6.1 After-Phase Report

Sau MỖI phase completion, báo cáo cho human:

```
✅ [Phase] hoàn thành — [FR-ID]: [title]
   📄 Output: [danh sách file đã tạo/cập nhật]
   🚦 Gate: [PASS/FAIL] ([N]/[M] criteria met)
   ⏭️  Next: [phase tiếp theo hoặc "Pipeline complete"]
   ⚠️  Issues: [list issues hoặc "Không có"]
```

#### Cross-Cutting After-Phase Report

```
✅ Cross-Cutting hoàn thành
   📄 error-handling.md: [taxonomy count] categories, [N] services covered
   📄 caching-strategy.md: [architecture tier], [N] cache entries (nếu applicable)
   📄 frontend-architecture.md: [rendering strategy] (nếu applicable)
   📄 performance-test.md: [N] test types, [N] endpoints (nếu applicable)
   📄 frontend-test-strategy.md: [test pyramid ratio] (nếu applicable)
   🚦 Gate: PASS ([N]/[M] criteria met)
   ⚠️  Issues: [list hoặc "Không có"]
```

### 6.2 Pipeline Summary

Sau khi pipeline hoàn thành (tất cả phases):

```
🏁 Pipeline hoàn thành — [flow]: [feature/task name]
   ✅ SRS: [FR-IDs] — [file]
   ✅ HLD: [nếu chạy] — [ADRs, diagrams]
   ✅ LLD: [nếu chạy] — [work packages]
   ✅ IMP: [spec files]
   ✅ TST: [spec files]
   📋 Sprint: [board/backlog updates]
   🔗 Next step: flow cook để triển khai code
```

### 6.3 Flow Completion Report

Khi flow kết thúc (bao gồm cả fixbug và cook):

```
✅ Flow [flow] hoàn thành
   🔧 Đã thực hiện: [tóm tắt các bước chính]
   📄 Artifacts: [danh sách file đã tạo/cập nhật]
   🚦 Tất cả gates: PASS
   ⚠️  Open issues: [list hoặc "Không có"]
```

---

## 7. Orchestrator Self-Check (Quality Gates)

Sau mỗi flow completion, orchestrator tự kiểm tra:

### 7.1 Pipeline Integrity

- [ ] Tất cả phases đã chạy theo đúng thứ tự (SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST)
- [ ] Không phase nào bị skip mà không có human approval
- [ ] Mỗi phase đều có gate check
- [ ] IMP và TST được spawn song song (nếu cả hai đều chạy)

### 7.2 Artifact Consistency

- [ ] `agent_docs/README.md` routing table khớp với thực tế (phase status đúng)
- [ ] IMP specs reference LLD work packages (nếu LLD đã chạy)
- [ ] TST specs reference IMP specs cho feature behavior
- [ ] Bug documents (nếu có) reference đúng FR-IDs

### 7.3 Human-in-the-Loop Audit

- [ ] Mỗi phase đều có: EnterPlanMode → Plan agent → Human review → ExitPlanMode
- [ ] Không phase nào tự spawn subagent mà không có approved plan
- [ ] Tất cả ambiguous decisions đều được human xác nhận qua AskUserQuestion

### 7.4 Sprint Alignment

- [ ] Board status phản ánh đúng pipeline progress
- [ ] Backlog priorities được tôn trọng
- [ ] Roadmap milestones được cập nhật (nếu có thay đổi)

---

## 8. Flow Detection Test Scenarios

Dùng để verify routing logic hoạt động đúng. Các scenarios này để test/debug flow detection —
không cần load vào production context trừ khi routing hoạt động sai.

### 8.1 Clear Intent → Correct Flow

| Input | Expected Flow |
|---|---|
| "Sửa bug login bị crash khi nhập password dài" | fixbug (Sub-Flow B — crash report) |
| "Fix lỗi OrderService timeout — root cause là connection pool cạn, cần tăng pool size" | fixbug (Sub-Flow A — known cause) |
| "Thay đổi yêu cầu: thêm field phone_number vào form đăng ký" | cr |
| "Triển khai code cho FR-AUTH-001 từ ready specs" | cook |
| "Làm task đăng nhập bằng OAuth2" | task |

### 8.2 Ambiguous → AskUserQuestion

| Input | Overlap |
|---|---|
| "Implement chức năng login" | "implement" khớp task (priority 4), không khớp cook (không có "code"/"build") → task |
| "Triển khai tính năng thanh toán" | "triển khai" khớp cả task và cook → ambiguous |
| "Sửa lỗi và cập nhật lại docs" | "sửa lỗi" → fixbug (priority 1), "cập nhật" → cr (priority 2). fixbug wins |
| "Tài liệu API mới cho payment service" | "tài liệu" → task (priority 4), nhưng nghe giống LLD → AskUserQuestion |

### 8.3 Edge Cases

| Input | Expected |
|---|---|
| Input rỗng hoặc "help" | AskUserQuestion hiển thị tất cả flow |
| Input chỉ có "bug" (1 từ) | fixbug, Sub-Flow B (thiếu context → grill) |
| Input có "code" + "bug" | fixbug wins (priority 1 > 3) |
| Input có "CR bug" | fixbug wins (priority 1 > 2), nhưng có thể là CR-related bug → AskUserQuestion |

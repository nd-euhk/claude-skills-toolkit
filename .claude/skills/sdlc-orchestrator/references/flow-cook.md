# Flow: cook

**Trigger:** Thực thi code từ ready specs — build feature thực tế.
**Precondition:** Task PHẢI có status `ready` trên board.

## Bước 1: Xác minh Readiness

1. Đọc `.work/board.md` và `.work/backlog.md`
2. Tìm task human muốn cook
3. Route theo status:

| Status | Hành động |
|---|---|
| **ready** | Tiếp tục Bước 2 |
| **TODO** | Từ chối: "Task chưa có specs đầy đủ. Chạy flow task trước." |
| **in progress** | Cảnh báo: "Task đang được triển khai. Tiếp tục hay spawn thêm developer?" |
| **review** | Cảnh báo: "Task đang review. Chạy cook lại từ đầu hay chỉ cần fix review findings?" |
| **done** | Cảnh báo: "Task đã done. Muốn sửa gì thêm? Nếu là bug, dùng flow fixbug." |
| **Không tìm thấy** | Từ chối: "Task không tồn tại trên board." |

## Bước 2: Grilling Interview

Nếu task status `ready` và context chưa đủ:
- Xác nhận service(s) cần build (backend, frontend, hoặc cả hai)
- Xác nhận branch để làm việc
- Xác nhận deployment hoặc environment requirements đặc biệt
- Xác nhận dependencies (tất cả dependent tasks đã done chưa?)
- Xác nhận TCs có thể chạy song song hay phải tuần tự

## Bước 3: Chuyển Task sang In Progress

1. Update task status trên board từ `ready` → `in progress`
2. Invoke `Skill(sprint)` để cập nhật `.work/board.md` và `.work/backlog.md`

## Bước 4: TDD Orchestration (Per-Testcase)

Đây là bước CỐT LÕI của flow cook. Orchestrator điều phối các `sdlc-tdd-*` subagents theo per-testcase TDD cycle:

```
Cho mỗi TC:                           Sau tất cả TCs:
  RED (mini-orchestrator)               GATE light (4 critical checks)
  ├─ Viết test                          ├─ Nếu FAIL → quay lại fix
  ├─ Verify RED (test fails)            ├─ Nếu PASS →
  ├─ Accidental green? → detect         REFACTOR full (6 categories)
  ├─ Spawn GREEN (implement)            └─ GATE full (10 gates)
  └─ Spawn REFACTOR-light (cleanup)
```

### 4.1: Đọc Specs và Trích xuất Test Cases

1. Đọc TST spec: `agent_docs/{backend,frontend}/{service,app}/test-specs/FR-{ID}-test.md`
2. Trích xuất danh sách test cases:
   - Mỗi TC: ID (N), tên, layer (unit/integration/e2e), risk (CRITICAL|HIGH|MEDIUM|LOW)
   - Thứ tự ưu tiên: CRITICAL → HIGH → MEDIUM → LOW
   - Dependency giữa các TCs (nếu có)
3. Đọc IMP spec: `agent_docs/{backend,frontend}/{service,app}/implementation/FR-{ID}-impl.md`
4. Đọc feature context: `agent_docs/features/FR-{ID}.md`

### 4.2: Xác định Backend / Frontend

Dựa trên feature specs (FR layer):

| FR có | Hành động |
|---|---|
| `backend_service` | Dùng `sdlc-tdd-be-*` agents |
| `frontend_app` | Dùng `sdlc-tdd-fe-*` agents |
| Cả hai | Backend trước, frontend sau (APIs cần tồn tại). Song song nếu thực sự độc lập — xác nhận với human |

### 4.3: Per-TC RED Cycle

Cho MỖI test case. **Mặc định tuần tự** (mỗi TC build trên TC trước). **Song song** nếu TCs thực sự độc lập (xác nhận với human).

Spawn `sdlc-tdd-be-red` (hoặc `sdlc-tdd-fe-red`):

```
Agent({
  subagent_type: "sdlc-tdd-be-red",
  description: "RED TC-{N}: {test case name}",
  permissionMode: "acceptEdits",
  prompt: "
    Viết test và điều phối TDD cycle cho MỘT test case:

    Feature: {feature}
    TC: {N} — {test case name}
    FR-ID: {FR-ID}
    Service: {service}
    Layer: {layer}
    Risk: {risk}

    Đọc test case từ: agent_docs/backend/{service}/test-specs/{FR-ID}-test.md
    Đọc IMP spec từ: agent_docs/backend/{service}/implementation/{FR-ID}-impl.md
    Đọc tech-design: agent_docs/tech-design/{service}-service.md
    Đọc hard-boundaries: agent_docs/hard-boundaries.md
    Đọc conventions: agent_docs/conventions.md

    Kết quả từ các TC trước (nếu có):
    [Tóm tắt files đã thay đổi từ TC-1 đến TC-{N-1}]

    Thực hiện:
    1. Viết test code cho test case này
    2. Verify test FAILS (RED)
    3. Nếu accidental green → detect + sabotage → confirm
    4a. Test RED → spawn sdlc-tdd-be-green để implement → spawn sdlc-tdd-be-refactor --mode=light
    4b. Accidental green confirmed → skip GREEN và REFACTOR
    5. Return kết quả (DONE|BLOCKED|STALE)
  "
})
```

**RED agent xử lý nội bộ:**
- Viết test → verify RED → accidental green detection (nếu cần)
- Spawn `sdlc-tdd-be-green` để implement code tối thiểu
- Spawn `sdlc-tdd-be-refactor --mode=light` để cleanup per-TC
- Return kết quả có cấu trúc (DONE|BLOCKED|STALE) + skip flags

**Sau mỗi TC, orchestrator kiểm tra:**
- DONE → tiếp tục TC tiếp theo
- SKIPPED (accidental green) → tiếp tục TC tiếp theo
- BLOCKED → dừng, báo cáo human: "TC-{N} bị BLOCKED sau 3 sabotage attempts. Cần human kiểm tra."
- STALE → báo cáo human: "TC-{N} ambiguous spec. Cần làm rõ trước khi tiếp tục."

### 4.4: Tổng hợp Kết quả Per-TC

Sau khi tất cả TCs hoàn thành, tổng hợp:

```
✅ TC-1: DONE — {test name} (RED→GREEN→REFACTOR-light)
✅ TC-2: DONE — {test name}
⏭️ TC-3: SKIPPED — accidental green (đã có implementation)
❌ TC-4: STALE — ambiguous spec
```

Báo cáo human: "N/N TCs hoàn thành. {N} DONE, {N} SKIPPED, {N} BLOCKED, {N} STALE."

Nếu có BLOCKED hoặc STALE → không proceed đến GATE. Human quyết định: fix rồi continue, hoặc skip TCs bị lỗi.

### 4.5: GATE Light (sau khi tất cả TCs pass)

Spawn gate agent để verify 4 critical checks trước khi refactor toàn diện:

```
Agent({
  subagent_type: "sdlc-tdd-be-gate",
  description: "GATE light: {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    Mode: light
    Feature: {feature}
    Service: {service}
    FR-ID: {FR-ID}

    Tất cả per-TC cycles đã hoàn thành. Đây là tổng hợp:
    [Insert per-TC result summary từ Bước 4.4 — danh sách từng TC với status, files changed, skip flags]

    Tổng số files changed: {N}
    Tech stack hint: [từ RED agent reports]

    Chạy 4 critical gates (L1-L4):
    - L1: Test Suite (tất cả tests pass)
    - L2: Hard Boundaries (không cross-service DB access)
    - L3: Query Safety (không raw SQL concatenation)
    - L4: External Call Resilience (timeout + fallback)
  "
})
```

**GATE light result:**
- ALL 4 PASS → tiếp tục Bước 4.6 (REFACTOR full)
- FAIL → báo cáo failures cho human. Spawn developer agents fix từng failure. Chạy lại GATE light.

### 4.6: REFACTOR Full

Spawn refactor agent để cải thiện toàn bộ feature code:

```
Agent({
  subagent_type: "sdlc-tdd-be-refactor",
  description: "REFACTOR full: {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    Mode: full
    Feature: {feature}
    Service: {service}
    FR-ID: {FR-ID}

    GATE light: PASS (4/4)
    Files changed across all TCs: [tổng hợp từ Bước 4.4]
    Tech stack: [detected từ RED reports]

    Chạy tất cả 6 categories + framework-specific check:
    1. Security (input validation, injection, auth, RBAC, sensitive data)
    2. Data Integrity (transactions, idempotency, locking, cascading)
    3. Performance (N+1 queries, indexes, connection leaks, fetch strategy)
    4. Resilience (circuit breaker, timeouts, retry, graceful degradation)
    5. Observability (correlation ID, structured logging, error responses, health)
    6. Code Quality (lint, format, duplication, naming, dead code)
    7. Framework-Specific (Spring Boot/Node.js/Python/Go/Rust compliance)

    Đọc IMP spec: agent_docs/backend/{service}/implementation/{FR-ID}-impl.md
    Đọc tech-design: agent_docs/tech-design/{service}-service.md
    Đọc hard-boundaries: agent_docs/hard-boundaries.md
    Đọc conventions: agent_docs/conventions.md
  "
})
```

**REFACTOR full result:** báo cáo findings + fixes cho human. Nếu có flagged-but-not-fixed issues → human quyết định.

### 4.7: GATE Full

Spawn gate agent để verify toàn bộ 10 gates:

```
Agent({
  subagent_type: "sdlc-tdd-be-gate",
  description: "GATE full: {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    Mode: full
    Feature: {feature}
    Service: {service}
    FR-ID: {FR-ID}

    REFACTOR full đã hoàn thành. Tổng hợp:
    - Per-TC results: [từ Bước 4.4]
    - GATE light: PASS (4/4)
    - REFACTOR full findings: {N} fixed, {N} flagged
    - Files changed: [danh sách cập nhật]

    Chạy tất cả 10 gates (L1-L4 + F5-F10):
    - L1-L4: critical checks (đã pass ở light mode, verify lại)
    - F5: Integration & Regression
    - F6: Lint & Formatting
    - F7: Coverage
    - F8: Input Validation
    - F9: Error Handling
    - F10: Framework-Specific Compliance
  "
})
```

**GATE full result:**
- ALL 10 PASS → code ready cho review và push. Tiếp tục Bước 5.
- FAIL → báo cáo failures. Fix từng failure. Chạy lại GATE full.

### 4.8: Backend + Frontend Ordering (khi cả hai)

```
Backend TDD cycle hoàn thành (Bước 4.1-4.7)
  │
  ├─ GATE full BE PASS?
  │   ├─ YES → Bắt đầu Frontend TDD cycle
  │   └─ NO  → Fix BE issues trước
  │
  └─ Frontend TDD cycle hoàn thành
      └─ GATE full FE PASS? → Tiếp tục Bước 5 (Code Review)
```

**Default: tuần tự (backend trước, frontend sau).** Song song nếu thực sự độc lập (xác nhận với human).

## Bước 5: Code Review

Sau khi tất cả TDD cycles + GATE full pass cho cả BE và FE:

1. Invoke `Skill(sdlc-review)` trên code mới
2. Dùng mode phù hợp:
   - `--code` mode để review against IMP và TST specs
   - `--full` mode để comprehensive review (arch, security, bugs, conventions, impact, ops, tests)
3. Nếu review tìm thấy issues → spawn developer agents để fix. Lặp đến khi review pass hoặc human chấp nhận với known issues.

## Bước 6: Git Push

1. Invoke `Skill(git)` để commit và push code
2. Đảm bảo commit message tham chiếu FR-ID và task
3. Xác nhận với human trước khi push lên shared/protected branch

## Bước 7: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → "Sprint Artifact Update". Cụ thể:
- Board: move task từ `in progress` → `in review` → `done`
- Backlog: update status thành `done`
- Roadmap: update feature progress
- README routing table: cập nhật `agent_docs/README.md` với cook status mới

---

## Cook Flow Summary

```
Bước 1: Readiness Check → Bước 2: Grilling → Bước 3: Move to In Progress
                                                          │
                                                          ▼
Bước 4: TDD Orchestration ─────────────────────────────────────────────┐
│                                                                       │
│  ┌─ TC-1 ──────────────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-be-red (mini-orchestrator)                              │ │
│  │   ├─ Write test → Verify RED → Accidental green?                │ │
│  │   ├─ Spawn sdlc-tdd-be-green (implement tối thiểu)               │ │
│  │   └─ Spawn sdlc-tdd-be-refactor --mode=light (cleanup per-TC)   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─ TC-2 ──────────────────────────────────────────────────────────┐ │
│  │ ...tương tự...                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ...                                                                  │
│  ┌─ TC-N ──────────────────────────────────────────────────────────┐ │
│  │ ...tương tự...                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─ GATE Light ────────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-be-gate --mode=light (L1-L4: 4 critical checks)        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─ REFACTOR Full ─────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-be-refactor --mode=full (6 categories + framework)     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─ GATE Full ─────────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-be-gate --mode=full (all 10 gates)                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
Bước 5: Code Review → Bước 6: Git Push → Bước 7: Sprint Update
```

## Error Handling trong TDD Cycle

| Tình huống | Hành động |
|---|---|
| RED returns BLOCKED (3 sabotage attempts failed) | Dừng TDD cycle. Báo cáo human với code map từ Explore agent. Human kiểm tra thủ công. |
| RED returns STALE (ambiguous spec) | Dừng TC đó. Báo cáo human. Option: skip TC này, tiếp tục TCs khác. |
| GREEN returns STUCK (5 iterations failed) | Dừng TC đó. Báo cáo: test nào fail, hypothesis, cần help gì. |
| GATE light FAIL | Báo cáo failures. Spawn developer fix từng failure. Chạy lại GATE light (max 2 lần). |
| GATE full FAIL | Báo cáo failures. Fix từng failure. Chạy lại GATE full (max 2 lần). |
| REFACTOR full gây test failure | REFACTOR agent phải tự undo + report. Orchestrator verify test suite vẫn pass. |
| Subagent crash / timeout | Báo cáo human. Option: retry (max 2), skip, hoặc abort pipeline. |

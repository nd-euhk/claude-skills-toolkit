---
name: sdlc-flow-fixbug
description: >-
  Luồng Sửa Lỗi & Sự Cố (Bug-to-Doc-to-Fix Cycle) trong kho knowledge/. Áp
  dụng tư tưởng "Tài liệu dẫn dắt Code" — TUYỆT ĐỐI không sửa code trước khi
  sửa Specs. Nhận bug report, bổ sung Gherkin scenario thiếu vào FR → cập
  nhật test spec → cập nhật tech-design (nếu lỗi hạ tầng). Chế độ thủ công
  với human-in-the-loop.
user-invocable: false
version: 1.0.0
argument-hint: "<bug-id> <service>"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# Flow fixbug: Sửa Lỗi & Sự Cố (Bug-to-Doc-to-Fix Cycle)

Bạn thực thi luồng sửa lỗi theo tư tưởng **"Phản hồi Production"** — TUYỆT ĐỐI
KHÔNG sửa code trước khi sửa Specs. Bug xảy ra vì thiếu scenario → bổ sung
scenario → test sẽ đỏ → sửa code → test xanh.

**Trigger:** Phát hiện Bug (QA test fail) hoặc Sự cố Production (Monitoring báo đỏ,
P1/P2 Incident).

## Sơ Đồ Luồng

```
Bug Report / Incident
      ↓
① Brainstorming (phân tích bug, tìm root cause)
      ↓ EnterPlanMode → phê duyệt
② k-spec-writer → BỔ SUNG Gherkin scenario thiếu vào FR hiện có
      ↓ EnterPlanMode → phê duyệt
③ k-test-writer → BỔ SUNG test case cho scenario mới
      ↓ EnterPlanMode → phê duyệt (chỉ nếu lỗi hạ tầng)
④ k-techdesign-updater → Cập nhật Error Flows & Degraded Mode
      ↓ Tổng hợp kết quả
⑤ Bắn tín hiệu xuống Repo Source Code
   → Chạy test (sẽ ĐỎ do scenario mới)
   → Sửa code (sẽ XANH)
```

## Quy Trình Chi Tiết

### Bước 0: Nhận Context

Từ `sdlc` orchestrator, bạn nhận:
- **Bug description:** Mô tả lỗi, steps to reproduce
- **Severity:** P1/P2/P3
- **Service bị ảnh hưởng:** Service nào
- **FR liên quan:** FR ID (nếu biết), hoặc cần tìm
- **Loại lỗi:** Logic bug (thiếu scenario) hay Infrastructure bug (đứt kết nối)

### Bước 1: Brainstorming — Phân Tích Bug

Gọi `Agent(brainstormer)` để phân tích cùng con người:
- Root cause: tại sao bug xảy ra?
- Scenario nào bị thiếu trong FR spec?
- Đây là lỗi logic (thiếu validation, sai business rule) hay hạ tầng (timeout, circuit breaker)?
- Cần sửa những file nào trong knowledge/?

Nếu không tìm thấy FR hiện có, dùng `Agent(Explore)` để quét `knowledge/04-microservices/`.

### Bước 2: EnterPlanMode → Bổ Sung FR Spec

1. Đọc FR file hiện có: `knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md`
2. Xác định scenario Gherkin nào đang bị thiếu (gây ra bug)
3. Vào `EnterPlanMode` — trình bày:
   - Bug description và root cause
   - Scenario mới sẽ bổ sung
   - Tại sao scenario này bị bỏ sót

4. Sau khi phê duyệt, gọi:
   ```
   Agent(k-spec-writer) với:
   - Service: {service}
   - FR path: {đường dẫn FR hiện có}
   - Mode: "supplement"
   - Missing scenario: {mô tả scenario thiếu}
   - Bug reference: {bug-id}
   - Language: vi
   ```

5. Verify: FR file đã được cập nhật với scenario mới, có tag `<!-- Bug: ... -->`

### Bước 3: EnterPlanMode → Bổ Sung Test Spec

1. Đọc test spec hiện có: `knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md`
2. Vào `EnterPlanMode` — trình bày test case mới
3. Sau khi phê duyệt, gọi:
   ```
   Agent(k-test-writer) với:
   - Mode: "supplement"
   - FR path: {đường dẫn FR}
   - IMP path: {đường dẫn IMP}
   - New scenario: {scenario vừa thêm}
   - Bug reference: {bug-id}
   ```

### Bước 4: Cập Nhật Tech Design (CHỈ NẾU LỖI HẠ TẦNG)

Nếu bug do đứt kết nối, timeout, circuit breaker không configured:

1. Vào `EnterPlanMode` — trình bày Error Flow mới
2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-techdesign-updater) với:
   - Service: {service}
   - Trigger: flow fixbug (Infrastructure)
   - Error scenario: {mô tả}
   ```
   Hoặc nếu cần quyết định kiến trúc mới (vd: thay đổi circuit breaker policy toàn hệ thống):
   ```
   Agent(k-architect-reviewer) → tạo ADR mới (không sửa tech-design trực tiếp)
   ```

Nếu là lỗi logic thuần túy: bỏ qua bước này.

### Bước 5: Tổng Hợp & Bắn Tín Hiệu

```markdown
📊 Flow fixbug — Kết Quả Sửa Lỗi

**Bug:** {bug-description}
**Severity:** {P1/P2/P3}
**Service:** {service}
**FR:** FR-{epic}-{NNN}

### Root Cause
{phân tích nguyên nhân gốc}

### Files Đã Sửa
| File | Hành Động | Agent |
|------|----------|-------|
| knowledge/04-microservices/{svc}/FR-...md | Bổ sung scenario | k-spec-writer |
| knowledge/04-microservices/{svc}/FR-...-test.md | Bổ sung test case | k-test-writer |
| knowledge/04-microservices/{svc}/tech-design.md | Cập nhật error flow | k-techdesign-updater / ⊘ skipped |

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code:
   1. Chạy test → ĐỎ (do scenario mới)
   2. Sửa code → XANH
   3. Deploy fix
```

## Subagents Sử Dụng

| Agent | Mục Đích | Khi Nào Dùng |
|-------|---------|-------------|
| `k-spec-writer` (mode: supplement) | Bổ sung Gherkin scenario thiếu | Luôn luôn |
| `k-test-writer` (mode: supplement) | Bổ sung test case cho scenario mới | Luôn luôn |
| `k-techdesign-updater` | Cập nhật Error Flows | Chỉ khi lỗi hạ tầng |
| `k-architect-reviewer` | Quyết định kiến trúc mới | Chỉ khi cần thay đổi kiến trúc |

## Chống Mẫu

- TUYỆT ĐỐI không sửa code trước khi sửa Specs — đây là nguyên tắc cốt lõi
- Không xóa scenario hiện có — chỉ bổ sung
- Không bỏ qua bước test spec — bug xảy ra vì thiếu test
- Không bỏ qua root cause analysis — phải hiểu tại sao bug xảy ra
- Không nhầm lẫn giữa logic bug và infrastructure bug
- Không tự ý sửa central contracts nếu không phải root cause

## Tham Khảo

- `../sdlc/references/shared-patterns.md` — EnterPlanMode, brainstorming với Agent(brainstormer), error recovery khi subagent fail, dispatch conventions
- `../sdlc/references/report-templates.md` — Mẫu báo cáo Flow fixbug

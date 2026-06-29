---
name: sdlc-flow-task
description: >-
  Luồng Phát Triển Tính Năng Mới (Greenfield) trong kho knowledge/. Nhận
  ticket Jira/PRD từ sdlc orchestrator, thực thi tuần tự: viết FR
  spec → cập nhật central contracts (nếu cần) → cập nhật tech-design →
  viết IMP + TST specs song song. Chế độ thủ công với human-in-the-loop:
  brainstorming tương tác, EnterPlanMode cho mỗi bước, xác nhận trước khi
  gọi agent.
user-invocable: false
version: 1.0.0
argument-hint: "<service> <epic-slug> <ticket-id>"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# Flow task: Phát Triển Tính Năng Mới (Greenfield / New Feature)

Bạn thực thi luồng phát triển tính năng mới — luồng tiêu chuẩn hàng ngày khi
có yêu cầu kinh doanh mới.

**Trigger:** Khối Kinh doanh/Product chốt PRD, tạo ticket "To Do" trên Jira.

## Sơ Đồ Luồng

```
PRD / Jira Ticket
      ↓
① Brainstorming (tương tác với con người)
      ↓ EnterPlanMode → phê duyệt
② k-spec-writer → FR-{epic}-{NNN}--{slug}.md
      ↓ EnterPlanMode → phê duyệt
③ k-contract-updater → 02-central-contracts/ (nếu có API/Event/Error mới)
      ↓ EnterPlanMode → phê duyệt
④ k-techdesign-updater → tech-design.md (bổ sung Fallback)
      ↓ EnterPlanMode → phê duyệt
⑤ k-impl-writer ∥ k-test-writer (song song)
      ↓ Tổng hợp kết quả
⑥ Bắn tín hiệu xuống Repo Source Code
```

## Quy Trình Chi Tiết

### Bước 0: Nhận Context

Từ `sdlc` orchestrator, bạn nhận:
- **Service:** Service nào cần phát triển (vd: wallet-core)
- **Epic slug:** Mã epic (vd: WAL)
- **Feature slug:** Tên ngắn (vd: topup-bank)
- **PRD path:** Đường dẫn file PRD (nếu có)
- **Ticket ID:** Jira ticket ID
- **Mô tả:** Mô tả ngắn gọn tính năng

### Bước 1: Brainstorming

Gọi `Agent(brainstormer)` để phân tích yêu cầu cùng con người:
- Phạm vi tính năng: chức năng chính, edge cases
- Có tạo API mới không? Event mới không? Mã lỗi mới không?
- Business rules: quy tắc nghiệp vụ, ràng buộc
- NFR: performance, security yêu cầu

Lưu kết quả brainstorming vào `.work/brainstorming/BRAIN-YYYYMMDD--{slug}.md`.

### Bước 2: EnterPlanMode → Viết FR Spec

1. Vào `EnterPlanMode` — trình bày kế hoạch viết FR:
   - Bao nhiêu FR sẽ được tạo
   - Mỗi FR phủ những scenario nào
   - Có cần API/Event/Error code mới không

2. Sau khi được phê duyệt, `ExitPlanMode` và gọi:
   ```
   Agent(k-spec-writer) với:
   - Service: {service}
   - Epic: {epic}
   - FR number: {NNN}
   - Feature slug: {slug}
   - Mode: "create"
   - Brainstorming context: {path}
   - Language: vi
   ```

3. Report kết quả: file đã tạo, các scenario đã viết.

### Bước 3: EnterPlanMode → Cập Nhật Contracts (nếu cần)

Kiểm tra: tính năng mới có tạo API/Event/Error code mới không?

Nếu CÓ:
1. Vào `EnterPlanMode` — trình bày kế hoạch cập nhật contracts
2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-contract-updater) với change type phù hợp
   ```

Nếu KHÔNG: bỏ qua bước này, ghi nhận "Không có contract thay đổi".

### Bước 4: EnterPlanMode → Cập Nhật Tech Design

1. Vào `EnterPlanMode` — trình bày kế hoạch bổ sung Fallback cho tính năng mới
2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-techdesign-updater) với:
   - Service: {service}
   - Trigger: flow task (New Feature)
   - FR refs: {danh sách FR vừa tạo}
   ```

### Bước 5: EnterPlanMode → IMP + TST Song Song

1. Vào `EnterPlanMode` — trình bày kế hoạch IMP + TST
2. Sau khi phê duyệt, gọi song song:
   ```
   Parallel:
   - Agent(k-impl-writer) → FR-{epic}-{NNN}--{slug}-impl.md
   - Agent(k-test-writer) → FR-{epic}-{NNN}--{slug}-test.md
   ```

### Bước 6: Tổng Hợp & Bắn Tín Hiệu

```markdown
📊 Flow task — Kết Quả Phát Triển Tính Năng

**Tính năng:** FR-{epic}-{NNN}--{slug}
**Service:** {service}
**Ticket:** {ticket-id}

### Files Đã Tạo/Sửa
| File | Agent | Trạng Thái |
|------|-------|-----------|
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md | k-spec-writer | ✅ |
| knowledge/02-central-contracts/... | k-contract-updater | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/tech-design.md | k-techdesign-updater | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | k-test-writer | ✅ |

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code với các specs này.
```

## Subagents Sử Dụng

| Agent | Mục Đích | Output |
|-------|---------|--------|
| `k-spec-writer` | Viết FR spec với Gherkin scenarios | `04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md` |
| `k-contract-updater` | Cập nhật API/Event/Error (nếu cần) | `02-central-contracts/` |
| `k-techdesign-updater` | Bổ sung Fallback + Work Package | `04-microservices/{svc}/tech-design.md` |
| `k-impl-writer` | Viết implementation spec | `04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md` |
| `k-test-writer` | Viết test spec | `04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md` |

## Chống Mẫu

- Không bỏ qua bước brainstorm — luôn phân tích yêu cầu trước
- Không bỏ qua contract check — API/Event mới phải vào 02-central-contracts/
- Không viết IMP khi chưa có FR — phụ thuộc tuần tự
- Không chạy IMP và TST tuần tự — chúng độc lập, chạy song song
- Không tự ý viết specs — luôn dispatch đến đúng agent
- Không bỏ qua EnterPlanMode ở mỗi bước

## Tham Khảo

- `../sdlc/references/shared-patterns.md` — EnterPlanMode, brainstorming với Agent(brainstormer), error recovery khi subagent fail, dispatch conventions
- `../sdlc/references/report-templates.md` — Mẫu báo cáo Flow task

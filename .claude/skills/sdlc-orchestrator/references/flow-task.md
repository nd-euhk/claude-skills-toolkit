# Flow: task

**Trigger:** Feature mới hoặc cập nhật specs hiện có.
**Precondition:** Task PHẢI tồn tại trên board với status TODO hoặc ready.

## Bước 1: Xác minh Board Status

1. Đọc `.work/board.md` (trực tiếp hoặc qua subagent `sdlc-sprint-board`)
2. Tìm task (match theo feature name, FR-ID, hoặc keyword)
3. Route theo status:

| Status | Hành động |
|---|---|
| **TODO** | Feature mới → full specs pipeline từ SRS |
| **ready** | Specs đã có → targeted updates (chỉ phase cần thay đổi) |
| **in progress** | Cảnh báo: "Task đang in progress. Nếu cần thay đổi specs → chuyển sang flow **cr**?" |
| **review** | Cảnh báo: "Task đang review. Đây là thay đổi post-review — chuyển sang flow **cr**?" |
| **done** | Cảnh báo: "Task đã done. Nếu cần sửa → flow **fixbug**. Nếu cần thêm feature → tạo task mới." |
| **Không tìm thấy** | "Task không có trên board. Tạo task mới trước khi chạy pipeline?" → nếu đồng ý: `Skill(sprint, "--board")` để tạo |

## Bước 2: Grilling Interview

Invoke `Skill(grilling)` để làm rõ. Điều chỉnh câu hỏi dựa trên status:

**Cho feature mới (TODO):**
- Feature này làm gì? Giải quyết vấn đề gì cho ai?
- Users là ai? Luồng workflow chính xác thế nào?
- Acceptance criteria — làm sao biết feature đã hoàn thành?
- Non-functional requirements: performance (p95 target?), security (authz model?), availability (uptime %?)
- Constraints: technology stack, external dependencies, timeline
- Có service/API mới nào không? (quyết định HLD optional)

**Cho cập nhật specs (ready):**
- Phase nào cần cập nhật? (chỉ SRS? chỉ API contract? implementation detail?)
- Thay đổi có backward-compatible không?
- Những feature/API khác bị ảnh hưởng?

## Bước 3: Xác định Pipeline Scope

Dựa trên grilling, xác định phase cần chạy:

| Thay đổi | Phase cần chạy |
|---|---|
| Business requirements mới hoặc thay đổi | SRS → HLD → LLD → IMP∥TST |
| Service/ADR/boundary mới | HLD → LLD → IMP∥TST |
| API contract hoặc domain model thay đổi | LLD → IMP∥TST |
| Chỉ implementation detail thay đổi | IMP∥TST |
| Chỉ test coverage bổ sung | TST |

**Không chạy phase không bị ảnh hưởng.** Xác nhận scope với human trước khi proceed.

## Bước 4: Thực thi Specs Pipeline

Chạy các phase đã xác định theo Specs Pipeline trong SKILL.md.

**Pipeline sequence:** SRS → (optional HLD) → (optional LLD) → IMP ∥ TST

### 4.1: Human-in-the-Loop mỗi Phase

Cho MỖI phase, thực hiện đúng 8 bước (xem SKILL.md "Human-in-the-Loop mỗi Phase"):

1. **EnterPlanMode**
2. **Đọc context** — tất cả file `agent_docs/` liên quan
3. **Spawn Plan agent** — mô tả phase hiện tại, file đã tồn tại, expected outputs
4. **Đợi human review** — approve/revise plan
5. **ExitPlanMode**
6. **Spawn sdlc-* subagent** — dùng template: `references/procedures.md` → Section 1.1
7. **Verify gate** — dùng criteria: `references/procedures.md` → Section 4
8. **Report progress** — dùng template: `references/procedures.md` → Section 6.1

### 4.2: Spawn Template cho Mỗi Phase

**SRS phase:**
```
Agent({
  subagent_type: "sdlc-srs",
  description: "SRS cho {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/project-overview.md, agent_docs/user-context.md
    Expected outputs: agent_docs/features/FR-{DOMAIN}-{NNN}.md
    Gate: references/procedures.md → Section 4.1
    Làm theo procedure của bạn. Self-check gate trước khi finish.
  "
})
```

**HLD phase (nếu cần):**
```
Agent({
  subagent_type: "sdlc-hld",
  description: "HLD cho {feature}",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan từ human review]
    Context: agent_docs/features/FR-{DOMAIN}-{NNN}.md (SRS output)
    Expected outputs: agent_docs/adrs/, agent_docs/architecture.md (update)
    Gate: references/procedures.md → Section 4.2
  "
})
```

**LLD phase (nếu cần):**
```
Agent({
  subagent_type: "sdlc-lld",
  description: "LLD cho {service}",
  permissionMode: "acceptEdits",
  prompt: "
    [Approved plan]
    Context: agent_docs/architecture.md, agent_docs/adrs/
    Expected outputs: agent_docs/backend/{svc}/tech-design/{svc}-service.md
    Gate: references/procedures.md → Section 4.3
  "
})
```

**IMP ∥ TST (song song):**
```
// Spawn đồng thời
Agent({ subagent_type: "sdlc-imp", ... })  // Gate: Section 4.4
Agent({ subagent_type: "sdlc-tst", ... })  // Gate: Section 4.5
// Đợi cả hai finish → verify gates độc lập
```

### 4.3: Error Handling trong Pipeline

| Tình huống | Hành động |
|---|---|
| Subagent fail | Báo cáo human. Option: retry (max 2), skip phase, hoặc abort. Xem `references/procedures.md` → Section 5.1 |
| Gate FAIL | Dừng pipeline. Báo cáo human criteria nào fail. Không proceed đến phase tiếp theo. |
| Thiếu prerequisites | Xem `references/procedures.md` → Section 5.2 |
| Ambiguous board status | Xem `references/procedures.md` → Section 5.4 |
| Pipeline abort | Xem `references/procedures.md` → Section 5.5 |

### 4.4: Retry Pattern

Khi subagent fail và human chọn retry:
1. Giữ nguyên context — không xóa outputs hiện có
2. Spawn subagent mới với prompt gốc + "Previous attempt failed: [error]. Hãy thử approach khác."
3. Giới hạn retry: tối đa 2 lần. Sau đó → skip hoặc abort
4. Xem `references/procedures.md` → Section 5.6

## Bước 5: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → Section 3.5 "Sprint Artifact Update".

Đặc biệt với flow task:
- Board: move task từ TODO → in progress (sau SRS) → ready (sau IMP∥TST)
- Backlog: cập nhật FR status
- README routing table: cập nhật `agent_docs/README.md` với phase status mới

---

## Concrete Example

### Feature Mới (TODO)

```
Human: "Triển khai task đăng nhập bằng OAuth2 cho service auth"

Orchestrator:
  1. Board check → tìm thấy task "OAuth2 Login" status TODO
  2. Grilling:
     - Feature: User đăng nhập bằng Google/GitHub OAuth2
     - Users: End users, không cần role đặc biệt
     - NFR: p95 < 500ms, availability 99.9%
     - Service mới: không (thêm vào auth service hiện có)
     → HLD optional (không có service mới)
  3. Scope: SRS → (skip HLD) → LLD → IMP∥TST
  4. Pipeline execution:
     - SRS: EnterPlanMode → Plan → Approve → sdlc-srs → Gate PASS
       → FR-AUTH-004: OAuth2 Login
     - LLD: EnterPlanMode → Plan → Approve → sdlc-lld → Gate PASS
       → auth-service.md updated (thêm OAuth2 section)
     - IMP∥TST: spawn song song → cả hai Gate PASS
     - Report: "✅ Pipeline hoàn thành. Next: flow cook để code."
  5. Sprint: board moved TODO → ready, backlog updated
```

### Cập Nhật Specs (ready)

```
Human: "Cập nhật IMP spec cho FR-AUTH-001: thêm rate limiting"

Orchestrator:
  1. Board check → FR-AUTH-001 status ready
  2. Grilling → chỉ IMP spec thay đổi, không ảnh hưởng API
  3. Scope: chỉ IMP (không chạy SRS/HLD/LLD/TST)
  4. Pipeline:
     - IMP: EnterPlanMode → Plan → Approve → sdlc-imp → Gate PASS
     - Báo cáo: "✅ IMP updated. TST không bị ảnh hưởng."
  5. Sprint: README routing table updated
```

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
| **Không tìm thấy** | "Task không có trên board. Tạo task mới trước khi chạy pipeline?" → nếu đồng ý: `Skill(sprint)` để tạo |

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

Chạy các phase đã xác định theo Specs Pipeline trong SKILL.md, tôn trọng optional HLD/LLD.

**Pipeline sequence:** SRS → (optional HLD) → (optional LLD) → IMP ∥ TST

Mỗi phase: EnterPlanMode → Plan agent → Human review → ExitPlanMode → Spawn sdlc-* agent → Verify gate → Report progress.

## Bước 5: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → "Sprint Artifact Update".

Đặc biệt với flow task:
- Board: move task từ TODO → in progress (sau SRS) → ready (sau IMP∥TST)
- Backlog: cập nhật FR status
- README routing table: cập nhật `agent_docs/README.md` với phase status mới

---
name: sdlc-workflow
description: >-
  Điều phối SDLC workflow end-to-end. Dùng khi bắt đầu feature mới (task), xử lý
  change request (cr), hoặc nấu task đã sẵn sàng để triển khai (cook). Hỗ trợ chế
  độ tự động (auto) và thủ công (manual) với xác minh gate.
argument-hint: "[task|cr|cook] [desc]"
disable-model-invocation: true
version: 1.2.0
allowed-tools: Read, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

# SDLC Workflow — Điều Phối Pipeline

Điều phối SDLC workflow end-to-end bằng cách xác định ý định của con người, kiểm tra trạng thái sprint board, và route sang skill `sdlc-phase-manual` hoặc `sdlc-phase-auto`.

## Quick Start

### Step 1: Parse Input

Trích xuất từ human input:

| Argument | Mô tả | Giá trị |
|----------|-------|---------|
| **workflow type** | Loại workflow | `task` — feature/task/story mới |
| | | `cr` — change request |
| | | `cook` — nấu task đã sẵn sàng |
| **desc** | Mô tả tự do | Free-text mô tả cần làm gì |

**Nếu thiếu workflow type hoặc desc**, dùng `AskUserQuestion` để thu thập:

```
Câu hỏi 1: "Bạn muốn thực hiện loại workflow nào?" (header: "Workflow")
  - "Task — feature/task/story mới"
  - "CR — Change Request"
  - "Cook — Triển khai task đã sẵn sàng"

Câu hỏi 2: "Mô tả ngắn gọn" (header: "Mô tả", free-text)
```

### Step 2: Xác Minh Trạng Thái Sprint Board

Trước khi tiếp tục, xác minh item tồn tại trong sprint board với trạng thái phù hợp.

Dùng `Skill(sprint)` để kiểm tra board:

| Workflow Type | Trạng Thái Yêu Cầu Trong Board | Cách Kiểm Tra |
|---------------|-------------------------------|---------------|
| **task** | `todo` | Board phải có task với trạng thái `todo` khớp với desc |
| **cr** | `done` hoặc `in review` | Board phải có task với trạng thái `done` hoặc `in review` khớp với desc |
| **cook** | `ready` | Board phải có task với trạng thái `ready` khớp với desc |

**Nếu không tìm thấy trong board — phân biệt theo workflow type:**

**Với `task`:**
- Báo: "Không tìm thấy task '{desc}' với trạng thái `todo` trong board."
- Gọi `Skill(brainstorming)` để cùng human làm rõ task này:
  - Task này là gì? Scope ra sao?
  - Có liên quan đến bounded context nào không?
  - Có cần tạo mới trong board không?
- Sau brainstorming, nếu human xác nhận → gọi `Skill(sprint)` thêm task vào board với trạng thái `todo`, rồi tiếp tục sang Step 3.
- Nếu human không muốn tiếp tục → dừng skill.

**Với `cr`:**
- Báo: "Không tìm thấy CR '{desc}' với trạng thái `done` hoặc `in review` trong board."
- Gọi `Skill(brainstorming)` để cùng human làm rõ impact dự kiến của CR:
  - CR này ảnh hưởng đến những phase nào? (HLD, LLD, IMP, TST?)
  - Có breaking changes không?
  - Scope thay đổi dự kiến là gì?
- Sau brainstorming, nếu human xác nhận → tiếp tục sang Step 3 với bối cảnh đã brainstorm.
- Nếu human không muốn tiếp tục → dừng skill.

**Với `cook`:**
> **TODO — sẽ xử lý sau.** Luồng cook khi không tìm thấy trong board sẽ được thiết kế trong bản cập nhật tiếp theo. Hiện tại, nếu không tìm thấy cook trong board với trạng thái `ready`, báo lỗi: "Task '{desc}' chưa sẵn sàng để cook (cần trạng thái `ready` trong board)." và dừng skill.

### Step 3: Xác Định Chế Độ và Gate Verify (Batch AskUserQuestion)

Dùng MỘT lần gọi `AskUserQuestion` batch với 2 câu hỏi để xác định đồng thời:

```
Câu hỏi 1: "Chế độ thực thi?" (header: "Chế Độ")
  - "Tự động (Auto)" — Không tương tác, chạy tự động qua workflow-sdlc-auto-pipeline
  - "Thủ công (Manual)" — Có sự tham gia của con người qua brainstorming tương tác

Câu hỏi 2: "Có chạy gate verify không?" (header: "Gate Verify")
  - "Có" — Chạy Agent(Explore) xác minh gate criteria sau mỗi phase
  - "Không (--no-gate)" — Bỏ qua gate verification
```

⏸️ Chờ human trả lời cả 2 câu hỏi.

### Step 3b: Plan Mode — Phê Duyệt Trước Khi Thực Thi

Sau khi có kết quả Step 3, vào `EnterPlanMode` để human phê duyệt kế hoạch thực thi:

**Nội dung plan phải hiển thị:**
- **Workflow type:** task / cr / cook
- **Mô tả:** desc từ Step 1
- **Chế độ:** Auto / Manual
- **Gate verify:** Có / Không
- **Phase(s) sẽ chạy:** Liệt kê các phase (SRS, HLD, LLD, IMP, TST)
- **Output dự kiến:** Các file sẽ được tạo/cập nhật

Viết plan vào `.claude/plans/` và gọi `ExitPlanMode`. Đợi human phê duyệt.

> **Quy tắc:** Tương tự, sau brainstorming (Step 2, nhánh không tìm thấy trong board) cũng phải vào `EnterPlanMode` trước khi tiếp tục sang Step 3 — để human xác nhận kết quả brainstorming và scope trước khi chọn chế độ.

### Step 4: Route Sang Phase Executor

Dựa trên kết quả Step 3:

| Chế Độ | Gate Verify | Route |
|---------|-------------|-------|
| Tự động (Auto) | Có | `Skill(sdlc-phase-auto)` với args: `[phase] [desc]` |
| Tự động (Auto) | Không | `Skill(sdlc-phase-auto)` với args: `[phase] [desc] --no-gate` |
| Thủ công (Manual) | Có | `Skill(sdlc-phase-manual)` với args: `[phase] [desc]` |
| Thủ công (Manual) | Không | `Skill(sdlc-phase-manual)` với args: `[phase] [desc] --no-gate` |

**Xác định phase từ workflow type:**

| Workflow Type | Phase(s) | Ghi Chú |
|---------------|----------|---------|
| **task** | SRS → HLD → LLD → IMP+TST | Pipeline tuần tự đầy đủ. Cả `sdlc-phase-auto` và `sdlc-phase-manual` đều nhận tất cả phase trong một lần gọi (vd: `srs hld lld imp tst`) và tự xử lý tuần tự nội bộ. |
| **cr** | HLD(opt) → LLD(opt) → IMP+TST | Chỉ chạy phase bị ảnh hưởng bởi change. Xác định phase cần chạy dựa trên impact của CR. Truyền các phase bị ảnh hưởng trong một lần gọi. |
| **cook** | IMP+TST | Chạy song song IMP và TST. Cả `sdlc-phase-auto` và `sdlc-phase-manual` đều nhận `imp tst` trong một lần gọi. |

**Với chế độ Manual + task (nhiều phase):** Gọi `Skill(sdlc-phase-manual)` MỘT LẦN với tất cả phase: `srs hld lld imp tst [desc]`. `sdlc-phase-manual` tự xử lý tuần tự nội bộ: khởi tạo một lần → mỗi phase vào plan mode → execute (specialist + verify) → report → human review → phase tiếp theo. Bạn không cần gọi lại skill cho từng phase.

**Với chế độ Manual + cr:** Xác định phase bị ảnh hưởng, gọi `Skill(sdlc-phase-manual)` MỘT LẦN với danh sách phase bị ảnh hưởng (vd: `hld lld imp tst [desc]`).

**Error handling:** Nếu `Skill(sdlc-phase-auto)` hoặc `Skill(sdlc-phase-manual)` không khả dụng (skill not found) → báo lỗi rõ ràng cho human: "Không tìm thấy skill [tên-skill]. Hãy kiểm tra plugin đã được cài đặt đúng cách chưa." Không tự động fallback hoặc thử alternative path.

### Step 5: Hiển Thị Kết Quả

Sau khi phase executor hoàn thành, hiển thị tóm tắt cho human:

- Workflow type đã chạy
- Chế độ: Auto/Manual
- Gate verify: Có/Không
- Phase đã thực thi và trạng thái
- Output files đã tạo
- Bất kỳ blockers hoặc issues nào

Nếu có failure, dùng `AskUserQuestion` hỏi human muốn xử lý thế nào:
- "Thử lại phase bị fail"
- "Bỏ qua và tiếp tục"
- "Dừng pipeline"

## Luồng Chi Tiết

Sơ đồ luồng chi tiết cho từng workflow type (task, cr, cook): xem `references/flows.md`.

## Key Notes

**Skill(sprint) integration.** Luôn dùng `Skill(sprint)` để kiểm tra và cập nhật sprint board — không bao giờ sửa file sprint trực tiếp.

**Không tự thực thi agent.** Skill này KHÔNG spawn subagent. Mọi execution được ủy thác cho `sdlc-phase-manual` hoặc `sdlc-phase-auto`.

**Plan mode trước khi thực thi.** Skill này vào `EnterPlanMode` sau khi xác định chế độ (Step 3b) và sau brainstorming (Step 2, nhánh không tìm thấy trong board). Human phải phê duyệt plan trước khi route sang phase executor.

**Batch AskUserQuestion.** Step 3 dùng MỘT lần gọi `AskUserQuestion` duy nhất với 2 câu hỏi. Không tách thành 2 lần gọi riêng — điều này giảm số lần tương tác với human.

**Language.** Toàn bộ giao tiếp với human bằng tiếng Việt. Technical terms và code identifiers giữ nguyên tiếng Anh.

**Error handling.** Mọi lỗi từ phase executor được hiển thị cho human kèm theo tùy chọn xử lý (thử lại, bỏ qua, dừng). Không tự động retry nếu không có sự đồng ý của human.

**Manual multi-phase.** Với chế độ Manual, gọi `Skill(sdlc-phase-manual)` MỘT LẦN duy nhất với tất cả phase cần chạy (vd: `srs hld lld imp tst [desc]`). `sdlc-phase-manual` xử lý toàn bộ chuỗi nội bộ: khởi tạo một lần (brainstorming cho TẤT CẢ phase) → từng phase tuần tự (EnterPlanMode → execute → report → human review). Bạn không cần gọi lại skill nhiều lần — việc tuần tự hóa và tương tác với human giữa các phase được xử lý bên trong skill.


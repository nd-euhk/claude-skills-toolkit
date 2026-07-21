# GAP-5: Automation Thiếu `task-flow.md` Reference File

**Severity:** LOW | **Effort:** S-M | **Status:** done

## Phân Tích

Orchestrator có dedicated flow reference files cho tất cả 4 flows. Automation có reference files cho cr flow và cook flow, nhưng task flow procedure nằm inline trong SKILL.md.

### Reference File Coverage

| Flow | orchestrator | automation |
|------|-------------|------------|
| task | `references/flow-task.md` (11,415 bytes) | ❌ inline trong SKILL.md (~150 dòng) |
| cr | `references/flow-cr.md` (9,191 bytes) | `references/cr-flow.md` (4,403 bytes) |
| cook | `references/flow-cook.md` (23,178 bytes) | `references/cook-flow.md` (19,934 bytes) |
| fixbug | `references/flow-fixbug.md` (10,382 bytes) | N/A (xem GAP-2) |

### So sánh nội dung

Automation task flow procedure (SKILL.md:119-222) cover:
- 4 rounds grilling toàn diện
- Automation scope xác nhận
- Workflow dispatch (`workflow-sdlc-automation.js`)
- Monitor & report

Orchestrator `flow-task.md` cover:
- Board check + status routing
- Grilling (business requirements → NFR → architecture → context)
- Pipeline execution (SRS→HLD→LLD→CROSS-CUTTING→IMP∥TST)
- Sprint update
- Edge cases

## Impact

Trung bình-thấp:
- SKILL.md đã khá dài (345 dòng) với task flow inline
- Không tách biệt rõ procedure ra khỏi routing logic
- Không consistent với cr/cook flow (có ref files riêng)

## Fix Plan

### Option A: Trích xuất task flow ra `references/task-flow.md` (Khuyến nghị)

- [x] Tạo `sdlc-automation/references/task-flow.md`:
  - Move grilling templates (4 rounds) từ SKILL.md
  - Move workflow dispatch code block
  - Move monitor & report template
  - Giữ trong SKILL.md: flow detection, routing logic
- [x] Cập nhật `sdlc-automation/SKILL.md`:
  - Thêm row trong reference table
  - Trỏ đến `references/task-flow.md` cho procedure chi tiết
- [x] Version bump: automation + plugin + CHANGELOG

### Option B: Chấp nhận asymmetry (Wontfix)

- Document rằng task flow trong automation đơn giản hơn (chỉ grill + dispatch) nên không cần ref file riêng
- Đóng gap với status `wontfix`

## Files Liên Quan

- `.claude/skills/sdlc-automation/SKILL.md:119-222` — task flow inline
- `.claude/skills/sdlc-automation/references/cr-flow.md` — CR reference (để so sánh)
- `.claude/skills/sdlc-automation/references/cook-flow.md` — cook reference (để so sánh)
- `.claude/skills/sdlc-orchestrator/references/flow-task.md` — orchestrator task flow (để tham khảo)

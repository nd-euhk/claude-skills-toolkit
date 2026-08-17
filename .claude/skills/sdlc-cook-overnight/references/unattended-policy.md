# Unattended Policy — Auto-Decision Table

Đêm chạy, controller tự quyết tại mọi điểm vốn cần human trong sdlc-cook. Đây là
phần "unattended" của overnight — không hỏi giữa chừng, mọi quyết định ghi vào log
và morning report để human review sáng.

## Auto-Decision Table

| # | Điểm HITL (trong sdlc-cook) | Auto-decision đêm | Morning report |
|---|------------------------------|-------------------|----------------|
| 1 | Feature không 🟢 Ready for Cook | Skip feature, ghi lý do (status hiện tại) | Mục Skipped |
| 2 | Feature không tồn tại trên board | Skip, ghi lỗi FEAT id không hợp lệ | Mục Skipped |
| 3 | Dependency (`depends_on`) chưa ✅ Done | Skip feature, ghi dependency + status | Mục Skipped |
| 4 | Feature đang 🚧 In Progress (cook khác đang chạy) | Skip — không spawn cook trùng | Mục Skipped |
| 5 | sdlc-review gợi ý (trước PR) | Bỏ qua — không review đêm | Không cần |
| 6 | PR creation | Auto tạo PR, KHÔNG merge | Mục PR created |
| 7 | INTERFERENCE (1 TC break test khác) | Dừng feature đó, ghi chi tiết (test broken, file, line) | Mục Failed |
| 8 | TC BLOCKED / STALE | Feature fail, ghi spec/tc cần human | Mục Failed |
| 9 | GATE light fail (sau retry ×2) | Feature failed, ghi gate failures | Mục Failed |
| 10 | GATE full fail (sau retry ×2) | Feature partial, ghi gate failures | Mục Partial |
| 11 | Workflow crash | Log crash, feature chưa xong. Sáng resume `resumeFromRunId` | Mục Failed/Blocked |
| 12 | REFACTOR break tests | REFACTOR auto-revert; warning | Mục Warnings |
| 13 | Merge conflict (khi PR) | Không resolve đêm — tạo PR như thường, ghi conflict warning | Mục Warnings |
| 14 | PR closed/merged | Không xảy ra đêm (human chỉ merge sáng) | — |
| 15 | Type 1: human chọn Parallel | Tự chuyển về Sequential — in-place checkout không song song được; ghi lý do | Plan summary |
| 16 | Type 1: restore branch gốc fail | Warning HIGH — chặn task kế (sub-repo đang ở branch task) | Mục Warnings |
| 17 | Type 1: sub-repo không có remote | Không auto-PR, log cảnh báo — sáng human tự push/PR | Mục Warnings |

## Nguyên Tắc

1. **Continue-on-fail** — mọi failure dừng feature đó, KHÔNG dừng batch. Feature kế vẫn chạy.
2. **Log everything** — mỗi auto-decision ghi: feature, điểm HITL, quyết định, lý do.
3. **No silent skip** — feature bị skip phải có lý do tường minh trong report.
4. **Never auto-merge** — bất kể GATE pass đến đâu.
5. **Spec không rõ = fail, không đoán** — STALE phải dừng feature, không tự suy diễn spec.
6. **Sáng nay là thời điểm quyết định** — report liệt kê mọi việc cần human (PR review,
   fail cần fix, dependency chưa xong), không giấu dưới implied completeness.

## Escalation Lên Orchestrator (sáng hôm sau)

Nếu feature fail vì spec sai/thiếu (không phải implementation error) → sáng đề xuất
human chạy orchestrator flow=`cr` (sửa specs) hoặc `task` (tạo specs mới). Overnight
KHÔNG tự sửa specs — theo đúng escalation protocol của `sdlc-orchestration-rules.md`.

## Edge Cases

### Baseline pre-existing failures > 10% suite

Ghi warning vào report: "N suite có N% tests fail trước TDD — cân nhắc fix trước".
Vẫn chạy feature (RED/GATE agent exclude pre-existing failures).

### Parallel + same-service

Nếu human chọn Parallel mà có feature cùng service → chạy như chọn, nhưng report
phải có mục "Merge conflict risk" ghi rõ feature nào cùng service.

### Worktree creation fail (Type 2) / in-place checkout fail (Type 1)

Ghi lý do (branch tồn tại / path tồn tại / disk full) theo
`sdlc-cook/references/error-recovery.md#worktree-fail`. Feature failed, tiếp tục batch.

### Mixed-type batch

Batch có cả Type 1 và Type 2 → chạy Sequential toàn bộ (Type 1 ép tuần tự). Không tách
lane "Type 2 song song + Type 1 tuần tự" trong cùng một đêm — phức tạp + dễ nhầm restore.

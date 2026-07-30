# Error Handling — sdlc-cook

Ma trận xử lý lỗi và cleanup policy cho cook flow. Controller load file này khi gặp
error trong bất kỳ phase nào.

---

## Error Handling Matrix

| Tình huống | Hành động |
|---|---|
| Worktree creation fails (branch đã có worktree) | Dùng timestamp unique name. Nếu vẫn fail → báo human |
| Worktree creation fails (disk space) | Báo human, đề xuất `git worktree prune` hoặc dọn `.claude/worktrees/` |
| RED returns BLOCKED (3 sabotage attempts) | Dừng TDD cycle, báo human kiểm tra thủ công |
| RED returns STALE (ambiguous spec) | Dừng TC đó, báo human. Option: skip TC, tiếp tục TCs khác |
| RED returns INTERFERENCE | Dừng TDD cycle, báo human: broken test + culprit TC |
| GREEN returns STUCK (5 iterations) | Dừng TC đó, báo human: test fail + hypothesis |
| GATE light INTERFERENCE-FULL | Dừng pipeline, báo human với interference table |
| GATE light FAIL (non-interference) | Spawn fix → retry (max 2). Vẫn fail → báo human |
| GATE full FAIL | Fix từng failure → retry (max 2). Vẫn fail → báo human |
| REFACTOR full gây test failure | REFACTOR agent tự undo + report. Verify test suite |
| Subagent crash / timeout | Báo human. Option: retry (max 2), skip, hoặc abort |
| Specs thiếu → không thể cook | Từ chối cook, đề xuất chạy flow task |
| Board status không phải ready | Route theo bảng readiness check |
| Worktree không thể xóa (có uncommitted changes) | Cảnh báo human: "Worktree có thay đổi chưa commit. Xóa an toàn với --force?" |

---

## Worktree Cleanup Policy

| Tình huống | Hành động |
|---|---|
| Cook hoàn thành + code đã push | **Xóa worktree** — code đã an toàn trên remote |
| Cook hoàn thành + chưa push | **Giữ worktree** — code còn trong worktree, hỏi human |
| Cook bị abort / fail | **Hỏi human** — giữ để debug hoặc xóa |
| Human yêu cầu giữ lại | **Giữ worktree**, nhắc human tự dọn dẹp sau |

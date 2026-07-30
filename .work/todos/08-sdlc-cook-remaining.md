---
date: 2026-07-29
status: in_progress
tags: [sdlc-cook, v4.5, multi-tasking]
---

# Todo — sdlc-cook v1.0.0 → Hoàn Thiện

## Priority 1: Hoàn thiện sdlc-cook skill ✅

### P1-01: Thêm argument-hint vào frontmatter ✅
- **Status:** Done (đã làm từ trước)

### P1-02: Thêm hỗ trợ --pool <N> trong flow-multi ✅
- **Status:** Done
- **Files changed:** `SKILL.md` (parse args + routing), `references/flow-multi.md` (POOL_CAPACITY từ args)
- **Rules:** min=1, max=10, warning nếu >5

### P1-03: ~~Thêm script update-pipeline-status.json~~ (đã revert)
- **Status:** Reverted — cơ chế pipeline status bị loại bỏ
- **Lý do:** Write-only mechanism, không ai đọc file, resume dùng `resumeFromRunId` + `COOK_REPORT`
- **Files changed:** Đã xóa `update-pipeline-status.{sh,js,py}`, dọn `workflow-sdlc-cook.js`, `pipeline-status.md`, `merge-manager.md`, `error-recovery.md`, `.gitignore`

### P1-04: Tích hợp sdlc-cook vào sprint system ✅
- **Status:** Done
- **Files changed:**
  - `templates/sprint/board-TEMPLATE.md` — thêm cột Worktree, Cook Status
  - `templates/sprint/backlog-TEMPLATE.md` — thêm cột Depends On
  - `agents/sdlc/sdlc-sprint-board.md` — thêm 🚧 Cooking status, WIP limit, transition rules
  - `agents/sdlc/sdlc-sprint-backlog.md` — thêm depends_on vào Step 2 + Step 3

### P1-05: Viết unit test cho project detection ✅
- **Status:** Done — 7/7 assertions pass
- **Files changed:**
  - `scripts/detect-project.sh` (mới) — function `classify_project` + helpers
  - `scripts/test-project-detection.sh` (mới) — 6 test cases, 7 assertions
  - `references/project-detection.md` — reference đến script

---

## Priority 2: Cleanup flow cook cũ (cần confirm trước khi làm)

### P2-01: Xóa flow cook khỏi sdlc-orchestrator
- ⚠️ **Cần human confirm**
- **Status:** 🔲 Todo

### P2-02: Xóa flow cook khỏi sdlc-automation
- ⚠️ **Cần human confirm**
- **Status:** 🔲 Todo

### P2-03: Merge sdlc-quick cook logic vào sdlc-cook --quick
- ⚠️ **Cần human confirm**
- **Status:** 🔲 Todo

### P2-04: Cập nhật sdlc-routing-rules.md
- ⚠️ **Cần human confirm**
- **Status:** 🔲 Todo

---

## Priority 3: Multi-tasking nâng cao

### P3-01: Worktree health check + timeout
- **Status:** 🔲 Todo

### P3-02: Dependency auto-unblock notification
- **Status:** 🔲 Todo

### P3-03: Benchmark pool capacity
- **Status:** 🔲 Todo

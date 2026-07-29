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

### P1-03: Cập nhật workflow ghi .pipeline-status.json ✅
- **Status:** Done
- **Files changed:**
  - `scripts/update-pipeline-status.sh` (mới) — atomic JSON update
  - `.claude/workflows/automation/workflow-sdlc-cook.js` — status instruction trong RED/GATE/REFACTOR prompts
  - `references/procedures.md` — cập nhật schema path
  - `references/merge-manager.md` — cập nhật path reference
  - `references/flow-multi.md` — cập nhật monitor poll path
  - `SKILL.md` — cập nhật integration points
  - `.gitignore` — thêm `.pipeline/`
- **Design:** `.pipeline/{frId}-status.json`, script atomic write, gitignored

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

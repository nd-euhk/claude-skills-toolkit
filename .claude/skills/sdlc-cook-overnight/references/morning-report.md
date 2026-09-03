# Morning Report — Template & Aggregation

Morning report là deliverable CHÍNH của sdlc-cook-overnight — human đọc nó sáng hôm
sau để biết: PR nào cần review, feature nào fail + lý do, việc gì cần quyết định.
File: `.work/reports/overnight-{YYYYMMDD}.md`.

## Aggregation Rules

Controller dựng report từ 2 nguồn (Phase 6 của SKILL.md):

1. **Checkpoint files** — `.work/reports/per-feature/*.json`, mỗi file là COOK_REPORT của 1
   feature (workflow persist ngay khi xong, qua `scripts/persist-cook-report.py` — atomic + validate).
   Đọc từ **disk**, không từ memory → controller crash/restart giữa đêm vẫn dựng lại được report
   cho mọi feature đã cook xong.
2. **Controller state** — skip list (feature không dispatch: không ready / baseline HARD-FAIL /
   dependency chưa Done), night-review verdict + link `.work/review/REVIEW-CODE-*.md`, PR link/number,
   branch + commit hash của feature fail (Type 1).

Phân loại feature theo status: DONE (completed + PR created) / PARTIAL (gate full fail, hoặc có
TC BLOCKED/STALE/ERROR nhưng gate vẫn pass) / FAILED (gate light fail, toàn bộ TC fail, hoặc
INTERFERENCE) / SKIPPED.

## Template

```markdown
---
date: {YYYY-MM-DD}
status: ready-for-review
strategy: {sequential|parallel|pick}
features_requested: {N}
features_cooked: {X}
---

# Overnight Cook Report — {YYYY-MM-DD}

## Tóm Tắt

- **Features DONE (PR sẵn sàng review):** {X}
- **Features PARTIAL (gate full fail):** {Y}
- **Features FAILED:** {Z}
- **Features SKIPPED:** {W}
- **Warnings:** {count}

## Chi Tiết Per Feature

| FEAT | FR | Service | Status | PR link | GATE light | GATE full | TCs (done/total) |
|------|-----|---------|--------|---------|------------|-----------|------------------|
| FEAT-002 | FR-AUTH-005 | auth-service | ✅ DONE | [PR #12](...) | PASS | PASS | 3/3 |
| FEAT-003 | FR-AUTH-006 | auth-service | ❌ FAILED | — | FAIL | — | 1/2 |

## Failed / Partial — Chi Tiết + Lý Do

### FEAT-003 — INTERFERENCE (FR-AUTH-006)
- **Broken test:** `should_validate_email` trong `AuthServiceTest.java:45`
- **Culprit files:** `UserService.java:120`, `UserValidator.java:34`
- **Next:** sáng xử lý interference → resume `resumeFromRunId` (worktree giữ nguyên)

### FEAT-004 — GATE full fail
- **Failures:** F5 Security — raw SQL concat `UserRepository.java:45`
- **Next:** fix trong worktree, re-run cook

## Skipped — Lý Do

| FEAT | Lý do |
|------|-------|
| FEAT-005 | Chưa đủ specs (không 🟢 Ready for Cook) |
| FEAT-006 | Dependency FEAT-003 chưa ✅ Done |

## Warnings

- {warning nếu có: pre-existing failures > 10%, parallel same-service risk, refactor break}

## Việc Cần Human Sáng Nay

1. **Review + merge PRs** — {link từng PR}
2. **Xử lý fail** — INTERFERENCE/GATE fail (worktree giữ nguyên, resume sẵn sàng)
3. **Quyết định** — feature STALE/BLOCKED cần làm rõ spec → đề xuất orchestrator
   flow=`cr` (sửa specs) hoặc `task` (tạo specs mới)
4. **Cleanup sau merge** — xóa worktree + branch + board ✅ Done
```

## Cleanup Sau Khi Human Xử Lý (sáng)

Sau khi human merge PRs (cleanup theo type — controller KHÔNG `cd`, mọi lệnh qua `git -C`):
- **Type 2 (workspace-member):** xóa worktree + branch:
  `git -C "$project_root" worktree remove "$WORKTREE_PATH" --force` + `git -C "$project_root" branch -D "$BRANCH"`
- **Type 1 (submodule/gitignored):** KHÔNG có worktree — sub-repo đã `checkout "$ORIGINAL_BRANCH"`
  ở sdlc-cook Bước 10 (finally). Chỉ xóa branch: `git -C "$project_root" branch -D "$BRANCH"`
- Board + backlog: spawn `sdlc-sprint-board` (→ ✅ Done) + `sdlc-sprint-backlog`
- Chi tiết: `sdlc-cook/references/merge-manager.md#cleanup-procedure`

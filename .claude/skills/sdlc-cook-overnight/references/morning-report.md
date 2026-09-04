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
   dependency chưa Done / upstream chain failed), **baseRef per feature** (default integration;
   chained = branch upstream) + chain relationship (thứ tự FR_1 → FR_2 → ...), night-review verdict
   + link `.work/review/REVIEW-CODE-*.md`, PR link/number, branch + commit hash của feature fail (Type 1).

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

| FEAT | FR | Service | Base | Status | PR link | GATE light | GATE full | TCs (done/total) |
|------|-----|---------|------|--------|---------|------------|-----------|------------------|
| FEAT-002 | FR-AUTH-005 | auth-service | origin/main | ✅ DONE | [PR #12](...) | PASS | PASS | 3/3 |
| FEAT-003 | FR-AUTH-006 | auth-service | origin/main | ❌ FAILED | — | FAIL | — | 1/2 |

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
| FEAT-006 | Dependency FEAT-003 chưa ✅ Done (khác root / không in-batch) |
| FEAT-007 | Upstream chain FEAT-003 failed (chain halt — FR-... {status}) |

## Chain Merge Order (nếu có chained FR)

Stacked PRs phải merge **BOTTOM-UP** theo thứ tự chain — không merge FR_k trước FR_(k-1) (diff FR_k
chứa code upstream; merge FR_k sớm sẽ kéo theo cả diff upstream chưa review).

- FR-AUTH-005 → FR-AUTH-006 → FR-AUTH-007
  - [PR #12](...) — FR-AUTH-005, base `origin/main` → merge TRƯỚC
  - [PR #13](...) — FR-AUTH-006, base `feature/...FR-AUTH-005...` → merge SAU PR #12
  - [PR #14](...) — FR-AUTH-007, base `feature/...FR-AUTH-006...` → merge SAU PR #13
- Nếu PR upstream bị "request changes" → branch upstream đổi → FR kế cần **rebase tay** (checkout
  branch FR kế, rebase lên branch upstream mới, force-push). Skill không tự làm — cảnh báo ở đây.

## Warnings

- {warning nếu có: pre-existing failures > 10%, parallel same-service risk, refactor break}

## Pre-existing Red TCs (Tolerated — KHÔNG do cook này)

Mỗi feature checkpoint (`.work/reports/per-feature/*.json`) mang **5 field** để phân loại chính
xác trạng thái sau cook (không chỉ "full baseline list"):

- `preExistingFailures[]` — **full baseline list**: các TC đã đỏ TRƯỚC khi cook chạy (carry-forward).
- `preExistingStillFailing[]` — **vẫn đỏ sau cook**: subset chính xác từ `baseline compare --json`
  (GATE light INTERFERENCE-FULL). Mỗi phần tử là object `{test, file, baseline_status, current_status, error}`.
- `interference[]` — regression (baseline pass → giờ fail) do cook gây ra.
- `notInBaselineNowFailing[]` — test không có trong baseline mà giờ fail.
- `flaky[]` — test fail lần chạy suite nhưng PASS khi re-run riêng (retry-before-fail): không phải
  regression, không fail L1.

**Phân loại:**

- **Vẫn đỏ sau cook** (`preExistingStillFailing`) → mở ticket riêng (outside scope feature này),
  **KHÔNG chặn merge PR**.
- **Vô tình được fix** = `preExistingFailures` − `preExistingStillFailing` → không cần ticket;
  ghi nhận trong report là bonus (cook đã fix incidental bug) — human xác nhận test thực sự xanh
  vì đúng lý do, không phải tạm pass.
- **Flaky** (`flaky`) → không chặn merge, nhưng cần human ổn định hóa test sau này (ticket tech-debt).
- Human sáng nay quyết định: xử lý riêng hay để nguyên — không tự sửa trong cook này.

Ví dụ dòng per feature:
- {FEAT-xxx} — {N} pre-existing: {M} vẫn đỏ (`{test}` trong `{file}`), {K} vô tình được fix.

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
  ngay trong đêm (per-feature-cook §7 — cuối chain / chain halt; không chờ cleanup sáng). Sáng chỉ xóa
  branch: `git -C "$project_root" branch -D "$BRANCH"`
- **Chained branch/worktree:** cleanup **BOTTOM-UP** theo thứ tự chain — xóa branch/worktree FR kế
  trước, rồi upstream. KHÔNG xóa branch upstream khi downstream chưa merged (downstream diff chứa
  upstream code; branch upstream là base cho tới khi downstream merged xong)
- Board + backlog: spawn `sdlc-sprint-board` (→ ✅ Done) + `sdlc-sprint-backlog`
- Chi tiết: `sdlc-cook/references/merge-manager.md#cleanup-procedure`

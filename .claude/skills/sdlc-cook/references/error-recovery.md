# Error Recovery Decision Tree

Centralized error handling cho tất cả cook flows. Mỗi error scenario có decision tree:
nguyên nhân → chẩn đoán → options → hành động.

> **Nơi chạy code theo type (CODE_DIR):** mọi hướng dẫn "trong worktree" dưới đây áp
> dụng cho `CODE_DIR` — worktree (Type 2) hoặc sub-repo `project_root` (Type 1). Type 1
> không có worktree: sub-repo đang đứng branch task do in-place checkout, thao tác trực
> tiếp tại `project_root` và restore `$ORIGINAL_BRANCH` sau khi xử lý.

## Quick Reference

| Error | Severity | Auto-fix? | Section |
|-------|----------|-----------|---------|
| INTERFERENCE | CRITICAL | No | [#interference](#interference) |
| TC BLOCKED | HIGH | No | [#tc-blocked](#tc-blocked) |
| TC STALE | MEDIUM | No | [#tc-stale](#tc-stale) |
| GATE light FAIL | HIGH | Retry ×2, then escalate | [#gate-fail](#gate-fail) |
| GATE full FAIL | MEDIUM | Retry ×2, then escalate | [#gate-fail](#gate-fail) |
| REFACTOR breaks tests | HIGH | Auto-revert | [#refactor-break](#refactor-break) |
| Merge conflict | MEDIUM | Agent-assisted | [#merge-conflict](#merge-conflict) |
| PR closed | LOW | Human decides | [#pr-closed](#pr-closed) |
| Worktree add fail (Type 2) / in-place checkout fail (Type 1) | CRITICAL | No | [#worktree-fail](#worktree-fail) |
| Workflow crash | CRITICAL | Resume via idempotent | [#workflow-crash](#workflow-crash) |

---

## INTERFERENCE

**Symptom:** TC-N pass nhưng break test khác trong cùng file.

**Workflow behavior:** Dừng toàn bộ pipeline. Return status `failed` với
INTERFERENCE count > 0.

**Human options (theo thứ tự ưu tiên):**

1. **Agent fix trong CODE_DIR** — cho agent sửa interference, chạy lại TC-N
2. **Human fix thủ công** — vào CODE_DIR, sửa code, chạy lại cook với
   `resumeFrom` để skip TCs đã done
3. **Revert TC-N** — `git revert` changes của TC-N trong CODE_DIR, skip TC này,
   tiếp tục các TC còn lại
4. **Accept interference** — nếu test bị break đã obsolete, update test đó
   (cần human judgment)

**Resume:** Sau khi fix → set `resumeFrom.completedTcIds` với tất cả TCs đã
DONE trước interference, workflow skip những TC đó và chạy lại TC bị interference
+ các TC sau.

---

## TC BLOCKED

**Symptom:** Sau 3 lần sabotage, test vẫn PASS (accidental green không thể
xác nhận).

**Workflow behavior:** TC status = BLOCKED, vẫn tiếp tục các TC khác nếu còn.

**Human action:**

1. Kiểm tra xem test case này có thực sự cần implementation mới không
2. Nếu implementation đã tồn tại → TC này là SKIPPED (đã có sẵn)
3. Nếu sabotage không đủ mạnh → viết test mạnh hơn, chạy lại
4. Nếu spec ambiguous → sửa spec (cần human judgment)

---

## TC STALE

**Symptom:** Spec không đủ rõ để viết test.

**Workflow behavior:** TC status = STALE, vẫn tiếp tục các TC khác.

**Human action:** Làm rõ spec trong `agent_docs/` → chạy lại cook với resume.

---

## GATE Fail

**Symptom:** GATE light hoặc full FAIL sau 2 retries.

**Workflow behavior:**
- GATE light fail → dừng pipeline, không chạy REFACTOR full
- GATE full fail → vẫn return report với status `partial`

**Diagnosis (theo thứ tự):**

1. Đọc failure list trong report → xác định gate nào fail
2. GATE light failures thường là hard boundary violations (L2-L4) →
   cần sửa architecture hoặc code
3. GATE full failures thường là quality issues (F5-F10) →
   có thể fix trong worktree

**Human options:**

1. **Fix trong CODE_DIR** — sửa code, chạy lại cook với
   `resumeFrom.gateLightPass = true` (nếu light đã pass)
2. **Accept risk** — nếu failure là false positive, document exception
3. **Escalate lên orchestrator** — nếu cần thay đổi architecture/spec

---

## REFACTOR Break

**Symptom:** REFACTOR agent báo `testSuiteStillPassing: false`.

**Workflow behavior:** Ghi warning, vẫn tiếp tục GATE full.

**Auto-recovery:** REFACTOR agent được hướng dẫn auto-revert changes gây test
failure. Nếu vẫn fail → human kiểm tra.

**Human action:** Vào CODE_DIR, `git diff` xem refactor đã thay đổi gì,
xác định change gây fail, revert thủ công.

---

## Merge Conflict

> **PR-specific procedures** (gh pr create, push, cleanup sau conflict): → `references/merge-manager.md#conflict-handling`

### Conflict khi tạo PR

```
FEAT-A sửa file X (đã cook, đang PR)
FEAT-B merge trước, cũng sửa file X
→ FEAT-A PR conflict với target branch
```

**Resolution:**

```bash
git -C "$CODE_DIR" fetch origin "$target_branch"
git -C "$CODE_DIR" merge "origin/$target_branch"
# Nếu conflict → agent resolve hoặc human resolve
```

**Options:**

1. Agent resolve conflict trong worktree → push lại → PR tự update
2. Human resolve thủ công
3. Tạo worktree mới từ target branch, cherry-pick changes → PR mới

### Conflict trên GitHub (human gặp khi merge)

→ Detect PR status = "conflict" → báo human:
"PR #N không merge được do conflict. Options: [Resolve in worktree] [Rebase PR]"

---

## PR Closed

**Symptom:** Human close PR mà không merge.

**Workflow behavior:** Hỏi human keep or delete worktree.

| Human choice | Worktree | Board |
|-------------|----------|-------|
| Keep | Giữ nguyên, có thể mở lại PR sau | Giữ status |
| Delete | Cleanup worktree + branch | FEAT → 🔲 Todo |

---

## Worktree Fail

Covers: `git worktree add` fail (Type 2) + in-place `git checkout -b` fail (Type 1).
Feature failed → tiếp tục batch (continue-on-fail). Type 1: restore `$ORIGINAL_BRANCH`
vẫn bắt buộc khi feature kết thúc.

### Type 2 — Worktree Add Fail

**Symptom:** `git worktree add` fail.

**Common causes + fix:**

| Cause | Fix |
|-------|-----|
| Branch đã tồn tại | `git -C "$project_root" branch -D feature/{feat}-{svc}` rồi thử lại |
| Worktree path đã tồn tại | `git -C "$project_root" worktree remove {path} --force` rồi thử lại |
| Permission denied | Kiểm tra quyền ghi `.claude/worktrees/` |
| Disk full | Giải phóng disk space |

### Type 1 — In-place Checkout Fail

**Symptom:** `git -C "$project_root" checkout -b "$BRANCH"` fail trong sub-repo.

**Common causes + fix:**

| Cause | Fix |
|-------|-----|
| Working tree dirty (uncommitted changes chặn checkout) | `git -C "$project_root" stash` (hoặc commit) rồi checkout lại |
| Branch đã tồn tại | `git -C "$project_root" branch -D "$BRANCH"` rồi thử lại |
| Detached HEAD | Checkout branch gốc rõ ràng trước: `git -C "$project_root" checkout "$ORIGINAL_BRANCH"` |
| Submodule gitlink thay đổi | Từ parent: `git -C "$parent" submodule update --init` |

---

## Workflow Crash

**Symptom:** Workflow agent crash hoặc bị kill giữa chừng.

**Recovery:** Có 2 cơ chế resume, dùng theo thứ tự ưu tiên:

### 1. Tool-level resume (ưu tiên hàng đầu)

Dùng `resumeFromRunId` của Workflow tool. Tool tự động cache kết quả
của các `agent()` call đã hoàn thành. Khi resume, những call có cùng
(prompt, opts) trả về cached result instantly — không cần chạy lại.

```js
Workflow({
  scriptPath: ".claude/workflows/cook/workflow-sdlc-cook.js",
  resumeFromRunId: "wf_abc123",  // ID từ lần chạy trước
  args: { /* ... giữ nguyên args gốc ... */ }
})
```

### 2. Script-level resume (fallback)

Nếu tool-level resume không khả dụng (vd: prompt đã thay đổi), dùng
`resumeFrom` arg để skip phase đã hoàn thành. Dữ liệu để build
`resumeFrom` lấy từ `COOK_REPORT` của lần chạy trước (nếu workflow đã
return partial) hoặc từ `log()` output:

```js
Workflow({
  args: {
    // ... all original args ...
    resumeFrom: {
      completedTcIds: ['1', '2', '3'],
      gateLightPass: true,
      refactorDone: false,
      gateFullPass: false,
    }
  }
})
```

Workflow skip completed phases, resume từ phase đầu tiên chưa done.

**Giới hạn:** Resume không handle code changes giữa các lần chạy.
Nếu human đã sửa code trong worktree giữa các lần chạy → kết quả có thể
không nhất quán. Luôn verify GATE pass sau resume.

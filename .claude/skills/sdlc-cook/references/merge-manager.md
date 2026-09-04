# Merge Manager

Quy trình merge sau khi cook workflow hoàn thành. Áp dụng cho single feature cook.

## Merge Flow

```
Workflow done
     │
     ▼
┌──────────────┐
│ Pre-merge    │  ← Run full test suite, verify GATE pass
│ Check        │
└──────┬───────┘
       │ PASS
       ▼
┌──────────────────┐
│ sdlc-review-codechange      │  ← Non-blocking: AskUserQuestion
│ Gợi Ý (optional) │     "Chạy sdlc-review-codechange?"
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│ Create PR    │  ← delegate skill git: worktree branch → target branch
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Human Review │  ← Merge? Request changes? Close?
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
Merge    Request
+Cleanup  Changes
```

## Pre-merge Check

### Bước 1: Verify Tất Cả Tests Pass

Nơi chạy code + base branch theo type — dùng cho toàn bộ merge flow:

```bash
# Type 2 (workspace-member):      CODE_DIR="$worktree_path"   PR_BASE=derive qua skill git (KHÔNG auto main — xem Bước 3)
# Type 1 (submodule/gitignored):  CODE_DIR="$project_root"    PR_BASE="$ORIGINAL_BRANCH" (branch gốc sub-repo — explicit)

# Detect framework + run tests (CWD = CODE_DIR):
(cd "$CODE_DIR" && ./gradlew :{service}:test)   # hoặc lệnh theo framework
# - Maven:  ./mvnw test
# - Jest:   npx jest
# - Vitest: npx vitest run
# - pytest: python -m pytest
# - Go:     go test ./...
```

### Bước 2: Verify GATE Status

Xác nhận `gate_light` và `gate_full` = PASS từ `COOK_REPORT`
do workflow trả về. Không cần đọc file riêng — workflow đã verify
và trả về kết quả trong report.

### Bước 3: Verify Không Có Uncommitted Changes Sót

```bash
if [ -n "$(git -C "$CODE_DIR" status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes trong $CODE_DIR"
  exit 1
fi
```

## sdlc-review-codechange Gợi Ý

Sau khi pre-merge check pass, gợi ý human chạy sdlc-review-codechange để kiểm tra
source code trong worktree trước khi tạo PR. Đây là bước không chặn (non-blocking)
— human có thể skip và chuyển thẳng sang tạo PR.

### Flow

```
Pre-merge Check PASS
     │
     ▼
┌──────────────────────┐
│ AskUserQuestion:     │
│ Chạy sdlc-review-codechange     │
│ --code trên worktree?│
└──────┬───────────────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
Review    Skip
--code    (tiếp tục
worktree  tạo PR)
  │
  ▼
┌────────────────────────┐
│ Skill("sdlc-review-codechange",    │
│   "--code --full " +    │
│   CODE_DIR)             │
└────────────────────────┘
  │
  ▼
sdlc-review-codechange tự chạy:
  scout → 7-dimension review
  → report → return
  │
  ▼
Tiếp tục PR Creation
```

### AskUserQuestion Template

```javascript
AskUserQuestion({
  questions: [{
    question: "Code đã sẵn sàng (tests pass, GATE verified). Bạn có muốn "
      + "chạy sdlc-review-codechange để kiểm tra source code trong worktree "
      + "trước khi tạo PR không?",
    header: "Code Review",
    options: [
      { label: "Review code",
        description: "Chạy sdlc-review-codechange --full --base <PR target> --specs <spec dir> "
          + "trên worktree. Review scope = diff giữa feature branch và target + Spec Compliance "
          + "(code có đáp ứng tài liệu). 8 dimension: architecture, security, bugs, conventions, "
          + "feature impact, operational, test quality, spec compliance." },
      { label: "Bỏ qua",
        description: "Không chạy review, chuyển sang tạo PR luôn." }
    ],
    multiSelect: false
  }]
})
```

### Gọi sdlc-review-codechange

Nếu human chọn "Review code":

```javascript
// CODE_DIR đã có từ SKILL.md Bước 3-4 (Project Detection + Tách Branch type-aware)
// BASE_BRANCH = PR target (merge target):
//   Type 2 → PR_BASE — derive qua skill git (KHÔNG auto "origin/main"; release-branch → integration)
//   Type 1 → ORIGINAL_BRANCH (branch sub-repo đứng trước khi checkout feature)
// SPECS_DIR = spec feature: ${WORKSPACE_ROOT}/agent_docs/features/${FEAT_ID}
//   (SRS + IMP + TST — để review trả lời "code có đáp ứng tài liệu không")
// --base → review scope = diff feature...target (chỉ code thay đổi).
// --specs → thêm dimension Spec Compliance (GAP/PARTIAL/DIVERGENT/IMPLEMENTED).
Skill("sdlc-review-codechange", "--full --base " + BASE_BRANCH + " --specs " + SPECS_DIR + " " + CODE_DIR)
```

sdlc-review-codechange sẽ:
1. Detect branch hiện tại + dùng `BASE_BRANCH` → scope review = diff (Phase 1d)
2. Đọc spec tại `SPECS_DIR` → thêm dimension Spec Compliance (Phase 1e)
3. Chạy scout trên `CODE_DIR` (worktree Type 2 / sub-repo Type 1) để phát hiện project structure
4. Dispatch code review workflow (8 dimension agents song song, focus vào changed files)
5. Tạo report trong `.work/review/REVIEW-CODE-YYYYMMDD--{sanitized-path}.md`
6. Return về sdlc-cook kèm summary findings

### Xử lý lỗi

Tất cả lỗi đều non-blocking — tạo PR luôn có thể tiếp tục:

| Lỗi | Hành động |
|-----|-----------|
| sdlc-review-codechange skill không tìm thấy | Cảnh báo: "Plugin cần cài đặt lại." → tiếp tục tạo PR |
| sdlc-review-codechange workflow script không tồn tại | sdlc-review-codechange tự báo lỗi "Plugin cần cài đặt lại" → tiếp tục tạo PR |
| sdlc-review-codechange partial failure (1-2 dimensions fail) | sdlc-review-codechange báo cáo dimensions bị fail, vẫn tạo report → tiếp tục tạo PR |
| sdlc-review-codechange total failure | sdlc-review-codechange return verdict=ERROR → báo "sdlc-review-codechange không tạo được kết quả" → tiếp tục tạo PR |

---

## PR Creation

### Bước 1: Commit (nếu chưa)

Workflow agent đã commit sau mỗi phase. Kiểm tra xem có commit nào chưa push không:

```bash
git -C "$CODE_DIR" log "$PR_BASE"..HEAD --oneline
```

### Bước 2: Push Branch

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
git -C "$CODE_DIR" push origin "$BRANCH" --force-with-lease
```

### Bước 3: Tạo PR — delegate qua skill `git`

Xác định `PR_BASE` (target) trước; rồi **delegate PR/MR creation qua skill `git` operation
`pr`** (`Skill("git", "pr ${BRANCH} --to ${PR_BASE} --repo ${CODE_DIR} --title ... --body ...")`)
— KHÔNG tự chạy `gh`/`glab`/REST inline ở sdlc-cook. Skill git lo host-detect (GitHub→`gh`,
GitLab→`glab`, GitLab không `glab` → REST qua git-credential PAT), auth guard, target derivation,
fallback log tay.

**Auth guard / host fail** (kể cả GitLab-REST 401 — password thường không phải PAT) → KHÔNG
tạo, KHÔNG treo interactive (đêm không ai trả lời), log `PR-ready (lý do)` — `gh-auth-fail` /
`glab-auth-fail` / `gitlab-rest-401` / host lạ → sáng tạo tay.

**PR body** (truyền qua `--body`):

```bash
PR_BODY="## Summary
- **Feature:** ${feature_name}
- **FR:** ${FR_ID}
- **Service:** ${service} (\`${code_path}\`)
- **Project Type:** ${project_type}
- **TCs:** ${tc_done}/${tc_total} DONE
- **GATE Light:** ${gate_light}
- **GATE Full:** ${gate_full}

## Changed Files
$(git -C "$CODE_DIR" diff --stat "$PR_BASE")

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

> **Self-host GitLab / GitLab-REST:** việc tạo MR delegate qua skill `git` — nó tự route: có `glab` →
> `glab`; không `glab` nhưng git-credential store có PAT → REST (`git/references/gitlab-rest-mr.md`);
> plain password (401) → log tay. `gh` chỉ github.com/GHE — KHÔNG dùng `gh` cho GitLab.

### PR_BASE Theo Project Type

`PR_BASE` = target branch mà skill `git` `pr` nhận qua `--to`. KHÔNG hardcode `origin/main`:

| Project Type | PR_BASE |
|-------------|---------|
| **submodule** | Default branch của submodule (= `$ORIGINAL_BRANCH` — explicit) |
| **gitignored-subproject** | Default branch của subproject (= `$ORIGINAL_BRANCH` — explicit) |
| **workspace-member** | Chain → branch upstream FR (stacked). Plain → derive qua skill git — main có thể stale |

workspace-member plain: nếu `main` không phải ancestor của HEAD / không phải nơi MR repo đi
(release-branch workflow, vd MR target `releases/7.2.0`) → target `main` kéo rác. Để skill git derive
theo `git/references/workflow-pr.md` Step 3 (MR-convention → branch gần nhất), hoặc bỏ `--to` cho `pr`
tự quyết. Interactive không chắc → hỏi human, không target mù.

## Human Review Flow

### Merge Approved

```
Human clicks "Merge" trên PR
     │
     ▼
┌──────────────────┐
│ Cleanup Worktree │
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Update Board     │
│ FEAT → ✅ Done   │
└──────────────────┘
```

### Changes Requested

```
Human requests changes trên PR
     │
     ▼
Báo human: "PR #42: changes requested. Review comments: ..."
     │
     ▼
┌──────────────────────────┐
│ Agent quay lại CODE_DIR (worktree Type 2 / checkout branch task lại trong sub-repo Type 1) │
│ Sửa theo review comments │
│ Push lại branch          │
│ PR tự update             │
└──────────────────────────┘
```

### PR Closed Without Merge

```
Human closes PR
     │
     ▼
Hỏi human: "PR #42 closed without merge. Keep worktree? Delete?"
     │
     ├─ Keep → worktree giữ nguyên, có thể mở lại PR sau
     └─ Delete → cleanup worktree, update board: FEAT → 🔲 Todo
```

## Cleanup Procedure

Cleanup theo type:
- **Type 2 (workspace-member):** xóa worktree + branch (dưới).
- **Type 1 (submodule/gitignored):** KHÔNG có worktree — sub-repo đã được
  `checkout "$ORIGINAL_BRANCH"` ở SKILL.md Bước 10 (finally). Chỉ xóa branch
  `feature/...` local + remote của sub-repo.

```bash
FEAT_ID="FEAT-001"
SERVICE="auth-service"
BRANCH="feature/${FEAT_ID}-${SERVICE}"

# ── Type 2: xóa worktree (từ project root) ──
WORKTREE_NAME="feature-${FEAT_ID}-${SERVICE}"      # / → - cho directory
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/${WORKTREE_NAME}"
git -C "$project_root" worktree remove "$WORKTREE_PATH" --force
git -C "$project_root" branch -D "$BRANCH" 2>/dev/null || true
git -C "$project_root" push origin --delete "$BRANCH" 2>/dev/null || true

# ── Type 1: chỉ xóa branch sub-repo (sub-repo đã restore ở Bước 10) ──
git -C "$project_root" branch -D "$BRANCH" 2>/dev/null || true
git -C "$project_root" push origin --delete "$BRANCH" 2>/dev/null || true

# ── Update board + backlog (cả 2 type) ──
# Spawn song song — mỗi agent chỉ ghi file riêng
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Mark FEAT-001 done on board",
  prompt: "FR-{DOM}-{NNN} → ✅ Done. PR merged."
})
Agent({
  subagent_type: "sdlc-sprint-backlog",
  description: "Mark FEAT-001 done on backlog",
  prompt: "FEAT-{NNN} status → ✅ Done."
})
```

## Conflict Handling

Xử lý conflict toàn diện (decision tree, resolution options, worktree recovery):
→ `references/error-recovery.md#merge-conflict`

Phần này chỉ cover PR-specific procedures sau khi conflict đã được resolve.

### Sau Khi Conflict Được Resolve

```bash
# 1. Fetch latest target branch
git -C "$CODE_DIR" fetch origin "$target_branch"

# 2. Merge target branch vào branch hiện tại (worktree Type 2 / sub-repo Type 1)
git -C "$CODE_DIR" merge "origin/$target_branch"

# 3. Push lại → PR tự update
git -C "$CODE_DIR" push origin "$BRANCH" --force-with-lease
```

### Conflict Khi Merge Trên GitHub

```
Human click "Merge" → GitHub báo conflict
→ Báo human: "PR #42 không merge được do conflict.
   Xem error-recovery.md#merge-conflict để có resolution options."
```

## PR Status Polling

Poll PR/MR status định kỳ theo host repo (skill `git` chưa có op poll riêng — chỉ cm/cp/pr/merge):

```bash
# GitHub / GitHub Enterprise → `gh`:
gh pr view "$PR_URL" --json state,mergeable,reviews --jq '.'
```

GitLab MR (tạo qua skill git — `glab`/REST): không dùng `gh` cho GitLab; theo dõi qua MR `web_url`
(có từ lúc tạo) trên web. Bảng state dưới áp dụng chung cho PR + MR.

| PR State | Hành động |
|----------|-----------|
| `OPEN` + `mergeable=true` | Báo human: "PR ready to merge" |
| `OPEN` + `mergeable=false` | Conflict → xử lý conflict |
| `MERGED` | Cleanup + update board |
| `CLOSED` | Hỏi human: keep or delete worktree |
| `OPEN` + review `CHANGES_REQUESTED` | Agent sửa trong CODE_DIR |

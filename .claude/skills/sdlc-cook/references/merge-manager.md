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
│ sdlc-review      │  ← Non-blocking: AskUserQuestion
│ Gợi Ý (optional) │     "Chạy sdlc-review --code?"
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│ Create PR    │  ← gh pr create: worktree branch → target branch
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

```bash
cd "$worktree_path"

# Detect framework + run tests:
# - Gradle:  ./gradlew :{service}:test
# - Maven:   ./mvnw test
# - Jest:    npx jest
# - Vitest:  npx vitest run
# - pytest:  python -m pytest
# - Go:      go test ./...
```

### Bước 2: Verify GATE Status

Xác nhận `gate_light` và `gate_full` = PASS từ `COOK_REPORT`
do workflow trả về. Không cần đọc file riêng — workflow đã verify
và trả về kết quả trong report.

### Bước 3: Verify Không Có Uncommitted Changes Sót

```bash
cd "$worktree_path"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes trong worktree"
  exit 1
fi
```

## sdlc-review Gợi Ý (--code)

Sau khi pre-merge check pass, gợi ý human chạy sdlc-review --code để kiểm tra
source code trong worktree trước khi tạo PR. Đây là bước không chặn (non-blocking)
— human có thể skip và chuyển thẳng sang tạo PR.

### Flow

```
Pre-merge Check PASS
     │
     ▼
┌──────────────────────┐
│ AskUserQuestion:     │
│ Chạy sdlc-review     │
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
│ Skill("sdlc-review",    │
│   "--code --full " +    │
│   worktree_path)        │
└────────────────────────┘
  │
  ▼
sdlc-review tự chạy:
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
      + "chạy sdlc-review --code để kiểm tra source code trong worktree "
      + "trước khi tạo PR không?",
    header: "Code Review",
    options: [
      { label: "Review code",
        description: "Chạy sdlc-review --code --full trên worktree. "
          + "7 dimension: architecture, security, bugs, conventions, "
          + "feature impact, operational, test quality." },
      { label: "Bỏ qua",
        description: "Không chạy review, chuyển sang tạo PR luôn." }
    ],
    multiSelect: false
  }]
})
```

### Gọi sdlc-review

Nếu human chọn "Review code":

```javascript
// worktree_path đã có từ Bước 4 (Create Worktree) trong SKILL.md
Skill("sdlc-review", "--code --full " + worktree_path)
```

sdlc-review sẽ:
1. Chạy scout trên `worktree_path` để phát hiện project structure
2. Dispatch code review workflow (7 dimension agents song song)
3. Tạo report trong `.work/review/REVIEW-CODE-YYYYMMDD--{sanitized-path}.md`
4. Return về sdlc-cook kèm summary findings

### Xử lý lỗi

Tất cả lỗi đều non-blocking — tạo PR luôn có thể tiếp tục:

| Lỗi | Hành động |
|-----|-----------|
| sdlc-review skill không tìm thấy | Cảnh báo: "Plugin cần cài đặt lại." → tiếp tục tạo PR |
| sdlc-review workflow script không tồn tại | sdlc-review tự báo lỗi "Plugin cần cài đặt lại" → tiếp tục tạo PR |
| sdlc-review partial failure (1-2 dimensions fail) | sdlc-review báo cáo dimensions bị fail, vẫn tạo report → tiếp tục tạo PR |
| sdlc-review total failure | sdlc-review return verdict=ERROR → báo "sdlc-review không tạo được kết quả" → tiếp tục tạo PR |

---

## PR Creation

### Bước 1: Commit (nếu chưa)

Workflow agent đã commit sau mỗi phase. Kiểm tra xem có commit nào chưa push không:

```bash
cd "$worktree_path"
git log origin/main..HEAD --oneline
```

### Bước 2: Push Branch

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
cd "$worktree_path"
git push origin "$BRANCH" --force-with-lease
```

### Bước 3: Tạo PR

```bash
gh pr create \
  --base "$target_branch" \
  --head "$BRANCH" \
  --title "cook(${FEAT_ID}): ${feature_name}" \
  --body "## Summary
- **Feature:** ${feature_name}
- **FR:** ${FR_ID}
- **Service:** ${service} (\`${code_path}\`)
- **Project Type:** ${project_type}
- **TCs:** ${tc_done}/${tc_total} DONE
- **GATE Light:** ${gate_light}
- **GATE Full:** ${gate_full}

## Changed Files
$(cd "$worktree_path" && git diff --stat origin/main)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Target Branch Theo Project Type

| Project Type | Target Branch |
|-------------|---------------|
| **submodule** | Default branch của submodule (thường là `main`) |
| **gitignored-subproject** | Default branch của subproject |
| **workspace-member** | `main` của workspace |

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
│ Agent quay lại worktree  │
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

```bash
FEAT_ID="FEAT-001"
SERVICE="auth-service"
BRANCH="feature/${FEAT_ID}-${SERVICE}"
WORKTREE_NAME="feature-${FEAT_ID}-${SERVICE}"      # / → - cho directory
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/${WORKTREE_NAME}"

# 1. Xóa worktree (từ project root)
cd "$project_root"
git worktree remove "$WORKTREE_PATH" --force

# 2. Xóa branch (đã merge, không cần nữa)
git branch -D "$BRANCH" 2>/dev/null || true

# 3. Xóa remote branch
git push origin --delete "$BRANCH" 2>/dev/null || true

# 4. Update board + backlog
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
cd "$worktree_path"
git fetch origin "$target_branch"

# 2. Merge target branch vào worktree branch
git merge "origin/$target_branch"

# 3. Push lại → PR tự update
git push origin "$BRANCH" --force-with-lease
```

### Conflict Khi Merge Trên GitHub

```
Human click "Merge" → GitHub báo conflict
→ Báo human: "PR #42 không merge được do conflict.
   Xem error-recovery.md#merge-conflict để có resolution options."
```

## PR Status Polling

Poll PR status định kỳ:

```bash
gh pr view "$PR_URL" --json state,mergeable,reviews --jq '.'
```

| PR State | Hành động |
|----------|-----------|
| `OPEN` + `mergeable=true` | Báo human: "PR ready to merge" |
| `OPEN` + `mergeable=false` | Conflict → xử lý conflict |
| `MERGED` | Cleanup + update board |
| `CLOSED` | Hỏi human: keep or delete worktree |
| `OPEN` + review `CHANGES_REQUESTED` | Agent sửa trong worktree |

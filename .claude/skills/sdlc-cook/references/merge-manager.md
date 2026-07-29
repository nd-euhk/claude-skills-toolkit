# Merge Manager

Quy trình merge sau khi cook workflow hoàn thành. Áp dụng cho single và
multi mode.

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

Đọc `.pipeline/${FR_ID}-status.json` → xác nhận `gate_light` và
`gate_full` = PASS.

### Bước 3: Verify Không Có Uncommitted Changes Sót

```bash
cd "$worktree_path"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes trong worktree"
  exit 1
fi
```

## PR Creation

### Bước 1: Commit (nếu chưa)

Workflow agent đã commit sau mỗi phase. Kiểm tra xem có commit nào chưa push không:

```bash
cd "$worktree_path"
git log origin/main..HEAD --oneline
```

### Bước 2: Push Branch

```bash
BRANCH="cook-${SERVICE}-${FEAT_ID}"
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
Meta-orchestrator detect merge (poll PR status hoặc webhook)
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
     │
     ▼
┌──────────────────┐
│ Unblock Deps     │
│ → Dispatch wave  │
└──────────────────┘
```

### Changes Requested

```
Human requests changes trên PR
     │
     ▼
Meta-orchestrator báo: "PR #42: changes requested. Review comments: ..."
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
Meta-orchestrator: "PR #42 closed without merge. Keep worktree? Delete?"
     │
     ├─ Keep → worktree giữ nguyên, có thể mở lại PR sau
     └─ Delete → cleanup worktree, update board: FEAT → 🔲 Todo
```

## Cleanup Procedure

```bash
FEAT_ID="FEAT-001"
SERVICE="auth-service"
WORKTREE_NAME="cook-${SERVICE}-${FEAT_ID}"
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/${WORKTREE_NAME}"

# 1. Xóa worktree (từ project root)
cd "$project_root"
git worktree remove "$WORKTREE_PATH" --force

# 2. Xóa branch (đã merge, không cần nữa)
git branch -D "$WORKTREE_NAME" 2>/dev/null || true

# 3. Xóa remote branch
git push origin --delete "$WORKTREE_NAME" 2>/dev/null || true

# 4. Cleanup baseline files (optional — giữ lại cho lần cook sau)
# rm -f .work/baselines/*-${FR_ID}-*.json

# 5. Update board
Skill(sprint, "--board --backlog")
```

## Conflict Handling

### Conflict Detected Khi Tạo PR

```
FEAT-001 sửa UserService.ts method A (đã cook, đang PR)
FEAT-003 sửa UserService.ts method B (đã merge trước)
→ FEAT-001 PR có merge conflict với main
```

Xử lý:

```bash
# 1. Fetch latest main
cd "$worktree_path"
git fetch origin main

# 2. Merge main vào worktree branch
git merge origin/main

# 3. Nếu conflict → báo human:
#    "PR #42 conflict với main (UserService.ts).
#     Options:
#     (a) Resolve conflict trong worktree rồi push lại → PR tự update
#     (b) Tạo worktree mới từ main, cherry-pick FEAT-001 changes → PR mới"
```

### Conflict Khi Merge (human gặp conflict trên GitHub)

```
Human click "Merge" → GitHub báo conflict
→ Meta-orchestrator detect PR status = "conflict"
→ Báo human: "PR #42 không merge được do conflict.
   ./sdlc-cook FEAT-001 --resolve-conflict"
```

## PR Status Polling

Meta-orchestrator poll PR status định kỳ:

```bash
gh pr view "$PR_URL" --json state,mergeable,reviews --jq '.'
```

| PR State | Hành động |
|----------|-----------|
| `OPEN` + `mergeable=true` | Báo human: "PR ready to merge" |
| `OPEN` + `mergeable=false` | Conflict → xử lý conflict |
| `MERGED` | Cleanup + update board + unblock deps |
| `CLOSED` | Hỏi human: keep or delete worktree |
| `OPEN` + review `CHANGES_REQUESTED` | Agent sửa trong worktree |


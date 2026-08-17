# Project Detection

Thuật toán xác định project root, type, và branch strategy (worktree vs in-place checkout)
cho một feature. Implementation: `scripts/detect-project.sh` (function `classify_project`).
Tests: `scripts/test-project-detection.sh` (7 cases).

## Input

Từ feature spec (`agent_docs/features/FR-{ID}.md`) và board:

- `layer`: `backend` hoặc `frontend`
- `service`: tên service (e.g., `auth-service`, `web-app`)

## Algorithm

### Bước 1: Canonical Lookup

```
service_dir = find_dir_named(service, workspace_root,
  prune=[".git", "node_modules", ".claude", "agent_docs", "target", "build", "dist"])
```

Verify `agent_docs/{layer}/{service}/` tồn tại. Nếu không → báo lỗi:
"Service '{service}' không có specs trong agent_docs/{layer}/."

Nếu tìm thấy nhiều directory cùng tên → ưu tiên directory có structure
khớp với agent_docs (vd: có `src/`, `build.gradle`, `package.json` phù hợp
với layer). Nếu vẫn ambiguous → `AskUserQuestion` một lần, cache kết quả.

### Bước 2: Walk Up — Tìm Git Root

```bash
# Từ service_dir, walk up tìm .git đầu tiên
current=$(realpath "$service_dir")
while [ "$current" != "/" ]; do
  if [ -e "$current/.git" ]; then
    echo "FOUND $current"
    break
  fi
  current=$(dirname "$current")
done
```

### Bước 3: Classify Project Type

```bash
classify_project() {
  local git_root=$1
  local service_dir=$2

  # Case A: Submodule
  # .git là FILE (không phải directory) → submodule
  if [ -f "$git_root/.git" ]; then
    # Verify: có trong .gitmodules của parent
    parent_root=$(find_parent_worktree "$git_root")
    if grep -q "$(basename $git_root)" "$parent_root/.gitmodules" 2>/dev/null; then
      echo "submodule"
      return
    fi
  fi

  # Case B: Gitignored subproject
  # .git là DIRECTORY và bị workspace parent ignore
  if [ -d "$git_root/.git" ]; then
    parent_root=$(find_parent_worktree "$(dirname $git_root)")
    if [ -n "$parent_root" ]; then
      # Dùng git check-ignore — chính xác hơn tự parse .gitignore
      if git -C "$parent_root" check-ignore -q "$service_dir" 2>/dev/null; then
        echo "gitignored-subproject"
        return
      fi
    fi
  fi

  # Case C: Workspace member
  echo "workspace-member"
}
```

### Bước 4: Trả Về Project Object

```json
{
  "name": "auth-service",
  "layer": "backend",
  "code_path": "services/auth-service",
  "project_root": "services/auth-service",
  "project_type": "submodule",
  "git_remote": "origin",
  "default_branch": "main",
  "workspace_root": "/home/user/workspace",
  "original_branch": "main",
  "worktree_path": null
}
```

Fields đặc thù theo project type:

| Field | Type 1 (submodule / gitignored-subproject) | Type 2 (workspace-member) |
|-------|--------------------------------------------|---------------------------|
| `original_branch` | Branch sub-repo đang đứng — capture TRƯỚC khi checkout in-place, dùng để restore | Không cần (worktree không đụng branch hiện tại) |
| `worktree_path` | `null` — không tạo worktree, checkout IN-PLACE | Absolute path `.claude/worktrees/feature-{feat}-{svc}` của workspace root |

Lý do không dùng worktree cho Type 1: workspace `.gitignore` đã cover `.claude/worktrees/`
(đúng cho Type 2), nhưng sub-repo là directory trong working tree của parent — chỉ cần đổi
branch trong sub-repo là đủ (xem "Branch Strategy Theo Project Type" dưới).

## Branch Strategy Theo Project Type

Hai chiến lược tách branch — chọn theo `project_type`:

| Type | Chiến lược | Parallel? | PR về remote nào |
|------|-----------|-----------|------------------|
| **Type 1** — submodule / gitignored-subproject | Checkout IN-PLACE trong sub-repo | ❌ Tuần tự bắt buộc | Remote của chính sub-repo |
| **Type 2** — workspace-member | Worktree isolation | ✅ Thoải mái | Remote của workspace |

Branch name chuẩn hóa theo flow type:

| Flow | Branch pattern | Ví dụ |
|------|---------------|-------|
| **cook** | `feature/{FEAT_ID}-{service}` | `feature/FEAT-001-auth-service` |
| **cr** | `change/{CR_ID}-{service}` | `change/CR-005-payment-service` |
| **fixbug** | `fix/{BUG_ID}-{service}` | `fix/BUG-042-auth-service` |

### Type 2 — workspace-member: worktree isolation

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/feature-${FEAT_ID}-${SERVICE}"
git -C "$project_root" worktree add -b "$BRANCH" "$WORKTREE_PATH" "origin/main"
```

- Branch từ `origin/main` (theo dõi remote, không phải local state).
- Controller KHÔNG `cd` — mọi lệnh dùng absolute path. Workflow args:
  `repoPath = "$WORKTREE_PATH"` (nơi chạy code/test),
  `specRoot = "$WORKSPACE_ROOT"` (nơi chứa `agent_docs/`).
- Nếu worktree có bản copy specs (agent_docs đã commit) → `specRoot = "$WORKTREE_PATH"`.

### Type 1 — submodule / gitignored-subproject: in-place checkout + restore

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
ORIGINAL_BRANCH=$(git -C "$project_root" branch --show-current)   # capture TRƯỚC — sub-repo đã sẵn trên branch gốc
git -C "$project_root" checkout -b "$BRANCH" HEAD
```

**Quy tắc cứng (hard boundaries) cho Type 1:**

1. **Capture `original_branch` trước khi checkout** — sub-repo đang đứng sẵn trên branch
   gốc, chỉ capture, KHÔNG re-checkout.
2. **Tuần tự bắt buộc** — in-place checkout đổi branch của chính sub-repo trong working
   tree của parent → ảnh hưởng cả project đang làm việc. Không bao giờ chạy 2 task song
   song trên cùng sub-repo.
3. **Restore LUÔN chạy (finally semantics)** — sau feature xong (PR tạo xong hoặc fail):
   `git -C "$project_root" checkout "$ORIGINAL_BRANCH"`. Restore fail → chặn task kế tiếp.
4. **PR về remote của chính sub-repo** — sub-repo có remote riêng (origin của sub-repo,
   không phải của parent). Push + `gh pr create` chạy với `--repo`/CWD của sub-repo.
5. **Specs nằm ở parent** — Type 1 `agent_docs/` ở workspace của PARENT, không nằm trong
   sub-repo. Workflow args: `repoPath = "$project_root"`, `specRoot = "$workspace_root"`.

**Tại sao Type 1 không dùng worktree?**
- Sub-repo là directory trong working tree của parent — chỉ cần đổi branch trong sub-repo
  là đủ; worktree chỉ thêm một lớp path phải resolve.
- Submodule có `.git` là file trỏ về `.git/modules/` của parent — không có per-worktree
  git config riêng như repo thường.
- Gitignored-subproject bị parent ignore — checkout in-place giữ mọi relative path
  (build, ignore rules của parent) nguyên vẹn, không cần sửa gì.

**Quy tắc branch point:**
- Type 1 → branch từ `HEAD` (theo dõi state hiện tại của sub-repo)
- Type 2 → branch từ `origin/main` (theo dõi remote, không phải local state)

## Detection Caching

Kết quả detection nên được cache trong session — không scan lại service đã detect.

## Edge Cases

### Nhiều Directory Cùng Tên

```
services/auth/     ← Spring Boot (backend)
lib/auth/          ← TypeScript library
```

→ Ưu tiên directory có structure khớp layer:
  - `layer=backend` → tìm `build.gradle` hoặc `pom.xml`
  - `layer=frontend` → tìm `package.json` + framework frontend

### Service Name Không Khớp Directory

```
agent_docs/backend/auth-service/ tồn tại
nhưng find không thấy directory "auth-service"
```

→ Báo human: "agent_docs có service 'auth-service' nhưng không tìm thấy
  directory tương ứng trong workspace. Đổi tên directory hoặc agent_docs."

### Project Root = Workspace Root

```
service_dir = "shared-lib/"
git_root = "."  (workspace root)
classify → workspace-member
```

→ Worktree tạo từ workspace root, branch origin/main.
  PR target = main của workspace.

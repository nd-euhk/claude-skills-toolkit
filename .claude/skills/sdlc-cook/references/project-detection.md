# Project Detection

Thuật toán xác định project root, type, và worktree strategy cho một feature.
Implementation: `scripts/detect-project.sh` (function `classify_project`).
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
  "worktree_path": "/home/user/workspace/.claude/worktrees/feature-FEAT-001-auth-service"
}
```

`worktree_path` là absolute path, unified cho mọi project type. Tất cả worktree nằm
ở `.claude/worktrees/` của workspace root — không bao giờ nằm trong project root.
Lý do: workspace `.gitignore` đã cover `.claude/worktrees/`, không cần sửa gitignore
của submodule/subproject.

## Worktree Creation Theo Project Type

Tất cả worktree được tạo ở **cùng một vị trí**: `.claude/worktrees/{branch-slug}/`
dưới workspace root. `git worktree add -b` chạy từ project root tương ứng,
nhưng path worktree luôn trỏ về workspace root (absolute path).

Branch name được chuẩn hóa theo flow type:

| Flow | Branch pattern | Ví dụ |
|------|---------------|-------|
| **cook** | `feature/{FEAT_ID}-{service}` | `feature/FEAT-001-auth-service` |
| **cr** | `change/{CR_ID}-{service}` | `change/CR-005-payment-service` |
| **fixbug** | `fix/{BUG_ID}-{service}` | `fix/BUG-042-auth-service` |

Worktree directory name thay `/` bằng `-`: `feature-FEAT-001-auth-service`.

| Type | Branch từ | Branch name | Lệnh |
|------|-----------|-------------|------|
| **submodule** | HEAD của submodule | `feature/{feat}-{svc}` | `cd {project_root} && git worktree add -b feature/{feat}-{svc} {workspace}/.claude/worktrees/feature-{feat}-{svc} HEAD` |
| **gitignored-subproject** | HEAD của subproject | `feature/{feat}-{svc}` | `cd {project_root} && git worktree add -b feature/{feat}-{svc} {workspace}/.claude/worktrees/feature-{feat}-{svc} HEAD` |
| **workspace-member** | origin/main của workspace | `feature/{feat}-{svc}` | `cd {project_root} && git worktree add -b feature/{feat}-{svc} {workspace}/.claude/worktrees/feature-{feat}-{svc} origin/main` |

**Quy tắc branch point:**
- Submodule/gitignored → branch từ HEAD (theo dõi state hiện tại của sub-repo)
- Workspace-member → branch từ origin/main (theo dõi remote, không phải local state)

**Tại sao unified path?**
- Workspace `.gitignore` đã có `.claude/worktrees/` → không cần sửa gitignore của submodule
- Board luôn hiển thị đúng path tương đối: `.claude/worktrees/feature-{feat}-{svc}/`
- `git worktree add` chấp nhận absolute path bất kỳ — worktree không cần nằm trong repo

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

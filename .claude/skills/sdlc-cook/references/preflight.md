# Preflight: Project Detection + Worktree — sdlc-cook

Chi tiết đầy đủ cho preflight phase: phát hiện loại project, tạo worktree cô lập, và
dọn dẹp sau khi hoàn thành. Controller dùng file này khi thực thi preflight steps.

---

## Project Detection

Có 3 case. Kiểm tra theo thứ tự — **first match wins**:

### Case 1: Git Submodule

```bash
git submodule status 2>/dev/null
```

Nếu output không rỗng → workspace chứa submodules. Với mỗi submodule:

```bash
# Lấy path và branch hiện tại của submodule
SUBMODULE_PATH=$(git submodule status | head -1 | awk '{print $2}')
cd $SUBMODULE_PATH
SUBMODULE_BRANCH=$(git branch --show-current)
SUBMODULE_NAME=$(basename $SUBMODULE_PATH)
cd - > /dev/null
```

Nếu cần chọn submodule cụ thể → `AskUserQuestion`:
- Options: danh sách submodule paths
- Mặc định: submodule đầu tiên

### Case 2: Sub-project bị gitignore

```bash
# Tìm tất cả .git directories (trừ root .git và submodule đã biết)
find . -name ".git" -type d -not -path "./.git" | while read gitdir; do
  PROJ_DIR=$(dirname "$gitdir")
  # Kiểm tra có bị gitignore không
  if git check-ignore "$PROJ_DIR" >/dev/null 2>&1; then
    echo "GITIGNORED_SUBPROJECT: $PROJ_DIR"
  fi
done
```

Nếu tìm thấy ≥1 gitignored sub-project:
```bash
cd $PROJ_DIR
PROJ_BRANCH=$(git branch --show-current)
PROJ_NAME=$(basename $PROJ_DIR)
cd - > /dev/null
```

Nếu nhiều sub-project → `AskUserQuestion` để chọn.

### Case 3: Workspace là project (fallback)

Nếu Case 1 và Case 2 đều không khớp → workspace chính là project:

```bash
WORKSPACE_ROOT=$(git rev-parse --show-toplevel)
CURRENT_BRANCH=$(git branch --show-current)
PROJECT_NAME=$(basename $WORKSPACE_ROOT)
```

---

## Worktree Creation

**Target directory**: `.claude/worktrees/cook-<project-name>-<YYYYMMDDHHmm>` tại workspace root.

### Case 1 (Submodule) — tạo worktree cho submodule:

```bash
WORKTREE_NAME="cook-${SUBMODULE_NAME}-$(date +%Y%m%d%H%M)"
WORKTREE_PATH=".claude/worktrees/${WORKTREE_NAME}"
cd $SUBMODULE_PATH
git worktree add "${WORKSPACE_ROOT}/${WORKTREE_PATH}" "$SUBMODULE_BRANCH"
cd - > /dev/null
```

### Case 2 (Gitignored Sub-project) — tạo worktree cho sub-project:

```bash
WORKTREE_NAME="cook-${PROJ_NAME}-$(date +%Y%m%d%H%M)"
WORKTREE_PATH=".claude/worktrees/${WORKTREE_NAME}"
cd $PROJ_DIR
git worktree add "${WORKSPACE_ROOT}/${WORKTREE_PATH}" "$PROJ_BRANCH"
cd - > /dev/null
```

### Case 3 (Workspace) — tạo worktree cho workspace:

```bash
WORKTREE_NAME="cook-${PROJECT_NAME}-$(date +%Y%m%d%H%M)"
WORKTREE_PATH=".claude/worktrees/${WORKTREE_NAME}"
git worktree add "$WORKTREE_PATH" "$CURRENT_BRANCH"
```

---

## Xác nhận và Báo cáo

Sau khi worktree được tạo:

```bash
# Verify worktree đã được tạo
git worktree list | grep "$WORKTREE_NAME"
ls -d "$WORKTREE_PATH"
```

Báo cáo:
```
🏝️ Worktree đã tạo: .claude/worktrees/{WORKTREE_NAME}
   📂 Project: {PROJECT_NAME} (case {N}: {submodule|gitignored|workspace})
   🌿 Branch: {BRANCH}
   📍 Path: {WORKTREE_PATH}
```

---

## Chuyển vào Worktree

Tất cả các bước cook flow tiếp theo chạy **trong worktree** (`$WORKTREE_PATH`),
không phải workspace gốc. Dùng absolute path cho mọi thao tác file.

---

## Exit Worktree

Sau khi hoàn thành (hoặc abort), dọn dẹp worktree:

```bash
# Quay về workspace gốc
cd "$WORKSPACE_ROOT"

# Xóa worktree
git worktree remove "$WORKTREE_PATH" --force
git worktree prune
```

Báo cáo:
```
🏝️ Worktree đã dọn dẹp: {WORKTREE_NAME}
```

---

## Worktree Cleanup Policy

| Tình huống | Hành động |
|---|---|
| Cook hoàn thành + code đã push | **Xóa worktree** — code đã an toàn trên remote |
| Cook hoàn thành + chưa push | **Giữ worktree** — code còn trong worktree, hỏi human |
| Cook bị abort / fail | **Hỏi human** — giữ để debug hoặc xóa |
| Human yêu cầu giữ lại | **Giữ worktree**, nhắc human tự dọn dẹp sau |

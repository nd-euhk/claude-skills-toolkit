#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# detect-project.sh — Xác định project type cho một service dir
# ─────────────────────────────────────────────────────────────
# Usage:
#   source detect-project.sh
#   classify_project <git_root> <service_dir>
#
# Returns (stdout):
#   submodule            — .git là file, có entry trong .gitmodules của parent
#   gitignored-subproject — .git là dir, bị workspace parent gitignore
#   workspace-member     — .git là dir, không bị ignore
#
# Exit codes:
#   0 — classification successful
#   1 — cannot classify (ambiguous or error — unreachable paths)
# ─────────────────────────────────────────────────────────────

# Walk up từ directory để tìm .git gần nhất (git root)
find_git_root() {
  local dir="$1"
  dir="$(realpath "$dir" 2>/dev/null || echo "$dir")"
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    if [ -e "$dir/.git" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

# Tìm parent worktree (workspace chứa project này)
# Walk up từ parent của git_root để tìm .git directory (không phải file)
find_parent_worktree() {
  local dir="$1"
  dir="$(realpath "$dir" 2>/dev/null || echo "$dir")"
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    if [ -d "$dir/.git" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

# Classify một project dựa trên git state
classify_project() {
  local git_root="$1"
  local service_dir="$2"

  # Chuẩn hóa paths
  git_root="$(realpath "$git_root" 2>/dev/null || echo "$git_root")"
  service_dir="$(realpath "$service_dir" 2>/dev/null || echo "$service_dir")"

  # Case A: .git là FILE (submodule hoặc linked worktree)
  if [ -f "$git_root/.git" ]; then
    # A1: Check nếu đây là linked worktree (gitdir trỏ tới .git/worktrees/)
    local gitdir_line
    gitdir_line=$(head -1 "$git_root/.git" 2>/dev/null || true)
    if echo "$gitdir_line" | grep -q '^gitdir:.*\.git/worktrees/'; then
      # Worktree → resolve về main repo
      local main_repo
      main_repo=$(echo "$gitdir_line" | sed 's|^gitdir: ||' | sed 's|/\.git/worktrees/.*||')
      if [ -n "$main_repo" ] && [ -d "$main_repo/.git" ]; then
        echo "workspace-member"
        return 0
      fi
    fi

    # A2: Verify submodule — có trong .gitmodules của parent
    local parent_root
    parent_root=$(find_parent_worktree "$(dirname "$git_root")")
    if [ -n "$parent_root" ] && [ -f "$parent_root/.gitmodules" ]; then
      if grep -q "$(basename "$git_root")" "$parent_root/.gitmodules" 2>/dev/null; then
        echo "submodule"
        return 0
      fi
    fi

    # A3: .git là FILE nhưng không phải submodule hoặc worktree → fallback
    echo "workspace-member"
    return 0
  fi

  # Case B: Gitignored subproject — .git là DIRECTORY và bị workspace parent ignore
  if [ -d "$git_root/.git" ]; then
    local parent_root
    parent_root=$(find_parent_worktree "$(dirname "$git_root")")
    if [ -n "$parent_root" ]; then
      # Dùng git check-ignore — chính xác hơn tự parse .gitignore
      if git -C "$parent_root" check-ignore -q "$service_dir" 2>/dev/null; then
        echo "gitignored-subproject"
        return 0
      fi
    fi
  fi

  # Case C: Workspace member — .git là dir, không bị ignore (hoặc không có parent workspace)
  echo "workspace-member"
  return 0
}

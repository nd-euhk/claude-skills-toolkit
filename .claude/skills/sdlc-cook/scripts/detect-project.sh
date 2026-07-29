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
#   1 — cannot classify (ambiguous or error)
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

  # Case A: Submodule — .git là FILE (không phải directory)
  if [ -f "$git_root/.git" ]; then
    # Verify: có trong .gitmodules của parent
    local parent_root
    parent_root=$(find_parent_worktree "$(dirname "$git_root")")
    if [ -n "$parent_root" ] && [ -f "$parent_root/.gitmodules" ]; then
      if grep -q "$(basename "$git_root")" "$parent_root/.gitmodules" 2>/dev/null; then
        echo "submodule"
        return 0
      fi
    fi
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

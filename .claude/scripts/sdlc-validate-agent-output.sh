#!/bin/bash
# Validate that Write, Edit, and Bash tool calls target allowed paths for the given SDLC phase.
# Usage: ./scripts/sdlc-validate-agent-output.sh <phase>
# Reads tool call JSON from stdin, extracts target paths, checks against phase rules.
# Exit 0 = allowed, Exit 2 = blocked.
#
# Handles three tool types:
#   - Write/Edit: extracts file_path from tool_input
#   - Bash: parses command string for output paths (redirections, tee, dd, cp, mv)

PHASE="$1"
INPUT=$(cat)

# --- Extract tool name and tool input ---
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# --- Normalize a path (strip leading ./, resolve relative) ---
normalize_path() {
  local p="$1"
  p="${p#./}"
  # If not absolute and doesn't start with known root, prefix with nothing (keep as-is)
  echo "$p"
}

# --- Check a single path against phase rules ---
check_path() {
  local file_path="$1"

  # Skip empty paths
  [ -z "$file_path" ] && return 0

  file_path=$(normalize_path "$file_path")

  case "$PHASE" in
    sdlc-srs|codebase-srs|codebase-srs-verify)
      if echo "$file_path" | grep -qE '^agent_docs/traceability/|^agent_docs/features/FR-.*\.md$'; then
        return 0
      fi
      ;;
    codebase-srs-synthesis)
      if echo "$file_path" | grep -qE '^agent_docs/traceability/|^agent_docs/features/'; then
        return 0
      fi
      ;;
    codebase-lld-synthesis)
      if echo "$file_path" | grep -qE '^agent_docs/contracts/|^agent_docs/features/'; then
        return 0
      fi
      ;;
    sdlc-hld|codebase-hld)
      if echo "$file_path" | grep -qE '^agent_docs/architecture\.md$|^agent_docs/domain-service-mapping\.yaml$|^agent_docs/hard-boundaries\.md$|^agent_docs/contracts/|^agent_docs/adr/ADR-.*\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld|codebase-lld)
      if echo "$file_path" | grep -qE '^agent_docs/tech-design/|^agent_docs/contracts/api-.*\.yaml$|^agent_docs/contracts/error-codes\.md$|^agent_docs/features/|^agent_docs/frontend/.*/api-routing\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld-error-handling|codebase-cross-cutting-error-handling)
      if echo "$file_path" | grep -qE '^agent_docs/error-handling\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld-caching-strategy|codebase-cross-cutting-caching-strategy)
      if echo "$file_path" | grep -qE '^agent_docs/caching-strategy\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld-performance-test|codebase-cross-cutting-performance-test)
      if echo "$file_path" | grep -qE '^agent_docs/performance-test\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld-frontend-architecture|codebase-cross-cutting-frontend-architecture)
      if echo "$file_path" | grep -qE '^agent_docs/frontend-architecture\.md$'; then
        return 0
      fi
      ;;
    sdlc-lld-frontend-test-strategy|codebase-cross-cutting-frontend-test-strategy)
      if echo "$file_path" | grep -qE '^agent_docs/frontend-test-strategy\.md$'; then
        return 0
      fi
      ;;
    sdlc-imp|codebase-imp)
      if echo "$file_path" | grep -qE '^agent_docs/(backend|frontend)/.*/implementation/'; then
        return 0
      fi
      ;;
    sdlc-tst|codebase-tst)
      if echo "$file_path" | grep -qE '^agent_docs/(backend|frontend)/.*/test-specs/|^agent_docs/performance/'; then
        return 0
      fi
      ;;
    sdlc-sprint-board)
      if echo "$file_path" | grep -qE '^\.work/board\.md$'; then
        return 0
      fi
      ;;
    sdlc-sprint-backlog)
      if echo "$file_path" | grep -qE '^\.work/backlog\.md$'; then
        return 0
      fi
      ;;
    sdlc-sprint-roadmap)
      if echo "$file_path" | grep -qE '^agent_docs/roadmap\.md$'; then
        return 0
      fi
      ;;
    sdlc-gate|codebase-gate|sdlc-tdd-be-gate|sdlc-tdd-fe-gate)
      # Read-only gate agents — should never write/edit files.
      # If this case is reached (via PreToolUse hook), block ALL paths.
      # Normally no hooks are configured for gate agents, so this is defense-in-depth.
      echo "[sdlc-validate][$PHASE] BLOCKED: $PHASE is read-only — Write/Edit/Bash output forbidden" >&2
      return 2
      ;;
    *)
      echo "[sdlc-validate] Unknown phase '$PHASE'" >&2
      return 2
      ;;
  esac

  echo "[sdlc-validate][$PHASE] Forbidden path: $file_path" >&2
  return 2
}

# --- Extract paths from a Bash command string ---
# Looks for: redirections (>, >>, 1>, 2>, &>), tee targets, dd of=, cp/mv/install dest
extract_bash_paths() {
  local cmd="$1"
  local paths=""

  # 1. Redirections: >file, >>file, 1>file, 2>file, &>file, 1>>file, 2>>file
  #    Also handle: > file (with space)
  #    Match patterns like: [fd]>[>] file
  paths+=$(echo "$cmd" | grep -oP '(?:^|\s|[0-9&])>>?\s*\K[^\s;|&]+' | head -20)
  paths+=$'\n'

  # 2. tee command: tee [-a] file1 file2 ...
  paths+=$(echo "$cmd" | grep -oP 'tee\s+(-a\s+)?\K[^\s;|&]+' | head -20)
  paths+=$'\n'

  # 3. dd of=file
  paths+=$(echo "$cmd" | grep -oP 'dd\s+.*?\bof=\K[^\s;|&]+' | head -20)
  paths+=$'\n'

  # 4. cp dest (last non-flag argument)
  local cp_dests=$(echo "$cmd" | grep -oP '\bcp\s+(?:-\S+\s+)*\S+\s+\K[^\s;|&]+(?=\s*$|[\s;|&])' | head -10)
  paths+="$cp_dests"$'\n'

  # 5. mv dest (last non-flag argument)
  local mv_dests=$(echo "$cmd" | grep -oP '\bmv\s+(?:-\S+\s+)*\S+\s+\K[^\s;|&]+(?=\s*$|[\s;|&])' | head -10)
  paths+="$mv_dests"$'\n'

  # 6. install dest
  local install_dests=$(echo "$cmd" | grep -oP '\binstall\s+(?:-\S+\s+)*.*?\s+\K[^\s;|&]+(?=\s*$|[\s;|&])' | head -10)
  paths+="$install_dests"$'\n'

  # 7. mkdir -p dir (creating directories for files)
  paths+=$(echo "$cmd" | grep -oP '\bmkdir\s+-p\s+\K[^\s;|&]+' | head -10)
  paths+=$'\n'

  # Filter: only return paths that look like file paths (contain / or common extensions)
  echo "$paths" | grep -E '(^\.work/|^agent_docs/|^projects/|^docs/|\.(md|yaml|yml|json|txt)$)' | sort -u
}

# --- Main logic ---

if [ "$TOOL_NAME" = "Bash" ]; then
  # Extract command string from tool_input
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

  if [ -z "$COMMAND" ]; then
    # No command to validate — allow (e.g., read-only Bash)
    exit 0
  fi

  # Extract all output paths from the command
  BASH_PATHS=$(extract_bash_paths "$COMMAND")

  if [ -z "$BASH_PATHS" ]; then
    # No file-output paths detected — this is a read-only or non-file command
    exit 0
  fi

  # Validate each extracted path
  HAS_ERROR=0
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    if ! check_path "$path"; then
      HAS_ERROR=1
    fi
  done <<< "$BASH_PATHS"

  if [ "$HAS_ERROR" -eq 1 ]; then
    echo "[sdlc-validate][$PHASE] Bash command blocked due to forbidden paths above" >&2
    exit 2
  fi
  exit 0

elif [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

  # If no file_path, allow — the tool itself will handle validation
  [ -z "$FILE_PATH" ] && exit 0

  if check_path "$FILE_PATH"; then
    exit 0
  else
    exit 2
  fi

else
  # Unknown tool — allow (not our concern)
  exit 0
fi

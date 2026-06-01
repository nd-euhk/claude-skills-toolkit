#!/bin/bash
# Validate that Write/Edit operations target allowed paths for the given SDLC phase.
# Usage: ./scripts/validate-output-path.sh <phase>
# Reads tool input JSON from stdin, extracts file_path, checks against phase rules.
# Exit 0 = allowed, Exit 2 = blocked.

PHASE="$1"
INPUT=$(cat)

# Extract file_path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# If no file_path (e.g., Write with content only), allow — Write tool will handle validation
[ -z "$FILE_PATH" ] && exit 0

# Normalize: strip leading ./ if present
FILE_PATH="${FILE_PATH#./}"

case "$PHASE" in
  srs)
    if echo "$FILE_PATH" | grep -qE '^docs/product/|^agent_docs/traceability/'; then
      exit 0
    fi
    ;;
  hld)
    if echo "$FILE_PATH" | grep -qE '^docs/architecture/|^agent_docs/architecture\.md$|^agent_docs/domain-service-mapping\.yaml$|^agent_docs/hard-boundaries\.md$|^agent_docs/contracts/'; then
      exit 0
    fi
    ;;
  lld)
    if echo "$FILE_PATH" | grep -qE '^agent_docs/tech-design/|^agent_docs/contracts/api-.*\.yaml$|^agent_docs/features/'; then
      exit 0
    fi
    ;;
  imp)
    if echo "$FILE_PATH" | grep -qE '^agent_docs/(backend|frontend)/.*/implementation/'; then
      exit 0
    fi
    ;;
  tst)
    if echo "$FILE_PATH" | grep -qE '^agent_docs/(backend|frontend)/.*/test-specs/|^agent_docs/performance/'; then
      exit 0
    fi
    ;;
  exe-be)
    if echo "$FILE_PATH" | grep -qE '^projects/|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  exe-fe)
    if echo "$FILE_PATH" | grep -qE '^projects/|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  tdd-be-red)
    if echo "$FILE_PATH" | grep -qE '^projects/.*/src/test/|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  tdd-be-green)
    if echo "$FILE_PATH" | grep -qE '^projects/|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  tdd-be-refactor)
    if echo "$FILE_PATH" | grep -qE '^projects/'; then
      exit 0
    fi
    ;;
  tdd-fe-red)
    if echo "$FILE_PATH" | grep -qE '^projects/.*/(__tests__|e2e)/|^projects/.*\.(test|spec)\.(tsx?|jsx?)$|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  tdd-fe-green)
    if echo "$FILE_PATH" | grep -qE '^projects/|^\.work/(plans|reports)/'; then
      exit 0
    fi
    ;;
  tdd-fe-refactor)
    if echo "$FILE_PATH" | grep -qE '^projects/'; then
      exit 0
    fi
    ;;
  sprint)
    if echo "$FILE_PATH" | grep -qE '^agent_docs/roadmap\.md$|^\.work/board\.md$|^\.work/backlog\.md$'; then
      exit 0
    fi
    ;;
  *)
    echo "validate-output-path.sh: unknown phase '$PHASE'" >&2
    exit 2
    ;;
esac

echo "[$PHASE] Forbidden write path: $FILE_PATH" >&2
exit 2

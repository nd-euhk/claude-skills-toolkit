#!/bin/bash
# Validate that Write/Edit operations target allowed knowledge/ paths.
# Usage: ./scripts/validate-knowledge-output-path.sh <agent>
#   agent: spec | impl | test | contract | architecture | techdesign | compliance | orchestrator
# Reads tool input JSON from stdin, extracts file_path, checks against rules.
# Exit 0 = allowed, Exit 2 = blocked.

AGENT="$1"
INPUT=$(cat)

# Extract file_path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# If no file_path (e.g., Write with content only), allow — Write tool will handle validation
[ -z "$FILE_PATH" ] && exit 0

# Normalize: strip leading ./ if present
FILE_PATH="${FILE_PATH#./}"

# Normalize absolute paths: strip CLAUDE_PROJECT_DIR prefix if present
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [[ "$FILE_PATH" == "$CLAUDE_PROJECT_DIR"/* ]]; then
  FILE_PATH="${FILE_PATH#$CLAUDE_PROJECT_DIR/}"
fi

case "$AGENT" in
  spec)
    # FR spec files: knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/04-microservices/[^/]+/FR-[A-Z]+-[0-9]+--[a-z0-9-]+\.md$'; then
      exit 0
    fi
    # Also allow: .work/brainstorming/ for brainstorming outputs
    if echo "$FILE_PATH" | grep -qE '^\.work/brainstorming/'; then
      exit 0
    fi
    ;;

  impl)
    # IMP spec files: knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/04-microservices/[^/]+/FR-[A-Z]+-[0-9]+--[a-z0-9-]+-impl\.md$'; then
      exit 0
    fi
    ;;

  test)
    # TST spec files: knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/04-microservices/[^/]+/FR-[A-Z]+-[0-9]+--[a-z0-9-]+-test\.md$'; then
      exit 0
    fi
    ;;

  contract)
    # Central contracts:
    #   knowledge/02-central-contracts/apis/api-*.yaml
    #   knowledge/02-central-contracts/events/evt-*.yaml
    #   knowledge/02-central-contracts/global-error-codes.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/02-central-contracts/apis/api-[a-z0-9-]+\.yaml$'; then
      exit 0
    fi
    if echo "$FILE_PATH" | grep -qE '^knowledge/02-central-contracts/events/evt-[a-z0-9-]+\.yaml$'; then
      exit 0
    fi
    if echo "$FILE_PATH" | grep -qE '^knowledge/02-central-contracts/global-error-codes\.md$'; then
      exit 0
    fi
    ;;

  architecture)
    # System architecture:
    #   knowledge/03-system-architecture/C4-context-diagram.md
    #   knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md
    # Global standards:
    #   knowledge/01-global-standards/hard-boundaries.md
    #   knowledge/01-global-standards/coding-conventions.md
    #   knowledge/01-global-standards/cross-cutting-patterns.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/03-system-architecture/C4-context-diagram\.md$'; then
      exit 0
    fi
    if echo "$FILE_PATH" | grep -qE '^knowledge/03-system-architecture/ADRs/ADR-[0-9]+--[a-z0-9-]+\.md$'; then
      exit 0
    fi
    if echo "$FILE_PATH" | grep -qE '^knowledge/01-global-standards/(hard-boundaries|coding-conventions|cross-cutting-patterns)\.md$'; then
      exit 0
    fi
    ;;

  techdesign)
    # Tech design: knowledge/04-microservices/{svc}/tech-design.md
    if echo "$FILE_PATH" | grep -qE '^knowledge/04-microservices/[^/]+/tech-design\.md$'; then
      exit 0
    fi
    ;;

  compliance)
    # Compliance reports: knowledge/04-microservices/_compliance-reports/
    if echo "$FILE_PATH" | grep -qE '^knowledge/04-microservices/_compliance-reports/'; then
      exit 0
    fi
    # Also allow .work/reports/
    if echo "$FILE_PATH" | grep -qE '^\.work/reports/'; then
      exit 0
    fi
    ;;

  orchestrator)
    # Orchestrator chỉ đọc + dispatch — không được phép ghi file
    # Mọi Bash command cố gắng ghi file sẽ bị chặn
    echo "[knowledge:orchestrator] Write operations are forbidden for orchestrator" >&2
    exit 2
    ;;

  *)
    echo "validate-knowledge-output-path.sh: unknown agent '$AGENT'" >&2
    exit 2
    ;;
esac

echo "[knowledge:$AGENT] Forbidden write path: $FILE_PATH" >&2
exit 2

#!/usr/bin/env bash
# validate-sync.sh — Check consistency across roadmap, backlog, and board
# Usage: ./validate-sync.sh [project_root]
#   project_root defaults to current directory

set -euo pipefail

PROJECT_ROOT="${1:-.}"
ROADMAP="$PROJECT_ROOT/agent_docs/roadmap.md"
BACKLOG="$PROJECT_ROOT/.work/backlog.md"
BOARD="$PROJECT_ROOT/.work/board.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

warn() { echo -e "${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
err()  { echo -e "${RED}[ERR]${NC}  $1"; ERRORS=$((ERRORS + 1)); }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }

echo "=== Sprint Sync Validator ==="
echo ""

# --- Check files exist ---
if [[ ! -f "$ROADMAP" ]]; then
    warn "Roadmap not found at $ROADMAP — skipping roadmap checks"
    ROADMAP=""
fi
if [[ ! -f "$BACKLOG" ]]; then
    warn "Backlog not found at $BACKLOG — skipping backlog checks"
    BACKLOG=""
fi
if [[ ! -f "$BOARD" ]]; then
    warn "Board not found at $BOARD — skipping board checks"
    BOARD=""
fi

# --- Extract Feature IDs from Roadmap ---
if [[ -n "$ROADMAP" ]]; then
    echo "--- Roadmap: $ROADMAP ---"
    ROADMAP_FEATURES=$(grep -oP 'FR-[A-Z]+-\d+' "$ROADMAP" | sort -u || true)
    FEATURE_COUNT=$(echo "$ROADMAP_FEATURES" | grep -c .)
    ok "Found $FEATURE_COUNT feature IDs in roadmap"
fi

# --- Board → Backlog Reference Check ---
if [[ -n "$BOARD" ]]; then
    echo ""
    echo "--- Board → Backlog References ---"
    BOARD_BLS=$(grep -oP 'BL-\d+' "$BOARD" | sort -u || true)
    BOARD_TASK_COUNT=$(grep -cP '^\| T-\d+' "$BOARD" || echo 0)
    ok "Found $BOARD_TASK_COUNT tasks on board"

    if [[ -n "$BACKLOG" ]]; then
        for bl in $BOARD_BLS; do
            if grep -q "$bl" "$BACKLOG"; then
                ok "Board ref $bl → found in backlog"
            else
                err "Board ref $bl → NOT FOUND in backlog (orphaned)"
            fi
        done
    else
        warn "Cannot check board→backlog refs: no backlog file"
    fi
fi

# --- Backlog → Roadmap Reference Check ---
if [[ -n "$BACKLOG" ]]; then
    echo ""
    echo "--- Backlog → Roadmap References ---"
    BACKLOG_FRS=$(grep -oP 'FR-[A-Z]+-\d+' "$BACKLOG" | sort -u || true)
    BACKLOG_BL_COUNT=$(grep -cP '^\| BL-\d+' "$BACKLOG" || echo 0)
    ok "Found $BACKLOG_BL_COUNT backlog entries"

    if [[ -n "$ROADMAP" ]]; then
        for fr in $BACKLOG_FRS; do
            if echo "$ROADMAP_FEATURES" | grep -q "$fr"; then
                ok "Backlog ref $fr → found in roadmap"
            else
                err "Backlog ref $fr → NOT FOUND in roadmap (orphaned)"
            fi
        done
    else
        warn "Cannot check backlog→roadmap refs: no roadmap file"
    fi
fi

# --- Status Consistency: Backlog Done → Board Tasks Done ---
if [[ -n "$BOARD" ]] && [[ -n "$BACKLOG" ]]; then
    echo ""
    echo "--- Status Consistency ---"

    while IFS= read -r line; do
        bl_id=$(echo "$line" | grep -oP 'BL-\d+' | head -1 || true)
        bl_status=$(echo "$line" | grep -oP '✅ Done|🚧 In Progress|🔲 Todo|⛔ Blocked' | head -1 || true)

        if [[ -z "$bl_id" ]] || [[ -z "$bl_status" ]]; then
            continue
        fi

        board_tasks=$(grep -cP "T-\d+.*$bl_id" "$BOARD" || echo 0)
        board_done=$(grep -cP "✅ Done.*$bl_id" "$BOARD" || echo 0)

        if [[ "$bl_status" == "✅ Done" ]]; then
            if [[ "$board_tasks" -eq 0 ]]; then
                warn "$bl_id: backlog Done but no board tasks found"
            elif [[ "$board_done" -lt "$board_tasks" ]]; then
                warn "$bl_id: backlog Done but only $board_done/$board_tasks board tasks done"
            else
                ok "$bl_id: backlog Done, all $board_tasks board tasks done"
            fi
        fi

        if [[ "$bl_status" == "🚧 In Progress" ]]; then
            if [[ "$board_tasks" -eq 0 ]]; then
                warn "$bl_id: backlog In Progress but no board tasks found"
            fi
        fi
    done < <(grep -P '^\| BL-\d+' "$BACKLOG")
fi

# --- Circular Dependency Check ---
if [[ -n "$BACKLOG" ]]; then
    echo ""
    echo "--- Dependency Check ---"

    declare -A BL_DEPS
    while IFS= read -r line; do
        bl_id=$(echo "$line" | grep -oP 'BL-\d+' | head -1 || true)
        deps=$(echo "$line" | grep -oP 'BL-\d+' | tail -n +2 || true)
        if [[ -n "$bl_id" ]] && [[ -n "$deps" ]]; then
            for dep in $deps; do
                if [[ "$dep" != "$bl_id" ]]; then
                    BL_DEPS["$bl_id"]+="$dep "
                else
                    err "$bl_id depends on itself (self-reference)"
                fi
            done
        fi
    done < <(grep -P '^\| BL-\d+' "$BACKLOG")

    # Simple cycle detection: if A depends on B and B depends on A
    for a in "${!BL_DEPS[@]}"; do
        for b in ${BL_DEPS[$a]}; do
            if [[ -n "${BL_DEPS[$b]:-}" ]] && echo "${BL_DEPS[$b]}" | grep -q "$a"; then
                err "Circular dependency: $a ↔ $b"
            fi
        done
    done

    if [[ ${#BL_DEPS[@]} -gt 0 ]]; then
        ok "Dependency graph scan complete: ${#BL_DEPS[@]} items with dependencies"
    else
        ok "No dependencies between backlog items"
    fi
fi

# --- Summary ---
echo ""
echo "=== Validation Summary ==="
echo -e "${RED}Errors:   $ERRORS${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"

if [[ $ERRORS -gt 0 ]]; then
    echo ""
    echo "❌ Validation FAILED — fix $ERRORS error(s) above"
    exit 1
else
    echo ""
    echo "✅ Validation PASSED"
    exit 0
fi

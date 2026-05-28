#!/bin/bash
# Check traceability: every FR has complete spec chain
# Run after implementation to verify coverage

set -e

echo "=== Traceability Check ==="
echo ""

FR_COUNT=0
CHAIN_COMPLETE=0
CHAIN_BROKEN=0

for fr in .work/srs/FR-*.md; do
    FR_ID=$(basename "$fr" | grep -oP 'FR-AUTH-\d+')
    FR_COUNT=$((FR_COUNT + 1))

    echo "Checking $FR_ID..."

    MISSING=""

    # Check SRS
    if [ ! -f ".work/srs/${FR_ID}--"*.md ] && [ ! -f "$fr" ]; then
        MISSING="$MISSING SRS"
    fi

    # Check IMP spec
    if [ ! -f ".work/impl-specs/${FR_ID}-impl.md" ]; then
        MISSING="$MISSING IMP"
    fi

    # Check TST spec
    if [ ! -f ".work/test-specs/${FR_ID}-test.md" ]; then
        MISSING="$MISSING TST"
    fi

    # Check work package
    if [ ! -f ".work/lld/agent_docs/features/${FR_ID}.md" ]; then
        MISSING="$MISSING WP"
    fi

    # Check HLD backfill
    if ! grep -q "Phase 06 HLD" "$fr" 2>/dev/null; then
        MISSING="$MISSING HLD_BACKFILL"
    fi

    if [ -z "$MISSING" ]; then
        echo "  PASS: Complete traceability chain"
        CHAIN_COMPLETE=$((CHAIN_COMPLETE + 1))
    else
        echo "  FAIL: Missing:$MISSING"
        CHAIN_BROKEN=$((CHAIN_BROKEN + 1))
    fi
done

echo ""
echo "=== Results ==="
echo "Total FRs: $FR_COUNT"
echo "Complete chains: $CHAIN_COMPLETE"
echo "Broken chains: $CHAIN_BROKEN"

if [ "$CHAIN_BROKEN" -eq 0 ]; then
    echo ""
    echo "All traceability chains complete. PASSED."
    exit 0
else
    echo ""
    echo "Some traceability chains are broken. FAILED."
    exit 1
fi

#!/bin/bash
# Pre-flight validation script for Auth Service
# Run before starting implementation

set -e

echo "=== Auth Service Pre-Flight Check ==="
echo ""

# Check required directories exist
echo "[1/7] Checking specification directories..."
REQUIRED_DIRS=(
    ".work/srs"
    ".work/hld"
    ".work/lld"
    ".work/impl-specs"
    ".work/test-specs"
    ".work/agent-setup"
)
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  PASS: $dir exists"
    else
        echo "  FAIL: $dir is missing"
        exit 1
    fi
done

# Check all FR specs have corresponding IMP and TST specs
echo "[2/7] Checking FR spec completeness..."
for fr in .work/srs/FR-*.md; do
    FR_ID=$(basename "$fr" | grep -oP 'FR-AUTH-\d+')
    IMP_FILE=".work/impl-specs/${FR_ID}-impl.md"
    TST_FILE=".work/test-specs/${FR_ID}-test.md"
    WP_FILE=".work/lld/agent_docs/features/${FR_ID}.md"

    if [ -f "$IMP_FILE" ]; then
        echo "  PASS: $FR_ID has IMP spec"
    else
        echo "  FAIL: $FR_ID missing IMP spec at $IMP_FILE"
        exit 1
    fi

    if [ -f "$TST_FILE" ]; then
        echo "  PASS: $FR_ID has TST spec"
    else
        echo "  FAIL: $FR_ID missing TST spec at $TST_FILE"
        exit 1
    fi

    if [ -f "$WP_FILE" ]; then
        echo "  PASS: $FR_ID has work package"
    else
        echo "  FAIL: $FR_ID missing work package at $WP_FILE"
        exit 1
    fi
done

# Check HLD completeness
echo "[3/7] Checking HLD completeness..."
HLD_FILES=(
    ".work/hld/ADR-001-service-decomposition.md"
    ".work/hld/ADR-002-api-gateway-and-versioning.md"
    ".work/hld/ADR-003-event-taxonomy.md"
    ".work/hld/system-architecture.md"
    ".work/hld/domain-service-mapping.yaml"
    ".work/hld/hard-boundaries.md"
)
for file in "${HLD_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  PASS: $file exists"
    else
        echo "  FAIL: $file is missing"
        exit 1
    fi
done

# Check LLD completeness
echo "[4/7] Checking LLD completeness..."
if [ -f ".work/lld/auth-service-tech-design.md" ]; then
    # Check all 9 sections exist
    SECTIONS=$(grep -c "^## [0-9]" .work/lld/auth-service-tech-design.md)
    if [ "$SECTIONS" -ge 9 ]; then
        echo "  PASS: Tech design has $SECTIONS sections (need >= 9)"
    else
        echo "  FAIL: Tech design has $SECTIONS sections (need >= 9)"
        exit 1
    fi
else
    echo "  FAIL: Tech design missing"
    exit 1
fi

if [ -f ".work/lld/api-auth.yaml" ]; then
    echo "  PASS: OpenAPI contract exists"
else
    echo "  FAIL: OpenAPI contract missing"
    exit 1
fi

# Check architecture leaks in SRS
echo "[5/7] Checking for architecture leaks in SRS..."
LEAKS=$(grep -rn "api_endpoint\|/api/v\|service-name\|CREATE TABLE\|Redis\|Kafka\|postgres\|mysql\|docker\|kubernetes" .work/srs/ 2>/dev/null || true)
if [ -z "$LEAKS" ]; then
    echo "  PASS: No architecture leaks in SRS"
else
    echo "  WARN: Potential leaks found:"
    echo "$LEAKS"
fi

# Check SRS backfill
echo "[6/7] Checking HLD backfill in SRS..."
for fr in .work/srs/FR-*.md; do
    if grep -q "Phase 06 HLD" "$fr"; then
        echo "  PASS: $(basename $fr) has HLD backfill"
    else
        echo "  WARN: $(basename $fr) missing HLD backfill"
    fi
done

# Check AGENTS.md
echo "[7/7] Checking agent setup..."
if [ -f ".work/agent-setup/AGENTS.md" ]; then
    echo "  PASS: AGENTS.md exists"
else
    echo "  FAIL: AGENTS.md missing"
    exit 1
fi

if [ -f ".work/agent-setup/routing-table.md" ]; then
    echo "  PASS: Routing table exists"
else
    echo "  FAIL: Routing table missing"
    exit 1
fi

echo ""
echo "=== Pre-Flight Check PASSED ==="
echo "Ready for implementation."

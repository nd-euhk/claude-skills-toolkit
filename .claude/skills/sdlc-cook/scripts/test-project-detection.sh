#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# test-project-detection.sh — Unit tests cho detect-project.sh
# ─────────────────────────────────────────────────────────────
# Tạo mock directory structures trong /tmp/, chạy classify_project,
# assert kết quả mong đợi. Tự cleanup sau khi chạy.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/detect-project.sh"

PASS=0
FAIL=0
TMP_ROOT=""

cleanup() {
  if [ -n "$TMP_ROOT" ] && [ -d "$TMP_ROOT" ]; then
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

TMP_ROOT=$(mktemp -d /tmp/test-project-detection-XXXXXX)

# ── Helpers ──

assert_eq() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $test_name — expected='$expected', got='$actual'"
    FAIL=$((FAIL + 1))
  fi
}

# ── Test 1: Submodule ──
test_submodule() {
  echo "Test 1: Submodule detection"

  local ws="$TMP_ROOT/submodule-test"
  mkdir -p "$ws/services/auth-service/src"
  cd "$ws"

  # Setup workspace repo
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "submodule content" > README.md
  git add README.md && git commit -m "init" > /dev/null 2>&1

  # Tạo submodule (simulate: .git là file trỏ đến thư mục git thật)
  mkdir -p "$ws/.git/modules/auth-service"
  echo "gitdir: $ws/.git/modules/auth-service" > "$ws/services/auth-service/.git"
  echo "[submodule \"auth-service\"]" >> "$ws/.gitmodules"
  echo "  path = services/auth-service" >> "$ws/.gitmodules"

  local result
  result=$(classify_project "$ws/services/auth-service" "$ws/services/auth-service")
  assert_eq "submodule → submodule" "submodule" "$result"
}

# ── Test 2: Gitignored Subproject ──
test_gitignored() {
  echo "Test 2: Gitignored subproject detection"

  local ws="$TMP_ROOT/gitignored-test"
  mkdir -p "$ws/frontend/web-app"
  cd "$ws"

  # Setup workspace repo
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "workspace" > README.md
  echo "frontend/web-app/" > .gitignore
  git add README.md .gitignore && git commit -m "init" > /dev/null 2>&1

  # Setup subproject (có .git directory riêng)
  cd "$ws/frontend/web-app"
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "web app" > README.md
  git add README.md && git commit -m "init sub" > /dev/null 2>&1

  local result
  result=$(classify_project "$ws/frontend/web-app" "$ws/frontend/web-app")
  assert_eq "gitignored → gitignored-subproject" "gitignored-subproject" "$result"
}

# ── Test 3: Workspace Member ──
test_workspace_member() {
  echo "Test 3: Workspace member detection"

  local ws="$TMP_ROOT/workspace-test"
  mkdir -p "$ws/src/main"
  cd "$ws"

  # Setup workspace repo (monolithic — tất cả src/ trong cùng repo)
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "monolith" > README.md
  git add README.md && git commit -m "init" > /dev/null 2>&1

  local result
  result=$(classify_project "$ws" "$ws")
  assert_eq "workspace member → workspace-member" "workspace-member" "$result"
}

# ── Test 4: Nested Git (subdir có .git dir, không ignore) ──
test_nested_not_ignored() {
  echo "Test 4: Nested git dir but NOT gitignored"

  local ws="$TMP_ROOT/nested-test"
  mkdir -p "$ws/lib/shared-lib"
  cd "$ws"

  # Setup workspace repo
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "workspace" > README.md
  git add README.md && git commit -m "init" > /dev/null 2>&1

  # Setup nested git repo (KHÔNG bị gitignore)
  cd "$ws/lib/shared-lib"
  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "lib" > README.md
  git add README.md && git commit -m "init lib" > /dev/null 2>&1

  # shared-lib có .git dir nhưng không bị parent ignore → vẫn là workspace-member
  # Vì git check-ignore sẽ return 1 (không ignore)
  local result
  result=$(classify_project "$ws/lib/shared-lib" "$ws/lib/shared-lib")
  # NOTE: Nó có .git dir + parent workspace có .git dir + check-ignore trả về 1
  # → fall qua Case B → Case C = workspace-member
  assert_eq "nested-not-ignored → workspace-member" "workspace-member" "$result"
}

# ── Test 5: Project Root = Workspace Root ──
test_root_is_workspace() {
  echo "Test 5: Project root is workspace root"

  local ws="$TMP_ROOT/root-ws-test"
  mkdir -p "$ws"
  cd "$ws"

  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "mono" > README.md
  git add README.md && git commit -m "init" > /dev/null 2>&1

  local result
  result=$(classify_project "$ws" "$ws")
  assert_eq "root-is-workspace → workspace-member" "workspace-member" "$result"
}

# ── Test 6: find_git_root (walk-up) ──
test_find_git_root() {
  echo "Test 6: find_git_root walk-up"

  local ws="$TMP_ROOT/walkup-test"
  mkdir -p "$ws/deep/nested/dir"
  cd "$ws"

  git init --initial-branch=main > /dev/null 2>&1
  git config user.email "test@test.com"
  git config user.name "Test"
  echo "walkup" > README.md
  git add README.md && git commit -m "init" > /dev/null 2>&1

  local result
  result=$(find_git_root "$ws/deep/nested/dir")
  assert_eq "walk-up từ deep dir → tìm ws root" "$ws" "$result"

  # Test không có git
  local no_git_result
  no_git_result=$(find_git_root "/tmp" || echo "NOT_FOUND")
  assert_eq "no git → NOT_FOUND" "NOT_FOUND" "$no_git_result"
}

# ── Run All ──

echo ""
echo "═══════════════════════════════════════════"
echo "  Project Detection Unit Tests"
echo "═══════════════════════════════════════════"
echo ""

test_submodule
test_gitignored
test_workspace_member
test_nested_not_ignored
test_root_is_workspace
test_find_git_root

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS PASS, $FAIL FAIL ($((PASS + FAIL)) total)"
echo "═══════════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0

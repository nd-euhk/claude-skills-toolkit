# Per-Feature Cook Procedure

Dùng trong Phase 4 (Execute Batch) của sdlc-cook-overnight — procedure cho MỘT feature,
controller tự làm. Nguồn gốc: sdlc-cook SKILL.md Bước 3-4.5 + 6 + 8. Không duplicate
chi tiết — link ngược về sdlc-cook khi cần.

## 1. Project Detect

`detect-project.sh` là **library** (không phải CLI) — phải `source` rồi gọi hàm
`classify_project <git_root> <service_dir>`. Path script absolute từ `WORKSPACE_ROOT`
(controller KHÔNG phụ thuộc CWD):

```bash
# sdlc-cook scripts/detect-project.sh — LIBRARY: source + gọi classify_project
DETECT_SCRIPT="${WORKSPACE_ROOT}/.claude/skills/sdlc-cook/scripts/detect-project.sh"
source "$DETECT_SCRIPT"

# Bước 1: canonical lookup service_dir (chi tiết: sdlc-cook/references/project-detection.md)
SERVICE_DIR="$(find "$WORKSPACE_ROOT" -type d -name "$service" \
  -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/.claude/*" \
  -not -path "*/agent_docs/*" -not -path "*/target/*" -not -path "*/build/*" \
  -not -path "*/dist/*" | head -1)"

# Bước 2: walk up tìm git root gần nhất
PROJECT_ROOT="$(find_git_root "$SERVICE_DIR")"

# Bước 3: classify type
PROJECT_TYPE="$(classify_project "$PROJECT_ROOT" "$SERVICE_DIR")"
```

Lấy `project_root`, `project_type`, `workspace_root`. Chi tiết:
`reference: sdlc-cook/references/project-detection.md`

## 2. Tách Branch (type-aware)

### Type 2 — workspace-member: worktree

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"            # feature/FEAT-001-auth-service
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/feature-${FEAT_ID}-${SERVICE}"
git -C "$project_root" worktree add -b "$BRANCH" "$WORKTREE_PATH" "origin/main"
REPO_PATH="$WORKTREE_PATH"                        # nơi chạy code/test
SPEC_ROOT="$WORKSPACE_ROOT"                       # nơi chứa agent_docs/ (hoặc "$WORKTREE_PATH" nếu có copy specs)
```

### Type 1 — submodule / gitignored-subproject: in-place checkout + restore

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
ORIGINAL_BRANCH=$(git -C "$project_root" branch --show-current)   # capture TRƯỚC — sub-repo đã sẵn trên branch gốc
git -C "$project_root" checkout -b "$BRANCH" HEAD
REPO_PATH="$project_root"                          # sub-repo
SPEC_ROOT="$workspace_root"                        # specs ở parent workspace
```

**Quy tắc cứng Type 1:** capture `original_branch` trước; tuần tự; restore LUÔN chạy
sau feature (Bước 7); PR về remote của sub-repo; specs ở parent.
Chi tiết: `sdlc-cook/references/project-detection.md#branch-strategy-theo-project-type`

## 3. Capture Baseline (bắt buộc)

Test chạy trong `REPO_PATH` (nơi có code), baseline script ở `SPEC_ROOT/.claude/scripts/`
(dùng absolute path — controller không phụ thuộc CWD):

```bash
(cd "$REPO_PATH" && ./gradlew :{service}:test)     # hoặc lệnh test theo framework
"${SPEC_ROOT}/.claude/scripts/baseline" parse \
  --framework junit-xml \
  --test-output-dir "$REPO_PATH/build/test-results/test/" \
  --fr-id {FR-ID} --layer {be|fe} --service {service} \
  --test-command "./gradlew :{service}:test"
```

Output lưu `.work/baselines/{YYYYMMDD}-{FR-ID}-{BE|FE}.json`. **Output camelCase**
(`tcIndex`, `preExistingFailures`, `byFile`) — truyền thẳng vào args, KHÔNG map key.
Xem sdlc-cook Bước 4.5 + `sdlc-cook/references/tdd-orchestration.md#baseline-capture`.

## 4. Board Update → In Progress

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for overnight cook",
  prompt: `FR-{DOM}-{NNN} → 🚧 In Progress. Feature ${FEAT_ID} đang được cook (overnight).`
})
```

## 5. Read Specs + Extract TCs

Đọc trong `SPEC_ROOT/agent_docs/`:
- TST: `${SPEC_ROOT}/agent_docs/{layer}/{service}/test-specs/{FR-ID}-test.md`
- IMP: `${SPEC_ROOT}/agent_docs/{layer}/{service}/implementation/{FR-ID}-impl.md`
- Feature: `${SPEC_ROOT}/agent_docs/features/{FR-ID}.md`
- Tech-design: `${SPEC_ROOT}/agent_docs/tech-design/{service}-service.md`

Extract TCs: `{ id, name, layer, risk }`, sort CRITICAL → HIGH → MEDIUM → LOW.

## 6. Dispatch Workflow

```javascript
Workflow({
  scriptPath: ".claude/workflows/cook/workflow-sdlc-cook.js",
  args: {
    featureName: "${FEAT_ID}: ${name}",
    frId: "${FR-ID}",
    service: "${service}",
    layer: "backend",                       // "backend" | "frontend"
    testCases: [ /* TCs đã sort */ ],
    baseline: {
      path: ".work/baselines/${date}-${FR-ID}-${BE|FE}.json",
      tcIndex: {}, preExistingFailures: [], byFile: {},
    },
    flow: "cook",
    repoPath: "${REPO_PATH}",       // Type 1: sub-repo; Type 2: worktree
    specRoot: "${SPEC_ROOT}",       // Type 1: parent; Type 2: nơi chứa agent_docs/
  }
})
```

`repoPath`/`specRoot` quyết định CWD của mọi agent trong workflow (workflow KHÔNG dùng
cwd của controller). Không truyền → workflow chạy trong CWD hiện tại (backward-compatible).
Xem sdlc-cook Bước 8.

## 7. Collect

`Workflow()` return `COOK_REPORT`: `{ status: completed|partial|failed, tcResults,
gateLight, gateFull, summary, warnings, nextStep }`. Lưu vào records của batch.

**Type 1 — restore bắt buộc (finally):** ngay sau khi lưu COOK_REPORT (completed hay fail):
`git -C "$project_root" checkout "$ORIGINAL_BRANCH"`. Restore fail → warning HIGH, chặn
task kế (sub-repo đang ở branch task sẽ làm hỏng task sau). Ghi branch + commit hash vào
morning report nếu feature fail — để sáng checkout lại debug.

## Resume (sáng hôm sau)

Nếu Workflow crash đêm qua → resume bằng `resumeFromRunId` (tool-level, ưu tiên) hoặc
`resumeFrom` arg (`completedTcIds`, `gateLightPass`, `refactorDone`, `gateFullPass`)
lấy từ COOK_REPORT/log trước. Xem `sdlc-cook/references/error-recovery.md#workflow-crash`.

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

**`BASE_REF`** = ref mà FR checkout từ (điểm xuất phát branch) + PR target — controller tính TRƯỚC
khi gọi procedure này, cùng lúc capture `project_root`/`project_type` ở §1. Resolve release-branch-
aware TRƯỚC khi fork (SKILL Phase 3): fork sai base → MR diff kéo rác.
- **Mặc định (không chain)** = integration base theo type: Type 1 `HEAD` (branch gốc đang checkout);
  Type 2 KHÔNG auto `origin/main` — repo release-branch (main stale, open feature MR target khác
  default) → derive integration base qua skill git (`workflow-pr.md` Step 3 MR-convention); không
  confirm được → fork default, PR-time guard không target mù (unattended row 19).
- **Chained FR_k (k≥2)** = branch thật của FR_(k-1) (`feature/...`, local, cùng git root). Controller
  giữ ref này sau khi FR_(k-1) đạt Phase 5 terminal `completed`. Vì FR_(k-1) đã push + branch ổn định
  (không force-push lại), dùng trực tiếp làm base ⇒ code FR_(k-1) nằm sẵn trong FR_k.
- **Gate dispatch chain**: chained FR_k CHỈ được dispatch sau khi FR_(k-1) Phase 5 terminal
  `status = completed`. Upstream partial/failed → chain halt — FR_k + các FR sau không chạy.
  PR/auth/review outcome của upstream KHÔNG chặn (continue-on-fail).
- **Worktree/branch upstream được GIỮ qua đêm** (không xóa giữa đêm) — branch upstream là baseRef của
  FR kế; cleanup chỉ khi morning merge xong (xem SKILL Key Notes).

### Type 2 — workspace-member: worktree

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"            # feature/FEAT-001-auth-service
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/feature-${FEAT_ID}-${SERVICE}"
git -C "$project_root" worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE_REF"
REPO_PATH="$WORKTREE_PATH"                        # nơi chạy code/test
SPEC_ROOT="$WORKSPACE_ROOT"                       # nơi chứa agent_docs/ (hoặc "$WORKTREE_PATH" nếu có copy specs)
```

`BASE_REF` default = integration base (plain: `origin/main`; release-branch: derive qua skill git,
KHÔNG auto `main`); chained = `<branch FR_(k-1)>` — branch upstream local, cùng repo (worktree chia
sẻ chung refs, `worktree add` nhận branch local như bình thường).

### Type 1 — submodule / gitignored-subproject: in-place checkout + restore

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
ORIGINAL_BRANCH=$(git -C "$project_root" branch --show-current)   # capture TRƯỚC — sub-repo đã sẵn trên branch gốc
git -C "$project_root" checkout -b "$BRANCH" "$BASE_REF"
REPO_PATH="$project_root"                          # sub-repo
SPEC_ROOT="$workspace_root"                        # specs ở parent workspace
```

`BASE_REF` default = `HEAD` (branch từ điểm hiện tại = branch gốc đã checkout); chained = `<branch
FR_(k-1)>` (in-place checkout từ branch upstream ngay trong sub-repo).

**Quy tắc cứng Type 1:** capture `original_branch` trước; tuần tự; restore `original_branch` theo
quy tắc per-chain ở Bước 7 (cuối chain, hoặc feature fail làm chain halt — KHÔNG restore giữa chain
khi success); PR về remote của sub-repo; specs ở parent.
Chi tiết: `sdlc-cook/references/project-detection.md#branch-strategy-theo-project-type`

## 3. Harness Setup + Baseline Gate (bắt buộc)

### 3a. Harness Setup — detect build tool + cài deps

Detect build tool trong `REPO_PATH` (đúng CWD của mọi lệnh test/build):

| Marker | Build tool | Test command (per service) | JUnit output dir |
|--------|-----------|---------------------------|------------------|
| `./gradlew` | Gradle | `./gradlew :{service}:test` | `build/test-results/test/` |
| `mvnw` / `pom.xml` | Maven | `./mvnw -pl :{service} test` (hoặc `mvn -pl :{service} test`) | `target/surefire-reports/` |
| `package.json` | npm / yarn / pnpm | `npm test` / `yarn test` / `pnpm test` | — (jest/vitest → baseline `jest-json` / `vitest-json`) |
| `requirements.txt` / `pyproject.toml` | Python | `pytest` | — (baseline `pytest-json`) |

Cài deps theo loại (Type 2 — worktree mới (fresh checkout từ `$BASE_REF`), deps gitignored nên
không có; Type 1 — in-place trên project đang chạy, deps đã sẵn → no-op):

- **Gradle / Maven**: deps tự resolve qua cache `~/.gradle` / `~/.m2` khi build lần đầu
  (lần đầu chậm — tính vào baseline time). Không cần lệnh cài riêng.
- **npm**: `npm ci` (nếu có `package-lock.json`) hoặc `npm install`
- **yarn / pnpm**: `yarn install` / `pnpm install`
- **Python**: `pip install -r requirements.txt`

### 3b. Capture Baseline

Test chạy trong `REPO_PATH`, baseline script ở `SPEC_ROOT/.claude/scripts/` (absolute
path — controller không phụ thuộc CWD). Dùng test command + output dir từ 3a (Gradle/Maven
cùng emit JUnit XML → `--framework junit-xml`; npm/py dùng `jest-json`/`vitest-json`/`pytest-json`):

```bash
(cd "$REPO_PATH" && {TEST_COMMAND}); TEST_EXIT=$?  # test command từ 3a; hứng exit code
"${SPEC_ROOT}/.claude/scripts/baseline" parse \
  --framework {junit-xml|jest-json|pytest-json} \
  --test-output-dir "$REPO_PATH/{OUTPUT_DIR}" \   # output dir từ 3a
  --fr-id {FR-ID} --layer {be|fe} --service {service} \
  --test-command "{TEST_COMMAND}" \
  --exit-code "$TEST_EXIT"
```

Output lưu `.work/baselines/{YYYYMMDD}-{FR-ID}-{BE|FE}.json`. **Output camelCase**
(`tcIndex`, `preExistingFailures`, `byFile`) — truyền thẳng vào args, KHÔNG map key.
Xem sdlc-cook Bước 4.5 + `sdlc-cook/references/tdd-orchestration.md#baseline-capture`.

### 3c. Baseline Gate — phân loại 3 kết quả (auto-decision đêm)

Sau 3b, kiểm tra baseline file CÓ tồn tại không + tỷ lệ pre-existing fail:

| Kết quả | Dấu hiệu | Auto-decision đêm | Morning report |
|---------|----------|-------------------|----------------|
| **OK** | File tồn tại, ≤10% pre-existing fail | Dispatch workflow (bình thường) | — |
| **SOFT** | File tồn tại, >10% pre-existing fail | Dispatch + warning (RED/GATE exclude pre-existing) | Mục Warnings |
| **HARD-FAIL** | File KHÔNG tồn tại — test không chạy được (lệnh sai, thiếu deps, build lỗi, output-dir sai) | **SKIP feature** — KHÔNG dispatch workflow | Mục Skipped — "harness không chạy được": ghi lệnh test + exit code + thiếu gì |
| **HARD-FAIL** (incomplete) | File tồn tại nhưng `incomplete: true` — `exitCode != 0` VÀ `0 tests` parse được (compile/collection fail, không phải test fail) | **SKIP feature** — baseline không sound cho delta-gate (so delta trên nền capture thiếu = false interference) | Mục Skipped — "baseline incomplete (compile/collection fail)": ghi lệnh test + exit code |

**Tại sao HARD-FAIL = skip, không chạy:** dispatch mà không có baseline (hoặc baseline
`incomplete` — compile/collection fail) → workflow chạy mù (INTERFERENCE bị disable hoặc
sai trên nền capture thiếu) và mọi RED đánh nhau với test harness hỏng → feature fail
chắc chắn, tốn nguyên đêm. Skip + ghi rõ để sáng human fix (cài deps / đúng lệnh test)
rồi đêm sau chạy lại.

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
  scriptPath: ".claude/workflows/cook/workflow-sdlc-cook-overnight.js",
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
    chunkSize: 4,                   // số TC mỗi RED chunk VÀ GREEN chunk (3-5 khuyến nghị)
  }
})
```

`repoPath`/`specRoot` quyết định CWD của mọi agent trong workflow (workflow KHÔNG dùng
cwd của controller). Không truyền → workflow chạy trong CWD hiện tại (backward-compatible).
Xem sdlc-cook Bước 8.

**Per-chunk loop TDD (khác sdlc-cook per-TC):** workflow này chạy per chunk — RED chunk (viết test
theo chunk, verify RED 1 lần/chunk, accidental-green LIGHT flag không sabotage) → GREEN chunk
(3-5 TC/chunk, INTERFERENCE-LIGHT trên file touched) → GATE light (L2-L4 structural, non-blocking)
→ REFACTOR light; sau loop: REFACTOR full → GATE full (INTERFERENCE-FULL baseline). Dùng 8 agent
overnight riêng: `sdlc-tdd-be-red-overnight`,
`sdlc-tdd-be-green-overnight`, `sdlc-tdd-fe-red-overnight`, `sdlc-tdd-fe-green-overnight`,
`sdlc-tdd-be-gate-overnight`, `sdlc-tdd-fe-gate-overnight`, `sdlc-tdd-be-refactor-overnight`,
`sdlc-tdd-fe-refactor-overnight` (không đụng agent per-TC của sdlc-cook). GATE/REFACTOR
overnight trả structured JSON (`GATE_RESULT`/`REFACTOR_RESULT`) thay vì markdown như agent
per-TC — để workflow đọc được `status`/`passed`/`findingsFixed` qua schema enforcement.

## 7. Collect + Persist Checkpoint

`Workflow()` return `COOK_REPORT`: `{ status: completed|partial|failed, tcResults,
gateLight, gateFull, summary, warnings, nextStep }`.

**Persist ngay khi nhận** — TRƯỚC mọi bước khác, gọi harness ghi checkpoint xuống disk.
Checkpoint là nguồn sự thật của Phase 6 (dựng morning report từ disk, không từ memory) và
của Resume (sáng đọc lại được sau crash):

```bash
# out-dir absolute (controller không cd) — ${WORKSPACE_ROOT} như §1
python3 .claude/skills/sdlc-cook-overnight/scripts/persist-cook-report.py \
  --out-dir "${WORKSPACE_ROOT}/.work/reports/per-feature" \
  --layer {backend|frontend} <<'JSON'
{COOK_REPORT — nguyên văn từ Workflow() return}
JSON
# stdout = path đã ghi; exit 0 = ok; exit 2 = payload/layer invalid; exit 1 = lỗi IO
```

- **Verify checkpoint tồn tại** sau khi gọi: `.work/reports/per-feature/{FR-ID}-{BE|FE}.json`.
- **Script fail (exit ≠ 0 / file thiếu)** → controller tự `Write` file checkpoint đó với cùng
  nội dung COOK_REPORT (fallback — không để feature mất checkpoint vì harness lỗi).
- **Checkpoint = COOK_REPORT thuần** (do workflow sinh, ghi nguyên văn). Controller không thêm
  field vào file này; branch/commit/verdict/PR link là controller state, điền vào Phase 6.

**Semantics per-chunk loop (khác per-TC):**
- `tcResults[].status = SKIPPED` = accidental-green LIGHT (test đã pass sẵn, flag cho human
  sáng review — KHÔNG sabotage). Không coi là fail — TRỪ KHI mọi TC đều SKIPPED (không có
  implementation nào được sinh ra → feature `status = "failed"`, không báo `completed`).
- `warnings[]` chứa INTERFERENCE-LIGHT entries (string per broken test) + accidental-green
  flags. Feature `status = "failed"` khi có INTERFERENCE hoặc BLOCKED/STALE/ERROR.
- INTERFERENCE-LIGHT **không** đổi `tcResults[].status` — TC trong chunk vẫn giữ `DONE`
  (test của chúng pass; interference là test KHÁC bị break). Chi tiết interference nằm ở
  `warnings[]`, feature-level status = `failed` qua guard `interferenceCount > 0`.

**Type 1 — restore theo chain (finally):** restore `original_branch` TRỪ KHI feature `completed` VÀ
còn FR kế trong chain sẽ branch từ nó (middle success). Cụ thể: FR cuối chain (kể cả chain 1 FR) →
restore; FR middle FAIL/partial → restore (chain halt — không FR nào branch từ nó); FR middle success
→ KHÔNG restore (FR kế checkout in-place từ branch này, `BASE_REF` = branch FR vừa xong). Restore:
`git -C "$project_root" checkout "$ORIGINAL_BRANCH"`. Restore fail → warning HIGH, chặn
task kế (sub-repo đang ở branch task sẽ làm hỏng task sau). Nếu feature fail → controller giữ
branch + commit hash (điền vào morning report Phase 6) để sáng checkout lại debug.

## Resume (sáng hôm sau)

Nếu Workflow crash đêm qua → resume bằng `resumeFromRunId` (tool-level, ưu tiên) hoặc
`resumeFrom` arg (`completedTcIds`, `completedTcFiles`, `refactorDone`,
`gateFullPass`) — lấy từ **checkpoint file** `.work/reports/per-feature/{FR-ID}-{BE|FE}.json`
của feature đó (COOK_REPORT đã persist ở §7 — không phải memory/session log). `completedTcFiles`
(map `{ tcId: [files] }`) bảo toàn `filesChanged` cho các TC đã xong — nếu thiếu, TC resumed
vẫn `DONE` nhưng `filesChanged` rỗng (ảnh hưởng GATE INTERFERENCE-FULL). Xem
`sdlc-cook/references/error-recovery.md#workflow-crash`.

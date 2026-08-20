---
name: sdlc-cook
description: >-
  Thực thi TDD code từ ready specs trong worktree isolation cho MỘT feature.
  Dùng khi cần code từ specs có sẵn: "cook feature", "code task", "build
  feature", "triển khai code", "implement feature", "TDD feature", "cook
  FEAT-001", "cook task", "viết code cho feature". Tự động detect project
  type (submodule / gitignored-subproject / workspace-member) để chọn chiến lược
  branch đúng: worktree (workspace-member) hoặc in-place checkout + restore
  (submodule / gitignored-subproject). Không dùng cho task nhỏ — task ≤2 file,
  không API/schema/security dùng /sdlc-quick. Để chạy nhiều feature song song
  (chỉ Type 2), gọi /sdlc-cook riêng cho từng feature — Claude Code agents view
  sẽ hiển thị parallel execution. Type 1 bắt buộc tuần tự.
version: 2.4.0
argument-hint: "FEAT-{NNN}"
allowed-tools: Read, Write, Edit, Bash, Skill, Agent, Workflow, AskUserQuestion
---

# SDLC Cook

Điểm vào cho TDD code execution từ ready specs. Skill này nhận MỘT feature
đã có đầy đủ specs (SRS + HLD + LLD + IMP + TST) và thực thi TDD cycle trong
worktree isolation — khác với sdlc-quick (task nhỏ, không specs, không worktree)
và sdlc-orchestrator (full pipeline HITL).

Để chạy nhiều feature song song (chỉ hợp lệ với Type 2 — workspace-member): gọi
`/sdlc-cook FEAT-001` trong một tab, `/sdlc-cook FEAT-003` trong tab khác.
Claude Code agents view hiển thị parallel execution — không cần dispatcher nội bộ.
Type 1 (submodule/gitignored-subproject) bắt buộc tuần tự — in-place checkout không
thể chạy song song.

## Cách Gọi

```
/sdlc-cook FEAT-001    # Cook 1 feature trong worktree riêng
```

## Hard Boundaries

- **Chỉ cook feature có status "🟢 Ready for Cook"** — phải có đủ SRS + HLD + LLD + IMP + TST
- **Không tự sửa specs** — chỉ đọc `agent_docs/`, không ghi feature specs
- **Branch isolation bắt buộc, type-aware** — Type 2 (workspace-member): worktree riêng;
  Type 1 (submodule/gitignored-subproject): checkout in-place trong sub-repo, tuần tự,
  restore bắt buộc
- **Không tự merge** — luôn tạo PR cho human review trước khi merge
- **Không tự sửa sprint files** — luôn spawn subagent `sdlc-sprint-board` / `sdlc-sprint-backlog`

---

## Flow Chi Tiết

**Precondition:** Feature có status "🟢 Ready for Cook" trên board.

### Bước 1: Verify Readiness

1. Đọc `.work/board.md` và `.work/backlog.md`
2. Tìm feature được yêu cầu
3. Route theo status:

| Status | Hành động |
|--------|-----------|
| **🟢 Ready for Cook** | Tiếp tục Bước 2 |
| **🔲 Todo** | Từ chối: "Feature chưa có specs đầy đủ. Chạy flow task (orchestrator) trước." |
| **🚧 In Progress** | Cảnh báo: "Feature đang được cook. Muốn spawn thêm developer hay chờ?" |
| **👀 In Review** | Cảnh báo: "Feature đang review. Cook lại từ đầu hay chỉ fix review findings?" |
| **✅ Done** | Cảnh báo: "Feature đã done. Muốn sửa gì thêm? Nếu bug → orchestrator flow fixbug." |
| **⛔ Blocked** | Từ chối + nêu lý do block |
| **Không tìm thấy** | Từ chối: "Feature không tồn tại trên board." |

### Bước 2: Dependency Check

Trước khi cook, đọc `depends_on` từ `.work/backlog.md` cho feature được yêu cầu:

```python
for dep_id in feature.depends_on:
    dep = board.get(dep_id)
    if dep.status == "✅ Done":
        continue  # Dependency đã merge → OK
    else:
        warn(f"⚠️ {feature.id} depends on {dep_id} ({dep.status}) — chưa Done.")
```

Nếu có dependency chưa Done → cảnh báo human, hỏi có tiếp tục không. Không chặn cứng —
human có thể có lý do chính đáng để cook trước (vd: dependency sắp merge, cook để
song song review).

### Bước 3: Project Detection

Xác định project root và type cho feature. Chi tiết thuật toán:
→ `references/project-detection.md`

Tóm tắt:

```
1. Từ feature spec → lấy layer (backend/frontend) + service name
2. Verify agent_docs/{layer}/{service}/ tồn tại
3. find directory {service} trong toàn bộ workspace
4. Walk up từ directory đó → tìm .git gần nhất
5. Classify: submodule | gitignored-subproject | workspace-member
```

Kết quả trả về `Project` object:

```
Project: {
  name: "auth-service",
  code_path: "services/auth-service",
  project_root: "services/auth-service",
  project_type: "submodule",              // Type 1: submodule | gitignored-subproject
  workspace_root: "/home/user/workspace", //         Type 2: workspace-member
  original_branch: "main",                // Type 1: branch sub-repo đang đứng (để restore)
  worktree_path: null                     // Type 2: .claude/worktrees/feature-{feat}-{svc}
}
```

### Bước 4: Tách Branch (type-aware)

Chiến lược phụ thuộc `project_type`:

| Type | Chiến lược | Parallel? | PR remote |
|------|-----------|-----------|-----------|
| **Type 1** (submodule / gitignored-subproject) | Checkout in-place trong sub-repo | ❌ Tuần tự | Remote của chính sub-repo |
| **Type 2** (workspace-member) | Worktree isolation | ✅ | Remote của workspace |

**Branch Naming Convention** (giống nhau mọi type):

```
feature/{FEAT_ID}-{service}   ← cook flow (feature implementation)
change/{CR_ID}-{service}      ← cr flow (change request)
fix/{BUG_ID}-{service}        ← fixbug flow (defect fix)
```

#### Type 2 — workspace-member: worktree

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"            # vd: feature/FEAT-001-auth-service
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/feature-${FEAT_ID}-${SERVICE}"
git -C "$project_root" worktree add -b "$BRANCH" "$WORKTREE_PATH" "origin/main"
```

Controller KHÔNG `cd` — mọi lệnh dùng absolute path (`git -C`, `repoPath`, `specRoot`).

#### Type 1 — submodule / gitignored-subproject: in-place checkout + restore

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"
ORIGINAL_BRANCH=$(git -C "$project_root" branch --show-current)   # capture TRƯỚC — không re-checkout
git -C "$project_root" checkout -b "$BRANCH" HEAD
```

**Quy tắc cứng Type 1:**
1. Capture `original_branch` TRƯỚC khi checkout — sub-repo đã sẵn trên branch gốc.
2. Tuần tự bắt buộc — in-place checkout ảnh hưởng cả working project (sub-repo là
   directory trong tree của parent).
3. Restore LUÔN chạy (finally semantics): sau feature xong, `git -C "$project_root"
   checkout "$ORIGINAL_BRANCH"`. Restore fail → chặn task kế.
4. PR về remote của chính sub-repo.
5. Specs (`agent_docs/`) ở workspace PARENT — không nằm trong sub-repo.

Verify specs truy cập được từ `specRoot`:

```bash
SPECS_ROOT="${WORKSPACE_ROOT}"     # Type 1: specs ở parent workspace
# Type 2: nếu worktree có copy specs (agent_docs đã commit) → SPECS_ROOT="$WORKTREE_PATH"
ls "$SPECS_ROOT/agent_docs/{layer}/{service}/test-specs/"
```

### Bước 4.5: Capture Baseline

Sau khi tách branch và verify specs, capture baseline trạng thái test suite hiện tại.
**Baseline là bắt buộc** để INTERFERENCE-LIGHT (per-TC) và INTERFERENCE-FULL (GATE light)
hoạt động — thiếu baseline, toàn bộ cơ chế phát hiện interference bị vô hiệu hóa.

Test chạy trong **repo path** (nơi có code), baseline script ở **specRoot** (nơi có `.claude/`):

```bash
# Type 1 — sub-repo (code + test output ở project_root; .claude ở workspace_root):
(cd "$project_root" && ./gradlew :{service}:test)
"${WORKSPACE_ROOT}/.claude/scripts/baseline" parse \
  --framework junit-xml \
  --test-output-dir "$project_root/build/test-results/test/" \
  --fr-id {FR-ID} --layer {be|fe} --service {service} \
  --test-command "./gradlew :{service}:test"

# Type 2 — worktree (code chạy trong worktree; .claude/scripts ở SPECS_ROOT — absolute):
(cd "$WORKTREE_PATH" && ./gradlew :{service}:test)
"${SPECS_ROOT}/.claude/scripts/baseline" parse \
  --framework junit-xml \
  --test-output-dir "$WORKTREE_PATH/build/test-results/test/" \
  --fr-id {FR-ID} --layer {be|fe} --service {service} \
  --test-command "./gradlew :{service}:test"
```

Kết quả lưu vào `.work/baselines/{YYYYMMDD}-{FR-ID}-{BE|FE}.json`.

**Lưu ý SPECS_ROOT:** specRoot cho baseline script phải là root **chứa `.claude/scripts/`** —
thường là `$WORKSPACE_ROOT`. Chỉ đặt `SPECS_ROOT="$WORKTREE_PATH"` nếu worktree thực sự
commit cả `.claude/` (không chỉ `agent_docs/`) — nếu không, path script sẽ broken.

**Lưu ý:** Baseline JSON output dùng camelCase (`tcIndex`, `preExistingFailures`, `byFile`)
— có thể truyền trực tiếp vào Workflow args không cần map key. Xác nhận field name
khớp với `workflow-sdlc-cook.js` constants trước khi dispatch.

### Bước 5: Update Board — Bắt Đầu Cook

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for cook start",
  prompt: "FR-{DOM}-{NNN} → 🚧 In Progress. Feature FEAT-{NNN} đang được cook bởi sdlc-cook."
})
```

### Bước 6: Đọc Specs + Trích Xuất TCs

Đọc specs từ `specRoot` (Type 1 = workspace_root của parent; Type 2 = worktree có copy specs):

1. TST spec: `${specRoot}/agent_docs/{layer}/{service}/test-specs/FR-{ID}-test.md`
2. IMP spec: `${specRoot}/agent_docs/{layer}/{service}/implementation/FR-{ID}-impl.md`
3. Feature spec: `${specRoot}/agent_docs/features/FR-{ID}.md`
4. Tech-design: `${specRoot}/agent_docs/tech-design/{service}-service.md`

Trích xuất danh sách TCs: ID, tên, layer, risk (CRITICAL|HIGH|MEDIUM|LOW).
Sắp xếp: CRITICAL → HIGH → MEDIUM → LOW.

### Bước 7: Xác Định BE/FE

| FR spec có | Agent family |
|-----------|-------------|
| `backend_service` | `sdlc-tdd-be-*` |
| `frontend_app` | `sdlc-tdd-fe-*` |
| Cả hai | Backend trước, frontend sau. Song song nếu thực sự độc lập. |

### Bước 8: Dispatch Cook Workflow

**Pre-dispatch (Bước 3-4.5 đã hoàn tất):** branch đã tách (Type 2: worktree; Type 1:
in-place checkout trong sub-repo + đã capture `original_branch`), baseline đã capture
(output camelCase). Workflow KHÔNG phụ thuộc CWD của controller — mọi đường dẫn đi qua
`repoPath` (nơi chạy code/test) và `specRoot` (nơi chứa `agent_docs/`).

```javascript
Workflow({
  scriptPath: ".claude/workflows/cook/workflow-sdlc-cook.js",
  args: {
    // ── Định danh feature (required) ──
    featureName: "FEAT-001: User Login",
    frId: "FR-AUTH-001",
    service: "auth-service",
    layer: "backend",                    // "backend" | "frontend" — chọn agent family

    // ── Nơi chạy (nên truyền explicit — quyết định CWD của mọi agent) ──
    repoPath: "/home/user/workspace/services/auth-service",  // Type 1: sub-repo; Type 2: worktree
    specRoot: "/home/user/workspace",                        // Type 1: parent; Type 2: worktree (nếu có copy specs)

    // ── Test cases (required) — đã sắp xếp CRITICAL → HIGH → MEDIUM → LOW ──
    testCases: [
      { id: "TC-AUTH-001", name: "Login thành công", layer: "integration", risk: "CRITICAL" },
      { id: "TC-AUTH-002", name: "Login thất bại sai password", layer: "unit", risk: "HIGH" },
    ],

    // ── Baseline (required) — đã capture, truyền trực tiếp không cần map key ──
    // Baseline JSON output dùng camelCase (tcIndex, preExistingFailures, byFile) —
    // có thể truyền trực tiếp vào Workflow args. Xem Bước 4.5.
    baseline: {
      path: ".work/baselines/20260731-FR-AUTH-001-BE.json",
      tcIndex: {},
      preExistingFailures: [],
      byFile: {},
    },

    // ── Optional ──
    flow: "cook",                        // default: "cook"
    agents: {},                          // override agent types nếu cần
    resumeFrom: null,                    // set khi resume sau partial failure
  }
})
```

**Lưu ý:** Không truyền `repoPath`/`specRoot` → workflow chạy trong CWD của session
hiện tại (backward-compatible với cách gọi cũ). Với Type 1, NHỚ restore `original_branch`
sau khi workflow return (finally semantics — xem Bước 10).

Workflow chạy per-TC TDD cycle (RED→GREEN→INTERFERENCE-LIGHT→REFACTOR-light),
GATE light (+ INTERFERENCE-FULL), REFACTOR full, GATE full.
Workflow chạy foreground — `Workflow()` return khi hoàn thành hoặc fail.

### Bước 9: Nhận Kết Quả Workflow

Workflow trả về `COOK_REPORT` object. Kiểm tra `report.status`:

| Status | Hành động |
|--------|-----------|
| `completed` | Tiếp tục Bước 10 (Merge + Cleanup) |
| `partial` | GATE full fail — báo human failure details, giữ worktree để debug |
| `failed` | INTERFERENCE hoặc GATE light fail — báo human, giữ worktree |

Sau khi nhận kết quả → spawn board agent cập nhật status:

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for cook result",
  prompt: `FR-{DOM}-{NNN}: ${status}. Feature FEAT-{NNN}.`
})
```

Status transition map: → `references/tdd-orchestration.md#status-transition-map`

### Bước 10: Merge + Cleanup

Khi workflow hoàn thành (status = "completed"):

1. **Pre-merge check**: verify tests pass, GATE verified, không có uncommitted changes
2. **sdlc-review-codechange gợi ý** (optional, non-blocking): AskUserQuestion hỏi human có muốn
   review source code trước khi tạo PR không — gọi với `--base <PR target>`
   (Type 2: `origin/main`; Type 1: `$ORIGINAL_BRANCH`) để review scope = diff feature...target,
   và `--specs <workspace>/agent_docs/features/<FEAT_ID>/` để check code có đáp ứng tài liệu không
3. **Tạo PR** từ branch → target branch:
   - Type 2: worktree branch `feature/{FEAT_ID}-{SERVICE}` → `origin/main` của workspace
   - Type 1: branch của sub-repo → branch gốc của chính sub-repo (remote của sub-repo)
4. **Type 1 — restore bắt buộc (finally):** sau khi PR tạo xong (hoặc feature fail):
   `git -C "$project_root" checkout "$ORIGINAL_BRANCH"`. Restore fail → chặn task kế.
5. **Human review** → merge / request changes / close
6. **Cleanup** worktree (Type 2) + update board

Chi tiết: → `references/merge-manager.md`

---

## Error Recovery Overview

Tất cả error scenarios được xử lý tập trung tại: → `references/error-recovery.md`

Tóm tắt nhanh:

| Tình huống | Hành động |
|-----------|-----------|
| INTERFERENCE | Dừng, human resolve, resume với `resumeFrom` |
| TC BLOCKED/STALE | Tiếp tục TC khác, human fix spec/code |
| GATE fail | Retry ×2, nếu vẫn fail → escalate human |
| Workflow crash | Resume với `resumeFromRunId` (tool-level) hoặc `resumeFrom` arg |
| Merge conflict | Agent resolve hoặc human resolve |
| PR closed | Hỏi human: keep or delete worktree |
| Worktree creation fail | Kiểm tra branch/path/disk |

---

## Integration Points

### Board Update Protocol

Sau mỗi milestone, spawn subagent cập nhật board (KHÔNG tự sửa file):

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for cook progress",
  prompt: `Cập nhật board:
    - FR-{DOM}-{NNN}: status = {new_status}, assignee = sdlc-cook
    - Feature: FEAT-{NNN}`
})
```

### Sau khi Cook Hoàn Thành

Sau khi merge PR → cleanup worktree → spawn cả board + backlog agents:

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Mark feature done on board",
  prompt: "FR-{DOM}-{NNN} → ✅ Done. PR merged."
})
Agent({
  subagent_type: "sdlc-sprint-backlog",
  description: "Mark feature done on backlog",
  prompt: "FEAT-{NNN} status → ✅ Done."
})
```

---

## Key Notes

- **Một feature = một branch, type-aware** — Type 2: worktree riêng; Type 1: in-place
  checkout trong sub-repo + restore bắt buộc
- **Workflow chạy foreground** — `Workflow()` return khi hoàn thành hoặc fail
- **Luôn PR human review** — không auto-merge. Chi tiết: `references/merge-manager.md`

## Full Reference

- `references/tdd-orchestration.md` — TDD cycle orchestration, agent spawn reference, baseline capture, GATE protocol, board status transition map
- `references/project-detection.md` — Git project detection: walk-up + 3 case classification
- `references/merge-manager.md` — PR creation, conflict detection, worktree cleanup
- `references/error-recovery.md` — Centralized error recovery: INTERFERENCE, GATE fail, merge conflict, worktree crash, resume procedure

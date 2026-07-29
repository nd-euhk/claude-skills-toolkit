# Flow: Single Feature Cook

**Trigger:** `/sdlc-cook FEAT-{NNN}`
**Precondition:** Feature có status "🟢 Ready for Cook" trên board.

## Bước 1: Verify Readiness

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

## Bước 2: Project Detection

Chạy `references/project-detection.md` → trả về `Project` object.

```
Project: {
  name: "auth-service",
  code_path: "services/auth-service",
  project_root: "services/auth-service",
  project_type: "submodule",
  workspace_root: "/home/user/workspace",
  worktree_path: "/home/user/workspace/.claude/worktrees/cook-auth-service-FEAT-001"
}
```

## Bước 3: Dirty Check + Worktree

### 3a: Dirty Check

Chạy dirty check theo project type của feature:

```bash
# submodule/gitignored: cd {project_root} && git status --porcelain
# workspace-member:    git status --porcelain -- {code_path}
```

Nếu dirty → `AskUserQuestion`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Working tree có uncommitted changes. Xử lý thế nào?",
    header: "Git",
    options: [
      { label: "Xem diff", description: "Hiển thị git diff --stat trước khi quyết định" },
      { label: "Stash", description: "git stash — lưu tạm, restore sau khi cook xong" },
      { label: "Commit", description: "Commit changes trước khi cook" },
      { label: "Tiếp tục", description: "Giữ dirty tree ⚠️ Có thể gây conflict" }
    ],
    multiSelect: false
  }]
})
```

Nếu chọn "Xem diff" → hiển thị `git diff --stat` rồi hỏi lại.

### 3b: Create Worktree

Worktree được tạo ở `.claude/worktrees/cook-{service}-{feat-id}/` dưới workspace root,
bất kể project type. Dùng absolute path để tránh nhầm lẫn.

```bash
WORKTREE_NAME="cook-${SERVICE}-${FEAT_ID}"
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/${WORKTREE_NAME}"

# Branch point phụ thuộc project type
if [ "$project_type" = "submodule" ] || [ "$project_type" = "gitignored-subproject" ]; then
  BRANCH_POINT="HEAD"
else
  BRANCH_POINT="origin/main"
fi

# Tạo worktree từ project root, path trỏ ra workspace root
cd "$project_root"
git worktree add "$WORKTREE_PATH" "$BRANCH_POINT"
```

### 3c: Verify Worktree

```bash
ls "$WORKTREE_PATH/agent_docs/"
# Xác nhận specs có thể truy cập được trong worktree
```

## Bước 4: Update Board

```bash
Skill(sprint, "--board")
# Prompt: "FEAT-{NNN} status → 🚧 Cooking, worktree = {worktree_path}"
```

## Bước 5: Đọc Specs + Trích Xuất TCs

Đọc từ worktree (các file đã có sẵn từ agent_docs/):

1. TST spec: `agent_docs/{layer}/{service}/test-specs/FR-{ID}-test.md`
2. IMP spec: `agent_docs/{layer}/{service}/implementation/FR-{ID}-impl.md`
3. Feature spec: `agent_docs/features/FR-{ID}.md`
4. Tech-design: `agent_docs/tech-design/{service}-service.md`

Trích xuất danh sách TCs: ID, tên, layer, risk (CRITICAL|HIGH|MEDIUM|LOW).
Sắp xếp: CRITICAL → HIGH → MEDIUM → LOW.

## Bước 6: Xác Định BE/FE

| FR spec có | Agent family |
|-----------|-------------|
| `backend_service` | `sdlc-tdd-be-*` |
| `frontend_app` | `sdlc-tdd-fe-*` |
| Cả hai | Backend trước, frontend sau. Song song nếu thực sự độc lập. |

## Bước 7: Dispatch Cook Workflow

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-cook.js",
  args: {
    featureName: "FEAT-001: User Login",
    frId: "FR-AUTH-001",
    service: "auth-service",
    layer: "backend",
    repoPath: "services/auth-service",
    projectType: "submodule",
    worktreePath: worktree_path,
    testCases: [
      { id: "1", name: "should_authenticate_valid_user", risk: "CRITICAL" },
      { id: "2", name: "should_reject_invalid_password", risk: "HIGH" },
      // ...
    ],
    baseline: {
      path: ".work/baselines/20260729-FR-AUTH-001-BE.json",
      // baseline được capture bởi workflow bên trong worktree
    },
    agents: {
      red: "sdlc-tdd-be-red",
      green: "sdlc-tdd-be-green",
      refactor: "sdlc-tdd-be-refactor",
      gate: "sdlc-tdd-be-gate",
    }
  }
})
```

Workflow tự capture baseline, chạy per-TC TDD cycle, GATE light, REFACTOR full,
GATE full. Workflow chạy foreground — `Workflow()` return khi hoàn thành hoặc fail,
không cần polling như multi mode.

## Bước 8: Nhận Kết Quả Workflow

Workflow trả về `COOK_REPORT` object (schema: `references/pipeline-status.md`).
Kiểm tra `report.status`:

| Status | Hành động |
|--------|-----------|
| `completed` | Tiếp tục Bước 9 (Merge + Cleanup) |
| `partial` | GATE full fail — báo human failure details, giữ worktree để debug |
| `failed` | INTERFERENCE hoặc GATE light fail — báo human, giữ worktree |

Sau khi nhận kết quả → `Skill(sprint, "--board")` cập nhật board.

## Bước 9: Merge + Cleanup

Khi workflow hoàn thành (status = "completed") → `references/merge-manager.md`:

1. Pre-merge check (tests pass, GATE verified)
2. Tạo PR từ worktree branch → `cook-${SERVICE}-${FEAT_ID}`
3. Human review → merge / request changes / close
4. Cleanup worktree + update board (merge-manager.md có cleanup procedure)

## Error Recovery

Tất cả error scenarios được xử lý tập trung tại: → `references/error-recovery.md`

Tóm tắt nhanh:

| Tình huống | Hành động |
|-----------|-----------|
| INTERFERENCE | Dừng, human resolve, resume với `resumeFrom` |
| TC BLOCKED/STALE | Tiếp tục TC khác, human fix spec/code |
| GATE fail | Retry ×2, nếu vẫn fail → escalate human |
| Workflow crash | Đọc `.pipeline/` status → resume với `resumeFrom` |
| Merge conflict | Agent resolve hoặc human resolve |
| PR closed | Hỏi human: keep or delete worktree |
| Worktree creation fail | Kiểm tra branch/path/disk |

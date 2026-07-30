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

## Bước 2: Dependency Check

Trước khi cook, đọc `depends_on` field từ `.work/backlog.md`:

```markdown
### FEAT-001: Auth
- depends_on: []

### FEAT-002: Payment
- depends_on: [FEAT-001]
```

```python
def check_dependencies(feature, board):
    warnings = []
    for dep_id in feature.depends_on:
        dep = board.get(dep_id)
        if dep.status == "✅ Done":
            continue  # Dependency đã merge → OK
        else:
            warnings.append(f"⚠️ {feature.id} depends on {dep_id} ({dep.status}) — chưa Done.")
    return warnings
```

Nếu có dependency chưa Done → hiển thị cảnh báo, hỏi human:

```
⚠️ FEAT-002 depends on:
   - FEAT-001 (🚧 Cooking) — chưa Done.

   Tiếp tục cook FEAT-002? (có thể gây conflict khi merge)

Options: [Tiếp tục] [Hủy — chờ FEAT-001 Done rồi cook sau]
```

Không chặn cứng — human có thể có lý do chính đáng (vd: dependency sắp merge,
cook song song để review cùng lúc). Nhưng phải cảnh báo rõ ràng.

## Bước 3: Project Detection

Chạy `references/project-detection.md` → trả về `Project` object.

```
Project: {
  name: "auth-service",
  code_path: "services/auth-service",
  project_root: "services/auth-service",
  project_type: "submodule",
  workspace_root: "/home/user/workspace",
  worktree_path: "/home/user/workspace/.claude/worktrees/feature-FEAT-001-auth-service"
}
```

## Bước 4: Create Worktree

Worktree checkout trực tiếp từ target branch → clean state, không cần dirty check.
Worktree được tạo ở `.claude/worktrees/{branch-slug}/` dưới workspace root,
bất kể project type. Dùng absolute path để tránh nhầm lẫn.

### Branch Naming Convention

```
feature/{FEAT_ID}-{service}   ← cook flow (feature implementation)
change/{CR_ID}-{service}      ← cr flow (change request)
fix/{BUG_ID}-{service}        ← fixbug flow (defect fix)
```

```bash
BRANCH="feature/${FEAT_ID}-${SERVICE}"            # vd: feature/FEAT-001-auth-service
WORKTREE_NAME="feature-${FEAT_ID}-${SERVICE}"      # vd: feature-FEAT-001-auth-service
WORKTREE_PATH="${WORKSPACE_ROOT}/.claude/worktrees/${WORKTREE_NAME}"

# Branch point phụ thuộc project type
if [ "$project_type" = "submodule" ] || [ "$project_type" = "gitignored-subproject" ]; then
  BRANCH_POINT="HEAD"
else
  BRANCH_POINT="origin/main"
fi

# Tạo worktree từ project root trên branch mới, path trỏ ra workspace root
cd "$project_root"
git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BRANCH_POINT"
```

### Verify Worktree

```bash
ls "$WORKTREE_PATH/agent_docs/"
# Xác nhận specs có thể truy cập được trong worktree
```

## Bước 5: Update Board

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for FEAT-001 cook start",
  prompt: "FR-{DOM}-{NNN} → 🚧 In Progress. Feature FEAT-{NNN} đang được cook bởi sdlc-cook."
})
```

## Bước 6: Đọc Specs + Trích Xuất TCs

Đọc từ worktree (các file đã có sẵn từ agent_docs/):

1. TST spec: `agent_docs/{layer}/{service}/test-specs/FR-{ID}-test.md`
2. IMP spec: `agent_docs/{layer}/{service}/implementation/FR-{ID}-impl.md`
3. Feature spec: `agent_docs/features/FR-{ID}.md`
4. Tech-design: `agent_docs/tech-design/{service}-service.md`

Trích xuất danh sách TCs: ID, tên, layer, risk (CRITICAL|HIGH|MEDIUM|LOW).
Sắp xếp: CRITICAL → HIGH → MEDIUM → LOW.

## Bước 7: Xác Định BE/FE

| FR spec có | Agent family |
|-----------|-------------|
| `backend_service` | `sdlc-tdd-be-*` |
| `frontend_app` | `sdlc-tdd-fe-*` |
| Cả hai | Backend trước, frontend sau. Song song nếu thực sự độc lập. |

## Bước 8: Dispatch Cook Workflow

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
GATE full. Workflow chạy foreground — `Workflow()` return khi hoàn thành hoặc fail.

## Bước 9: Nhận Kết Quả Workflow

Workflow trả về `COOK_REPORT` object (schema định nghĩa trong
`.claude/workflows/automation/workflow-sdlc-cook.js`).
Kiểm tra `report.status`:

| Status | Hành động |
|--------|-----------|
| `completed` | Tiếp tục Bước 10 (Merge + Cleanup) |
| `partial` | GATE full fail — báo human failure details, giữ worktree để debug |
| `failed` | INTERFERENCE hoặc GATE light fail — báo human, giữ worktree |

Sau khi nhận kết quả → spawn board agent cập nhật status:

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for FEAT-001 cook result",
  prompt: `FR-{DOM}-{NNN}: ${status}. Feature FEAT-{NNN}.`
})
```

| Workflow Status | Board Status |
|----------------|-------------|
| `completed` | 👀 In Review (PR created) |
| `partial` | 🚧 In Progress (GATE full fail — cần fix) |
| `failed` | ⛔ Blocked |

## Bước 10: Merge + Cleanup

Khi workflow hoàn thành (status = "completed") → `references/merge-manager.md`:

1. Pre-merge check (tests pass, GATE verified)
2. Tạo PR từ worktree branch → `feature/${FEAT_ID}-${SERVICE}`
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
| Workflow crash | Resume với `resumeFromRunId` (tool-level) hoặc `resumeFrom` arg. Chi tiết: `error-recovery.md` |
| Merge conflict | Agent resolve hoặc human resolve |
| PR closed | Hỏi human: keep or delete worktree |
| Worktree creation fail | Kiểm tra branch/path/disk |

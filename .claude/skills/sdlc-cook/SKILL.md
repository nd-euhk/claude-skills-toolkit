---
name: sdlc-cook
description: >-
  Thực thi TDD code từ ready specs trong worktree isolation cho MỘT feature.
  Dùng khi cần code từ specs có sẵn: "cook feature", "code task", "build
  feature", "triển khai code", "implement feature", "TDD feature", "cook
  FEAT-001", "cook task", "viết code cho feature". Tự động detect project
  type (submodule / gitignored-subproject / workspace-member) để tạo worktree
  đúng repo. Không dùng cho task nhỏ — task ≤2 file, không API/schema/security
  dùng /sdlc-quick. Để chạy nhiều feature song song, gọi /sdlc-cook riêng cho
  từng feature — Claude Code agents view sẽ hiển thị parallel execution.
version: 2.2.0
argument-hint: "FEAT-{NNN}"
allowed-tools: Read, Write, Edit, Bash, Skill, Agent, Workflow, AskUserQuestion
---

# SDLC Cook

Điểm vào cho TDD code execution từ ready specs. Skill này nhận MỘT feature
đã có đầy đủ specs (SRS + HLD + LLD + IMP + TST) và thực thi TDD cycle trong
worktree isolation — khác với sdlc-quick (task nhỏ, không specs, không worktree)
và sdlc-orchestrator (full pipeline HITL).

Để chạy nhiều feature song song: gọi `/sdlc-cook FEAT-001` trong một tab,
`/sdlc-cook FEAT-003` trong tab khác. Claude Code agents view hiển thị
parallel execution — không cần dispatcher nội bộ.

## Cách Gọi

```
/sdlc-cook FEAT-001    # Cook 1 feature trong worktree riêng
```

## Hard Boundaries

- **Chỉ cook feature có status "🟢 Ready for Cook"** — phải có đủ SRS + HLD + LLD + IMP + TST
- **Không tự sửa specs** — chỉ đọc `agent_docs/`, không ghi feature specs
- **Worktree isolation bắt buộc** — feature chạy trong worktree riêng
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
  project_type: "submodule",
  workspace_root: "/home/user/workspace",
  worktree_path: "/home/user/workspace/.claude/worktrees/feature-FEAT-001-auth-service"
}
```

### Bước 4: Create Worktree

Worktree checkout trực tiếp từ target branch → clean state. Worktree được tạo ở
`.claude/worktrees/{branch-slug}/` dưới workspace root, bất kể project type.

**Branch Naming Convention:**

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

# Tạo worktree từ project root trên branch mới
cd "$project_root"
git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BRANCH_POINT"
```

Verify specs có thể truy cập được trong worktree:

```bash
ls "$WORKTREE_PATH/agent_docs/"
```

### Bước 5: Update Board — Bắt Đầu Cook

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for cook start",
  prompt: "FR-{DOM}-{NNN} → 🚧 In Progress. Feature FEAT-{NNN} đang được cook bởi sdlc-cook."
})
```

### Bước 6: Đọc Specs + Trích Xuất TCs

Đọc từ worktree (các file đã có sẵn từ agent_docs/):

1. TST spec: `agent_docs/{layer}/{service}/test-specs/FR-{ID}-test.md`
2. IMP spec: `agent_docs/{layer}/{service}/implementation/FR-{ID}-impl.md`
3. Feature spec: `agent_docs/features/FR-{ID}.md`
4. Tech-design: `agent_docs/tech-design/{service}-service.md`

Trích xuất danh sách TCs: ID, tên, layer, risk (CRITICAL|HIGH|MEDIUM|LOW).
Sắp xếp: CRITICAL → HIGH → MEDIUM → LOW.

### Bước 7: Xác Định BE/FE

| FR spec có | Agent family |
|-----------|-------------|
| `backend_service` | `sdlc-tdd-be-*` |
| `frontend_app` | `sdlc-tdd-fe-*` |
| Cả hai | Backend trước, frontend sau. Song song nếu thực sự độc lập. |

### Bước 8: Dispatch Cook Workflow

```javascript
Workflow({
  scriptPath: ".claude/workflows/cook/workflow-sdlc-cook.js",
  args: {
    featureName: "FEAT-001: User Login",
    frId: "FR-AUTH-001",
    service: "auth-service",
    layer: "backend",
    repoPath: "services/auth-service",     // ← path đến project root
    projectType: "submodule",              // ← submodule | gitignored-subproject | workspace-member
    worktreePath: worktree_path,           // ← absolute path đến worktree (đã tạo sẵn)
    testCases: [...],                      // ← trích xuất từ TST spec
    baseline: { path: "...", ... },        // ← baseline path trong worktree
  }
})
```

Workflow tự capture baseline, chạy per-TC TDD cycle, GATE light, REFACTOR full,
GATE full. Workflow chạy foreground — `Workflow()` return khi hoàn thành hoặc fail.

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
2. **sdlc-review gợi ý** (optional, non-blocking): AskUserQuestion hỏi human có muốn
   review source code worktree trước khi tạo PR không
3. **Tạo PR** từ worktree branch → `feature/{FEAT_ID}-{SERVICE}`
4. **Human review** → merge / request changes / close
5. **Cleanup** worktree + update board

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

- **Một feature = một worktree** — mỗi lần gọi `/sdlc-cook` tạo một worktree riêng
- **Workflow chạy foreground** — `Workflow()` return khi hoàn thành hoặc fail
- **Luôn PR human review** — không auto-merge. Chi tiết: `references/merge-manager.md`

## Full Reference

- `references/tdd-orchestration.md` — TDD cycle orchestration, agent spawn reference, baseline capture, GATE protocol, board status transition map
- `references/project-detection.md` — Git project detection: walk-up + 3 case classification
- `references/merge-manager.md` — PR creation, conflict detection, worktree cleanup
- `references/error-recovery.md` — Centralized error recovery: INTERFERENCE, GATE fail, merge conflict, worktree crash, resume procedure

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
version: 2.0.0
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

## Flow Tổng Quan

```
Preflight (project detection)
  → Dependency Check (cảnh báo nếu depends_on chưa Done)
    → Verify Readiness (board status = 🟢 Ready for Cook)
      → Create Worktree
        → Update Board (🚧 Cooking)
          → Đọc Specs + Trích Xuất TCs
            → Dispatch Cook Workflow (TDD cycle)
              → Merge + Cleanup (PR → human review)
```

Chi tiết từng bước: → `references/flow.md`

---

## Preflight (chạy trước mỗi lần cook)

### Bước 1: Project Detection

Xác định project root và type. Chi tiết thuật toán:
→ `references/project-detection.md`

Tóm tắt:

```
1. Từ feature spec → lấy layer (backend/frontend) + service name
2. Verify agent_docs/{layer}/{service}/ tồn tại
3. find directory {service} trong toàn bộ workspace
4. Walk up từ directory đó → tìm .git gần nhất
5. Classify: submodule | gitignored-subproject | workspace-member
```

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

---

## Quick Start

```
User: /sdlc-cook FEAT-001

Skill:
  1. Preflight → project detection
  2. Dependency check → cảnh báo nếu depends_on chưa Done
  3. Verify board status = "🟢 Ready for Cook"
  4. Create worktree: .claude/worktrees/feature-FEAT-001-auth-service/
  5. Dispatch workflow-sdlc-cook trong worktree
  6. Monitor → PR → báo human review
```

---

## Integration Points

### Board Update Protocol

Sau mỗi milestone, spawn subagent cập nhật board (KHÔNG tự sửa file):

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for FEAT-001 cook progress",
  prompt: `Cập nhật board:
    - FR-{DOM}-{NNN}: status = {new_status}, assignee = sdlc-cook
    - Feature: FEAT-{NNN}`
})
```

Milestone map:

| TDD Event | Board Status |
|-----------|-------------|
| Worktree created, workflow dispatched | 🚧 In Progress |
| INTERFERENCE detected | ⛔ Blocked |
| PR created | 👀 In Review |
| PR merged | ✅ Done |
| PR closed (not merged) | 🔲 Todo |
| Workflow crash | ⛔ Blocked |

### Sau khi Cook Hoàn Thành

Sau khi merge PR → cleanup worktree → spawn cả board + backlog agents:

```javascript
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Mark FEAT-001 done on board",
  prompt: "FR-{DOM}-{NNN} → ✅ Done. PR merged."
})
Agent({
  subagent_type: "sdlc-sprint-backlog",
  description: "Mark FEAT-001 done on backlog",
  prompt: "FEAT-{NNN} status → ✅ Done."
})
```

---

## Workflow Dispatch Template

Dùng `workflow-sdlc-cook` (`.claude/workflows/automation/workflow-sdlc-cook.js`):

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-cook.js",
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

## Key Notes

- **Một feature = một worktree** — mỗi lần gọi `/sdlc-cook` tạo một worktree riêng
- **Workflow chạy foreground** — `Workflow()` return khi hoàn thành hoặc fail
- **Luôn PR human review** — không auto-merge. Chi tiết: `references/merge-manager.md`

## Full Reference

- `references/flow.md` — Cook flow: dependency check → readiness verify → worktree → TDD → PR → cleanup
- `references/project-detection.md` — Git project detection: walk-up + 3 case classification
- `references/merge-manager.md` — PR creation, conflict detection, worktree cleanup
- `references/pipeline-status.md` — TDD cycle orchestration, agent spawn reference, baseline capture, GATE protocol, board update
- `references/error-recovery.md` — Centralized error recovery: INTERFERENCE, GATE fail, merge conflict, worktree crash, resume procedure

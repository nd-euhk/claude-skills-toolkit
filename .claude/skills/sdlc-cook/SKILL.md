---
name: sdlc-cook
description: >-
  Thực thi TDD code từ ready specs — single hoặc multi-feature qua worktree
  isolation. Dùng khi cần code từ specs có sẵn: "cook feature", "code task",
  "build feature", "triển khai code", "implement feature", "TDD feature",
  "cook FEAT-001", "cook task", "viết code cho feature". Hỗ trợ 3 chế độ:
  single-feature, multi-feature (dispatcher + worktree pool), và auto (scan
  board cho Ready features). Tự động detect project type (submodule /
  gitignored-subproject / workspace-member) để tạo worktree đúng repo.
  Không dùng cho task nhỏ — task ≤2 file, không API/schema/security dùng
  /sdlc-quick.
version: 1.1.0
argument-hint: "[FEAT-{NNN}] [FEAT-{NNN},...] [--pool <N>]"
allowed-tools: Read, Write, Edit, Bash, Skill, Agent, Workflow, AskUserQuestion
---

# SDLC Cook

Điểm vào độc lập cho TDD code execution từ ready specs. Skill này nhận
feature đã có đầy đủ specs (SRS + HLD + LLD + IMP + TST) và thực thi
TDD cycle trong worktree isolation — khác với sdlc-quick (task nhỏ,
không specs, không worktree) và sdlc-orchestrator (full pipeline HITL).

## Chế Độ Gọi

```
/sdlc-cook FEAT-001                        # Single feature
/sdlc-cook FEAT-001,FEAT-003,FEAT-004       # Multi-feature (dispatcher)
/sdlc-cook FEAT-001,FEAT-003 --pool 5       # Multi + pool override
/sdlc-cook                                 # Auto: scan board → dispatch Ready features
```

| Chế độ | Args | Mô tả |
|--------|------|-------|
| **Single** | `FEAT-{NNN}` | Cook 1 feature trong worktree riêng |
| **Multi** | `FEAT-{NNN},FEAT-{NNN},... [--pool <N>]` | Dispatch nhiều feature song song qua worktree pool |
| **Auto** | *(không args)* | Scan `.work/backlog.md` → dispatch tất cả Ready features |

`--pool <N>`: override pool capacity (mặc định 3). Min=1, max=10. Warning nếu >5.

## Hard Boundaries

- **Chỉ cook feature có status "🟢 Ready for Cook"** — phải có đủ SRS + HLD + LLD + IMP + TST
- **Không tự sửa specs** — chỉ đọc `agent_docs/`, không ghi feature specs
- **Worktree isolation bắt buộc** — mỗi feature chạy trong worktree riêng
- **Không tự merge** — luôn tạo PR cho human review trước khi merge
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, ...)`

---

## Preflight (chạy mọi chế độ)

### Bước 1: Project Detection

Cho mỗi feature cần cook, xác định project root và type. Chi tiết thuật toán:
→ `references/project-detection.md`

Tóm tắt:

```
1. Từ feature spec → lấy layer (backend/frontend) + service name
2. Verify agent_docs/{layer}/{service}/ tồn tại
3. find directory {service} trong toàn bộ workspace
4. Walk up từ directory đó → tìm .git gần nhất
5. Classify: submodule | gitignored-subproject | workspace-member
```

### Bước 2: Parse Args + Route

Parse token từ raw args: tách `FEAT-{NNN}` IDs và `--pool <N>` flag.
Pool capacity mặc định = 3, clamp [1, 10], warning nếu >5.

| Args pattern | Mode | Route đến |
|-------------|------|-----------|
| `FEAT-{NNN}` (1 feature) | `single` | → `references/flow-single.md` |
| `FEAT-{NNN},FEAT-{NNN},...` | `multi` | → `references/flow-multi.md` |
| *(không args)* | `auto` | → `references/flow-multi.md` (auto mode) |

Chi tiết parsing logic và pool validation: → `references/flow-multi.md#arg-parsing`

---

## Quick Start

### Single Feature

```
User: /sdlc-cook FEAT-001

Skill:
  1. Preflight → git clean, project detection
  2. Verify board status = "🟢 Ready for Cook"
  3. Create worktree: .claude/worktrees/cook-auth-service-FEAT-001/
  4. Dispatch workflow-sdlc-cook trong worktree
  5. Monitor → PR → báo human review
```

### Multi Feature

```
User: /sdlc-cook FEAT-001,FEAT-003,FEAT-004

Skill:
  1. Preflight cho từng feature → 3 project types
  2. Dependency resolution (topological sort)
  3. Pool check → dispatch wave 1 (FEAT-001 + FEAT-003, 2 slot)
  4. Monitor pool → khi FEAT-001 done → dispatch FEAT-004
  5. PR per feature → human review từng PR
```

### Auto Mode

```
User: /sdlc-cook

Skill:
  1. Scan .work/backlog.md → features có status "🟢 Ready for Cook"
  2. Lọc theo dependency → topological sort
  3. Multi dispatch với pool capacity mặc định = 3
  4. Monitor + PR như multi mode
```

---

## Integration Points

### Board Update Protocol

Workflow agent trong worktree ghi progress qua `scripts/update-pipeline-status.sh`
vào `.pipeline/{frId}-status.json`. Skill cook ở main worktree poll file này.
Schema canonical: → `references/pipeline-status.md`

**Lưu ý:** `.pipeline/` dir được gitignore — runtime data, không commit.

Sau mỗi phase gate pass → `Skill(sprint, "--board")` cập nhật board.

### Sau khi Cook Hoàn Thành

Sau khi merge PR → cleanup worktree → `Skill(sprint, "--board --backlog")`:

```
Board: FEAT-001 = ✅ Done
Backlog: FEAT-001 status = ✅ Done
```

### Feature Dependency Unblock

Khi FEAT-001 merge → các feature blocked bởi FEAT-001 được unblock. Dispatcher
tự động detect và dispatch feature tiếp theo trong wave.

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

- **Pool capacity mặc định = 3** — 3 worktrees concurrent. Mỗi cook workflow ~2-3 agent/turn.
- **Workflow chạy trong worktree** — dispatcher tạo worktree trước, workflow chạy sau bên trong đó.
- **Dependency resolution** — feature bị block bởi feature chưa merge → chờ, không dispatch.
- **Merge strategy** — luôn PR human review, không auto-merge. Chi tiết: `references/merge-manager.md`

## Full Reference

- `references/flow-single.md` — Single feature cook: readiness verify → worktree → TDD → PR → cleanup
- `references/flow-multi.md` — Multi-feature dispatcher: scan → resolve dep → pool dispatch → monitor → merge
- `references/project-detection.md` — Git project detection: walk-up + 3 case classification
- `references/merge-manager.md` — PR creation, conflict detection, worktree cleanup
- `references/pipeline-status.md` — Shared: TDD cycle orchestration, agent spawn reference, baseline capture, GATE protocol, pipeline status schema, board update
- `references/error-recovery.md` — Centralized error recovery: INTERFERENCE, GATE fail, merge conflict, worktree crash, resume procedure

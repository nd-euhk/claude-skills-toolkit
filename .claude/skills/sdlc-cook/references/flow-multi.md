# Flow: Multi-Feature Cook (Dispatcher)

**Trigger:** `/sdlc-cook FEAT-001,FEAT-003,FEAT-004` hoặc `/sdlc-cook` (auto)
**Precondition:** Ít nhất 1 feature có status "🟢 Ready for Cook".

Đây là dispatcher — "air traffic controller" cho multi-feature cook. Nó scan,
resolve dependency, dispatch worktree pool, monitor, và điều phối merge tuần tự.

## Arg Parsing

Parse raw args string thành mode + feature list + pool capacity:

- Token bắt đầu bằng `FEAT-` hoặc `feat-` → feature ID (normalize uppercase)
- Token `--pool <N>` → pool capacity, clamp [1, 10], warning nếu >5
- 0 feature → `auto` mode (scan board)
- 1 feature → `single` mode
- ≥2 features → `multi` mode
- Mặc định pool = 3

---

## Kiến Trúc Dispatcher

```
┌──────────────────────────────────────────────┐
│              COOK DISPATCHER                   │
│                                                │
│  Scan Board ──▶ Resolve Dep ──▶ Pool Check     │
│       │              │              │           │
│       │         ┌────▼────┐    ┌────▼────┐     │
│       │         │ Blocked │    │ Dispatch│     │
│       │         │ (wait)  │    │ Wave N  │     │
│       │         └─────────┘    └────┬────┘     │
│       │                            │           │
│       └────────────────────────────┘           │
│                     │                          │
│              ┌──────▼──────┐                   │
│              │   Monitor   │                   │
│              │   Pool      │                   │
│              └──────┬──────┘                   │
│                     │                          │
│              ┌──────▼──────┐                   │
│              │   Merge     │                   │
│              │   Manager   │                   │
│              └─────────────┘                   │
└──────────────────────────────────────────────┘
```

---

## Bước 1: Scan + Collect

### 1a: Xác Định Feature Set

**Multi mode (có args):** parse `FEAT-001,FEAT-003,FEAT-004` → feature list.

**Auto mode (không args):** scan `.work/backlog.md` → tất cả feature có status
"🟢 Ready for Cook".

### 1b: Verify Từng Feature

Cho mỗi feature, verify:

```
✅ Có trong board + backlog
✅ Status = "🟢 Ready for Cook"
✅ agent_docs/{layer}/{service}/ tồn tại
✅ Có TST spec: agent_docs/{layer}/{service}/test-specs/FR-{ID}-test.md
✅ Có IMP spec: agent_docs/{layer}/{service}/implementation/FR-{ID}-impl.md
```

Feature không đạt → báo cáo, bỏ khỏi dispatch list.

---

## Bước 2: Dependency Resolution

### 2a: Đọc Dependency Graph

Từ `.work/backlog.md`, đọc `depends_on` field cho mỗi feature:

```markdown
### FEAT-001: Auth
- depends_on: []

### FEAT-002: Payment
- depends_on: [FEAT-001]

### FEAT-003: Order
- depends_on: []

### FEAT-004: Checkout
- depends_on: [FEAT-002, FEAT-003]
```

### 2b: Topological Sort

```
FEAT-001 (no deps)  ──▶ Wave 1
FEAT-003 (no deps)  ──▶ Wave 1
FEAT-002 (dep: 001) ──▶ Wave 2 (sau khi 001 merge)
FEAT-004 (dep: 002, 003) ──▶ Wave 3 (sau khi 002 + 003 merge)
```

### 2c: Dependency Status Check

```python
def can_dispatch(feature, board):
    for dep_id in feature.depends_on:
        dep = board.get(dep_id)
        if dep.status == "✅ Done":
            continue  # Dependency đã merge → OK
        elif dep.status == "🚧 Cooking":
            return False, f"Blocked — {dep_id} đang cook, chưa merge"
        elif dep.status == "👀 In Review":
            return False, f"Blocked — {dep_id} đang review PR"
        else:
            return False, f"Blocked — {dep_id} chưa sẵn sàng ({dep.status})"
    return True, "Ready"
```

---

## Bước 3: Project Detection Cho Từng Feature

Chạy `references/project-detection.md` cho mỗi feature trong wave hiện tại.
Cache kết quả — feature cùng service dùng chung project info.

```python
projects = {}
for feature in wave:
    if feature.service not in projects:
        projects[feature.service] = detect_project(feature)
    feature.project = projects[feature.service]
```

---

## Bước 4: Dirty Check Tổng Hợp

Chạy dirty check cho từng feature (theo project type của nó). Gom tất cả
dirty issues, báo human một lần:

```
⚠️ Dirty files detected:

FEAT-001 (auth-service, submodule):
  services/auth/src/main/java/UserService.java (modified)

FEAT-003 (web-app, gitignored-subproject):
  frontend/src/components/Checkout.tsx (modified)
  frontend/src/api/client.ts (modified)

Options: [Stash all] [Commit per project] [Continue anyway] [Abort]
```

---

## Bước 5: Dispatch Wave

### 5a: Pool Capacity Check

```python
POOL_CAPACITY = args.get('poolCapacity', 3)  # override qua --pool <N>
# Validation: min=1, max=10 (đã validate ở SKILL.md parse phase)
active = count_active_worktrees()  # từ git worktree list
slots = POOL_CAPACITY - active

if slots <= 0:
    log(f"Pool full ({active}/{POOL_CAPACITY}). Chờ worktree giải phóng...")
    return  # Sẽ được gọi lại khi có worktree cleanup
```

### 5b: Create Worktrees + Dispatch

```python
dispatched = []
for feature in wave[:slots]:  # Chỉ dispatch số slot còn trống
    # Create worktree (unified path: .claude/worktrees/cook-{service}-{feat-id}/)
    worktree_path = create_worktree(feature)
    # worktree_path = f"{workspace_root}/.claude/worktrees/cook-{feature.service}-{feature.id}"
    
    # Update board
    Skill(sprint, "--board")
    # FEAT-{NNN} → 🚧 Cooking, worktree = .claude/worktrees/cook-{service}-{feat-id}/
    
    # Dispatch workflow (chạy background)
    Workflow({
        scriptPath: ".claude/workflows/automation/workflow-sdlc-cook.js",
        args: {
            featureName: feature.name,
            frId: feature.fr_id,
            service: feature.service,
            layer: feature.layer,
            repoPath: feature.project.code_path,
            projectType: feature.project.type,
            worktreePath: worktree_path,
            testCases: extract_tcs(feature),
        }
    })
    
    dispatched.append(feature)
    log(f"Dispatched: {feature.id} → .claude/worktrees/cook-{feature.service}-{feature.id}/")

# Wave còn lại (vượt capacity) → queue cho wave sau
remaining = wave[slots:]
if remaining:
    log(f"Queued: {[f.id for f in remaining]} (pool full, sẽ dispatch khi có slot)")
```

---

## Bước 6: Monitor Pool

Định kỳ (mỗi ~60s hoặc khi có notification từ workflow completion):

### 6a: Scan Active Worktrees

```bash
git worktree list | grep "cook-" 
```

### 6b: Đọc Status Từng Worktree

```bash
for worktree in .claude/worktrees/cook-*/; do
    # Parse service+feat từ tên worktree: cook-auth-service-FEAT-001
    name=$(basename "$worktree")  # cook-auth-service-FEAT-001
    feat_id=$(echo "$name" | grep -oP 'FEAT-\d+')  # FEAT-001
    cat "$worktree/.pipeline/"*-status.json 2>/dev/null
done
```

### 6c: Update Board

Mỗi status change → `Skill(sprint, "--board")`.

Schema của status file: → `references/pipeline-status.md`

### 6d: Detect Completion

Khi workflow status = "completed" → trigger merge flow (Bước 7).

Khi workflow status = "failed" → báo human, giữ worktree để debug.

---

## Bước 7: Merge Per Feature

Khi một feature hoàn thành workflow → `references/merge-manager.md`:

1. Pre-merge check (tests pass)
2. Tạo PR từ worktree branch
3. Báo human review
4. Chờ human action (merge / request changes / close)

**Merge xong → giải phóng 1 slot → check wave tiếp theo.**

---

## Bước 8: Wave Continuation

Sau mỗi feature merge + cleanup:

```python
def on_slot_freed():
    # 1. Update dependency status
    merged_id = feature_just_merged.id
    
    # 2. Re-evaluate blocked features
    for blocked in get_blocked_by(merged_id):
        if can_dispatch(blocked):
            blocked.status = "🟢 Ready for Cook"
            Skill(sprint, "--backlog")  # Cập nhật backlog
    
    # 3. Kiểm tra wave tiếp theo
    next_wave = get_next_wave()
    if next_wave:
        dispatch_wave(next_wave)  # Bước 5
```

---

## Báo Cáo Trạng Thái

Khi human hỏi "tiến độ thế nào?":

```
📊 Cook Pool Status (2/3 slots active)

✅ FEAT-001: Auth — GATE full PASS → PR #42 (reviewing)
🚧 FEAT-003: Order — TDD TC 5/8 — ETA ~5min
⏳ FEAT-002: Payment — Blocked by FEAT-001
⏳ FEAT-004: Checkout — Blocked by FEAT-002, FEAT-003

Next: FEAT-002 sẽ được dispatch khi FEAT-001 merge.
```

## Hard Boundaries

- **Không dispatch feature bị block** — chờ dependency merge xong
- **Không vượt pool capacity** — max N worktrees concurrent (mặc định 3, configurable qua --pool)
- **Không auto-merge** — luôn PR human review
- **Không skip dependency check** — topological sort trước mỗi wave
- **Workflow crash → giữ worktree** — không auto-cleanup, để human debug

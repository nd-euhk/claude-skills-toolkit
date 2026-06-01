---
name: sprint
description: >-
  Manage roadmap, backlog, and board documents. Use when breaking down
  themes/epics into features then tasks/stories, syncing status bottom-up
  from board to roadmap, or updating task status on the board.
version: 1.0.1
---

# Sprint — Roadmap, Backlog, Board Management

Manage sprint documents in a 3-tier hierarchy: Roadmap (Theme/Epic) → Backlog (Feature) → Board (Task/Story). Supports top-down breakdown and bottom-up sync.

## Quick Start

### Document Hierarchy

```
agent_docs/roadmap.md          ← Theme/Epic (WHAT & WHEN — timeline, phases, milestones)
        │
        ▼
    .work/backlog.md           ← Feature (WHAT — prioritized feature list with specs)
        │
        ▼
    .work/board.md             ← Task/Story (HOW & WHO — current sprint execution)
```

### When to Use

| Trigger | Workflow |
|---------|----------|
| "breakdown epic X", "create features from theme", "decompose roadmap" | [Breakdown (Top-Down)](#workflow-1-breakdown-top-down) |
| "sync status", "update roadmap from board", "propagate status" | [Sync Status (Bottom-Up)](#workflow-2-sync-status-bottom-up) |
| "move task X to done", "update board", "change task status" | [Update Task Status](#workflow-3-update-task-status) |

### File Paths

| Document | Default Path | Template |
|----------|-------------|----------|
| Roadmap | `agent_docs/roadmap.md` | `references/roadmap-template.md` |
| Backlog | `.work/backlog.md` | `references/backlog-template.md` |
| Board | `.work/board.md` | `references/board-template.md` |

### Arguments (Human Invocation)

Use `/sprint:<action> <args>` to invoke directly:

| Command | Args | Description |
|---------|------|-------------|
| `/sprint:breakdown <epic-ref>` | `phase.task` or `epic name` | Break down an epic into backlog features and board tasks |
| `/sprint:sync` | `--direction up|down|full` (default: full) | Sync status across hierarchy levels |
| `/sprint:move <task-id> <status>` | FR ID + target status | Move a task to a new board column |
| `/sprint:create-board` | `--sprint N` `--goal "..."` | Create a new board from template |
| `/sprint:create-backlog` | (none) | Create a new backlog from template |

**Examples:**
```
/sprint:breakdown 1.1                          # Break down epic 1.1 from roadmap
/sprint:sync --direction up                    # Sync board status → backlog only
/sprint:move FR-AUTH-001 Done                  # Move task to Done column
/sprint:create-board --sprint 1 --goal "MVP user auth"
```

## Workflow 1: Breakdown (Top-Down)

Decompose from Theme/Epic (Roadmap) → Feature (Backlog) → Task/Story (Board).

### Step 1: Read Roadmap — Identify Source Theme/Epic

Read `agent_docs/roadmap.md`. Find the Phase/Theme containing the epic to break down. Each row in a Phase table is an epic-level item:

```markdown
| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| 1.1 | User Authentication | auth-service | `specs/auth.md` | 🔲 Todo |
```

Output: the epic to break down (e.g., Phase 1, Task 1.1 "User Authentication").

### Step 2: Create Feature in Backlog

Read `.work/backlog.md`. Add new feature to the matching priority section (Must/Should/Nice-to-have). Feature format:

```markdown
### FEAT-{NNN}: {Feature Name}

- **Source**: {{ epic/theme from roadmap, phase N, task N.N }}
- **Description**: {{ 1-2 sentences }}
- **Priority**: Must | Should | Nice-to-have
- **Target Sprint**: Sprint {{N}}
- **Services**: {{service, service}}
- **Specs**:
  - FR: `agent_docs/features/FR-{DOM}-{NNN}--{slug}.md`
  - Impl: `agent_docs/backend/{svc}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md`
  - Test: `agent_docs/backend/{svc}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md`
- **Tasks**: (auto-generated when synced to board)
- **Status**: 🔲 Backlog | 🚧 In Progress | ✅ Done
- **CRs**: (link to CR if applicable)
```

If backlog doesn't exist, create from `references/backlog-template.md`.

### Step 3: Create Task/Story on Board

Read `.work/board.md`. Add tasks to the `📋 TODO` column of the current sprint. Task format:

```markdown
| 📋 TODO | FR-{DOM}-{NNN} | {Feature Name}: {Sub-task} | {assignee} | {SP} |
```

Each feature typically generates 2-5 tasks. Breakdown patterns:
- **Backend feature**: API endpoint → Service logic → Repository → Tests → Migration
- **Frontend feature**: Component → State management → API integration → Tests → A11y
- **Full-stack**: Backend tasks first, Frontend tasks after

### Step 4: Update Cross-References

After breakdown, update backlinks:
- In roadmap: add reference to feature ID in backlog
- In backlog: add reference to tasks on board
- On board: add reference to parent feature and epic

## Workflow 2: Sync Status (Bottom-Up)

Synchronize status bottom-up: Board (Task/Story) → Backlog (Feature) → Roadmap (Theme/Epic).

### Sync Rules

| Level | Rule |
|-------|------|
| **Board → Backlog** | Feature status = aggregate of all tasks belonging to that feature |
| **Backlog → Roadmap** | Epic/Theme status = aggregate of all features belonging to that epic/theme |

### Aggregate Logic

```
If ALL children = ✅ Done        → Parent = ✅ Done
If ANY child = 🚧 In Progress   → Parent = 🚧 In Progress
If ANY child = 👀 In Review     → Parent = 🚧 In Progress
If ANY child = ⛔ Blocked        → Parent = ⛔ Blocked + note reason
If ANY child = 🟢 Ready         → Parent = 🚧 In Progress
If ALL children = 🔲 Todo        → Parent = 🔲 Todo
Default (mixed)                  → Parent = 🚧 In Progress
```

### Step 1: Read Board → Aggregate to Backlog

Iterate all tasks on board. Group by feature ID. Apply aggregate logic to compute status for each feature. Update `backlog.md`.

### Step 2: Read Backlog → Aggregate to Roadmap

Iterate all features in backlog. Group by epic/theme (from "Source" field). Apply aggregate logic to compute status for each epic. Update `roadmap.md`.

### Step 3: Report

After sync, print summary report:

```
Sync Status Report:
  Epic "User Authentication": 🚧 In Progress (2/5 features done)
    ├─ FEAT-001 Login: ✅ Done (3/3 tasks)
    ├─ FEAT-002 Registration: 🚧 In Progress (1/3 tasks)
    └─ FEAT-003 Password Reset: 🔲 Todo (0/2 tasks)
```

## Workflow 3: Update Task Status

Update status and move tasks between board columns.

### Status Transitions

```
🔲 Todo ──→ 🟢 Ready ──→ 🚧 In Progress ──→ 👀 In Review ──→ ✅ Done
  │            │              │                   │              │
  └────────────┴──────────────┴───────────────────┴──────────────┘
                              ⛔ Blocked (from any state)
```

Rules:
- 🔲 Todo → 🟢 Ready: Task is fully specified, unblocked, and ready for execution
- 🟢 Ready → 🚧 In Progress: Assignee starts work
- 🟢 Ready → 🔲 Todo: Task needs more clarification, return to todo
- Task can move from any state → ⛔ Blocked (must have reason)
- ⛔ Blocked → returns to previous state before block
- ✅ Done → cannot move to other states (special reopen exception)

### Step 1: Locate Task

Find task on board by FR ID or description. If no exact match, ask user to select from close matches.

### Step 2: Validate Transition

Check if transition is valid against the status flow diagram above.

**Valid transition** → proceed to Step 3.

**Invalid transition** (e.g., Todo → Done skipping Ready/In Progress/Review):
1. **REJECT the transition** — do NOT move the task
2. Log the rejection with reason in `transition_log.md`
3. Only apply if user explicitly confirms override after warning
4. **When no user is available to confirm (automated/agent context): always REJECT** — never override on your own

### Step 3: Update Board

Move the task row from old column to new column in the board table. Add timestamp if board has `Updated` column.

### Step 4: (Optional) Trigger Sync

Ask if user wants to sync status to backlog/roadmap. If yes, run [Workflow 2](#workflow-2-sync-status-bottom-up).

## Key Notes

**Status conventions** — Use emoji prefixes:
`🔲 Todo`, `🟢 Ready`, `🚧 In Progress`, `👀 In Review`, `✅ Done`, `⛔ Blocked`

**Creating new files** — When a file doesn't exist, create from template in `references/`:
- Roadmap: `references/roadmap-template.md`
- Backlog: `references/backlog-template.md`
- Board: `references/board-template.md`

**Granularity rules:**
- 1 Epic (Roadmap) = 2-8 Features (Backlog)
- 1 Feature (Backlog) = 2-5 Tasks (Board)
- If exceeded → consider splitting epic/feature

**Cross-reference format** — Each document uses frontmatter with `depends_on` and `referenced_by` for automated traceability.

**Idempotency** — Breakdown and sync are idempotent. Re-running won't create duplicates if items already exist (matched by ID).

**Transition validation** — Invalid status transitions (skipping states) must always be REJECTED, not applied with warnings. Todo → Done without Ready/In Progress/Review is always invalid. Only apply invalid transitions if user explicitly confirms override.

## References

- `references/roadmap-template.md` — Template for creating new roadmap.md
- `references/backlog-template.md` — Template for creating new backlog.md
- `references/board-template.md` — Template for creating new board.md
- `references/status-transitions.md` — Complete status transition matrix

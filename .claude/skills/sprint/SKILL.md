---
name: sprint
description: >-
  Manage sprint workflow: roadmap, backlog, board. Use when breaking down
  roadmap to backlog, backlog to board, syncing status between layers, or
  adding/editing/deleting work items. Supports Vietnamese and English.
version: 1.0.0
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
---

# Sprint — Roadmap, Backlog, Board Management

**Purpose:** Manage the three-layer work-tracking hierarchy: roadmap (strategic), backlog (queue), board (tactical). Supports breakdown flows, reverse status sync, and human-driven CRUD operations.

## Quick Start

At the start of every invocation, determine what the user wants:

1. **Breakdown** — "break down roadmap", "move to backlog", "create board tasks"
2. **Sync** — "sync status", "update progress", "check consistency"
3. **CRUD** — "add feature", "edit task", "delete", "update status"

Then identify the target layer(s) and execute the corresponding workflow below.

## Core Three-Layer Model

```
agent_docs/roadmap.md          ← Strategic: themes/epics, phases, milestones
        │
        ▼  breakdown
  .work/backlog.md             ← Queue: prioritized features waiting for sprint
        │
        ▼  breakdown
  .work/board.md               ← Tactical: current sprint tasks with status
```

**Reverse sync flows up:**
```
  .work/board.md ──sync──→ .work/backlog.md ──sync──→ agent_docs/roadmap.md
  (all tasks done)         (all features done)        (theme/epic status)
```

## Workflow 1: Breakdown Roadmap → Backlog

When the user wants to populate the backlog from roadmap features.

### Step 1: Read Roadmap

Read `agent_docs/roadmap.md`. Extract:
- Feature → Phase Mapping table (Feature ID → Phase → Sprint)
- Totals table (priority: Must/Should/Nice)
- Per-phase task statuses

### Step 2: Determine Scope

Ask what to break down:
- "Which phase(s) should I pull features from?"
- "Filter by priority?" (Must only / Must+Should / All)

### Step 3: Generate Backlog

For each feature pulled from roadmap, create a backlog entry in `.work/backlog.md`:

```markdown
## Backlog — {{date}}

| # | Feature ID | Feature | Priority | Phase | Status | Dependencies | Notes |
|---|-----------|---------|----------|-------|--------|-------------|-------|
| BL-001 | FR-XXX-001 | {{name}} | Must | Phase 1 | 🔲 Todo | — | {{notes}} |
| BL-002 | FR-XXX-002 | {{name}} | Should | Phase 2 | 🔲 Todo | BL-001 | {{notes}} |
```

If `.work/backlog.md` already exists, append new entries with next available BL-XXX IDs. Never overwrite existing entries — merge instead.

Status conventions (match roadmap):
- 🔲 Todo — not yet started
- 🚧 In Progress — actively being worked
- ✅ Done — completed and verified
- ⛔ Blocked — blocked (note the reason)

### Step 4: Update Roadmap Traceability

Update `agent_docs/roadmap.md` frontmatter to add `.work/backlog.md` to `referenced_by` if not already present.

## Workflow 2: Breakdown Backlog → Board

When the user wants to move backlog items into the current sprint board.

### Step 1: Read Backlog

Read `.work/backlog.md`. Identify features with status 🔲 Todo or 🚧 In Progress.

### Step 2: Select Features for Sprint

Ask the user which backlog items to move to the current sprint. Present the list with priorities.

### Step 3: Generate Board Tasks

For each selected backlog feature, create task entries in `.work/board.md`:

```markdown
## Board — Sprint {{N}} ({{date_range}})

### 🔲 Todo
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|
| T-001 | {{task_description}} | BL-001 | {{service}} | `{{spec_path}}` | — |

### 🚧 In Progress
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|

### ✅ Done
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|
```

**Task breakdown guidelines:**
- Each feature should spawn 1-5 tasks depending on complexity
- Tasks should be concrete and completable in 1 session
- Reference the impl spec path when available (from roadmap)
- Prefix task IDs with T-XXX, link to backlog BL-XXX

If `.work/board.md` already exists for the current sprint, merge into existing board. For a new sprint, create fresh.

### Step 4: Update Backlog Status

Mark the moved backlog items as 🚧 In Progress. Add a note referencing the sprint: "→ Sprint N".

## Workflow 3: Reverse Sync — Board → Backlog

When all tasks for a feature are done on the board, update the backlog.

### Step 1: Scan Board

Read `.work/board.md`. For each feature (BL-XXX), check if **all** its tasks are in ✅ Done.

### Step 2: Update Backlog

For each feature where all board tasks are ✅ Done:
- Set backlog status to ✅ Done
- Add note: "Completed Sprint N — {{date}}"

### Step 3: Report

Output a sync summary:
```
Board → Backlog Sync:
  BL-001 (FR-XXX-001): 3/3 tasks done → Backlog marked ✅ Done
  BL-002 (FR-XXX-002): 2/4 tasks done → Still 🚧 In Progress
```

## Workflow 4: Reverse Sync — Backlog → Roadmap

When all features in a roadmap phase/theme are done, update the roadmap.

### Step 1: Scan Backlog

Read `.work/backlog.md`. Group features by Phase.

### Step 2: Check Phase Completion

For each phase in `agent_docs/roadmap.md`, check if all its features in the backlog are ✅ Done.

### Step 3: Update Roadmap

For each fully-completed phase:
- Update all task statuses in that phase to ✅ Done
- Update the Phase Overview table's Verify column if applicable
- Add completion date

### Step 4: Report

Output sync summary:
```
Backlog → Roadmap Sync:
  Phase 1: 5/5 features done → Phase marked ✅ Done
  Phase 2: 3/4 features done → Still 🚧 In Progress (BL-006 pending)
```

## Workflow 5: CRUD Operations

### 5A: Add Item

**Roadmap — Add a feature/phase:**
Ask: layer (roadmap), type (feature/phase/task), then collect fields per the data model. Insert into the correct section of `agent_docs/roadmap.md` with next available ID.

**Backlog — Add a feature:**
Ask for Feature ID, name, priority, phase. Assign next BL-XXX ID. Append to `.work/backlog.md`.

**Board — Add a task:**
Ask for description, parent feature (BL-XXX), service. Assign next T-XXX ID. Add to Todo column in `.work/board.md`.

### 5B: Edit Item

Ask which layer, which item ID, which field to change, and the new value. Read the file, locate the item, apply the edit. Preserve all other fields.

### 5C: Delete Item

Ask which layer and item ID. Confirm before deleting — deletions are irreversible. Remove the row from the table. If deleting a backlog item that has board tasks, warn the user. If deleting a roadmap feature referenced by backlog, warn the user.

### 5D: Update Status

Direct status update on any item at any layer. The reverse sync workflows handle cascading — individual status updates are explicit one-off changes.

## Workflow 6: Full Sync (All Layers)

Run when the user says "sync all" or "full sync".

Execute in order:
1. Board → Backlog sync (Workflow 3)
2. Backlog → Roadmap sync (Workflow 4)
3. Validate consistency (Workflow 7)

## Workflow 7: Validate Consistency

Run `scripts/validate-sync.sh` from the sprint skill directory. This script checks:
- Every board task references a valid backlog BL-XXX
- Every backlog item references a valid roadmap Feature ID
- No orphaned references
- Status consistency: backlog In Progress items have at least one board task
- Status consistency: backlog Done items have all board tasks Done

Report any broken links or status mismatches.

## Key Notes

**Data model details:** See `references/data-models.md` for the complete field specifications for roadmap phases, backlog entries, and board tasks.

**Breakdown patterns:** See `references/breakdown-workflow.md` for detailed rules on task granularity, dependency handling, and parallelization decisions.

**Sync rules:** See `references/sync-workflow.md` for edge cases: partial completion, reopened items, blocked items, and handling items that span multiple sprints.

**File locations (SSOT from orchestrate):**
- `agent_docs/roadmap.md` — Roadmap (single source of truth for timeline)
- `.work/backlog.md` — Backlog (prioritized queue)
- `.work/board.md` — Board (current sprint)

**Frontmatter traceability:** The roadmap frontmatter has `depends_on` and `referenced_by` fields. When modifying any file, keep these cross-references accurate.

**Status conventions (all layers):**
- 🔲 Todo — not started
- 🚧 In Progress — actively being worked
- ✅ Done — completed and verified
- ⛔ Blocked — blocked with reason

**ID conventions:**
- Roadmap: Phase numbers (1, 2, N), task numbers (1.1, 1.2), Feature IDs (FR-XXX-NNN)
- Backlog: BL-XXX (sequential, 3-digit zero-padded)
- Board: T-XXX (sequential, 3-digit zero-padded, resets per sprint)

**Progressive disclosure rule:** Ask ONE question at a time. Never combine breakdown scope, CRUD target, and sync direction into one AskUserQuestion call.

**Before any destructive operation (delete), always confirm with the user.**

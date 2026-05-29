---
name: sprint
description: >-
  Manage sprint workflow: roadmap, backlog, board. Use when breaking down
  roadmap to backlog, backlog to board, syncing status between layers, or
  adding/editing/deleting work items. Includes validation and consistency checks.
version: 1.1.0
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
---

# Sprint — Roadmap, Backlog, Board Management

**Purpose:** Manage the three-layer work-tracking hierarchy: roadmap (strategic), backlog (queue), board (tactical). Supports breakdown flows, reverse status sync, and human-driven CRUD operations.

## Quick Start

Determine the action type from user input, then route to the corresponding workflow:

| User says... | Action | Workflow | Orchestrate Use |
|---|---|---|---|
| "break down", "populate", "move to backlog/board" | Breakdown | WF1, WF2 | Phase 10 handoff |
| "sync", "update progress", "full sync" | Sync | WF3, WF4, WF6 | Cook completion, sprint end |
| "add", "edit", "delete", "update status" | CRUD | WF5 | Board task creation/update |
| "validate", "check consistency" | Validate | WF7 | Pre/post-sync gate |
| "get ready tasks", "list todo", "find by feature" | Query | WF8 | Cook task selection, feature lookup |

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

Status conventions: use the status set from `references/data-models.md#status-values`.

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

### ✅ Ready
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|

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

For detailed decomposition rules (service boundaries, parallelization, spec-per-task), see `references/breakdown-workflow.md#task-decomposition-rules`.

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

Use progressive disclosure — ask ONE question at a time via AskUserQuestion. Never combine layer selection, item selection, and field collection into a single call.

### 5A: Add Item

**Step 1: Identify target layer** (AskUserQuestion, single-select):
- Roadmap: "Which roadmap section?" → Options: "Phase N task", "New phase", "Feature in Feature→Phase table"
- Backlog: "Which phase?" → Options: phase numbers from roadmap
- Board: "Which backlog item (BL-XXX)?" → Options: BL-IDs from backlog with feature name summaries

**Step 2: Collect fields** (AskUserQuestion for structured fields, free-form for description):

| Layer | Fields to collect |
|---|---|
| Roadmap task | description, service/component, spec path, assignee |
| Backlog item | Feature ID, name, priority, phase, dependencies |
| Board task | description, BL-XXX parent, service, spec path |

**Step 3:** Insert entry with next available ID, preserving table formatting and column alignment.

### 5B: Edit Item

Progressive AskUserQuestion sequence:
1. "Which layer?" — Roadmap / Backlog / Board
2. "Which item?" — present IDs with current values for context
3. "Which field to change?" — present only the item's actual fields from the table
4. Collect the new value
5. Apply the edit, preserving all other fields

### 5C: Delete Item

Progressive AskUserQuestion sequence:
1. "Which layer?" — Roadmap / Backlog / Board
2. "Which item?" — present ID with summary
3. **CONFIRM** — "Delete {{ID}}: '{{summary}}'? This is irreversible." Options: "Yes, delete", "No, cancel"
4. Before deleting, check for children:
   - Backlog item with board tasks → warn and ask to also delete children
   - Roadmap feature referenced by backlog → warn and block until children resolved

### 5D: Update Status

Progressive AskUserQuestion sequence:
1. "Which layer?" — Roadmap / Backlog / Board
2. "Which item?" — present IDs with current status
3. "New status?" — options limited to valid transitions per `references/data-models.md`
4. Apply the change. Add note: "Manual override — {{date}}" if bypassing sync rules

## Workflow 6: Full Sync (All Layers)

Run when the user says "sync all" or "full sync".

Execute in order:
1. Board → Backlog sync (Workflow 3)
2. Backlog → Roadmap sync (Workflow 4)
3. Validate consistency (Workflow 7)

## Workflow 7: Validate Consistency

### Pre-Sync Validation

Before any sync operation (WF3, WF4, WF6), run a quick check:
1. All three files exist (warn if any are missing, skip affected checks)
2. No circular dependencies in backlog (block sync if found — report and exit)

### Post-Sync Validation

After sync, run the full validation suite:

Run `scripts/validate-sync.sh` from the sprint skill directory. This script checks:
- Every board task references a valid backlog BL-XXX
- Every backlog item references a valid roadmap Feature ID
- No orphaned references
- Status consistency: backlog In Progress items have at least one board task
- Status consistency: backlog Done items have all board tasks Done

Report summary:
- N errors (must fix before next sync)
- N warnings (informational, can proceed)

## Workflow 8: Query Tasks by Status

When orchestrate or user needs to find tasks with a specific status.

### Get Ready Tasks (for Cook)

Read `.work/board.md`, extract all tasks in the ✅ Ready column. Return the list with task IDs, descriptions, linked features, and services.

### Get Todo Tasks (for New Feature)

Read `.work/board.md`, extract all tasks in the 🔲 Todo column. Return the list.

### Get Tasks by Feature

Read `.work/board.md`, filter by feature (BL-XXX) and return all tasks with their current status.

### Output Format (Machine-Readable)

Each query returns tasks in a consistent pipe-delimited format for reliable parsing:

```
T-XXX | {{status_emoji}} {{status_label}} | {{description}} | {{BL-XXX}} | {{service}} [| {{spec_path}}]
```

| Query | Filter | Fields Returned |
|---|---|---|
| Ready Tasks | Board tasks in ✅ Ready | ID, status, description, BL-XXX, service, spec |
| Todo Tasks | Board tasks in 🔲 Todo | ID, status, description, BL-XXX, service |
| By Feature | Board tasks matching BL-XXX | ID, status, description, service, spec |

Example:
```
Board tasks:
  T-001 | ✅ Ready  | Implement user login | BL-003 | auth-service
  T-002 | 🔲 Todo   | Create dashboard UI  | BL-004 | web-app
  T-003 | ✅ Ready  | Add rate limiting     | BL-005 | gateway
```

## Key Notes

### Critical Invariants

**File locations (SSOT from orchestrate):**
- `agent_docs/roadmap.md` — Roadmap (single source of truth for timeline)
- `.work/backlog.md` — Backlog (prioritized queue)
- `.work/board.md` — Board (current sprint)

**Frontmatter traceability:** The roadmap frontmatter has `depends_on` and `referenced_by` fields. When modifying any file, keep these cross-references accurate.

**Before any destructive operation (delete), always confirm with the user.**

### Reference Pointers

**Data model details:** See `references/data-models.md` for complete field specifications, status values, and valid transitions per layer.

**Breakdown patterns:** See `references/breakdown-workflow.md` for detailed rules on task granularity, dependency handling, and parallelization decisions.

**Sync rules:** See `references/sync-workflow.md` for edge cases: partial completion, reopened items, blocked items, and handling items that span multiple sprints.

**Data model flexibility:** The reference data model describes the canonical format. Project-specific variants are common:
- ID conventions may use domain prefixes (e.g., BL-AUTH-001 vs BL-001)
- Board columns may include additional lanes (e.g., Review)
- Board tasks may carry extra metadata (story points, assignee)
- Status emojis may vary (🚧 vs 🟡 for In Progress)

**Invariants (must be present for sync and validation to work):**
- Every board task references a backlog ID
- Every backlog entry references a roadmap Feature ID
- Every layer has a Status field with a value from the status set

### Operational Rules

**Progressive disclosure rule:** Ask ONE question at a time. Never combine breakdown scope, CRUD target, and sync direction into one AskUserQuestion call.

**Status conventions** (see `references/data-models.md` for transitions):
- 🔲 Todo — not started, specs not yet complete
- ✅ Ready — all specs done, ready for implementation
- 🚧 In Progress — actively being implemented
- ✅ Done — completed and verified
- ⛔ Blocked — blocked with reason

**ID conventions** (see `references/breakdown-workflow.md` for assignment rules):
- Roadmap: Phase numbers (1, 2, N), task numbers (1.1, 1.2), Feature IDs (FR-XXX-NNN)
- Backlog: BL-XXX (sequential, 3-digit zero-padded)
- Board: T-XXX (sequential, 3-digit zero-padded, resets per sprint)

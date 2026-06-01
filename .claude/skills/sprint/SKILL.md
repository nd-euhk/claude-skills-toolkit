---
name: sprint
description: >-
  Manage roadmap, backlog, and board documents. Use when breaking down
  themes/epics into features then tasks/stories, adding tasks to the board,
  adding features to the backlog, adding epics/themes to the roadmap,
  syncing status bottom-up from board to roadmap, or updating task status.
---

# Sprint — Roadmap, Backlog, Board Management

Route sprint operations to the sprint-master agent — This skill detects the operation and spawns `Agent(sprint-master)` with the right context — keeping heavy processing out of the main agent's context.

## Quick Start

### Step 1: Detect Operation

Parse the user's request for the operation type:

| User says | Operation |
|-----------|-----------|
| "breakdown", "decompose" | **breakdown** → ask scope |
| "sync", "propagate", "update roadmap from board" | **sync** |
| "move", "update status", "change task" | **move** |
| "add task", "new task", "create task", "add story" | **add-task** |
| "add feature", "new feature", "create feature" | **add-feature** |
| "add epic", "new epic", "add theme", "new theme", "add phase" | **add-epic** |
| "plan sprint", "setup sprint" | **plan-sprint** |
| "update progress", "refresh board" | **update-progress** |
| "create board", "new sprint board", "init board" | **create-board** |
| "create backlog", "new backlog", "init backlog" | **create-backlog** |
| "create roadmap", "new roadmap", "init roadmap" | **create-roadmap** |

If user intent is clear from input (e.g., "move FR-AUTH-001 to Done"), skip to Step 4 and spawn directly.

### Step 2: Disambiguate Operation (Q1)

If operation is unclear, ask with max 4 options:

```
questions: [
  {
    question: "What sprint operation do you need?",
    header: "Operation",
    options: [
      { label: "Break down", description: "Decompose epics or features into smaller units" },
      { label: "Sync status", description: "Propagate task status bottom-up: Board → Backlog → Roadmap" },
      { label: "Move task", description: "Update a task's status on the board" },
      { label: "Create", description: "Add a task/story, feature, epic, theme, or bootstrap a new artifact" }
    ],
    multiSelect: false
  }
]
```

### Step 3: Resolve Details (Q2)

Based on Q1 answer, ask one follow-up:

**If "Break down"** — ask scope:

```
questions: [
  {
    question: "What depth of breakdown?",
    header: "Scope",
    options: [
      { label: "Full flow", description: "Epic → Features → Tasks (end to end)" },
      { label: "Epic → Features", description: "Decompose epic into backlog features only" },
      { label: "Feature → Tasks", description: "Decompose an existing feature into board tasks only" }
    ],
    multiSelect: false
  }
]
```

Map: "Full flow" → `breakdown`, "Epic → Features" → `breakdown-epic`, "Feature → Tasks" → `breakdown-feature`.

**If "Create"** — ask what to create:

```
questions: [
  {
    question: "What do you want to create?",
    header: "Artifact",
    options: [
      { label: "Task / Story", description: "Add a new task or story to the current sprint board" },
      { label: "Feature", description: "Add a new feature to the backlog (with MoSCoW priority)" },
      { label: "Epic / Theme", description: "Add a new epic, theme, or phase to the roadmap" }
    ],
    multiSelect: false
  }
]
```

Map: "Task / Story" → `add-task`, "Feature" → `add-feature`, "Epic / Theme" → `add-epic`.

**If "Move task"** — no Q2 needed. Ask for task ID and target status inline, then spawn.

### Step 4: Spawn Sprint Agent

Spawn `Agent(sprint-master)` with a self-contained prompt including: operation, target, and user request.

**Prompt template:**

> Sprint operation: {operation}
> Target: {epic-ref | task-id | sprint-number}
> User request: {original user message}

**Examples:**

```
// Full flow breakdown
Agent(sprint-master, prompt: "
  Sprint operation: breakdown
  Target: 1.1 (User Authentication from roadmap Phase 1)
  User request: breakdown epic 1.1 into features and tasks
")

// Epic → Features only
Agent(sprint-master, prompt: "
  Sprint operation: breakdown-epic
  Target: 1.1 (User Authentication from roadmap Phase 1)
  User request: breakdown epic 1.1 into features
")

// Feature → Tasks only
Agent(sprint-master, prompt: "
  Sprint operation: breakdown-feature
  Target: FR-AUTH-001 (Login feature)
  User request: breakdown FR-AUTH-001 into board tasks
")

// Sync
Agent(sprint-master, prompt: "
  Sprint operation: sync
  User request: sync status from board to backlog
")

// Move task
Agent(sprint-master, prompt: "
  Sprint operation: move
  Target: FR-AUTH-001
  Target status: Done
  User request: move FR-AUTH-001 to Done
")

// Add task to board
Agent(sprint-master, prompt: "
  Sprint operation: add-task
  Target: FR-AUTH-001 (parent feature)
  Task: Implement OAuth2 token validation endpoint
  Assignee: ai-agent
  Story Points: 3
  User request: add task for OAuth2 token validation to FR-AUTH-001
")

// Add feature to backlog
Agent(sprint-master, prompt: "
  Sprint operation: add-feature
  Feature: Two-Factor Authentication
  Priority: Should
  Source: Phase 1, Task 1.3 (from roadmap.md)
  Services: auth-service
  User request: add 2FA feature to backlog
")

// Add epic/theme to roadmap
Agent(sprint-master, prompt: "
  Sprint operation: add-epic
  Epic: Payment Integration
  Phase: 3
  Sprint: Sprint 5
  Goal: Integrate Stripe for subscription payments
  Services: billing-service, webhook-gateway
  User request: add Payment Integration epic to roadmap as Phase 3
")

// Create board
Agent(sprint-master, prompt: "
  Sprint operation: create-board
  Flags: --sprint 1 --goal "MVP user authentication"
  User request: create sprint 1 board for MVP auth
")

// Create backlog
Agent(sprint-master, prompt: "
  Sprint operation: create-backlog
  User request: initialize backlog from template
")

// Create roadmap
Agent(sprint-master, prompt: "
  Sprint operation: create-roadmap
  User request: initialize roadmap from template
")
```

## Key Notes

**Agent handles everything.** The sprint agent at `.claude/agents/sprint-master.md` owns all knowledge about artifact formats, status transitions, sync logic, and gate criteria. Do NOT duplicate that knowledge here.

**Standalone usage.** When the sprint agent is spawned directly (not via this skill), it reads current state from files and determines the operation autonomously.

**No file modification here.** This skill never reads or writes sprint artifacts directly. All work is delegated to the sprint agent.

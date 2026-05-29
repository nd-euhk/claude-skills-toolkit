# Breakdown Workflow — Sprint Skill

Detailed rules for breaking down work between layers.

## Roadmap → Backlog Breakdown

### When to Use

- After `agt-configurator` generates the initial roadmap
- When new features are added to the roadmap and need backlog entries
- When reprioritizing and pulling features from future phases

### Feature Selection Rules

1. **Priority-first:** Must-have features always break down first
2. **Dependency-aware:** Features blocked by incomplete work stay in Todo
3. **Phase ordering:** Within same priority, lower phase number first
4. **Parallelization:** Features with no inter-dependencies can be pulled together

### Backlog ID Assignment

```
BL-001, BL-002, ... BL-999
```

IDs are monotonically increasing, never reused. When a feature is removed from backlog, its BL-XXX is retired, not reassigned.

### Merging with Existing Backlog

When `.work/backlog.md` already exists:
1. Read existing entries
2. Find the highest BL-XXX ID
3. Append new entries starting from BL-{highest+1}
4. Do NOT reorder existing entries — only append
5. If a feature already has a backlog entry, update it instead of duplicating

### Edge Cases

**Feature already in backlog:** Update the existing entry with any new information from the roadmap. Do not duplicate.

**Feature removed from roadmap:** Mark the backlog entry with ⛔ Blocked and note "Removed from roadmap". Do not auto-delete — let the human decide.

**Feature spans multiple services:** Create ONE backlog entry. Multiple services are handled at the board (task) level.

## Backlog → Board Breakdown

### When to Use

- At sprint planning (start of each sprint)
- When adding new backlog items mid-sprint

### Task Decomposition Rules

For each backlog feature, create tasks following these rules:

1. **One task per service change:** If feature touches 2 services → at least 2 tasks
2. **One task per spec file:** If feature has both impl spec and test spec → separate tasks
3. **BE before FE (if dependent):** Backend tasks before frontend tasks when FE depends on BE APIs
4. **Parallel marker:** Mark tasks that can be worked on simultaneously

**Task breakdown guidelines:**
- Each feature should spawn 1-5 tasks depending on complexity
- Tasks should be concrete and completable in 1 session
- Reference the impl spec path when available (from roadmap)
- Prefix task IDs with T-XXX, link to backlog BL-XXX

### Task Description Convention

```
{{action}} {{target}} for {{feature_name}}
```

Examples:
- "Implement POST /api/users endpoint for User Registration"
- "Write unit tests for User Registration controller"
- "Create RegisterForm component for User Registration"

### Sprint Board Management

**New sprint:** Create fresh `.work/board.md` with current sprint number and date range. Archive previous sprint board to `.work/archive/board-sprint-{N}.md`.

**Continuing sprint:** Merge new tasks into existing board's Todo column. Do not touch In Progress or Done columns.

**Sprint cleanup:** At sprint end, move incomplete tasks to next sprint's board or back to backlog (ask user).

### Task ID Convention

```
T-001 through T-999 per sprint
```

Reset numbering each sprint. Format: T-XXX (3-digit zero-padded).

### Parallelization Decisions

When a feature has multiple tasks, ask the user whether they should be:
- **Sequential** — Task T-00X blocks T-00Y (add dependency note)
- **Parallel** — Both can be worked simultaneously

Default: parallel unless one task's output (API, schema, etc.) is needed by another.

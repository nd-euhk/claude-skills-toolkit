# Data Models — Sprint Skill

Complete field specifications for all three layers.

## Roadmap (`agent_docs/roadmap.md`)

Based on orchestrate's roadmap template. The roadmap is the **Single Source of Truth (SSOT)** for the project timeline.

### Frontmatter

```yaml
title: "Roadmap — {{project_name}}"
status: draft | current | archived
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - features/README.md
  - architecture.md
referenced_by:
  - ../.work/board.md
  - ../.work/backlog.md
changelog:
  - "version | date | description"
```

### Phase Structure

Each phase is a markdown section:

```markdown
## Phase N: {{Name}} (Sprint N — {{Period}})

> **Goal**: {{1-2 sentence outcome}}
> **Verify**: {{quick verification command or scenario}}

| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| N.1 | {{description}} | {{service}} | `{{path}}` | {{who}} | 🔲 Todo |
```

### Feature → Phase Mapping Table

```markdown
| Feature ID | Phase | Sprint |
|-----------|-------|--------|
| FR-XXX-001 | Phase 1 | Sprint 1 |
```

### Status Values

- 🔲 Todo — not started
- 🚧 In Progress (WIP) — actively being worked
- ✅ Done — completed and verified
- ⛔ Blocked — blocked (note reason)

### Key Sections

| Section | Purpose | Managed By |
|---------|---------|------------|
| Timeline | ASCII diagram of sprints + gate milestones | Architect/PM |
| Milestones | Gate criteria + target dates | Architect/PM |
| Phase Overview | Bird's eye: Phase→Sprint→Services→Features→Verify | Architect |
| Per-Phase Tasks | Concrete tasks per phase | Sprint skill / agt-configurator |
| Totals | Summary: Phase, Tasks, Target, Priority | Auto-calculated |
| Feature→Phase Mapping | Trace from FR to when it ships | Sprint skill |
| Dependencies | ASCII/Mermaid dependency graph + critical path | Architect |
| Rollback Plan | Risk scenarios + actions | Architect |
| Project Operations | Non-feature tasks (CI/CD, bootstrap) | Sprint skill |

## Backlog (`.work/backlog.md`)

Prioritized queue of features not yet in the current sprint.

### Structure

```markdown
## Backlog — {{date}}

| # | Feature ID | Feature | Priority | Phase | Status | Dependencies | Notes |
|---|-----------|---------|----------|-------|--------|-------------|-------|
| BL-001 | FR-XXX-001 | {{name}} | Must | Phase 1 | 🔲 Todo | — | {{notes}} |
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| # | BL-XXX | Yes | Backlog ID, sequential |
| Feature ID | FR-XXX-NNN | Yes | Links to roadmap feature |
| Feature | string | Yes | Short feature name |
| Priority | Must/Should/Nice | Yes | From roadmap |
| Phase | Phase N | Yes | Which roadmap phase |
| Status | Todo/InProgress/Done/Blocked | Yes | Current state |
| Dependencies | BL-XXX list | No | Other backlog items this depends on |
| Notes | string | No | Free-text context |

### Status Transitions

```
🔲 Todo → 🚧 In Progress (when sprint starts)
🚧 In Progress → ✅ Done (all board tasks complete)
🚧 In Progress → ⛔ Blocked (dependency not met)
⛔ Blocked → 🚧 In Progress (dependency resolved)
```

## Board (`.work/board.md`)

Current sprint task board with status columns.

### Structure

```markdown
## Board — Sprint {{N}} ({{start_date}} — {{end_date}})

### 🔲 Todo
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|

### 🚧 In Progress
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|

### ✅ Done
| # | Task | Feature | Service | Spec | Assignee |
|---|------|---------|---------|------|----------|
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| # | T-XXX | Yes | Task ID, sequential per sprint |
| Task | string | Yes | Concrete task description |
| Feature | BL-XXX | Yes | Links to backlog item |
| Service | string | Yes | Service/component name |
| Spec | path or — | No | Link to impl/test spec |
| Assignee | string or — | No | Who is working on it |

### Task Granularity Rules

- 1 feature (BL-XXX) → 1-5 tasks (T-XXX)
- Each task completable in 1 session
- Task descriptions are concrete and verifiable
- Prefer small, independent tasks over large monolithic ones

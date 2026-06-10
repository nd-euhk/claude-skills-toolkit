# Change Request Workflow (cr)

Pick a Done/In Review task, assess impact, run conditional SDLC via workflow-sdlc-cr-pipeline, then implement and test.

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **Done** or **In Review**
2. If no matching tasks, report and stop
3. Capture task details for context

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`

During planning, `Agent(Plan)` MUST specifically assess:
- **HLD impact**: Does this change affect system architecture, component boundaries, or data flow?
- **LLD impact**: Does this change affect domain models, API contracts, or service internals?

Record these assessments. They determine which conditional phases execute in Phase 3.

## Phase 3: Execute CR Pipeline (Workflow)

### Step 3.1: Prepare Workflow Args

```js
const workflowArgs = {
  taskId: "{task-id}",
  taskTitle: "{task-title}",
  taskDescription: "{task-description}",
  planFile: ".work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md",
  language: "{vi|en}",
  runDate: "{YYYY-MM-DD}",
  slug: "{cr-slug}",
  hldAffected: true,   // from plan's impact assessment
  lldAffected: true,   // from plan's impact assessment
}
```

### Step 3.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-cr-pipeline.js", args: workflowArgs })
```

The workflow handles:
- HLD → gate-verifier → retry (max 3) — ONLY if `hldAffected` is true
- LLD → gate-verifier → retry (max 3) — ONLY if `lldAffected` is true
- IMP + TST in parallel → gate-verifier each → retry (ALWAYS)
- Automatic concurrency management

### Step 3.3: Result Structure

**Success:**
```js
{
  mode: 'cr',
  completed: ['HLD', 'LLD', 'IMP', 'TST'],
  conditional: { hld: true, lld: true },
  results: {
    hld: { passed: true },
    lld: { passed: true },
    impTst: { impPassed: true, tstPassed: true },
  }
}
```

**Note**: `completed` only lists phases that actually ran. If `hldAffected` was false, HLD is absent from both `completed` and `results`.

**Error:**
```js
{
  phase: 'LLD',
  error: 'Gate failed after 3 retries',
  feedback: 'API contract inconsistency with existing HLD...'
}
```

### Step 3.4: Process Results

Follow error handling patterns in `references/error-handling.md`. Quick reference:

If workflow returns errors:
- **HLD failure** → Pattern 1 (Blocking if foundational): report, AskUserQuestion retry/skip/abort
- **LLD failure** → Pattern 1 (Optional): report, offer retry/skip/abort
- **IMP/TST failure** → Pattern 1 (Partial): report which one, offer retry/skip/abort

On success, proceed to Phase 4.

## Phase 4: Sprint Integration

Invoke `Skill(sprint)` to add CR task to Board with status **Ready** (or Blocked if dependencies exist).

## Phase 5: Report

Spawn `Agent(general-purpose)` to write `.work/change-requests/cr-NNN-YYYYMMDD-{FR-name}--{slug}.md`.

### Frontmatter (REQUIRED)

```yaml
---
title: "CR-{NNN}: {Short Description}"
type: NEW | CHANGE
status: planned | in-progress | implemented | verified | ready | blocked | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
requested_by: {name/role}
approved_by: {name/role}
target_sprint: Sprint {N}
source_task: "{task-id}: {task-title}"
hld_affected: true | false
lld_affected: true | false
phases_executed:
  - hld          # only if hld_affected is true
  - lld          # only if lld_affected is true
  - imp
  - tst
depends_on: []
referenced_by: []
changelog:
  - planned | YYYY-MM-DD | Created from {task-id}
  - in-progress | YYYY-MM-DD | Impact assessment completed
  - implemented | YYYY-MM-DD | IMP+TST produced
  - verified | YYYY-MM-DD | All gates passed
  - ready | YYYY-MM-DD | Sprint sync complete
---
```

### Report Body

- **Task context**: Task ID, title, and original description
- **Impact assessment**: HLD affected (yes/no + rationale), LLD affected (yes/no + rationale)
- **HLD changes** (if applicable): Architecture decisions modified, ADRs created/superseded
- **LLD changes** (if applicable): Design sections changed, domain model updates, API contract modifications
- **IMP summary**: Implementation scope, files created/modified
- **TST summary**: Test coverage, test types, test count per type
- **Gate verification results** per phase
- **Artifacts modified**: Table of all files changed with status
- **Final status**: Ready or Blocked (with reason)

## Phase 6: Next Steps

Use `AskUserQuestion`: "CR workflow complete. What next?" (header: "Next")
Options: "Cook this CR now" | "Start a new feature/task" | "Create another change request" | "Done for now"

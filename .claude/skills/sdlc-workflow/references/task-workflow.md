# Task Workflow (feature | task | story)

Pick a TODO task from the board, run full SDLC via workflow-sdlc-task-pipeline: SRS → HLD → LLD → IMP+TST → gate, then mark Ready.

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **TODO**
2. If no TODO tasks exist, report to human and stop
3. Capture the task details (ID, title, description) for context in subsequent phases

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md`

## Phase 3: Execute SDLC Pipeline (Workflow)

### Step 3.1: Prepare Workflow Args

```js
const workflowArgs = {
  taskId: "{task-id}",
  taskTitle: "{task-title}",
  taskDescription: "{task-description}",
  planFile: ".work/plans/task-YYYYMMDD-{FR-name}--{slug}.md",
  language: "{vi|en}",
  runDate: "{YYYY-MM-DD}",
  slug: "{task-slug}",
}
```

### Step 3.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-task-pipeline.js", args: workflowArgs })
```

The workflow handles:
- SRS → gate-verifier → retry (max 3)
- HLD → gate-verifier → retry (max 3)
- LLD → gate-verifier → retry (max 3)
- IMP + TST in parallel → gate-verifier each → retry
- Automatic concurrency management

### Step 3.3: Result Structure

**Success:**
```js
{
  mode: 'task',
  completed: ['SRS', 'HLD', 'LLD', 'IMP', 'TST'],
  results: {
    srs: { passed: true },
    hld: { passed: true },
    lld: { passed: true },
    impTst: { impPassed: true, tstPassed: true },
  }
}
```

**Error:**
```js
{
  phase: 'HLD',
  error: 'Gate failed after 3 retries',
  feedback: 'Missing C4 container diagram...'
}
```

### Step 3.4: Process Results

Follow error handling patterns in `references/error-handling.md`. Quick reference:

If workflow returns errors:
- **SRS/HLD failure** → Pattern 1 (Blocking): report, AskUserQuestion retry/abort
- **LLD failure** → Pattern 1 (Optional): report, offer retry/skip/abort
- **IMP/TST failure** → Pattern 1 (Partial): report which one, offer retry/skip/abort

On success, proceed to Phase 4.

## Phase 4: Sprint Integration

Invoke `Skill(sprint)` to update task status: **TODO → Ready** (or Blocked if dependencies exist).

## Phase 5: Summary

Spawn `Agent(general-purpose)` to write `.work/tasks/task-YYYYMMDD-{FR-name}--{slug}.md`:
- Task ID, title, and description
- SRS summary (key requirements captured)
- HLD summary (architecture decisions)
- LLD summary (design decisions)
- IMP summary (implementation scope)
- TST summary (test coverage)
- Gate verification results per phase (pass/reject/re-spawn count)
- Final status (Ready / Blocked)

## Phase 6: Next Steps

Use `AskUserQuestion`: "Task workflow complete. What next?" (header: "Next")
Options: "Cook this task now" | "Start a new feature/task" | "Create a change request" | "Done for now"

Route based on selection:
- "Cook this task now" → re-invoke sdlc:workflow with `cook [task-description]` (add --auto if plan was already approved)
- "Start a new feature/task" → re-invoke sdlc:workflow for task
- "Create a change request" → re-invoke sdlc:workflow for CR

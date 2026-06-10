# Cook Workflow (cook)

Pick a Ready task and implement using TDD via workflow-sdlc-cook-pipeline: red → green → gate:light → refactor → gate:full.

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **Ready**
2. If no Ready tasks, report: "No Ready tasks on the board. Run the task workflow first to move a TODO task through SRS→HLD→LLD, or move an existing In Review task to Ready." Then stop.
3. Capture task details and review existing SRS/HLD/LLD/IMP/TST artifacts from prior phases

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`

During planning, `Agent(Plan)` MUST assess:
- **BE impact**: Does implementation touch backend code?
- **FE impact**: Does implementation touch frontend code?

Record these in the plan file. They determine which parallel tracks execute.

## Phase 3: Execute TDD Pipeline (Workflow)

### Step 3.1: Prepare Workflow Args

```js
const workflowArgs = {
  taskId: "{task-id}",
  taskTitle: "{task-title}",
  planFile: ".work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md",
  language: "{vi|en}",
  runDate: "{YYYY-MM-DD}",
  slug: "{cook-slug}",
  beAffected: true,    // from plan's impact assessment
  feAffected: true,    // from plan's impact assessment
  // TST and IMP spec paths from prior phases
  tstPath: "agent_docs/backend/{service}/test-specs/FR-*-test.md",
  impPath: "agent_docs/backend/{service}/implementation/FR-*-impl.md",
}
```

### Step 3.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-cook-pipeline.js", args: workflowArgs })
```

The workflow handles:

**BE track** (if `beAffected` is true):
- tdd-be-red → write failing tests
- tdd-be-green → implement to pass tests
- tdd-be-gate --mode=light → 4 critical checks
- tdd-be-refactor → refactor for safety/perf
- tdd-be-gate --mode=full → 10 comprehensive checks

**FE track** (if `feAffected` is true):
- tdd-fe-red → write failing tests
- tdd-fe-green → implement to pass tests
- tdd-fe-gate --mode=light → 4 critical checks
- tdd-fe-refactor → refactor for a11y/UX/perf
- tdd-fe-gate --mode=full → 10 comprehensive checks

BE and FE run in **full parallel** via `pipeline()` — each track is independent.

### Gate Rejection Handling (in workflow)

| Gate Mode | Re-spawn Target | Rationale |
|-----------|----------------|-----------|
| `--mode=light` | `tdd-be-green` / `tdd-fe-green` | Light catches implementation issues |
| `--mode=full` | `tdd-be-refactor` / `tdd-fe-refactor` | Full catches refactor deficiencies |

Max 3 retries per gate.

### Step 3.3: Result Structure

**Success (both BE+FE):**
```js
{
  mode: 'cook',
  completed: ['TDD-BE', 'TDD-FE'],
  results: {
    be: {
      red: { testsWritten: 12 },
      green: { testsPassing: 12 },
      light: { passed: true },
      refactor: { changes: ['perf-opt-1', 'safety-check-2'] },
      full: { passed: true },
    },
    fe: {
      red: { testsWritten: 8 },
      green: { testsPassing: 8 },
      light: { passed: true },
      refactor: { changes: ['a11y-fix-1'] },
      full: { passed: true },
    },
  }
}
```

**Error:**
```js
{
  phase: 'TDD-BE',
  error: 'Gate full failed after 3 retries',
  feedback: 'Security check: SQL query not parameterized...'
}
```

### Step 3.4: Process Results

Follow error handling patterns in `references/error-handling.md`. Quick reference:

If workflow returns errors:
- **Light gate failure** → Pattern 1: report, AskUserQuestion retry/skip/abort
- **Full gate failure** → Pattern 1: report, AskUserQuestion retry/skip/abort
- **BE only or FE only failure** → Pattern 2 (Partial Cook): report which track, offer retry/skip/abort

On success, proceed to Phase 4.

## Phase 4: Sprint Integration

Invoke `Skill(sprint)` to update task status: **Ready → Done** (or **Ready → Blocked** if tests failed).

## Phase 5: Summary

Spawn `Agent(general-purpose)` to write `.work/cooks/cook-YYYYMMDD-{FR-name}--{slug}.md`:
- Task ID, title
- BE results: test count, implementation summary, gate results (light + full), re-spawn count
- FE results: test count, implementation summary, gate results (light + full), re-spawn count
- Overall status (Success / Partial / Failed)

## Phase 6: Next Steps

Use `AskUserQuestion`: "Cook complete. What next?" (header: "Next")
Options: "Cook another Ready task" | "Start a new feature/task" | "Create a change request" | "Done for now"

Route based on selection:
- "Cook another Ready task" → re-invoke sdlc:workflow with `cook --auto`
- "Start a new feature/task" → re-invoke sdlc:workflow for task
- "Create a change request" → re-invoke sdlc:workflow for CR

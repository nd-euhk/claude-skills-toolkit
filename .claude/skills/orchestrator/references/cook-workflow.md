# Cook Workflow (cook)

Pick a Ready task and implement it using TDD (red → green → refactor → gate).

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **Ready**
2. If no Ready tasks, report to human: "No Ready tasks on the board. Run the task workflow first to move a TODO task through SRS→HLD→LLD, or move an existing In Review task to Ready." Then stop.
3. Capture task details and review existing SRS/HLD/LLD/IMP/TST artifacts from prior phases

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`

During planning, `Agent(Plan)` MUST assess:
- **BE impact**: Does implementation touch backend code?
- **FE impact**: Does implementation touch frontend code?

Record these in the plan file.

## Phase 3: Execute TDD Pipeline

Based on impact assessment from Phase 2:

### If BE affected

```
Agent(tdd-be-red)       → write failing tests
  ↓
Agent(tdd-be-green)     → implement to pass tests
  ↓
Agent(tdd-be-gate) --mode=light → 4 critical checks
  ↓ PASS
Agent(tdd-be-refactor)  → refactor for safety/perf
  ↓
Agent(tdd-be-gate) --mode=full → 10 comprehensive checks
  ↓ PASS → BE complete
```

### If FE affected

```
Agent(tdd-fe-red)       → write failing tests
  ↓
Agent(tdd-fe-green)     → implement to pass tests
  ↓
Agent(tdd-fe-gate) --mode=light → 4 critical checks
  ↓ PASS
Agent(tdd-fe-refactor)  → refactor for a11y/UX/perf
  ↓
Agent(tdd-fe-gate) --mode=full → 10 comprehensive checks
  ↓ PASS → FE complete
```

### If BOTH affected

Run BE and FE pipelines in **parallel**. Each pipeline is fully independent — spawn all agents for both pipelines simultaneously where possible, respecting internal sequencing within each pipeline.

### Gate Rejection Handling

When any `tdd-be-gate` or `tdd-fe-gate` rejects:

| Gate Mode | Re-spawn Target | Rationale |
|-----------|----------------|-----------|
| `--mode=light` | `tdd-be-green` / `tdd-fe-green` | Light gate catches implementation issues — fix the code, not the tests |
| `--mode=full` | `tdd-be-refactor` / `tdd-fe-refactor` | Full gate catches refactor deficiencies — re-refactor, don't re-implement |

After re-spawning, re-run the same gate check. Loop until pass.

### Re-spawn Loop Safety

If an agent fails gate verification **3 times consecutively**, stop and report to human with accumulated gate feedback. Do not loop indefinitely.

## Phase 4: Summary

Write report to `.work/reports/cook-YYYYMMDD-{FR-name}--{slug}.md` containing:
- Task ID, title
- BE results: test count, implementation summary, gate results (light + full), re-spawn count
- FE results: test count, implementation summary, gate results (light + full), re-spawn count
- Overall status (Success / Partial / Failed)

After writing the report, invoke `Skill(sprint)` to update the task status: **Ready → Done** (or **Ready → Blocked** if tests failed and need investigation).

## Phase 5: Next Steps

Use `AskUserQuestion` to ask: "Cook complete. What next?" (header: "Next")
Options: "Cook another Ready task" | "Start a new feature/task" | "Create a change request" | "Done for now"

Route based on selection:
- "Cook another Ready task" → re-invoke orchestrator with `cook --auto` (skip plan mode for subsequent cooks)
- "Start a new feature/task" → re-invoke orchestrator for task workflow
- "Create a change request" → re-invoke orchestrator for CR workflow

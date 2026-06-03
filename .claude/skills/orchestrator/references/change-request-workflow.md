# Change Request Workflow (cr)

Pick a Done/In Review task, assess impact on existing artifacts, modify only what's affected, then implement and test.

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **Done** or **In Review**
2. If no matching tasks, report and stop
3. Capture task details for context

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`

During planning, `Agent(Plan)` MUST specifically assess:
- **HLD impact**: Does this change affect system architecture, component boundaries, or data flow?
- **LLD impact**: Does this change affect domain models, API contracts, or service internals?

Record these assessments in the plan file. They determine which optional phases execute in Phase 3.

## Phase 3: Execute CR Pipeline

Run this sequence. Phases marked **optional** execute only if the plan determined they are affected.

```
Agent(hld)              ← OPTIONAL: only if HLD affected
  ↓
Agent(gate-verifier)    ← OPTIONAL: only if HLD affected
  ↓ PASS (or skipped)
Agent(lld)              ← OPTIONAL: only if LLD affected
  ↓
Agent(gate-verifier)    ← OPTIONAL: only if LLD affected
  ↓ PASS (or skipped)
Agent(imp) + Agent(tst) ← always execute, spawn in PARALLEL
  ↓
Agent(gate-verifier) → verify IMP output
Agent(gate-verifier) → verify TST output
  ↓ BOTH PASS
Skill(sprint) → add CR task to Board with status Ready (or Blocked if dependencies exist)
```

### Optional Phase Execution

Before spawning optional agents, re-read the plan's impact assessment:
- If HLD is NOT affected → skip `Agent(hld)` and its gate verifier entirely
- If LLD is NOT affected → skip `Agent(lld)` and its gate verifier entirely
- IMP+TST always execute regardless

### Gate Rejection Handling

When any `gate-verifier` rejects output, re-spawn the preceding agent with the gate's feedback to fix issues, then re-run gate verification. Use re-spawn template from `agent-brief-templates.md`.

### Re-spawn Loop Safety

If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.

### Parallel IMP+TST

Spawn `Agent(imp)` and `Agent(tst)` simultaneously. Both must complete before running their respective gate verifiers (also in parallel).

## Phase 4: Summary

Write report to `.work/change-requests/cr-NNN-YYYYMMDD-{FR-name}--{slug}.md`.

### Frontmatter (REQUIRED)

Every CR summary report MUST include full YAML frontmatter:

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

**Frontmatter field rules:**
- `title`: Follow CR-TEMPLATE.md naming convention `CR-{NNN}: {Short Description}`
- `type`: `NEW` if adding new behavior to existing feature; `CHANGE` if modifying existing behavior
- `status`: Reflects current pipeline state — starts as `planned`, progresses through `in-progress` → `implemented` → `verified` → `ready` (or `blocked`)
- `hld_affected` / `lld_affected`: Must match the plan's impact assessment exactly
- `phases_executed`: List only phases that actually ran (HLD/LLD conditional; IMP+TST always)
- `source_task`: The Done/In Review task picked in Phase 1
- `changelog`: Append an entry each time `status` changes

### Report Body

After frontmatter, the report body MUST contain:

- **Task context**: Task ID, title, and original description from sprint board
- **Impact assessment**: HLD affected (yes/no + rationale), LLD affected (yes/no + rationale), phases to execute (list)
- **HLD changes** (if applicable): Architecture decisions modified, ADRs created/superseded, diagrams updated
- **LLD changes** (if applicable): Design sections changed, domain model updates, API contract modifications
- **IMP summary**: Implementation scope, files created/modified, key logic changes
- **TST summary**: Test coverage, test types (unit/integration/e2e), test count per type
- **Gate verification results per phase** (pass/reject/re-spawn count for each executed phase)
- **Artifacts modified**: Table of all files changed with status (Created/Updated/Unchanged)
- **Final status**: `Ready` (sprint-synced) or `Blocked` (with reason and dependency list)

## Phase 5: Next Steps

Same AskUserQuestion pattern as Task Workflow Phase 5.

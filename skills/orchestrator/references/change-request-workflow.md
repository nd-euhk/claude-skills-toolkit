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

Write report to `.work/reports/cr-YYYYMMDD-{FR-name}--{slug}.md` containing:
- Task ID, title, and description
- Impact assessment results (HLD affected: yes/no, LLD affected: yes/no)
- HLD changes (if applicable)
- LLD changes (if applicable)
- IMP summary (implementation scope)
- TST summary (test coverage)
- Gate verification results per phase
- Final status (Ready / Blocked)

## Phase 5: Next Steps

Same AskUserQuestion pattern as Task Workflow Phase 5.

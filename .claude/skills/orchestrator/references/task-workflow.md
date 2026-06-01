# Task Workflow (feature | task | story)

Pick a TODO task from the board, run full SDLC: SRS → HLD → LLD → IMP+TST → gate verification, then mark Ready.

## Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **TODO**
2. If no TODO tasks exist, report to human and stop
3. Capture the task details (ID, title, description) for context in subsequent phases

## Phase 2: Plan (skip if --auto)

Execute Common Phase: Plan Mode from SKILL.md. Plan file path: `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md`

## Phase 3: Execute SDLC Pipeline

Run this exact sequence. **CRITICAL: Each phase must pass gate verification before the next phase starts.**

```
Agent(srs)
  ↓
Agent(gate-verifier) → verify SRS output
  ↓ PASS
Agent(hld)
  ↓
Agent(gate-verifier) → verify HLD output
  ↓ PASS
Agent(lld)
  ↓
Agent(gate-verifier) → verify LLD output
  ↓ PASS
Agent(imp) + Agent(tst)  ← spawn in PARALLEL
  ↓
Agent(gate-verifier) → verify IMP output
Agent(gate-verifier) → verify TST output
  ↓ BOTH PASS
Skill(sprint) → update task status: TODO → Ready (or Blocked if dependencies exist)
```

### Gate Rejection Handling

When any `gate-verifier` rejects output, re-spawn the preceding agent with the gate's feedback to fix issues, then re-run gate verification. Loop until pass.

Example:
```
Agent(lld) → Agent(gate-verifier) → REJECT
  → re-spawn Agent(lld) with feedback (use re-spawn template from agent-brief-templates.md)
  → Agent(gate-verifier) → PASS (or loop again)
```

### Parallel IMP+TST

Spawn `Agent(imp)` and `Agent(tst)` simultaneously in a single message. Both must complete before running their respective gate verifiers (also spawn both gate verifiers in parallel).

### Re-spawn Loop Safety

If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.

## Phase 4: Summary

Write summary report to `.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md` containing:
- Task ID, title, and description
- SRS summary (key requirements captured)
- HLD summary (architecture decisions)
- LLD summary (design decisions)
- IMP summary (implementation scope)
- TST summary (test coverage)
- Gate verification results per phase (pass/reject/re-spawn count)
- Final status (Ready / Blocked)

## Phase 5: Next Steps

Use `AskUserQuestion` to ask: "Task workflow complete. What next?" (header: "Next")
Options: "Cook this task now" | "Start a new feature/task" | "Create a change request" | "Done for now"

Route based on selection:
- "Cook this task now" → re-invoke orchestrator with `cook [task-description]` (add --auto if plan was already approved)
- "Start a new feature/task" → re-invoke orchestrator for task workflow
- "Create a change request" → re-invoke orchestrator for CR workflow

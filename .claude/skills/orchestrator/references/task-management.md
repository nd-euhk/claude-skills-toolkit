# Task Management

Tracks SDLC workflow progress with Task tools. Each phase is a task with `blockedBy` forming the sequential chain. Gate rejection triggers re-spawn with the same task staying in_progress. Max 3 retries per phase.

**Metadata convention**: `phase`, `workflow={task|cr|cook}`, `effort` (5m-20m).
**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically, only tracking is lost.

## Task Workflow Chain

```
TaskCreate("Assess task scope") → completed
TaskCreate("Produce SRS") [blockedBy: assess] → completed (after gate)
TaskCreate("Gate-verify SRS") [blockedBy: srs] → completed
TaskCreate("Produce HLD") [blockedBy: gate-srs] → completed (after gate)
TaskCreate("Gate-verify HLD") [blockedBy: hld] → completed
TaskCreate("Produce LLD") [blockedBy: gate-hld] → completed (after gate)
TaskCreate("Gate-verify LLD") [blockedBy: lld] → completed
TaskCreate("Produce IMP") + TaskCreate("Produce TST") [parallel, blockedBy: gate-lld]
TaskCreate("Gate-verify IMP") + TaskCreate("Gate-verify TST") [parallel, blockedBy: imp + tst]
TaskCreate("Sprint sync") [blockedBy: gate-imp + gate-tst]
TaskCreate("Write summary report") [blockedBy: sprint]
```

## Change Request (CR) Workflow Chain

```
TaskCreate("Assess change impact on HLD+LLD") → completed
TaskCreate("Produce SRS") [blockedBy: assess] → completed (after gate)
TaskCreate("Gate-verify SRS") [blockedBy: srs] → completed
TaskCreate("Revise HLD") [blockedBy: gate-srs, conditional — skip if no HLD impact]
TaskCreate("Gate-verify HLD") [blockedBy: hld, conditional]
TaskCreate("Revise LLD") [blockedBy: gate-hld, conditional — skip if no LLD impact]
TaskCreate("Gate-verify LLD") [blockedBy: lld, conditional]
TaskCreate("Produce IMP") + TaskCreate("Produce TST") [parallel, blockedBy: last-gate]
TaskCreate("Gate-verify IMP") + TaskCreate("Gate-verify TST") [parallel]
TaskCreate("Sprint sync") [blockedBy: gate-imp + gate-tst]
TaskCreate("Write CR report") [blockedBy: sprint]
```

## Cook Workflow Chain

```
TaskCreate("Assess BE+FE impact")
TaskCreate("TDD-RED: Backend") + TaskCreate("TDD-RED: Frontend") [parallel, blockedBy: assess]
TaskCreate("TDD-GREEN: Backend") [blockedBy: red-be]
TaskCreate("TDD-GREEN: Frontend") [blockedBy: red-fe]
TaskCreate("TDD-GATE-LIGHT: Backend") [blockedBy: green-be]
TaskCreate("TDD-GATE-LIGHT: Frontend") [blockedBy: green-fe]
TaskCreate("TDD-REFACTOR: Backend") [blockedBy: gate-light-be]
TaskCreate("TDD-REFACTOR: Frontend") [blockedBy: gate-light-fe]
TaskCreate("TDD-GATE-FULL: Backend") [blockedBy: refactor-be]
TaskCreate("TDD-GATE-FULL: Frontend") [blockedBy: refactor-fe]
TaskCreate("Verify + Complete") [blockedBy: gate-full-be + gate-full-fe]
```

BE and FE run in parallel at each TDD phase. If only BE or only FE, skip the other track.

## Re-spawn Handling

When a gate rejects, re-spawn the phase agent with `RETRY #{N}`. The task stays in_progress. Max 3 retries per phase. After 3: mark task completed with metadata noting permanent rejection, stop pipeline, report to human.

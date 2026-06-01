# TASK-07: Summary + Next Steps

## Status: PASS

## Test Objective
Verify Phase 4 (Summary Report) and Phase 5 (Next Steps) of the Task Workflow specification, including report format, file path pattern, AskUserQuestion options, and routing logic.

## Specification Reference

### Phase 4: Summary (task-workflow.md lines 59-69)

> Write summary report to `.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md` containing:
> - Task ID, title, and description
> - SRS summary (key requirements captured)
> - HLD summary (architecture decisions)
> - LLD summary (design decisions)
> - IMP summary (implementation scope)
> - TST summary (test coverage)
> - Gate verification results per phase (pass/reject/re-spawn count)
> - Final status (Ready / Blocked)

### Phase 5: Next Steps (task-workflow.md lines 71-79)

> Use `AskUserQuestion` to ask: "Task workflow complete. What next?" (header: "Next")
> Options: "Cook this task now" | "Start a new feature/task" | "Create a change request" | "Done for now"
>
> Route based on selection:
> - "Cook this task now" → re-invoke orchestrator with `cook [task-description]` (add --auto if plan was already approved)
> - "Start a new feature/task" → re-invoke orchestrator for task workflow
> - "Create a change request" → re-invoke orchestrator for CR workflow

## Phase 4: Summary Report Analysis

### Report File Path Pattern
```
.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md
```

Components:
- **Base**: `.work/reports/` (requires mkdir -p, per SKILL.md line 96)
- **Prefix**: `task-` (identifies as task workflow report)
- **Date**: `YYYYMMDD` format (e.g., `20260601`)
- **FR-name**: short functional requirement name from task description
- **URL-safe slug**: hyphenated identifier
- **Separator**: double dash (`--`) between FR-name and slug

Example: `.work/reports/task-20260601-password-strength--pw-checker.md`

### Required Report Fields

| Field | Description | Source |
|-------|-------------|--------|
| Task ID, title, description | Task context from sprint board | Phase 1 output |
| SRS summary | Key requirements captured | Agent(srs) output |
| HLD summary | Architecture decisions | Agent(hld) output |
| LLD summary | Design decisions | Agent(lld) output |
| IMP summary | Implementation scope | Agent(imp) output |
| TST summary | Test coverage | Agent(tst) output |
| Gate verification results | Per-phase pass/reject/re-spawn count | Phase 3 gate verifiers |
| Final status | Ready or Blocked | Sprint update result |

### Gate Results Format
Must capture per phase:
- Phase name (SRS, HLD, LLD, IMP, TST)
- Result (PASS / REJECT)
- Re-spawn count (0 if passed first time, N if rejected N times)

## Phase 5: Next Steps Analysis

### AskUserQuestion Configuration

| Property | Value |
|----------|-------|
| Tool | AskUserQuestion |
| Question | "Task workflow complete. What next?" |
| Header | "Next" |

### Options and Routing

| Option | Re-invoke Format | Notes |
|--------|-----------------|-------|
| "Cook this task now" | `cook [task-description]` | Add --auto if plan was approved |
| "Start a new feature/task" | orchestrator task workflow | Standard invocation |
| "Create a change request" | orchestrator CR workflow | Routes to change-request-workflow.md |
| "Done for now" | (exit) | No further action |

### Routing Completeness
- Cook path: delegates to cook-workflow.md
- New feature: recurse into same workflow with new task
- CR path: delegates to change-request-workflow.md
- Done: graceful exit

All three orchestrator workflows are reachable from this single AskUserQuestion, providing complete navigation coverage.

## SKILL.md Alignment

### SKILL.md line 70 - Task Workflow Summary
> Pick TODO → Plan(opt) → SRS→gate→HLD→gate→LLD→gate→IMP+TST(parallel)→gate→sprint update(Ready/Blocked) → Summary → AskUserQuestion(next)

This matches task-workflow.md: the pipeline ends with "Summary" (Phase 4) then "AskUserQuestion(next)" (Phase 5).

### SKILL.md line 96 - Directory Creation
> **Report paths require directories.** Ensure `.work/plans/` and `.work/reports/` exist before writing. Create with `mkdir -p` if needed.

The summary report path (`.work/reports/`) is covered by this requirement.

### SKILL.md line 98 - Sprint Integration
> **Sprint integration.** The sprint skill manages board state. Orchestrator only invokes it for pick/update operations — never modifies board files directly.

Phase 4 final status comes from sprint update (Ready/Blocked), not manual board editing.

## Verification Checklist

| Check | Result |
|-------|--------|
| Phase 4 Summary exists | PASS (lines 59-69) |
| Report path pattern defined | PASS (`.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md`) |
| All 8 required fields documented | PASS |
| Gate results include re-spawn count | PASS |
| Phase 5 Next Steps exists | PASS (lines 71-79) |
| AskUserQuestion with header "Next" | PASS |
| 4 options provided | PASS |
| "Cook this task now" routes to cook workflow | PASS |
| "Start a new feature/task" routes to task workflow | PASS |
| "Create a change request" routes to CR workflow | PASS |
| "Done for now" allows graceful exit | PASS |
| --auto passthrough for cook path | PASS |
| SKILL.md summary matches (line 70) | PASS |
| Report directory creation requirement | PASS (SKILL.md line 96) |
| Sprint integration for final status | PASS (SKILL.md line 98) |

## Conclusion

Phase 4 (Summary) and Phase 5 (Next Steps) are well-defined in task-workflow.md. The summary report format captures all relevant SDLC phase outputs with a clear file path pattern. The Next Steps AskUserQuestion provides comprehensive routing to all three orchestrator workflows (task, CR, cook) plus a graceful exit option. The --auto flag passthrough for the cook path is an important detail that maintains the user's previous choice about plan mode.

## Files Involved
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/references/task-workflow.md` (lines 59-79)
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/SKILL.md` (lines 70, 96, 98)

# Error Handling Patterns

Comprehensive error recovery guide for sdlc:workflow skill. Covers workflow failures, gate rejections, agent errors, and file issues.

## Error Categories

| Category | Trigger | Severity | Default Action |
|----------|---------|----------|---------------|
| **Workflow failure** | `workflow()` returns error result | Blocking | Report → AskUserQuestion |
| **Gate rejection** | Phase agent fails gate ≥3 times | Phase blocking | Report → AskUserQuestion |
| **Agent error** | Agent crashes or times out | Phase blocking | Log → AskUserQuestion |
| **File missing** | Expected artifact not found | Blocking or warning | Verify → AskUserQuestion |
| **Sprint error** | Skill(sprint) fails | Non-blocking | Log warning → Continue |

## Pattern 1: Workflow Failure (Phase-Level)

When `workflow()` returns an error result containing `phase`, `error`, and `feedback`.

```
Workflow returned: {result.phase} failed — {result.error}
```

### Decision Tree

```
┌─ Phase = SRS or HLD?
│  → These are foundational. Cannot skip.
│  → Ask: "Retry the workflow or abort?"
│     Options: "Retry workflow" | "Abort"
│
├─ Phase = LLD?
│  → Optional for simple features.
│  → Ask: "LLD failed. Retry, skip, or abort?"
│     Options: "Retry LLD" | "Skip LLD and continue" | "Abort"
│
├─ Phase = IMP or TST?
│  → Can continue with partial specs.
│  → Ask: "{phase} failed. Retry, skip, or abort?"
│     Options: "Retry {phase}" | "Skip {phase}" | "Abort"
│
├─ Phase = TDD-BE or TDD-FE (cook)?
│  → One track failed, other may have passed.
│  → Ask: "{track} failed at {phase}. Retry, skip this track, or abort?"
│     Options: "Retry {track}" | "Skip {track}" | "Abort"
│
└─ Error is unexpected (no phase field)?
   → Report full error to human. Ask: "Unexpected error. Retry or abort?"
      Options: "Retry" | "Abort"
```

### AskUserQuestion Template

```
Question: "{phase} failed after 3 retries. What should I do?"
Header: "Gate Failed"
Options:
  - "Retry {phase}" — re-invoke the workflow with same args
  - "Skip and continue" — proceed with next phase (only for non-SRS/HLD)
  - "Abort" — stop the pipeline
```

## Pattern 2: Partial Failure (Some Phases Pass, Some Fail)

When workflow returns partial success (e.g., 2 of 3 LLD services passed, or BE passed but FE failed).

### LLD Service Partial Failure (explore pipeline)

```
Workflow returned: {N} service(s) failed LLD gate
Failed: [{service-name}, ...]
```

Response:
```
Report: "LLD gate failed for: {services}. Other services passed."
Ask: "How to handle failed services?"
Header: "Partial LLD Failure"
Options:
  - "Retry failed services" — spawn Agent(lld-service) manually for each
  - "Skip failed services" — continue with services that passed
  - "Abort"
```

### Cook BE/FE Partial Failure

```
Workflow returned: BE passed, FE failed (Full gate after 3 retries)
```

Response:
```
Report: "BE implementation complete and verified. FE failed: {feedback}"
Ask: "FE track failed. How to proceed?"
Header: "Partial Cook"
Options:
  - "Retry FE only" — re-invoke cook workflow with beAffected=false
  - "Accept BE only" — mark task Done with FE remaining
  - "Abort" — stop, keep task Ready
```

## Pattern 3: Agent Error (Crash/Timeout)

Agent errors are different from gate rejections — the agent itself failed, not its output quality.

```
Agent(lld) failed: timeout after 300s
```

Response:
```
Log warning: "Agent(lld) timed out. This is an execution error, not a quality issue."
Ask: "Agent failed. Retry, skip, or abort?"
Header: "Agent Error"
Options:
  - "Retry once" — re-spawn the same agent
  - "Skip phase" — only for non-critical phases
  - "Abort"
```

**Important**: Never auto-retry on agent errors. Gate rejections auto-retry up to 3 times (in workflow), but agent crashes require human decision.

## Pattern 4: File Missing

When expected artifacts don't exist before or after a phase.

### Before Phase

```
Expected SRS at docs/product/SRS.md but file not found.
```

Response:
```
Report: "Expected file not found: {path}. This file should have been created by {prior-phase}."
Ask: "Missing file. What should I do?"
Header: "File Missing"
Options:
  - "Re-run prior phase" — re-invoke workflow from prior phase
  - "Continue without it" — skip verification, proceed anyway
  - "Abort"
```

### After Phase

```
Phase completed but output file not found at expected path.
Check agent output for alternative paths.
If agent wrote to unexpected location → update path references.
If no output at all → treat as Agent Error (Pattern 3).
```

## Pattern 5: Sprint Skill Failure

```
Skill(sprint) returned error or failed to update board.
```

Response:
```
Log warning: "Sprint update failed: {error}. Task status may be stale."
Continue pipeline anyway — sprint is non-blocking.
After pipeline completes, retry sprint sync once.
If still fails → report to human: "Sprint sync failed. Please update board manually."
```

## Pattern 6: Workflow File Not Found

```
Before calling Workflow(), verify the script file exists:
ls .claude/workflows/workflow-sdlc-{task|cr|cook}-pipeline.js
```

If file not found:
```
Report: "Workflow script not found: {path}. Falling back to manual agent orchestration."
Route to orchestrator-compatible manual execution.
```

## Pattern 7: Workflow Tool Unavailable

When `Workflow` tool is not functional (e.g., permission issue, version mismatch).

```
Report: "Workflow tool unavailable. Falling back to manual Phase 3 orchestration."
Execute Phase 3 manually — same as orchestrator skill.
Equivalent results — only execution mechanism differs.
```

## Retry Strategy Summary

| Scenario | Max Retries | Who Decides | Mechanism |
|----------|------------|-------------|-----------|
| Gate rejection | 3 (in workflow) | Automatic | Workflow script re-spawns agent |
| Workflow failure after 3 gate retries | 1 | Human | AskUserQuestion → re-invoke workflow |
| Agent crash/timeout | 1 | Human | AskUserQuestion → re-spawn agent |
| File missing | 1 | Human | AskUserQuestion → re-run phase |
| Sprint error | 1 after pipeline | Automatic | Retry once, then report |

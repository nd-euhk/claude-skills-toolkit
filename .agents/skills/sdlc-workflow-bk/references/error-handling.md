# Error Handling Patterns

Comprehensive error recovery guide for sdlc:workflow skill. Covers workflow failures, gate rejections, agent errors, and file issues.

## Quick Reference by Workflow

| Workflow | SRS/HLD failure | LLD failure | IMP/TST failure | Gate failure (cook) | Track failure (cook) |
|----------|----------------|-------------|-----------------|---------------------|----------------------|
| **Task** | Pattern 1: Blocking | Pattern 1: Optional | Pattern 1: Partial | — | — |
| **CR** | Pattern 1: Blocking | Pattern 1: Optional | Pattern 1: Partial | — | — |
| **Cook** | — | — | — | Pattern 1: retry/skip/abort | Pattern 2: Partial Cook |

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

## Pattern 8: Retry from Failed Phase (Idempotent Re-run)

When a workflow phase fails after all gate retries, re-running the SAME workflow with identical args will:
1. Check which phases already have valid output → skip them
2. Re-run only the failed phase (and any subsequent phases)
3. Already-passed phases cost 0 tokens (skipped entirely)

### How it works

Each workflow script now includes a `checkPhaseStatus()` helper that uses an Explore agent at startup to verify which outputs already exist. Before each phase, the script checks the status:

```
Phase SRS: output exists? → YES → skip (0 tokens)
Phase HLD: output exists? → NO  → run + gate (fresh execution)
Phase LLD: depends on HLD → run + gate
...
```

### Usage

When a workflow returns an error result:

```
Workflow returned: { phase: 'HLD', error: 'Gate failed after 3 retries' }
```

Response:
```
Report: "HLD failed gate. Previously completed: SRS (will be skipped on retry)."
Ask: "HLD failed after 3 retries. What should I do?"
Header: "Gate Failed"
Options:
  - "Retry from HLD" — re-invoke workflow with same args (SRS auto-skipped)
  - "Retry from HLD (--from-phase)" — re-invoke with fromPhase='HLD' (force skip SRS, force run HLD)
  - "Skip HLD and continue" — proceed to LLD (only for non-SRS phases)
  - "Abort" — stop the pipeline
```

**Option A: "Retry from HLD"** (auto-detect) — re-invokes `Workflow()` with the exact same args. The workflow detects SRS output exists and skips it. HLD runs fresh.

**Option B: "Retry from HLD (--from-phase)"** (targeted) — re-invokes `Workflow()` with `fromPhase: 'HLD'` added to args. Force-skips ALL phases before HLD (regardless of output existence), force-runs HLD. Faster than auto-detect (no upfront check agent needed for skipped phases).

### --from-phase arg

Task pipeline supports `fromPhase` in args to directly target a phase:

```js
const workflowArgs = {
  taskId: "TASK-001",
  taskTitle: "User Auth",
  planFile: ".work/plans/task-20260611--user-auth.md",
  language: "vi",
  fromPhase: "LLD",  // skip SRS, HLD → run LLD, IMP, TST
}
```

| fromPhase value | Phases skipped | Phases run |
|-----------------|---------------|------------|
| `"SRS"` | (none) | SRS, HLD, LLD, IMP, TST |
| `"HLD"` | SRS | HLD, LLD, IMP, TST |
| `"LLD"` | SRS, HLD | LLD, IMP, TST |
| `"IMP+TST"` | SRS, HLD, LLD | IMP, TST |
| (omitted) | auto-detect | only phases without existing output |

**When to use which:**

| Scenario | Use |
|----------|-----|
| First retry after failure | Auto-detect (no args change) |
| SRS output deleted/corrupted, need full re-run from SRS | `fromPhase: "SRS"` |
| Know exactly which phase failed, want fastest retry | `fromPhase: "{failed-phase}"` |
| Unsure what state the output is in | Auto-detect (safer, checks everything) |

### What gets skipped per pipeline

| Pipeline | Phases auto-skipped on retry |
|----------|------------------------------|
| **Task** | SRS, HLD, LLD (if output exists), IMP, TST (per output) |
| **CR** | IMP, TST (if output exists). HLD/LLD always re-run (revisions) |
| **Explore** | SRS, HLD, LLD per service, LLD merge, IMP+TST per FR group |
| **Cook** | RED (if test files exist). GREEN+REFACTOR always re-run (code needs fresh verification) |

### Result structure with skip info

On retry, workflow returns `skipped` and `ran` arrays, plus the `fromPhase` used:

```js
{
  mode: 'task',
  completed: ['SRS', 'HLD', 'LLD', 'IMP', 'TST'],
  skipped: ['SRS'],           // phases that were already done
  ran: ['HLD', 'LLD', 'IMP', 'TST'],  // phases that ran this invocation
  fromPhase: 'HLD',           // if --from-phase was used
  results: { ... }
}
```

## Retry Strategy Summary

| Scenario | Max Retries | Who Decides | Mechanism |
|----------|------------|-------------|-----------|
| Gate rejection (within phase) | 3 (in workflow) | Automatic | Workflow script re-spawns agent |
| Workflow failure after 3 gate retries | 1 | Human | AskUserQuestion → re-invoke workflow (passed phases auto-skipped, or use --from-phase) |
| Agent crash/timeout | 1 | Human | AskUserQuestion → re-spawn agent |
| File missing | 1 | Human | AskUserQuestion → re-run phase |
| Sprint error | 1 after pipeline | Automatic | Retry once, then report |

# INT-02: Agent Error Recovery -- KET QUA

## Error Recovery Mechanism

Source: `skills/orchestrator/SKILL.md` line 100

```
Error recovery. If any agent fails (not gate rejection, but actual error),
log the error to the report, ask human whether to retry or skip.
Do not auto-retry on agent errors.
```

## Detailed Breakdown

### Agent Error vs Gate Rejection

Two clearly distinct error handling paths exist:

| Aspect | Gate Rejection | Agent Error |
|--------|---------------|-------------|
| **Definition** | Agent output does not meet quality gates | Agent crashes, times out, or cannot produce output |
| **Response** | Re-spawn the preceding agent with feedback | Log error, ask human |
| **Auto-retry** | YES (up to 3 times per re-spawn loop safety) | NO ("Do not auto-retry on agent errors") |
| **Human input** | Human not consulted (automatic re-spawn) | Human asked: retry or skip |
| **Documentation** | Each workflow file has dedicated "Gate Rejection Handling" section | SKILL.md line 100 |
| **Loop safety** | 3 consecutive failures = stop and report to human | 1 failure = immediately ask human |

### Gate Rejection Handling (for contrast)

All three workflow reference files document gate rejection handling:

- **task-workflow.md** lines 40-57: Re-spawn preceding agent with gate feedback. 3 consecutive failures = stop.
- **change-request-workflow.md** lines 49-55: Same pattern. Re-spawn with gate feedback.
- **cook-workflow.md** lines 59-72: Gate mode routing -- light mode re-spawns green, full mode re-spawns refactor.

### Report Path for Error Logging

Based on each workflow's Phase 4 (Summary):

- **Task workflow**: `.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md` (task-workflow.md line 61)
- **CR workflow**: `.work/reports/cr-YYYYMMDD-{FR-name}--{slug}.md` (change-request-workflow.md line 63)
- **Cook workflow**: `.work/reports/cook-YYYYMMDD-{FR-name}--{slug}.md` (cook-workflow.md line 76)

Agent error details are logged to these report files.

### Human Interaction: AskUserQuestion

When an agent error occurs, the orchestrator MUST use `AskUserQuestion` to ask:
- Header: likely "Agent Error" or "Error Recovery"
- Options: "Retry" (re-spawn the failed agent) or "Skip" (skip the failed agent, proceed if possible)

This is derived from the instruction "ask human whether to retry or skip" (SKILL.md line 100).

## Verification

- **"If any agent fails (not gate rejection, but actual error)" handled**: YES
  - SKILL.md line 100 explicitly covers this case with three actions: log, ask, don't auto-retry.

- **"log the error to the report" -- report path defined**: YES
  - Each workflow's Phase 4 (Summary) specifies the exact report path. The orchestrator writes error details to the report file corresponding to the active workflow.

- **"ask human whether to retry or skip" -- AskUserQuestion**: YES
  - The instruction "ask human whether to retry or skip" maps to AskUserQuestion (listed in orchestrator's allowed-tools at line 7). Two options: Retry, Skip.

- **"Do not auto-retry on agent errors" -- enforced**: YES
  - Explicit prohibition. Contrast with gate rejection which auto-retries up to 3 times. Agent error = immediate human escalation.

- **Clear distinction gate rejection vs agent error**: YES
  - Gate rejection: re-spawn preceding agent, auto-retry up to 3x
  - Agent error: log to report, ask human, zero auto-retry
  - These are documented in separate sections: gate rejection in workflow files, error recovery in SKILL.md

## Assessment: PASS

The orchestrator has a clear, well-separated error recovery mechanism. Agent errors (crashes, failures) are handled distinctly from gate rejections (quality issues). The three-step protocol -- log error to report, ask human via AskUserQuestion, never auto-retry -- provides human oversight without blocking the pipeline indefinitely. The contrast with gate rejection handling (auto-retry up to 3x) makes the distinction unambiguous.

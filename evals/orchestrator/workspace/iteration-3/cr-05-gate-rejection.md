# CR-05: Gate Rejection in CR Context -- KET QUA

## Verification Method: code review

## Sources Reviewed
- `.claude/skills/orchestrator/SKILL.md` (lines 88-94: gate verification, re-spawn loop safety)
- `.claude/skills/orchestrator/references/change-request-workflow.md` (lines 49-55: gate rejection handling, re-spawn loop safety)
- `.claude/skills/orchestrator/references/agent-brief-templates.md` (lines 136-147: re-spawn brief template)
- `.claude/skills/orchestrator/references/task-workflow.md` (lines 40-57: gate rejection pattern that CR inherits)

## Findings

### Gate Rejection Handling (PASS)
The CR workflow explicitly defines gate rejection handling at change-request-workflow.md lines 49-51:
> When any `gate-verifier` rejects output, re-spawn the preceding agent with the gate's feedback to fix issues, then re-run gate verification. Use re-spawn template from `agent-brief-templates.md`.

The re-spawn brief template (agent-brief-templates.md lines 136-147) provides a structured format:
```
RETRY #{N}: Previous attempt was rejected by gate-verifier.
Gate feedback: {exact gate-verifier rejection message}
Fix these specific issues before re-submitting. Do not change anything that was not flagged.
```

### Gate Coverage (PASS)
The CR pipeline gates the following phases:
- HLD (optional, only if HLD affected) -- gate-verifier → PASS or re-spawn hld
- LLD (optional, only if LLD affected) -- gate-verifier → PASS or re-spawn lld
- IMP (always) -- gate-verifier → PASS or re-spawn imp
- TST (always) -- gate-verifier → PASS or re-spawn tst

IMP and TST are spawned in parallel, then both gate verifiers run in parallel. Both must pass.

### Re-spawn Loop Safety (PASS)
change-request-workflow.md line 55:
> If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.

This matches the orchestrator SKILL.md baseline (line 94).

### IMP-TST Parallel Gate Failure Scenario (PASS)
When IMP produces a spec that is missing required sections (e.g., error mapping), the IMP gate-verifier detects it. The flow:
1. Spawn Agent(imp) + Agent(tst) in parallel
2. Spawn gate-verifier(IMP) + gate-verifier(TST) in parallel
3. If gate-verifier(IMP) rejects → re-spawn Agent(imp) with feedback (retry #1)
4. Re-run gate-verifier(IMP)
5. If still fails → re-spawn again (retry #2)
6. If still fails → re-spawn again (retry #3)
7. At 3 consecutive failures → stop, report to human

After re-spawn, IMP and TST are NOT re-spawned together (the CR pipeline re-spawns only the failing agent, not both).

### IMP Spec Completeness Gate Criteria (PASS)
The IMP agent brief (agent-brief-templates.md lines 46-54) specifies required deliverables:
- Execution flow
- Business rules
- Data impact
- Error mapping
- Security considerations

If error mapping is missing in the spec, gate verification should detect this as a completeness failure. While the exact gate criteria per phase are not detailed in the orchestrator skill (delegated to gate-verifier agent), the IMP brief clearly defines what a complete spec must contain.

## Assessment: PASS

The CR workflow has proper gate rejection handling with re-spawn capability, parallel IMP+TST gates, and loop safety (max 3 retries). The re-spawn brief template ensures feedback is propagated to the re-spawned agent. Gate denial/re-spawn in IMP+TST context is well-modeled.

# Error Handling — sdlc:fixbug

Error recovery patterns specific to the fixbug workflow pipeline.

## Error Categories

| Category | Trigger | Severity | Default Action |
|----------|---------|----------|---------------|
| **Symptom not fixed** | preFixVerify fails | Critical | Loop to Step 2 (re-diagnose) |
| **New errors introduced** | parallelChecks fail | High | Fix issues, re-run workflow |
| **Code review rejected** | codeReview fails gate | High | AskUserQuestion |
| **Side effect detected** | sideEffectSweep fails | High | AskUserQuestion |
| **Prevention gate fails** | preventionGate fails | Medium | AskUserQuestion |
| **Workflow error** | Agent crash/timeout | Medium | AskUserQuestion |
| **Script missing** | workflow file not found | Medium | Fallback to manual |

## Pattern 1: Symptom Still Reproduces

```
Workflow returned: preFixVerify.symptomFixed = false
```

**Decision:** This is ALWAYS a loop-back to Step 2. The fix didn't address the root cause.

```
Report: "Symptom still reproduces after fix. Root cause diagnosis may be wrong."
Action: Loop back to Step 2 (Diagnose) — re-examine root cause with fresh evidence.
Do NOT: Try a different fix without re-diagnosing.
```

## Pattern 2: New Errors Introduced

```
Workflow returned: parallelChecks.{typecheck|lint|build|test} = false
```

**Decision Tree:**

```
┌─ typecheck or lint failed?
│  → Fix is straightforward — apply corrections directly
│  → Re-run workflow after fixing
│
├─ build failed?
│  → May indicate deeper issue in fix
│  → Check error, fix, re-run workflow
│
└─ test failed (non-regression)?
   → Fix may have broken unrelated functionality
   → Check which tests fail + why
   → If fix caused regression → AskUserQuestion per Pattern 4
   → If pre-existing flaky test → skip, note in report
```

**After fixing:** Re-invoke workflow with same args (workflow resumes from cache where possible).

## Pattern 3: Code Review Rejected

```
Workflow returned: codeReview.passed = false
Code review score: {N}/10
Feedback: "{specific issues found}"
```

**Decision:**

```
AskUserQuestion:
  Question: "Code review found issues ({score}/10). How to proceed?"
  Header: "Review Rejected"
  Options:
    - "Rework fix" — address review feedback, re-run workflow
    - "Accept risk" — proceed to Step 6, note in bug report
    - "Abort" — keep changes, don't finalize
```

**Important:** Do NOT auto-skip code review rejection. Even in Autonomous mode, this requires human decision.

## Pattern 4: Side Effect Detected

```
Workflow returned: sideEffectSweep.passed = false
Broken paths: [{path}, ...]
Details: "{what broke and why}"
```

**Decision:**

```
AskUserQuestion:
  Question: "Side effect detected in {N} paths. How to handle?"
  Header: "Side Effect"
  Options:
    - "Revert fix, try different approach" — loop to Step 2
    - "Narrow fix scope" — limit changes to fewer files, re-run
    - "Update dependent code" — fix the broken paths to match new contract
    - "Accept regression" — the broken behavior was itself buggy
```

This directly implements the HARD-GATE-NO-SIDE-EFFECTS from the skill.

## Pattern 5: Prevention Gate Fails

```
Workflow returned: preventionGate.passed = false
Missing: [{requirement}, ...]
```

**Decision:**

```
AskUserQuestion:
  Question: "Prevention gate incomplete. Missing: {items}. How to proceed?"
  Header: "Prevention Gate"
  Options:
    - "Add missing prevention" — implement missing guards/tests, re-run
    - "Skip prevention" — proceed without, note in report
    - "Abort"
```

**For Quick mode:** Prevention gate relaxed — regression test optional, defense-in-depth skipped. Only flag if typecheck/lint missing.

## Pattern 6: Workflow Agent Error

```
Workflow returned status: "failed" with agent error (timeout/crash/missing output)
```

**Decision:**

```
AskUserQuestion:
  Question: "Verification agent failed: {error}. Retry or fallback?"
  Header: "Agent Error"
  Options:
    - "Retry workflow" — re-invoke with same args (cache hit on completed agents)
    - "Manual verify" — fall back to manual Step 5 execution
    - "Skip verify" — proceed to Step 6 without verification (NOT recommended)
```

**Never auto-retry agent errors.**

## Pattern 7: Workflow Script Not Found

```
ls .claude/workflows/workflow-sdlc-fixbug-pipeline.js → file not found
```

**Decision:**

```
Report: "Workflow script missing. Falling back to manual verification."
Execute: fixbug skill Step 5 manually — same outputs, same gates.
No AskUserQuestion needed — fallback is automatic and equivalent.
```

## Pattern 8: 3+ Verify Attempts

```
Step 5 has been attempted 3+ times and still fails.
```

**Decision:**

```
STOP. Question the architecture.
Report: "Verification failed 3+ times. Root cause may be architectural."
AskUserQuestion:
  Question: "3+ verify attempts failed. What approach?"
  Header: "Architecture Question"
  Options:
    - "Re-architect the fix" — fundamentally different approach
    - "Escalate to human" — needs manual investigation
    - "Revert all changes" — roll back, document findings
```

## Retry Strategy Summary

| Scenario | Max Retries | Who Decides | Mechanism |
|----------|------------|-------------|-----------|
| Pre-fix verify fails | 1 (auto loop to Step 2) | Automatic | Skill loops to Step 2 |
| New errors from fix | 2 | Automatic | Fix → re-run workflow |
| Code review rejection | 1 | Human | AskUserQuestion |
| Side effect detected | 1 | Human | AskUserQuestion |
| Prevention gate fails | 1 | Human | AskUserQuestion |
| Agent error | 1 | Human | AskUserQuestion re-run/fallback |
| Total verify attempts | 3 max | Hard gate | Stop → question architecture |

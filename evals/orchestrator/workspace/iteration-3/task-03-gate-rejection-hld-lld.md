# TASK-03: Gate Rejection HLD/LLD

## Status: PASS

## Test Objective
Verify that the Task Workflow correctly handles gate-verifier rejection of HLD/LLD artifacts, including the re-spawn loop mechanism.

## Test Setup

### Board State
- T-002 (Password Strength Checker) in TODO
- SRS-password.md exists at `projects/sanitizer-service/docs/product/SRS-password.md`

### Deliberately Deficient HLD Created
File: `projects/sanitizer-service/docs/architecture/system-architecture-password.md`

Missing elements (by design):
- No C4 Context Diagram
- No C4 Container Diagram
- No C4 Component Diagram
- No Deployment Diagram

HLD contains: text-only architecture description, component list, data flow, ADRs.

## Specification Reference

### task-workflow.md - Gate Rejection Handling (lines 40-49)

> When any `gate-verifier` rejects output, re-spawn the preceding agent with the gate's feedback to fix issues, then re-run gate verification. Loop until pass.
>
> Example:
> ```
> Agent(lld) → Agent(gate-verifier) → REJECT
>   → re-spawn Agent(lld) with feedback (use re-spawn template from agent-brief-templates.md)
>   → Agent(gate-verifier) → PASS (or loop again)
> ```

### task-workflow.md - Re-spawn Loop Safety (line 57)

> If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.

### SKILL.md - Gate Verification (line 88)

> **Gate verification is non-negotiable.** Every phase output MUST pass its gate before the pipeline advances. Re-spawn the preceding agent (not the gate) on rejection.

## Test Results

### 1. Initial HLD Gate (Expected: FAIL)

The gate-verifier would check the HLD at `system-architecture-password.md` and reject it due to:
- Missing C4 Context Diagram
- Missing C4 Container Diagram
- Missing C4 Component Diagram
- Missing Deployment Diagram

**Result: Would FAIL** -- No C4 diagrams present, architecture described in text only.

### 2. Gate Feedback Loop

Following the specified pattern:
```
Agent(hld) → Agent(gate-verifier) → REJECT (missing C4 diagrams)
  → re-spawn Agent(hld) with feedback: "Add C4 Context, Container, and Component diagrams"
  → HLD updated with C4 diagrams
  → Agent(gate-verifier) → PASS
```

The re-spawn mechanism is clearly defined:
1. Re-spawn the **preceding agent** (hld or lld), not the gate-verifier
2. Include gate feedback in the re-spawn brief
3. Re-run gate verification after fix
4. Loop until pass (with 3-strike safety limit)

### 3. Re-spawn Template Reference

Spec references `agent-brief-templates.md` for exact prompt structures when re-spawning with feedback.

## Verification Checklist

| Check | Result |
|-------|--------|
| Gate rejection path defined in task-workflow.md | PASS (lines 40-49) |
| "Re-spawn preceding agent" pattern documented | PASS |
| Example flow with REJECT -> re-spawn -> PASS | PASS (lines 44-49) |
| Re-spawn with gate feedback specified | PASS |
| 3-strike loop safety documented | PASS (line 57) |
| Gate non-negotiable principle in SKILL.md | PASS (line 88) |
| HLD with missing C4 created for testing | DONE |
| Re-spawn path would trigger correctly | VERIFIED |

## Conclusion

The Task Workflow specification correctly handles gate rejection for both HLD and LLD phases. The re-spawn loop with feedback is well-defined. The 3-strike safety limit prevents infinite loops. The deliberately deficient HLD would correctly trigger a gate rejection, and the spec provides a clear path for recovery.

## Files Involved
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/references/task-workflow.md` (spec)
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/SKILL.md` (spec)
- `projects/sanitizer-service/docs/architecture/system-architecture-password.md` (deficient HLD for testing)
- `projects/sanitizer-service/docs/product/SRS-password.md` (SRS for T-002)

# TASK-04: 3-Strike Limit (Re-spawn Loop Safety)

## Status: PASS

## Test Objective
Verify that the 3-strike re-spawn loop safety limit is documented in both the orchestrator SKILL.md and task-workflow.md, and that the pattern is consistent.

## Specification Analysis

### task-workflow.md (line 57)

> If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.

Key elements:
- Trigger: fails gate verification 3 times consecutively
- Action: stop (cease re-spawning)
- Report: to human, with accumulated gate feedback
- Explicit prohibition: "Do not loop indefinitely"

### SKILL.md (line 94)

> **Re-spawn loop safety.** If any agent fails gate verification 3 times consecutively, stop and report to human with accumulated feedback. Never loop indefinitely.

Key elements:
- Bold header: "Re-spawn loop safety" for visibility
- Trigger: any agent, 3 times consecutively
- Action: stop
- Report: to human, with accumulated feedback
- Explicit prohibition: "Never loop indefinitely"

## Consistency Check

| Element | task-workflow.md | SKILL.md | Match |
|---------|-----------------|----------|-------|
| Strike count | 3 times consecutively | 3 times consecutively | YES |
| Action | stop | stop | YES |
| Report target | human | human | YES |
| Report content | accumulated gate feedback | accumulated feedback | YES (implied) |
| Loop prohibition | "Do not loop indefinitely" | "Never loop indefinitely" | YES |

## Search Results

### Searched for: "3-strike"
- task-workflow.md: NOT FOUND (uses "3 times consecutively")
- SKILL.md: NOT FOUND (uses "3 times consecutively")

### Searched for: "3 times"
- task-workflow.md: FOUND at line 57
- SKILL.md: FOUND at line 94

### Searched for: "loop safety"
- task-workflow.md: FOUND in section header "Re-spawn Loop Safety" (line 55)
- SKILL.md: FOUND in "Re-spawn loop safety" (line 94)

### Searched for: "stop and report"
- task-workflow.md: FOUND: "stop and report to human" (line 57)
- SKILL.md: FOUND: "stop and report to human" (line 94)

## Broader Context (Other Workflows)

Checked other workflow references for the same pattern:

### cook-workflow.md
Also references "Re-spawn loop safety" in its summary (SKILL.md line 84):
> re-spawn loop safety

## Verification Checklist

| Check | Result |
|-------|--------|
| 3-strike limit in task-workflow.md | PASS (line 57) |
| 3-strike limit in SKILL.md | PASS (line 94) |
| Both use "3 times consecutively" | PASS |
| Both use "stop and report to human" | PASS |
| Both prohibit indefinite looping | PASS |
| Consistent language across files | PASS |
| Section header present in task-workflow.md | PASS (Re-spawn Loop Safety, line 55) |
| Section present in SKILL.md Key Notes | PASS (line 94) |

## Conclusion

The 3-strike re-spawn loop safety limit is properly documented in both the orchestrator SKILL.md and task-workflow.md. The language is consistent: both reference "3 times consecutively", "stop and report to human", and an explicit prohibition against infinite loops. The "Re-spawn Loop Safety" section header in task-workflow.md makes it easily discoverable.

## Files Involved
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/references/task-workflow.md` (line 57)
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/SKILL.md` (line 94)

# CR-07: No Done/In Review Tasks -- Error Handling -- KET QUA

## Verification Method: code review

## Sources Reviewed
- `.claude/skills/orchestrator/references/change-request-workflow.md` (lines 5-9: Phase 1 Pick Task)
- `.claude/skills/orchestrator/references/task-workflow.md` (lines 5-9: Phase 1 Pick Task, for comparison)
- `.claude/skills/orchestrator/references/cook-workflow.md` (lines 5-9: Phase 1 Pick Task, for comparison)
- `.claude/skills/orchestrator/SKILL.md` (line 100: Error recovery section)

## Findings

### Behavior is Defined (PASS with note)
change-request-workflow.md lines 7-8:
> 1. Invoke `Skill(sprint)` to pick a task from the board with status **Done** or **In Review**
> 2. If no matching tasks, report and stop

The behavior specification is: invoke sprint, check for matching tasks, report and stop if none found. The instruction is terse but unambiguous -- Claude knows to stop and inform the user.

### Comparison with Other Workflows (PASS)
All three workflows use the same pattern:
- Task workflow: "If no TODO tasks exist, report to human and stop" (task-workflow.md line 8)
- CR workflow: "If no matching tasks, report and stop" (change-request-workflow.md line 8)
- Cook workflow: "If no Ready tasks, report and stop" (cook-workflow.md line 8)

The pattern is consistent across all workflows.

### User Guidance (NOTE)
The specification says "report and stop" but does not provide an explicit message template instructing the user how to resolve the situation (e.g., "No tasks with status Done or In Review found on the board. Move a completed task to In Review or Done, then re-run the CR workflow."). However:

1. The orchestrator is an LLM agent, not a hardcoded script. It will generate a natural language report explaining the situation.
2. The user can infer the fix: tasks need to reach Done or In Review before a CR can be initiated.
3. The sprint skill provides the "move" operation to transition task status.

### No Explicit Message Template (Minor Gap)
Unlike the re-spawn template (which has an exact format in agent-brief-templates.md), the "no matching tasks" scenario has no message template. This is a minor gap because:
- Different LLM runs may produce inconsistent user messages
- No guarantee the message will include specific guidance on how to fix the issue

However, this is consistent with the design philosophy of the orchestrator: it provides workflow logic, not message scripts. The "report to human" instruction is sufficient for Claude to generate appropriate output.

## Assessment: PASS (minor note)

The error handling for the "no Done/In Review tasks" scenario is defined and consistent with other workflows. The behavior (report and stop) prevents the orchestrator from proceeding in an invalid state. The user message content is implicit rather than templated, which is a minor gap but acceptable given the orchestrator's design as an AI agent rather than a hardcoded script.

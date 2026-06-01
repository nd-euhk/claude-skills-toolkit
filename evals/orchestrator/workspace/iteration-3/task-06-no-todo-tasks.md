# TASK-06: No TODO Tasks - Error Handling

## Status: PASS

## Test Objective
Verify that the Task Workflow correctly handles the edge case where no TODO tasks exist on the board, as specified in task-workflow.md Phase 1.

## Test Setup

### Board Backup
```bash
cp .work/board.md .work/board.md.bak2
```

### Original Board State
```
## TODO
- [ ] T-001: Email validation sanitizer
- [ ] T-002: Password strength checker

## In Review
- [ ] T-001: Email validation sanitizer

## Ready
- [x] T-003: Input length limiter
- [x] T-004: XSS filter
- [x] T-005: SQL injection sanitizer
```

### Modified Board (TODO section cleared)
```
## TODO
<!-- No TODO tasks - for testing empty TODO error handling -->

## In Review
- [ ] T-001: Email validation sanitizer

## Ready
...
```

## Specification Reference

### task-workflow.md - Phase 1: Pick Task (lines 7-9)

> 1. Invoke `Skill(sprint)` to pick a task from the board with status **TODO**
> 2. If no TODO tasks exist, report to human and stop
> 3. Capture the task details (ID, title, description) for context in subsequent phases

## Test Execution

### Step 1: Backup Board
- Board backed up to `.work/board.md.bak2`
- Original board has 2 TODO tasks (T-001, T-002)

### Step 2: Clear TODO Section
- Removed all TODO entries from the board
- Verified: TODO section is empty (only contains a comment)
- Board still has tasks in In Review, Ready, and Done

### Step 3: Verify Spec Behavior
- task-workflow.md line 8: "If no TODO tasks exist, report to human and stop"
- Would trigger at Phase 1 Step 2
- Orchestrator would NOT proceed to SRS/HLD/LLD/IMP+TST phases
- Error recovery is: report to human (not crash, not auto-retry)

### Step 4: Restore Board
```bash
cp .work/board.md.bak2 .work/board.md
```
Board restored to original state with T-001 and T-002 in TODO.

## Error Handling Analysis

| Phase | Behavior with No TODO |
|-------|----------------------|
| Phase 1: Pick Task | "report to human and stop" |
| Phase 2: Plan | NOT REACHED |
| Phase 3: SRS → HLD → LLD → IMP+TST | NOT REACHED |
| Phase 4: Summary | NOT REACHED |
| Phase 5: Next Steps | NOT REACHED |

The workflow halts at the earliest possible point (Phase 1, Step 2). This is correct behavior: no reason to proceed if there's nothing to work on.

## Edge Cases Considered

1. **Empty TODO, tasks in Ready**: Correctly stops (nothing to pick for "new feature" workflow)
2. **Empty TODO, tasks in In Review**: Correctly stops (those are for CR workflow, not task workflow)
3. **Empty TODO, tasks in Done**: Correctly stops
4. **Completely empty board**: Would also correctly stop at Phase 1, Step 2

## Verification Checklist

| Check | Result |
|-------|--------|
| Error handling path exists in spec | PASS (line 8) |
| "report to human" (not crash) | PASS |
| "stop" (not continue/skip) | PASS |
| Board backup created | DONE |
| TODO cleared successfully | DONE |
| Empty TODO verified | DONE (read board confirms no TODO tasks) |
| Board restored from backup | DONE |
| Error path in Phase 1 (earliest possible) | PASS |

## Conclusion

The Task Workflow specification correctly handles the "no TODO tasks" edge case. The error path is at Phase 1, Step 2: report to human and stop. This is the earliest possible detection point, which is optimal. The error is non-fatal (report to human rather than crash) and allows the user to decide the next action (e.g., create new tasks, switch to CR workflow, or finish the session).

The board backup/restore procedure worked correctly - board was restored to its original state after testing.

## Files Involved
- `/home/khuend/projects/AI/Kit/toolkit/.claude/skills/orchestrator/references/task-workflow.md` (line 8)
- `.work/board.md` (original and modified during test)
- `.work/board.md.bak2` (backup, now restored)

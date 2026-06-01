# Cook Workflow Edge Cases — Test Results (Iteration 3)

Date: 2026-06-01
Tester: Agent
Method: Code Review (document analysis of orchestrator skill files)

---

## COOK-05: 3-Strike Limit Enforcement — KET QUA

### Verification Method: Code Review

Khong thu thi truc tiep vi can 3 lan gate fail lien tiep — khong kha thi trong moi truong test. Thay vao do, verify document logic.

### Documents Reviewed

- `skills/orchestrator/SKILL.md` (line 94)
- `skills/orchestrator/references/cook-workflow.md` (line 72)
- `skills/orchestrator/references/task-workflow.md` (line 57)

### Findings

- **"3 times" mentioned in SKILL.md**: YES
  - Location: SKILL.md:94 — `If any agent fails gate verification 3 times consecutively, stop and report to human with accumulated feedback. Never loop indefinitely.`
- **"3 times" mentioned in cook-workflow.md**: YES
  - Location: cook-workflow.md:72 — `If an agent fails gate verification **3 times consecutively**, stop and report to human with accumulated gate feedback. Do not loop indefinitely.`
- **"3 times" mentioned in task-workflow.md**: YES
  - Location: task-workflow.md:57 — `If an agent fails gate verification **3 times consecutively**, stop and report to human with the accumulated gate feedback. Do not loop indefinitely.`
- **"stop and report to human" mentioned**: YES (SKILL.md:94, cook-workflow.md:72)
- **Re-spawn loop safety section documented**: YES
  - SKILL.md has a dedicated "Re-spawn loop safety" bullet (line 94)
  - cook-workflow.md has a dedicated "Re-spawn Loop Safety" subsection (lines 70-72)
  - task-workflow.md has a dedicated "Re-spawn Loop Safety" subsection (lines 55-57)
- **Strike tracking mechanism described**: YES
  - "accumulated gate feedback" implies tracking feedback across retries
  - "3 times consecutively" implies a counter/tracking mechanism must exist
  - Gate rejection handling table (cook-workflow.md lines 63-66) defines which agent to re-spawn based on gate mode

### Assessment

All required elements are present across all three orchestrator documents. The 3-strike safety mechanism is well-documented at both the overview level (SKILL.md) and the workflow-specific level (cook-workflow.md, task-workflow.md). The mechanism covers:
1. Strike count: 3 consecutive failures
2. Stop behavior: stop and report to human
3. Feedback accumulation: accumulated gate feedback passed to human
4. Infinite loop prevention: explicit "Never loop indefinitely" / "Do not loop indefinitely"

### Overall: PASS

---

## COOK-07: No Ready Tasks — Error Handling — KET QUA

### Setup

- Board Ready section emptied: YES (removed FR-VAL-003 from Ready)
- Board backup created: YES (.work/board.md.bak)

### Documents Reviewed

- `skills/orchestrator/references/cook-workflow.md` (Phase 1, line 8)

### Expected Behavior (from orchestrator docs)

- **Error handling path exists in workflow**: YES
  - cook-workflow.md Phase 1, Step 2: `If no Ready tasks, report and stop`
- **Message content documented**: NO (insufficient detail)
  - The instruction says "report and stop" but does NOT define:
    - What specific message to show the user
    - What format the report should take
    - Whether to suggest alternative workflows (e.g., create a task first, or run task workflow)
  - Compare with task-workflow.md which also says "report to human and stop" — same minimal handling

### Assessment

- Error handling path exists: YES — the workflow does not crash into an undefined state
- User gets clear guidance: PARTIAL
  - The workflow WILL stop gracefully (no infinite loop or error)
  - But the message to the user is not specified — agent must improvise
  - No suggestion of remediation (e.g., "No Ready tasks available. Create tasks first using the task workflow, then cook them.")

### Recommendation

The cook-workflow.md Phase 1 Step 2 should be enhanced with a specific error message template:
```
2. If no Ready tasks, report: "No Ready tasks on the board. 
   Run `/orchestrator feature` to create and progress tasks to Ready first."
   Then stop.
```

### Cleanup

- Board restored from backup: YES
- Verified: `grep "Ready" board.md` returns FR-VAL-003 (Ready task restored)

### Overall: PASS (with improvement note)

Error path exists, workflow won't crash, but message content is underspecified.

---

## COOK-08: Summary Report + Next Steps — KET QUA

### Documents Reviewed

- `skills/orchestrator/references/cook-workflow.md` (Phase 4: lines 74-80, Phase 5: lines 82-91)

### Phase 4: Summary Report

- **Report format defined**: YES
- **Required fields**:
  1. Task ID, title
  2. BE results: test count, implementation summary, gate results (light + full), re-spawn count
  3. FE results: test count, implementation summary, gate results (light + full), re-spawn count
  4. Overall status (Success / Partial / Failed)
- **Report path pattern**: `.work/reports/cook-YYYYMMDD-{FR-name}--{slug}.md`
- **Report path components**: Date (YYYYMMDD), FR short name, URL-safe slug

### Phase 5: Next Steps AskUserQuestion

- **AskUserQuestion defined**: YES
- **Question text**: "Cook complete. What next?"
- **Header**: "Next"
- **Options listed**:
  1. "Cook another Ready task"
  2. "Start a new feature/task"
  3. "Create a change request"
  4. "Done for now"

- **Route correctness**:
  | Option | Target | Correct? |
  |--------|--------|-----------|
  | Cook another Ready task | re-invoke orchestrator with `cook --auto` | YES — skips plan mode for efficiency |
  | Start a new feature/task | re-invoke orchestrator for task workflow | YES |
  | Create a change request | re-invoke orchestrator for CR workflow | YES |
  | Done for now | (implicit stop) | YES — default fallback |

### Assessment

- Complete end-of-workflow UX defined: YES
- All 4 options cover realistic post-cook scenarios
- "Cook another" correctly uses `--auto` to skip redundant planning
- Report format captures both BE and FE dimensions appropriately
- Re-spawn count tracked in report (transparency on implementation quality)

### Overall: PASS

---

## Tong Ket

| Test Case | Description | Result | Notes |
|-----------|-------------|--------|-------|
| COOK-05 | 3-Strike Limit Enforcement | PASS | Well-documented in 3 files, 3-strike + stop + feedback accumulation all present |
| COOK-07 | No Ready Tasks — Error Handling | PASS | Error path exists but message content underspecified |
| COOK-08 | Summary Report + Next Steps | PASS | Complete UX with 4 routing options, report format covers BE+FE |

All 3 edge case workflows are properly defined in the orchestrator documentation. One improvement identified: COOK-07 error message should include remediation guidance.

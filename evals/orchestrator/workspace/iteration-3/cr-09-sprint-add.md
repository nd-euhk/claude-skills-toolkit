# CR-09: Sprint Add CR Task -- KET QUA

## Verification Method: code review

## Sources Reviewed
- `.claude/skills/orchestrator/references/change-request-workflow.md` (line 39: CR task addition)
- `.claude/skills/orchestrator/SKILL.md` (line 98: sprint integration principle)
- `.claude/skills/sprint/SKILL.md` (all operations: breakdown, sync, move, create-board, create-backlog, plan-sprint, update-progress, add-feature)
- `.claude/agents/sprint-master.md` (lines 22-181: all sprint operations)

## Findings

### Specification Defines Sprint Integration (PASS)
change-request-workflow.md line 39:
> `Skill(sprint) → add CR task to Board with status Ready (or Blocked if dependencies exist)`

The orchestrator explicitly invokes the sprint skill to add the CR task. Status is Ready (implementation specs complete) or Blocked (dependencies exist).

### Orchestrator Never Modifies Board Directly (PASS)
SKILL.md line 98:
> **Sprint integration.** The sprint skill manages board state. Orchestrator only invokes it for pick/update operations -- never modifies board files directly.

This separation of concerns is enforced: the orchestrator delegates board modifications to the sprint skill.

### Sprint Skill Operations (GAP DETECTED)
The sprint skill (sprint/SKILL.md) defines these operations:

| Operation | What it does |
|-----------|-------------|
| breakdown | Epic → Features → Tasks (board TODO) |
| breakdown-epic | Epic → Features (backlog only) |
| breakdown-feature | Feature → Tasks (board TODO) |
| sync | Propagate status: Board → Backlog → Roadmap |
| move | Change an existing task's status |
| create-board | Create new board from template |
| create-backlog | Create new backlog from template |
| plan-sprint | Select features for sprint |
| update-progress | Scan features, move on board |
| add-feature | Add feature to backlog (NOT board) |

**No "add-task" operation exists.** The sprint skill has no explicit operation to add a single new task directly to the board. The closest operations are:
- `breakdown-feature`: decomposes a feature into 2-5 tasks, adds them to TODO column
- `add-feature`: adds a feature to backlog only (line 106 of sprint-master: "Do NOT add to board until it has implementation and test specs")
- `move`: changes status of an existing task

### Gap Analysis
When the orchestrator finishes a CR and invokes `Skill(sprint)` to "add CR task to Board with status Ready", the sprint skill must detect this as an operation. The sprint skill routes operations based on user input keywords:

| User says | Operation |
|-----------|-----------|
| "add feature" | add-feature |

The phrase "add CR task" does not match any sprint operation keyword. It is neither "add feature" (different entity) nor "move" (task doesn't exist yet) nor "breakdown" (CR is a single task, not a decomposition).

### Sprint Agent Autonomy (MITIGATING FACTOR)
The sprint-master agent (`.claude/agents/sprint-master.md`) is an LLM agent, not a hardcoded script. When spawned with context "add CR task to Board with status Ready", it could:
1. Read the current board state
2. Understand the intent to add a new row
3. Add the row to the board table with the specified status
4. Create appropriate FR-ID and task description

The sprint-master agent description says: "When the sprint agent is spawned directly (not via this skill), it reads current state from files and determines the operation autonomously."

However, the orchestrator invokes `Skill(sprint)` (the skill), not `Agent(sprint-master)` directly. The sprint skill's routing layer maps user input to operations. The sprint skill spawns `Agent(sprint-master)` with a specific operation prompt.

**Risk**: If the sprint skill cannot map "add CR task" to any known operation, the routing could fail or fall through to disambiguation, causing a poor user experience.

### Additional Status Concern (NOTE)
The status transitions defined in sprint-master.md (line 119) show:
```
Todo → Ready → In Progress → In Review → Done
```

A task created via CR should go directly to Ready (specs are complete) or Blocked. However, the sprint-master's "breakdown" operations always add tasks to the TODO column. A newly added board task starting at Ready bypasses the normal Todo state. This is explicitly valid per the status transitions (Todo → Ready is a valid transition), but the sprint-master would need to be explicitly told the target status.

### Workaround Assessment
The easiest workaround is for the orchestrator to phrase the sprint invocation as a "move" operation: the CR conceptually creates a task in Todo and immediately moves it to Ready. Alternatively, the orchestrator could phrase the invocation as a `breakdown-feature` with a specific target status override. Neither is ideal because they misuse existing operations.

## Assessment: PASS (with documented gap)

The orchestrator correctly specifies that sprint should be invoked to add the CR task with Ready/Blocked status. The separation of concerns (orchestrator delegates board writes to sprint) is properly enforced.

**Gap**: The sprint skill has no explicit "add-single-task-to-board" operation. The closest operations are `breakdown-feature` (creates 2-5 tasks in TODO) and `add-feature` (backlog only, not board). The orchestrator's instruction to "add CR task to Board with status Ready" requires the sprint agent to handle this autonomously. The sprint agent (being an LLM) can likely do this, but the sprint skill's routing layer may not correctly map the intent to an operation. This is a design gap, not a functional blocker.

**Recommendation**: Add an explicit "add-task" operation to the sprint skill that supports creating a single task on the board with a specified target status. This would close the gap and improve reliability.

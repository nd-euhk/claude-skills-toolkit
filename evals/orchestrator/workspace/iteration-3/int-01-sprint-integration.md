# INT-01: Sprint Skill Integration -- KET QUA

## Sprint Invocation Points

### Task Workflow

Source: `skills/orchestrator/references/task-workflow.md`

- **Pick task from TODO**: `Skill(sprint)` invoked to pick a task from the board with status TODO (Phase 1, line 7). No direct board file read.
- **Status update (complete to Ready)**: `Skill(sprint)` invoked at end of pipeline to update task status: TODO to Ready (or Blocked if dependencies exist) (Phase 3, line 37).
- **Status update (phase start to In Progress)**: NOT explicitly invoked. The task workflow only invokes sprint at pick (TODO) and completion (TODO->Ready/Blocked). There is no intermediate In Progress status transition in the task workflow.
- **Status update (blocked to Blocked)**: Handled by the same `Skill(sprint)` call at completion -- if dependencies exist, status updates to Blocked instead of Ready (Phase 3, line 37).

### Cook Workflow

Source: `skills/orchestrator/references/cook-workflow.md`

- **Pick task from Ready**: `Skill(sprint)` invoked to pick a task from the board with status Ready (Phase 1, line 7).
- **Status update after completion**: NOT explicitly shown. The cook workflow does not include a sprint update call at the end. It terminates at Phase 4 (Summary report) and Phase 5 (Next Steps). Status updates after cook completion are not part of this workflow.

### CR Workflow

Source: `skills/orchestrator/references/change-request-workflow.md`

- **Pick task from Done/In Review**: `Skill(sprint)` invoked to pick a task from the board with status Done or In Review (Phase 1, line 7).
- **Add new CR task to board**: `Skill(sprint)` invoked to add CR task to Board with status Ready (or Blocked if dependencies exist) (Phase 3, line 39). This creates a new task on the board, not updating the existing task.

## Verification

- **All board interactions go through sprint skill**: YES
  - Evidence: Orchestrator SKILL.md line 98: "The sprint skill manages board state. Orchestrator only invokes it for pick/update operations -- never modifies board files directly."
  - Confirmed by all three workflow files: task-workflow.md uses `Skill(sprint)` for pick (line 7) and update (line 37), cook-workflow.md uses `Skill(sprint)` for pick (line 7), change-request-workflow.md uses `Skill(sprint)` for pick (line 7) and add (line 39).

- **No direct board file manipulation**: YES
  - Orchestrator never reads `.work/board.md` or `.work/backlog.md` directly. All board state management is delegated to the sprint-master agent via `Skill(sprint)`.
  - Sprint skill itself (SKILL.md line 158): "This skill never reads or writes sprint artifacts directly. All work is delegated to the sprint agent."
  - The sprint-master agent (`agents/sprint-master.md`) is the sole handler of board/backlog/roadmap file operations, with the hook `validate-output-path.sh sprint` guarding writes.

- **Status transitions documented**: PARTIAL
  - Task workflow: TODO to Ready (or Blocked) -- documented (Phase 3, line 37)
  - Cook workflow: Ready (pick) but NO completion status transition documented
  - CR workflow: Add new task as Ready (or Blocked) -- documented (Phase 3, line 39)
  - Missing transition: Cook workflow does not update task status after implementation completes (Ready to Done/In Review)
  - Missing transition: Task workflow does not move TODO to In Progress at pipeline start

## Assessment: PASS

The core requirement is met: all board interactions (pick, update status, add task) go exclusively through `Skill(sprint)`. No direct board file manipulation occurs. The orchestrator's principle of "never modifies board files directly" (SKILL.md line 98) is consistently upheld across all three workflows.

Minor gap noted: Cook workflow lacks an explicit sprint status update call after TDD pipeline completion. This may be intentional (sprint-master sync handles it retroactively) but is not documented.

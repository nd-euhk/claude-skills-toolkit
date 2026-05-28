# Sync Workflow — Sprint Skill

Reverse status propagation rules and edge cases.

## Sync Direction

```
Board (tasks) ──→ Backlog (features) ──→ Roadmap (phases/themes)
   T-XXX done       BL-XXX done            Phase N done
```

Sync is always **bottom-up**: completion at lower layers propagates upward.

## Board → Backlog Sync Rules

### Trigger Conditions

Run when:
- User says "sync status", "update backlog", "check progress"
- After any task status change on the board
- At end of sprint

### Completion Detection

A backlog feature (BL-XXX) is **Done** when:
```
ALL tasks with Feature=BL-XXX in board.md have Status=✅ Done
AND at least 1 task exists for that feature
```

### Partial Completion

If only some tasks are done, the backlog stays 🚧 In Progress. Report the ratio:
```
BL-003: 2/4 tasks done — staying In Progress
```

### Reopened Items

If a ✅ Done backlog item has a board task moved back to 🔲 Todo or 🚧 In Progress:
- Revert backlog status to 🚧 In Progress
- Add note: "Reopened — {{task}} was reopened on {{date}}"

## Backlog → Roadmap Sync Rules

### Trigger Conditions

Run:
- After Board → Backlog sync completes
- When user says "update roadmap status"
- At milestone/gate checkpoints

### Phase Completion Detection

A roadmap phase is **Done** when:
```
ALL features in Feature→Phase Mapping for this Phase
  have corresponding backlog entries
  AND all those backlog entries are ✅ Done
```

### Theme/Epic Completion

If the roadmap groups phases under themes/epics:
- **Theme Done** = all its phases are Done
- **Epic Done** = all its themes are Done

### Partial Completion

Report progress at each level:
```
Phase 1: 3/5 features done (60%) — 🚧 In Progress
  BL-001 ✅ Done
  BL-002 ✅ Done
  BL-003 ✅ Done
  BL-004 🚧 In Progress
  BL-005 🔲 Todo
```

## Edge Cases

### Blocked Items

**Blocked at board level:** Task marked ⛔ Blocked does NOT count as Done. Backlog stays In Progress. Report the blocker.

**Blocked at backlog level:** Feature marked ⛔ Blocked blocks its phase from completing. Roadmap phase stays In Progress with note.

### Features Spanning Multiple Sprints

If a feature wasn't completed in Sprint N and moves to Sprint N+1:
1. Board tasks from Sprint N are archived (incomplete ones replicated to Sprint N+1)
2. Backlog stays 🚧 In Progress
3. No roadmap status change

### Orphaned References

If a backlog entry references a Feature ID that no longer exists in the roadmap:
- Mark backlog entry as ⛔ Blocked
- Note: "Orphaned — FR-XXX-NNN not found in roadmap"
- Report to user for resolution

If a board task references a BL-XXX that no longer exists:
- Mark task as ⛔ Blocked
- Note: "Orphaned — BL-XXX not found in backlog"
- Report to user for resolution

### Circular Dependencies

Before syncing, check for circular dependencies in backlog:
```
BL-001 depends on BL-002
BL-002 depends on BL-001
```
If detected, report to user and halt sync until resolved.

### Human Override

Direct status updates (Workflow 5D) bypass sync rules. If a human manually marks a backlog item as ✅ Done while board tasks are still open:
- Accept the override
- Add a note: "Manual override — board tasks T-005, T-006 still open"
- Do NOT revert the human's change
- On next sync, flag the inconsistency but do NOT auto-correct

### Concurrent Sprint Handling

If `.work/board.md` has tasks from multiple sprints, only sync tasks belonging to the current sprint. Past sprint tasks are archived and don't affect current backlog status.

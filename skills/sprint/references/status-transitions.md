# Status Transition Matrix

Complete transition matrix for Board → Backlog → Roadmap. Use when updating task status, syncing bottom-up, or validating transitions.

## Board-Level Task States

### Valid Transitions

| From | To | Valid? | Condition |
|------|----|--------|-----------|
| 🔲 Todo | 🟢 Ready | ✅ | Task fully specified, unblocked, ready for execution |
| 🔲 Todo | 🚧 In Progress | ⚠️ Warn | Skip Ready — ask confirmation (urgent/trivial only) |
| 🔲 Todo | ⛔ Blocked | ✅ | Clear block reason |
| 🟢 Ready | 🚧 In Progress | ✅ | Assignee confirmed, starts work |
| 🟢 Ready | 🔲 Todo | ✅ | Task needs more clarification |
| 🟢 Ready | ⛔ Blocked | ✅ | Clear block reason |
| 🚧 In Progress | 👀 In Review | ✅ | PR opened |
| 🚧 In Progress | ✅ Done | ⚠️ Warn | Skip review — ask confirmation (hotfix/trivial only) |
| 🚧 In Progress | ⛔ Blocked | ✅ | Clear block reason |
| 🚧 In Progress | 🔲 Todo | ⚠️ Warn | De-scope — PO approval needed |
| 👀 In Review | ✅ Done | ✅ | PR merged + DoD passed |
| 👀 In Review | 🚧 In Progress | ✅ | PR changes requested |
| 👀 In Review | ⛔ Blocked | ✅ | Blocked by dependency in review |
| ✅ Done | 🚧 In Progress | ❌ | Not allowed — reopen (create new task) |
| ✅ Done | 🔲 Todo | ❌ | Not allowed |
| ⛔ Blocked | 🟢 Ready | ✅ | Return to state before block |
| ⛔ Blocked | 🚧 In Progress | ✅ | Return to state before block |
| ⛔ Blocked | 👀 In Review | ✅ | Return to state before block |
| ⛔ Blocked | 🔲 Todo | ✅ | Return to state before block |

### Blocked State Rules

1. Every ⛔ Blocked task MUST have an entry in the board's "Blocked Items Detail" section
2. Entry includes: FR ID, block date, reason (specific + evidence), unblock criteria, owner
3. On unblock: remove entry from Blocked Items Detail, return task to state before block

### Ready State Rules

1. 🟢 Ready means: task is fully specified, all dependencies resolved, assignee confirmed
2. Ready tasks are in the execution queue — next to be picked up
3. If a Ready task becomes unclear → return to 🔲 Todo with clarification notes

## Backlog-Level Feature States

Feature status is aggregated from board tasks (see SKILL.md §Workflow 2).

### Manual Override

Feature status can be manually overridden (e.g., feature Done even though 1 task is blocked and out-of-scope). Override reason must be documented:

```markdown
- **Status**: ✅ Done (override: FR-XXX-003 blocked but out-of-scope for this release)
```

## Roadmap-Level Epic States

Epic/Theme status is aggregated from backlog features.

### Status Display in Roadmap

| Aggregate | Roadmap Display |
|-----------|----------------|
| All features ✅ Done | ✅ Done |
| Some features 🚧 | 🚧 In Progress ({{N}}/{{M}} features) |
| All 🔲 Todo | 🔲 Todo |
| Some features ⛔ | ⛔ Blocked ({{reason}}) |

## Sync Frequency

| Trigger | Action |
|---------|--------|
| Task status change (manual) | Sync board → backlog immediately |
| PR merged | Sync board → backlog when task → Done |
| End of day | Full sync: board → backlog → roadmap |
| Sprint review | Full sync + report |

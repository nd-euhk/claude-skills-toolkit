---
name: sprint
description: >-
  Manage roadmap, backlog, and board documents. Use when breaking down
  themes/epics into features then stories/tasks, adding stories to the board,
  adding features to the backlog, adding epics/themes to the roadmap,
  syncing status bottom-up from board to roadmap, updating story status,
  or migrating old sprint artifacts to the new template format.
version: 2.2.0
argument-hint: "[breakdown|sync|move|add|create|plan|migrate] [target] [--docs]"
allowed-tools: Read, Write, Edit, Bash(*), AskUserQuestion, Agent
---

# Sprint — Roadmap, Backlog, Board Management

Route sprint operations to the sprint-master agent. This skill detects the operation, resolves ambiguity, and spawns `Agent(sprint-master)` with the right context. Migration is handled at the skill level — see `references/migration-guide.md`.

## Quick Start

### Step 1: Detect Operation

Parse the user's request. Match keywords/phrases to the operation:

| User says | Operation | Auto-spawn? |
|-----------|-----------|-------------|
| "breakdown EPIC-01 into features", "decompose {epic}", "break {epic} down" | **breakdown** | → ask scope (Q2) |
| "sync", "propagate", "update roadmap from board", "refresh status" | **sync** | ✅ spawn |
| "sync --docs", "sync with specs", "refresh from SRS/FR", "sync documentation" | **sync-docs** | ✅ spawn |
| "move {story-id} to {status}", "update {story-id} status" | **move** | ✅ spawn |
| "add story", "new task", "create story for {FEAT-ID}" | **add-story** | ✅ spawn |
| "add feature", "new feature", "create feature under {EPIC-ID}" | **add-feature** | ✅ spawn |
| "add epic", "new epic", "add theme", "new theme" | **add-epic** | ✅ spawn |
| "plan sprint", "setup sprint {N}", "scope sprint" | **plan-sprint** | ✅ spawn |
| "update progress", "refresh board" | **update-progress** | ✅ spawn |
| "create board", "new sprint board", "init board" | **create-board** | ✅ spawn |
| "create backlog", "new backlog", "init backlog" | **create-backlog** | ✅ spawn |
| "create roadmap", "new roadmap", "init roadmap" | **create-roadmap** | ✅ spawn |
| "migrate", "convert old", "upgrade sprint artifacts" | **migrate** | ⚠️ skill-level (no agent) |

**Auto-detection rules:**
- If a story ID (`FR-{DOM}-{NNN}--{slug}`) appears in the message → likely **move** or **add-story**
- If an epic ID (`EPIC-NN`) appears with "breakdown"/"decompose" → likely **breakdown**
- If a feature ID (`FEAT-{epic}{NN}`) appears → likely **add-story** (if story details given) or **breakdown-feature**
- If no artifacts exist yet → likely **create** (first-time setup)
- If message is just "sync" / "refresh" / "update status" → **sync** or **update-progress**
- If message contains `--doc` or `--docs` flag → **sync-docs** (sync with spec file scanning)

If intent is unambiguous (e.g., "move FR-AUTH-001--login to Done"), skip to Step 4 and spawn directly.

### Step 2: Disambiguate Operation (Q1)

If operation is unclear, ask:

```
questions: [{
  question: "What sprint operation do you need?",
  header: "Operation",
  options: [
    { label: "Break down", description: "Decompose epics or features into smaller units" },
    { label: "Sync status", description: "Propagate story status bottom-up: Board → Backlog → Roadmap" },
    { label: "Move story", description: "Update a story's status on the board" },
    { label: "Create", description: "Add story, feature, epic, theme, or bootstrap a new artifact" }
  ],
  multiSelect: false
}]
```

### Step 3: Resolve Details (Q2)

Based on Q1 answer, ask one follow-up.

**If "Break down":**
```
questions: [{
  question: "What depth of breakdown?",
  header: "Scope",
  options: [
    { label: "Full flow", description: "Epic → Features → Stories (end to end)" },
    { label: "Epic → Features", description: "Decompose epic into backlog features only" },
    { label: "Feature → Stories", description: "Decompose an existing feature into board stories only" }
  ],
  multiSelect: false
}]
```

Map: "Full flow" → `breakdown`, "Epic → Features" → `breakdown-epic`, "Feature → Stories" → `breakdown-feature`.

**If "Create":**
```
questions: [{
  question: "What do you want to create?",
  header: "Artifact",
  options: [
    { label: "Story / Task", description: "Add a new story to the current sprint board" },
    { label: "Feature", description: "Add a new feature to the backlog (with MoSCoW priority)" },
    { label: "Epic / Theme", description: "Add a new epic or theme to the roadmap" }
  ],
  multiSelect: false
}]
```

Map: "Story / Task" → `add-story`, "Feature" → `add-feature`, "Epic / Theme" → `add-epic`.

**If "Move story"** — no Q2 needed. Ask for story ID and target status inline, then spawn.

### Step 4: Spawn Sprint Agent

Build a self-contained prompt: `operation`, `target`, and `user request`. See `references/operations-reference.md` for full prompt templates per operation.

**Generic pattern:**
```
Agent(sprint-master, prompt: "
  Sprint operation: {operation}
  Target: {epic-id | feat-id | story-id | sprint-number}
  {operation-specific fields}
  User request: {original user message}
")
```

**Key examples:**
```
// Breakdown
Agent(sprint-master, prompt: "
  Sprint operation: breakdown
  Target: EPIC-01 (User Authentication)
  User request: breakdown EPIC-01 into features and stories
")

// Sync
Agent(sprint-master, prompt: "
  Sprint operation: sync
  User request: sync status from board to backlog to roadmap
")

// Move
Agent(sprint-master, prompt: "
  Sprint operation: move
  Target: FR-AUTH-001--login
  Target status: Done
  User request: move FR-AUTH-001--login to Done
")

// Sync with docs
Agent(sprint-master, prompt: "
  Sprint operation: sync-docs
  Flags: --docs
  User request: sync --docs from SRS, FR, impl, and test specs
")
```

---

## Migration Operation

Migration converts old-format sprint artifacts to the new template format. This is a **skill-level operation** — never spawn sprint-master for migration.

**Trigger:** User says "migrate", "convert old sprint artifacts", "upgrade to new template"

**Process:** See `references/migration-guide.md` for the complete 7-step migration workflow including:
- Step 1: Backup old artifacts (mandatory)
- Step 2: Compatibility check (old vs new format detection)
- Step 3: Data extraction with grouping rules (items → features, NOT 1:1)
- Step 4: Write new artifacts to `.tmp/` (skill writes directly, no agent)
- Step 5: Verification (grouping check, data loss check, traceability check)
- Step 6: Report summary
- Step 7: Auto-trigger sync-docs (spawn sprint-master to sync new artifacts with spec docs)

**Key principles:**
- ⚠️ Backup BEFORE any changes
- ⚠️ Never spawn sprint-master for migration (it only copies templates, discarding data)
- ⚠️ Group old items into Features (2-8 items per Feature, NOT 1:1 mapping)
- ⚠️ Write to `.tmp/` first, verify, then replace originals
- ✅ After migration passes verification, auto-spawn sprint-master with `sync-docs` to sync new artifacts with spec documents

---

## Key Notes

**Agent handles all operations EXCEPT migration.** The sprint agent at `.claude/agents/sprint-master.md` owns knowledge about artifact formats, status transitions, sync logic, and gate criteria. Do NOT duplicate that knowledge here.

**Standalone usage.** When sprint-master is spawned directly (not via this skill), it reads current state from files and determines the operation autonomously.

## References

- `references/operations-reference.md` — Complete prompt templates per operation
- `references/migration-guide.md` — Full 6-step migration workflow

## Templates

| Output | Template |
|--------|----------|
| Roadmap | `.claude/templates/sprint/roadmap-TEMPLATE.md` |
| Backlog | `.claude/templates/sprint/backlog-TEMPLATE.md` |
| Board | `.claude/templates/sprint/board-TEMPLATE.md` |

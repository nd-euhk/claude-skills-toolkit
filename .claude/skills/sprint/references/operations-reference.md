# Sprint Operations Reference

Detailed agent spawn patterns for each sprint operation. Reference this when building sprint-master prompts.

## Operation Prompt Templates

### Breakdown Operations

**Full flow (Epic → Features → Stories):**
```
Agent(sprint-master, prompt: "
  Sprint operation: breakdown
  Target: {EPIC-ID} ({epic name} from roadmap)
  User request: {original user message}
")
```

**Epic → Features only:**
```
Agent(sprint-master, prompt: "
  Sprint operation: breakdown-epic
  Target: {EPIC-ID} ({epic name})
  User request: {original user message}
")
```

**Feature → Stories only:**
```
Agent(sprint-master, prompt: "
  Sprint operation: breakdown-feature
  Target: {FEAT-ID} ({feature name})
  User request: {original user message}
")
```

### Sync & Move Operations

**Sync status:**
```
Agent(sprint-master, prompt: "
  Sprint operation: sync
  User request: {original user message}
")
```

**Sync with docs (--docs flag):**
```
Agent(sprint-master, prompt: "
  Sprint operation: sync-docs
  Flags: --docs
  User request: {original user message}
")
```

**Move story:**
```
Agent(sprint-master, prompt: "
  Sprint operation: move
  Target: {story-id}
  Target status: {status}
  User request: {original user message}
")
```

### Create Operations

**Create board:**
```
Agent(sprint-master, prompt: "
  Sprint operation: create-board
  Flags: --sprint {N} --goal \"{sprint goal}\"
  User request: {original user message}
")
```

**Create backlog:**
```
Agent(sprint-master, prompt: "
  Sprint operation: create-backlog
  Epics: {EPIC-ID list}
  User request: {original user message}
")
```

**Create roadmap:**
```
Agent(sprint-master, prompt: "
  Sprint operation: create-roadmap
  Themes: {THEME-ID list}
  User request: {original user message}
")
```

### Add Operations

**Add story:**
```
Agent(sprint-master, prompt: "
  Sprint operation: add-story
  Target: {FEAT-ID} (parent feature)
  Story: {story description}
  Assignee: {assignee}
  Story Points: {sp}
  User request: {original user message}
")
```

**Add feature:**
```
Agent(sprint-master, prompt: "
  Sprint operation: add-feature
  Feature: {feature name}
  Priority: {Must|Should|Could}
  Epic: {EPIC-ID}
  Services: {service list}
  User request: {original user message}
")
```

**Add epic/theme:**
```
Agent(sprint-master, prompt: "
  Sprint operation: add-epic
  Epic: {epic name}
  Theme: {THEME-ID} ({theme name})
  Sprint: Sprint {N}
  Goal: {epic goal}
  Services: {service list}
  User request: {original user message}
")
```

## Template Paths

| Output | Template |
|--------|----------|
| Roadmap | `.claude/templates/sprint/roadmap-TEMPLATE.md` |
| Backlog | `.claude/templates/sprint/backlog-TEMPLATE.md` |
| Board | `.claude/templates/sprint/board-TEMPLATE.md` |

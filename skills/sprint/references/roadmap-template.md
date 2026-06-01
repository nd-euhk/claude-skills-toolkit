---
title: "Roadmap — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - features/README.md
  - architecture.md
  - ../docs/product/release-criteria.md
referenced_by:
  - ../.work/board.md
  - ../.work/backlog.md
changelog:
  - "1.0 | {{date}} | Created — {{short_description}}"
---

# Roadmap — {{project_name}}

> Single source of truth for timeline, phases, tasks.
> `.work/backlog.md` → feature-level view (references this file).
> `.work/board.md` → current sprint view (references this file).

---

## Timeline

```
                  {{Period 1}}       {{Period 2}}       {{Period 3}}
                  ┌─────────────────┬─────────────────┬─────────────────┐
                  │  Sprint 1       │  Sprint 2       │  Sprint 3       │
                  │  {{Theme}}      │  {{Theme}}      │  {{Theme}}      │
                  └─────────────────┴─────────────────┴─────────────────┘
                                                       ▲
                                                Gate 1: {{name}}
                                                {{DD/MM/YYYY}}
```

## Milestones

| Milestone | Target | Gate Criteria | Details |
|-----------|--------|--------------|---------|
| **Gate 1: {{Name}}** | {{DD/MM/YYYY}} | {{criteria}} | `{{path}}` |

---

## Phase Overview

| Phase | Sprint | Period | Services | Features | Status |
|-------|--------|--------|----------|----------|--------|
| 1. {{Phase Name}} | Sprint 1 | {{Weeks X-Y}} | {{services}} | {{features}} | 🔲 Todo |
| 2. {{Phase Name}} | Sprint 2 | {{Weeks X-Y}} | {{services}} | {{features}} | 🔲 Todo |

---

## Phase 1: {{Phase Name}} (Sprint 1 — {{Period}})

> **Goal**: {{Outcome description}}
> **Verify**: {{Quick verification method}}

| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| 1.1 | {{Task}} | {{service}} | `{{spec}}` | {{assignee}} | 🔲 Todo |
| 1.2 | {{Task}} | {{service}} | `{{spec}}` | {{assignee}} | 🔲 Todo |

---

## Feature → Phase Mapping

| Feature ID | Phase | Sprint | Status |
|-----------|-------|--------|--------|
| FEAT-{{NNN}} | Phase {{N}} | Sprint {{N}} | 🔲 Todo |
| FEAT-{{NNN}} | Phase {{N}} | Sprint {{N}} | 🚧 In Progress |

---

## Dependencies Between Phases

```
Phase 1 ({{Name}})
  └──→ Phase 2 ({{Name}})
         ├──→ Phase 3 ({{Name}})
         └──→ Phase N ({{Name}})
```

**Critical path**: {{Phase 1}} → {{Phase 2}} → {{Phase N}}

---

## Status Conventions

| Status | Description |
|--------|-------------|
| 🔲 Todo | Not started |
| 🚧 In Progress | Active ({{N}}/{{M}} features) |
| ✅ Done | Completed + verified |
| ⛔ Blocked | Blocked (reason in backlog/board) |

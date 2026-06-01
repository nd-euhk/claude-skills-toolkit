---
title: "Sprint Board — {{project_name}}"
status: active
created: {{date}}
last_updated: {{date}}
updated_by: "{{scrum_master}}"
depends_on:
  - ../.work/backlog.md
  - ../agent_docs/roadmap.md
referenced_by: []
changelog:
  - "1.0 | {{date}} | Created — Sprint {{N}}"
---

# Sprint Board — Sprint {{N}}

> **Sprint Goal**: {{1-2 sentences — business value this sprint delivers}}
> **Duration**: {{DD/MM/YYYY}} → {{DD/MM/YYYY}} ({{N}} weeks)
> **References**: `roadmap.md` (epic-level), `backlog.md` (feature-level)

---

## Active Backlog Features

<!--
  Features from backlog.md currently being worked on this sprint.
  Only list features with tasks on the board.
-->

| Feature ID | Feature Name | Priority | Target Sprint | Status |
|-----------|-------------|----------|--------------|--------|
| FEAT-{{NNN}} | {{Feature name}} | Must | Sprint {{N}} | 🚧 In Progress |
| FEAT-{{NNN}} | {{Feature name}} | Must | Sprint {{N}} | 🔲 Todo |

---

## Task Summary

| Status | Count |
|--------|-------|
| 🔲 Todo | {{N}} |
| 🟢 Ready | {{N}} |
| 🚧 In Progress | {{N}} |
| 👀 In Review | {{N}} |
| ✅ Done | {{N}} |
| ⛔ Blocked | {{N}} |
| **Total** | **{{N}}** |

---

## Sprint Board

<!--
  Kanban view — each row = 1 task assignable to 1 person/agent.
  Task ID format: FR-{DOMAIN}-{NNN} (matches FR spec).
  SP column = Story Points (Fibonacci: 1,2,3,5,8).
  Assignee = person name or "ai-agent".
-->

| Status | FR ID | Feature | Task | Assignee | SP | Updated |
|--------|-------|---------|------|----------|-----|---------|
| 🔲 Todo | | | | | | |
| 🟢 Ready | | | | | | |
| 🚧 In Progress | | | | | | |
| 👀 In Review | | | | | | |
| ✅ Done | | | | | | |
| ⛔ Blocked | | | | | | |

<!--
  TEMPLATE DATA ROWS — copy and fill in:
  | 🔲 Todo | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name/ai-agent} | {SP} | {{date}} |
  | 🟢 Ready | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name/ai-agent} | {SP} | {{date}} |
  | 🚧 In Progress | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name/ai-agent} | {SP} | {{date}} |
  | 👀 In Review | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name/ai-agent} | {SP} | {{date}} |
  | ✅ Done | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name/ai-agent} | {SP} | {{date}} |
  | ⛔ Blocked | FR-{DOM}-{NNN} | {Feature name}: {Sub-task} | {Task description} | {name} | {SP} | {{date}} |
-->

---

## Blocked Items Detail

<!--
  Every ⛔ Blocked task MUST have an entry here explaining the reason.
-->

| FR ID | Blocked Since | Reason | Unblock Criteria | Owner |
|-------|--------------|--------|-----------------|-------|
| FR-{DOM}-{NNN} | {{date}} | {{block reason + evidence}} | {{conditions to unblock}} | {{name}} |

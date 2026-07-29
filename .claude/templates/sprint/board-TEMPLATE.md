---
title: "Sprint Board — {{project_name}}"
status: active
created: {{date}}
last_updated: {{date}}
updated_by: "{{scrum_master}}"
depends_on:
  - backlog.md
  - ../agent_docs/roadmap.md
referenced_by: []
changelog:
  - "1.0 | {{date}} | Created — Sprint {{N}}"
---

# Sprint Board — Sprint {{N}}

> **Sprint Goal**: {{1-2 câu}}
> **Duration**: {{DD/MM/YYYY}} → {{DD/MM/YYYY}} ({{N}} tuần)

---

## Active Backlog Features

| Feature ID | Feature Name | Priority | Status |
|-----------|-------------|----------|--------|
| FEAT-{{NNN}} | {{Feature name}} | Must | 🚧 In Progress |
| FEAT-{{NNN}} | {{Feature name}} | Must | 🔲 Todo |

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

<!-- Task ID = FR ID + hậu tố -Tn để định danh duy nhất từng task con -->

| Status | Task ID | Feature | Task | Assignee | Worktree | Cook Status | SP | Updated |
|--------|---------|---------|------|----------|----------|-------------|-----|---------|
| 🔲 Todo | FR-{DOM}-{NNN}-T1 | FEAT-{{NNN}} | {{mô tả task}} | {{name}} | — | — | {{SP}} | {{date}} |
| 🚧 Cooking | FR-{DOM}-{NNN}-T2 | FEAT-{{NNN}} | {{mô tả task}} | {{agent}} | `.claude/worktrees/cook-{{service}}-FEAT-{{NNN}}/` | TC 3/8 | {{SP}} | {{date}} |

---

## Blocked Items Detail

| Task ID | Blocked Since | Reason | Unblock Criteria | Owner |
|---------|--------------|--------|-------------------|-------|
| FR-{DOM}-{NNN}-T1 | {{date}} | {{lý do + bằng chứng}} | {{điều kiện gỡ block}} | {{name}} |

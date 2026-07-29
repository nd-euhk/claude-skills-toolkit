---
title: "Backlog — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - ../agent_docs/roadmap.md
referenced_by:
  - board.md
changelog:
  - "1.0 | {{date}} | Created — {{short_description}}"
---

# Backlog — {{project_name}}

> Feature-level planning — giữa roadmap (epic) và board (task).

---

## Priority Summary

| Priority | Count | Target |
|----------|-------|--------|
| **Must** | {{N}} | Current + Next Sprint |
| **Should** | {{N}} | Within 2-3 sprints |
| **Nice-to-have** | {{N}} | Future |

## Feature Summary

| Status | Count |
|--------|-------|
| 🔲 Todo | {{N}} |
| 🚧 In Progress | {{N}} |
| ✅ Done | {{N}} |
| ⛔ Blocked | {{N}} |
| **Total** | **{{N}}** |

---

## Features: Must / Should

| Feature ID | Name | Priority | Description | Source (Roadmap) | Sprint | Services | Spec | Tasks | Depends On | Status | CRs |
|-----------|------|----------|--------------|-------------------|--------|----------|------|-------|------------|--------|-----|
| FEAT-{{NNN}} | {{Tên}} | Must | {{1 câu}} | Phase {{N}}, Task {{N.N}} | Sprint {{N}} | {{service}} | `FR-{DOM}-{NNN}` | {{N}} (board.md) | — | 🔲 Todo | — |
| FEAT-{{NNN}} | {{Tên}} | Should | {{1 câu}} | Phase {{N}}, Task {{N.N}} | Sprint {{N}} | {{service}} | `FR-{DOM}-{NNN}` | — | FEAT-{{NNN}} | 🔲 Todo | — |

---

## Features: Nice-to-Have (Future)

| Feature ID | Name | Description | Epic (Roadmap) | Target |
|-----------|------|--------------|-----------------|--------|
| FEAT-{{NNN}} | {{Tên}} | {{1 câu}} | Phase {{N}} | Future |

---

## Feature → Epic Mapping

| Feature ID | Epic (Roadmap) | Phase | Sprint | Status |
|-----------|----------------|-------|--------|--------|
| FEAT-{{NNN}} | {{Epic/Theme}} | Phase {{N}} | Sprint {{N}} | 🔲 Todo |

---

## CR Impact Tracking

| CR | Feature | Impact | Status |
|----|---------|--------|--------|
| CR-{{NNN}} | FEAT-{{NNN}} | {{Spec change, edge case...}} | 🔲 Todo |


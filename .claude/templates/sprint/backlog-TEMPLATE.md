---
name: "Product Backlog — {{project_name}}"
title: "Product Backlog — {{project_name}}"
status: active
last_updated: {{date}}
updated_by: "{{author}}"
tracked_epics:
  - id: "EPIC-01"
    title: "{{epic name}}"
  - id: "EPIC-02"
    title: "{{epic name}}"
  - id: "EPIC-03"
    title: "{{epic name}}"
last_archive_ref: ""
---

# Product Backlog — {{project_name}}

> **Epic + Feature level**
> **Source of Truth** cho features/user stories.
> Board-writer sẽ break Features thành Stories khi pick lên board.

## [EPIC-01] {{epic name}}

| Feature ID | Description | Estimate | Priority | Status |
|------------|-------------|----------|----------|--------|
| FEAT-101 | {{feature description}} | {{sp}} | Must | backlog |
| FEAT-102 | {{feature description}} | {{sp}} | Should | backlog |

## [EPIC-02] {{epic name}}

| Feature ID | Description | Estimate | Priority | Status |
|------------|-------------|----------|----------|--------|
| FEAT-201 | {{feature description}} | {{sp}} | Must | backlog |
| FEAT-202 | {{feature description}} | {{sp}} | Could | backlog |

## [EPIC-03] {{epic name}}

| Feature ID | Description | Estimate | Priority | Status |
|------------|-------------|----------|----------|--------|
| FEAT-301 | {{feature description}} | {{sp}} | Must | backlog |
| FEAT-302 | {{feature description}} | {{sp}} | Must | done |
| FEAT-303 | {{feature description}} | {{sp}} | Should | backlog |

## Archive

Khi Epic hoàn thành, các Feature done được archive vào file riêng.

| Archive File | EPIC | Date |
|--------------|------|------|
| `.work/backlog/backlog-archive-{YYYYMMDD}--{EPIC-ID}--{name}.md` | EPIC-{{NN}} | {{date}} |

## Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Backlog Archive | `.work/backlog/backlog-archive-{YYYYMMDD}--{EPIC-ID}--{name}.md` | `.work/backlog/backlog-archive-20260512--EPIC-01--payment-momo.md` |

## Changelog

| Date | Change | Author |
|------|--------|--------|
| {{date}} | Initial | {{author}} |

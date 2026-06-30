---
name: "Roadmap — {{project_name}}"
title: "Roadmap — {{project_name}}"
status: active
current_quarter: "Q{{current}}/{{year}}"
last_updated: {{date}}
updated_by: "{{author}}"
active_themes: ["THEME-01", "THEME-02"]
active_epics: ["EPIC-01", "EPIC-02", "EPIC-03", "EPIC-04"]
---

# Roadmap — {{project_name}}

> **Strategic view: Theme + Epic level**
> **Source of Truth** cho tiến độ dự án cấp độ cao.
> Agent đọc file này để xác định EPIC ưu tiên trước khi nhảy xuống backlog.

## Timeline

| Now (Q{{current}}/{{year}}) | Next (Q{{next}}/{{year}}) | Later |
|-----------------------------|--------------------------|-------|
| **[THEME-01]** {{name}}     | **[THEME-03]** {{name}}  | **[THEME-04]** {{name}} |
| - [ ] EPIC-01: {{epic}}      | - [ ] EPIC-05: {{epic}}   | - [ ] EPIC-07: {{epic}} |
| - [ ] EPIC-02: {{epic}}      |                          | |
| **[THEME-02]** {{name}}     |                          | |
| - [ ] EPIC-03: {{epic}}      |                          | |
| - [/] EPIC-04: {{epic}}      |                          | |

## Milestones

| Date | Milestone | Success Criteria | Status |
|------|-----------|-----------------|--------|
| {{DD/MM/YYYY}} | {{name}} | {{criteria}} | 🔲 |

## Theme Dependencies

```
THEME-01
  ├──→ THEME-03 → THEME-04
  └──→ THEME-02 → THEME-05
```

## Theme → Epic Mapping

| Theme | EPIC | Description | Status |
|-------|------|-------------|--------|
| THEME-01 | EPIC-01 | {{epic name}} | 🔲 |
| THEME-01 | EPIC-02 | {{epic name}} | 🔲 |
| THEME-02 | EPIC-03 | {{epic name}} | 🔲 |
| THEME-02 | EPIC-04 | {{epic name}} | 🟡 |
| THEME-03 | EPIC-05 | {{epic name}} | 🔲 |
| THEME-04 | EPIC-07 | {{epic name}} | 🔲 |

## Changelog

| Date | Change | Author |
|------|--------|--------|
| {{date}} | Initial | {{author}} |

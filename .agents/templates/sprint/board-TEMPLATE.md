---
name: "Sprint {{N}} Board — {{project_name}}"
title: "Sprint {{N}} Board — {{project_name}}"
sprint_id: "SP-{{NN}}"
status: in-progress
start_date: {{start_date}}
end_date: {{end_date}}
last_updated: {{date}}
updated_by: "{{author}}"
associated_epics: ["EPIC-01", "EPIC-02"]
total_stories: {{N}}
completed_stories: 0
---

# Sprint {{N}} Board — {{project_name}}

**Period:** {{start_date}} → {{end_date}}

> **Feature → Story level**
> Feature từ backlog được break thành Stories.
> Board là nơi track tiến độ sprint hàng ngày.

---

## [FEAT-101] {{feature description}}

**Epic:** EPIC-01 | **Stories:** 2 | **Progress:** 0/{{N}}

| Story ID | Description | Priority | Status |
|----------|-------------|----------|--------|
| FR-{DOMAIN}-{NNN}--{slug} | {{story description}} | Must | todo |
| FR-{DOMAIN}-{NNN}--{slug} | {{story description}} | Should | todo |

---

## [FEAT-102] {{feature description}}

**Epic:** EPIC-01 | **Stories:** 1 | **Progress:** 0/{{N}}

| Story ID | Description | Priority | Status |
|----------|-------------|----------|--------|
| FR-{DOMAIN}-{NNN}--{slug} | {{story description}} | Must | todo |

---

## To Do

| Story | Feature | Priority | Added |
|-------|---------|----------|-------|
| FR-{DOMAIN}-{NNN}--{slug}: {{description}} | unassigned | FEAT-{{NNN}} | {Must/Should/Could} | {{date}} |

## Ready

> Story cần đủ FR + Impl + Test mới chuyển sang Ready.

| Story | Feature | Priority | Added |
|-------|---------|----------|-------|
| FR-{DOMAIN}-{NNN}--{slug}: {{description}} | FEAT-{{NNN}} | {Must/Should/Could} | {{date}} |

## In Progress

| Story | Assignee | Progress | Feature | Branch | Checkpoint |
|-------|----------|----------|---------|--------|------------|
| FR-{DOMAIN}-{NNN}--{slug}: {{description}} | @{{assignee}} | 0/{{N}} | FEAT-{{NNN}} | feat/FR-{DOMAIN}-{NNN}--{slug} | — | — |

## In Review

| Story | Assignee | Feature | Branch | Date |
|-------|----------|---------|--------|------|
| FR-{DOMAIN}-{NNN}--{slug}: {{description}} | @{{assignee}} | FEAT-{{NNN}} | feat/FR-{DOMAIN}-{NNN}--{slug} | {{date}} |

## Done

| Story | Assignee | Feature | Date Completed |
|-------|----------|---------|----|------|------|-----|----------------|
| FR-{DOMAIN}-{NNN}--{slug}: {{description}} | @{{assignee}} | FEAT-{{NNN}} | {{date}} |

---

## Agent Workflow

1. **Break Feature → Stories:** Khi pick Feature từ backlog lên board, break thành Stories
2. **FR + Impl + Test bắt buộc:** Mỗi Story cần có FR, Impl và Test trước khi chuyển sang Ready (Bug chỉ cần khi có bug)
3. **Spec path conventions:**
   - FR: `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md`
   - Backend Impl: `agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md`
   - Backend Test: `agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md`
   - Frontend Impl: `agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md`
   - Frontend Test: `agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md`
4. **Move through states:** To Do → Ready → In Progress → In Review → Done
5. **Ready = sẵn sàng implement:** Story đã có đủ FR + Impl + Test thì chuyển sang Ready, chờ developer pick
6. **Sync on complete:**
   - Khi Story done → cập nhật `completed_stories` count
   - Khi tất cả Story của một Feature done → báo human để sync với backlog

## Archive

Khi sprint kết thúc, tạo file archive:

| Archive File | EPIC | Date |
|--------------|------|------|
| `.work/board/board-archive-{YYYYMMDD}--{EPIC-ID}--{name}.md` | {{EPIC}} | {{date}} |

## Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Board Archive | `.work/board/board-archive-{YYYYMMDD}--{EPIC-ID}--{name}.md` | `.work/board/board-archive-260525--EPIC-05--auth-refactor.md` |
---
title: "Backlog — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"

# --- Traceability ---
depends_on:
  - ../agent_docs/roadmap.md
  - dod-dor.md
referenced_by:
  - ../.work/board.md
changelog:
  - "1.0 | {{date}} | Created — {{short_description}}"
---

# Backlog — {{project_name}}

> Single source of truth for feature-level planning — sits between roadmap (epic) and board (task).
> `agent_docs/roadmap.md` → parent (epic/theme).
> `.work/board.md` → child (task/story).
> `dod-dor.md` → DoR criteria for backlog items.

---

## Priority Summary

| Priority | Count | Target |
|----------|-------|--------|
| **Must** | {{N}} | Current + Next Sprint |
| **Should** | {{N}} | Within 2-3 sprints |
| **Nice-to-have** | {{N}} | Future |

---

## Features: Must (Critical Path)

<!--
  Must features — cannot ship without these.
  Each feature has standard format with traceability back to roadmap.
-->

### FEAT-{{NNN}}: {{Feature Name}}

- **Source**: {{Phase N, Task N.N — from roadmap.md}}
- **Description**: {{1-2 sentences describing the feature — user/business value}}
- **Priority**: Must
- **Target Sprint**: Sprint {{N}}
- **Services**: {{service, service}}
- **Specs**:
  - FR: `agent_docs/features/FR-{DOM}-{NNN}--{slug}.md`
  - Impl: `agent_docs/backend/{svc}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md`
  - Test: `agent_docs/backend/{svc}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md`
- **Tasks**: {{N}} tasks (see board.md)
- **Status**: 🔲 Backlog | 🚧 In Progress | ✅ Done
- **CRs**: — | CR-{{NNN}}

<!-- Repeat the pattern above for each Must feature -->

---

## Features: Should (Important — not blocking)

<!--
  Should features — important but can be deferred if capacity is tight.
  Same format as Must section.
-->

### FEAT-{{NNN}}: {{Feature Name}}

- **Source**: {{Phase N, Task N.N}}
- **Description**: {{1-2 sentences}}
- **Priority**: Should
- **Target Sprint**: Sprint {{N}}
- **Services**: {{service}}
- **Specs**:
  - FR: `agent_docs/features/FR-{DOM}-{NNN}--{slug}.md`
- **Tasks**: — (not yet broken down)
- **Status**: 🔲 Backlog
- **CRs**: —

---

## Features: Nice-to-Have (Future — no commitment)

<!--
  Nice-to-have features. No specific target sprint.
  Shorter format.
-->

| # | Feature | Description | Epic (Roadmap) | Target |
|---|---------|-------------|----------------|--------|
| 1 | FEAT-{{NNN}}: {{Name}} | {{1 sentence}} | Phase {{N}} | Future |
| 2 | FEAT-{{NNN}}: {{Name}} | {{1 sentence}} | Phase {{N}} | Future |

---

## Feature → Epic Mapping (Traceability)

<!--
  Map each feature back to its epic/theme in roadmap.
  Used for bottom-up status sync.
-->

| Feature ID | Epic (Roadmap) | Phase | Sprint | Status |
|-----------|----------------|-------|--------|--------|
| FEAT-{{NNN}} | {{Epic/Theme name}} | Phase {{N}} | Sprint {{N}} | 🔲 Todo |
| FEAT-{{NNN}} | {{Epic/Theme name}} | Phase {{N}} | Sprint {{N}} | 🚧 In Progress |
| FEAT-{{NNN}} | {{Epic/Theme name}} | Phase {{N}} | Sprint {{N}} | ✅ Done |

---

## CR Impact Tracking

<!--
  Features affected by Change Requests.
  Update when CRs are approved.
-->

| CR | Feature | Impact | Status |
|----|---------|--------|--------|
| CR-{{NNN}} | FEAT-{{NNN}} | {{Spec change, new edge case, etc.}} | 🔲 Pending |

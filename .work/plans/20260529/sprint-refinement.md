# Sprint Skill Refinement Plan

**Date:** 2026-05-29
**Target:** `skills/sprint/SKILL.md` (version 1.0.0 → 1.1.0)
**Goal:** Improve token efficiency, production-readiness, AskUserQuestion UX, and orchestrate integration

## Executive Summary

The sprint SKILL.md (286 lines) is well under the 500-line ceiling but has three categories of problems: (a) duplication between body and references, (b) documented data models that diverge from actual file formats, and (c) terse CRUD/Query workflows that underuse AskUserQuestion. This plan targets token efficiency, production-readiness, and tighter integration with orchestrate while keeping SKILL.md at approximately 230-240 lines.

---

## 1. ADDITIONS

### 1A. Structured Dispatch Table in Quick Start
Replace the prose list of 4 action types with a compact dispatch table mapping user-intent verbs to workflows, including an "Orchestrate Use" column.

### 1B. Expanded CRUD Workflows with AskUserQuestion Patterns
Replace the 22-line terse CRUD workflow (Workflow 5) with structured AskUserQuestion patterns for each sub-workflow (5A Add, 5B Edit, 5C Delete, 5D Update Status). Use progressive disclosure: one question at a time.

### 1C. Workflow 8 Structured Output Format
Add a format specification table for the three query modes (Ready Tasks, Todo Tasks, By Feature) so orchestrate can reliably parse sprint skill output.

### 1D. Data Model Flexibility Note
Add a section acknowledging that actual project files may diverge from the canonical format (domain-scoped IDs, extra columns, different emojis). Document the minimum invariants required for sync to work.

---

## 2. MODIFICATIONS

### 2A. Deduplicate Status Conventions
Status conventions appear 3 times (Workflow 1 inline, Key Notes, data-models.md). Replace the two SKILL.md instances with reference pointers to `references/data-models.md#status-values`.

### 2B. Deduplicate ID Conventions
ID conventions appear in both SKILL.md Key Notes and breakdown-workflow.md. Replace SKILL.md instance with a pointer. Consolidate ID conventions in breakdown-workflow.md.

### 2C. Move Task Breakdown Guidelines to Reference
Replace the 5 inline task breakdown guidelines in Workflow 2 with a pointer to `references/breakdown-workflow.md#task-decomposition-rules`.

### 2D. Fix Description Frontmatter
Remove "Supports Vietnamese and English" claim (no i18n mechanism exists). Bump version to 1.1.0.

### 2E. Add Board Status Transitions to data-models.md
Only the Backlog section has a status transition diagram. Add equivalent for the Board section.

### 2F. Strengthen Validation Workflow
Add pre-sync validation (file existence, circular dependency check) and post-sync validation (full script run) gates to Workflow 7.

### 2G. Reorder Key Notes
Reorganize from flat list into three tiers: (1) Critical invariants, (2) Reference pointers, (3) Operational rules.

---

## 3. DELETIONS

### 3A. Lines 76-81: Inline status conventions in Workflow 1 Step 3
Covered by 2A — replace with reference pointer.

### 3B. Lines 272-277: Status conventions in Key Notes
Covered by 2A — replace with reference pointer.

### 3C. Lines 279-282: ID conventions in Key Notes
Covered by 2B — replace with reference pointer.

### 3D. Lines 124-128: Inline task breakdown guidelines in Workflow 2
Covered by 2C — replace with reference pointer.

### 3E. Lines 233-235: Redundant "for orchestrate" commentary
Remove — orchestrate context belongs in the dispatch table (1A), not workflow body.

---

## 4. IMPLEMENTATION SEQUENCE

Following skill-refiner's CREATE before DELETE pattern:

| Step | File | Action |
|---|---|---|
| 1 | SKILL.md | Add structured dispatch table (1A) |
| 2 | SKILL.md | Expand CRUD workflows (1B) |
| 3 | SKILL.md | Add Workflow 8 output format (1C) |
| 4 | SKILL.md | Add data model flexibility note (1D) |
| 5 | references/data-models.md | Add Board status transitions (2E) |
| 6 | SKILL.md | Reorder Key Notes (2G) |
| 7 | SKILL.md | Strengthen validation workflow (2F) |
| 8 | SKILL.md | Update workflow references to point to external sources (prep for 2A/2B/2C) |
| 9 | SKILL.md | Delete inline status conventions (3A, 3B) |
| 10 | SKILL.md | Delete ID conventions (3C) |
| 11 | SKILL.md | Delete inline task breakdown guidelines (3D) |
| 12 | SKILL.md | Delete redundant orchestrate commentary (3E) |
| 13 | SKILL.md | Update frontmatter (2D) |
| 14 | references/breakdown-workflow.md | Consolidate ID conventions (2B ref work) |

**Net effect:** 286 lines → ~230-240 lines, with improved UX and tighter orchestrate integration.

---

## 5. FILES TO MODIFY

- `skills/sprint/SKILL.md` — Primary target
- `skills/sprint/references/data-models.md` — Board status transitions
- `skills/sprint/references/breakdown-workflow.md` — ID convention consolidation

## 6. VERIFICATION

1. Run `scripts/validate-sync.sh` to confirm no cross-reference breakage
2. Verify SKILL.md is under 500 lines after changes
3. Test trigger phrases: "break down roadmap", "sync status", "add task to board", "get ready tasks"
4. Confirm all reference file links resolve to existing files
5. Verify frontmatter has correct version (1.1.0) and description (no i18n claim)

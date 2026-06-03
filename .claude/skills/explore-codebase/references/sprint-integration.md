# Sprint Integration

Detailed logic for integrating exploration results with sprint artifacts (roadmap, backlog, board).

## Overview

Sprint integration runs after the SDLC pipeline completes. It uses `Skill(sprint)` exclusively — never modify sprint files directly.

## Multi-Pattern Project Context

Universal Project Discovery (Phase 1) detects sub-projects via 4 patterns. Sprint artifacts should reflect this topology:

| Pattern | Sprint Handling |
|---------|----------------|
| **Git Submodule** | Mỗi submodule có thể có features riêng. Themes/epics từ SRS nên được tag với submodule name để traceability. |
| **Nested Git Repo** | Mỗi nested repo là 1 project độc lập (có git history riêng, thường trong .gitignore). Themes/epics nên tách riêng cho từng nested repo. |
| **Monorepo Directory** | Dùng chung git history repo cha. Themes có thể gộp chung nhưng features nên tag theo directory. |
| **Single Project** | Sprint artifacts chuẩn — không cần tagging đặc biệt. |

**Nguyên tắc chung:** Scout reports từ mỗi sub-project là input cho sprint. Nếu multi-project, roadmap nên có section riêng cho từng project. Backlog có thể gộp chung hoặc tách — tùy quy mô. Hỏi human nếu > 3 projects.

## Step 1: Check Current State

```bash
ls .work/sprint/roadmap.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls .work/sprint/backlog.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls .work/sprint/board.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

## Step 2: Route by State

### Case A: First Run (Files Missing or Empty)

All three files missing or contain only headers/frontmatter → first run.

**Action: Create new sprint artifacts from exploration results**

Invoke `Skill(sprint)` with context from SRS and HLD:

```
Create sprint artifacts for the explored codebase:

From SRS:
- Themes come from functional area groupings
- Epics come from Gherkin feature groups
- Features come from individual Gherkin scenarios

From HLD:
- Services map to component ownership
- ADRs inform architectural decisions in the backlog

Create:
1. Roadmap: themes → epics → features with status = "Discovered"
2. Backlog: prioritized features with acceptance criteria from Gherkin scenarios
3. Board: features in "Discovered" column, ready for human review and prioritization
```

### Case B: Files Exist, Template Mismatch

Files exist but don't match the sprint skill's expected template format.

**How to detect template mismatch:**
- `Skill(sprint)` will report errors when trying to parse existing files
- Or: compare file structure against sprint template (check for required sections)

**Action: Backup and recreate**

```bash
cp .work/sprint/roadmap.md .work/sprint/roadmap.md.bak
cp .work/sprint/backlog.md .work/sprint/backlog.md.bak
cp .work/sprint/board.md .work/sprint/board.md.bak
```

Then create new artifacts as in Case A. Notify human about backup files.

### Case C: Files Exist, Template Match

Files exist and match the sprint skill's template format.

**Action: Verify and update**

Invoke `Skill(sprint)` to cross-reference with SRS features and HLD architecture:

- Features found in both board and SRS → mark as "Verified"
- Features in SRS but NOT in board → add as new with status "Discovered"
- Features in board but NOT in SRS → flag for human review (may be obsolete)
- New tasks/stories from IMP → link to parent features
- New architectural decisions from HLD → add as tasks if they require implementation

**Multi-project handling:** Khi cross-reference, group features theo sub-project source (submodule, nested repo, hoặc monorepo directory). Feature từ nested repo không nên merge với feature từ repo chính — giữ ranh giới rõ ràng để human biết feature đến từ đâu.

## Edge Cases

**SRS and HLD not generated (architect-only mode):**
- Only update roadmap with architectural themes
- Skip backlog and board updates (no features to add)

**Human-modified sprint artifacts:**
- Case B (backup) protects human modifications
- Case C (verify) preserves human changes, only adds missing entries
- Never remove or reorder human-added entries without asking

**Multi-pattern projects (submodules + nested repos + monorepo):**
- Mỗi sub-project có thể có SRS features và HLD services riêng
- Khi merge vào sprint, giữ traceability: feature → source sub-project
- Nếu nested repo có git history riêng → có thể cần sprint artifacts riêng
- Hỏi human nếu phát hiện > 3 sub-projects: "Create unified sprint or separate board per project?"

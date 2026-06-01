# Sprint Integration

Detailed logic for integrating exploration results with sprint artifacts (roadmap, backlog, board).

## Overview

Sprint integration runs after the SDLC pipeline completes. It uses `Skill(sprint)` exclusively — never modify sprint files directly.

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

From SRS ({srs_path}):
- Themes come from functional area groupings
- Epics come from Gherkin feature groups
- Features come from individual Gherkin scenarios

From HLD ({hld_path}):
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
# Backup existing files
cp .work/sprint/roadmap.md .work/sprint/roadmap.md.bak
cp .work/sprint/backlog.md .work/sprint/backlog.md.bak
cp .work/sprint/board.md .work/sprint/board.md.bak
```

Then create new artifacts as in Case A.

Notify human:
```
Existing sprint artifacts at .work/sprint/ don't match the expected template format.
Backed up as:
  - roadmap.md.bak
  - backlog.md.bak
  - board.md.bak

New artifacts created from exploration results. Please recheck the backup files
for any manual entries that need to be migrated.
```

### Case C: Files Exist, Template Match

Files exist and match the sprint skill's template format.

**Action: Verify and update**

Invoke `Skill(sprint)` to:
1. Load existing roadmap, backlog, board
2. Cross-reference with SRS features and HLD architecture:

```
Verify existing sprint artifacts against exploration results:

For each theme/epic/feature/task/story in the board:
- Found in SRS? → mark as "Verified"
- NOT found in SRS? → flag for human review (may be obsolete)

For each feature in SRS:
- Found in board? → skip (already tracked)
- NOT found in board? → add as new with status "Discovered"
- Found but changed? → update description, mark for review
```

**Adding new entries:**
- New features from SRS → add to backlog and board as "Discovered"
- New tasks/stories from IMP → link to parent features
- New architectural decisions from HLD → add as tasks if they require implementation

**Linking:**
- Ensure each new task/story links to its parent feature
- Ensure each new feature links to its parent epic
- Ensure each new epic links to its parent theme

## Sprint Skill Invocation Patterns

### Create New Board
```
Skill(sprint) with instruction: "Create a new sprint board for the explored codebase.
Use features from {srs_path} as the feature list. Set all to 'Discovered' status."
```

### Update Existing Board
```
Skill(sprint) with instruction: "Update the existing sprint board at .work/sprint/board.md.
Add these new features discovered from codebase exploration: {feature_list}.
Verify these existing features are still valid: {existing_feature_list}."
```

### Verify Roadmap
```
Skill(sprint) with instruction: "Verify the roadmap at .work/sprint/roadmap.md
against the system architecture in {hld_path}. Ensure themes align with bounded contexts
and epics align with services/modules."
```

## Edge Cases

**SRS and HLD not generated (architect-only mode):**
- Only update roadmap with architectural themes
- Skip backlog and board updates (no features to add)

**Single sub-project with no sprint artifacts:**
- Same as Case A — create new

**Multiple sub-projects:**
- Merge phase already consolidated SRS and HLD
- Sprint integration runs once on the consolidated artifacts
- Each feature should reference its source sub-project

**Human-modified sprint artifacts:**
- Case B (backup) protects human modifications
- Case C (verify) preserves human changes, only adds missing entries
- Never remove or reorder human-added entries without asking

# COOK-06: Plan Mode cho Cook Workflow -- KET QUA

## Verification Method: Code Review

### Sources Reviewed

| File | Purpose |
|------|---------|
| `.claude/skills/orchestrator/SKILL.md` | Common Phase: Plan Mode (lines 44-63), Quick Start routing (lines 14-42), Cook workflow summary (lines 80-84) |
| `.claude/skills/orchestrator/references/cook-workflow.md` | Cook-specific Phase 2 Plan (lines 11-19), BE/FE impact handling (lines 21-57), Gate rejection (lines 59-72) |
| `.work/plans/` | Directory exists, empty (no historical plan files) |

## Plan Mode Flow

- **EnterPlanMode call**: YES -- `SKILL.md` line 48: `1. Call EnterPlanMode`. Condition: when `--auto` is NOT present (line 46). Cook workflow Phase 2 (line 12-13 of `cook-workflow.md`) delegates to Common Phase via "Execute Common Phase: Plan Mode from SKILL.md. Plan file path: ..."
- **Plan agent spawn**: YES -- `SKILL.md` lines 49-53: `2. Spawn Agent(Plan) to: ... For Cook: assess whether changes affect BE, FE, or both`. Supplemented by `cook-workflow.md` lines 15-18 requiring `Agent(Plan)` to assess BE impact and FE impact and record them in the plan file.
- **Plan file path pattern**: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md` -- confirmed at `SKILL.md` line 62 and `cook-workflow.md` line 13.
- **AskUserQuestion after plan**: YES -- `SKILL.md` line 56: `"Plan written. Continue to execution or review further?"` with header "Proceed"
- **ExitPlanMode when ready**: YES -- `SKILL.md` line 57: `5. When ready, call ExitPlanMode to proceed`

## Impact Assessment (Cook Specific)

**BE/FE impact assessment criteria** -- `cook-workflow.md` lines 15-18:

During planning, `Agent(Plan)` MUST assess:
- **BE impact**: Does implementation touch backend code?
- **FE impact**: Does implementation touch frontend code?

These are recorded in the plan file. The downstream TDD pipeline (`cook-workflow.md` lines 21-57) then routes based on the assessment:

| Impact | Pipeline |
|--------|----------|
| BE only | `tdd-be-red` -> `tdd-be-green` -> `tdd-be-gate --mode=light` -> `tdd-be-refactor` -> `tdd-be-gate --mode=full` |
| FE only | `tdd-fe-red` -> `tdd-fe-green` -> `tdd-fe-gate --mode=light` -> `tdd-fe-refactor` -> `tdd-fe-gate --mode=full` |
| BE + FE | Both pipelines run in **parallel**, independently |

Gate rejection handling (lines 61-68): light gate re-spawns green agent, full gate re-spawns refactor agent. Safety: max 3 consecutive failures.

## Required Artifacts

- **Plan file format**: Contains BE impact assessment, FE impact assessment, and implementation plan drafted by Agent(Plan). Stored in `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`.
- **Directory**: `.work/plans/` -- exists (verified on disk, empty)
- **AskUserQuestion options**: "Continue to execution" | "Let me review the plan first" (SKILL.md line 56)

## Assessment

- **Complete Plan mode flow defined**: YES -- All five steps (EnterPlanMode, spawn Plan agent, write plan, AskUserQuestion, ExitPlanMode) are defined in SKILL.md Common Phase and referenced by cook-workflow.md Phase 2. BE/FE impact assessment criteria are explicit.
- **All decision points covered**: YES
  - --auto flag bypass ✓
  - BE/FE impact assessment ✓
  - BE only / FE only / both routing ✓
  - Gate rejection handling ✓
  - Re-spawn loop safety (3 max) ✓
  - Plan review option before execution ✓

## Overall: PASS

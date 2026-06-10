---
name: sdlc:workflow
description: >-
  Orchestrate SDLC workflows end-to-end using Workflow tool for deterministic agent chains.
  Use when starting a new feature (feature/task/story), handling a change request (cr), or cooking ready tasks for implementation (cook).
  Supports --auto flag to bypass plan mode. Skill handles interactive phases (plan mode, sprint, reports, AskUserQuestion).
  Delegates deterministic agent chains to workflow-sdlc-*-pipeline workflows for resumability and token efficiency.
argument-hint: "[feature][task][story][cr][cook] [description] [--auto] [--lang vi|en] [--vi] [--en]"
version: 1.0.1
allowed-tools: Read, Write, Bash(*), AskUserQuestion, Agent, Skill, Workflow, EnterPlanMode, ExitPlanMode
---

# SDLC Workflow (Hybrid: Skill + Workflow)

Orchestrate full SDLC using **Skill** for interactive phases and **Workflow** for deterministic agent chains. Three workflow variants cover the entire development lifecycle.

**Key difference from orchestrator**: Phase 3 (deterministic agent chains) runs as a single `workflow()` call instead of manual agent orchestration. Benefits: resumable pipeline, automatic gate retry, system-managed concurrency, token-efficient (intermediate results stay in script variables).

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **workflow type**: `feature`, `task`, `story` → Task Pipeline | `cr` → CR Pipeline | `cook` → Cook Pipeline
- **description**: free-text describing what to build/change
- **--auto flag**: if present, skip plan mode and execute directly
- **--lang <vi|en>**: output language. `vi` = Vietnamese (default), `en` = English. Reject any other value.
- **--vi flag**: shorthand for `--lang vi`. If both `--vi` and `--lang` present, `--lang` takes precedence.
- **--en flag**: shorthand for `--lang en`. If both `--en` and `--lang` present, `--lang` takes precedence.

### Step 2: Route to Workflow

```
INPUT: [workflow-type] [description] [--auto] [--lang vi|en] [--vi] [--en]

MATCH workflow-type:
  feature|task|story  → references/task-workflow.md
  cr                  → references/change-request-workflow.md
  cook                → references/cook-workflow.md
  NO MATCH            → AskUserQuestion to disambiguate
```

**If no match**, use AskUserQuestion:
- Question: "Which workflow?" (header: "Workflow")
  Options: "New Feature/Task/Story" | "Change Request (CR)" | "Cook (Implement Ready Tasks)"
- Then ask: "Skip plan mode?" (header: "Auto Mode")
  Options: "Yes (--auto)" | "No (enter plan mode)"

## Common Phase: Plan Mode

Applies when `--auto` is NOT present.

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify requirements and draft the plan:
   - **Skill(sequential-thinking)** when: Task touches >=2 bounded contexts or >=3 FRs; CR impacts both HLD+LLD; Cook spans BE+FE with shared API contracts
   - **Skill(problem-solving)** when: requirements ambiguous or conflict with known constraints; CR violates hard boundary; Cook tasks have implicit cross-dependencies
3. On approval, spawn `Agent(general-purpose)` to write plan to:
   - Task: `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md`
   - CR: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`
   - Cook: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`
4. Confirm: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode` to proceed.

## Workflow Overview

| Workflow | Interactive (Skill) | Deterministic (Workflow) | Reference |
|----------|---------------------|--------------------------|-----------|
| **Task** | Pick TODO → Plan(opt) → Sprint → Summary + Next | SRS→gate→HLD→gate→LLD→gate→IMP+TST(//)→gate | `references/task-workflow.md` |
| **CR** | Pick Done/In Review → Plan(opt) → Sprint → Report + Next | HLD(opt)→gate(opt)→LLD(opt)→gate(opt)→IMP+TST(//)→gate | `references/change-request-workflow.md` |
| **Cook** | Pick Ready → Plan(opt) → Sprint → Report + Next | TDD red→green→gate:light→refactor→gate:full (BE+FE //) | `references/cook-workflow.md` |

Each reference file contains: workflow args structure, invocation syntax, result processing, error handling patterns (see `references/error-handling.md`), sprint integration, report format, and next-step routing.

## Key Notes

**Workflow delegation.** Phase 3 is a single `workflow()` call. The workflow script handles all agent orchestration, gate retry, and concurrency. Do NOT manually spawn SDLC agents during execution.

**Resumable.** If workflow is paused/killed, resume in-session — completed agents return cached results instantly.

**Plan mode stays in skill.** `EnterPlanMode`/`ExitPlanMode` are skill-level operations. Workflows don't support mid-run user input.

**Sprint integration.** Use `Skill(sprint)` for board state — never modify sprint files directly.

**Report paths.** `mkdir -p .work/plans .work/reports .work/tasks .work/cooks .work/change-requests` before writing.

**Error recovery.** Workflow returns structured error results. Skill processes them using patterns from `references/error-handling.md` — decision trees for workflow failures, gate rejections, agent errors, file issues, and partial failures. Never auto-retry on workflow errors; always AskUserQuestion for human decision.

**Workflow file guard.** Before invoking `Workflow()`, verify the script exists: `ls .claude/workflows/workflow-sdlc-{type}-pipeline.js`. If missing, fall back to manual agent orchestration (same as orchestrator skill).

**Language (`--lang`, `--vi`, `--en`).** `--lang vi|en` sets output language for ALL generated documentation. Default: `vi` (Vietnamese). `--vi` = `--lang vi`. `--en` = `--lang en`. Only `vi`/`en` supported — reject any other value. If multiple flags present: `--lang` takes precedence over `--vi`/`--en`. Technical terms and code identifiers never translated.

**Artifacts written in target language:**
- Agent briefs: prepend "Write all output in {language}" as the first line
- Plan files, SDLC artifacts (SRS, HLD, LLD, IMP, TST), sprint artifacts, summary reports

**Artifacts kept in original form (never translated):**
- Technical terms: API, HTTP, JSON, class names, package names
- Code identifiers: function names, variable names, file paths

**Orchestrator compatibility.** This skill is a drop-in alternative to `/orchestrator`. Same args, same workflows, same outputs. The only difference is Phase 3 execution: Workflow tool instead of manual agent spawning.

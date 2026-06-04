---
name: orchestrator
description: >-
  Orchestrate SDLC workflows end-to-end. Use when starting a new feature (feature/task/story), handling a change request (cr), or cooking ready tasks for implementation (cook). Supports --auto flag to bypass plan mode. Coordinates sprint, srs, hld, lld, imp, tst, and tdd agents sequentially with gate verification at each phase.
argument-hint: "[feature][task][story][cr][cook] [description] [--auto] [--lang vi|en] [--vi]"
version: 1.4.0
allowed-tools: Read, Write, Bash(*), Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Agent, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Orchestrator

Orchestrate full SDLC workflows from requirements through architecture, design, implementation, and testing. Three workflow variants cover the entire development lifecycle.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **workflow type**: `feature`, `task`, `story` → Task Workflow | `cr` → CR Workflow | `cook` → Cook Workflow
- **description**: free-text describing what to build/change
- **--auto flag**: if present, skip plan mode and execute directly
- **--lang <vi|en>**: output language for all generated documentation. `vi` = Vietnamese, `en` = English (default). Reject any other value with an error message suggesting `vi` or `en`.
- **--vi flag**: shorthand for `--lang vi`. Equivalent behavior — if both `--vi` and `--lang` are present, `--lang` takes precedence.

### Step 2: Route to Workflow

```
INPUT: [workflow-type] [description] [--auto] [--lang vi|en] [--vi]

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

## Common Phase: Create Workflow Tasks (MANDATORY — Always Execute First)

**CRITICAL: Always create tasks before spawning any agents.** After routing to a workflow, create the full task chain before entering Plan Mode or any phase.

Track workflow with Task tools. Each phase = one task with `blockedBy` chain. Gate rejection keeps task in_progress during retry (max 3). See `references/task-management.md` for all 3 complete workflow chains (Task/CR/Cook) with parallel BE+FE tracks for Cook.

**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically.

## Common Phase: Plan Mode

Applies when `--auto` is NOT present.

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify requirements and draft the plan:
   - **Skill(sequential-thinking)** when: Task touches >=2 bounded contexts or >=3 FRs; CR impacts both HLD+LLD; Cook spans BE+FE with shared API contracts
   - **Skill(problem-solving)** when: requirements ambiguous or conflict with ADR; CR violates hard boundary; Cook tasks have implicit cross-dependencies
3. On approval, spawn `Agent(general-purpose)` to write plan to:
   - Task: `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md`
   - CR: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`
   - Cook: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`
4. Confirm: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode` to proceed.

## Workflow Overview

| Workflow | Pipeline | Reference |
|----------|----------|-----------|
| **Task** | Pick TODO → Plan(opt) → SRS→gate→HLD→gate→LLD→gate→IMP+TST(//)→gate→sprint → Summary | `references/task-workflow.md` |
| **CR** | Pick Done/In Review → Plan(opt) → HLD(opt)→gate(opt)→LLD(opt)→gate(opt)→IMP+TST(//)→gate→sprint → Summary | `references/change-request-workflow.md` |
| **Cook** | Pick Ready → Plan(opt) → TDD red→green→gate:light→refactor→gate:full (BE+FE //) → Summary | `references/cook-workflow.md` |

Each reference file contains: agent spawning order, gate rejection handling, re-spawn loop safety, report format, next-step routing.

## Key Notes

**Gate verification is non-negotiable.** Re-spawn the preceding agent (not gate) on rejection. Max 3 retries.

**Parallel where possible.** IMP+TST simultaneously. BE+FE cook pipelines independently. Gate verifiers in parallel.

**Self-contained briefs.** Each agent brief includes: sprint context, prior phase outputs, gate feedback (if re-spawning), deliverable expected. See `references/agent-brief-templates.md`.

**Sprint integration.** Use `Skill(sprint)` for board state — never modify sprint files directly.

**Error recovery.** Agent error (not gate reject): log, ask human retry/skip. Never auto-retry on errors.

**Report paths.** `mkdir -p .work/plans .work/reports .work/tasks .work/cooks .work/change-requests` before writing.

**Language (--lang, --vi).** `--lang vi|en` sets the output language for ALL generated documentation. `--vi` is shorthand for `--lang vi`. Only `vi` (Vietnamese) and `en` (English) are supported — any other value must be rejected with an error. If neither flag is provided, default to English.

**Artifacts written in target language:**
- Agent briefs: prepend "Write all output in {language}" as the first line
- Plan files, SDLC artifacts (SRS, HLD, LLD, IMP, TST), sprint artifacts, summary reports

**Artifacts kept in original form (never translated):**
- Technical terms: API, HTTP, JSON, class names, package names
- Code identifiers: function names, variable names, file paths

**Language-specific behavior:**
- `--lang vi` / `--vi`: all output in Vietnamese with full diacritics (tiếng Việt với đầy đủ dấu)
- `--lang en` / default: all output in English
- If both `--vi` and `--lang` are present: `--lang` takes precedence (e.g., `--vi --lang en` → English)

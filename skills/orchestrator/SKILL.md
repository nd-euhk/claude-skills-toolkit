---
name: orchestrator
description: >-
  Orchestrate SDLC workflows end-to-end. Use when starting a new feature (feature/task/story), handling a change request (cr), or cooking ready tasks for implementation (cook). Supports --auto flag to bypass plan mode. Coordinates sprint, srs, hld, lld, imp, tst, and tdd agents sequentially with gate verification at each phase.
argument-hint: [feature][task][story][cr][cook] [description] [--auto]
version: 1.0.0
allowed-tools: Read, Write, Bash(*), Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Agent, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Orchestrator

Orchestrate full SDLC workflows from requirements through architecture, design, implementation, and testing. Three workflow variants cover the entire development lifecycle.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **workflow type**: `feature`, `task`, `story` → [Task Workflow](references/task-workflow.md) | `cr` → [Change Request Workflow](references/change-request-workflow.md) | `cook` → [Cook Workflow](references/cook-workflow.md)
- **description**: free-text describing what to build/change
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Workflow

```
INPUT: [workflow-type] [description] [--auto]

MATCH workflow-type:
  feature|task|story  → references/task-workflow.md
  cr                  → references/change-request-workflow.md
  cook                → references/cook-workflow.md
  NO MATCH            → AskUserQuestion to disambiguate
```

**If no match found**, batch these 2 questions in one AskUserQuestion call:
1. "Which workflow do you want to run?" (header: "Workflow", options: "New Feature/Task/Story" | "Change Request (CR)" | "Cook (Implement Ready Tasks)")
2. "Use --auto to skip plan mode?" (header: "Auto Mode", options: "Yes (--auto)" | "No (enter plan mode)")

Then route based on answers:
- "New Feature/Task/Story" → load `references/task-workflow.md` and execute
- "Change Request (CR)" → load `references/change-request-workflow.md` and execute
- "Cook (Implement Ready Tasks)" → load `references/cook-workflow.md` and execute

## Common Phase: Plan Mode (all workflows)

Applies when `--auto` is NOT present.

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to:
   - Clarify requirements with human
   - For CR: assess impact on HLD and LLD artifacts
   - For Cook: assess whether changes affect BE, FE, or both
   - Use `Skill(sequential-thinking)` and `Skill(problem-solving)` as needed
   - Draft the plan
3. When human approves the plan, spawn `Agent(general-purpose)` to write it to the appropriate path (see workflow-specific reference for path)
4. Use `AskUserQuestion` to confirm: "Plan written. Continue to execution or review further?" (header: "Proceed", options: "Continue to execution" | "Let me review the plan first")
5. When ready, call `ExitPlanMode` to proceed

**Plan file paths:**
- Task: `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md`
- CR: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`
- Cook: `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md`

Where `YYYYMMDD` is today's date, `{FR-name}` is a short functional requirement name from the description, and `{slug}` is a URL-safe short identifier.

## Workflow Summaries

### Task Workflow (feature | task | story)

Pick TODO → Plan(opt) → SRS→gate→HLD→gate→LLD→gate→IMP+TST(parallel)→gate→sprint update(Ready/Blocked) → Summary → AskUserQuestion(next)

**Full details:** `references/task-workflow.md` — agent spawning order, gate rejection handling, re-spawn loop safety, report format, next-step routing.

### Change Request Workflow (cr)

Pick Done/In Review → Plan(opt, assess HLD+LLD impact) → HLD(opt)→gate(opt)→LLD(opt)→gate(opt)→IMP+TST(parallel)→gate→sprint add(Ready/Blocked) → Summary → AskUserQuestion(next)

**Full details:** `references/change-request-workflow.md` — optional phase gating, impact assessment criteria, agent spawning order, gate rejection handling, report format.

### Cook Workflow (cook)

Pick Ready → Plan(opt, assess BE+FE impact) → TDD red→green→gate:light→refactor→gate:full (BE and/or FE, parallel if both) → Summary → AskUserQuestion(next)

**Full details:** `references/cook-workflow.md` — TDD pipeline sequencing per BE/FE, gate mode routing (light→green re-spawn, full→refactor re-spawn), parallel BE+FE execution, re-spawn loop safety, report format.

## Key Notes

**Gate verification is non-negotiable.** Every phase output MUST pass its gate before the pipeline advances. Re-spawn the preceding agent (not the gate) on rejection.

**Parallel execution where possible.** IMP+TST spawn simultaneously. BE+FE cook pipelines run independently. Gate verifiers for IMP and TST run in parallel.

**Agent briefs must be self-contained.** Each spawned agent receives a complete brief including: task context from sprint, outputs from prior phases, gate feedback (if re-spawning), and the specific deliverable expected. See `references/agent-brief-templates.md` for exact prompt structures.

**Re-spawn loop safety.** If any agent fails gate verification 3 times consecutively, stop and report to human with accumulated feedback. Never loop indefinitely.

**Report paths require directories.** Ensure `.work/plans/` and `.work/reports/` exist before writing. Create with `mkdir -p` if needed.

**Sprint integration.** The sprint skill manages board state. Orchestrator only invokes it for pick/update operations — never modifies board files directly.

**Error recovery.** If any agent fails (not gate rejection, but actual error), log the error to the report, ask human whether to retry or skip. Do not auto-retry on agent errors.

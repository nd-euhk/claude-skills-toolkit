---
name: architect
description: >-
  Orchestrate architecture work end-to-end. Use when designing system architecture,
  reviewing existing architecture, evaluating architectural trade-offs, making
  technology decisions, creating C4 diagrams, writing ADRs, assessing architecture
  quality, or getting architectural guidance. Supports --auto flag to bypass plan
  mode. Coordinates architect-specialist agent for design, review, and advisory
  workflows with gate verification.
argument-hint: "[design][review][advisory] [description] [--auto]"
version: 1.0.0
allowed-tools: Read, Write, Bash(*), Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Agent, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Architect

Orchestrate architecture work from requirements through design, review, and advisory. Three workflow variants cover the full architecture lifecycle.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **workflow type**: `design` → Design Workflow | `review` → Review Workflow | `advisory` → Advisory Workflow
- **description**: free-text describing what architecture work is needed
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Workflow

```
INPUT: [workflow-type] [description] [--auto]

MATCH workflow-type:
  design    → references/design-workflow.md
  review    → references/review-workflow.md
  advisory  → references/advisory-workflow.md
  NO MATCH  → AskUserQuestion to disambiguate
```

**If no match**, use AskUserQuestion:
- Question: "What architecture work do you need?" (header: "Workflow")
  Options: "Design new architecture" | "Review existing architecture" | "Architectural advisory/guidance"
- Then ask: "Skip plan mode?" (header: "Auto Mode")
  Options: "Yes (--auto)" | "No (enter plan mode)"

## Common Phase: Create Workflow Tasks (MANDATORY — Always Execute First)

**CRITICAL: Always create tasks before spawning any agents.** After routing to a workflow, create the full task chain before entering Plan Mode or any phase.

Track workflow with Task tools. Each phase = one task with `blockedBy` chain. See `references/task-management.md` for all 3 complete workflow chains.

**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically.

## Common Phase: Plan Mode

Applies when `--auto` is NOT present.

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify requirements and draft the plan:
   - **Skill(sequential-thinking)** when: Design touches >=2 bounded contexts or >=3 architectural alternatives; Review finds >=3 Yellow/Red dimensions that interact; Advisory involves multi-option trade-off analysis
   - **Skill(problem-solving)** when: Requirements force trade-off between NFR categories; Review reveals conflicting architectural constraints; Advisory question has no clear best answer
3. On approval, spawn `Agent(general-purpose)` to write plan to:
   - Design: `.work/plans/arch-design-YYYYMMDD-{slug}.md`
   - Review: `.work/plans/arch-review-YYYYMMDD-{slug}.md`
   - Advisory: `.work/plans/arch-advisory-YYYYMMDD-{topic}-{slug}.md`
4. Confirm: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode` to proceed.

## Workflow Overview

| Workflow | Pipeline | Reference |
|----------|----------|-----------|
| **Design** | Plan(opt) → architect-specialist(design) → gate → sprint(sync) → Summary | `references/design-workflow.md` |
| **Review** | Plan(opt) → architect-specialist(review) → gate → sprint(sync) → Summary | `references/review-workflow.md` |
| **Advisory** | Plan(opt) → architect-specialist(advisory) → Summary | `references/advisory-workflow.md` |

Each reference file contains: agent spawning order, brief templates, gate criteria, report format, sprint integration, and next-step routing.

## Common Phase: Gate Verification

After architect-specialist completes, verify outputs with `Agent(gate-verifier)`. Read `agent_docs/architecture-reviews/` (review mode) or `docs/architecture/` (design mode) to confirm completeness.

Gate criteria per mode:
- **Design:** System architecture doc covers C4 L1+L2, >=3 ADRs with context/decision/rationale/consequences, every FR maps to one service, hard boundaries documented, no implementation details
- **Review:** All 7 dimensions assessed, every Yellow/Red finding has recommendation, missing ADRs written, health dashboard complete
- **Advisory:** Decision space defined, options evaluated, recommendation with rationale, ADR written if significant

On gate rejection, re-spawn architect-specialist with specific feedback (max 3 retries). Never modify outputs directly.

## Common Phase: Sprint Integration

After gate passes, sync architecture outputs with sprint artifacts:
- `Skill(sprint)` to update board status — never modify sprint files directly
- If new services/domains defined, sprint may need backlog updates
- If review found architectural debt, sprint may need new tasks

## Key Notes

**architect-specialist subagent** handles all architecture execution. This skill orchestrates — routes to the right mode, manages plan approval, verifies outputs, and integrates with sprint. Never do architecture work inline; always delegate to architect-specialist.

**Self-contained briefs.** Each agent brief includes: project context, mode-specific instructions, prior outputs (if re-spawning), deliverable expected. See `references/agent-brief-templates.md`.

**Gate verification is non-negotiable for design and review.** Re-spawn architect-specialist (not gate) on rejection. Max 3 retries. Advisory mode skips gate (outputs are advisory, not binding).

**Plan mode is optional.** Use `--auto` to skip. Without `--auto`, always plan before executing. Architecture decisions are high-impact — plan mode is the default.

**Error recovery.** Agent error (not gate reject): log, ask human retry/skip. Never auto-retry on errors.

**Report paths.** `mkdir -p .work/plans .work/reports` before writing.

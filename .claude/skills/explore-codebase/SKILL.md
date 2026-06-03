---
name: explore-codebase
description: >-
  Explore and analyze codebases end-to-end, generating full SDLC documentation (SRS, HLD, LLD, IMP, TST) with gate verification.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: "[full][architect][sync] [--auto]"
version: 2.5.0
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep, AskUserQuestion, Agent, Skill, EnterPlanMode, ExitPlanMode, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Explore Codebase

Explore codebases end-to-end: scout sub-projects → generate SDLC documentation (SRS → HLD → LLD → IMP+TST) with gate verification → sync sprint artifacts → summarize.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (empty) → AskUserQuestion
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto]

MATCH mode:
  full      → Full Pipeline
  architect → Architect Only
  sync      → Sync
  (empty)   → AskUserQuestion to select mode
```

**If mode is empty**, use AskUserQuestion:
- Question: "Which exploration mode do you want to run?" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

### Mode Overview

| Mode | Flow | Use when |
|------|------|----------|
| **Full** | Scout → Explore → Plan(opt) → SDLC Pipeline → Sprint → Summary | First exploration, need all docs |
| **Architect** | Scout → Explore → Plan(opt) → HLD → gate-verify → Summary | Architecture only, no impl details |
| **Sync** | Interactive AskUserQuestion → selected phases | Update existing docs, realign sprint |

**Full** generates SRS, HLD, LLD, IMP, TST with gate verification. **Architect** generates HLD only (C4, ADRs, bounded context). **Sync** asks what to sync: "Everything" | "Architecture only" | "Sprint artifacts only" | "Implementation specs only" (header: "Sync Scope", multiSelect).

## Phase 1: Scout — Discover Sub-Projects

Goal: determine how many sub-projects exist in the repository.

### Step 1.1: Check Git Submodules (preferred)

```bash
git submodule status 2>/dev/null
```

If submodules exist, record the count and path of each submodule.

### Step 1.2: If No Git Submodules

Detect sub-projects via directory structure and build files:

```bash
ls -d packages/*/ apps/*/ services/*/ modules/*/ 2>/dev/null
find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null
find . -maxdepth 3 -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null
find . -maxdepth 3 -name "go.mod" -not -path "*/vendor/*" 2>/dev/null
find . -maxdepth 3 -name "pom.xml" 2>/dev/null
```

### Step 1.3: Classify

- **1 project**: single project
- **>1 project**: multi-subproject — each gets its own scout report

## Phase 2: Explore — Scout Each Sub-Project

### Step 2.1: Create Pipeline Tasks (MANDATORY — Always Execute First)

**CRITICAL: Always create tasks before spawning any agents.** Use Phase 1 results to determine sub-project count.

Track pipeline with Task tools. One task per agent spawn, `blockedBy` forms the sequential chain. The orchestrating skill creates the pipeline tasks; each agent manages its own internal sub-tasks per its agent definition.

Task creation happens in 2 waves: Wave 1 (post-Phase 1) creates scout + SRS + HLD tasks. Wave 2 (post-HLD/SRS) creates lld-service + lld-merge + IMP + TST tasks per service/FR.

**Single sub-project**: Skip parallel — 1 task per phase.

Full task chains, batching logic, concurrency limits, and re-spawn handling: `references/task-management.md`.

### Step 2.2: Ensure Report Directory

```bash
mkdir -p .work/reports
```

### Step 2.3: Pull Latest Source Code

Before spawning Agent Explore, pull the latest source to ensure agents work with up-to-date code.

**If git submodules exist** (detected in Phase 1):
```bash
git submodule foreach 'git pull'
```

**If single project** (no submodules):
```bash
git pull
```

Complete the pull before proceeding to spawn Agent Explore.

### Step 2.4: Spawn Agent(Explore) Per Sub-Project in Parallel

Spawn one Agent(Explore) per sub-project. Use the brief from `references/agent-briefs.md#phase-2-agentexplore`. Agent(Explore) is **read-only** — it researches and returns findings as a message. The **orchestrator** (this skill) collects each agent's response and writes it to `.work/reports/scout-{project-name}--{slug}.md`. Back up existing files as `.bak` before overwriting.

**Concurrency** uses the unified parallel spawn rule — see `references/task-management.md`.

**Constraint:** Do NOT spawn a separate agent to format scout reports. Agent(Explore) returns raw findings — orchestrator writes them verbatim to the report file.

## Phase 3: Plan — Create Execution Plan

### If --auto is present: skip Phase 3, proceed directly to Phase 4.

### If --auto is NOT present:

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify requirements, determine scope, and draft the plan:
   - Use `Skill(sequential-thinking)` when >=3 sub-projects need priority ordering with cross-dependencies, OR scope spans >=4 SDLC phases
   - Use `Skill(problem-solving)` when scout reports reveal conflicting signals, OR a sub-project's purpose is unclear
3. On approval, spawn `Agent(general-purpose)` to write `.work/plans/explore-YYYYMMDD--{slug}.md`
4. Confirm with AskUserQuestion: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode` to proceed.

## Phase 4: SDLC Pipeline

Execute phases sequentially with gate verification after each. SRS and HLD are single-agent phases (system-wide scope). All other phases spawn one agent per service/FR in parallel. Briefs are in `references/agent-briefs.md`.

### Parallel Spawn Rule (Unified)

All parallel agent spawns (Explore, lld-service, imp, tst, gate-verifier) use the same rule:

```
GIVEN: total = number of agents to spawn

IF total ≤ 15:
  → Spawn all in 1 batch, all run in parallel

IF total > 15:
  → batch_count = ceil(total / 15)
  → agents_per_batch = ceil(total / batch_count)
  → Spawn batch 1 (agents 1..agents_per_batch) → wait all complete
  → Spawn batch 2 (agents agents_per_batch+1 .. 2×agents_per_batch) → wait all complete
  → ...repeat for batch_count batches
```

Each batch runs in parallel within itself. Batches run sequentially. Divide agents evenly so batches are balanced.

### Pipeline Flow

```
Agent(srs) [1 agent, reads all scout reports]
  → Agent(gate-verifier) → [re-spawn srs if reject]
→ Agent(hld) [1 agent, system-wide ADRs + C4]
  → Agent(gate-verifier) → [re-spawn hld if reject]
→ Agent(lld-service) × N [parallel, 1 per service]
  → Agent(gate-verifier) × N [parallel]
→ Agent(lld-merge) [1 agent, index + cross-cutting from all per-service outputs]
  → Agent(gate-verifier) → [re-spawn lld-merge if reject]
→ Agent(imp) × M [parallel, 1 per FR]
  + Agent(tst) × M [parallel, 1 per FR]
  → Agent(gate-verifier) × M [verify imp, parallel]
  + Agent(gate-verifier) × M [verify tst, parallel]
```

**N** = services in domain-service-mapping.yaml. **M** = FRs from SRS.

**lld-service** handles per-service outputs only (tech-design + API contract + work packages). **lld-merge** handles system-wide outputs (index + cross-cutting) after all per-service agents complete.

Brief pattern: Context → Inputs → Task → Constraints. Agents use their own default templates. Each SDLC agent knows its own Skill() triggers — do NOT add Skill instructions to briefs.

### Gate Verification

After each phase, spawn `Agent(gate-verifier)`. It knows where to find artifacts — do NOT specify paths.

**If gate REJECTs:**
- Re-spawn the preceding phase's agent with: "RETRY #{N}: Previous attempt rejected. Gate feedback: {exact message}. Fix these specific issues."
- Maximum 3 re-spawns per phase. After 3: stop pipeline, report to human.

## Phase 5: Sprint Integration

Use `Skill(sprint)` for all sprint operations. See `references/sprint-integration.md` for state routing logic (first run vs template mismatch vs alignment).

## Phase 6: Summary

Spawn `Agent(general-purpose)` to write `.work/reports/explore-YYYYMMDD--{slug}.md`. See `references/report-templates.md` for the 9-section summary format. Inputs: all scout reports, SRS, HLD, LLD, IMP, TST outputs.

## Key Notes

**No sandbox.** Agents work directly on the project. Scout reports are the shared foundation.

**Input-only briefs.** Specify what agents read, not where to write. Agents use their own templates.

**Gate-verifier needs no paths.** Tell it which phase. It knows where artifacts are.

**Parallel spawn.** Max 15 agents per batch, all phases. If >15, divide evenly into ceil(N/15) batches. See `references/task-management.md`.

**Gate limit.** Max 3 re-spawns per agent. Re-spawn the failing agent (not gate). Pass gate feedback in brief. Don't re-spawn an entire batch.

**Parallel where possible.** IMP+TST in parallel per FR. Gate-verify IMP+TST in parallel. lld-service per service in parallel.

**Single sub-project.** Fall back to 1 agent/phase. Parallel adds overhead with no benefit.

**Sprint.** Use `Skill(sprint)` — never modify sprint files directly.

**Error recovery.** Agent error (not gate reject): log, ask human retry/skip.

**Report paths.** `mkdir -p .work/reports .work/plans` before writing. Backup as `.bak` on overwrite.

## Reference Files

- `references/agent-briefs.md` — Brief templates for all agent types (Phase 2 + Phase 4)
- `references/task-management.md` — Task chains, batching logic, concurrency limits, re-spawn handling
- `references/sprint-integration.md` — Sprint integration: state routing, backup, update logic
- `references/report-templates.md` — Templates: scout reports, plan files, summary reports

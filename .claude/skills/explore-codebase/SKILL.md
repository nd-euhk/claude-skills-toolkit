---
name: explore-codebase
description: >-
  Explore and analyze codebases end-to-end, generating full SDLC documentation (SRS, HLD, LLD, IMP, TST) with gate verification.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: [full][architect][sync] [--auto]
version: 1.0.0
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep, AskUserQuestion, Agent, Skill, EnterPlanMode, ExitPlanMode
---

# Explore Codebase

Explore codebases end-to-end: scout sub-projects → generate SDLC documentation (SRS → HLD → LLD → IMP+TST) with gate verification → sync sprint artifacts → summarize.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → [Full Pipeline](#mode-full-pipeline) | `architect` → [Architect Only](#mode-architect-only) | `sync` → [Sync Mode](#mode-sync) | (empty) → AskUserQuestion
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto]

MATCH mode:
  full      → Mode: Full Pipeline
  architect → Mode: Architect Only
  sync      → Mode: Sync
  (empty)   → AskUserQuestion to select mode
```

**If mode is empty**, use AskUserQuestion (single question):
- Question: "Which exploration mode do you want to run?" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

Then route based on the answer.

## Mode: Full Pipeline

Generate all SDLC artifacts (SRS, HLD, LLD, IMP, TST) with gate verification at each phase. Updates sprint artifacts on completion.

**Use when:** exploring a new codebase for the first time, need comprehensive documentation of the entire system.

**Flow:** Scout → Explore → Plan (unless --auto) → SDLC Pipeline → Merge (if multi-subproject) → Sprint → Summary.

## Mode: Architect Only

Generate only the High-Level Design (HLD) artifact with C4 diagrams, ADRs, and bounded context mapping. Gate-verified architecture only.

**Use when:** you only need to understand system architecture and service topology without deep implementation details. Faster than full pipeline — skips requirements, detailed design, and implementation specs.

**Flow:** Scout → Explore → Plan (unless --auto) → HLD → gate-verify → Summary.

Explicitly excludes: SRS, LLD, IMP, TST, Sprint Integration.

## Mode: Sync

Interactive mode for updating existing documentation. Uses AskUserQuestion to determine sync scope, then executes only the selected phases.

With `--auto`: skip plan mode and execute selected sync actions directly.

**Use when:** previously explored codebase needs updating, sprint artifacts need alignment, or specific artifact types need regeneration.

**Flow:** Use AskUserQuestion to ask what to sync:
- Question: "What do you want to sync?" (header: "Sync Scope", multiSelect: true)
- Options: "Everything (full pipeline)" | "Architecture documents only" | "Sprint artifacts only (roadmap/backlog/board)" | "Implementation specs only"

Then execute the corresponding phases based on selection. Plan mode applies per standard rules unless --auto.

## Phase 1: Scout — Discover Sub-Projects

Goal: determine how many sub-projects exist in the repository.

### Step 1.1: Check Git Submodules (preferred)

```bash
git submodule status 2>/dev/null
```

If submodules exist, record the count and path of each submodule.

### Step 1.2: If No Git Submodules

Use Bash and Grep to detect sub-projects via directory structure and build files:

```bash
# Check common monorepo structures
ls -d packages/*/ 2>/dev/null
ls -d apps/*/ 2>/dev/null
ls -d services/*/ 2>/dev/null
ls -d modules/*/ 2>/dev/null

# Check independent build files (excluding node_modules, target, vendor)
find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null
find . -maxdepth 3 -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null
find . -maxdepth 3 -name "go.mod" -not -path "*/vendor/*" 2>/dev/null
find . -maxdepth 3 -name "pom.xml" 2>/dev/null
```

### Step 1.3: Classify

- **1 project**: single project — subsequent phases run directly on the root directory
- **>1 project**: multi-subproject — create sandbox and run each subproject separately

### Step 1.4: Create Sandbox (Multi-Subproject Only)

```bash
SANDBOX=".work/reports/explore-$(date +%Y%m%d)--{slug}/sandbox"
mkdir -p "$SANDBOX"
```

Where `{slug}` is a URL-safe short identifier derived from the root directory name.

## Phase 2: Explore — Scout Each Sub-Project

### Step 2.1: Spawn Agent(Explore) Per Sub-Project

Based on the sub-project count from Phase 1, spawn Agent(Explore) for each sub-project in parallel.

**Brief for each Agent(Explore):**
```
Explore the sub-project at {path}. Return:
1. Technologies used (language, framework, database, message queue, etc.)
2. Main directory structure and purpose of each directory
3. Key modules/packages and their responsibilities
4. Entry points (main files, API routes, configs, CLI entry)
5. Dependencies (internal cross-module + external packages)
6. Architectural patterns in use (layered, hexagonal, microservices, CQRS, etc.)
```

### Step 2.2: Write Scout Reports

When each Agent(Explore) completes, spawn Agent(general-purpose) to write the report.

**Brief for Agent(general-purpose):**
```
Based on the Agent(Explore) output for sub-project {name}, write a scout report to:
.work/reports/explore-YYYYMMDD--{slug}/scout-{project-name}--{slug}.md

Organize into sections:
- Sub-project overview
- Technologies used
- Directory structure
- Modules and responsibilities
- Entry Points
- Dependencies (internal + external)
- Architectural patterns

If the target file already exists, back it up as .bak before overwriting.
```

## Phase 3: Plan — Create Execution Plan

### If --auto flag is present

Skip Phase 3, proceed directly to Phase 4.

### If --auto is NOT present

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to:
   - Clarify requirements with the human based on scout reports
   - Determine scope: which sub-projects need deep analysis
   - For multi-subproject: establish priority order
   - Use `Skill(sequential-thinking)` and `Skill(problem-solving)` as needed
   - Draft a detailed plan
3. When the human approves the plan, spawn `Agent(general-purpose)` to write it to:
   ```
   .work/plans/explore-YYYYMMDD--{slug}.md
   ```
4. Use `AskUserQuestion` to confirm:
   - Question: "Plan written. Continue to execution or review further?" (header: "Proceed")
   - Options: "Continue to execution" | "Let me review the plan first"
5. When ready, call `ExitPlanMode` to proceed.

## Phase 4: SDLC Pipeline

Execute phases sequentially with gate verification after each phase.

### Pipeline Flow

```
Agent(srs)
  → Agent(gate-verifier) → [re-spawn srs if reject]
→ Agent(hld)
  → Agent(gate-verifier) → [re-spawn hld if reject]
→ Agent(lld)
  → Agent(gate-verifier) → [re-spawn lld if reject]
→ Agent(imp) + Agent(tst) [parallel]
  → Agent(gate-verifier) × 2 [verify imp and tst in parallel]
```

### Brief Templates

See `references/agent-brief-templates.md` for detailed brief templates for each agent type.

### Output Paths

**Single project:**
```
.work/reports/explore-YYYYMMDD--{slug}/srs--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/hld--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/lld--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/imp--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/tst--{slug}.md
```

**Multi-subproject (sandbox):**
```
.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/srs-{project-name}--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/hld-{project-name}--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/lld-{project-name}--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/imp-{project-name}--{slug}.md
.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/tst-{project-name}--{slug}.md
```

### Gate Verification

After each phase, spawn `Agent(gate-verifier)` to verify the output:
- Input: path to the artifact to verify + artifact type (srs/hld/lld/imp/tst)
- Output: pass/reject with specific reasons

**If gate REJECTs:**
- Re-spawn the preceding phase's agent (not the gate) with feedback from the gate
- Include feedback in the brief: "Gate verification failed with: {reasons}. Fix these issues and regenerate the artifact."
- Maximum 3 re-spawns per phase
- **After 3 failures**: stop the pipeline, report to human with accumulated feedback from all 3 rejections

## Phase 5: Merge (Multi-Subproject Only)

After all subprojects complete their SDLC pipelines in the sandbox, merge results into unified artifacts.

Run sequentially:
```
Agent(srs) → Agent(gate-verifier) → Agent(hld) → Agent(gate-verifier) → Agent(lld) → Agent(gate-verifier) → [Agent(imp) + Agent(tst)] parallel → [Agent(gate-verifier) × 2]
```

**Brief for each merge agent (see `references/agent-brief-templates.md`):**
- Input: list of paths to each subproject's artifact
- Output: unified artifact at `.work/reports/explore-YYYYMMDD--{slug}/{type}--{slug}.md`
- Requirements: consolidate all functional requirements, distinguish sub-project boundaries, identify cross-cutting concerns, merge NFRs (take the strictest value)

Gate verify and re-spawn logic same as Phase 4.

## Phase 6: Sprint Integration

Use `Skill(sprint)` to verify roadmap, backlog, and board.

### Step 6.1: Check Current State

```bash
ls .work/sprint/roadmap.md 2>/dev/null
ls .work/sprint/backlog.md 2>/dev/null
ls .work/sprint/board.md 2>/dev/null
```

### Step 6.2: Route Based on State

**First run (files don't exist or are empty):**
- Use `Skill(sprint)` to create new roadmap, backlog, board from SRS and HLD results
- Themes/epics/features are created from functional requirements and architecture

**Files exist but don't match template:**
- Backup: `cp file.md file.md.bak`
- Create new from template
- Notify human: "Existing sprint artifacts don't match template. Backed up as .bak. Please recheck."

**Files exist and match template:**
- Use `Skill(sprint)` to verify theme/epic/feature/task/story alignment
- Missing → add new entries and link them
- Extra → flag for human review

See `references/sprint-integration.md` for detailed integration logic.

## Phase 7: Summary

Spawn `Agent(general-purpose)` to write the summary to `.work/reports/explore-YYYYMMDD--{slug}.md`.

**Brief:**
```
Consolidate codebase exploration findings from these artifacts:
- Scout reports: {list_paths}
- SRS: {srs_path}
- HLD: {hld_path}
- LLD: {lld_path}
- IMP: {imp_path}
- TST: {tst_path}

Write to: .work/reports/explore-YYYYMMDD--{slug}.md

Report structure:
1. Project overview
2. System architecture (summary from HLD)
3. Functional requirements (summary from SRS)
4. Technical design (summary from LLD)
5. Implementation specs (summary from IMP)
6. Test strategy (summary from TST)
7. Sprint artifacts status
8. Risks and recommendations
9. Links to each detailed artifact
```

## Key Notes

**Gate verification limit.** Maximum 3 re-spawns per phase if gate rejects. After 3: stop pipeline, report to human. Never auto-retry beyond the limit.

**Re-spawn the right agent.** When gate rejects, re-spawn the preceding phase's agent (not the gate). Pass gate feedback into the agent's brief.

**Parallel execution.** IMP and TST run in parallel. Gate verify for IMP and TST runs in parallel. Merge agents follow the same pattern. Scout reports are also written in parallel.

**Agent briefs must be self-contained.** Each spawned agent receives a complete brief: scout report context, prior phase outputs, gate feedback (if re-spawning), and the specific deliverable expected.

**Sandbox for multi-subproject.** When >1 sub-project, all per-subproject outputs go into `.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/`. The merge phase consolidates into the parent directory.

**Sprint integration.** Use `Skill(sprint)` for all sprint operations — never modify sprint files directly. Back up existing files as `.bak` before creating new ones.

**Error recovery.** If an agent errors (not gate reject), log the error, ask human whether to retry or skip. Never auto-retry on agent errors.

**Report paths.** Ensure `.work/reports/` and `.work/plans/` directories exist before writing. Use `mkdir -p`.

**Backup before overwrite.** Scout reports and sprint artifacts are backed up as `.bak` if the target file already exists.

## Reference Files

- `references/agent-brief-templates.md` — Detailed brief templates for each agent type: Explore, SRS, HLD, LLD, IMP, TST, gate-verifier, merge agents, general-purpose
- `references/sprint-integration.md` — Sprint integration logic details: creation, template verification, backup, update, adding new tasks/stories
- `references/report-templates.md` — Templates for scout reports, summary reports, and plan files

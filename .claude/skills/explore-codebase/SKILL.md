---
name: explore-codebase
description: >-
  Explore and analyze codebases end-to-end, generating full SDLC documentation (SRS, HLD, LLD, IMP, TST) with gate verification.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: "[full][architect][sync] [--auto]"
version: 3.1.0
allowed-tools: Read, Write, Edit, Bash(*), AskUserQuestion, Agent, Skill, EnterPlanMode, ExitPlanMode, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Explore Codebase

Explore codebases end-to-end: discover sub-projects → pack with repomix → scout with Skill(scout) → generate SDLC documentation (SRS → HLD → LLD → IMP+TST) with gate verification → sync sprint artifacts → summarize.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (empty) → AskUserQuestion
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto]

MATCH mode:
  full      → Phase 1 (Scout)
  architect → Phase 1 (Scout) then skip to HLD
  sync      → ## Sync Mode (after Phase 3) — skip Phases 1-3, run sync workflow
  (empty)   → AskUserQuestion to select mode
```

**If mode is empty**, use AskUserQuestion:
- Question: "Which exploration mode do you want to run?" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

### Mode Overview

| Mode | Flow | Use when |
|------|------|----------|
| **Full** | Scout (repomix + scout) → Plan(opt) → SDLC Pipeline → Sprint → Summary | First exploration, need all docs |
| **Architect** | Scout (repomix + scout) → Plan(opt) → HLD → gate-verify → Summary | Architecture only, no impl details |
| **Sync** | Git Change Detection → Impact Analysis → Smart Suggestions → Human ✓ → Selected Phases | Update existing docs, realign sprint |

**Full** generates SRS, HLD, LLD, IMP, TST with gate verification. **Architect** generates HLD only (C4, ADRs, bounded context). **Sync** checks git changes (main repo + submodules + nested repos), analyzes impact, suggests which phases need updating, then runs selected phases after human approval. Full sync workflow: `references/sync-workflow.md`.

## Phase 1: Scout — Discover Sub-Projects

Goal: determine how many sub-projects exist using universal project discovery (multi-pattern), pull latest source, and pack each project into an AI-friendly snapshot with repomix.

### Step 1.1: Universal Project Discovery

Detect all sub-project patterns simultaneously. Don't assume only one pattern — scan all 4 patterns and merge results, deduplicating overlaps.

#### Pattern 1: Git Submodules

```bash
git submodule status 2>/dev/null
```

If output exists, each line is one submodule. Record: commit hash, path, and branch (if any). These directories will NOT be re-scanned in other patterns.

#### Pattern 2: Nested Git Repos

Detect independent git repos inside the project (typically added to `.gitignore` of the parent repo — the "folder containing multiple projects but without submodules" case):

```bash
find . -name ".git" -not -path "./.git" -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.terraform/*" -not -path "*/.git/**" 2>/dev/null | sed 's|/\.git$||'
```

For each nested repo found:
- If already a submodule (Pattern 1) → skip
- Check gitignore: `git check-ignore <path> 2>/dev/null && echo "IGNORED" || echo "TRACKED"`
- Record: path, gitignore status

#### Pattern 3: Monorepo Directories

```bash
ls -d packages/*/ apps/*/ services/*/ modules/*/ 2>/dev/null
find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null
find . -maxdepth 3 -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null
find . -maxdepth 3 -name "go.mod" -not -path "*/vendor/*" 2>/dev/null
find . -maxdepth 3 -name "pom.xml" 2>/dev/null
```

Skip directories already detected in Pattern 1 or 2.

#### Pattern 4: Single Project (Fallback)

If no other patterns found → single project = current repo.

### Step 1.2: Classify

- **1 project**: single project — 1 repomix snapshot, 1 scout invocation (scout scales internally based on token count from repomix). Can be Pattern 4 or monorepo without independent build-file sub-directories.
- **>1 project**: multi-subproject — each sub-project (submodule, nested repo, or monorepo directory) is an independent project. Each gets its own repomix snapshot and scout report.

**Note:** Nested git repos and submodules have their own git history → must be processed independently in scout and repomix. Monorepo directories share git history with the parent repo.

### Step 1.3: Pull Latest Source Code (skip in Sync mode)

Before packing or scouting, pull latest source to ensure agents work with up-to-date code. **Skip in Sync mode** — Sync mode uses git changes for detection, not fresh pulls.

**If git submodules exist:**
```bash
git submodule foreach 'git pull'
```

**Root repo (non-submodule projects):**
```bash
git pull
```

Complete the pull before proceeding.

### Step 1.4: Create Report Directories

```bash
mkdir -p .work/reports .work/repomix .work/scouts .work/plans
```

**Run identifier**: `{slug}` = short kebab-case summary of the project's purpose (e.g., `payment-api`, `user-management`, `inventory-svc`). Provides human-readable context in filenames. Combined with `YYYYMMDD` date prefix for uniqueness across exploration runs.

### Step 1.5: Pack Each Sub-Project with repomix

For each discovered sub-project, invoke `Skill(repomix)` to generate an AI-friendly codebase snapshot. repomix automatically reports token counts — use them to decide whether to split large single projects.

**Check installation first:**
```bash
repomix --version 2>/dev/null && echo "INSTALLED" || echo "MISSING"
```

**If not installed**, use AskUserQuestion:
- Question: "Repomix is not installed. It accelerates codebase exploration by pre-packing files into a single snapshot for faster agent navigation. Without it, scout agents read files directly (slower but works identically — same reports, same quality). Install repomix?" (header: "Repomix", options: "Install repomix (Recommended)" | "Skip — proceed without it")
- **If "Install repomix":** run `npm install -g repomix`, verify installation with `repomix --version`, then proceed to invoke `Skill(repomix)` as normal.
- **If "Skip":** continue without repomix snapshots. Omit the repomix reference line from all scout invocations in Phase 2.

#### Multi-Subproject (already split by structure)

Invoke sequentially per sub-project (CLI-bound, parallel adds no speedup):
```
Skill(repomix, "{path} --style xml --remove-comments -o .work/repomix/{project-name}--{slug}.xml")
```

#### Single Project — Run repomix, Pass Token Count to Scout

Run repomix on the entire project:
```
Skill(repomix, ". --style xml --remove-comments -o .work/repomix/root--{slug}.xml")
```

repomix reports total tokens at the end of its output. **Record this count** — it determines how scout scales.

Do NOT split into areas here. Scout handles internal subdivision based on the token count you pass. Proceed to Phase 2 with 1 scout invocation, including the token count in its instructions.

**If a sub-project's repomix fails** (timeout, permissions, error): log a warning for that sub-project, skip its snapshot, and continue. Remaining sub-projects proceed normally.

## Phase 2: Scout — Explore Each Sub-Project

Goal: produce a detailed scout report for each sub-project using the scout skill, which handles parallel Agent(Explore) spawning internally.

### Step 2.1: Create Pipeline Tasks (MANDATORY — Always Execute First)

**CRITICAL: Always create tasks before invoking any skills.** Use Phase 1 results to determine sub-project count.

Track pipeline with Task tools. One task per repomix run and scout invocation, `blockedBy` forms the sequential chain. The orchestrating skill creates the pipeline tasks; each skill/agent manages its own internal sub-tasks.

Task creation happens in 2 waves: Wave 1 (post-Phase 1) creates repomix + scout + SRS + HLD tasks. Wave 2 (post-HLD/SRS) creates lld-service + lld-merge + IMP + TST tasks per service/FR.

**Single sub-project**: Skip parallel — 1 repomix task, 1 scout task, 1 task per phase.

Full task chains, batching logic, concurrency limits, and re-spawn handling: `references/task-management.md`.

### Step 2.2: Invoke Skill(scout) Per Sub-Project

For each sub-project, invoke the scout skill. The scout skill spawns its own Agent(Explore) subagents internally, following its 5-step workflow (Analyze Task → Divide and Conquer → Register Tasks → Spawn Parallel Agents → Collect Results). It handles parallel spawning, task tracking, timeout handling, and result aggregation.

**Invocation format per sub-project:**

```
Skill(scout, "Explore sub-project {project-name} at path {project-path}. 
A repomix codebase snapshot is available at .work/repomix/{project-name}--{slug}.xml — use it for fast file navigation and structure overview.
Total codebase size: ~{token_count} tokens.

Produce a detailed scout report with these 7 sections:
1. Overview — 2-3 sentence summary of purpose and role
2. Technologies — table: Category | Technology | Version | Purpose
3. Directory Structure — tree with each directory's responsibility
4. Modules and Responsibilities — each module: responsibility, dependencies, public API
5. Entry Points — table: Entry Point | Type | Path | Description
6. Dependencies — internal (module → depends_on → relationship) + external (package|version|purpose)
7. Architectural Patterns — observed patterns with code evidence, architecture style, data flow

Adjust your internal SCALE based on the token count — spawn more agents and subdivide further for larger codebases. 
Write the final report to .work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md. Full template: `references/report-templates.md#scout-report`.")
```

**If repomix snapshot is unavailable** for a sub-project (not installed or failed), omit the repomix reference line from the scout invocation. The scout skill operates identically with or without the snapshot. Invocation format quick reference also in `references/agent-briefs.md`.

**Batching:** Apply the Unified Parallel Spawn Rule from `references/task-management.md`. If >15 sub-projects, batch scout invocations into ceil(N/15) groups. Within each batch, all scout invocations run in parallel. The scout skill itself may further parallelize internally per its own SCALE logic.

**Constraint:** Do NOT spawn Agent(Explore) directly. Delegate entirely to the scout skill. The orchestrator's role is to invoke Skill(scout) and verify results.

### Step 2.3: Verify All Scout Reports

Before proceeding to Phase 3, verify every expected scout report exists:

```bash
ls .work/scouts/scout-*-{slug}.md 2>/dev/null
```

**If a report is missing:**
- Log the missing sub-project name
- Retry the scout invocation once with the same parameters
- If the retry also fails, fall back: spawn a single Agent(Explore) with the brief from `references/agent-briefs.md#phase-2-agentexplore-deprecated-as-of-v300` to produce the report directly
- If the fallback also fails: ask the human "Scout for {sub-project} failed. Skip this sub-project and continue, retry, or abort?"

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

## Sync Mode

Sync mode detects code changes since last exploration, analyzes impact, and suggests which SDLC artifacts to update. Edge cases and troubleshooting: `references/sync-workflow.md`.

### Sync Step 1: Git Change Detection

Determine the baseline (last exploration point) in priority order:

**1. Git tag `explore-*`:**
```bash
git tag -l 'explore-*' --sort=-creatordate | head -1
```
If found → use tag as baseline for `git diff` and `git log`.

**2. Report file timestamp:**
```bash
ls -t .work/reports/explore-*.md 2>/dev/null | head -1
ls -t .work/scouts/scout-*.md 2>/dev/null | head -1
```
Use `stat` to get mtime of newest file as `--since` for git log.

**3. Ask user:**
If no baseline exists, use AskUserQuestion: "No previous exploration found. How far back should I check?" (header: "Baseline", options: "7 days" | "14 days" | "30 days" | "Since specific commit").

**After baseline is established, collect changes:**

Run Universal Project Discovery (Phase 1 Step 1.1) to discover all projects. Check changes per type:

```bash
# Main repo
git diff --stat $BASELINE..HEAD 2>/dev/null
git log --oneline $BASELINE..HEAD 2>/dev/null

# Per submodule — use git -C to avoid changing directory
git -C <submodule_path> log --oneline $BASELINE..HEAD 2>/dev/null

# Per nested git repo (independent repo, typically gitignored) — use git -C
git -C <nested_repo_path> log --oneline --since="$DATE" 2>/dev/null

# Per monorepo directory
git log --oneline $BASELINE..HEAD -- <monorepo_path>/ 2>/dev/null
```

**If no git available:** fallback to `find . -newer <baseline_file>` — less accurate, warn the human.

**If no changes detected:** report "No changes since {baseline}. Nothing to sync." Offer AskUserQuestion with "Run selected phases anyway?" (Yes / No). If yes → present full checklist, nothing pre-selected.

### Sync Step 2: Impact Analysis

**Tier 1 — Rule-Based Mapping.** Classify changed files:

| Change Pattern | Glob | SDLC Impact |
|----------------|------|-------------|
| Source code | `src/**`, `lib/**`, `app/**`, `services/**` | **IMP + TST** |
| API contracts | `*.proto`, `*.graphql`, `openapi*`, `contracts/**` | **SRS + LLD** |
| Architecture / Infra | `package.json`, `Dockerfile*`, `docker-compose*`, `terraform/**` | **HLD** |
| Database | `migrations/**`, `*.sql`, `prisma/**` | **LLD + IMP** |
| Tests only | `*.test.*`, `*.spec.*`, `__tests__/**` | **TST** |
| Config | `config/**`, `.env*`, `application*.yml` | **IMP** |
| Docs only | `README*`, `CHANGELOG*`, `docs/**` | **No sync needed** |
| New service/directory | New directory under services/apps/packages | **SRS + HLD + LLD** |

**Tier 2 — AI Deep Analysis.** Trigger when diff > 100 lines, > 10 files, changes touch core architecture, or files don't match Tier 1 patterns. Spawn `Agent(Explore)` (read-only) with the prompt template in `references/sync-workflow.md#ai-deep-analysis-prompt-template`. It identifies affected SDLC artifacts with confidence (HIGH/MEDIUM/LOW).

### Sync Step 3: Smart Suggestions

Combine Tier 1 + Tier 2 results, present to human:

1. **Change summary** — separate section per project type (main repo, submodule, nested repo, monorepo directory). Example format: `references/sync-workflow.md#sync-change-summary-format`.
2. **Recommended sync** — checklist of phases to re-run, pre-select HIGH-impact phases marked `[recommended]`
3. **AskUserQuestion** — multiSelect with header "Sync Scope". Only include phases with relevant changes — skip phases with no impact.

Human approves or adjusts selections.

### Sync Step 4: Execute Selected Phases (with Dependency Auto-Resolution)

Run selected phases from Phase 4 (SDLC Pipeline). Only selected phases execute — unselected phases are skipped.

**Dependency auto-resolution** — if a selected phase depends on an unselected phase, auto-include the dependency:

```
IMP selected, LLD not selected:
  → Check: does LLD output exist from a previous run?
    YES → use existing LLD output as input
    NO  → auto-include LLD in the execution (run LLD first, then IMP)

TST selected, IMP not selected:
  → Same logic as above: use existing IMP or auto-include

HLD selected, SRS not selected:
  → Use existing SRS output. If none exists → auto-include SRS first.
```

**Chain:** Auto-inclusion cascades. If auto-including LLD triggers need for HLD (not selected, no output), auto-include HLD too. Report the final execution list to human before starting: "Adjusted plan: LLD auto-included (needed by IMP). Running: LLD → IMP → TST."

After execution → Phase 5 (Sprint Integration) if selected → Phase 6 (Summary) with auto-tagging.

## Phase 4: SDLC Pipeline

Execute phases sequentially with gate verification after each. SRS and HLD are single-agent phases (system-wide scope). All other phases spawn one agent per service/FR in parallel. Briefs are in `references/agent-briefs.md`.

**CRITICAL — Explicit file paths only:** After Phase 2 completes, collect the exact scout report file paths that were produced. When constructing agent briefs, substitute `{scout_report_paths}` with the actual file list — never use glob patterns. Scout can run multiple times across days; globs risk picking up stale reports from previous runs.

### Parallel Spawn Rule (Unified)

All parallel agent spawns follow the batching logic in `references/task-management.md#unified-parallel-spawn-rule`. Max 15 agents per batch; divide evenly across ceil(N/15) batches.

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

Spawn `Agent(general-purpose)` to write `.work/reports/explore-YYYYMMDD--{slug}.md`. See `references/report-templates.md#summary-report` for the 9-section format. Inputs: all scout reports (`.work/scouts/`), SRS, HLD, LLD, IMP, TST outputs.

### Step 6.1: Auto-Tag for Future Sync

After Summary completes successfully, create a git tag so the next Sync run has a reliable baseline.

**Guard checks before tagging:**

1. **Dirty working tree:** Check `git status --porcelain`. If uncommitted changes exist → warn "Working tree is dirty — auto-tag skipped. Commit changes first for a reliable baseline."
2. **No git:** If project doesn't use git → skip tagging entirely, log "No git — auto-tag skipped."
3. **Sync mode partial run:** If only a subset of phases ran (not Full/Architect) → still create the tag but add `--sync` suffix: `explore-YYYYMMDD--{slug}--sync`
4. **All checks pass → create tags:**

```bash
# Tag in main repo
git tag "explore-$(date +%Y%m%d)--{slug}" -m "explore: {project_name} ({mode} mode, {N} sub-projects)"

# Per submodule with changes → tag in that submodule (use git -C to avoid changing directory)
git -C <submodule_path> tag "explore-$(date +%Y%m%d)--{slug}"

# Per nested git repo with changes → tag in that repo (use git -C)
git -C <nested_repo_path> tag "explore-$(date +%Y%m%d)--{slug}"
```

**Tag naming:** `explore-YYYYMMDD--{slug}` matches the baseline search pattern in Sync Step 1. If report files need committing first, use `Skill(git)` to commit before creating tags.

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

**Report paths.** `mkdir -p .work/reports .work/repomix .work/scouts .work/plans` before writing. Scout reports go to `.work/scouts/`, summary to `.work/reports/`. Backup as `.bak` on overwrite.

## Reference Files

- `references/agent-briefs.md` — Prompt templates for every SDLC agent (srs, hld, lld-service, lld-merge, imp, tst, gate-verifier) + deprecated Agent(Explore) fallback. Load when constructing agent briefs.
- `references/task-management.md` — Task chain topology (Wave 1 + Wave 2), unified parallel spawn rule with batch-size example, re-spawn handling, mode variants. Load when creating pipeline tasks or debugging batch execution.
- `references/sprint-integration.md` — Sprint state routing (Case A/B/C), backup strategy, human-modification safety. Load during Phase 5 sprint sync.
- `references/report-templates.md` — Full templates for scout report (7 sections), plan file, and summary report (9 sections). Load when formatting agent outputs or writing final deliverables.
- `references/sync-workflow.md` — Sync mode supplementary: edge cases (no git, dirty tree, no changes), AI deep analysis prompt template, change summary format example, troubleshooting guide. Load during Sync mode when edge cases or templates are needed.

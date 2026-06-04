---
name: explore-codebase
description: >-
  Explore and analyze codebases end-to-end, generating full SDLC documentation (SRS, HLD, LLD, IMP, TST) with gate verification.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: "[full][architect][sync] [--auto] [--lang vi|en] [--vi]"
version: 3.4.1
allowed-tools: Read, Write, Edit, Bash(*), AskUserQuestion, Agent, Skill, EnterPlanMode, ExitPlanMode, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Explore Codebase

Explore codebases end-to-end: discover sub-projects → pack with repomix → scout with Skill(scout) → generate SDLC documentation (SRS → HLD → LLD → IMP+TST) with gate verification → sync sprint artifacts → summarize.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (empty) → AskUserQuestion
- **--auto**: skip plan mode, execute directly
- **--lang vi|en**: output language. Only `vi` (Vietnamese) and `en` (English, default) are supported. Reject other values.
- **--vi**: shorthand for `--lang vi`. If both present, `--lang` takes precedence.

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto] [--lang vi|en] [--vi]

MATCH mode:
  full      → Phase 1 (Scout)
  architect → Phase 1 (Scout) then skip to HLD
  sync      → ## Sync Mode (skip Phases 1-3)
  (empty)   → AskUserQuestion: "Which exploration mode?" (header: "Explore Mode")
               Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"
```

| Mode | Flow | Use when |
|------|------|----------|
| **Full** | Scout → Plan(opt) → SDLC Pipeline → Sprint → Summary | First exploration, need all docs |
| **Architect** | Scout → Plan(opt) → HLD → gate-verify → Summary | Architecture only |
| **Sync** | Git Change Detection → Impact Analysis → Smart Suggestions → Human ✓ → Selected Phases | Update existing docs |

Full generates SRS, HLD, LLD, IMP, TST with gate verification. Architect generates HLD only. Sync checks git changes, analyzes impact, suggests phase updates. Full sync workflow: `references/sync-workflow.md`.

## Phase 1: Scout — Discover Sub-Projects

Goal: discover sub-projects via 4 patterns, pull latest source, pack each with repomix.

### Step 1.1: Universal Project Discovery

Detect all sub-project patterns simultaneously. Merge results, deduplicate overlaps. Full bash commands: `references/pipeline-execution.md#project-discovery-commands`.

- **Pattern 1 — Git Submodules**: `git submodule status`. Record commit hash, path, branch. These directories are excluded from Patterns 2-3.
- **Pattern 2 — Nested Git Repos**: Find independent git repos inside the project (typically gitignored). Check `git check-ignore` for each.
- **Pattern 3 — Monorepo Directories**: Look for `packages/*/`, `apps/*/`, `services/*/`, `modules/*/` plus build files (`package.json`, `Cargo.toml`, `go.mod`, `pom.xml`). Skip directories from Patterns 1-2.
- **Pattern 4 — Single Project (Fallback)**: If no other patterns found → single project = current repo.

### Step 1.2: Classify

- **1 project**: 1 repomix snapshot, 1 scout invocation. Scout scales internally based on token count.
- **>1 project**: each sub-project gets its own repomix snapshot and scout report. Nested repos/submodules have independent git history → must be processed independently.

### Step 1.3: Pull Latest Source (skip in Sync mode)

```bash
git submodule foreach 'git pull'  # if submodules exist
git pull                          # root repo
```

### Step 1.4: Create Report Directories

```bash
mkdir -p .work/reports .work/repomix .work/scouts .work/plans
```

**Run identifier**: `{slug}` = short kebab-case project purpose (e.g., `payment-api`). Combined with `YYYYMMDD` date prefix.

### Step 1.5: Pack Each Sub-Project with repomix

Check installation: `repomix --version`. If missing, use AskUserQuestion:
- Question: "Repomix is not installed. It accelerates exploration by pre-packing files. Install?" (header: "Repomix", options: "Install repomix (Recommended)" | "Skip — proceed without it")

**Multi-subproject** — invoke sequentially per sub-project:
```
Skill(repomix, "{path} --style xml --remove-comments -o .work/repomix/{project-name}--{slug}.xml")
```

**Single project** — run repomix, record token count for scout scaling:
```
Skill(repomix, ". --style xml --remove-comments -o .work/repomix/root--{slug}.xml")
```

Do NOT split into areas here — scout handles internal subdivision. If repomix fails: log warning, skip snapshot, continue.

## Phase 2: Scout — Explore Each Sub-Project

Goal: produce a scout report per sub-project via Skill(scout), which spawns Agent(Explore) internally.

### Step 2.1: Create Pipeline Tasks (MANDATORY)

Always create tasks before invoking skills. Wave 1 tasks (repomix, scout, SRS, HLD, gate tasks) are created now. Wave 2 tasks created after HLD+SRS. Full task chains and batching: `references/pipeline-execution.md#dynamic-task-creation`.

**Single sub-project**: Skip parallel — 1 task per phase.

### Step 2.2: Invoke Skill(scout) Per Sub-Project

Invocation format: `references/agent-briefs.md#phase-2-scout-invocation`. Scout spawns its own Agent(Explore) subagents internally. Do NOT spawn Agent(Explore) directly — delegate entirely to the scout skill.

If repomix snapshot unavailable, omit the repomix reference line from the invocation.

**Batching**: Apply Unified Parallel Spawn Rule from `references/pipeline-execution.md#unified-parallel-spawn-rule`. If >15 sub-projects, batch into ceil(N/15) groups. Scout invocations within a batch run in parallel.

### Step 2.3: Verify All Scout Reports

```bash
ls .work/scouts/scout-*-{slug}.md 2>/dev/null
```

**Missing report**: retry once. If retry fails → fallback to Agent(Explore) with brief from `references/agent-briefs.md#phase-2-agentexplore---deprecated-as-of-v300`. If fallback fails → AskUserQuestion: "Scout for {sub-project} failed. Skip, retry, or abort?"

## Phase 3: Plan — Create Execution Plan

**If --auto**: skip Phase 3, proceed directly to Phase 4.

**If no --auto**:
1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope. Use `Skill(sequential-thinking)` if >=3 sub-projects with cross-dependencies or >=4 SDLC phases. Use `Skill(problem-solving)` if scout reports show conflicting signals.
3. On approval, spawn `Agent(general-purpose)` to write `.work/plans/explore-YYYYMMDD--{slug}.md`
4. AskUserQuestion: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode`

## Sync Mode

Detect changes since last exploration, analyze impact, suggest phase updates. Edge cases and troubleshooting: `references/sync-workflow.md`.

### Sync Step 1: Git Change Detection

**Baseline** (priority order):
1. Git tag `explore-*`: `git tag -l 'explore-*' --sort=-creatordate | head -1`
2. Report file timestamp: `ls -t .work/reports/explore-*.md .work/scouts/scout-*.md 2>/dev/null | head -1`, use `stat` for mtime
3. AskUserQuestion: "No previous exploration found. How far back?" (header: "Baseline", options: "7 days" | "14 days" | "30 days" | "Since specific commit")

**Collect changes** after baseline is established. Run Universal Project Discovery (Phase 1 Step 1.1), then per project type:
```bash
git diff --stat $BASELINE..HEAD          # Main repo
git -C <submodule_path> log --oneline $BASELINE..HEAD
git -C <nested_repo_path> log --oneline --since="$DATE"
git log --oneline $BASELINE..HEAD -- <monorepo_path>/
```

**No git**: fallback to `find . -newer <baseline_file>`, warn human. **No changes**: report and offer "Run selected phases anyway?" (Yes/No).

### Sync Step 2: Impact Analysis

**Tier 1 — Rule-Based Mapping:**

| Change Pattern | Glob | SDLC Impact |
|----------------|------|-------------|
| Source code | `src/**`, `lib/**`, `app/**`, `services/**` | **IMP + TST** |
| API contracts | `*.proto`, `*.graphql`, `openapi*`, `contracts/**` | **SRS + LLD** |
| Architecture / Infra | `package.json`, `Dockerfile*`, `docker-compose*`, `terraform/**` | **HLD** |
| Database | `migrations/**`, `*.sql`, `prisma/**` | **LLD + IMP** |
| Tests only | `*.test.*`, `*.spec.*`, `__tests__/**` | **TST** |
| Config | `config/**`, `.env*`, `application*.yml` | **IMP** |
| Docs only | `README*`, `CHANGELOG*`, `docs/**` | **No sync needed** |
| New service/directory | New dir under services/apps/packages | **SRS + HLD + LLD** |

**Tier 2 — AI Deep Analysis**: Trigger when diff > 100 lines, > 10 files, or changes touch core architecture. Spawn `Agent(Explore)` with prompt template from `references/sync-workflow.md#ai-deep-analysis-prompt-template`.

### Sync Step 3: Smart Suggestions

Combine Tier 1 + Tier 2. Present change summary (format: `references/sync-workflow.md#sync-change-summary-format`), then AskUserQuestion (multiSelect, header "Sync Scope") with phases that have relevant changes. Pre-select HIGH-impact phases as `[recommended]`.

### Sync Step 4: Execute Selected Phases

Run selected phases from Phase 4. Dependency auto-resolution: `references/sync-workflow.md#dependency-auto-resolution`. Report final execution list before starting. After execution → Phase 5 (if selected) → Phase 6 with auto-tagging.

## Phase 4: SDLC Pipeline

Execute sequentially. Each step spawns specific agents with briefs from `references/agent-briefs.md`. Full procedural steps with variable substitution, spawn instructions, and gate handling: `references/pipeline-execution.md#phase-execution-steps`.

**CRITICAL — Explicit file paths only**: After Phase 2, collect exact scout report file paths. Never use glob patterns — globs risk picking up stale reports from previous runs.

### Pipeline Flow

```
Agent(srs) [1 agent, reads all scout reports]
  → Agent(gate-verifier) → [re-spawn srs if reject]
→ Agent(hld) [1 agent, system-wide ADRs + C4]
  → Agent(gate-verifier) → [re-spawn hld if reject]
→ Agent(lld-service) × N [parallel, 1 per service]
  → Agent(gate-verifier) × N [parallel]
→ Agent(lld-merge) [1 agent, index + cross-cutting]
  → Agent(gate-verifier) → [re-spawn lld-merge if reject]
→ Agent(imp) × I + Agent(tst) × T [parallel, 1 per FR group]
  → Agent(gate-verifier) × I + Agent(gate-verifier) × T [parallel]
```

**N** = services in domain-service-mapping.yaml. **I** = IMP agents, **T** = TST agents (per FR Distribution Rule).

### Key Execution Notes

- **Step 4.4 (FR Distribution)**: CRITICAL, DO NOT SKIP — groups FRs into agent assignments. Topic-first, max 5 FRs/agent, even distribution. Procedure: `references/pipeline-execution.md#step-44-fr-distribution--critical-do-not-skip`.
- **Step 4.5 (Wave 2 Task Creation)**: CRITICAL, DO NOT SKIP — creates IMP, TST, gate, sprint, summary tasks. Procedure: `references/pipeline-execution.md#step-45-wave-2-task-creation--critical-do-not-skip`.
- **Steps 4.6-4.7 (IMP + TST)**: Run in parallel, 1 agent per FR group. **CRITICAL — BATCH, DO NOT SPAWN ALL AT ONCE**: IMP+TST combined per batch ≤15 agents. 50 agents → 4 batches of ~13. Each batch: launch IMP agents + corresponding TST agents together, wait all complete, then next batch.
- **Step 4.8 (Gate IMP+TST)**: Verify each FR group. All gates must pass before Phase 5.

### Parallel Spawn + Gate Rules

- **Unified Parallel Spawn Rule**: ⚠️ **NEVER spawn >15 agents at once.** For IMP+TST, count combined (I+T). >15 → ceil(N/15) balanced batches. Wait for each batch to complete before spawning the next. Authoritative: `references/pipeline-execution.md#unified-parallel-spawn-rule`.
- **Gate Rejection**: Max 3 re-spawns per failing agent (not batch). Pass gate feedback. After 3 failures → stop pipeline, report to human. `references/pipeline-execution.md#gate-rejection-handling`.

### Pipeline Self-Check

After Phase 4: verify all phases executed, agent counts match FR Distribution, all gates resolved. Missing phases → re-run. Missing agents → spawn. Unresolved rejections → pipeline stopped.

## Phase 5: Sprint Integration

Use `Skill(sprint)` for all sprint operations. State routing (Case A/B/C): `references/sprint-integration.md`.

## Phase 6: Summary

Spawn `Agent(general-purpose)` to write `.work/reports/explore-YYYYMMDD--{slug}.md`. 9-section format: `references/report-templates.md#summary-report`. Inputs: all scout reports, SRS, HLD, LLD, IMP, TST.

### Auto-Tag for Future Sync

After Summary completes, create git tag for next Sync baseline.

**Guard checks**: dirty working tree → warn, skip tag. No git → skip. **Sync partial run** → add `--sync` suffix. **All checks pass**:
```bash
git tag "explore-$(date +%Y%m%d)--{slug}" -m "explore: {project_name} ({mode} mode, {N} sub-projects)"
git -C <submodule_path> tag "explore-$(date +%Y%m%d)--{slug}"
git -C <nested_repo_path> tag "explore-$(date +%Y%m%d)--{slug}"
```

Tag naming `explore-YYYYMMDD--{slug}` matches baseline search pattern. If report files need committing first, use `Skill(git)`.

## Key Notes

- **No sandbox.** Agents work directly on the project. Scout reports are the shared foundation.
- **Delegation.** Delegate to Skill(scout) — never spawn Agent(Explore) directly. Gate-verifier needs phase name, not paths. Sprint via Skill(sprint) — never modify sprint files directly.
- **Explicit paths only.** After Phase 2, use exact file paths — never glob patterns.
- **Input-only briefs.** Specify what agents read, not where to write. Agents use their own templates.
- **Parallel where possible.** IMP+TST in parallel. lld-service per service in parallel. Max 15/batch.
- **Error recovery.** Agent error (not gate reject): log, ask human retry/skip. Gate reject: max 3 retries.
- **Report paths.** All output under `.work/`. Backup as `.bak` on overwrite.
- **Language (`--lang`, `--vi`).** `--lang vi|en` sets output language for all docs. `--vi` = `--lang vi`. Only `vi`/`en` supported. Agent briefs: prepend "Write all output in {language}". Technical terms and code identifiers never translated. `--vi --lang en` → English wins.

## Reference Files

- `references/agent-briefs.md` — Prompt templates for all SDLC agents (srs, hld, lld-service, lld-merge, imp, tst, gate-verifier) + deprecated Agent(Explore) fallback + scout invocation format. Load when constructing agent briefs or invoking scout.
- `references/pipeline-execution.md` — Complete pipeline execution steps (4.1-4.8) with variable substitution, Unified Parallel Spawn Rule, Dynamic Task Creation (Wave 1+2), FR Distribution Rule, gate rejection handling, project discovery commands, mode variants. Load when executing the SDLC pipeline or creating tasks.
- `references/report-templates.md` — Full templates: scout report (7 sections), plan file, summary report (9 sections). Load when formatting agent outputs or writing final deliverables.
- `references/sprint-integration.md` — Sprint state routing (Case A/B/C), multi-pattern project handling, edge cases, backup strategy. Load during Phase 5.
- `references/sync-workflow.md` — Sync mode: edge cases (no git, dirty tree, no changes, first exploration, submodule mismatch, nested gitignored repos), AI deep analysis prompt template, change summary format example, dependency auto-resolution, troubleshooting. Load during Sync mode.

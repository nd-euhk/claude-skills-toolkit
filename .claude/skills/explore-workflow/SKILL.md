---
name: explore-workflow
description: >-
  Explore and analyze codebases end-to-end with workflow-driven SDLC pipeline (SRS, HLD, LLD, IMP, TST).
  Delegates the deterministic Phase 4 agent chain to the explore-pipeline workflow for resumability and token efficiency.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: "[full][architect][sync] [--auto] [--lang vi|en] [--en]"
version: 1.0.0
allowed-tools: Read, Bash(*), AskUserQuestion, Agent, Skill, Workflow, EnterPlanMode, ExitPlanMode
---

# Explore Codebase (Workflow-Driven)

Explore codebases end-to-end: discover sub-projects → pack with repomix → scout with Skill(scout) → delegate SDLC Pipeline to explore-pipeline workflow → sync sprint artifacts → summarize.

**Key difference from explore-codebase**: Phase 4 (SDLC Pipeline) runs as a single `workflow()` call instead of manual agent orchestration. Benefits: resumable pipeline, automatic gate retry, system-managed concurrency, token-efficient (intermediate results stay in script variables, not Claude's context).

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (empty) → AskUserQuestion
- **--auto**: skip plan mode, execute directly
- **--lang vi|en**: output language. `vi` (Vietnamese, default) and `en` (English). Only these two values supported — reject others.
- **--en**: shorthand for `--lang en`. If both present, `--lang` takes precedence.

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto] [--lang vi|en] [--en]

MATCH mode:
  full      → Phase 1 (Scout)
  architect → Phase 1 (Scout) then skip to HLD
  sync      → ## Sync Mode (skip Phases 1-3)
  (empty)   → AskUserQuestion: "Which exploration mode?" (header: "Explore Mode")
              Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"
```

| Mode | Flow | Use when |
|------|------|----------|
| **Full** | Scout → Plan(opt) → Workflow Pipeline → Sprint → Summary | First exploration, need all docs |
| **Architect** | Scout → Plan(opt) → Workflow Pipeline (SRS+HLD only) → Summary | Architecture only |
| **Sync** | Git Change Detection → Impact Analysis → Smart Suggestions → Human ✓ → Selected Phases | Update existing docs |

## Phase 1: Scout — Discover Sub-Projects

Goal: discover sub-projects via 4 patterns, pull latest source, pack each with repomix.

### Step 1.1: Universal Project Discovery

Detect all sub-project patterns simultaneously. Merge results, deduplicate overlaps.

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

### Step 2.1: Invoke Skill(scout) Per Sub-Project

Invocation format — same as explore-codebase:
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
Write the final report to .work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md.")
```

If repomix snapshot unavailable, omit the repomix reference line.

**Batching**: If >15 sub-projects, batch into ceil(N/15) groups. Scout invocations within a batch run in parallel. Wait for batch completion before next batch.

### Step 2.2: Verify All Scout Reports

```bash
ls .work/scouts/scout-*-{slug}.md 2>/dev/null
```

**Missing report**: retry once. If retry fails → fallback to Agent(Explore). If fallback fails → AskUserQuestion: "Scout for {sub-project} failed. Skip, retry, or abort?"

## Phase 3: Plan — Create Execution Plan

**If --auto**: skip Phase 3, proceed directly to Phase 4.

**If no --auto**:
1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope. Use `Skill(sequential-thinking)` if >=3 sub-projects with cross-dependencies or >=4 SDLC phases. Use `Skill(problem-solving)` if scout reports show conflicting signals.
3. On approval, spawn `Agent(general-purpose)` to write `.work/plans/explore-YYYYMMDD--{slug}.md`
4. AskUserQuestion: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode`

## Sync Mode

Detect changes since last exploration, analyze impact, suggest phase updates.

### Sync Step 1: Git Change Detection

**Baseline** (priority order):
1. Git tag `explore-*`: `git tag -l 'explore-*' --sort=-creatordate | head -1`
2. Report file timestamp: `ls -t .work/reports/explore-*.md .work/scouts/scout-*.md 2>/dev/null | head -1`, use `stat` for mtime
3. AskUserQuestion: "No previous exploration found. How far back?" (header: "Baseline", options: "7 days" | "14 days" | "30 days" | "Since specific commit")

**Collect changes** after baseline is established. Run Universal Project Discovery, then per project type:
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

**Tier 2 — AI Deep Analysis**: Trigger when diff > 100 lines, > 10 files, or changes touch core architecture. Spawn `Agent(Explore)` to analyze impact.

### Sync Step 3: Smart Suggestions

Combine Tier 1 + Tier 2. Present change summary, then AskUserQuestion (multiSelect, header "Sync Scope") with phases that have relevant changes. Pre-select HIGH-impact phases as `[recommended]`.

### Sync Step 4: Execute Selected Phases

Run selected phases via Phase 4 workflow (if SRS/HLD/LLD/IMP/TST selected) → Phase 5 (if selected) → Phase 6 with auto-tagging.

## Phase 4: Workflow-Driven SDLC Pipeline

This is the key difference from explore-codebase. Instead of manually orchestrating agents, delegate the entire SDLC pipeline to the **explore-pipeline** workflow.

### Step 4.1: Prepare Workflow Args

Collect all inputs the workflow needs:

```js
const workflowArgs = {
  projectName: "{project-name}",
  runDate: "{YYYY-MM-DD}",
  slug: "{slug}",
  scoutReports: [
    ".work/scouts/scout-YYYYMMDD-{name1}--{slug}.md",
    ".work/scouts/scout-YYYYMMDD-{name2}--{slug}.md",
    // ...explicit paths, never globs
  ],
  language: "{vi|en}",
  mode: "{full|architect}",
}
```

**Explicit file paths only** — collect exact scout report paths from Phase 2 output. Never use glob patterns.

### Step 4.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/explore-pipeline.js", args: workflowArgs })
```

The workflow handles:
- SRS → gate → retry (max 3)
- HLD → gate → retry (max 3)
- LLD per service (pipeline) → gate per service → retry
- LLD merge → gate → retry
- FR Distribution (agent reads SRS+LLD, groups FRs by topic)
- IMP+TST per FR group (pipeline) → gate per group → retry
- Automatic concurrency management (system caps at 16)

**Architect mode**: workflow stops after HLD gate, returns early.

### Step 4.3: Process Workflow Results

```js
const result = await workflow(...)

// Check for phase failures
if (result.error) {
  // Report which phase failed and why
  // Offer human: retry, skip, or abort
}
```

**Full mode result structure:**
```js
{
  mode: 'full',
  completed: ['SRS', 'HLD', 'LLD', 'LLD-merge', 'FR-Dist', 'IMP+TST'],
  services: 3,
  frDistribution: { totalFRs: 42, totalGroups: 12, groups: [...] },
  results: {
    srs: { passed: true },
    hld: { passed: true },
    lld: 3,  // count passed
    merge: { passed: true },
    impTst: {
      total: 12,
      impPassed: 12, impFailed: [],
      tstPassed: 12, tstFailed: [],
    }
  }
}
```

**Architect mode result structure:**
```js
{
  mode: 'architect',
  completed: ['SRS', 'HLD'],
  srsGate: { passed: true },
  hldGate: { passed: true }
}
```

### Step 4.4: Pipeline Self-Check

Verify workflow completed all expected phases. If workflow returned errors:
- **SRS/HLD failure**: report to human, offer retry/abort
- **LLD service failure**: report which services, offer retry/skip/abort
- **IMP/TST group failure**: report which FR groups, offer retry/skip/abort

## Phase 5: Sprint Integration

Use `Skill(sprint)` for all sprint operations. State routing (Case A/B/C):

- **Case A — No sprint artifacts**: Create fresh from templates. Sync bottom-up after workflow results.
- **Case B — Existing artifacts, same project**: Update with new exploration findings.
- **Case C — Existing artifacts, different project**: AskUserQuestion whether to replace or create parallel artifacts.

## Phase 6: Summary

Spawn `Agent(general-purpose)` to write `.work/reports/explore-YYYYMMDD--{slug}.md`. 9-section format:
1. Executive Summary
2. Project Overview (sub-projects discovered)
3. Architecture Summary
4. Services Overview
5. Functional Requirements (from workflow frDistribution)
6. Implementation Overview
7. Test Coverage Overview
8. Quality Gates (from workflow results)
9. Recommendations

Inputs: all scout reports, SRS, HLD, LLD, IMP, TST outputs.

### Auto-Tag for Future Sync

After Summary completes, create git tag for next Sync baseline.

**Guard checks**: dirty working tree → warn, skip tag. No git → skip. **Sync partial run** → add `--sync` suffix. **All checks pass**:
```bash
git tag "explore-$(date +%Y%m%d)--{slug}" -m "explore: {project_name} ({mode} mode, {N} sub-projects)"
git -C <submodule_path> tag "explore-$(date +%Y%m%d)--{slug}"
git -C <nested_repo_path> tag "explore-$(date +%Y%m%d)--{slug}"
```

## Key Notes

- **Workflow delegation.** Phase 4 is a single `workflow()` call. The workflow script handles all agent orchestration, gate retry, and concurrency. Do NOT manually spawn SDLC agents.
- **Resumable.** If workflow is paused/killed, resume in-session — completed agents return cached results instantly.
- **No sandbox.** Agents work directly on the project. Scout reports are the shared foundation.
- **Delegation.** Delegate to Skill(scout) — never spawn Agent(Explore) directly. Sprint via Skill(sprint) — never modify sprint files directly.
- **Explicit paths only.** After Phase 2, use exact file paths — never glob patterns.
- **Language (`--lang`, `--en`).** `--lang vi|en` sets output language (default: `vi`). `--en` = `--lang en`. Only `vi`/`en` supported. Technical terms and code identifiers never translated. `--en --lang vi` → Vietnamese wins.

## Comparison: explore-codebase vs explore-workflow

| Aspect | explore-codebase | explore-workflow |
|--------|-----------------|-----------------|
| Phase 1-3 (Scout/Plan) | Manual orchestration | Same (no difference) |
| Phase 4 (SDLC Pipeline) | Manual agent spawn + gate + retry + batching | Single `workflow()` call |
| Gate retry | Manual loop in Claude's context | Automatic in script |
| Concurrency (≤15 rule) | Claude must batch manually | System handles automatically |
| Intermediate results | In Claude's context | In script variables |
| Resumability | Re-run from start on failure | Resume with cached results |
| FR Distribution | Claude reads files, groups manually | Agent in workflow reads + returns structured data |
| Token efficiency | All intermediate state in context | Only final structured result in context |
| Phase 5-6 (Sprint/Summary) | Manual | Same (no difference) |

## Reference Files

- `references/workflow-handoff.md` — Workflow args structure, result schemas, error handling patterns, and manual override guidance.

---
name: sdlc:explore-backup
description: >-
  Explore and analyze codebases end-to-end with workflow-driven SDLC pipeline (SRS, HLD, LLD, IMP, TST).
  Delegates the deterministic Phase 4 agent chain to the workflow-sdlc-explore-pipeline workflow for resumability and token efficiency.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: "[full][architect][sync] [--auto] [--lang vi|en] [--en]"
version: 1.3.3
allowed-tools: Read, Bash(*), AskUserQuestion, Agent, Skill, Workflow, EnterPlanMode, ExitPlanMode
---

# Explore Codebase (Workflow-Driven)

Explore codebases end-to-end: discover sub-projects → pack with repomix → scout via workflow → delegate SDLC Pipeline to workflow → sync sprint artifacts → summarize.

**Key difference from explore-codebase**: Phase 2 (Scout) and Phase 4 (SDLC) each run as a single `Workflow()` call instead of manual agent orchestration. Benefits: resumable pipeline, automatic gate retry, system-managed concurrency, token-efficient (intermediate results stay in script variables).

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (empty) → AskUserQuestion
- **--auto**: skip plan mode, execute directly
- **--lang vi|en**: output language. Default `vi`. Only `vi`/`en` supported — reject others.
- **--en**: shorthand for `--lang en`. If both present, `--lang` takes precedence.

### Step 2: Route to Mode

| Mode | Flow | Use when |
|------|------|----------|
| **Full** | Scout → Plan(opt) → Workflow Pipeline (all phases) → Sprint → Summary | First exploration, need all docs |
| **Architect** | Scout → Plan(opt) → Workflow Pipeline (SRS+HLD only) → Summary | Architecture only |
| **Sync** | Git Change Detection → Impact Analysis → Smart Suggestions → Selected Phases | Update existing docs |

If no mode specified, use AskUserQuestion:
- Question: "Which exploration mode?" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

**Routing:**
- `full` → Phases 1 → 2 → 3 → 4 (complete pipeline) → 5 → 6
- `architect` → Phases 1 → 2 → 3 → 4 (stops after HLD gate) → 6
- `sync` → See `references/sync-mode.md` for the complete Sync Mode workflow (Git change detection, impact analysis, smart suggestions, then selected Phase 4 phases → 5 → 6)

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

**CRITICAL: MUST use `Skill(repomix, ...)` — NEVER run repomix via Bash directly.**

The repomix skill handles installation checks, absolute `-o` path resolution, token counting, and Secretlint security validation. Bypassing it with Bash loses ALL of these protections and introduces silent failures (relative output paths, missing security audit, no token report for scout scaling).

**Do NOT do this** (Bash bypass — loses all protections):
```
Bash(repomix /path/to/project --style xml -o output.xml)
```

**ALWAYS do this** (Skill — full validation pipeline):
```
Skill(repomix, "{path} --style xml --remove-comments -o $PWD/.work/repomix/{project-name}--{slug}.xml")
```

The Skill tool auto-checks installation. If repomix is missing, the skill will detect it. If the skill reports it's not installed, use AskUserQuestion:
- Question: "Repomix is not installed. It accelerates exploration by pre-packing files. Install?" (header: "Repomix")
- Options: "Install repomix (Recommended)" | "Skip — proceed without it"

**Multi-subproject** — invoke Skill sequentially per sub-project. Pass directory as first positional argument, use absolute `-o` path (Skill resolves relative paths against `$PWD` but absolute is safer):
```
Skill(repomix, "{path} --style xml --remove-comments -o $PWD/.work/repomix/{project-name}--{slug}.xml")
```

**Single project** — same pattern, record token count from Skill output for scout scaling:
```
Skill(repomix, ". --style xml --remove-comments -o $PWD/.work/repomix/root--{slug}.xml")
```

Do NOT split into areas here — scout handles internal subdivision. If repomix fails: log warning, skip snapshot, continue.

## Phase 2: Scout — Explore All Sub-Projects via Workflow

Goal: produce a scout report per sub-project. All N sub-projects handled by **one** `Workflow()` call — the workflow spawns one Explore agent per sub-project, pipelines results independently, and writes all reports.

### Step 2.1: Prepare Workflow Args

For each discovered sub-project, build an entry with paths, repomix snapshot, and output path:

```js
const subProjects = discoveredProjects.map(p => ({
  name: p.name,                                // sub-project name
  paths: [p.path],                             // array of directory paths to scout
  projectType: p.type,                         // node | python | go | rust | ...
  outputPath: `.work/scouts/scout-YYYYMMDD-${p.name}--${slug}.md`,
  repomixSnapshot: p.repomixFile || null,      // .work/repomix/{name}--{slug}.xml or null
  patterns: p.suggestedPatterns || null,        // optional: keyword hints for Grep
  focus: p.focus || null,                       // optional: focus description
}))

const workflowArgs = {
  subProjects,
  language,  // from --lang flag, default 'vi'
}
```

**outputPath convention:** `.work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md`

### Step 2.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js", args: workflowArgs })
```

The workflow handles:
- **Phase Preflight**: idempotent skip — check existing reports, skip already-completed sub-projects
- **Phase Scout**: pipeline over sub-projects — one Explore agent per sub-project, structured schema output (SCOUT_FINDING)
- **Phase Report**: per sub-project — dedup files, write structured markdown report to outputPath
- **Phase Audit**: cross-project completeness check — identify gaps, missed directories, uncovered topics

All sub-projects stream independently via `pipeline()` — sub-project B's scout starts while A's report is being written.

### Step 2.3: Process Results

**Success:**
```js
{
  mode: 'scout',
  status: 'completed',
  results: {
    subProjects: 5,
    completed: 5,
    failed: 0,
    totalFiles: 210,
    reports: [
      { name: "auth-service", outputPath: ".work/scouts/scout-20260611-auth-service--myproject.md", filesFound: 42, highRelevance: 15, ... },
      // ...
    ],
  }
}
```

**Partial failure:**
```js
{ mode: 'scout', status: 'completed', results: { completed: 4, failed: 1, failedReports: [{name, outputPath}], ... } }
```

### Step 2.4: Handle Failures

**Missing report / failed agent**: retry once by re-invoking workflow with only the failed sub-projects. If retry fails → AskUserQuestion: "Scout for {sub-project} failed. How to proceed?" (header: "Scout Failed", options: "Retry with Agent(Explore)" | "Skip" | "Abort")

## Phase 3: Plan — Create Execution Plan

**If --auto**: skip Phase 3, proceed directly to Phase 4.

**If no --auto**:
1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope. Use `Skill(sequential-thinking)` if ≥3 sub-projects with cross-dependencies OR ≥4 SDLC phases requested. Use `Skill(problem-solving)` if scout reports show conflicting architectural signals.
3. On approval, spawn `Agent(general-purpose)` to write `.work/plans/explore-YYYYMMDD--{slug}.md`
4. AskUserQuestion: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode`

## Phase 4: Workflow-Driven SDLC Pipeline

This is the key difference from explore-codebase. Instead of manually orchestrating agents, delegate the entire SDLC pipeline to the **workflow-sdlc-explore-pipeline** workflow.

**Pipeline phases** (internal to workflow): SRS decomposed into FR-Discovery (pipeline per scout report) → NFR-Inference (config analysis) → SRS-Consolidate → Gate SRS, then HLD → Gate HLD → LLD per service → LLD Merge → FR Distribution → IMP+TST → Gate IMP+TST.

### Step 4.1: Prepare Workflow Args

Collect all inputs the workflow needs. Core fields: `projectName`, `runDate`, `slug` (from Phase 1), `scoutReports` (explicit file paths from Phase 2 output — never glob patterns), `language` (from `--lang` flag, default `vi`), `mode` (`full` or `architect`). Optional: `fromPhase` to force-skip directly to a specific phase on retry (omit on first run — workflow auto-detects completed phases).

Full args schema, result structures, and error handling patterns: `references/workflow-handoff.md`.

### Step 4.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

The workflow handles: idempotent retry (completed phases auto-skipped via `checkPhaseStatus()`), decomposed SRS phase (FR-Discovery agents run in pipeline per scout report, NFR-Inference runs in parallel), gate verification with max 3 retries per phase, automatic concurrency management, and FR distribution. **Architect mode**: workflow stops after HLD gate, returns early.

### Step 4.3: Process Workflow Results

On success, the workflow returns a structured result. On error, it returns `phase` (which phase failed), `error` (description), and optionally `failed` (list of failed services/groups).

Full result schemas for both modes: `references/workflow-handoff.md`.

### Step 4.4: Pipeline Self-Check

Verify workflow completed all expected phases. If workflow returned errors, use AskUserQuestion per failure type:

**FR-Discovery failure (partial):**
- Question: "FR-Discovery gate failed for {N} area(s): {names}. Other areas passed. How to proceed?" (header: "FR-Discovery Failed")
- Options: "Retry failed areas" | "Skip and continue" | "Abort"

**SRS-Consolidate/HLD failure (blocking):**
- Question: "SRS phase failed gate after 3 retries. Feedback: {feedback}. How to proceed?" (header: "SRS Gate Failed")
- Options: "Retry SRS" | "Skip and proceed" | "Abort"

**LLD service failure (partial):**
- Question: "LLD gate failed for {N} service(s): {names}. Other services passed. How to proceed?" (header: "LLD Gate Failed")
- Options: "Retry failed services" | "Skip and continue" | "Abort"

**IMP/TST group failure (partial):**
- Question: "IMP/TST gate failed for {N} group(s): {group_ids}. How to proceed?" (header: "IMP/TST Gate Failed")
- Options: "Retry failed groups" | "Skip and continue" | "Abort"

On retry, re-invoke workflow with `fromPhase` arg to skip directly to the failed phase.

## Phase 5: Sprint Integration

Use `Skill(sprint)` for all sprint operations. State routing:

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

- **Workflow delegation.** Phase 4 is a single `Workflow()` call. The workflow script handles all agent orchestration, gate retry, and concurrency. Do NOT manually spawn SDLC agents.
- **Idempotent retry.** On gate failure, re-invoke workflow with same args — completed phases auto-skipped (output detection). Use `fromPhase` arg to force-skip directly to a specific phase.
- **Resumable.** If workflow is paused/killed, resume in-session — completed agents return cached results instantly.
- **No sandbox.** Agents work directly on the project. Scout reports are the shared foundation.
- **Delegation.** Phase 2 delegates to `workflow-sdlc-scout-pipeline` — never spawn Agent(Explore) directly for scouting. Sprint via Skill(sprint) — never modify sprint files directly.
- **Tooling via Skill, not Bash.** Always invoke repomix via `Skill(repomix, ...)` — never Bash directly. The skill handles installation, absolute paths, token counting, and security checks that Bash bypasses silently.
- **Explicit paths only.** After Phase 2, use exact file paths — never glob patterns.
- **Language (`--lang`, `--en`).** `--lang vi|en` sets output language (default: `vi`). `--en` = `--lang en`. Only `vi`/`en` supported. Technical terms and code identifiers never translated. `--en --lang vi` → Vietnamese wins.

## Reference Files

- `references/sync-mode.md` — Complete Sync Mode workflow: Git change detection (3 baseline strategies), Tier 1 rule-based + Tier 2 AI impact analysis, smart suggestions with human approval, and selected phase execution. Use when `mode=sync` or updating existing exploration documentation.
- `references/workflow-handoff.md` — Workflow args schema, result structures for full and architect modes, error handling patterns with AskUserQuestion options, manual override fallback, and comparison table (sdlc-explore vs explore-codebase).

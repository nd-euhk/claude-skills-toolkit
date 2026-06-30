---
name: sdlc:fixbug
description: >-
  Fix bugs with workflow-driven verification pipeline (preFix→parallel checks→code review→sideEffect→prevention).
  Delegates deterministic Step 5 to workflow-sdlc-fixbug-pipeline for resumability and token efficiency.
  Use when fixing bugs at scale or when resumable verification matters.
  Trigger phrases: fix the bug, resolve error, debug, test failure, CI failing, type error, lint error, runtime error, not working.
  Supports --auto, --review, --quick, --parallel mode flags.
argument-hint: "[issue] --auto|--review|--quick|--parallel"
version: 1.0.0
when_to_use: "Invoke when there is a concrete bug, error, or CI failure and you want workflow-driven verification with resumability."
category: sdlc
keywords: [bugfix, error, test-failure, CI, lint, workflow, verify]
allowed-tools: Read, Write, Edit, Bash(*), TaskCreate, TaskUpdate, TaskGet, TaskList, Agent, AskUserQuestion, WebFetch, WebSearch, Workflow, Skill
---

# SDLC Fix Bug (Hybrid: Skill + Workflow)

Fix issues with intelligent routing. **Skill** handles interactive phases (mode selection, scout, diagnose, fix). **Workflow** handles the deterministic verify pipeline (Step 5) for resumability and token efficiency.

**Key difference from fixbug**: Step 5 (Verify + Prevent) runs as a single `workflow()` call. Benefits: resumable pipeline, parallel fan-out for typecheck/lint/build/test, automatic retry, token-efficient (intermediate results stay in script variables).

## Quick Start

### Step 0: Mode Selection

Detect mode flags in the user's message to skip selection:

| Flag | Mode | Behavior |
|------|------|----------|
| `--auto` | Autonomous (**default**) | Auto-approve when quality gates pass; high-risk fixes stop for approval |
| `--quick` | Quick | Fast scout-diagnose-fix cycle for trivial issues (lint, type errors) |
| `--review` | Human-in-the-loop | Pause for approval at each major step |
| `--parallel` | Parallel | Route to parallel agents per independent issue |

**If no flag**, detect by issue type:
- Type errors, lint errors → Quick
- Single file bugs → Quick or Autonomous
- Multi-file, unclear root cause → Autonomous
- Production/critical code → Human-in-the-loop

### Step 1: Scout (MANDATORY)

<HARD-GATE-SCOUT-FIRST>
Always scan the codebase BEFORE asking questions or forming hypotheses. Mandatory outputs:

1. Project type, language(s), framework(s) — from package.json/pyproject.toml/go.mod/etc.
2. The exact file(s) where the symptom surfaces + their direct callers/dependents
3. Related tests covering the affected area
4. Recent commits (`git log --oneline -20`) touching scouted files
5. Existing patterns/conventions for this kind of code
</HARD-GATE-SCOUT-FIRST>

Launch `Skill(scout)` or 2-3 parallel `Agent(Explore)` subagents to map the affected area.

**Output:** `✓ Step 1: Scouted - [N] files mapped, [M] dependencies, [K] tests found`

### Step 2: Diagnose (MANDATORY)

<HARD-GATE-EXACT-ROOT-CAUSE>
Do NOT propose a fix until you can answer ALL in one concrete sentence each:

1. **Exact symptom**: precise error message / failing assertion (verbatim, not paraphrased)
2. **Reproduction steps**: minimal sequence that triggers it (commands, inputs, environment)
3. **Expected vs actual**: what SHOULD happen vs what DOES happen
4. **Root cause** (not symptom): underlying defect with file:line evidence
5. **Why now**: what change/condition exposed it (recent commit, data shape, env, dep upgrade)
6. **Blast radius**: every code path that depends on the broken behavior
</HARD-GATE-EXACT-ROOT-CAUSE>

**Mandatory chain:**
1. **Capture pre-fix state:** Record exact error messages, failing tests, stack traces — this is the baseline for Step 5 verification
2. Activate `Skill(debugging)` + `Skill(sequential-thinking)` — structured hypothesis formation, NOT guessing
3. Spawn parallel `Agent(Explore)` to test each hypothesis against codebase evidence
4. If 2+ hypotheses fail → activate `Skill(problem-solving)`

**Output:** `✓ Step 2: Diagnosed - Root cause: [summary], Evidence: [chain], Blast radius: [N paths]`

### Step 3: Complexity Assessment

Classify before routing:

| Level | Indicators | Step 5 Workflow Mode |
|-------|------------|---------------------|
| **Simple** | Single file, clear error, type/lint | `quick` — typecheck + lint only, skip code-review |
| **Moderate** | Multi-file, root cause unclear | `standard` — full verification pipeline |
| **Complex** | System-wide, architecture impact | `deep` — full pipeline + brainstorm + research verify |
| **Parallel** | 2+ independent issues OR `--parallel` flag | Separate workflow per issue |

**Task Orchestration (Moderate+):** Create Tasks with `TaskCreate` + `addBlockedBy` for dependency chains. Skip for Quick mode.

**Output:** `✓ Step 3: [Complexity] - [workflow mode] selected`

### Step 4: Fix Implementation

- Fix the ROOT CAUSE per diagnosis — not symptoms
- Minimal changes only. Follow existing patterns from Step 1 scout.
- Update Tasks as phases complete.

<HARD-GATE>
If 3+ fix attempts fail, STOP and question the architecture. Discuss with user before more attempts.
</HARD-GATE>

**Output:** `✓ Step 4: Fixed - [N] files changed`

### Step 5: Verify + Prevent (WORKFLOW)

This is the deterministic phase — delegate to workflow for resumability and parallel efficiency.

#### Step 5.1: Prepare Workflow Args

```js
const workflowArgs = {
  bugId: "BUG-YYYYMMDD-{FR-ID}--{slug}",
  rootCause: "{1-line root cause summary from Step 2}",
  blastRadius: ["{path1}", "{path2}"],       // from Step 2
  affectedFiles: ["{file1}", "{file2}"],      // files in blast radius
  fixFiles: ["{file1}", "{file2}"],           // files actually changed
  projectType: "{node|python|go|...}",        // from Step 1
  preFixState: "{exact error from Step 2}",
  verifyCommands: ["{cmd1}", "{cmd2}"],       // EXACT commands from Step 2 pre-fix capture
  language: "{vi|en}",
  workflowMode: "standard",                   // quick | standard | deep (from Step 3)
}
```

#### Step 5.2: Invoke Workflow

Verify the script exists first:
```
ls .claude/workflows/workflow-sdlc-fixbug-pipeline.js
```

If missing → fall back to manual verification (same as fixbug skill Step 5).

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-fixbug-pipeline.js", args: workflowArgs })
```

The workflow handles:
- Pre-fix state verification (re-run exact commands, compare output)
- Parallel: typecheck + lint + build + test
- Code review (code-reviewer with schema output)
- Side-effect sweep (blast radius tests)
- Prevention gate validation
- Artifact writing (.work/bugs/{BUG-ID}/)
- Automatic retry on gate failure (max 3)

#### Step 5.3: Result Structure

**Success:**
```js
{
  mode: 'fixbug-verify',
  status: 'passed',
  results: {
    preFixVerify: { symptomFixed: true, output: "..." },
    parallelChecks: { typecheck: true, lint: true, build: true, test: true },
    codeReview: { passed: true, score: 9, feedback: "..." },
    sideEffectSweep: { passed: true, pathsChecked: 5 },
    preventionGate: { passed: true, testsAdded: 2, guardsAdded: 1 },
    artifacts: ["verification.json", "risk-gate.json", "review-decision.json", "side-effect-sweep.json"],
  }
}
```

**Error (gate failure after 3 retries):**
```js
{
  mode: 'fixbug-verify',
  status: 'failed',
  phase: 'codeReview',  // which phase failed
  feedback: "Root cause not actually addressed...",
}
```

#### Step 5.4: Process Results

Follow error handling patterns in `references/error-handling.md`. Quick reference:

- **preFixVerify fails** → symptom still reproduces. Loop back to Step 2 (re-diagnose)
- **parallelChecks fail** → new errors introduced. Fix and re-run verify
- **codeReview fails** → AskUserQuestion: rework fix / accept risk / abort
- **sideEffectSweep fails** → AskUserQuestion with 2-4 options (revert / narrow scope / update dependents / accept)

**On any side effect / regression:** present what broke, why, and 2-4 concrete options. Never silently patch.

<HARD-GATE-NO-SIDE-EFFECTS>
After 3+ failed verify attempts → STOP, question architecture, discuss with user.
</HARD-GATE-NO-SIDE-EFFECTS>

### Step 6: Finalize (MANDATORY)

1. **Write bug summary report** to `.work/bugs/{BUG-ID}.md` with frontmatter:
   - affected FR(s), root cause, symptom vs cause, fix applied, blast radius
   - side-effect sweep results, prevention measures, artifacts list, confidence score

2. **Activate `Skill(sprint)` (MANDATORY)** → sync plan/task status, update progress, generate status report

3. `TaskUpdate` → mark ALL tasks `completed`

4. Ask user if they want to commit via `Agent(git-manager)`

5. Spawn `Agent(journal-writer)` for technical journal entry

**Output:** `✓ Step 6: Complete - [action taken]`

## Output Format

```
✓ Step 0: [Mode] selected
✓ Step 1: Scouted - [N] files, [M] deps
✓ Step 2: Diagnosed - Root cause: [summary]
✓ Step 3: [Complexity] detected - [workflow mode] selected
✓ Step 4: Fixed - [N] files changed
✓ Step 5: Verified + Prevented - [workflow status], [artifacts]
✓ Step 6: Complete - [action taken]
```

## Skill/Subagent Activation Matrix

| Step | Always Activate | Conditional |
|------|----------------|-------------|
| 0 | — | `AskUserQuestion` (no flag) |
| 1 | `Skill(scout)` or parallel `Agent(Explore)` | — |
| 2 | `Skill(debugging)` + `Skill(sequential-thinking)` | `Skill(problem-solving)` (2+ hypotheses fail) |
| 3 | — | — |
| 4 | — | `Skill(sequential-thinking)` (complex logic) |
| 5 | `Workflow(workflow-sdlc-fixbug-pipeline)` | Fallback: manual verification |
| 6 | `Skill(sprint)` | `Agent(git-manager)`, `Agent(journal-writer)` |

## Important Notes

**Workflow delegation.** Step 5 is a single `Workflow()` call. The workflow script handles all verification orchestration, parallel fan-out, gate retry, and artifact writing. Do NOT manually spawn verification agents during execution.

**Resumable.** If workflow is paused/killed, resume in-session — completed agents return cached results instantly.

**Original fixbug preserved.** The `fixbug` skill remains available for non-workflow bug fixing. `sdlc:fixbug` is the workflow-driven alternative.

**Plan mode not needed.** Fixbug has a defined diagnostic flow (Steps 0-3) that serves the same purpose as plan mode. Skip `EnterPlanMode`.

**Workflow file guard.** Before invoking `Workflow()`, verify the script exists. If missing, fall back to manual verification (same as fixbug skill).

**Frontend bugs.** Use `Skill(agent-browser)`, `Skill(chrome-profile)`, Chrome MCP, or project-native browser tests where applicable.

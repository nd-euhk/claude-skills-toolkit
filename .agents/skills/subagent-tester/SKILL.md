---
name: subagent-tester
description: >-
  Test and benchmark Claude Code subagents empirically using evaluation-driven development.
  Use when validating a subagent's effectiveness, comparing subagent vs. baseline performance,
  running benchmarks with timing/token metrics, and iterating on subagent improvements.
  Two modes: Quick Workflow (with_subagent only, no baseline, fast pass/fail) or Full Pipeline
  (7-phase with baseline comparison, timing, aggregation).
version: 1.1.0
allowed-tools: Read,Write,Edit,Bash,Glob,Grep,Agent,AskUserQuestion
---

# Subagent Tester

**Purpose:** Empirically validate Claude Code subagents through evaluation-driven testing. Proves subagents help Claude with data, not intuition.

## Mindset

Subagents must be **measured, not assumed**. This pipeline provides systematic evidence: Does the subagent improve delegation and execution? By how much? What should we improve next?

## Quick Start: The 7-Phase Pipeline

```
Phase 1: Setup          → Identify subagent + choose Quick vs Full mode
Phase 2: Create Evals   → Interview user → write test cases + assertions
Phase 3: Run Tests      → Launch agents (with_subagent + baseline in parallel for Full)
Phase 4: Grade Results  → Evaluate outputs against assertions → grading.json
Phase 5: Aggregate      → Run Python script → benchmark.json (Full only)
Phase 6: Review Summary → Show comparison table + next steps
Phase 7: Iterate        → Update subagent + next iteration (or stop)
```

## Artifact Location

All evaluation artifacts live in `./evals/` at project root. See `references/eval-schema.md` for complete directory structure and JSON schemas.

```
./evals/<subagent-name>/
├── evals.json
└── workspace/
    └── iteration-N/
        ├── eval-{1,2,3}/
        │   ├── eval_metadata.json
        │   ├── with_subagent/{outputs/,grading.json,timing.json}
        │   └── baseline/{outputs/,grading.json,timing.json}
        └── benchmark.json
```

---

## PHASE 1: Setup

**Goal:** Identify the subagent, confirm what it does, choose workflow mode.

### Step 1.1: Discover Available Subagents

Scan with Glob for `*.md` files in `.claude/agents/` and `agents/` (if plugin exists). Present list via AskUserQuestion:

```
question: "Which subagent do you want to test?"
header: "Subagent Selection"
options: [
  {label: "<name>", description: "from <path>"},
  ...
  {label: "Other subagent", description: "Not listed above"}
]
```

### Step 1.2: Confirm Subagent

Read the subagent's `.md` file. Show summary: name, location, model, tools, permission mode, purpose.

### Step 1.3: Choose Workflow Mode

```
question: "Which testing mode?"
header: "Workflow Mode"
options: [
  {label: "Quick Workflow", description: "Fast validation: with_subagent only, no baseline, pass/fail on assertions"},
  {label: "Full Pipeline", description: "Complete: with_subagent + baseline parallel, tokens/timing metrics, aggregate & compare"}
]
```

**If Quick:** Skip to Quick Workflow section. No baseline, no aggregation, no comparison tables — simple pass/fail.

**If Full:** Continue with standard 7-phase pipeline below.

### Step 1.4: Create Workspace

Create `./evals/<subagent-name>/workspace/iteration-1/`.

---

## PHASE 2: Create Evals

**Goal:** Build evaluation cases that measure subagent effectiveness.

### Step 2.1: Interview User

Ask 3 questions (free-form text input):

1. **"What are 2-3 core scenarios this subagent should handle?"** — Example: "code-reviewer should handle: PR diff review, code quality check, security vulnerability scan"
2. **"What makes a GOOD response for each scenario?"** — Example: "Finds real bugs with file paths, provides fix suggestions, no false positives"
3. **"What should FAIL without the subagent?"** — Example: "Baseline will miss domain patterns, give vague feedback, produce inconsistent output"

### Step 2.2: Generate evals.json

Create `./evals/<subagent-name>/evals.json`. See `references/eval-schema.md` for complete schema.

### Step 2.3: Generate eval_metadata.json

For each eval, create `workspace/iteration-1/eval-N/eval_metadata.json` with assertions. See `references/eval-schema.md` for assertion types (delegation, quality, tool_scoping, permission, efficiency, structure, functionality) and schema.

---

## QUICK WORKFLOW (Alternative Path)

**If user chose "Quick Workflow" in Phase 1.3, follow this streamlined path.**

### Quick Phase 1: Run WITH_SUBAGENT Only

For each eval, launch ONE agent (general-purpose) with the full subagent content and eval prompt. Save outputs to `./evals/<subagent-name>/workspace/iteration-1/eval-N/with_subagent/outputs/`. No timing metrics needed.

### Quick Phase 2: Grade Results

For each eval, grade against assertions. Save `with_subagent/grading.json`. See `references/eval-schema.md` for grading.json schema.

### Quick Phase 3: Show Results

```
QUICK VALIDATION RESULTS: <subagent-name>
=========================================
Eval 1: <Scenario>  ✓ PASS (5/5)
Eval 2: <Scenario>  ✗ FAIL (2/5)
Summary: 7/10 assertions passed (70%)
```

### Quick Phase 4: Next Steps

```
options: [
  {label: "Run full pipeline", description: "Complete benchmarking with baseline"},
  {label: "Refine subagent", description: "Update based on failed assertions"},
  {label: "Done", description: "Quick validation complete"}
]
```

---

## PHASE 3: Run Tests (Full Pipeline)

**Goal:** Execute 2 agents per eval (WITH subagent + BASELINE) in parallel.

### Step 3.1: Spawn Agents in Parallel

For EACH eval, launch 2 agents simultaneously:

**Agent 1 (WITH_SUBAGENT):** General-purpose agent. Include full subagent `.md` content. Prompt: accomplish the eval-N task using the subagent. Save outputs to `eval-N/with_subagent/outputs/`. Write `timing.json` with `{total_tokens, duration_ms, model}`.

**Agent 2 (BASELINE):** General-purpose agent. Prompt: accomplish the task WITHOUT any subagent delegation. Save outputs to `eval-N/baseline/outputs/`. Write `timing.json` with `{total_tokens, duration_ms, model}`.

⏸️ Wait for both agents before Phase 4.

---

## PHASE 4: Grade Results

**Goal:** Evaluate outputs against assertions. Create grading.json files.

For each eval:
1. Read `with_subagent/outputs/` and `baseline/outputs/`
2. For each assertion in `eval_metadata.json`: pass/fail + evidence quote
3. Write `with_subagent/grading.json` and `baseline/grading.json`

See `references/eval-schema.md` for complete grading.json schema and evidence collection guidance.

---

## PHASE 5: Aggregate (Full Pipeline)

**Goal:** Compute benchmark.json with summary stats.

Run the aggregation script:

```bash
python .claude/skills/subagent-tester/scripts/aggregate_benchmark.py \
  ./evals/<subagent-name>/workspace/iteration-1
```

This reads all grading.json and timing.json, outputs `benchmark.json`. See `references/eval-schema.md` for schema and interpretation.

---

## PHASE 6: Review Summary

**Goal:** Show comparison table + next steps.

### Step 6.1: Render Comparison

```
EVALUATION RESULTS: <subagent-name> iteration-1
=================================================
Eval 1: [Scenario]
  WITH SUBAGENT: 5/5 (100%) | 3200 tokens | 12s
  BASELINE:      3/5 (60%)  | 2500 tokens | 8s
  DELTA:         +40%        | +700 tokens  | +4s

SUMMARY: With Subagent 90% | Baseline 60% | Improvement +30 points
```

### Step 6.2: Next Steps

```
options: [
  {label: "Iterate", description: "Update subagent + run iteration-2"},
  {label: "Stop", description: "Satisfied, save benchmark data"},
  {label: "Refine evals", description: "Update test cases, rerun iteration"}
]
```

---

## PHASE 7: Iterate

**Goal:** Update subagent based on results, run next iteration.

### Step 7.1: Get Improvement Feedback

Ask: "What would you like to improve?" (free-form text).

### Step 7.2: Update Subagent

Use subagent-creator (refine) or direct edits to improve delegation signals, tool scoping, prompt clarity, or permission mode.

### Step 7.3: Run Next Iteration

Create `workspace/iteration-2/`. Repeat Phases 3–6.

### Step 7.4: Compare Iterations

```
Iteration 1: 60% → Iteration 2: 95% (+35 points, +400 tokens)
```

Loop back to Phase 6. Stop when: pass rate ≥ 95%, improvement ≥ 30 points, or diminishing returns (<5 points delta).

---

## Integration with subagent-creator

```
subagent-creator → subagent.md v1.0 → subagent-tester iteration-1 (70%)
                                              ↓
                                     subagent-creator refine
                                              ↓
                               subagent.md v1.1 → iteration-2 (92%) ✓ Stop
```

---

For detailed schemas and decision points, see:
- `references/eval-schema.md` — All JSON schemas (evals, grading, timing, benchmark), directory structure, assertion types
- `references/workflow.md` — Decision points, evaluation framework, stopping criteria, improvement actions
- `scripts/aggregate_benchmark.py` — Python aggregation script

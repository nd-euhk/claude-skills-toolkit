# Subagent-Tester Workflow Reference

Detailed step-by-step guidance for the full 7-phase evaluation pipeline.

---

## Overview: Why Empirical Testing for Subagents?

Subagents are **isolated execution environments for Claude**. But do they actually improve task execution? The subagent-tester pipeline answers that question with data:

- **Without data:** "This subagent seems useful" (intuition, no proof)
- **With data:** "This subagent improved task accuracy by 35%, at a token cost of 500" (empirical proof)

The pipeline tests a subagent against **baseline Claude** (same task, no subagent delegation). Parallel execution (WITH subagent + BASELINE simultaneously) eliminates confounding variables.

---

## Phase 1: Setup — Identify Subagent & Prepare Workspace

### Decision Point 1.1: Where to Find Subagents?

**Scan locations (project-scoped only):**
- `.claude/agents/` — Project-level subagents
- `agents/` — Plugin-level subagents (if `.claude-plugin/plugin.json` exists)

**Do NOT scan:**
- `~/.claude/agents/` — User-space (off-limits for testing)
- `~/.claude/plugins/cache/` — Installed plugins (read-only)

### Decision Point 1.2: Quick vs Full Pipeline

**Quick Workflow:** Test only with_subagent, no baseline. Fast pass/fail. Good for:
- Initial validation right after creating a subagent
- Quick sanity check after small tweaks
- "Does this subagent basically work?"

**Full Pipeline:** Test with_subagent + baseline in parallel. Full metrics. Good for:
- Comprehensive benchmarking before deployment
- Comparing subagent versions (iteration-1 vs iteration-2)
- Proving subagent value with data

---

## Phase 2: Create Evals — Design Test Cases

### Decision Point 2.1: How Many Test Cases?

- **Minimum:** 1 eval (covers core use case)
- **Typical:** 2–3 evals (covers core cases + edge cases)
- **Comprehensive:** 4–5 evals (core + edge cases + advanced scenarios)

**Example (code-reviewer subagent):**
- Eval 1: Review PR for bugs and security issues
- Eval 2: Check code quality against style guide
- Eval 3: Review complex refactoring with multiple files

### Decision Point 2.2: Assertion Design

See `eval-schema.md` for complete assertion type definitions and schema.

**Assertion checklist:**
- [ ] Each assertion is **specific** (e.g., "finds SQL injection patterns" not "finds security issues")
- [ ] Each assertion is **verifiable** (evidence can be extracted from output)
- [ ] Mix assertion types (don't use all 'quality' — cover delegation + tool_scoping + structure too)
- [ ] 3–5 assertions per eval (thorough without overwhelming)

---

## Phase 3: Run Tests — Execute WITH subagent + BASELINE Parallel

### Decision Point 3.1: Parallel Execution Pattern

**Always run in parallel.** Same task, 2 agents simultaneously.

**Why parallel?**
- Eliminates time-of-day effects
- Eliminates model variation
- Fair comparison: same task, same model, different capability (subagent delegation vs direct)

**Anti-pattern:**
```
Run with_subagent → wait → Run baseline
❌ Wrong: Different timing, possible model state drift
```

**Correct pattern:**
```
Run with_subagent AND baseline simultaneously
✓ Right: Fair comparison, controlled variables
```

### Decision Point 3.2: Model Selection

**Recommendation:**
- Use `claude-sonnet-4-6` for most subagent testing (good balance of capability and cost)
- Use `claude-opus-4-6` for complex subagents (code-review, architecture analysis)
- Use `claude-haiku-4-5` for simple utility subagents (format converters, validators)

Match the model to the subagent's intended use case.

### Decision Point 3.3: Baseline Agent Instructions

The baseline agent must NOT delegate to any subagent. Key instruction:
```
NO SUBAGENTS AVAILABLE. Use standard Claude capabilities only.
Do not delegate to any subagent.
```

This ensures we measure the subagent's value, not another subagent's capability.

---

## Phase 4: Grade Results — Evaluate Against Assertions

### Decision Point 4.1: Grading Approach

For each assertion:
1. Check if assertion passed (true/false)
2. Extract evidence (quote or reference from output)
3. Record in grading.json

**Grading rubric:**
- Does output demonstrate the assertion? → PASS
- Does output fail the assertion? → FAIL
- Marginal cases: Use judgment, document in evidence

### Decision Point 4.2: Evidence Collection

| Assertion Type | Valid Evidence |
|---------------|----------------|
| delegation | Agent tool call log showing subagent_type |
| quality | Output quote with file:line reference |
| tool_scoping | Subagent .md tools field + execution log |
| permission | No "permission denied" messages in output |
| efficiency | timing.json token count vs threshold |
| structure | Output matches expected schema |
| functionality | Task deliverables present in outputs/ |

---

## Phase 5: Aggregate — Compute Benchmark Stats

### Interpreting Results

| Metric | Interpretation |
|--------|---------------|
| `with_subagent_avg_pass_rate` | How well does subagent help? (0–100%) |
| `baseline_avg_pass_rate` | How well does Claude do without subagent? |
| `improvement` | By how many points does subagent improve? |
| `token_cost` | How many extra tokens does subagent consume? |
| `duration_cost_ms` | How much slower is subagent delegation? |

---

## Phase 6: Review Summary — Present Results & Ask Next Steps

### Result Presentation Format

Show per-eval comparison + aggregate summary in a readable table.

### Decision Tree for User

1. **"Iterate"** — Update subagent + run iteration-2 with same evals
2. **"Stop"** — Satisfied with results; save benchmark data
3. **"Refine evals"** — Change test cases; rerun same iteration

---

## Phase 7: Iterate — Update Subagent & Run Next Iteration

### What to Improve Based on Results

| Result | Action |
|--------|--------|
| with_subagent = 100%, baseline = 50% | **Excellent** — Stop or test harder scenarios |
| with_subagent = 80%, baseline = 60% | **Improve** — Refine delegation signals, prompt clarity |
| with_subagent = 40%, baseline = 60% | **Overhaul** — Subagent hurts. Rework description/tools/prompt |
| with_subagent = baseline | **Ineffective** — Subagent adds no value. Reconsider need |

### Common Subagent Improvements

| Issue | Fix |
|-------|-----|
| Low delegation rate | Rewrite description with specific trigger phrases |
| Tool-missing errors | Add necessary tools to subagent definition |
| Poor output quality | Improve system prompt clarity and examples |
| Too many permission prompts | Adjust permissionMode or add allow rules |
| High token cost | Trim system prompt, focus on essential instructions |
| Wrong subagent selected | Sharpen description to differentiate from other subagents |

### Stopping Criteria

- ✓ with_subagent pass rate ≥ 95% (excellent)
- ✓ improvement ≥ 30 percentage points (major win)
- ✓ token cost acceptable for the value provided
- ✓ diminishing returns (iteration N+1 improvement <5 points)

---

## Evaluation Framework

**Interpreting benchmark results:**

| Improvement | Token Cost | Verdict |
|---|---|---|
| +30 points | +700 tokens | **Excellent** (big improvement, moderate cost) |
| +10 points | +100 tokens | **Good** (solid improvement, low cost) |
| +5 points | +1000 tokens | **Acceptable** (marginal gain, high cost — reconsider) |
| -10 points | -500 tokens | **Fail** (subagent hurts performance) |

**Evaluation dimensions specific to subagents:**

| Dimension | What to Measure | Why It Matters |
|---|---|---|
| **Delegation Accuracy** | Does Claude delegate to the right subagent? | Wrong delegation = task failure |
| **Task Completion** | Does subagent complete the full task? | Partial completion = wasted context |
| **Tool Adequacy** | Are declared tools sufficient? | Missing tools = blocked execution |
| **Output Quality** | Are results accurate and well-structured? | Quality = trust in delegation |
| **Token Efficiency** | Is subagent cost-effective vs baseline? | Cost must justify improvement |

---

## Integration with subagent-creator

**Recommended workflow:**

```
subagent-creator → subagent.md v1.0 → subagent-tester iteration-1 (pass rate: 70%)
                                              ↓
                                     subagent-creator refine (delegation, tools, prompt)
                                              ↓
subagent-creator → subagent.md v1.1 → subagent-tester iteration-2 (pass rate: 92%)
                                              ↓
                                           ✓ Stop (goal reached)
```

## Integration with skill-tester (for comparison)

Both testers follow the same 7-phase pipeline pattern. Skills and subagents can be tested independently:

```
skill-creator → SKILL.md v1.0 → skill-tester iteration-1
subagent-creator → subagent.md v1.0 → subagent-tester iteration-1
```

## Quick Checklist: Full Pipeline Execution

- [ ] **Phase 1:** Subagent identified, workspace created
- [ ] **Phase 2:** evals.json written, eval_metadata.json files created for each eval
- [ ] **Phase 3:** Both agents ran in parallel, outputs in correct directories, timing.json written
- [ ] **Phase 4:** All assertions graded, grading.json written for with_subagent and baseline
- [ ] **Phase 5:** Python script executed, benchmark.json created
- [ ] **Phase 6:** Results presented, next action decided
- [ ] **Phase 7 (if iterate):** Subagent updated, new iteration created, process repeats

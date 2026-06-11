# Diagnosis Protocol

Structured root cause analysis methodology. Replaces ad-hoc guessing with evidence-based investigation.

## Core Principle

**NEVER guess root causes.** Form hypotheses through structured reasoning and test them against evidence.

## Pre-Diagnosis: Capture State (MANDATORY)

Before any investigation, capture the current broken state as baseline:

```
1. Record exact error messages (copy-paste, not paraphrase)
2. Record failing test output (full command + output)
3. Record relevant stack traces
4. Record relevant log snippets with timestamps
5. Record git status / recent changes: git log --oneline -10
```

This baseline is required for Step 5 (Verify) — you MUST compare before/after.

## Diagnosis Chain (Follow in Order)

### Phase 1: Observe — What is actually happening?

Read, don't assume. Use `debugging` (systematic-debugging Phase 1).

- What is the exact error message?
- Where does it occur? (file, line, function)
- When did it start? (check `git log`, `git bisect`)
- Can it be reproduced consistently?
- **FR Trace** (for business logic bugs — SKIP for type errors, lint errors, config/infra bugs, or when expected behavior is already clear from user's bug report):

  Map affected files (from scout results) to Functional Requirements to establish what the code SHOULD do. Use a tiered cascade:

  **Tier 1 — IMP doc reverse lookup (CONFIDENCE=HIGH):**
  ```
  grep -rl "Location: {affected_file_path}" agent_docs/backend/*/implementation/FR-*-impl.md agent_docs/frontend/*/implementation/FR-*-impl.md
  ```
  Parse `FR-{DOMAIN}-{NNN}` from matching filenames. If found → auto-accept, skip remaining tiers.

  **Tier 2 — Test spec lookup (CONFIDENCE=HIGH):**
  ```
  grep -rl "Test file: {affected_test_file}" agent_docs/backend/*/test-specs/FR-*-test.md agent_docs/frontend/*/test-specs/FR-*-test.md
  ```
  If found → combine with Tier 1 results (dedup). Both tiers are explicit contracts from the SDLC pipeline.

  **Tier 3 — Git commit parsing (CONFIDENCE=LOW):**
  Parse `git log --oneline -20` for FR-ID patterns (e.g., `FR-AUTH-001`). If found → treat as hint only, do NOT auto-accept.

  **Tier 4 — Human fallback:**
  When all automated tiers fail, use `AskUserQuestion`:
  - Header: "Affected FR"
  - Options: auto-detected candidates from file-path heuristics + "None (config/infrastructure)" + "Unknown (let me type)"
  - If user selects "None" → `affected_fr: []` in BUG report (infrastructure bug)

  **After FR(s) found:** Read each affected FR's doc at `docs/product/features/{project-name}/FR-{DOMAIN}-{NNN}--{slug}.md` or `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md`. Load Gherkin scenarios to establish expected behavior before forming hypotheses. If Gherkin scenarios conflict with observed behavior → this gap IS the bug.

  **Multi-FR handling:** A shared utility or cross-cutting concern may affect multiple FRs (e.g., `sanitizer.py` → FR-T-003 + FR-AUTH-001 + FR-AUTH-002). Trace ALL affected FRs. The BUG report's `affected_fr` field accepts an array.

- **Expected behavior** (from FR Gherkin scenarios, or user input, or both): what the code SHOULD do
- **Actual behavior** (from observation): what the code DOES do
- **Gap:** Expected vs Actual — this difference IS the bug definition

### Phase 2: Hypothesize — Why might this happen?

Activate `sequential-thinking` skill. Form hypotheses through structured reasoning.

**Structured hypothesis formation:**
```
For each hypothesis:
  1. State the hypothesis clearly
  2. What evidence would CONFIRM it?
  3. What evidence would REFUTE it?
  4. How to test it quickly?
```

**Common hypothesis categories:**
- Recent code change introduced regression (`git log`, `git diff`)
- Data/state mismatch (wrong input, stale cache, race condition)
- Environment difference (deps version, config, platform)
- Missing validation (null check, type guard, boundary)
- Incorrect assumption (API contract, data shape, ordering)

### Phase 3: Test — Verify hypotheses against evidence

Spawn parallel `Explore` subagents to test each hypothesis simultaneously:

```
// Launch in SINGLE message — max 3 parallel agents
Agent(description="Verify H-A", prompt="Test hypothesis A: [specific search/check]", subagent_type="Explore")
Agent(description="Verify H-B", prompt="Test hypothesis B: [specific search/check]", subagent_type="Explore")
Agent(description="Verify H-C", prompt="Test hypothesis C: [specific search/check]", subagent_type="Explore")
```

**For each hypothesis result:**
- CONFIRMED: Evidence supports this as root cause → proceed to root cause tracing
- REFUTED: Evidence contradicts → discard, note why
- INCONCLUSIVE: Need more data → refine hypothesis or gather more evidence

### Phase 4: Trace — Follow the root cause chain

Use `debugging` (root-cause-tracing technique). Trace backward:

```
Symptom (where error appears)
  ↑ Immediate cause (what triggered the error)
    ↑ Contributing factor (what set up the bad state)
      ↑ ROOT CAUSE (the original trigger that must be fixed)
```

**Rule:** NEVER fix where the error appears. Trace back to the source.

### Phase 5: Escalate — When hypotheses fail

If 2+ hypotheses are REFUTED:
1. Auto-activate `problem-solving` skill
2. Apply Inversion Exercise: "What would CAUSE this bug intentionally?"
3. Apply Scale Game: "Does this fail with 1 item? 100? 10000?"
4. Consider environmental factors (timing, concurrency, platform)

If 3+ fix attempts fail after diagnosis:
1. STOP immediately
2. Question the architecture — is the design fundamentally flawed?
3. Discuss with user before attempting more

## Diagnosis Report Format

```markdown
## Diagnosis Report

**Issue:** [one-line description]
**Pre-fix state captured:** Yes/No

### FR Trace
| FR-ID | Confidence | Source |
|-------|-----------|--------|
| FR-T-003 | HIGH | IMP doc: `agent_docs/backend/sanitizer/implementation/FR-T-003-impl.md` |
| FR-AUTH-001 | HIGH | Test spec: `agent_docs/backend/auth/test-specs/FR-AUTH-001-test.md` |
| (empty) | — | Infrastructure/config bug — no FR affected |

### Root Cause
[Clear explanation of the root cause, traced back to origin]

### Evidence Chain
1. [Observation] → led to hypothesis [X]
2. [Test result] → confirmed/refuted [X]
3. [Trace] → root cause at [file:line]

### Affected Scope
- Files: [list]
- Functions: [list]
- Dependencies: [list]

### Recommended Fix
[What to change and why — addressing root cause, not symptoms]

### Prevention Needed
[What guards/tests to add to prevent recurrence]
```

## Quick Mode Diagnosis

For trivial issues (type errors, lint, syntax), abbreviated diagnosis:

1. Read error message
2. Locate affected file(s) via scout results
3. Identify root cause (usually obvious for simple issues)
4. **Skip FR trace** — type/lint errors don't need FR context (expected behavior is self-evident: "code should compile/type-check")
5. Skip parallel hypothesis testing
6. Still capture pre-fix state for verification
7. Still record `affected_fr` for the BUG report (may be `[]` if no FR context available)

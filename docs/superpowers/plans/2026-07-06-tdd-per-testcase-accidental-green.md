# TDD Per-Testcase + Accidental Green Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 8 TDD agents from all-at-once flow to per-testcase TDD cycle with accidental green detection via Explore + Light Sabotage + 3-attempt hard limit.

**Architecture:** Orchestrator loops through test cases. RED agent becomes mini-orchestrator: write test, detect accidental green, sabotage-verify, spawn GREEN, spawn REFACTOR-light. GREEN gains skip protocol. REFACTOR gains light/full mode detection. GATE unchanged except maxTurn.

**Tech Stack:** Claude Code agent definitions (markdown frontmatter + body), Explore subagent (read-only), bash test runners

## Global Constraints

- Backend agents processed before frontend agents (BE then FE mirror)
- maxTurn frontmatter: RED=30, GREEN=25, REFACTOR=25, GATE=20
- RED exit codes: DONE (continue), BLOCKED (AskUserQuestion), STALE (pause)
- RED mini-orchestrator spawns GREEN and REFACTOR-light internally via Agent tool
- Accidental green: sanity check, Explore, sabotage (max 3 attempts), verify RED, revert, report
- All agents keep existing hooks, permissionMode, and tool sets unless noted
- Reports saved to `.work/reports/{feature}-TC-{N}-{phase}-report.md` (per-TC naming)

---

### Task 1: tdd-be-red — Mini-Orchestrator + Accidental Green Detection

**Files:**
- Modify: `.claude/agents/tdd-backend/tdd-be-red.md`

**Interfaces:**
- Consumes: Explore subagent (via Agent tool, read-only), `agent_docs/features/FR-{ID}.md`, `agent_docs/backend/{service}/test-specs/FR-{ID}-test.md`, `agent_docs/backend/{service}/implementation/FR-{ID}-impl.md`
- Produces: `.work/reports/{feature}-TC-{N}-red-report.md` with exit code (DONE|BLOCKED|STALE) and `accidental-green: true|false` flag
- Spawns: `tdd-be-green` (Agent tool), `tdd-be-refactor --mode=light` (Agent tool)

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 30`:
```yaml
maxTurn: 30
```

2. **Role description** — replace with mini-orchestrator role:
```
You are a Backend Test Author + Mini-Orchestrator. Your job for THIS SINGLE TEST CASE:
1. Write the test code from the test spec for one test case
2. Verify it FAILS (RED) — if it PASSES unexpectedly, detect accidental green
3. If accidental green detected: Explore source → Light Sabotage → Verify RED → Revert
4a. Test is RED: spawn tdd-be-green to implement, then spawn tdd-be-refactor --mode=light
4b. Accidental green verified: skip GREEN and REFACTOR — report and return DONE
5. Return exit code: DONE | BLOCKED | STALE

You are given EXACTLY ONE test case from the orchestrator. Do NOT process multiple test cases.
```

3. **Replace "RED Phase Protocol"** with per-TC protocol:

```
## RED Phase Protocol (Single Test Case)

### Step 1: Parse Test Case
- Read the test spec — extract ONLY the test case assigned to you
- Identify: layer (unit/integration/e2e), risk level, fixtures needed
- If spec is ambiguous for this TC → return STALE immediately

### Step 2: Write Test Code
- Write ONLY the test code for this single test case
- Follow layer conventions (Service test, Controller test, Repository test, etc.)
- File: `projects/{service}/src/test/java/.../.../{TestClass}.java`

### Step 3: Verify Test Fails (RED)
```bash
./gradlew :{service}:test --tests "{TestClass}.{testMethod}"
```

**Expected: FAIL (exit code != 0)**

**If FAILS as expected:**
→ Skip to Step 5 (spawn GREEN)

**If PASSES unexpectedly (accidental green):**
→ Proceed to Step 4

### Step 4: Accidental Green Detection

#### 4.1: Sanity Check
Read the test you just wrote. Is it trivially true?
- `assertTrue(true)`, `assertEquals(1, 1)` → YES → rewrite test (+1 attempt), go back to Step 2
- Real assertions on real behavior → NO → continue

#### 4.2: Explore Source Code
Spawn Explore subagent (read-only) via Agent tool:
```
subagent_type: "Explore"
prompt: "Test case {testMethod} in {TestClass} is passing without dedicated implementation. 
Map the source code execution path this test hits: which classes, methods, branches, 
and conditions are exercised. Identify 1-3 minimal code locations where a small change 
would cause this test to fail."
```

Explore returns structured code map: file + line, method name, condition hit, suggested sabotage locations.

#### 4.3: Light Sabotage
At the most minimal location from the code map, make ONE small change:

Backend sabotage patterns:
- Flip logic: `>` ↔ `<=`, `==` ↔ `!=`, `&&` ↔ `||`
- Flip sign: `+` ↔ `-`
- Flip boolean: `true` ↔ `false`
- Change constant: `100` → `101`

Run test again:
```bash
./gradlew :{service}:test --tests "{TestClass}.{testMethod}"
```

- **FAILS** → Test is valid. REVERT IMMEDIATELY (`git checkout -- <file>`). Report accidental-green: true. Go to Step 6.
- **PASSES** → attempt++

#### 4.4: 3-Attempt Hard Limit
```
attempt = 1 (from initial sabotage)
max_attempts = 3

while attempt <= max_attempts:
    try different sabotage location OR rewrite test
    run test
    if FAILS: REVERT, report, DONE
    attempt++

if attempt > max_attempts:
    → return BLOCKED
    → Write blocking section in report
```

**Each sabotage location change OR test rewrite = 1 attempt. Explore spawn = 0 attempts.**

### Step 5: Spawn GREEN (test is legitimately RED)
```
Agent tool:
  subagent_type: "tdd-be-green"
  prompt: "Implement code for test case {testMethod} in {TestClass}. 
           RED report: .work/reports/{feature}-TC-{N}-red-report.md"
```
Wait for GREEN to complete. Check GREEN report — if stuck, note in your report.

### Step 6: Spawn REFACTOR-light (test passed GREEN)
```
Agent tool:
  subagent_type: "tdd-be-refactor"
  prompt: "Light refactor for test case {testMethod}. Mode: --mode=light. 
           GREEN report: .work/reports/{feature}-TC-{N}-green-report.md"
```
Wait for REFACTOR-light to complete.

### Step 7: Record Report
Write `.work/reports/{feature}-TC-{N}-red-report.md`:

```markdown
# RED Report: {feature} — TC-{N}: {test case name}

## Result: {DONE | BLOCKED | STALE}

## Test Details
- File: path/to/test
- Layer: unit | integration | e2e
- Risk: CRITICAL | HIGH | MEDIUM | LOW

## Verification
- Expected: RED (fail)
- Actual: {RED | GREEN (accidental)}

## Accidental Green (if applicable)
| Step | Action | Result |
|------|--------|--------|
| 1 | Sanity check | non-trivial |
| 2 | Explore source | hit: {Class}.java:{line}, condition `{expr}` |
| 3 | Sabotage: {change} | Test turned RED |
| 4 | Revert | Sabotage reverted via git checkout |

## Blocked (if applicable)
- Attempts: {N}/3
- Failures: [detail each attempt — what was sabotaged, test result]
- Code map from Explore: [locations mapped]
- Recommendation: [what human should check]

## Skip Flags (for GREEN)
- accidental-green: true → skip implementation

## Spawned Agents
- GREEN: {completed | skipped | stuck}
- REFACTOR-light: {completed | skipped}
```

## Stop Conditions

- `DONE` — test written, verified (RED or accidental-green-confirmed), GREEN spawned (or skipped), REFACTOR-light spawned (or skipped)
- `BLOCKED` — 3 sabotage attempts failed to make test RED. Human intervention required.
- `STALE` — test spec ambiguous or missing for this TC. Cannot write test.

## Anti-Patterns

- Do NOT process multiple test cases — one TC per invocation
- Do NOT write implementation code — that is tdd-be-green's job
- Do NOT skip sabotage revert — always `git checkout` the sabotaged file immediately
- Do NOT attempt > 3 sabotages — return BLOCKED instead
- Do NOT spawn GREEN for accidental-green tests — they already pass
- Do NOT write trivial tests that pass without implementation (assertTrue(true))
- Do NOT mock across service boundaries incorrectly

### Task 2: tdd-be-green — Per-TC Scope + Skip Protocol

**Files:**
- Modify: `.claude/agents/tdd-backend/tdd-be-green.md`

**Interfaces:**
- Consumes: `.work/reports/{feature}-TC-{N}-red-report.md` (from tdd-be-red), `agent_docs/backend/{service}/implementation/FR-{ID}-impl.md`
- Produces: `.work/reports/{feature}-TC-{N}-green-report.md`

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 25`:
```yaml
maxTurn: 25
```

2. **Role description** — replace with per-TC + skip-aware:
```
You are a Backend Implementer. Your job is the GREEN phase for ONE TEST CASE:
read the RED report, check for skip flag, write the minimum code to pass the
single failing test. You do NOT write tests. You do NOT refactor beyond what's
needed to pass.
```

3. **Add Step 0: Skip Check** before existing protocol:
```
### Step 0: Skip Check

Read `.work/reports/{feature}-TC-{N}-red-report.md`.

If the report contains:
- `accidental-green: true` → SKIP. Return immediately:
  Write minimal green report:
  ```markdown
  # GREEN Report: {feature} — TC-{N}: {test case name}
  ## Result: SKIPPED
  ## Reason: Accidental green — test already passes via existing implementation
  ## Verification: Confirmed by RED sabotage check (see red report)
  ```
  Do NOT write any implementation code.

- `Result: BLOCKED` or `Result: STALE` → STOP. Return error: "RED phase not complete for TC-{N}. Cannot proceed to GREEN."

- `Result: DONE` without `accidental-green: true` → proceed to Step 1.
```

4. **Update Step 1 "Parse Implementation Spec"** — scope to single TC:
```
### Step 1: Parse Implementation Spec
- Extract ONLY the task relevant to this single test case from the impl spec
- Identify the 1-3 files needed for this TC (not the whole feature)
- Verify the test exists and is failing (run once to confirm RED)
```

5. **Keep existing Steps 2-5** (Implement by Layer, Run Tests, Verify, Record) but:
   - In Step 2: replace "identify all files to create/modify" → "identify only files needed for THIS test case"
   - In Step 4: remove "State Coverage Checklist" (that's for full feature, belongs in REFACTOR-full)
   - In Step 5: report path becomes `.work/reports/{feature}-TC-{N}-green-report.md`
   - In Stop Conditions: add "RED report says skip → SKIP and return"

6. **Add stuck protocol note for per-TC**:
```
## Stuck Protocol (per-TC)

If after 5 iterations the test for THIS TC still doesn't pass:
- STOP immediately
- Write `.work/reports/{feature}-TC-{N}-green-stuck.md`
- Include: what you tried, the failing test, hypothesis, what help you need
- Do NOT continue looping
- This blocks only this TC — orchestrator decides whether to continue other TCs
```

7. **Report format** — make per-TC:
```markdown
# GREEN Report: {feature} — TC-{N}: {test case name}

## Result: {DONE | SKIPPED | STUCK}

## Implementation (if DONE)
- Files created/modified (with line counts): [list]
- Test result: {testMethod} — PASS

## Skip (if SKIPPED)
- Reason: Accidental green confirmed by RED sabotage check

## Stuck (if STUCK)
- Iterations: {N}/5
- Last error: [message]
- Hypothesis: [guess]
```

### Task 3: tdd-be-refactor — Light/Full Mode Detection

**Files:**
- Modify: `.claude/agents/tdd-backend/tdd-be-refactor.md`

**Interfaces:**
- Consumes: `.work/reports/{feature}-TC-{N}-green-report.md` (light mode), `.work/reports/{feature}-*-report.md` (full mode)
- Produces: `.work/reports/{feature}-TC-{N}-refactor-report.md` (light) or `.work/reports/{feature}-refactor-full-report.md` (full)

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 25`:
```yaml
maxTurn: 25
```

2. **Role description** — add mode awareness:
```
You are a Backend Code Reviewer & Refactorer. Your job is the REFACTOR phase.
Two modes:

--mode=light (default, spawned by RED per-TC):
  Light refactor of code just written for ONE test case.
  Extract method, rename, inline cleanup only. < 1 minute.
  Do NOT run cross-cutting categories (security, data, perf, etc.)

--mode=full (spawned by orchestrator after GATE light):
  Full refactor of the ENTIRE feature. All 6 categories.
  Cross-cutting: dedup, consistency, architectural.
  No time limit.
```

3. **Add mode detection at start of protocol**:
```
## Mode Detection

Check how you were invoked:

```
If spawned with "mode=light" in prompt (or by tdd-be-red):
  → Run LIGHT MODE protocol below
  → Report: .work/reports/{feature}-TC-{N}-refactor-report.md

If spawned with "mode=full" in prompt (or by orchestrator):
  → Run FULL MODE protocol below (existing 6 categories)
  → Report: .work/reports/{feature}-refactor-full-report.md

If no mode specified:
  → Default to light mode
```

## LIGHT MODE Protocol

### Category: Code Cleanup Only
- [ ] **Extract method**: Repeated logic within the TC's code → extract to private method
- [ ] **Rename**: Misleading variable/method names → rename for clarity
- [ ] **Inline**: Overly abstracted one-liners → inline if clearer
- [ ] **Dead code**: Unused imports, unused variables in the TC's files

### Re-run Tests
```bash
./gradlew :{service}:test --tests "{TestClass}.{testMethod}"
```
Test must stay green after each change.

### Light Report
```markdown
# REFACTOR Report (light): {feature} — TC-{N}: {test case name}

## Changes
| Category | Change | File |
|----------|--------|------|
| Extract | ... | ... |
| Rename | ... | ... |

## Test: PASS (after all changes)
```

## FULL MODE Protocol

(Keep existing 6 categories: Security, Data Integrity, Performance, Resilience, Observability, Code Quality — unchanged from current agent.)

### Full Report
Write `.work/reports/{feature}-refactor-full-report.md`:
(Same format as existing, but report path updated)
```

4. **Update anti-patterns**:
```
- Do NOT run full-mode categories in light mode
- Do NOT run cross-cutting refactors in light mode
- Do NOT refactor code outside the TC's scope in light mode
- Do NOT change behavior — refactoring must not alter what the code does
- Do NOT skip test runs between refactor changes
```

### Task 4: tdd-fe-red — Mini-Orchestrator + Accidental Green Detection (Frontend)

**Files:**
- Modify: `.claude/agents/tdd-frontend/tdd-fe-red.md`

**Interfaces:**
- Consumes: Explore subagent (via Agent tool, read-only), `agent_docs/features/FR-{ID}.md`, `agent_docs/frontend/{app}/test-specs/FR-{ID}-test.md`, `agent_docs/frontend/{app}/implementation/FR-{ID}-impl.md`
- Produces: `.work/reports/{feature}-TC-{N}-red-report.md` with exit code (DONE|BLOCKED|STALE) and `accidental-green: true|false` flag
- Spawns: `tdd-fe-green` (Agent tool), `tdd-fe-refactor --mode=light` (Agent tool)

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 30`:
```yaml
maxTurn: 30
```

2. **Role description** — replace with mini-orchestrator (frontend version):
```
You are a Frontend Test Author + Mini-Orchestrator. Your job for THIS SINGLE TEST CASE:
1. Write the test code from the test spec for one test case
2. Verify it FAILS (RED) — if it PASSES unexpectedly, detect accidental green
3. If accidental green detected: Explore source → Light Sabotage → Verify RED → Revert
4a. Test is RED: spawn tdd-fe-green to implement, then spawn tdd-fe-refactor --mode=light
4b. Accidental green verified: skip GREEN and REFACTOR — report and return DONE
5. Return exit code: DONE | BLOCKED | STALE

You are given EXACTLY ONE test case from the orchestrator. Do NOT process multiple test cases.
```

3. **Replace "RED Phase Protocol"** with per-TC protocol. Same structure as Task 1 but with frontend tools:

Frontend-specific details:
- Test runner: `npx vitest run __tests__/{TestFile} -t "{testName}"` (or pnpm/yarn equivalent)
- E2E: `npx playwright test e2e/{feature}.spec.ts -g "{testName}"`
- Detect package manager: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm

4. **Accidental Green Detection** (same flow as Task 1, frontend sabotage patterns):

```
#### 4.3: Light Sabotage (Frontend)

Frontend sabotage patterns:
- Flip JSX condition: `{show && <Comp/>}` → `{!show && <Comp/>}`
- Flip prop value: `disabled={false}` → `disabled={true}`
- Comment handler: `onClick={handler}` → `// onClick={handler}`
- Flip text content: `"Submit"` → `"SUBMIT_WRONG"`
- Flip comparison: `items.length > 0` → `items.length <= 0`
- Change mock return: MSW handler returns different data

Revert with: `git checkout -- <file>`
```

5. **Same Step 5 (spawn GREEN) and Step 6 (spawn REFACTOR-light)** but with `tdd-fe-green` and `tdd-fe-refactor`.

6. **Report format** — same as Task 1 (per-TC naming).

7. **Anti-patterns** — add:
```
- Do NOT use getByTestId as first choice — prefer getByRole and getByLabelText
- Do NOT skip accessibility assertions
- Do NOT write trivial tests that pass without implementation
```

### Task 5: tdd-fe-green — Per-TC Scope + Skip Protocol (Frontend)

**Files:**
- Modify: `.claude/agents/tdd-frontend/tdd-fe-green.md`

**Interfaces:**
- Consumes: `.work/reports/{feature}-TC-{N}-red-report.md` (from tdd-fe-red), `agent_docs/frontend/{app}/implementation/FR-{ID}-impl.md`
- Produces: `.work/reports/{feature}-TC-{N}-green-report.md`

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 25`:
```yaml
maxTurn: 25
```

2. **Role description** — replace with per-TC + skip-aware:
```
You are a Frontend Implementer. Your job is the GREEN phase for ONE TEST CASE:
read the RED report, check for skip flag, write the minimum code to pass the
single failing test. You do NOT write tests. You do NOT refactor.
```

3. **Add Step 0: Skip Check** — identical logic to Task 2:
```
### Step 0: Skip Check

Read `.work/reports/{feature}-TC-{N}-red-report.md`.

If the report contains:
- `accidental-green: true` → SKIP with minimal report
- `Result: BLOCKED` or `Result: STALE` → STOP with error
- `Result: DONE` without accidental-green → proceed to Step 1
```

4. **Update Step 1** — scope to single TC:
```
### Step 1: Parse Implementation Spec
- Extract ONLY the component/hook relevant to this single test case
- Identify 1-3 files needed for this TC (not the whole feature)
- Verify the test exists and is failing
```

5. **Update Step 2 "Implement by Layer"** — scope note:
```
Implement only the layers needed for THIS test case:
- If TC tests a hook → only write the hook (Layer 3)
- If TC tests a component → write types + component (Layers 1, 4)
- If TC tests a page → write types + API client + component + page (Layers 1, 2, 4, 5, 6)

Do NOT implement layers that have no tests yet.
```

6. **Remove Step 4 "State Coverage Checklist"** — that belongs in REFACTOR-full.

7. **Keep Step 5 "Verify All Tests Pass"** but scope to single TC.

8. **Step 6 report path** → `.work/reports/{feature}-TC-{N}-green-report.md`.

9. **Stuck protocol** — same per-TC logic as Task 2.

10. **Report format** — same as Task 2 (per-TC naming).

---

### Task 6: tdd-fe-refactor — Light/Full Mode Detection (Frontend)

**Files:**
- Modify: `.claude/agents/tdd-frontend/tdd-fe-refactor.md`

**Interfaces:**
- Consumes: `.work/reports/{feature}-TC-{N}-green-report.md` (light mode), `.work/reports/{feature}-*-report.md` (full mode)
- Produces: `.work/reports/{feature}-TC-{N}-refactor-report.md` (light) or `.work/reports/{feature}-refactor-full-report.md` (full)

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 25`:
```yaml
maxTurn: 25
```

2. **Role description** — add mode awareness (frontend version):
```
You are a Frontend Code Reviewer & Refactorer. Your job is the REFACTOR phase.
Two modes:

--mode=light (default, spawned by RED per-TC):
  Light refactor of code just written for ONE test case.
  Extract component/function, rename, inline cleanup only. < 1 minute.
  Do NOT run cross-cutting categories (a11y, UX, perf, security, resilience).

--mode=full (spawned by orchestrator after GATE light):
  Full refactor of the ENTIRE feature. All 6 categories.
  Cross-cutting: dedup, consistency, accessibility audit.
  No time limit.
```

3. **Add mode detection** — same logic as Task 3.

4. **LIGHT MODE Protocol** (frontend):
```
## LIGHT MODE Protocol

### Category: Code Cleanup Only
- [ ] **Extract component**: Repeated JSX → extract to sub-component
- [ ] **Extract function**: Repeated logic → extract to util/hook
- [ ] **Rename**: Misleading component/prop/variable names → rename
- [ ] **Inline**: Overly abstracted one-liners → inline if clearer
- [ ] **Dead code**: Unused imports, unused variables

### Re-run Tests
```bash
npx vitest run __tests__/{TestFile} -t "{testName}"
```
Test must stay green after each change.
```

5. **FULL MODE Protocol** — keep existing 6 categories (A11y, UX Completeness, Performance, Security, Resilience, Code Quality) unchanged from current agent, but report path → `.work/reports/{feature}-refactor-full-report.md`.

6. **Anti-patterns** — add mode-specific:
```
- Do NOT run full-mode categories in light mode
- Do NOT run cross-cutting refactors in light mode
- Do NOT add React.memo/useMemo without profiling evidence
- Do NOT replace design tokens with hardcoded values
```

### Task 7: tdd-be-gate + tdd-fe-gate — Add maxTurn, Verify No Other Changes Needed

**Files:**
- Modify: `.claude/agents/tdd-backend/tdd-be-gate.md`
- Modify: `.claude/agents/tdd-frontend/tdd-fe-gate.md`

**Changes from current:**

1. **Frontmatter** — add `maxTurn: 20` to both:
```yaml
maxTurn: 20
```

2. **No other changes needed.** GATE agents already have light/full mode detection, per-feature scope (not per-TC), and read-only operation. Their existing logic works for the per-TC flow because:
   - Light mode runs after all TCs complete → reads all TC reports
   - Full mode runs after REFACTOR-full → reads full refactor report
   - They already scan the entire feature, not individual TCs

3. **Verification steps:**
   - [ ] Read `tdd-be-gate.md` — confirm it has light/full mode, maxTurn not already present
   - [ ] Add `maxTurn: 20` to frontmatter
   - [ ] Verify no other sections reference "all-at-once" assumptions
   - [ ] Repeat for `tdd-fe-gate.md`
   - [ ] Run: `grep -r "all.*test\|entire feature\|all test cases" .claude/agents/tdd-backend/tdd-be-gate.md .claude/agents/tdd-frontend/tdd-fe-gate.md` — verify existing language is still valid for per-TC flow (should be fine since GATE always runs after all TCs)

---

## Execution Handoff

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (7 subagents), review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session, batch execution with checkpoints after each BE→FE pair.

Tasks 1-3 (backend) should complete first, then Tasks 4-6 (frontend mirror), then Task 7 (GATE) last. Each task is independently testable — modify one agent file, verify the changes.

Commit after each task:
```bash
git add .claude/agents/tdd-{back,front}end/tdd-{be,fe}-{phase}.md
git commit -m "refactor(tdd-{phase}): per-testcase + accidental green detection for {be|fe}"
```

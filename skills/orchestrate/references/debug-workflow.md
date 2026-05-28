# Debug / Fix Bug Workflow

Isolate, reproduce, fix, and verify bugs. Follows a strict "failing test first" discipline — never fix without proving the bug exists.

## Phase Overview

```
Scout & Understand → Reproduce (Failing Test) → Fix (Minimum Change) → Verify → Report
        ↓                    ↓ Gate                  ↓ Gate            ↓ Gate     ↓
```

## Step 1: Scout & Understand

Delegate to Explore agent to gather context:

```
Agent type: Explore
Prompt: "Investigate bug: <bug description>.

Find:
1. Error messages / stack traces (search logs, error outputs)
2. Affected service and source files
3. Related FR specs (docs/product/features/epic-{name}/FR-*.md)
4. Related test specs (agent_docs/backend/{service}/test-specs/FR-*-test.md)
5. Related implementation specs (agent_docs/backend/{service}/implementation/FR-*-impl.md)
6. Recent changes (git log --oneline -20 for affected files)
7. Database state or API responses if relevant

Report: Root cause hypothesis with evidence from code and specs."
```

Present findings to user and confirm the bug understanding before proceeding.

## Step 2: Reproduce - Write Failing Test

**CRITICAL:** Never fix a bug without a failing test that proves it exists.

Delegate to test-writer:

```
Agent type: test-writer (or general-purpose agent as test-writer)
Model: sonnet
Permission: acceptEdits
Prompt: "Write a failing test that reproduces bug: <bug description>.

Bug details:
- Affected service: <service>
- Expected behavior: <what should happen>
- Actual behavior: <what actually happens>
- Root cause hypothesis: <from Step 1>

Read from:
- FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (expected behavior from Gherkin)
- Test spec: agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md (existing test structure)
- API contract: agent_docs/contracts/api-{domain}.yaml

CRITICAL RULES:
- Write a test that PROVES the bug exists
- Run the test and verify it FAILS (exit code != 0)
- If the test passes, the bug is not reproduced — re-analyze
- Do NOT modify existing tests
- Do NOT read implementation code (context isolation)

Output: Failing test committed with message: test({service}): reproduce bug <bug-slug>"
```

### Gate: Verify Reproduction

```
Agent type: general-purpose (as verifier)
Prompt: "Verify the bug reproduction for <bug-slug>:

1. Run the new test: <test command>
2. Confirm it FAILS with output matching the bug description
3. Confirm no existing tests were modified

Report: REPRODUCED (test fails as expected) / NOT_REPRODUCED (test passes or fails differently)."
```

If NOT_REPRODUCED, re-analyze. The test must fail in a way that matches the bug.

## Step 3: Fix - Minimum Change

Delegate to implementer:

```
Agent type: implementer (or general-purpose agent as implementer)
Model: opus
Permission: acceptEdits
Prompt: "Fix the bug reproduced by the failing test for <bug-slug>.

CRITICAL RULES:
- Make the MINIMUM change to pass the failing test
- Do NOT modify the test (the test is the specification of correct behavior)
- Do NOT refactor unrelated code ('shotgun debugging')
- Do NOT change behavior beyond what the test specifies
- Run only the bug-reproducing test first
- After it passes, run ALL service tests to check for regressions
- If regression found: fix your fix, do NOT touch other tests

Commit: fix({service}): fix <bug-slug>
Include footers: Bug, Cause, Fix, Test, FR-ID (if applicable)

Output: Fix committed to repository."
```

### Gate: Verify Fix

```
Agent type: reviewer (or general-purpose agent as reviewer)
Model: sonnet
Permission: plan (read-only)
Prompt: "Verify the bug fix for <bug-slug>:

1. Run the bug-reproducing test: <test command> → must PASS
2. Run ALL service tests: <full test command> → must PASS (no regressions)
3. Run full test suite: <full suite command> → no regressions in other services
4. Review the fix diff:
   - Is it the minimum change?
   - Does it only fix the bug (no unrelated changes)?
   - Is it correct (doesn't introduce new issues)?

Report: FIX_VERIFIED / FIX_INCOMPLETE (test still fails) / REGRESSION (other tests broke)."
```

If FIX_INCOMPLETE or REGRESSION: send back to implementer with specific failures.

## Step 4: Generate Bug Report

After the fix is verified, generate a structured report:

```
Agent type: general-purpose
Prompt: "Generate a bug report for <bug-slug> at .work/reports/BUG-<slug>-report.md.

Include sections:
1. Bug: <description of the bug>
2. Cause: <root cause>
3. Fix: <what was changed, with commit SHA>
4. Test: <the reproducing test that now passes>
5. Verified: <verification results - all tests pass, no regressions>
6. FR-ID: <affected FR if applicable>
7. Prevention: <how to prevent similar bugs - missing test? missing spec? missing validation?>

Also:
- If this bug relates to an FR, check if the FR Gherkin scenarios cover this case
- If not, flag: 'FR spec gap: this scenario was not covered in the SRS'
- Suggest adding a Gherkin scenario to prevent regression

Output to: .work/reports/BUG-<slug>-report.md"
```

## Step 5: Update Documentation (if applicable)

If the bug revealed a documentation gap:

```
Agent type: Explore
Prompt: "Check if the bug scenario for <bug-slug> is covered in existing specs:

1. FR spec (docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md): search for scenario matching the bug
2. Test spec (agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md): search for test case matching the bug

Report: COVERED (scenario exists, test was missing/wrong) / GAP (scenario not in spec)."

If GAP:
  Agent type: srs-specifier (or general-purpose)
  Prompt: "Add a Gherkin scenario to docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md
  covering the bug case: <bug description>.
  This scenario was missing and led to a production bug.
  Mark as: 'Added from BUG-<slug> - regression prevention'"

  Then delegate to tst-specifier:
  Agent type: tst-specifier (or general-purpose)
  Prompt: "Add a test case to agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
  covering the new Gherkin scenario added for BUG-<slug>."
```

## Completion

Report:

```
Debug/Fix Bug workflow complete.

Bug: <slug>
Status: FIXED
Root cause: <cause>
Fix: <commit SHA>
Test: <test that verifies the fix>
Documentation gap: <filled or none>
Report: .work/reports/BUG-<slug>-report.md

The fix is ready for QA Gate (Phase 12).
```

---

## Anti-Patterns (Never Do These)

| Anti-Pattern | Why It's Wrong |
|-------------|----------------|
| Fixing without a failing test | Can't prove the fix works; risk of re-introducing bug |
| Modifying existing tests to "pass" | Masks the real bug; breaks test trustworthiness |
| Shotgun debugging (changing multiple things) | Can't trace which change fixed it; may hide root cause |
| Fixing in one service when root cause is in another | Shifts the bug, doesn't solve it |
| Skipping the documentation update | Same bug will happen again because specs don't cover the case |
| Refactoring during a bug fix | Mixes concerns; makes review and rollback harder |

---

## Production Bug (Incident Flow)

For production incidents, follow the Bug-to-Doc-to-Fix Cycle:

```
1. Create incident record: .work/incidents/INC-{NNN}.md
2. Triage severity (P1-P4)
3. Execute debug workflow (Steps 1-3)
4. Root cause → identify documentation gap
5. Update docs (FR Gherkin + test spec)
6. Verify fix
7. Close incident with post-mortem notes
```

The orchestrator coordinates but never directly writes the incident record — delegate to subagents.

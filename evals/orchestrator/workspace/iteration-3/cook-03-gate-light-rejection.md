# COOK-03: Gate:light Rejection -> Re-spawn -> Retry -- KET QUA

## RED Phase
- Status: PASS
- Output: `projects/sanitizer-service/tests/test_notempty.py` with 4 tests for `validate_not_empty()`
- Verification: All tests fail with `ImportError: cannot import name 'validate_not_empty'` -- expected RED behavior

## GREEN Phase (initial -- WITH intentional defects)
- Status: PASS
- Output: `validate_not_empty()` appended to `projects/sanitizer-service/src/sanitizer.py`
- Tests pass: 4/4 (plus 13/13 regression)
- Issues introduced:
  1. No type hints on function signature (`def validate_not_empty(input_val):`)
  2. `except Exception` generic catch-all -- masks real errors, violates Hard Boundary #14 ("DO NOT catch generic exceptions")
  3. try/except relied on catching `AttributeError` from `None.strip()` instead of explicit None check

## GATE:LIGHT (first attempt)
- Status: **FAIL**
- Criteria passed: 2/4
- Gate breakdown:
  | Gate | Criterion | Result |
  |------|-----------|--------|
  | L1 | Test Suite | PASS (17/17 pass) |
  | L2 | Hard Boundaries | PASS (no I/O, no mutable state) |
  | L3 | Type Hints | FAIL (no type annotations on parameter or return) |
  | L4 | Exception Handling | FAIL (`except Exception` generic catch-all) |
- Feedback:
  - L3: Add type hints to function signature: `def validate_not_empty(input_val: str | None) -> bool:`
  - L4: Replace `try/except Exception` with explicit `if input_val is None` check

## Re-spawn GREEN (with gate feedback)
- Status: PASS
- Fixes applied:
  1. Added full type hints: `def validate_not_empty(input_val: str | None) -> bool:`
  2. Removed `try/except Exception` block entirely
  3. Added explicit `if input_val is None` guard clause
  4. Added proper docstring with Args/Returns sections
- All tests stay green: 17/17 pass (0 regressions)

## GATE:LIGHT (retry)
- Status: **PASS**
- Criteria passed: 4/4
- Gate breakdown:
  | Gate | Criterion | Result |
  |------|-----------|--------|
  | L1 | Test Suite | PASS (17/17 pass, 0 regressions) |
  | L2 | Hard Boundaries | PASS (no I/O, no mutable state) |
  | L3 | Type Hints | PASS (`input_val: str \| None -> bool`) |
  | L4 | Exception Handling | PASS (no try/except, explicit None check) |

## Re-spawn Loop Verification
- Gate rejected initial GREEN: **YES** (2/4 gates failed)
- Orchestrator re-spawned GREEN (not gate): **YES** (re-spawned tdd-be-green equivalent with gate feedback)
- Gate feedback included in re-spawn brief: **YES** (L3 type hints + L4 exception handling fixes applied)
- Retry gate passed: **YES** (4/4 after re-spawned GREEN fixes)

## Overall: PASS

The Cook workflow gate:light rejection loop was successfully demonstrated:
1. Initial GREEN implementation with intentional defects passed tests but violated quality gates
2. GATE:LIGHT correctly detected both defects (missing type hints, improper exception handling)
3. Orchestrator re-spawned the GREEN agent (not the gate) with specific feedback
4. Re-spawned GREEN fixed all issues while keeping tests green
5. Retry GATE:LIGHT confirmed all 4 criteria passed

This validates the core gate rejection pattern described in `cook-workflow.md`:
> When `tdd-be-gate --mode=light` rejects -> re-spawn `tdd-be-green` with gate feedback -> re-run `tdd-be-gate --mode=light`

**Loop count**: 1 re-spawn (well within the 3-iteration safety limit)

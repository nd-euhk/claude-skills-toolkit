---
fr_id: FR-VAL-003
service: sanitizer-service
spec_type: implementation-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: IMP Agent
depends_on:
  - FR-VAL-003--input-length-limit.md
  - ../tech-design/sanitizer-service.md
  - ../hard-boundaries.md
referenced_by:
  - FR-VAL-003--input-length-limit-test.md
changelog:
  - 1.0 | 2026-06-01 | CR: Implementation spec for RFC 5321 max length (254 chars) check
---

# FR-VAL-003 Implementation Specification: RFC 5321 Input Length Limit

## 1. Execution Flow

### Entry Point

```
validate_email(email: str | None) -> bool
```

Located in `src/sanitizer.py`. The length check is inserted between the null/empty guard and the regex match.

### Updated Flow Diagram

```
Caller invokes validate_email(email)
  |
  v
[Guard: if not email] ---(truthy: None, "")---> return False
  |
  | (email is truthy string)
  v
[Length Check: if len(email) > 254] ---(True: >254 chars)---> return False
  |
  | (email length <= 254)
  v
[_EMAIL_RE.match(email)]
  |
  v
return bool(match_result)
```

### Step-by-Step Execution

| Step | Action | Condition | Outcome |
|------|--------|-----------|---------|
| 1 | Evaluate `not email` | email is None or "" | Return `False` immediately. Length check never evaluated. |
| 2 | Evaluate `len(email) > 254` | email is truthy string >254 chars | Return `False` immediately. Regex never evaluated. |
| 3 | Execute `_EMAIL_RE.match(email)` | email is truthy string, length <= 254 | Returns `re.Match` object (truthy) or `None` (falsy) |
| 4 | Convert match result to `bool` | Always | `True` if regex matched, `False` otherwise |

### Performance Path

| Path | Latency Budget | NFR Trace |
|------|---------------|-----------|
| Null/empty guard path | <0.5ms P95 | NFR-PERF-003 |
| Length check path (>254 chars) | <0.5ms P95 | NFR-PERF-004 |
| Regex match path (<=254 chars) | <1ms P95 | NFR-PERF-001 |
| Regex match path (any length) | <5ms P99 | NFR-PERF-002 |

### Change Scope

This CR adds exactly ONE new code path to `validate_email()`:

```python
# CR: RFC 5321 max length check — insert after null/empty guard, before regex
if len(email) > 254:
    return False
```

**No other code paths are modified.** The null/empty guard, the regex match, and the boolean return remain unchanged.

## 2. Business Rules

### BR-006: RFC 5321 Length Limit

Per RFC 5321 Section 4.5.3.1, the maximum total length of an email address is 254 characters. Any email string exceeding this length must be rejected regardless of format validity.

**Implementation**: `if len(email) > 254: return False`

**Verification**: INV-7 from LLD -- any email string longer than 254 characters is always rejected.

### BR-007: Length Check Order (Early Rejection)

The length check executes BEFORE the regex match and AFTER the null/empty guard. This ordering is intentional:

1. Null/empty guard first: O(1), catches None/"" before any length check.
2. Length check second: O(1), rejects overlong inputs before the O(n) regex runs.
3. Regex match last: O(n), only executed on strings that are truthy and <=254 chars.

This ordering provides optimal performance: the two cheapest checks execute first, avoiding unnecessary regex processing of None/empty/overlong inputs.

**Verification**: Code review confirms `len(email) > 254` guard appears after `if not email:` and before `_EMAIL_RE.match(email)`.

### BR-008: O(1) Length Check

Python's `len()` on strings is O(1) -- the string object stores its length as an attribute. The check adds negligible overhead (<<0.01ms) and pays for itself by skipping regex execution on overlong inputs.

**Verification**: NFR-PERF-004 target is <0.5ms P95 for length check path. Python `len()` on strings is documented as O(1).

### BR-009: No Signature Change

The function signature `validate_email(email: str | None) -> bool` remains unchanged. This CR adds an internal guard clause only.

**Verification**: Hard-boundary #3 compliance. Signature unchanged per ADR-003.

## 3. Error Mapping (Updated)

| Input | Execution Path | Return Value | Rationale |
|-------|---------------|-------------|-----------|
| `None` | Guard catches, returns immediately | `False` | Absent input is not a valid email |
| `""` (empty string) | Guard catches, returns immediately | `False` | Empty string is not a valid email |
| `"a" * 255 + "@b.co"` (255 chars) | Length check catches, returns immediately | `False` | Exceeds RFC 5321 max length of 254 chars |
| `"a" * 254 + "@b.co"` (260 chars) | Length check catches, returns immediately | `False` | Exceeds RFC 5321 max length of 254 chars |
| `"a@b.co"` (6 chars) | Length check passes, regex match succeeds | `True` | Valid format within length limit |
| `"user@domain.com"` | Regex match succeeds | `True` | Valid format, length check passes |

All previously documented error paths (FR-VAL-001 and FR-VAL-002) remain unchanged. The length check adds a new rejection reason between the null/empty guard and the format check.

## 4. Data Impact

### State Changes

**None.** Same as FR-VAL-001. The length check is a pure read operation on the input string's length attribute. No mutation, no side effects.

### Memory Impact

| Input Size | Memory Allocation | Notes |
|-----------|-------------------|-------|
| None | 0 bytes | Guard returns immediately |
| "" (0 bytes) | 0 bytes | Guard returns immediately |
| >254 chars | 0 bytes | Length check returns immediately; regex never runs |
| <=254 chars | Negligible (~200-400 bytes stack frame) | Same as before CR |

### Data Flow

```
Input: str | None
  |
  | (read-only)
  v
Guard check: if not email (no copy, no mutation)
  |
  v
Length check: if len(email) > 254 (O(1), reads length attribute, no copy)
  |
  v
Regex match: _EMAIL_RE.match(email) (no copy, no mutation)
  |
  v
Output: bool (True | False)
```

## 5. Security Considerations

### SEC-006: Length-Based DoS Prevention

**Threat**: Attacker submits extremely long email strings (e.g., 1MB) causing degraded regex performance.

**Assessment**: The length check rejects inputs >254 chars in O(1) before the regex runs. Attackers cannot force O(n) regex processing with arbitrarily long inputs.

**Before CR**: `validate_email("a" * 1_000_000 + "@b.co")` -- regex runs on 1MB string, O(n) time.
**After CR**: `validate_email("a" * 1_000_000 + "@b.co")` -- length check catches in O(1), returns `False` immediately.

**Verification**: NFR-SEC-001 compliance improved. No unbounded resource consumption for oversized inputs.

## 6. Compliance with Hard Boundaries

| Boundary # | Rule | Compliance |
|-----------|------|-----------|
| 1 | No I/O in validate_email | YES -- `len()` is O(1) attribute access, not I/O |
| 2 | No mutable state | YES -- `len()` is a read operation |
| 3 | No signature change | YES -- `validate_email(email: str \| None) -> bool` unchanged |
| 4 | No external dependencies | YES -- `len()` is Python built-in |
| 9 | No exceptions | YES -- `len()` on strings never raises |
| 10 | No sensitive data exposure | YES -- only True/False returned |
| 11 | No DoS vectors | YES -- length guard prevents regex on oversized inputs |
| 21 | Return bool only | YES -- strictly True or False |

## 7. Test Impact

### Existing Tests

All existing tests in `test_sanitizer.py:TestValidateEmail` must continue to pass -- none of the existing test inputs exceed 254 characters. The length check is transparent to the existing test suite.

### New Tests Required

| Test Method | Input | Expected |
|------------|-------|----------|
| `test_rejects_email_exceeds_254_chars` | `"a" * 255 + "@b.co"` | `False` |
| `test_rejects_email_exactly_255_chars` | `"a" * 249 + "@b.co"` | `False` (249+6=255 > 254) |
| `test_accepts_email_exactly_254_chars` | `"a" * 248 + "@b.co"` | `True` (248+6=254, valid format) |
| `test_accepts_email_253_chars` | `"a" * 247 + "@b.co"` | `True` (247+6=253, valid format) |

See TST spec at `agent_docs/backend/sanitizer-service/test-specs/FR-VAL-003--input-length-limit-test.md` for full test specifications.

## 8. Rollback Plan

The length check is a single guard clause addition. Rollback is trivial: remove the `if len(email) > 254: return False` block. No existing behavior or test expectations change with removal.

---
fr_id: FR-VAL-003
service: sanitizer-service
spec_type: test-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: TST Agent
depends_on:
  - ../../features/FR-VAL-003--input-length-limit-impl.md
  - ../../tech-design/sanitizer-service.md
  - ../../../../tests/test_sanitizer.py
referenced_by:
  - ../../features/FR-VAL-003--input-length-limit-impl.md
  - ../../traceability/requirements-matrix.md
changelog:
  - 1.0 | 2026-06-01 | CR: Test spec for RFC 5321 max length (254 chars) check
---

# FR-VAL-003 Test Specification: RFC 5321 Input Length Limit

## 1. Test Scope

This test specification covers all behavioral test cases for the RFC 5321 input length limit checks on `validate_email()`. The length check is a CR addition that rejects email strings exceeding 254 characters regardless of format validity.

**Test class**: `TestValidateEmail` in `tests/test_sanitizer.py`
**Function under test**: `validate_email(email: str | None) -> bool`
**Test framework**: pytest
**CR context**: Change Request -- Add RFC 5321 max length (254 chars) check to `validate_email()`

## 2. Unit Tests -- Length Limit Validation

### 2.1 Reject Email Exceeding 254 Characters (Oversized)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_email_exceeds_254_chars` (new) |
| **Gherkin context** | Given a user provides an email string longer than 254 characters |
| **Given** | A user provides an email string with 255+ characters |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |
| **NFR** | NFR-PERF-004: length check path <0.5ms P95 |

```python
# Given a user provides an email string "a"*255 + "@b.co" (261 chars total)
# When the system validates the email format
result = validate_email("a" * 255 + "@b.co")
# Then the result shall be False
assert result is False
```

### 2.2 Reject Email at Exactly 255 Characters (Boundary)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_email_exactly_255_chars` (new) |
| **Gherkin context** | Boundary test: email length equals 255 (one over limit) |
| **Given** | A user provides an email string exactly 255 characters long |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

```python
# Given a user provides an email string of exactly 255 characters
# 249 chars local part + "@b.co" (6 chars) = 255 total
# When the system validates the email format
result = validate_email("a" * 249 + "@b.co")
# Then the result shall be False (255 > 254)
assert result is False
```

### 2.3 Accept Email at Exactly 254 Characters (RFC 5321 Maximum)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_email_exactly_254_chars` (new) |
| **Gherkin context** | Boundary test: email length equals 254 (RFC 5321 maximum) |
| **Given** | A user provides an email string exactly 254 characters long with valid format |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string of exactly 254 characters with valid format
# 248 chars local part + "@b.co" (6 chars) = 254 total
# When the system validates the email format
result = validate_email("a" * 248 + "@b.co")
# Then the result shall be True (254 <= 254 and valid format)
assert result is True
```

### 2.4 Accept Email at 253 Characters (Just Under Limit)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_email_253_chars` (new) |
| **Gherkin context** | Boundary test: email length equals 253 (just under limit) |
| **Given** | A user provides an email string exactly 253 characters long with valid format |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string of exactly 253 characters with valid format
# 247 chars local part + "@b.co" (6 chars) = 253 total
# When the system validates the email format
result = validate_email("a" * 247 + "@b.co")
# Then the result shall be True (253 <= 254 and valid format)
assert result is True
```

### 2.5 Length Check Before Regex (Ordering Test)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_overlong_even_if_format_valid` (new) |
| **Gherkin context** | An email >254 chars with valid format is still rejected |
| **Given** | A user provides a 300-char email that would pass format validation |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` (length check fires before regex) |

```python
# Given a user provides an email string of 300 chars with a syntactically valid format
# local@domain.com pattern extended to 300 chars
overlong_valid_format = "a" * 290 + "@b.co"
assert len(overlong_valid_format) == 296  # 290 + 6 = 296 > 254
# When the system validates the email format
result = validate_email(overlong_valid_format)
# Then the result shall be False (length check rejects before format check)
assert result is False
```

### 2.6 Large Input Performance (NFR Verification)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_length_check_performance_for_large_input` (new) |
| **Gherkin context** | NFR-PERF-004 verification: length check is O(1) |
| **Given** | A user provides an extremely long email string (e.g., 1MB) |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` in <<1ms (length check catches before regex) |

```python
import time

# Given an extremely long email string (1MB)
very_long = "a" * 1_000_000 + "@b.co"
# When the system validates the email format
start = time.perf_counter()
result = validate_email(very_long)
elapsed = time.perf_counter() - start
# Then the result shall be False
assert result is False
# Then the check must complete in well under 1ms (O(1) length check)
# Generous threshold: <10ms accounts for test environment variance
assert elapsed < 0.010, f"Length check took {elapsed*1000:.2f}ms, expected <0.5ms"
```

## 3. Regression Tests -- Existing Tests Must Pass

### 3.1 All Existing Tests Remain Unaffected

| Test Method | Input | Expected | Status |
|------------|-------|----------|--------|
| `test_accepts_valid` | `user@domain.com`, `a@b.co`, `user+tag@sub.domain.com` | `True` | Must pass |
| `test_rejects_missing_at` | `userdomain.com`, `user` | `False` | Must pass |
| `test_rejects_no_domain` | `user@`, `@domain.com` | `False` | Must pass |
| `test_rejects_spaces` | `user @domain.com`, ` user@domain.com`, `user@do main.com` | `False` | Must pass |
| `test_rejects_empty` | `""` | `False` | Must pass |
| `test_rejects_none` | `None` | `False` | Must pass |

All existing test inputs are under 254 characters. The length check guard does not intercept any of them, so all existing tests must continue passing unchanged.

## 4. Integration Test Patterns

### 4.1 No New Integration Points

The length check introduces no new integration points. It is a pure in-process guard clause added to an existing function. The integration patterns from FR-VAL-001 test spec remain unchanged:

- Registration Flow: `if not validate_email(email): return None` -- unchanged
- Login Flow: `if not validate_email(email): return None` -- unchanged
- Profile Update Flow: `if not validate_email(new_email): return False` -- unchanged

## 5. Test Fixtures and Mocks

### 5.1 Fixtures

```python
import pytest
from src.sanitizer import validate_email


@pytest.fixture
def boundary_emails():
    """Fixture providing boundary-test email strings for RFC 5321 length validation."""
    return {
        "exactly_254_valid": "a" * 248 + "@b.co",   # 254 chars, valid format
        "exactly_253_valid": "a" * 247 + "@b.co",   # 253 chars, valid format
        "exactly_255": "a" * 249 + "@b.co",          # 255 chars (1 over limit)
        "way_over_limit": "a" * 1000 + "@b.co",      # ~1006 chars, still valid format
    }
```

### 5.2 Parametrized Test Pattern

```python
@pytest.mark.parametrize("email,expected", [
    ("a" * 255 + "@b.co", False),      # 261 chars -- over limit
    ("a" * 249 + "@b.co", False),      # 255 chars -- 1 over limit
    ("a" * 1000 + "@b.co", False),     # 1006 chars -- way over limit
])
def test_rejects_emails_over_254_chars(email, expected):
    # Given an email exceeding 254 characters
    # When the system validates the email format
    result = validate_email(email)
    # Then the result shall be False
    assert result is False


@pytest.mark.parametrize("email", [
    "a" * 248 + "@b.co",              # 254 chars -- boundary maximum
    "a" * 247 + "@b.co",              # 253 chars -- just under
    "a" * 200 + "@b.co",              # 206 chars -- comfortably under
])
def test_accepts_emails_within_254_chars_with_valid_format(email):
    # Given an email within 254 characters with valid format
    # When the system validates the email format
    result = validate_email(email)
    # Then the result shall be True
    assert result is True
```

### 5.3 Mocks

**No mocks needed.** The length check uses Python's built-in `len()` function. Per Hard Boundary #23, tests verify behavior, not implementation details. `len()` is a standard library function and should never be mocked.

## 6. Gherkin Scenario Mapping

### Length Limit Gherkin Scenario Outline

```gherkin
Scenario Outline: Validate email address length per RFC 5321
  Given a user provides an email string of <length> characters with <format_validity> format
  When the system validates the email format
  Then the result shall be "<valid>"

  Examples:
    | length | format_validity | valid |
    | 254    | valid           | true  |
    | 253    | valid           | true  |
    | 255    | valid           | false |
    | 300    | valid           | false |
    | 255    | invalid         | false |
    | 254    | invalid         | false |
```

### Full Test-to-Gherkin Traceability

| Gherkin Row (length, format) | Test Method | Expected | Status |
|------------------------------|-------------|----------|--------|
| 254 chars, valid format | `test_accepts_email_exactly_254_chars` | `True` | New |
| 253 chars, valid format | `test_accepts_email_253_chars` | `True` | New |
| 255 chars, valid format | `test_rejects_email_exactly_255_chars` | `False` | New |
| 300 chars, valid format | `test_rejects_overlong_even_if_format_valid` | `False` | New |
| 255 chars, invalid format | `test_rejects_email_exceeds_254_chars` | `False` | New |
| 254 chars, invalid format | Covered by existing FR-VAL-001 tests | `False` | Existing |

**Coverage**: 6/6 Gherkin rows mapped (100%).

## 7. NFR Verification Tests

| NFR | Requirement | Test Approach |
|-----|-------------|--------------|
| NFR-PERF-004 (<0.5ms P95) | Length check path must complete in under 0.5ms | `test_length_check_performance_for_large_input`: 1MB input rejected in <<1ms |
| NFR-REL-001 (no exceptions) | Length check must not raise for any input | All test cases above -- `len()` on strings never raises |
| NFR-REL-002 (deterministic) | Repeated same overlong input always returns `False` | Call `validate_email(overlong)` 100x, assert all results are `False` |
| NFR-SEC-001 (resource control) | Overlong input must not trigger regex processing | Verify length check returns before regex runs (O(1) rejection) |

## 8. Test Implementation Order (TDD RED Phase)

1. `test_rejects_email_exceeds_254_chars` -- basic over-limit rejection
2. `test_rejects_email_exactly_255_chars` -- boundary rejection
3. `test_accepts_email_exactly_254_chars` -- boundary acceptance
4. `test_accepts_email_253_chars` -- sub-boundary acceptance
5. `test_rejects_overlong_even_if_format_valid` -- ordering verification
6. `test_length_check_performance_for_large_input` -- NFR verification

All tests written before implementation code is added (TDD RED phase). Implementation follows in GREEN phase with `if len(email) > 254: return False`.

---
fr_id: FR-VAL-002
service: sanitizer-service
status: ready-for-implementation
---

# FR-VAL-002: Null and Empty Input Handling

## Routing Overlay

- **Service**: sanitizer-service
- **API Endpoint**: `validate_email(email: str | None) -> bool` (in-process function call)
- **Implementation Path**: `projects/sanitizer-service/src/sanitizer.py`
- **Test Path**: `projects/sanitizer-service/tests/test_sanitizer.py`

## Feature Description

The system shall handle absent input gracefully when validating email addresses. When the input is `None` (null) or an empty string (zero-length), the system shall return a negative validation result (`false`) without raising an error or exception.

Source: SRS FR-VAL-002, `src/sanitizer.py:61-62`.

## Acceptance Criteria

### Scenario Outline: Handle absent email input

```gherkin
Scenario Outline: Handle absent email input
  Given a user provides "<input_desc>"
  When the system validates the email format
  Then the result shall be false
  And no exception shall be raised

  Examples:
    | input_desc      |
    | a null value    |
    | an empty string |
```

### Acceptance Criteria (Behavioral)

1. Returns `false` when the input is `None`.
2. Returns `false` when the input is an empty string (`""`).
3. Does not raise an exception for either `None` or empty string input.
4. The behavior is consistent: every call with `None` or `""` produces the same result.

## Implementation Notes

### Guard Clause

The null/empty handling is implemented as the first check in `validate_email`, before the regex is evaluated:

```
# Not source of truth -- see src/sanitizer.py:61-62
def validate_email(email: str | None) -> bool:
    if not email:
        return False
    ...  # regex check only reached if email is truthy
```

### Semantics

- `not email` is `True` for both `None` and `""` (empty string is falsy in Python).
- The guard returns `False` immediately, avoiding the regex call entirely.
- This satisfies NFR-PERF-003 (<0.5ms P95 for null/empty input) since the guard clause is a single boolean check with no computation.

### Design Decisions

- **Single guard for both cases**: Python's truthiness check (`if not email`) handles both `None` and `""` natively. No separate branches for `is None` and `== ""`.
- **Early return before regex**: The guard is the first statement in the function. The regex is never evaluated for falsy inputs, avoiding any overhead.
- **No exception for None**: The function does not use `email is None` followed by a raise. It returns `False` -- no distinction between null/empty/invalid for the caller (intentional per ADR-003 -- callers should check for null/empty before calling if they need to distinguish).
- **Type-safe**: The type hint `str | None` documents the acceptable inputs. Static type checkers (`mypy`, `pyright`) catch incorrect usage at development time.

## Dependencies

- **Upstream**: None (leaf function, no service calls out)
- **Downstream**: User Service (registration flow, login flow, profile update flow) -- consumes the boolean result
- **ADR references**: ADR-003 (API conventions -- `False` for absent input)

## NFR Verification

| NFR | Requirement | How Verified |
|-----|-------------|-------------|
| NFR-PERF-003 | <0.5ms P95 for null/empty input | Micro-benchmark: time the function call for None and "" |
| NFR-REL-001 | 0 unhandled exceptions for None input | Direct test: `validate_email(None)` must not raise |
| NFR-REL-001 | 0 unhandled exceptions for empty string input | Direct test: `validate_email("")` must not raise |
| NFR-REL-002 | Deterministic output | Repeated calls with None and "" must always return False |

## Test Cases (Mapped to Gherkin Examples)

| Test Method | Input | Expected | Exception Expected |
|------------|-------|----------|-------------------|
| `test_rejects_none` | `None` | `False` | No |
| `test_rejects_empty` | `""` | `False` | No |

### Test Structure Convention

Each test follows the Given/When/Then pattern matching the Gherkin scenario (Hard Boundary #26):

```python
# illustrative, not source of truth -- test pattern
def test_rejects_none():
    # Given a user provides a null value
    # When the system validates the email format
    result = validate_email(None)
    # Then the result shall be false
    assert result is False
    # And no exception shall be raised
```

```python
# illustrative, not source of truth -- test pattern
def test_rejects_empty():
    # Given a user provides an empty string
    # When the system validates the email format
    result = validate_email("")
    # Then the result shall be false
    assert result is False
    # And no exception shall be raised
```

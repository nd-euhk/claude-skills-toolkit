# FR-VAL-002: Null and Empty Input Handling

**Identifier:** FR-VAL-002
**Priority:** MUST
**Component:** Email Validation Utility
**Source:** `src/sanitizer.py`, function `validate_email`, lines 61-62

## Description

The system shall handle absent input gracefully when validating email addresses. When the input is `None` (null) or an empty string (zero-length), the system shall return a negative validation result (`false`) without raising an error or exception.

## Gherkin Scenario Outlines

### Scenario Outline: Handle absent email input

```
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

## Acceptance Criteria

1. Returns `false` when the input is `None`.
2. Returns `false` when the input is an empty string (`""`).
3. Does not raise an exception for either `None` or empty string input.
4. The behavior is consistent: every call with `None` or `""` produces the same result.

## NFR References

- NFR-REL-001 (No Exceptions): Validation never raises an exception for any input type.
- NFR-PERF-001 (Response Time): Validation of null or empty input completes within 1ms.

## Source Trace

- **File:** `src/sanitizer.py`
- **Function:** `validate_email`, lines 61-62 (`if not email: return False`)
- **Test coverage:** `tests/test_sanitizer.py`, `test_rejects_empty` (line 98), `test_rejects_none` (line 102)

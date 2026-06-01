---
fr_id: FR-VAL-001
service: sanitizer-service
status: ready-for-implementation
---

# FR-VAL-001: Email Format Validation

## Routing Overlay

- **Service**: sanitizer-service
- **API Endpoint**: `validate_email(email: str | None) -> bool` (in-process function call)
- **Implementation Path**: `projects/sanitizer-service/src/sanitizer.py`
- **Test Path**: `projects/sanitizer-service/tests/test_sanitizer.py`

## Feature Description

The system shall validate that a given email string conforms to a basic email address format: a non-empty local part, followed by an `@` symbol, followed by a non-empty domain part that contains at least one period (`.`). The validation shall reject any email string containing whitespace characters.

Source: SRS FR-VAL-001, `src/sanitizer.py:50-66`.

## Acceptance Criteria

### Scenario Outline: Validate email address format

```gherkin
Scenario Outline: Validate email address format
  Given a user provides an email string "<email>"
  When the system validates the email format
  Then the result shall be "<valid>"

  Examples:
    | email                      | valid |
    | user@domain.com            | true  |
    | user.name@domain.com       | true  |
    | user+tag@domain.com        | true  |
    | user@sub.domain.com        | true  |
    | a@b.co                     | true  |
    | user@domain.co.uk          | true  |
    | user.name+tag@domain.org   | true  |
    | userdomain.com             | false |
    | user                       | false |
    | user@                      | false |
    | @domain.com                | false |
    | user@domain                | false |
    | user @domain.com           | false |
    | user@do main.com           | false |
    |  user@domain.com           | false |
    | user.name@domain..com      | false |
```

### Acceptance Criteria (Behavioral)

1. Accepts email addresses with a non-empty local part, an `@` symbol, and a domain containing at least one period.
2. Rejects email addresses missing the `@` symbol.
3. Rejects email addresses with an empty local part (before `@`).
4. Rejects email addresses with an empty domain part (after `@`).
5. Rejects domain parts that do not contain at least one period.
6. Rejects email addresses containing any whitespace characters (space, tab, newline) anywhere in the string.
7. Validation is deterministic: the same input always produces the same result.

## Implementation Notes

### Validation Logic

The validation is implemented as a compiled regex with a truthy-input guard:

```
# Not source of truth -- see src/sanitizer.py:50-66
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def validate_email(email: str | None) -> bool:
    if not email:
        return False
    return bool(_EMAIL_RE.match(email))
```

### Regex Semantics

- `^[^\s@]+` -- Local part: 1+ characters, no whitespace, no `@`
- `@` -- Literal `@`
- `[^\s@]+` -- Domain name: 1+ characters, no whitespace, no `@`
- `\.` -- Literal period
- `[^\s@]+$` -- TLD: 1+ characters, no whitespace, no `@`

### Design Decisions

- **No library dependency**: Per ADR-002, validation uses a regex, not a third-party email validation library.
- **Compiled once**: The regex is compiled at module load time (`_EMAIL_RE`), not on every call.
- **No exceptions**: Every input path returns `bool`. No try/except needed.
- **Thread-safe**: Immutable compiled regex, immutable input, no shared state.

## Dependencies

- **Upstream**: None (leaf function, no service calls out)
- **Downstream**: User Service (registration flow, login flow, profile update flow) — consumes the boolean result
- **ADR references**: ADR-001 (utility architecture), ADR-002 (regex validation), ADR-003 (API conventions)

## NFR Verification

| NFR | Requirement | How Verified |
|-----|-------------|-------------|
| NFR-PERF-001 | <1ms P95 for inputs <= 254 chars | Benchmark test with representative input set |
| NFR-REL-001 | 0 unhandled exceptions | Exhaustive input type test (str, None, edge cases) |
| NFR-REL-002 | Deterministic output | Repeated invocations with same input |
| NFR-SEC-001 | No uncontrolled resource consumption | Input length vs. memory allocation test |
| NFR-SEC-002 | No exception-based bypass | Fuzzing with crafted inputs |

## Test Cases (Mapped to Gherkin Examples)

| Test Method | Input | Expected |
|------------|-------|----------|
| `test_accepts_standard_email` | `user@domain.com` | `True` |
| `test_accepts_email_with_dot_in_local` | `user.name@domain.com` | `True` |
| `test_accepts_email_with_plus_tag` | `user+tag@domain.com` | `True` |
| `test_accepts_email_with_subdomain` | `user@sub.domain.com` | `True` |
| `test_accepts_minimal_email` | `a@b.co` | `True` |
| `test_accepts_multilevel_tld` | `user@domain.co.uk` | `True` |
| `test_accepts_dot_and_plus` | `user.name+tag@domain.org` | `True` |
| `test_rejects_missing_at` | `userdomain.com` | `False` |
| `test_rejects_local_only` | `user` | `False` |
| `test_rejects_empty_domain` | `user@` | `False` |
| `test_rejects_empty_local` | `@domain.com` | `False` |
| `test_rejects_no_tld` | `user@domain` | `False` |
| `test_rejects_whitespace_before_at` | `user @domain.com` | `False` |
| `test_rejects_whitespace_after_at` | `user@do main.com` | `False` |
| `test_rejects_leading_whitespace` | `  user@domain.com` | `False` |
| `test_rejects_double_dot_in_domain` | `user.name@domain..com` | `False` |

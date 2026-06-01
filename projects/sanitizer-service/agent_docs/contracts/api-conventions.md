---
title: "API Conventions -- validate_email"
status: current
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - ../docs/architecture/system-architecture.md
  - ../docs/architecture/ADRs/ADR-003-api-conventions.md
referenced_by:
  - ../architecture.md
  - ../hard-boundaries.md
changelog:
  - 1.0 | 2026-06-01 | Initial API conventions for email validation utility
---

# API Conventions -- `validate_email`

> **Purpose**: Defines the precise interface contract for the `validate_email` function. Agent reads this before implementing or modifying the function.

## 1. Function Signature

```python
def validate_email(email: str | None) -> bool:
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `str \| None` | Yes | The candidate email string to validate. May be `None`. |

### Return Value

| Value | Meaning | FR Trace |
|-------|---------|----------|
| `True` | The email string conforms to the basic format (non-empty local part, `@`, domain with at least one period, no whitespace) | FR-VAL-001 |
| `False` | The email string does not conform to the format, OR the input is `None`, OR the input is an empty string `""` | FR-VAL-001, FR-VAL-002 |

## 2. Error Handling

**No exceptions are raised.** Every possible input produces a boolean return value:

- `None` -> `False` (not an exception, not a crash)
- `""` -> `False`
- Any other type (if passed by a caller ignoring type hints) -- behavior is explicitly undefined but must not crash.
- Malformed strings -> `False`
- Valid strings -> `True`

This satisfies NFR-REL-001: 0 unhandled exceptions across the full input space.

## 3. Validation Rules

The function applies the following rules in order:

1. **Null/Empty Guard** (FR-VAL-002): If `email` is falsy (`None` or `""`), return `False` immediately.
2. **Format Check** (FR-VAL-001): Match the email against the compiled regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`.

The regex decomposes as:
- `^` -- Start of string
- `[^\s@]+` -- One or more characters that are NOT whitespace and NOT `@` (the local part)
- `@` -- Literal `@` symbol
- `[^\s@]+` -- One or more characters that are NOT whitespace and NOT `@` (the domain name)
- `\.` -- Literal period
- `[^\s@]+` -- One or more characters that are NOT whitespace and NOT `@` (the TLD)
- `$` -- End of string

Built-in properties:
- Whitespace anywhere in the string causes the match to fail (the character class `[^\s@]` excludes whitespace).
- Missing `@` causes match failure.
- Missing period in the domain causes match failure.
- Empty local part or domain part causes match failure (the `+` quantifier requires at least one character).

## 4. Performance Characteristics

| Metric | Threshold | NFR Trace |
|--------|-----------|-----------|
| P95 latency (input <= 254 chars) | < 1ms | NFR-PERF-001 |
| P99 latency (input <= 254 chars) | < 5ms | NFR-PERF-002 |
| P95 latency (null or empty input) | < 0.5ms | NFR-PERF-003 |

Performance is achieved through:
- Regex compiled once at module load time (no per-call recompilation).
- Early exit for null/empty inputs before the regex is evaluated.
- Regular expression execution is O(n) in input length.

## 5. Thread Safety

The function is thread-safe by construction:
- No shared mutable state.
- The compiled regex is an immutable object.
- Input is immutable (string or None).
- No I/O operations.

Multiple threads may call `validate_email` concurrently without any synchronization mechanism.

## 6. Versioning

The function is versioned as part of the `sanitizer-service` package. There is no per-function version.

- **Breaking change** (signature change, return type change): Package MINOR version increment.
- **Non-breaking change** (internal implementation change with same behavior): Package PATCH version increment.
- **Behavioral change** (acceptance criteria change): Requires SRS update, ADR amendment, and package MINOR version increment.

## 7. Usage Examples

### Registration Flow

```python
from src.sanitizer import validate_email

def register_user(email: str) -> User | None:
    if not validate_email(email):
        return None  # or raise a domain-specific error
    # proceed with registration
```

### Login Flow

```python
from src.sanitizer import validate_email

def authenticate(email: str, password: str) -> Session | None:
    if not validate_email(email):
        return None
    # proceed with authentication
```

### Profile Update Flow

```python
from src.sanitizer import validate_email

def update_profile(user_id: str, new_email: str) -> bool:
    if not validate_email(new_email):
        return False
    # proceed with profile update
```

## 8. Change Process

1. Propose the change in an ADR amendment.
2. Update SRS FR-VAL-001 or FR-VAL-002 if behavior changes.
3. Update this API conventions document.
4. Update the test suite (`tests/test_sanitizer.py`, class `TestValidateEmail`).
5. Bump the package version per the versioning rules above.

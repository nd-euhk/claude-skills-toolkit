---
title: "Cross-Cutting Design — sanitizer-service"
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: "LLD Agent"
depends_on:
  - ../architecture.md
  - ../hard-boundaries.md
  - ../../docs/architecture/system-architecture.md
referenced_by:
  - README.md
  - sanitizer-service.md
changelog:
  - 1.0 | 2026-06-01 | Initial cross-cutting design for sanitizer-service
---

# Cross-Cutting Design — sanitizer-service

> **Purpose**: Define shared infrastructure and cross-service concerns. Agent reads this before implementing anything that spans multiple services.

---

## 1. Shared Infrastructure

### 1.1 Logging

The Email Validation Utility does not perform logging. It is a pure function with no side effects.

- **Rationale**: Logging is an I/O operation (Constraint C-003 prohibits all I/O). The function's output is a boolean -- there is nothing meaningful to log.
- **Caller responsibility**: If auditing of validation outcomes is needed, the caller (User Service) logs the result at its discretion.

### 1.2 Monitoring

The Email Validation Utility does not emit metrics.

- **Rationale**: The utility is a leaf function with no dependencies to monitor. Monitoring instrumentation adds overhead that conflicts with the <1ms P95 latency target (NFR-PERF-001).
- **Caller responsibility**: The caller instruments invocation timing (e.g., via a decorator or wrapper) if needed. The utility itself is not instrumented.

### 1.3 Distributed Tracing

The Email Validation Utility does not create tracing spans.

- **Rationale**: The function has zero outbound calls; there are no child spans to correlate. The entire execution is a single regex match.
- **Caller responsibility**: If the caller uses distributed tracing (e.g., OpenTelemetry), the function call appears as an in-process operation within the caller's span. No explicit span creation is needed from the utility side.

### 1.4 Error Tracking

No error tracking (Sentry, etc.) is configured for the utility.

- **Rationale**: The function never raises exceptions (NFR-REL-001). Every input produces a boolean return value. There are no errors to track.

---

## 2. Authentication / Authorization

**Not applicable.** The Email Validation Utility is called by code within the same trust domain as the caller (ADR-001). It has no concept of users, roles, or permissions.

| Aspect | Design |
|--------|--------|
| Auth mechanism | None |
| Token propagation | None |
| Role-based access | None |
| Trust model | The caller is trusted by virtue of sharing the same process and import system |

Callers are responsible for access control. For example, the profile update flow should verify that the user is authenticated before calling `validate_email()`. The utility does not participate in authorization decisions.

---

## 3. Distributed Tracing Strategy

The Email Validation Utility is a leaf operation in any trace graph.

```
[User Service Span]
  ├── [Registration Flow]
  │     └── validate_email(email)   <-- leaf, no child spans
  ├── [Login Flow]
  │     └── validate_email(email)   <-- leaf, no child spans
  └── [Profile Update Flow]
        └── validate_email(email)   <-- leaf, no child spans
```

**Design decision**: No tracing instrumentation within the utility. The function is called within the caller's span. Its execution time is a sub-millisecond component of the caller's span duration and does not warrant separate instrumentation.

If tracing the utility becomes a requirement in the future:

1. Add an OpenTelemetry span as a decorator wrapping `validate_email`.
2. Span attributes: `email.length` (not the email itself -- privacy), `validation.result` (`true`/`false`).
3. This would be a non-breaking addition to the caller side, not a utility-internal change.

---

## 4. Configuration Management

### 4.1 Design

The Email Validation Utility has zero runtime configuration. The only "configuration" is the regex pattern, which is a module-level constant compiled at import time:

```python
# illustrative, not source of truth
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
```

### 4.2 Why No Runtime Configuration

| Concern | Rationale |
|---------|-----------|
| Regex pattern | Fixed by ADR-002. Changing it requires an ADR amendment, not a configuration toggle. |
| Performance tuning | No tunables exist. The function is a pure computation with no connection pools, thread pools, or cache sizes. |
| Feature flags | No features to toggle. The function does one thing and always does it the same way. |
| Environment-specific behavior | The function behaves identically in all environments (dev, staging, production). |

### 4.3 Hardcoded Configuration Rule

Per Hard Boundary #12 from `hard-boundaries.md`: "The regex pattern may be a module-level constant; it must not be fetched from an external source."

This means:
- **Allowed**: `_EMAIL_RE = re.compile(r"...")` as a Python module-level constant.
- **NOT allowed**: Reading the regex from an environment variable, config file, database, or any external source.

---

## 5. Error Handling Convention

| Aspect | Convention |
|--------|-----------|
| Exception raising | Never. Every input returns `bool` (NFR-REL-001). |
| Return value semantics | `True` = format accepted. `False` = format rejected or absent input. |
| Ambiguous results | None. Exactly two states: `True` or `False` (NFR-USE-001). |
| Caller error handling | `if not validate_email(email):` -- no try/except needed. |

---

## 6. Testing Conventions

| Aspect | Convention |
|--------|-----------|
| Test framework | `pytest` |
| Test file | `tests/test_sanitizer.py` |
| Test class | `TestValidateEmail` |
| Test naming | `test_<scenario>_<expected_outcome>` (e.g., `test_rejects_empty`, `test_accepts_standard_email`) |
| Test structure | Given/When/Then comment blocks matching Gherkin scenarios (Hard Boundary #26) |
| Coverage requirement | Every FR-VAL-001 and FR-VAL-002 Gherkin example row must have a corresponding test (Hard Boundary #25) |
| No mocks needed | The function has no external dependencies; tests call it directly |

---

## 7. Versioning Strategy

| Change Type | Package Version Impact | Requires |
|------------|----------------------|----------|
| Non-breaking implementation change (same behavior) | PATCH bump | No spec changes |
| Signature change (breaking) | MINOR bump | ADR-003 amendment, SRS update, test suite update |
| Behavioral change (acceptance criteria change) | MINOR bump | SRS update, ADR amendment, test suite update |
| New function added | MINOR bump | New FR spec, new test class |

The package version (`sanitizer-service`) is the sole versioning mechanism. The `validate_email` function itself is not independently versioned (ADR-003).

---

## 8. Dependency Management

The Email Validation Utility has zero third-party dependencies beyond the Python standard library.

| Module | Origin | Purpose |
|--------|--------|---------|
| `re` | Python stdlib | Regex compilation and matching |
| (none other) | -- | No other imports needed for `validate_email` |

The sibling function `sanitize_input` uses additional stdlib modules (`html`, `unicodedata`) that are not needed by `validate_email`. The two functions coexist in the same module for packaging convenience but are functionally independent.

---
title: "ADR-003: API Conventions for Email Validation Utility"
status: accepted
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - ../../product/SRS.md
  - ADR-001-email-validation-as-utility.md
referenced_by:
  - ../system-architecture.md
  - ../../../agent_docs/architecture.md
  - ../../../agent_docs/contracts/api-conventions.md
changelog:
  - 1.0 | 2026-06-01 | Initial decision
---

# ADR-003: API Conventions for Email Validation Utility

## Context

The Email Validation Utility is exposed as an in-process Python function (per ADR-001). Even as a simple function, it needs a well-defined interface contract that covers:

- Function signature (input type, output type)
- Error handling semantics (whether exceptions are raised)
- Thread safety guarantees
- Versioning strategy

The SRS defines the input/output interface in Section 4, but does not specify naming conventions, type annotations, or error handling posture beyond "no exceptions." We must codify these conventions for consistency across the codebase.

## Decision

**The `validate_email` function will follow these conventions:**

1. **Signature**: `validate_email(email: str | None) -> bool`
2. **Error handling**: No exceptions. All outcomes are expressed via the boolean return value.
3. **Thread safety**: The function is re-entrant and thread-safe (pure function with no shared mutable state).
4. **Versioning**: The function itself is not versioned at the signature level. The package version (`sanitizer-service`) serves as the versioning mechanism.
5. **Naming**: `validate_email` -- verb_noun pattern indicating action and target.
6. **Type hints**: Required for all public functions. Callers can use static type checkers (`mypy`, `pyright`) to verify usage.

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| **Option A: `validate_email(email: str \| None) -> bool` (chosen)** | Single responsibility (one function, one concern). Clear boolean result. Type-safe. No exception paths. Matches SRS Section 4 exactly. | No extensibility for additional result states (e.g., "format valid but domain invalid"). By design -- only format is checked. |
| Option B: Return a result object (e.g., `ValidationResult`) | Extensible -- can add reason codes, error messages later. | Over-engineered for a boolean check. Callers need format validation, not detailed diagnostics. Adds complexity with no SRS requirement. |
| Option C: Raise exceptions for invalid input | Pythonic in some contexts. | Violates NFR-REL-001 (0 unhandled exceptions) and SRS Section 4.2 ("No exceptions; all outcomes expressed via boolean return value"). Forces callers to use try/except for an expected outcome. |

### Why Option A

1. **SRS Compliance**: SRS Section 4.2 explicitly states: "No exceptions; all outcomes expressed via boolean return value." The chosen convention mirrors this exactly.

2. **Simplicity for callers**: Every caller can use a simple `if validate_email(email):` pattern. No try/except, no result unwrapping. This promotes adoption across registration, login, and profile update flows (NFR-MNT-001).

3. **Type safety**: The `str | None` input type and `bool` output type are precise. Static analysis can catch misuses (e.g., passing an integer) without runtime checks.

4. **Thread safety by construction**: A pure function with immutable arguments and no shared state needs no locks, no synchronization. Multiple threads can call `validate_email` concurrently without coordination.

5. **Package-level versioning**: The function is too simple to warrant independent versioning. The `sanitizer-service` package version (e.g., 1.0.0) captures all changes. If the function signature ever needs a breaking change, the package minor version increments.

### Interface Contract Summary

| Property | Specification | SRS Source |
|----------|---------------|------------|
| Function name | `validate_email` | SRS Section 2.1 (FR-VAL-001) |
| Input parameter | `email: str \| None` | SRS Section 4.1 |
| Output type | `bool` | SRS Section 4.2 |
| `True` meaning | Email format accepted | SRS FR-VAL-001 |
| `False` meaning | Email format rejected OR input is null/empty | SRS FR-VAL-001, FR-VAL-002 |
| Exceptions raised | None | NFR-REL-001 |
| Thread safety | Re-entrant, no shared state | SRS Constraint C-002 |
| Side effects | None | SRS Constraint C-003 |

## Consequences

### Positive

- Callers have a single, unambiguous interface to learn and use.
- Static type checking catches incorrect usage at development time.
- The boolean return enables simple conditional logic in all caller contexts.
- Thread safety is guaranteed by construction, requiring no documentation burden.
- Package-level versioning avoids the overhead of per-function versioning for a single simple function.

### Negative

- Adding additional result states (e.g., a reason for rejection) would require a signature change -- the boolean return is not extensible. **Mitigation**: This is by design per the SRS scope. If richer results are needed, a new function (e.g., `validate_email_detailed`) would be added alongside the existing one.
- The function does not differentiate between "null input" and "invalid format" -- both return `False`. **Mitigation**: This is intentional per FR-VAL-002. Callers should check for null/empty before calling if they need to distinguish these cases.

### Risks

- **Risk**: A caller accidentally passes a non-string type and the function behaves unexpectedly. **Mitigation**: Type hints catch this at static analysis time; runtime behavior for unexpected types is undefined but non-crashing (the `if not email` guard handles falsy values gracefully).

## Related

- SRS Section 4: External Interface Requirements
- SRS FR-VAL-001 (Email Format Validation)
- SRS FR-VAL-002 (Null and Empty Input Handling)
- NFR-REL-001 (No unhandled exceptions)
- NFR-MNT-001 (Reusable across flows without modification)
- Constraint C-001 (Synchronous)
- Constraint C-002 (Stateless)
- Constraint C-003 (No I/O)

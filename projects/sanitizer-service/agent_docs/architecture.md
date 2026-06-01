---
title: "Architecture -- Condensed"
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - ../docs/architecture/system-architecture.md
referenced_by:
  - hard-boundaries.md
  - contracts/api-conventions.md
changelog:
  - 1.0 | 2026-06-01 | Initial architecture summary for agents
---

# Architecture -- Condensed for Agent

> **Purpose**: Agent reads this file to understand the system topology and constraints before implementing or modifying anything.
>
> **Read before**: `docs/architecture/system-architecture.md` -- System topology, communication patterns, security architecture.
> **This file supplements**: Package structure, service quick reference, environment config.
>
> **Context budget**: ~100 lines.

---

## 1. Services Quick Reference

| Service | Type | Owns | Ports |
|---------|------|------|-------|
| sanitizer-service | Python package (utility library) | No data; stateless functions only | N/A (library) |

The entire project is a single Python package with two functions. There is no multi-service topology.

## 2. Function Registry

| Function | Signature | Behavior | FR Trace |
|----------|-----------|----------|----------|
| `validate_email` | `(email: str \| None) -> bool` | Returns `True` for valid email format, `False` for invalid/absent input. No exceptions. | FR-VAL-001, FR-VAL-002 |
| `sanitize_input` | `(input_val: str \| None) -> str` | Strips control chars, trims whitespace, normalizes Unicode to NFC, escapes HTML. Returns `""` for `None`. | Out of scope for T-001 |

## 3. Architecture Style

**Monolith / single-package utility.** The email validator is an in-process Python function with zero I/O, zero state, and zero external dependencies. It is imported as a library by the user service's registration, login, and profile update flows.

**Decision basis**: ADR-001 -- microservice overhead would violate NFR-PERF-001 (<1ms P95) and adds no value for a stateless, I/O-free computation.

## 4. Communication Patterns

**All communication is synchronous, in-process function calls.** There is no REST, gRPC, message broker, event bus, or any other inter-process communication within this project.

| Caller | Callee | Pattern |
|--------|--------|---------|
| User Service (registration flow) | `validate_email()` | Sync function call |
| User Service (login flow) | `validate_email()` | Sync function call |
| User Service (profile update flow) | `validate_email()` | Sync function call |

## 5. Data Ownership

The Email Validation Utility owns no data. It is a pure computation:

- No database tables
- No file storage
- No in-memory cache
- No environment-specific state

## 6. Security

- **Trust boundary**: The caller provides untrusted input. The utility returns a boolean for every possible input -- no exceptions, no crashes.
- **Authentication**: Not applicable. The utility is called by code within the same trust domain.
- **Data protection**: N/A -- no data at rest or in transit. The email string is processed in memory and returned as a boolean.

## 7. Key Constraints Agents Must Respect

1. `validate_email` must remain pure -- no I/O, no state, no side effects (C-001, C-002, C-003).
2. `validate_email` must never raise an exception (NFR-REL-001).
3. `validate_email` must return `False` for `None` and `""` (FR-VAL-002).
4. The regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` is the canonical validation rule (ADR-002).
5. All changes to validation behavior require an ADR amendment.
6. Test coverage must match every FR scenario (NFR-MNT-002).

## 8. Package Structure

```
sanitizer-service/
├── src/
│   ├── __init__.py
│   └── sanitizer.py          # validate_email() + sanitize_input()
├── tests/
│   ├── __init__.py
│   └── test_sanitizer.py     # TestValidateEmail, TestSanitizeInput
├── docs/
│   ├── product/
│   │   └── SRS.md
│   └── architecture/
│       ├── system-architecture.md
│       ├── ADRs/
│       └── diagrams/
└── agent_docs/
    ├── architecture.md        # This file
    ├── hard-boundaries.md
    ├── domain-service-mapping.yaml
    ├── traceability/
    │   └── requirements-matrix.md
    └── contracts/
        ├── api-conventions.md
        └── events.md
```

## 9. Cross-Cutting Concerns

| Concern | Implementation |
|---------|---------------|
| Testing | `pytest` -- unit tests call functions directly, no mocks needed |
| Type checking | Python type hints (`str | None`, `-> bool`) -- compatible with `mypy`/`pyright` |
| Versioning | Package-level (`sanitizer-service` version in setup/package metadata) |
| Logging | N/A -- pure function with no side effects |
| Monitoring | N/A -- caller is responsible for timing the function call |

# Scout Report: sanitizer-service (explore-codebase)

## 1. Overview

The sanitizer-service is a single Python utility package that provides input validation and sanitization functions. It exposes two stateless, synchronous utility functions: `validate_email()` for email format validation and `sanitize_input()` for string sanitization. The service is an in-process library (not a microservice) with zero I/O, zero external dependencies, and zero persistent state.

## 2. Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | Python | 3.x | Implementation language for utility functions |
| Testing | pytest | N/A | Unit test framework |
| Stdlib: re | Python re module | stdlib | Compiled regex for email format validation |
| Stdlib: html | Python html module | stdlib | HTML entity escaping |
| Stdlib: unicodedata | Python unicodedata | stdlib | Unicode NFC normalization |
| Frontend | JavaScript (vanilla) | ES6+ | Stub EmailInput component |
| Docs | Markdown/YAML | N/A | SRS, HLD, ADRs, agent_docs |
| Diagrams | Mermaid | N/A | C4 architecture diagrams |

## 3. Directory Structure

```
sanitizer-service/
├── src/
│   ├── __init__.py                 # Package init (empty)
│   └── sanitizer.py                # Core: validate_email(), sanitize_input()
├── tests/
│   ├── __init__.py                 # Test package init
│   ├── test_sanitizer.py           # Tests for sanitize_input + validate_email
│   └── test_notempty.py            # Tests for validate_not_empty()
├── frontend/
│   └── src/components/
│       └── EmailInput.js           # Stub client-side email input component
├── docs/
│   ├── product/
│   │   ├── SRS.md                  # Software Requirements Specification
│   │   └── features/email-validation/
│   │       ├── FR-VAL-001--email-format-validation.md
│   │       └── FR-VAL-002--null-empty-input-handling.md
│   └── architecture/
│       ├── system-architecture.md  # HLD with C4 diagrams and ADRs
│       ├── ADRs/
│       │   ├── ADR-001-email-validation-as-utility.md
│       │   ├── ADR-002-regex-vs-library-validation.md
│       │   └── ADR-003-api-conventions.md
│       └── diagrams/
│           ├── system-context.mermaid
│           ├── container-diagram.mermaid
│           └── data-flow.mermaid
└── agent_docs/
    ├── architecture.md             # Condensed architecture for agents
    ├── hard-boundaries.md          # Absolute rules for agents (27 boundaries)
    ├── domain-service-mapping.yaml # Domain ownership and FR-to-service mapping
    ├── traceability/
    │   └── requirements-matrix.md  # FR-to-source-to-test mapping
    ├── contracts/
    │   ├── api-conventions.md      # validate_email interface contract
    │   └── events.md               # Event registry (none defined)
    ├── tech-design/
    │   ├── README.md
    │   ├── sanitizer-service.md
    │   └── cross-cutting.md
    ├── features/
    │   ├── FR-VAL-001-impl.md
    │   ├── FR-VAL-002-impl.md
    │   ├── FR-VAL-003-impl.md
    │   └── FR-VAL-004-impl.md
    └── backend/sanitizer-service/test-specs/
        ├── FR-VAL-001-test.md
        ├── FR-VAL-002-test.md
        ├── FR-VAL-003-test.md
        └── FR-VAL-004-test.md
```

## 4. Modules and Responsibilities

| Module | Responsibility | Dependencies | Public API |
|--------|---------------|-------------|------------|
| `src/sanitizer.py` | Core utility functions: `validate_email()` for email format validation, `sanitize_input()` for string sanitization, `validate_not_empty()` for non-empty checks | Python stdlib only (re, html, unicodedata) | `validate_email(email: str\|None) -> bool`, `sanitize_input(input_val: str\|None) -> str`, `validate_not_empty(input_val: str\|None) -> bool` |
| `tests/test_sanitizer.py` | Unit tests for `sanitize_input()` and `validate_email()` | pytest, src.sanitizer | `TestSanitizeInput`, `TestValidateEmail` |
| `tests/test_notempty.py` | Unit tests for `validate_not_empty()` | pytest, src.sanitizer | `TestValidateNotEmpty` |
| `frontend/EmailInput.js` | Client-side email input component (stub) | None (vanilla JS) | `createEmailInput()`, `validateEmailInput()`, `showError()`, `hideError()` |
| `docs/product/SRS.md` | Software Requirements Specification (reverse-engineered from code) | None | Requirements documentation |
| `docs/architecture/` | HLD, ADRs (3 decisions), C4 diagrams | SRS | Architecture documentation |
| `agent_docs/` | Agent reference documentation: boundaries, contracts, traceability | SRS, HLD | Agent guidance |

## 5. Entry Points

| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| `validate_email` | Python function | `src/sanitizer.py:50-66` | Email format validation; returns bool |
| `sanitize_input` | Python function | `src/sanitizer.py:10-47` | String sanitization pipeline; returns str |
| `validate_not_empty` | Python function | `src/sanitizer.py:69-81` | Non-empty input validation; returns bool |

## 6. Dependencies

### Internal Dependencies

None. The sanitizer-service has no internal module dependencies beyond the Python stdlib. There are no cross-module imports between `sanitize_input` and `validate_email` -- they are fully independent.

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Python stdlib: re | built-in | Compiled regex for email format validation |
| Python stdlib: html | built-in | HTML entity escaping in sanitize_input |
| Python stdlib: unicodedata | built-in | Unicode NFC normalization in sanitize_input |
| pytest | N/A | Test framework (dev dependency only) |

## 7. Architectural Patterns

**Architecture Style**: In-process utility library (Modular Monolith pattern). The service is deployed as a Python package imported directly by callers -- no network boundary, no API gateway, no message broker.

**Pure Functions**: All three public functions are pure: same input always produces same output, no side effects, no I/O, no mutable state. This is enforced by 27 hard boundaries in `agent_docs/hard-boundaries.md`.

**Stateless Design**: The service owns zero data (no database, no cache, no files). Each invocation is independent.

**Regex-Based Validation**: Email validation uses a compiled regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) compiled at module load time, providing O(n) performance with no per-call recompilation overhead.

**Contract-First Design**: Function signatures are governed by ADR-003 with strict type hints (`str | None` inputs, `bool` returns). The API conventions are documented in `agent_docs/contracts/api-conventions.md`.

**Hard Boundaries Enforcement**: 27 absolute rules prohibit: I/O operations, mutable state, external dependencies, exception raising, data persistence, signature changes without ADR amendment.

**Architecture Decision Records**: Three ADRs document key architectural decisions:
- ADR-001: Utility function vs. microservice (chose utility for performance/constraints)
- ADR-002: Regex vs. library-based validation (chose regex for zero deps, performance)
- ADR-003: API conventions (chose boolean return, no exceptions, type hints)

**Data Flow**: Caller -> `validate_email(email: str|None)` -> null/empty guard -> regex match -> `bool` result. All calls are synchronous, in-process function calls.

**C4 Context Level**: End User -> User Application (Registration/Login/Profile flows) -> sanitizer-service (validate_email, sanitize_input). No external systems -- the utility has zero external dependencies.

**C4 Container Level**: sanitizer-service is a single Python package containing two components: `validate_email()` and `sanitize_input()`. User Service calls both directly in-process.

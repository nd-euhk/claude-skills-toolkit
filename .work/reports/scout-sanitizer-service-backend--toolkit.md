# Scout Report: sanitizer-service Backend

## 1. Overview

The sanitizer-service backend is a Python utility library providing stateless input validation and sanitization functions. It supports email format validation (`validate_email`) and string sanitization (`sanitize_input`) as pure functions with zero I/O, zero side effects, and zero external dependencies.

## 2. Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | Python | 3.x | Implementation language |
| Regex | `re` (stdlib) | stdlib | Email format pattern matching |
| Unicode | `unicodedata` (stdlib) | stdlib | NFC normalization |
| HTML | `html` (stdlib) | stdlib | HTML entity escaping |
| Testing | pytest | - | Unit testing framework |

## 3. Directory Structure

```
projects/sanitizer-service/
├── src/
│   ├── __init__.py              # Package init (empty)
│   └── sanitizer.py             # Core: validate_email(), sanitize_input(), validate_not_empty()
├── tests/
│   ├── __init__.py
│   ├── test_sanitizer.py        # TestValidateEmail, TestSanitizeInput classes
│   └── test_notempty.py         # TestValidateNotEmpty class
├── docs/
│   ├── product/
│   │   └── SRS.md               # Software Requirements Specification
│   └── architecture/
│       ├── system-architecture.md  # HLD with C4 diagrams
│       ├── ADRs/                   # Architecture Decision Records (3 ADRs)
│       └── diagrams/               # Mermaid diagram sources
├── agent_docs/
│   ├── architecture.md            # Condensed architecture for agents
│   ├── hard-boundaries.md         # Absolute constraints
│   ├── domain-service-mapping.yaml # Service-to-domain mapping
│   ├── contracts/                 # API conventions, events
│   ├── features/                  # FR-VAL-001, FR-VAL-002 feature specs
│   ├── tech-design/               # LLD: sanitizer-service.md, cross-cutting.md
│   └── traceability/              # Requirements traceability matrix
└── frontend/                      # Frontend stubs (separate sub-project)
```

## 4. Modules and Responsibilities

| Module | Responsibility | Dependencies | Public API |
|--------|---------------|-------------|------------|
| `sanitizer.py:_EMAIL_RE` | Compiled regex constant for email format validation | `re` | Module-level constant |
| `sanitizer.py:validate_email()` | Validates email format; handles null/empty; returns bool | `_EMAIL_RE` | `validate_email(email: str | None) -> bool` |
| `sanitizer.py:sanitize_input()` | Strips control chars, trims, normalizes Unicode, escapes HTML | `re`, `unicodedata`, `html` | `sanitize_input(input_val: str | None) -> str` |
| `sanitizer.py:validate_not_empty()` | Checks if string has non-whitespace content | None | `validate_not_empty(input_val: str | None) -> bool` |

## 5. Entry Points

| Entry Point | Type | Path | Description |
|------------|------|------|-------------|
| `validate_email` | Python function | `src/sanitizer.py:50-66` | Email format validation — main public API |
| `sanitize_input` | Python function | `src/sanitizer.py:10-47` | Input sanitization utility |
| `validate_not_empty` | Python function | `src/sanitizer.py:69-81` | Non-empty check utility |

## 6. Dependencies

### Internal
| Module | Depends On | Relationship |
|--------|-----------|-------------|
| `validate_email()` | `_EMAIL_RE` | Uses compiled regex for pattern matching |

### External
| Package | Version | Purpose |
|--------|---------|---------|
| Python stdlib `re` | stdlib | Regex compilation and matching |
| Python stdlib `unicodedata` | stdlib | NFC normalization (sanitize_input) |
| Python stdlib `html` | stdlib | HTML escaping (sanitize_input) |
| pytest | - | Test framework |

## 7. Architectural Patterns

**Architecture Style**: Modular Monolith / Utility Library

**Observed Patterns**:
- Pure Function Pattern: All public functions are stateless, side-effect-free, and deterministic
- Guard Clause Pattern: Early returns for null/empty inputs before computation
- Module-Level Constants: Regex compiled once at import time, reused across all calls
- No I/O Constraint: Zero database, filesystem, network access (Constraint C-003)
- TDD Structure: Tests written before implementation with Given/When/Then comment blocks

**Data Flow**: Caller -> validate_email(email) -> [guard check] -> [regex match] -> bool result -> Caller

**Code Evidence**:
- `src/sanitizer.py:5` — `_EMAIL_RE = re.compile(...)` — compiled at module load
- `src/sanitizer.py:61` — `if not email: return False` — guard clause for null/empty
- `src/sanitizer.py:66` — `return bool(_EMAIL_RE.match(email))` — regex match

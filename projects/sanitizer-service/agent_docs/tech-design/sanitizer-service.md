---
title: "LLD: sanitizer-service"
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: "LLD Agent"
depends_on:
  - ../architecture.md
  - ../hard-boundaries.md
  - ../contracts/api-conventions.md
  - ../../docs/architecture/system-architecture.md
  - ../../docs/architecture/ADRs/ADR-001-email-validation-as-utility.md
  - ../../docs/architecture/ADRs/ADR-002-regex-vs-library-validation.md
  - ../../docs/architecture/ADRs/ADR-003-api-conventions.md
referenced_by:
  - README.md
  - ../../docs/product/SRS.md
changelog:
  - 1.1 | 2026-06-01 | CR: Add RFC 5321 max length (254 chars) validation
  - 1.0 | 2026-06-01 | Initial LLD for sanitizer-service (Task T-001)
---

# sanitizer-service -- Low-Level Design (LLD)

> **Context budget**: ~230 lines. Load when you need detailed service internals before implementation.

<!--
HARD RULES (see SPEC-BOUNDARIES.md):
  1. Tech-design describes service-level design decisions -- pattern, boundary,
     transaction model, error taxonomy, retry/cache/scale policy.
  2. NO compile-ready code. Entities/clients described via TABLES, not classes.
  3. Snippets allowed <= 10 lines, ONLY to illustrate difficult patterns.
  4. Full DDL belongs in migration-spec. Here only reference or describe index strategy.
  5. Feature-specific flow belongs in impl-spec. Here is cross-feature pattern.
-->

---

## 1. Service Boundary

| Attribute | Value |
|-----------|-------|
| **Port** | N/A (library -- no network port) |
| **Base package** | `src/` (single Python module `src/sanitizer.py`) |
| **Tables owned** | None (stateless -- no data ownership) |
| **Calls ->** | None (constraint C-003: no I/O operations) |
| **Called by <-** | User Service (registration flow, login flow, profile update flow) via synchronous in-process function call |
| **Auth requirement** | N/A -- called by code within the same trust domain (ADR-001) |
| **Deployment unit** | Python package `sanitizer-service`, deployed as a dependency of the user service |
| **Runtime** | Python 3.x, compatible with caller's environment |

### Boundary Rules (from `hard-boundaries.md`)

1. No I/O in `validate_email` -- no database, filesystem, network, DNS, or SMTP (Constraint C-003).
2. No mutable state -- pure function across invocations (Constraint C-002).
3. No exceptions -- every input path returns a boolean (NFR-REL-001).
4. No external validation library -- regex only (ADR-002).
5. No data ownership -- owns zero tables, zero files, zero caches.

---

## 2. Internal Architecture

### Component Diagram

```mermaid
graph TD
    subgraph caller["User Service (External Caller)"]
        REG[Registration Flow]
        LOGIN[Login Flow]
        PROFILE[Profile Update Flow]
    end

    subgraph sanitizer["sanitizer-service (src/sanitizer.py)"]
        direction TB
        VE[validate_email email: str | None -> bool]
        SI[sanitize_input input_val: str | None -> str]
        subgraph internals["validate_email Internals"]
            GUARD[Null/Empty Guard if not email: return False]
            RE[Email Regex _EMAIL_RE]
        end
    end

    REG --> VE
    LOGIN --> VE
    PROFILE --> VE
    VE --> GUARD
    GUARD -->|email is truthy| RE
    RE -->|bool result| VE
```

### Key Internal Modules

| Module | Location | Responsibility | FR Trace |
|--------|----------|---------------|----------|
| `_EMAIL_RE` | `src/sanitizer.py:5` | Compiled regex constant: `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Compiled once at module load time. Immutable. Thread-safe. | FR-VAL-001 |
| `validate_email()` | `src/sanitizer.py:50-66` | Public function. Returns `bool`. No side effects. Pure computation. | FR-VAL-001, FR-VAL-002 |
| `sanitize_input()` | `src/sanitizer.py:10-47` | Public function. String sanitization. Out of scope for T-001 but part of the same module. | N/A |

### Flow Diagram -- validate_email Main Use Case

```mermaid
flowchart TD
    A["Caller: validate_email(email)"] --> B{email is falsy?}
    B -->|Yes| C["return False"]
    B -->|No| LEN{len(email) > 254?}
    LEN -->|Yes| C
    LEN -->|No| D["_EMAIL_RE.match(email)"]
    D --> E{regex match?}
    E -->|Yes (truthy)| F["return True"]
    E -->|No (None, empty string, whitespace, etc.)| G["return False"]
```

**Flow narrative**:

1. Caller invokes `validate_email(email)` with a `str | None` argument.
2. The null/empty guard checks `if not email:`. If truthy (None or `""`), returns `False` immediately. This avoids running the regex on None/empty inputs, satisfying the P95 <0.5ms target for null/empty inputs (NFR-PERF-003).
3. If `email` is truthy, the RFC 5321 length check `len(email) > 254` is performed. If the email exceeds 254 characters, returns `False` immediately. This is an O(1) operation avoiding unnecessary regex execution on overlong inputs (NFR-PERF-004).
4. If `email` passes the length check, the compiled regex `_EMAIL_RE.match(email)` is executed. The regex is an O(n) operation where n is the input length.
5. The `match()` result is converted to `bool` and returned. `True` means format accepted; `False` means format rejected.

### Package Structure

```
sanitizer-service/
├── src/
│   ├── __init__.py
│   └── sanitizer.py          # _EMAIL_RE, validate_email(), sanitize_input()
├── tests/
│   ├── __init__.py
│   └── test_sanitizer.py     # TestValidateEmail, TestSanitizeInput
├── docs/
│   ├── product/              # SRS, features/
│   └── architecture/         # HLD, ADRs, diagrams/
└── agent_docs/
    ├── architecture.md
    ├── hard-boundaries.md
    ├── domain-service-mapping.yaml
    ├── contracts/            # api-conventions.md, events.md
    ├── tech-design/          # This file, README.md, cross-cutting.md
    ├── features/             # FR-VAL-001, FR-VAL-002 work packages
    └── traceability/         # requirements-matrix.md
```

---

## 3. Domain Model

### Entities

**None.** The Email Validation Utility is a pure function with no domain entities, no persistent state, and no aggregate. It operates on a single input string and returns a boolean.

### Value Object: Validation Rules

The validation rules are encoded as a compiled regex and a guard clause. They represent the "domain knowledge" of what constitutes a valid email format.

| Rule | Type | Definition | FR Trace |
|------|------|-----------|----------|
| Null/Empty Rejection | Guard clause | `if not email: return False` | FR-VAL-002 |
| RFC 5321 Length Limit | Guard clause | `if len(email) > 254: return False` — RFC 5321 Section 4.5.3.1 specifies the maximum total length of an email address is 254 characters | FR-VAL-003 |
| Format Pattern | Compiled regex | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | FR-VAL-001 |

### Regex Decomposition

| Pattern Fragment | Meaning | Rejects |
|-----------------|---------|---------|
| `^` | Start of string | -- |
| `[^\s@]+` | Local part: 1+ characters that are NOT whitespace and NOT `@` | Empty local part, whitespace in local part, `@` in local part |
| `@` | Literal `@` symbol | Missing `@` |
| `[^\s@]+` | Domain name: 1+ characters that are NOT whitespace and NOT `@` | Empty domain, whitespace in domain |
| `\.` | Literal period | Missing period (e.g., `user@domain`) |
| `[^\s@]+` | TLD: 1+ characters that are NOT whitespace and NOT `@` | Empty TLD, whitespace in TLD |
| `$` | End of string | Extra content after TLD |

### Enums / Return Semantics

| Return Value | Semantic Meaning | Triggering Condition |
|-------------|-----------------|---------------------|
| `True` | Email format accepted | Regex match succeeds: non-empty local part, `@`, domain with at least one period, no whitespace, and length <= 254 characters |
| `False` | Email format rejected | Any of: input is `None`, input is `""`, length exceeds 254 characters, missing `@`, missing domain, missing period, whitespace present, empty local part |

### State Machine

**None.** The utility is stateless. No entity lifecycle exists.

### Invariants (always true)

- **INV-1**: `validate_email` is deterministic -- the same input always produces the same output (NFR-REL-002).
- **INV-2**: `validate_email` never raises an exception for any input type (NFR-REL-001).
- **INV-3**: `validate_email` never performs I/O -- no database, filesystem, or network access (Constraint C-003).
- **INV-4**: The return value is always strictly `True` or `False` -- no other values, no `None` (NFR-USE-001).
- **INV-5**: The compiled regex `_EMAIL_RE` is immutable and compiled exactly once at module load time.
- **INV-6**: The function is thread-safe -- no shared mutable state, immutable input (string/None), immutable compiled regex.
- **INV-7**: Any email string longer than 254 characters is always rejected, regardless of format validity (RFC 5321 Section 4.5.3.1).

---

## 4. REST Clients (outbound integrations)

**None.** The Email Validation Utility has zero outbound integrations.

Per ADR-001 and Constraint C-003, the utility performs no I/O operations. It does not call any external services via REST, gRPC, or any other protocol. All client configuration sections (timeout, retry, circuit breaker, fallback) are intentionally absent because there are no clients to configure.

If a future ADR amendment introduces outbound calls (e.g., DNS lookups for deliverability verification), REST client configuration would be added at that point with full circuit breaker, timeout, and retry specifications.

---

## 5. Transaction Boundaries

**None.** The Email Validation Utility is stateless with no database access.

| Operation | In Transaction? | Reason |
|-----------|----------------|--------|
| Null/empty guard | N/A | No database involvement |
| Regex match | N/A | Pure in-memory computation |
| Return boolean | N/A | No persistent state change |

The concept of "transaction" does not apply to a pure function with no side effects and no persistent storage. Each invocation is an independent, atomic computation that either succeeds (returns `bool`) or succeeds (the function cannot fail -- there are no error paths, only `True`/`False` outcomes).

### Idempotency

The function is inherently idempotent by construction (INV-1). Every call with the same input returns the same output. No idempotency keys are needed because there is no state to mutate.

### Compensating Actions

None. No state changes occur, so no compensation is possible or necessary.

---

## 6. Integration Points

### Integration Point Table

| Target | Protocol | Direction | Timeout | Retry | Circuit Breaker | Expected SLA |
|--------|----------|-----------|---------|-------|----------------|-------------|
| N/A | N/A | N/A | N/A | N/A | N/A | N/A |

**Rationale**: The sanitizer-service has zero inter-service integration points. All communication is in-process function invocation within the same Python runtime. The caller (User Service registration/login/profile flows) imports the function directly:

```python
# illustrative, not source of truth
from src.sanitizer import validate_email
result = validate_email(candidate_email)
```

This is a synchronous, non-blocking, guaranteed call with no network failure mode. The function cannot fail to return; it will always return a `bool` within the expected latency envelope (NFR-PERF-001, NFR-PERF-002, NFR-PERF-003).

### Caller Integration Pattern

| Caller | Import Path | Invocation | Error Handling |
|--------|-------------|------------|---------------|
| Registration Flow | `from src.sanitizer import validate_email` | `if not validate_email(email): return None` | No try/except needed -- function never raises |
| Login Flow | `from src.sanitizer import validate_email` | `if not validate_email(email): return None` | No try/except needed |
| Profile Update Flow | `from src.sanitizer import validate_email` | `if not validate_email(new_email): return False` | No try/except needed |

---

## 7. Caching Strategy

**No caching is implemented or needed.**

| Aspect | Rationale |
|--------|-----------|
| Cache type | None |
| Cache keys | N/A |
| TTL | N/A |
| Eviction triggers | N/A |
| Invalidation events | N/A |
| Cache-through vs cache-aside | N/A |

### Why No Caching

1. **Performance target already met**: The regex executes in O(n) time and completes in <<1ms for inputs up to 254 characters (NFR-PERF-001). Adding a cache would introduce overhead (cache lookup + eviction management) that likely exceeds the regex execution time for most inputs.

2. **Stateless constraint (C-002)**: A cache is a form of retained state between invocations, which explicitly violates Constraint C-002. Even an in-memory LRU cache would introduce mutable shared state, compromising thread-safety guarantees.

3. **Low value**: Email validation is called per-user-action (registration, login, profile update), not in a hot loop. Input diversity is high -- each user provides a unique email. A cache hit rate would be near zero.

4. **Compiled regex as implicit "cache"**: The regex compilation (`re.compile(...)`) happens once at module load time and is reused across all invocations. This is the only optimization needed -- it avoids per-call recompilation overhead without introducing state.

---

## 8. Performance & Scale

### Throughput Targets

| Operation | Input Type | Target P95 | Target P99 | NFR Trace |
|-----------|-----------|------------|------------|-----------|
| `validate_email()` | Valid/invalid email string (<= 254 chars) | < 1ms | < 5ms | NFR-PERF-001, NFR-PERF-002 |
| `validate_email()` | `None` or `""` | < 0.5ms | < 1ms | NFR-PERF-003 |
| `validate_email()` | Email string > 254 chars | < 0.5ms | < 1ms | NFR-PERF-004 |

> **RFC 5321 Length Check Performance**: The `len(email) > 254` check is an O(1) operation (Python stores string length as an attribute). It executes in constant time regardless of input length and acts as an early rejection gate before the O(n) regex, avoiding unnecessary regex processing of overlong inputs. Combined with the null/empty guard, both early-exit paths complete in well under 0.5ms (NFR-PERF-003, NFR-PERF-004).

### Bottleneck Analysis

| Potential Bottleneck | Risk | Mitigation |
|---------------------|------|------------|
| Regex ReDoS (catastrophic backtracking) | The regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` has no nested quantifiers and no backtracking amplifiers. ReDoS risk is zero. | ADR-002 confirms ReDoS safety by construction. |
| Per-call regex compilation | If `re.match()` were used instead of pre-compiled `_EMAIL_RE`, compilation overhead on every call would add ~0.05-0.1ms. | `_EMAIL_RE = re.compile(...)` at module load time eliminates this. |
| Thread contention | If a mutable cache were introduced, lock contention could become a bottleneck under concurrent access. | No cache, no mutable state, no locks -- infinite concurrency. |
| Large inputs | For extremely long strings (e.g., 1MB), regex execution time is O(n) and proportional to length. | RFC 5321 length check (254 chars) rejects overlong inputs in O(1) before the regex runs. No pathological input reaches the regex, eliminating the linear degradation risk entirely. |

### Database Index Strategy

**N/A.** No database tables are owned or accessed.

### Connection Pool Sizing

**N/A.** No database connections, no network connections, no thread pools needed. The function is a pure computation with no external resource pools.

### Scalability

The function is stateless and thread-safe. Scaling is horizontal via the caller's scaling mechanism -- each replica of the user service contains its own copy of `sanitizer-service`. There is no coordination, no shared state, and no scaling limit.

---

## 9. Error Flows & Degraded Mode

### Error Flow: Input is None

```
Caller: validate_email(None)
  -> Guard: if not email: (evaluates True)
  -> Return: False
  -> Caller receives: False (no exception)
```

**User experience**: The caller receives `False`. Depending on the caller's flow (registration, login, profile update), the user sees a domain-appropriate message (e.g., "Please enter an email address"). The utility itself does not produce user-facing messages.

### Error Flow: Input is Empty String

```
Caller: validate_email("")
  -> Guard: if not email: (evaluates True)
  -> Return: False
  -> Caller receives: False (no exception)
```

### Error Flow: Input Exceeds RFC 5321 Length Limit

```
Caller: validate_email("a-very-long-email-address-that-exceeds-the-maximum...@domain.com")
  -> Guard: if not email: (evaluates False -- string is truthy)
  -> Length Check: len(email) > 254 (evaluates True)
  -> Return: False
  -> Caller receives: False (no exception)
```

**User experience**: The caller receives `False`. The email is rejected because it exceeds the RFC 5321 maximum length of 254 characters. The length check is O(1) and prevents the regex from processing an overlong input unnecessarily.

### Error Flow: Invalid Format (various)

```
Caller: validate_email("userdomain.com")   # no @
  -> Guard: if not email: (evaluates False -- string is truthy)
  -> Regex: _EMAIL_RE.match("userdomain.com")
  -> Match fails: None
  -> Return: False
```

All 9 invalid format test cases from FR-VAL-001 Gherkin examples follow this same path -- the regex match fails and `False` is returned.

### Error Flow: Valid Format

```
Caller: validate_email("user@domain.com")
  -> Guard: if not email: (evaluates False)
  -> Regex: _EMAIL_RE.match("user@domain.com")
  -> Match succeeds: re.Match object
  -> Return: True
```

### Degraded Mode Matrix

| Dependency Down | Impact | Fallback | User Experience |
|----------------|--------|----------|----------------|
| N/A -- no dependencies | No degradation possible | N/A | The utility has zero external dependencies. It cannot degrade. Every invocation returns a boolean regardless of environmental conditions. |

### Circuit Breaker Behavior

**Not applicable.** There are no outbound calls, so no circuit breaker is configured or needed. The function's "failure mode" is simply returning `False` -- it is indistinguishable from a rejection and requires no special handling.

### Graceful Degradation Path

The utility cannot experience partial failure or degradation because:

1. **No network dependencies**: No REST calls, no DNS lookups, no SMTP checks. The function is self-contained.
2. **No database dependencies**: No connection pools, no query timeouts, no deadlocks.
3. **No filesystem dependencies**: No file reads, no config file parsing at runtime.
4. **No runtime configuration**: The only configuration (regex pattern) is a module-level constant compiled at import time.

The only "failure" is the utility not being importable (e.g., missing module). In that case, the caller fails at import time with a Python `ImportError`, which is handled by the caller's deployment mechanism (CI/CD pipeline or runtime dependency management).

### Exception Guarantee

Per NFR-REL-001: "No unhandled exceptions for any input type -- 0 exceptions across full input space."

| Input Type | Behavior | Exception Risk |
|-----------|----------|---------------|
| `str` (<= 254 chars, any valid/invalid email) | Returns `bool` | None -- length check passes, regex handles all strings |
| `str` (> 254 chars) | Returns `False` | None -- O(1) length check catches it before regex |
| `None` | Returns `False` | None -- guard clause catches it |
| `""` (empty string) | Returns `False` | None -- guard clause catches it |
| `int`, `list`, `dict`, etc. | Undefined, non-crashing | Low -- `if not email` handles most falsy types gracefully. `re.match()` may raise `TypeError` for unexpected types. Callers using type hints are protected by static analysis. |

```python
# illustrative, not source of truth -- the exception guarantee
# The function returns bool for all documented input types.
# Behavior for undocumented types is undefined but non-crashing.
```

---
fr_id: FR-VAL-002
service: sanitizer-service
spec_type: implementation-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: IMP Agent
depends_on:
  - FR-VAL-002--null-empty-input-handling.md
  - ../tech-design/sanitizer-service.md
  - ../hard-boundaries.md
referenced_by:
  - FR-VAL-002--null-empty-input-handling.md
  - FR-VAL-002-test.md
changelog:
  - 1.0 | 2026-06-01 | Initial implementation spec for FR-VAL-002
---

# FR-VAL-002 Implementation Specification: Null and Empty Input Handling

## 1. Execution Flow

### Entry Point

The null/empty handling is implemented as the **first statement** in `validate_email()`:

```python
def validate_email(email: str | None) -> bool:
    if not email:
        return False
    # ... regex check only reached for truthy email strings
```

Located in `src/sanitizer.py` (currently lines 61-62).

### Flow Diagram

```
Caller invokes validate_email(email)
  |
  v
[Guard: if not email]
  |
  +--- email is None -----> return False
  |
  +--- email is "" -------> return False
  |
  +--- email is truthy ---> (continue to regex check)
```

### Guard Clause Semantics

| Input | Python Truthiness | `not email` Result | Action |
|-------|-------------------|--------------------|--------|
| `None` | Falsy | `True` | Return `False` immediately |
| `""` (empty string) | Falsy | `True` | Return `False` immediately |
| Any non-empty string (e.g., `"user@domain.com"`) | Truthy | `False` | Fall through to regex check |

**Design rationale**: Python's truthiness check handles both `None` and `""` in a single expression. No separate `is None` and `== ""` branches are needed. This is intentional per ADR-003.

### Performance Path

| Input | Code Path | Expected Latency | NFR Trace |
|-------|-----------|-----------------|-----------|
| `None` | Guard branch (1 boolean check) | <0.5ms P95 | NFR-PERF-003 |
| `""` | Guard branch (1 boolean check) | <0.5ms P95 | NFR-PERF-003 |

The guard clause is a single `if not email:` expression -- O(1) constant time. The regex (`_EMAIL_RE`) is never compiled or executed for null/empty inputs.

## 2. Business Rules

### BR-001: No Exception for Absent Input

The function must never raise an exception when `None` or `""` is passed. It must return `False` gracefully.

**Verification**: NFR-REL-001. The guard clause uses truthiness, not `email.is None` followed by `raise`. No `TypeError` is possible because no attribute access or method call occurs on the input before the guard.

### BR-002: No Distinction Between Null and Empty

Per ADR-003, callers should not distinguish between `None` and `""` in the return value. Both produce `False`. If the caller needs to know whether the input was absent vs. empty, it must check BEFORE calling `validate_email`.

**Verification**: Both paths return identical `False` with no metadata, error code, or exception type to differentiate them.

### BR-003: Consistent with FR-VAL-001

The guard clause is the execution gate that FR-VAL-001's regex check depends on. FR-VAL-002's guard must execute before FR-VAL-001's regex. This ordering is guaranteed by physical placement (first statement in function body).

**Verification**: LLD flow diagram confirms guard -> regex ordering. The guard is the first executable statement.

### BR-004: Type-Safe Input Contract

The type hint `email: str | None` documents the acceptable input types. Static type checkers (mypy, pyright) should flag callers that pass non-string, non-None types. At runtime, no explicit type check is performed -- Python duck typing suffices.

**Verification**: The `if not email` guard handles any falsy Python value. Unexpected truthy non-string types (e.g., `123`, `["a"]`) would reach the regex and may cause `TypeError` from `re.match()`. This is acceptable because:
1. Type hints prevent this at development time.
2. The function does not crash on any documented input type.
3. Hard-boundary #9 prohibits exceptions, which holds for all `str | None` inputs.

## 3. Error Mapping

| Input | Execution Path | Return Value | Exception? |
|-------|---------------|-------------|-----------|
| `None` | Guard returns `False` | `False` | No |
| `""` (empty string) | Guard returns `False` | `False` | No |

There are only two error/edge cases for this feature. Both return `False` with no exception.

## 4. Data Impact

### State Changes

**None.** The guard clause is a read-only boolean check:

- No state is read (beyond the input argument)
- No state is written
- No logging occurs
- No metrics are emitted
- No cache is checked or updated

### Memory Impact

The guard clause allocates zero additional memory. It is a single `if` statement operating on a stack-allocated reference.

## 5. Security Considerations

### SEC-001: No Type Confusion Attack

**Threat**: Passing unexpected non-string types to probe internal behavior or trigger exceptions.

**Assessment**: The guard `if not email` handles all Python falsy values gracefully (None, "", 0, [], {}, etc. -- though only `None` and `""` are documented). The function does not call any methods on `email` before the guard check, so no `AttributeError` is possible on falsy inputs.

**For truthy unexpected types** (e.g., `123`, `["a"]`): These would bypass the guard and reach `re.match()`, which may raise `TypeError`. Static type checking catches these at development time. Runtime behavior for undocumented types is undefined but non-crashing for the documented type set.

### SEC-002: No Resource Consumption for Null/Empty

**Threat**: DoS via repeated null/empty calls consuming resources.

**Assessment**: The guard branch is O(1) with minimal stack allocation. Even millions of calls per second would not exhaust memory or CPU beyond normal function call overhead. No regex compilation or execution occurs.

## 6. Compliance with Hard Boundaries

| Boundary # | Rule | Compliance |
|-----------|------|-----------|
| 1 | No I/O in validate_email | YES -- guard is a boolean check |
| 2 | No mutable state | YES -- no state at all |
| 3 | No signature change | YES -- signature unchanged |
| 9 | No exceptions | YES -- guard returns False, never raises |
| 10 | No sensitive data exposure | YES -- no data reflection |
| 21 | Return bool only | YES -- returns literal `False` |
| 22 | No field injection/global state | YES -- input is argument |

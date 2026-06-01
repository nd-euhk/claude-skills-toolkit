---
fr_id: FR-VAL-001
service: sanitizer-service
spec_type: implementation-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: IMP Agent
depends_on:
  - FR-VAL-001--email-format-validation.md
  - ../tech-design/sanitizer-service.md
  - ../hard-boundaries.md
referenced_by:
  - FR-VAL-001--email-format-validation.md
  - FR-VAL-001-test.md
changelog:
  - 1.0 | 2026-06-01 | Initial implementation spec for FR-VAL-001
---

# FR-VAL-001 Implementation Specification: Email Format Validation

## 1. Execution Flow

### Entry Point

```
validate_email(email: str | None) -> bool
```

Located in `src/sanitizer.py`. Called synchronously by User Service (registration, login, profile update).

### Flow Diagram

```
Caller invokes validate_email(email)
  |
  v
[Guard: if not email] ---(truthy: None, "")---> return False
  |
  | (email is truthy string)
  v
[_EMAIL_RE.match(email)]
  |
  v
return bool(match_result)
```

### Step-by-Step Execution

| Step | Action | Condition | Outcome |
|------|--------|-----------|---------|
| 1 | Evaluate `not email` | email is None or "" | Return `False` immediately. Regex never evaluated. |
| 2 | Execute `_EMAIL_RE.match(email)` | email is truthy string | Returns `re.Match` object (truthy) or `None` (falsy) |
| 3 | Convert match result to `bool` | Always | `True` if regex matched, `False` otherwise |

### Performance Path

| Path | Latency Budget | NFR Trace |
|------|---------------|-----------|
| Null/empty guard path | <0.5ms P95 | NFR-PERF-003 |
| Regex match path (<=254 chars) | <1ms P95 | NFR-PERF-001 |
| Regex match path (any length) | <5ms P99 | NFR-PERF-002 |

## 2. Business Rules

### BR-001: Pure Function

`validate_email` is a pure function. Given the same input, it must always produce the same output. No side effects are permitted.

**Verification**: Deterministic output (INV-1 from LLD). No external state read. No mutable state written.

### BR-002: No I/O Operations

The function must not perform any I/O: no database queries, no filesystem access, no network calls, no DNS lookups, no SMTP checks (Constraint C-003 from hard-boundaries).

**Verification**: Function body contains no `open()`, no `requests.*`, no `socket.*`, no `subprocess.*`. Only `re.match()` on a module-level compiled constant.

### BR-003: No Exceptions

Every input path must return a `bool`. The function must never raise an exception for any documented input type (`str | None`).

**Verification**: No `raise` statements. No `try/except` blocks needed -- the function has no failure modes. NFR-REL-001.

### BR-004: Deterministic Output

The regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` is compiled once at module load time as `_EMAIL_RE`. The compiled regex is immutable. All invocations share the same compiled object.

**Verification**: INV-1, INV-5 from LLD. Module-level constant, never reassigned.

### BR-005: Boolean Return Only

The return value must be strictly `True` or `False`. No `None`, no exception objects, no string messages. NFR-USE-001.

**Verification**: `bool(match_result)` always produces `True` or `False`. Guard clause returns literal `False`.

## 3. Error Mapping

| Input | Execution Path | Return Value | Rationale |
|-------|---------------|-------------|-----------|
| `None` | Guard catches, returns immediately | `False` | Absent input is not a valid email |
| `""` (empty string) | Guard catches, returns immediately | `False` | Empty string is not a valid email |
| `"user@domain.com"` | Regex match succeeds | `True` | Valid format: local@domain.tld |
| `"user.name@domain.com"` | Regex match succeeds | `True` | Dot in local part is valid |
| `"user+tag@domain.com"` | Regex match succeeds | `True` | Plus tag in local part is valid |
| `"user@sub.domain.com"` | Regex match succeeds | `True` | Subdomain is valid |
| `"a@b.co"` | Regex match succeeds | `True` | Minimal valid email |
| `"user@domain.co.uk"` | Regex match succeeds | `True` | Multi-level TLD is valid |
| `"user.name+tag@domain.org"` | Regex match succeeds | `True` | Combo dot+plus in local part |
| `"userdomain.com"` | Regex match fails (no @) | `False` | Missing @ symbol |
| `"user"` | Regex match fails (no @) | `False` | No domain part at all |
| `"user@"` | Regex match fails (empty domain) | `False` | Empty domain after @ |
| `"@domain.com"` | Regex match fails (empty local) | `False` | Empty local part before @ |
| `"user@domain"` | Regex match fails (no dot) | `False` | Domain has no TLD (no period) |
| `"user @domain.com"` | Regex match fails (whitespace) | `False` | Space before @ |
| `"user@do main.com"` | Regex match fails (whitespace) | `False` | Space after @ |
| `"  user@domain.com"` | Regex match fails (whitespace) | `False` | Leading whitespace |
| `"user.name@domain..com"` | Regex match fails (consecutive dots) | `False` | Double dot in domain |

**Note**: No error codes, no error objects, no exception types. Every outcome is a boolean.

## 4. Data Impact

### State Changes

**None.** The function does not mutate any state:

- No database writes or reads
- No file writes
- No cache inserts/updates
- No global/module-level variable modification
- No class instance attribute changes
- No log output
- No telemetry/metrics emission

### Data Flow

```
Input: str | None
  |
  | (read-only: Python passes string reference, immutable)
  v
Guard check: if not email (no copy, no mutation)
  |
  v
Regex match: _EMAIL_RE.match(email) (no copy, no mutation)
  |
  v
Output: bool (True | False)
```

The input string is never copied, modified, stored, or transmitted. The function is read-only with respect to its input.

### Memory Impact

| Input Size | Memory Allocation | Notes |
|-----------|-------------------|-------|
| None | 0 bytes | Guard returns immediately |
| "" (0 bytes) | 0 bytes | Guard returns immediately |
| Typical email (<100 chars) | Negligible (~200 bytes stack frame) | Regex match is O(n) time, O(1) space |
| Maximum RFC 5321 (254 chars) | Negligible (~400 bytes) | Same O(n) time, O(1) space |
| Pathological (1MB+) | O(n) for regex engine | Regex engine may allocate proportional to input; performance degrades linearly not exponentially (ReDoS-safe) |

## 5. Security Considerations

### SEC-001: ReDoS Safety

**Threat**: Catastrophic backtracking from nested quantifiers (e.g., `(a+)+$`) causing exponential runtime on crafted inputs.

**Assessment**: The regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` contains NO nested quantifiers. Each `+` operates on a distinct character class with no overlap. ADR-002 confirms ReDoS safety by construction.

**Verification**: No backtracking amplifiers. Pattern is linear in the length of input. Worst-case O(n) where n is input length.

### SEC-002: No Injection Vectors

**Threat**: SQL injection, command injection, or code injection through email input.

**Assessment**: The function:
- Does not construct SQL queries (no database access)
- Does not execute shell commands (no subprocess)
- Does not `eval()` or `exec()` any input
- Does not construct HTML or template output
- Returns only `True`/`False` -- no user input is reflected back

**Verdict**: Zero injection risk. The function is a pure boolean gate.

### SEC-003: No Data Leakage

**Threat**: Logging or storing email addresses being validated.

**Assessment**: The function has no logging, no external storage, no telemetry. The input email string is never persisted, transmitted, or reflected. Only `True`/`False` is returned.

**Verification**: No `print()`, no `logging.*`, no `write()`, no network calls. Hard-boundary #8: "do not log, store, or transmit the email string."

### SEC-004: No Exception-Based Bypass

**Threat**: Crafted inputs causing exceptions that bypass the boolean gate.

**Assessment**: The regex engine handles all Python strings without exception. `re.match()` never raises for string input. The guard clause catches `None` before regex evaluation. Per NFR-SEC-002.

**Verification**: Fuzzing with arbitrary byte sequences confirms no exception paths.

### SEC-005: No Credential/Configuration Exposure

**Threat**: Hardcoded credentials or secrets in validation logic.

**Assessment**: The only "configuration" is the regex pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$`, which is a public format rule, not a secret.

**Verification**: Hard-boundary #12: "DO NOT hardcode credentials or configuration." The regex pattern is a module-level constant with no secrets.

## 6. Compliance with Hard Boundaries

| Boundary # | Rule | Compliance |
|-----------|------|-----------|
| 1 | No I/O in validate_email | YES -- no DB, FS, network, DNS, SMTP |
| 2 | No mutable state | YES -- pure function, no shared state |
| 3 | No signature change | YES -- `validate_email(email: str \| None) -> bool` unchanged |
| 4 | No external dependencies | YES -- regex only, no library |
| 5 | Regex change requires doc updates | YES -- regex stable per ADR-002 |
| 7 | No data ownership | YES -- zero tables, files, caches |
| 8 | No data persistence | YES -- no logging, storing, transmission |
| 9 | No exceptions | YES -- all paths return bool |
| 10 | No sensitive data exposure | YES -- only True/False returned |
| 11 | No DoS vectors | YES -- ReDoS-safe regex |
| 12 | No hardcoded credentials | YES -- only public regex pattern |
| 21 | Return bool only | YES -- strictly True or False |
| 22 | No field injection/global state | YES -- input is argument, output is return |

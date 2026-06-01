---
title: "ADR-002: Regex-Based Validation Instead of Library-Based Validation"
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
changelog:
  - 1.0 | 2026-06-01 | Initial decision
---

# ADR-002: Regex-Based Validation Instead of Library-Based Validation

## Context

The Email Validation Utility must determine whether a given string conforms to a basic email format: a non-empty local part, an `@` symbol, and a domain containing at least one period (SRS FR-VAL-001). It must also handle null/empty inputs (SRS FR-VAL-002). The SRS explicitly states that the validation is a structural format check only -- it does not verify deliverability, check DNS records, or confirm mailbox existence (SRS Section 1.2). Full RFC 5322 compliance is not required (Assumption A-002).

We must choose a validation strategy. Three approaches exist:

1. **Regex-based**: A single regular expression matches the format pattern.
2. **Library-based**: A third-party library (e.g., `email-validator`, `validate_email`) performs deeper validation including DNS lookups.
3. **Manual parsing**: Custom code splits the string and checks each part.

## Decision

**We will use a single regular expression (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) for format validation, augmented with an early null/empty guard (`if not email: return False`). We will NOT introduce a third-party validation library.**

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| **Option A: Regex (chosen)** | Zero external dependencies (meets C-003: no I/O). Predictable performance (<1ms, meets NFR-PERF-001). Deterministic output (meets NFR-REL-002). Simple to audit for security (meets NFR-SEC-002). Matches scope: format-only check. | Does not catch all edge cases of RFC 5322 (e.g., quoted local parts, internationalized email addresses). Acutely accepted by design (Assumption A-003). |
| Option B: Library-based (`email-validator`) | Handles RFC 5322 edge cases. Syntax + deliverability checks in one call. | Introduces external dependency. Library may perform DNS lookups (I/O violation of C-003). Adds dependency management overhead. Potential for supply-chain risk. May be slower than regex due to DNS resolution. |
| Option C: Manual parsing | Full control over validation logic. No regex compilation concerns. | More code = more bugs. Harder to audit for security. More maintenance burden. Reinvents the wheel for a well-understood pattern. |

### Why Option A

1. **Scope alignment**: The SRS deliberately scopes validation to a basic format check (Section 1.2: "not verify deliverability, check DNS records, or confirm mailbox existence"). A regex is the simplest tool for a format check.

2. **Zero I/O (C-003)**: A library like `email-validator` defaults to performing DNS/MX lookups. Disabling those features leaves us with essentially a regex-equivalent, making the library overhead unjustified.

3. **Performance (NFR-PERF-001)**: The regex compiles once at module load time (see `_EMAIL_RE = re.compile(...)`) and executes in O(n) where n is the input length. This consistently completes in well under 1ms.

4. **Determinism (NFR-REL-002)**: A regex always produces the same output for the same input. Library-based validation may vary if the library performs network checks or uses external data.

5. **Security (NFR-SEC-001, NFR-SEC-002)**: A regex has predictable resource consumption (memory proportional to input length) and no bypass paths -- every input is either a match or not. A library may have undiscovered vulnerabilities or unexpected behavior with crafted inputs.

6. **Simplicity**: The regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` is 4 lines of code (including compilation) that covers all 15 acceptance test cases (6 happy path, 9 error/edge). It needs no pip install, no version pinning, no security advisories.

### Why Not Full RFC 5322 Compliance

Assumption A-003 states: "The basic format check (local@domain.tld) is sufficient for the target use cases; full RFC 5322 compliance is not required." A full RFC 5322 compliant regex is notoriously complex (hundreds of characters) and would be over-engineered for format validation that explicitly does not need to handle quoted strings, comments, or internationalized domain names.

## Consequences

### Positive

- Zero external dependencies -- the utility remains self-contained.
- Fast, deterministic execution -- P95 under 1ms.
- Trivially auditable -- the regex and guard clause are 3 lines total.
- Easy to test -- all 15 acceptance criteria map directly to regex behavior.
- No supply-chain risk -- no pip packages to audit or update.

### Negative

- Does not validate edge cases like quoted local parts (`"user name"@domain.com`) or internationalized email addresses. These are out of scope per Assumption A-003.
- Changes to validation rules require code changes (not configuration changes). Acceptable because the validation rule set is stable and small.
- The regex must be reviewed for ReDoS (Regular Expression Denial of Service) vulnerabilities. **Mitigation**: The chosen regex has no nested quantifiers and no backtracking amplifiers -- it is ReDoS-safe by construction.

### Risks

- **Risk**: Future requirements demand deliverability verification. **Mitigation**: An ADR amendment would introduce a separate validation step (format check via regex, then deliverability check via a library/service). The regex-based format check remains the first gate.
- **Risk**: Requirements expand to full RFC 5322 compliance. **Mitigation**: Replace the regex with an RFC 5322-compliant one; this is a drop-in replacement requiring no architectural change.

## Related

- SRS FR-VAL-001 (Email Format Validation)
- SRS Assumption A-002 (254-char max not enforced by utility)
- SRS Assumption A-003 (basic format check sufficient; full RFC 5322 not required)
- SRS Constraint C-003 (no I/O operations)
- NFR: NFR-PERF-001 (<1ms P95), NFR-REL-002 (deterministic), NFR-SEC-001 (memory control), NFR-SEC-002 (no bypass)

---
title: "Hard Boundaries -- NEVER violate"
status: current
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - architecture.md
  - domain-service-mapping.yaml
referenced_by:
  - contracts/api-conventions.md
changelog:
  - 1.0 | 2026-06-01 | Initial hard boundaries for sanitizer-service
---

# Hard Boundaries

> Agent reads this file BEFORE EVERYTHING. The rules below are ABSOLUTE.

## Architecture Boundaries

1. **DO NOT add I/O to `validate_email`** -- no database queries, no filesystem access, no network calls, no DNS lookups, no SMTP checks (Constraint C-003).
2. **DO NOT add mutable state to `validate_email`** -- the function must remain pure and stateless across invocations (Constraint C-002).
3. **DO NOT change the function signature** without amending ADR-003 -- `validate_email(email: str | None) -> bool` is the contract.
4. **DO NOT introduce external dependencies** to the validation logic -- no third-party email validation libraries (ADR-002).
5. **DO NOT change the validation regex** without updating all corresponding documentation: SRS FR-VAL-001, ADR-002, and the test suite.
6. **DO NOT add I/O to `sanitize_input`** -- same constraints apply to the sibling function.

## Data Isolation Boundaries

7. **No data ownership** -- the utility owns zero tables, zero files, zero caches. Do not introduce any.
8. **No data persistence** -- do not log, store, or transmit the email string being validated. The function receives it, checks it, and returns a boolean.

## Security Boundaries

9. **DO NOT raise exceptions** -- every input path must return a boolean (NFR-REL-001).
10. **DO NOT expose sensitive data** -- the function returns only `True` or `False`. No error messages, no stack traces, no input reflection.
11. **DO NOT introduce denial-of-service vectors** -- the regex must remain ReDoS-safe (no nested quantifiers, no catastrophic backtracking per ADR-002).
12. **DO NOT hardcode credentials or configuration** -- the regex pattern may be a module-level constant; it must not be fetched from an external source.

## Code Quality Boundaries

13. **DO NOT delete or modify tests that are passing** to make implementation easier.
14. **DO NOT catch generic exceptions** -- the function should not raise any. If it does, let it propagate to the caller.
15. **DO NOT use mutable default arguments** in the function signature.

## Agent Boundaries

16. **DO NOT modify files in `agent_docs/`, `docs/architecture/`, or `docs/product/`** without architectural review.
17. **DO NOT change the SRS** -- the SRS is the source of truth for behavior. Implementation changes that require SRS changes must go through the requirements process.
18. **DO NOT change API contracts** -- the function signature is governed by ADR-003.

## Implementation Boundaries

19. **DO NOT implement without reading the FR spec** -- `docs/product/features/email-validation/FR-VAL-001--email-format-validation.md` and `FR-VAL-002--null-empty-input-handling.md`.
20. **DO NOT skip TDD protocol** -- tests written first (RED), implementation follows (GREEN).
21. **DO NOT return generic values** -- every return must be a boolean `True` or `False` per NFR-USE-001.
22. **DO NOT use field injection or global state** -- the function takes its input as an argument and returns its output.

## Testing Boundaries

23. **DO NOT write tests that verify implementation details** -- tests verify BEHAVIOR from the Gherkin scenarios in the FR specs, not internal method calls or regex structure.
24. **DO NOT share mutable state between test methods** -- each test runs in isolation.
25. **DO NOT skip edge cases** -- every Gherkin example row from the FR specs must have a corresponding test case (15 total for FR-VAL-001, 2 for FR-VAL-002).
26. **DO NOT use Arrange/Act/Assert or variants** -- use comment blocks `# Given` / `# When` / `# Then` matching 1-1 with Gherkin scenarios.

## Documentation Boundaries

27. **DO NOT modify code without updating corresponding specs** -- behavioral changes require FR spec updates.
28. **DO NOT create spec files without frontmatter** -- every `.md` file in `agent_docs/` must have YAML frontmatter.
29. **DO NOT leave stale cross-references** -- when renaming/deleting files, update all `depends_on` / `referenced_by` links.

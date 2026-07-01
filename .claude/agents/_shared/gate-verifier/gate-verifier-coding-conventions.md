# Coding Conventions Gate Check Criteria

Load this file when verifying the **coding-conventions** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/01-global-standards/coding-conventions.md`

## 1. Required Sections

Read the artifact. All sections must be present with substantive content:
1. Naming Conventions — packages, classes, methods, variables, config keys, env vars
2. Project Structure — monorepo layout, module conventions, resource organization
3. Error Handling — try/catch patterns, error propagation, error wrapping, logging levels
4. API Conventions — REST path patterns, request/response formats, pagination, versioning
5. Database Conventions — table naming, migration strategy, query patterns, transaction boundaries
6. Testing Conventions — test file naming, test structure, mock/stub conventions, coverage expectations
7. Configuration Management — env vars vs config files, feature flags, secrets handling
8. Dependency Management — version pinning, transitive dependency rules, allowed libraries

No section should be empty or contain only "TBD".

## 2. Specificity

Read the artifact. Conventions must be specific, not generic:
- PASS: "Services use `com.example.{service}.{layer}` package structure"
- FAIL: "Follows standard conventions"
- Must include examples from the actual codebase

## 3. Cross-Service Consistency Audit

Read the artifact. Check the consistency audit:
- Must flag inconsistencies between services (e.g., "auth-service uses snake_case but payment-service uses camelCase")
- Each flagged inconsistency must name the services involved

## 4. Source Evidence

Read the artifact. Conventions must be traceable to actual code:
- Every convention must reference at least one service or source file as evidence
- Flag conventions that appear invented rather than observed

## 5. No Conflicts

Cross-reference conventions against each other:
- No contradictory rules (e.g., "use camelCase" in one section, "use snake_case" in another)
- Error handling conventions must be consistent with global error codes format

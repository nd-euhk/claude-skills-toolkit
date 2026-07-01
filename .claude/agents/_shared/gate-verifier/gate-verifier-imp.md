# IMP Gate Check Criteria

Load this file when verifying the **imp** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact path:** `knowledge/04-microservices/{svc}/FR-{EPIC}-{NNN}--{slug}-impl.md`
In forward-engineering mode: `agent_docs/backend/*/implementation/FR-*-impl.md` or `agent_docs/frontend/*/implementation/FR-*-impl.md`

## 1. Implementation Spec Coverage

Glob `knowledge/04-microservices/{svc}/FR-*-impl.md`. Cross-reference with FR files (`FR-*.md`, excluding -impl and -test):
- Every FR must have an implementation spec (backend, frontend, or both)
- Flag any FR without an impl spec

## 2. Section Completeness

For each impl spec, verify all required sections are present and filled:
1. Purpose
2. References (FR links, tech-design sections)
3. Affected Areas (files, modules, layers)
4. Execution Flow (numbered steps, specific layers/modules)
5. Business Rules Realized (WHEN/THEN format)
6. Data & State Impact (tables, state transitions)
7. Error Mapping (exception → HTTP status → error code → user message)
8. Security & Authorization (auth checks, token scopes)
9. Implementation Notes (constraints, dependencies)
10. Acceptance Checklist

No section should contain "TBD" or be empty.

## 3. Execution Flow Specificity

Read the Execution Flow section of each impl spec:
- Must name specific layers/modules/classes (not vague like "handle the request")
- grep for vague patterns: "handle the", "process the", "do the" — flag as FAIL

## 4. Error Mapping Coverage

Read the Error Mapping section of each impl spec:
- Must cover at minimum: validation error, not-found, unauthorized, internal error
- Each entry must have: exception/condition, HTTP status, error code, user message, log level

## 5. Business Rules Format

Read the Business Rules Realized section of each impl spec:
- Each rule must use WHEN/THEN format
- Each rule must trace to a Gherkin scenario from the corresponding FR

## 6. No Code Snippets

Grep impl specs for code blocks (triple backticks with language tags):
- Impl specs describe what to build, not how — code snippets belong in exe-be/exe-fe
- Flag any code blocks found

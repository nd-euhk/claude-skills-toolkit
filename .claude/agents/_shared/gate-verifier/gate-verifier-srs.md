# SRS Gate Check Criteria

Load this file when verifying the **srs** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

## 1. FR Granularity (MANDATORY — run first)

Glob `docs/product/features/epic-*/FR-*.md`. For each FR file found, read the title and description. Flag any FR that is too coarse.

**Coarse FR detection signals:**
- Single FR covering multiple independent user actions (e.g., "Authentication" covers login + register + password reset)
- FR title uses umbrella terms: "Management", "Administration", "System", "Platform", "Dashboard" without specific scope
- FR description contains bullet lists of 4+ unrelated features
- FR that could reasonably be split into 2+ independently testable FRs

**Granular FR (good):** "User Login", "User Registration", "Password Reset", "Email Verification"
**Coarse FR (bad):** "Authentication", "User Management", "Content Administration", "System Dashboard"

If a coarse FR is found, report it as FAIL with a suggested decomposition.

## 2. Gherkin Scenario Outlines

Glob `docs/product/features/epic-*/FR-*.md`. For each FR:
- Must contain at least one `Scenario Outline:` block with an `Examples:` table
- Examples table must have concrete values (not placeholders like "TODO", "value1")
- Must cover: happy path, at least one error case, at least one boundary case

## 3. NFR Quantification

Read `docs/product/SRS.md`. In the Non-Functional Requirements section:
- Every NFR must have a measurable threshold (number + unit)
- grep for vague adjectives: "fast", "scalable", "secure", "reliable", "high-performance", "responsive", "robust" — if any appear without a number, FAIL
- Required NFR categories present: performance, availability, security, reliability

## 4. Traceability Matrix

Read `agent_docs/traceability/requirements-matrix.md`:
- Every FR from `docs/product/features/epic-*/FR-*.md` must appear in the matrix
- Every FR must trace to at least one BRD objective
- Every FR must reference at least one Gherkin scenario

## 5. No Architecture/Implementation Leaks

Read `docs/product/SRS.md` and grep for forbidden terms:
- Architecture leaks: "service", "API path", "database schema", "microservice", "REST endpoint", "message queue", "Kafka", "PostgreSQL", "MongoDB"
- Implementation leaks: language/framework names (Java, Python, React, Spring, Django, etc.) — unless explicitly listed as business constraints in URD

## 6. Input Completeness

Check that SRS.md references PRD and URD as inputs. Check that the introduction section defines system purpose, scope, and definitions.

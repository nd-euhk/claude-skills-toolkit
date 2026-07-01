# SRS Gate Check Criteria

Load this file when verifying the **srs** phase (including FR-Discovery). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact path:** `knowledge/04-microservices/{svc}/FR-{EPIC}-{NNN}--{slug}.md` (per-service)
In forward-engineering mode: `docs/product/features/*/FR-*.md`

## 1. FR Granularity (MANDATORY — run first)

Glob `knowledge/04-microservices/{svc}/FR-*.md` (reverse-engineering) or `docs/product/features/*/FR-*.md` (forward-engineering). For each FR file found, read the title and description. Flag any FR that is too coarse.

**Coarse FR detection signals:**
- Single FR covering multiple independent user actions (e.g., "Authentication" covers login + register + password reset)
- FR title uses umbrella terms: "Management", "Administration", "System", "Platform", "Dashboard" without specific scope
- FR description contains bullet lists of 4+ unrelated features
- FR that could reasonably be split into 2+ independently testable FRs

**Granular FR (good):** "User Login", "User Registration", "Password Reset", "Email Verification"
**Coarse FR (bad):** "Authentication", "User Management", "Content Administration", "System Dashboard"

If a coarse FR is found, report it as FAIL with a suggested decomposition.

## 2. FR Structure Completeness

For each FR file, verify all required sections are present and filled:
1. Description (2-3 sentences, business perspective)
2. Preconditions (what must be true before execution)
3. Input table (fields, types, validation rules)
4. Process steps (numbered list)
5. Output schema (success + error response structures)
6. Error codes (specific error codes this feature can produce)

No section should contain "TBD" or be empty.

## 3. Gherkin Scenario Outlines

For each FR file:
- Must contain at least one `Scenario Outline:` block with an `Examples:` table
- Examples table must have concrete values (not placeholders like "TODO", "value1", "xxx")
- Must cover: happy path, at least one error case, at least one boundary case

## 4. Source Code Traceability

For each FR file (reverse-engineering mode):
- Must include a "Source code trace" section listing source files that implement this feature
- Every FR must trace to at least one specific source file path
- Flag FRs with no source code references

## 5. NFR Quantification (forward-engineering only)

Read `docs/product/SRS.md` (if exists). In the Non-Functional Requirements section:
- Every NFR must have a measurable threshold (number + unit)
- grep for vague adjectives: "fast", "scalable", "secure", "reliable", "high-performance", "responsive", "robust" — if any appear without a number, FAIL
- Required NFR categories present: performance, availability, security, reliability

**Reverse-engineering mode:** Skip this criterion (SKIP with note: "NFR quantification requires forward-engineering SRS.md").

## 6. No Architecture/Implementation Leaks

Read FR files and grep for forbidden terms:
- Architecture leaks: "service", "API path", "database schema", "microservice", "REST endpoint", "message queue", "Kafka", "PostgreSQL", "MongoDB"
- Implementation leaks: language/framework names (Java, Python, React, Spring, Django, etc.) — unless explicitly listed as business constraints

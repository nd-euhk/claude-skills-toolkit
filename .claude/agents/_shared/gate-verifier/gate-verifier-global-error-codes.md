# Global Error Codes Gate Check Criteria

Load this file when verifying the **global-error-codes** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/02-central-contracts/global-error-codes.md`

## 1. Required Sections

Read the artifact. All sections must be present with substantive content:
1. Error Code Format — how error codes are structured (e.g., CATEGORY-NNNN)
2. Error Categories — list of categories with descriptions and HTTP status ranges
3. Global Error Codes Table — complete table: Code | Description | HTTP Status | Source Service | FR Reference
4. Category Details — per category: common causes, resolution guidance, affected services
5. Cross-Service Errors — errors across service boundaries, circuit breaker triggers
6. Error Code Allocation Rules — how to create new error codes without conflicts

No section should be empty or contain only "TBD".

## 2. Completeness

Read the artifact. Verify completeness:
- Every error code collected from service notes and FR files must appear in the table
- Cross-reference with `knowledge/04-microservices/*/FR-*.md` — no missing error codes

## 3. Deduplication

Read the artifact. Error codes must be deduplicated:
- Each error code appears exactly once
- If the same error code appeared in multiple services, it must be merged into a single entry
- Prefer the most detailed description when merging duplicates

## 4. Consistency

Read the artifact. Error codes must be internally consistent:
- Same error code format across all entries
- HTTP status codes match the error category (e.g., validation errors → 4xx, internal errors → 5xx)
- Flag inconsistencies: same error code with different semantics across services

## 5. Cross-Reference Accuracy

Spot-check 5 error codes from the table:
- Each must trace to at least one FR file or service note
- HTTP status must match what the FR or tech-design specifies
- Flag any error code with no verifiable source

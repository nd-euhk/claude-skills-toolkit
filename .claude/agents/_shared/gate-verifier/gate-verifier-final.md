# Final Gate Check Criteria

Load this file when verifying the **final** phase (system-wide merge cross-artifact consistency). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

This is the FINAL gate before the system-wide merge is complete. Be thorough. Every FAIL must cite specific file paths and line numbers.

## 1. Event Cross-Referencing

Read `knowledge/02-central-contracts/events/evt-*.yaml` and cross-reference:
- Every event must be referenced by at least one service's tech-design (`knowledge/04-microservices/*/tech-design.md`) or FR file
- Flag orphaned events with no consumer or producer reference

## 2. API Endpoint Consistency

Read `knowledge/02-central-contracts/apis/*-api.yaml` and cross-reference:
- Every API endpoint must match the endpoints described in tech-design (`knowledge/04-microservices/{svc}/tech-design.md`)
- Flag endpoints in API specs not documented in tech-design
- Flag endpoints in tech-design missing from API specs

## 3. Error Code Traceability

Read `knowledge/02-central-contracts/global-error-codes.md` and cross-reference:
- Every error code must be referenced by at least one FR file (`knowledge/04-microservices/*/FR-*.md`)
- Flag orphaned error codes

## 4. Service Dependency Consistency

Read `knowledge/03-system-architecture/C4-context-diagram.md` and cross-reference:
- Service dependencies in C4 must match dependencies in each service's tech-design (`knowledge/04-microservices/*/tech-design.md`)
- Flag C4 dependencies not found in any tech-design
- Flag tech-design dependencies missing from C4

## 5. Hard Boundaries ↔ C4 Consistency

Read `knowledge/01-global-standards/hard-boundaries.md` and cross-reference with C4:
- Hard boundary definitions must be consistent with C4 bounded contexts
- Data ownership in hard boundaries must match C4 service responsibilities
- Flag contradictions

## 6. Cross-cutting ↔ Tech Design Consistency

Read `knowledge/01-global-standards/cross-cutting-patterns.md` and spot-check 3 patterns against tech-design files:
- Pattern descriptions must match actual implementations in tech-design
- Flag patterns that don't match what tech-design describes

## 7. ADR Completeness

Read `knowledge/03-system-architecture/ADRs/ADR-*.md`:
- Every ADR must reference the correct services and patterns
- ADR service references must match actual service names in `knowledge/04-microservices/`
- Flag ADRs referencing non-existent services

## 8. Orphaned Artifacts

Scan the entire knowledge/ directory:
- Every file must have at least one cross-reference from another file
- Flag completely orphaned artifacts (files with no inbound references)
- Check specifically: FR files with no IMP/TST, tech-design entries with no FR, events with no tech-design reference

# LLD Gate Check Criteria

Load this file when verifying the **lld** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact path:** `knowledge/04-microservices/{svc}/tech-design.md`

## 1. Per-Service Tech Design

Find and read the tech-design file for the service being verified. Verify it has all sections with substantive content (no empty sections, no "TBD"):

1. Service Overview — purpose, domain, bounded context
2. Internal Architecture — layers, modules, component organization
3. Domain Model — entities, value objects, aggregates, relationships
4. REST Clients / Integration Points — external service calls
5. Transaction Boundaries — database transaction scopes
6. Circuit Breakers — failure thresholds, fallback behavior
7. Caching Strategy — what is cached, TTL, invalidation
8. Performance & Scale — expected throughput, scaling strategy
9. Error Flows & Degraded Mode — failure scenarios, fallbacks

## 2. Work Package Completeness

Cross-reference FR files (`knowledge/04-microservices/{svc}/FR-*.md`) with tech-design:
- Every FR must have a corresponding work package or feature reference in tech-design
- Each work package must include: routing (API endpoint or UI path), implementation path, test path

## 3. Circuit Breaker Coverage

Read the tech-design file. Every REST client / external integration must define:
- failureThreshold
- waitDurationInOpenState
- fallback behavior
- No unbounded retries (max attempts must be specified)

## 4. Error Flows

Read the tech-design file. Every cross-service integration must have:
- Failure scenario described
- User-visible impact
- Degraded mode / fallback defined

## 5. Domain Model Quality

Read the tech-design file. Domain models must include:
- Invariants (rules that must always hold)
- State machines for entities with lifecycles (Mermaid diagram or described)

## 6. No New Architectural Decisions

Grep tech-design files for architecture decisions that belong in HLD:
- No new service creation (belongs in C4/ADRs)
- No changes to communication patterns established in ADRs
- No changes to data ownership from hard-boundaries.md
- No changes to cross-cutting patterns

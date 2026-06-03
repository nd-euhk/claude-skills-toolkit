# LLD Gate Check Criteria

Load this file when verifying the **lld** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

## 1. Per-Service Tech Design

Read `agent_docs/domain-service-mapping.yaml` to get the service list. For each service, check that `agent_docs/tech-design/{name}-service.md` exists and has all 9 sections:
1. Service Boundary
2. Internal Architecture
3. Domain Model
4. REST Clients
5. Transaction Boundaries
6. Integration Points
7. Caching Strategy
8. Performance & Scale
9. Error Flows & Degraded Mode

Each section must have substantive content (no empty sections, no "TBD").

## 2. Work Package Completeness

Glob `agent_docs/features/FR-*.md`. Every FR must have a work package with:
- Routing overlay: service, API endpoint (or UI path), implementation path, test path
- Acceptance criteria
- Dependencies listed

## 3. Circuit Breaker Coverage

Read each tech-design file. Every REST client defined must have:
- failureThreshold
- waitDurationInOpenState
- fallback behavior

No unbounded retries (max attempts must be specified).

## 4. Error Flows

Read each tech-design file. Every cross-service integration must have:
- Failure scenario described
- User-visible impact
- Degraded mode / fallback defined

## 5. Domain Model Quality

Read each tech-design file. Domain models must include:
- Invariants (rules that must always hold)
- State machines for entities with lifecycles (Mermaid diagram or described)

## 6. No New Architectural Decisions

Grep tech-design files for architecture decisions that belong in HLD:
- No new service creation
- No changes to communication patterns established in ADRs
- No changes to data ownership from hard-boundaries.md

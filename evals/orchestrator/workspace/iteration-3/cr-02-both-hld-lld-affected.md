# CR-02: Change Request - HLD + LLD Both Affected

**Date**: 2025-06-01
**Test Case**: Convert email validator from in-process utility to standalone microservice
**Task Under Test**: T-001 "Email validation utility" (In Review)
**Pipeline**: HLD-affected + LLD-affected routing

---

## Change Request Summary

**Request**: Convert email validator from in-process utility to a standalone microservice with HTTP REST API endpoint.

**Impact Assessment**: Both HLD and LLD are affected due to paradigm shift from library function to network service.

---

## Step 1: Impact Assessment

### HLD Impact

| Component | Change | Impact Level |
|---|---|---|
| C4 Context/Container | Utility module -> Standalone container | HIGH |
| Service Boundary | In-process -> Own process, port 8080 | HIGH |
| Integration Points | Function calls -> HTTP REST | HIGH |
| ADR-001 | Superseded (stdlib-only relaxed) | MEDIUM |
| ADR-002 | Superseded (in-process replaced) | HIGH |
| ADR-003 | Modified (tuple wrap in JSON) | MEDIUM |
| ADR-004 | New (microservice justification) | HIGH |
| Event Taxonomy | New (future async events) | LOW |

**HLD Verdict**: AFFECTED - 8 components require changes including new ADR.

### LLD Impact

| Section | Change | Impact Level |
|---|---|---|
| 1. Service Boundary | Module -> HTTP microservice | HIGH |
| 2. Internal Architecture | Function -> FastAPI app with routes | HIGH |
| 3. Domain Model | tuple -> Pydantic DTOs | HIGH |
| 4. REST Clients | N/A -> httpx + retry + circuit breaker | HIGH |
| 5. Transaction Boundaries | Atomic call -> HTTP lifecycle | HIGH |
| 6. Integration Points | Function sig -> HTTP endpoint spec | HIGH |
| 7. Caching | None -> LRU consideration added | LOW |
| 8. Performance | <5ms -> p50<10ms, p99<50ms | MEDIUM |
| 9. Error Flows | Return tuple -> HTTP 400/500 | HIGH |

**LLD Verdict**: AFFECTED - All 9 sections require updates. Full rewrite needed.

### Pipeline Routing Decision

```
Change Request received
  |
  v
Impact Assessment
  |
  ├── HLD: AFFECTED -> route to HLD agent
  |     |
  |     v
  |   HLD Update
  |     |
  |     v
  |   HLD Gate (PASS/FAIL)
  |     |
  |     v (if PASS)
  |   LLD: AFFECTED -> route to LLD agent
  |     |
  |     v
  |   LLD Update
  |     |
  |     v
  |   LLD Gate (PASS/FAIL)
  |     |
  |     v (if PASS)
  v   IMP + TST (deferred for CR-02)
```

**Routing**: HLD agent -> HLD gate -> LLD agent -> LLD gate. Correct sequential pipeline.

---

## Step 2: HLD Update

**Agent**: HLD Agent
**Input**: Existing HLD (system-architecture.md, SRS)
**Output**: Updated HLD + New ADR-004

### Changes Applied

1. **C4 Context/Container**: Updated to show Sanitizer Service as standalone microservice with HTTP communication
2. **Service Boundary**: Defined port 8080, HTTP/1.1 REST protocol, POST /api/v1/validate endpoint, health endpoints
3. **Integration Points**: HTTP POST spec with timeout (2s/5s), retry (3x exponential backoff), circuit breaker
4. **API Conventions**: JSON format, RFC 7807 errors, versioned under /api/v1/
5. **Event Taxonomy**: Added deferred event types for future async communication
6. **ADR-001**: Marked as superseded by ADR-004
7. **ADR-002**: Marked as superseded by ADR-004
8. **ADR-003**: Marked as modified by ADR-004
9. **ADR-004**: New - full justification with 5 reasons, trade-off table, 4 alternatives considered

### Files Modified

- `projects/sanitizer-service/docs/architecture/system-architecture.md` (updated)
- `projects/sanitizer-service/docs/architecture/ADRs/ADR-004-microservice-conversion.md` (new)

---

## Step 3: HLD Gate

**Agent**: Gate Verifier
**Input**: Updated HLD artifacts
**Output**: Gate verification report

| # | Criterion | Result |
|---|---|---|
| 1 | C4 Container diagram updated showing sanitizer-service as container | PASS |
| 2 | New ADR-004 exists with clear rationale | PASS |
| 3 | Service boundary defined (port, protocol, endpoint) | PASS |
| 4 | Integration points updated (HTTP instead of in-process) | PASS |
| 5 | SRS requirements still traceable | PASS |
| 6 | No implementation details leaked into HLD | PASS |

**Gate Verdict**: ALL PASS (6/6)

**Pipeline Decision**: Proceed to LLD update.

---

## Step 4: LLD Update

**Agent**: LLD Agent
**Input**: Updated HLD + existing LLD
**Output**: Fully rewritten LLD

### Changes Applied (all 9 sections)

1. **Service Boundary**: HTTP microservice, port 8080, FastAPI + uvicorn, independent process
2. **Internal Architecture**: Directory tree (app/routes/core/models/middleware), FastAPI route handler code, core validator extraction
3. **Domain Model**: ValidateRequest/ValidateResponse Pydantic DTOs, stateless design
4. **REST Clients**: httpx AsyncClient with timeout, tenacity retry, circuitbreaker pattern
5. **Transaction Boundaries**: HTTP request lifecycle (uvicorn -> FastAPI -> validator -> response)
6. **Integration Points**: Full endpoint spec table, request/response examples for all status codes
7. **Caching**: Current (not needed) + future (LRU cache at >1000 TPS)
8. **Performance**: p50<10ms, p99<50ms, >1000 req/s, <50MB memory, network latency budget
9. **Error Flows**: Full error table (200/400/422/500), global exception handler, client-side error handling

### Files Modified

- `projects/sanitizer-service/agent_docs/tech-design/sanitizer-service.md` (rewritten)

---

## Step 5: LLD Gate

**Agent**: Gate Verifier
**Input**: Updated LLD + HLD for alignment check
**Output**: Gate verification report

| # | Criterion | Result |
|---|---|---|
| 1 | Service Boundary: HTTP service on port 8080 | PASS |
| 2 | Internal Architecture: FastAPI route handler wrapping validate_email | PASS |
| 3 | Domain Model: HTTP request/response models added | PASS |
| 4 | REST Clients: timeout, retry, circuit breaker | PASS |
| 5 | Transaction Boundaries: HTTP request lifecycle | PASS |
| 6 | Integration Points: HTTP endpoint spec | PASS |
| 7 | Caching: consideration added | PASS |
| 8 | Performance: network latency targets added | PASS |
| 9 | Error Flows: HTTP error responses (400, 500) | PASS |
| -- | **HLD-LLD Alignment: All 8 HLD specs verified in LLD** | PASS |

**Gate Verdict**: ALL PASS (9/9 + HLD alignment)

**Pipeline Decision**: Ready for IMP + TST (deferred per test scope).

---

## Test Result Summary

| Metric | Value |
|---|---|
| Test Case | CR-02 |
| Change Request Type | Architecture paradigm shift (utility -> microservice) |
| HLD Affected | YES |
| LLD Affected | YES |
| Pipeline Routing | HLD -> HLD Gate -> LLD -> LLD Gate |
| Pipeline Correct? | YES (sequential, correct order) |
| HLD Gate Pass Rate | 6/6 |
| LLD Gate Pass Rate | 9/9 + HLD alignment |
| Overall Result | **PASS** |

### Key Findings

1. **Pipeline routing correct**: When both HLD and LLD are affected, the workflow correctly routes to HLD agent first, gates it, then proceeds to LLD agent, gates again.
2. **Gate dependency enforced**: LLD update only proceeds after HLD gate passes, ensuring architectural decisions are locked before low-level design.
3. **HLD-LLD alignment verified**: Gate verifier confirmed all 8 HLD specifications are traceable in LLD implementation.
4. **Section coverage complete**: All 9 LLD sections received microservice-specific updates. No section was missed in the conversion.
5. **ADR lifecycle managed**: ADR-001 and ADR-002 properly marked as superseded, ADR-003 modified, ADR-004 introduced with full decision record.
6. **Trade-offs documented**: ADR-004 includes explicit trade-off table (latency, complexity, availability, deployment, observability, dependencies).

### Artifacts Created/Modified

| Artifact | Status | Path |
|---|---|---|
| SRS | Unchanged | projects/sanitizer-service/docs/product/SRS.md |
| HLD (system-architecture.md) | Updated | projects/sanitizer-service/docs/architecture/system-architecture.md |
| ADR-004 | New | projects/sanitizer-service/docs/architecture/ADRs/ADR-004-microservice-conversion.md |
| LLD (sanitizer-service.md) | Updated (rewritten) | projects/sanitizer-service/agent_docs/tech-design/sanitizer-service.md |
| Hard Boundaries | Unchanged | projects/sanitizer-service/agent_docs/hard-boundaries.md |
| FR docs | Unchanged | projects/sanitizer-service/agent_docs/features/FR-VAL-001--*.md, FR-VAL-002--*.md |
| Source Code | Unchanged (IMP+TST deferred) | projects/sanitizer-service/src/sanitizer.py |
| Tests | Unchanged (IMP+TST deferred) | projects/sanitizer-service/tests/test_sanitizer.py |

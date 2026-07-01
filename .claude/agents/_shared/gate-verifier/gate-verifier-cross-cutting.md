# Cross-cutting Patterns Gate Check Criteria

Load this file when verifying the **cross-cutting** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/01-global-standards/cross-cutting-patterns.md`

## 1. Required Sections

Read the artifact. All sections must be present with substantive content:
1. Shared Infrastructure — logging, metrics, tracing (libraries, config, correlation IDs)
2. Authentication & Authorization — auth flow across services, token types, token propagation, RBAC
3. Distributed Tracing — trace context propagation, span naming, sampling rates
4. Configuration Management — config sources, feature flags, runtime config updates
5. Event-Driven Patterns — event taxonomy, event schema conventions, event versioning
6. Resilience Patterns — circuit breakers (thresholds), retries (backoff), bulkheads, timeouts
7. Data Consistency Patterns — saga orchestration, outbox pattern, idempotency keys, compensating transactions
8. API Gateway / Service Mesh — routing rules, rate limiting, TLS termination

No section should be empty or contain only "TBD".

## 2. Evidence-Based Patterns

Read the artifact. Every pattern described must:
- Reference at least one service that implements it (as evidence)
- Flag patterns that appear invented rather than observed in the codebase

## 3. Deviation Detection

Read the artifact. The cross-cutting analysis must:
- Flag services that deviate from the dominant pattern
- Each flagged deviation must name the deviating service and the expected pattern

## 4. Consistency with Hard Boundaries

Cross-reference with `knowledge/01-global-standards/hard-boundaries.md`:
- Resilience patterns must match boundary rules (retry policies, circuit breaker thresholds)
- Auth patterns must match security boundaries
- Flag contradictions

## 5. Consistency with Tech Design

Spot-check 3 patterns against `knowledge/04-microservices/*/tech-design.md`:
- Circuit breaker thresholds in tech-design must match cross-cutting defaults
- Event patterns must match published/consumed event schemas
- Auth token propagation must match tech-design security sections

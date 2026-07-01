# TST Gate Check Criteria

Load this file when verifying the **tst** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact path:** `knowledge/04-microservices/{svc}/FR-{EPIC}-{NNN}--{slug}-test.md`
In forward-engineering mode: `agent_docs/backend/*/test-specs/FR-*-test.md` or `agent_docs/frontend/*/test-specs/FR-*-test.md`

## 1. Test Spec Coverage

Glob `knowledge/04-microservices/{svc}/FR-*-test.md`. Cross-reference with impl specs (`FR-*-impl.md`):
- Every FR with an impl spec must have a corresponding test spec
- Flag any FR without a test spec

## 2. Risk Level Markers

Read each test spec. Every test section/category must have a risk level marker:
- [CRITICAL], [HIGH], [MEDIUM], or [LOW]
- Flag sections without risk levels

## 3. Business Rule Coverage

For each test spec, cross-reference with the corresponding impl spec:
- Every WHEN/THEN business rule must have at least one unit test defined
- Flag uncovered business rules

## 4. Test Type Coverage

Verify each test spec covers the test types appropriate for the feature:
- Unit tests: business logic, validation, state transitions
- Integration tests: API endpoints (request/response), database operations
- Error path tests: validation error (400), unauthorized (401), forbidden (403), not found (404), conflict (409)
- Flag any missing test type categories

## 5. Boundary Value Analysis

Read test specs. For any test involving numeric, date, or range inputs:
- Must apply boundary value analysis (test at boundary, just inside, just outside)
- Flag inputs without boundary analysis

## 6. Circuit Breaker Tests

Read test specs. For each REST client / external integration defined in the tech-design:
- Client tests must include circuit breaker verification (mock endpoint, verify breaker opens after threshold)
- Flag missing circuit breaker tests

## 7. Concrete Test Data

Read test specs. Test data/fixtures must use concrete values:
- grep for placeholders: "TODO", "test_value", "placeholder", "xxx", "foo", "bar"
- Flag any placeholder values found

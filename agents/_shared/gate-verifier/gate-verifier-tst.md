# TST Gate Check Criteria

Load this file when verifying the **tst** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

## 1. Test Spec Coverage

Glob `agent_docs/backend/*/test-specs/FR-*-test.md` and `agent_docs/frontend/*/test-specs/FR-*-test.md`. Cross-reference with impl specs:
- Every FR with an impl spec must have a corresponding test spec
- Flag any FR without a test spec

## 2. Risk Level Markers

Read each test spec. Every section must have a risk level marker:
- [CRITICAL], [HIGH], [MEDIUM], or [LOW]
- Flag sections without risk levels

## 3. Business Rule Coverage

For each test spec, cross-reference with the corresponding impl spec:
- Every WHEN/THEN business rule must have at least one unit test defined
- Flag uncovered business rules

## 4. HTTP Status Coverage

For backend API test specs, verify that API tests cover:
- 200 (success)
- 400 (validation error)
- 401 (unauthorized)
- 403 (forbidden)
- 404 (not found)
- 409 (conflict)
- Flag any missing status codes

## 5. Boundary Value Analysis

Read test specs. For any test involving numeric, date, or range inputs:
- Must apply boundary value analysis (test at boundary, just inside, just outside)
- Flag inputs without boundary analysis

## 6. Circuit Breaker Tests

Read backend test specs. For each REST client defined in the tech-design:
- Client tests must include circuit breaker verification (mock endpoint, verify breaker opens after threshold)
- Flag missing circuit breaker tests

## 7. NFR Performance Tests

Read `agent_docs/performance/nfr-mapping.md`:
- Every quantified NFR from SRS.md must have a corresponding performance test scenario
- Each scenario must specify: tool, target throughput, pass threshold

## 8. Concrete Test Data

Read test specs. Test data/fixtures must use concrete values:
- grep for placeholders: "TODO", "test_value", "placeholder", "xxx", "foo", "bar"
- Flag any placeholder values found

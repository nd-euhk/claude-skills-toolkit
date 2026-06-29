# TST Phase — Test Specification

Thực thi TST phase: nhận consolidated context từ skill level → tạo/cập nhật TST documents qua phase-tst-specialist → verify qua Agent(Explore) (trừ khi --no-gate).

## Architecture

Tuân theo [shared 3-actor pattern](shared-patterns.md#architecture-pattern-3-actor) và [phase procedure template](shared-patterns.md#phase-procedure-template-dùng-cho-mọi-phase-reference-file) với `{X}` = `tst`. Brainstorming + analyze + scout đã hoàn thành ở skill level — phase chỉ nhận và dùng consolidated context.

## Input Detection

Trước khi bắt đầu, verify các inputs này tồn tại:
1. `agent_docs/backend/{service}/implementation/FR-*-impl.md` (tất cả backend impl specs)
2. `agent_docs/frontend/{app}/implementation/FR-*-impl.md` (tất cả frontend impl specs)
3. `agent_docs/tech-design/{name}-service.md` — transaction boundaries, circuit breakers, error flows
4. `docs/product/SRS.md` — NFR thresholds

Nếu thiếu bất kỳ required input nào, báo cáo cho calling skill và dừng. TST specs depend on complete IMP artifacts và NFR thresholds.

## Procedure

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions: test strategy per feature, risk level assignments, boundary value candidates, fixture requirements, performance test scenarios
- Explore findings: existing test patterns, fixture definitions, Testcontainers/WireMock configs, performance test scripts
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

```
Agent(phase-tst-specialist, prompt: "
  Tạo/cập nhật TST documents với context sau:

  BRAINSTORMING SUMMARY:
  {dán brainstorming conclusions: test strategy, risk levels, boundary value candidates, fixture requirements}

  SCOUT DISCOVERIES:
  {dán Explore findings: existing test patterns, fixture definitions, Testcontainers/WireMock configs}

  DECISIONS MADE:
  {sequential-thinking/problem-solving conclusions nếu có dùng}

  INPUTS:
  - Language: {vi|en}

  Viết tất cả output bằng {language}.

  Tạo: backend + frontend test specs, performance test plan, fixture definitions.
  KHÔNG verify — chỉ tạo.
")
```

Specialist xử lý:
- Backend test specs per FR (unit, repository, controller, integration, client, architecture, performance)
- Frontend test specs per FR (component, hook, E2E)
- Performance test plan từ NFR thresholds
- Test data và fixture definitions
- Risk level marking per test section

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

Tuân theo [Step 3: Verify](shared-patterns.md#step-3-verify-via-agentexplore-trừ-khi---no-gate) với `{PHASE}` = `TST`, `{X}` = `tst`.

Artifacts cần verify:
- `agent_docs/backend/{service}/test-specs/FR-*-test.md` (tất cả backend test specs)
- `agent_docs/frontend/{app}/test-specs/FR-*-test.md` (tất cả frontend test specs)
- `agent_docs/performance/nfr-mapping.md`
- `agent_docs/performance/baseline.md`

### Step 4: Report Results

Tuân theo [Step 4: Report](shared-patterns.md#step-4-report-results). Thêm phase-specific:
- Test specs created (count: BE + FE)
- Risk level distribution: [CRITICAL], [HIGH], [MEDIUM], [LOW]
- Test layers covered per FR
- Performance test scenarios từ NFRs

## Gate Criteria (verified by Agent(Explore) với gate-verifier-tst)

- [ ] Mỗi FR có test spec (backend, frontend, hoặc both)
- [ ] Mỗi test spec section có risk level marked ([CRITICAL]/[HIGH]/[MEDIUM]/[LOW])
- [ ] Unit tests cover every WHEN/THEN business rule từ impl spec
- [ ] API tests cover 200, 400, 401, 403, 404, 409 cho every endpoint
- [ ] Boundary value analysis applied to all numeric/date/range inputs
- [ ] Client tests include circuit breaker verification
- [ ] Mỗi quantified NFR có corresponding performance test
- [ ] Test data/fixtures specified với concrete values, không phải placeholders

## Anti-Patterns

Tuân theo [shared anti-patterns](shared-patterns.md#shared-anti-patterns). Phase-specific additions:

- **Không write actual test code** — đây là specification for tests, không phải test implementation
- **Không skip circuit breaker tests** — most common production failures
- **Không write vague assertions** ("should work correctly" — specify exact values)
- **Không skip error path tests** (only testing happy path)

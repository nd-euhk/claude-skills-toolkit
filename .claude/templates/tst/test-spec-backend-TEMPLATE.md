---
title: "Backend Test Spec: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-test"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: {{author}}
depends_on:
  - ../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md
  - ../../contracts/api-{{domain}}.yaml
  - ../contracts/error-codes.md
referenced_by: []
changelog:
  - 2.1 | {{date}} | Align FR naming (bỏ {{LAYER}}), đổi tên thành backend-specific template
  - 2.0 | {{date}} | Refactor lean — behavior matrix, bỏ stub/setup code
  - 1.0 | {{date}} | Initial test spec
---

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. Test spec mô tả BEHAVIOR cần verify, KHÔNG cài đặt test.
     WireMock stub body, @SpringBootTest setup, fixture Java — thuộc source code.
  2. Context Isolation: test spec KHÔNG đọc impl spec. Behavior bắt nguồn từ
     FR / API contract / error taxonomy, không từ "nơi code xử lý".
  3. Snippet ≤5 dòng, chỉ khi minh hoạ assertion path (JSONPath). Gắn nhãn
     "illustrative".
  4. Error code assertion dùng flat shape (`$.code`), KHÔNG `$.error.code`
     — xem _framework/structure/api-contract.md.
  5. Template này dành cho BACKEND (Spring Boot / JUnit). Cho FE dùng
     test-spec-frontend-TEMPLATE.md.
-->

# Backend Test Specification: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-test

**FR**: FR-{{DOMAIN}}-{{NNN}}
**Service**: {{service}}
**Layer**: BE (xem `layer` field trong FR frontmatter)

> ⚠️ **Context Isolation**: Tests verify BEHAVIOR từ FR + contract. KHÔNG đọc impl spec khi viết test.

---

## 1. Test Layer Ownership

| Layer | Framework expectation | What it verifies | What it should NOT test |
|---|---|---|---|
| Unit — Service | Plain JUnit + Mockito (hoặc equivalent) | Business rule, orchestration, exception mapping | Spring context, DB, HTTP |
| Controller | `@WebMvcTest` (hoặc equivalent) | Request binding, validation, auth, response shape | Business logic (mock service) |
| Repository | `@DataJpaTest` + Testcontainers PostgreSQL | SQL/JPQL, mapping, constraint | Controller/service flow |
| Client (outbound) | WireMock | Success, timeout, retry, circuit breaker, fallback | Real target service |
| Integration | `@SpringBootTest` + Testcontainers + WireMock | E2E flow trong 1 service | Cross-service E2E (CT test) |
| Contract | OpenAPI contract test | FE ↔ BE shape match | Business behavior |
| Performance | k6 / Gatling | NFR-PERF threshold | Functional correctness |

---

## 2. Behavior Matrix — {{Feature}}Service (Unit)

| # | Scenario | Given | When | Then | FR ref |
|---|---|---|---|---|---|
| 1 | Happy path | {{valid input + dependencies available}} | {{service.method(input)}} | Return {{expected output}} | FR-...§{{n}} |
| 2 | {{Business rule}} vi phạm | {{precondition làm rule fail}} | {{method call}} | Throw `{{DomainException}}` với code `{{CODE}}` | FR-...§{{n}} |
| 3 | Aggregate không tồn tại | Repo trả `Optional.empty()` | {{method call}} | Throw not-found với code `{{RESOURCE}}_NOT_FOUND` | — |
| 4 | External call fail (fallback) | Client throws / circuit open | {{method call}} | Trả fallback hoặc map sang `SERVICE_UNAVAILABLE` | tech-design §9 |
| 5 | Concurrency conflict | Version mismatch khi save | {{method call}} | Throw optimistic lock → code `OPTIMISTIC_LOCK_ERROR` | — |

**Mocking policy**: mock repository + outbound client; **KHÔNG** mock chính business logic đang test. Không dùng Spring context.

---

## 3. Behavior Matrix — {{Feature}}Controller (WebMvc)

| # | Scenario | HTTP | Auth | Expected status | Assertion (flat) |
|---|---|---|---|---|---|
| 1 | Valid request | {{METHOD}} /api/v1/... | authenticated | {{200/201}} | body shape khớp contract |
| 2 | Missing auth | {{METHOD}} — | no token | 401 | `$.code ∈ {UNAUTHORIZED, TOKEN_EXPIRED}` |
| 3 | Forbidden | {{METHOD}} — | wrong role | 403 | `$.code == "ACCESS_DENIED"` |
| 4 | Invalid body | {{METHOD}} — | authenticated | 400 | `$.code == "VALIDATION_ERROR"`, `$.details.errors[*].field` exists |
| 5 | Duplicate / conflict | {{METHOD}} — | authenticated | 409 | `$.code == "DUPLICATE_ENTRY"` |
| 6 | Not found | {{METHOD}} — | authenticated | 404 | `$.code matches "*_NOT_FOUND"` |
| 7 | Business rule fail | {{METHOD}} — | authenticated | 422 | `$.code == "BUSINESS_RULE_VIOLATION"` hoặc domain code |
| 8 | Internal error | Trigger unhandled | authenticated | 500 | `$.code == "INTERNAL_ERROR"`, **không** có stacktrace trong body |

> Response path assertion dùng **flat** (`$.code`, `$.message`, `$.details.*`). **KHÔNG** dùng `$.error.*` (drift SSOT).

---

## 4. Behavior Matrix — {{Entity}}Repository (DataJpa)

| # | Scenario | What | Assert |
|---|---|---|---|
| 1 | CRUD cơ bản | Save → find → update → delete | Persist, retrieve, delete đúng |
| 2 | Custom query | `findBy{{Field}}(...)` | Match rows đúng filter |
| 3 | Unique constraint | Insert duplicate | Throw `DataIntegrityViolationException` |
| 4 | Pagination / sort | `findAll(Pageable)` | Số lượng + thứ tự đúng |
| 5 | Index hit (nếu có) | Query điều kiện index | EXPLAIN không full scan (manual verify trên staging) |

---

## 5. Behavior Matrix — {{Target}}ServiceClient (WireMock)

| # | Scenario | Stub response | Expected behavior |
|---|---|---|---|
| 1 | Success 200 | Valid body khớp contract | Return mapped DTO |
| 2 | 404 | Empty body | Throw not-found (map `DATA_NOT_FOUND` hoặc domain variant) |
| 3 | Timeout ({{2000}}ms) | Fixed delay vượt timeout | Trigger fallback hoặc throw `SERVICE_UNAVAILABLE` |
| 4 | Circuit breaker open | 3 consecutive failures | Tiếp theo → fail fast, không hit target |
| 5 | Retryable 5xx | 500 lần 1, 200 lần 2 | Retry 1 lần, trả response lần 2 |
| 6 | Non-retryable 4xx | 400 | Không retry, throw ngay |

**Stub shape reference**: OpenAPI của target service (hoặc `contracts/{{target}}-internal.yaml`). Stub body cụ thể nằm trong source test code.

---

## 6. Integration Test — {{Feature}}IntegrationTest

| # | Scenario | Scope | Assert |
|---|---|---|---|
| 1 | Happy path E2E | HTTP → service → DB → response | Response body + row trong DB đúng |
| 2 | External unavailable | Target service 503 | Response trả đúng degraded mode của feature |
| 3 | Audit log emitted | State-changing action | Row trong audit table đúng shape |
| 4 | Transaction rollback | Business rule fail giữa flow | DB state giữ nguyên |

**Setup expectation** (logical):
- Testcontainers PostgreSQL (version khớp production).
- WireMock cho mọi outbound service.
- Seed data qua repository hoặc SQL migration test (không hard-code SQL trong file test).

---

## 7. Performance Tests (khi có NFR-PERF)

| NFR | Tool | Scenario | Threshold | Workload |
|---|---|---|---|---|
| NFR-PERF-{{NNN}} | k6 / Gatling | {{request pattern}} | P95 < {{X}}ms, error rate < {{Y}}% | {{RPS, duration, ramp-up}} |

> Chi tiết test plan: `performance-test.md`.

---

## 8. Acceptance — Test Done khi

- [ ] Mọi row ở §2–§5 có test tương ứng PASS.
- [ ] Integration test §6 PASS trên Testcontainers.
- [ ] Coverage theo policy project (nếu có) — không ép 100%.
- [ ] Error assertion dùng flat shape (`$.code`), không `$.error.*`.
- [ ] Không mock business logic đang test.
- [ ] Không có stacktrace leak trong response body 5xx (assertion §3 row 8).

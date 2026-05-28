---
title: "Implementation Spec: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-impl"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: {{author}}

# ── SCOPE — Boundary enforcement (H-32) ──────────────────
# Inherit mặc định từ FR's scope.allowed_paths. Override tại đây nếu impl
# cần touch paths ngoài FR declared (với rationale). Consumer: blast-radius.sh.
scope:
  allowed_paths: []          # Glob patterns — default inherit từ FR
  forbidden_paths: []         # Optional hard-deny
  rationale: ""               # Required nếu deviate từ FR scope

depends_on:
  - ../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md
  - ../../contracts/api-{{domain}}.yaml
  - ../../tech-design/{{service}}-service.md
  - ../../ownership/ownership-map.yaml
referenced_by:
  - ../test-specs/FR-{{DOMAIN}}-{{NNN}}--{{slug}}-test.md
changelog:
  - 1.0 | {{date}} | Initial impl spec
---

<!--
HARD RULES cho file này (xem SPEC-BOUNDARIES.md để hiểu vì sao):

  1. KHÔNG paste compile-ready code. Không `package`, không `import`,
     không annotation đầy đủ, không method body, không full SQL.
  2. Snippet được phép ≤10 dòng và CHỈ khi cần minh hoạ contract shape
     hoặc mapping khó — phải ghi rõ "illustrative, not source of truth".
  3. Field list / DTO schema / column list: nếu đã có ở OpenAPI hoặc
     tech-design thì CHỈ reference, không copy lại.
  4. File/class/method cụ thể là trách nhiệm của source code. Ở đây
     mô tả "area" (trách nhiệm logic), không phải "file path cứng".
  5. Full SQL migration nằm ở migration-spec, không nằm ở đây.

Mục tiêu: spec tối ưu cho REVIEW QUYẾT ĐỊNH KỸ THUẬT, không tối ưu cho
copy-paste vào IDE. Nếu Anh thấy mình đang viết code → chuyển xuống
source code hoặc migration-spec.
-->

# Implementation: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-impl

> **Context budget**: ~120 dòng. Load khi implement backend feature.

**FR**: FR-{{DOMAIN}}-{{NNN}}
**Service**: {{service}}
**API**: {{METHOD}} /api/v1/{{resource}}

## 1. Purpose

- **Mục tiêu**: {{1–2 câu mô tả feature giải quyết vấn đề gì, cho ai}}
- **In scope**:
  - {{behavior 1}}
  - {{behavior 2}}
- **Out of scope**:
  - {{explicit exclusion — tránh scope creep}}

## 2. References

| Artifact | Link |
|---|---|
| Feature spec (FR) | `../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md` |
| API contract | `contracts/api-{{domain}}.yaml#{{operationId}}` |
| Tech design | `tech-design/{{service}}-service.md` §{{section}} |
| Error codes | `contracts/error-codes.md` |
| Migration spec (if any) | `{{../migrations/... or "N/A"}}` |

## 3. Affected Areas

> Mô tả **trách nhiệm logic**, không phải tên class cứng. Source code là nơi
> quyết định tên file/class chính xác.

| Area | Module/Package (logical) | Responsibility | Action |
|---|---|---|---|
| {{e.g. Domain model}} | `domain.{{aggregate}}` | {{enforce invariant X}} | new / modify / reuse |
| {{e.g. Persistence}} | `domain.{{aggregate}}.repository` | {{query pattern Y}} | new / modify / reuse |
| {{e.g. Application service}} | `application.{{feature}}` | {{orchestrate flow Z}} | new |
| {{e.g. API layer}} | `api.{{resource}}` | {{expose endpoint, map DTO}} | new |
| {{e.g. Integration}} | `integration.{{target}}` | {{call target service, circuit breaker}} | new / reuse |

## 4. Execution Flow

> Đánh số 1–N. Mỗi bước **1 câu hành vi** — không annotation, không code.

1. Nhận request tại endpoint `{{METHOD}} /api/v1/{{resource}}`.
2. Xác thực + kiểm tra quyền theo `§8 Security`.
3. Validate input theo OpenAPI schema (`{{operationId}}`).
4. Load aggregate `{{Aggregate}}` (hoặc xác nhận không tồn tại nếu là create).
5. Áp dụng business rules `§5`.
6. Gọi service ngoài `{{target}}` **ngoài** transaction boundary (nếu cần).
7. Persist state change **trong** transaction boundary.
8. Emit domain event / audit log (nếu có).
9. Map sang response DTO theo contract và trả về status `{{200|201|204}}`.

## 5. Business Rules Realized In This Feature

| Rule ID | Description | Enforcement Point (logical) |
|---|---|---|
| BR-{{NNN}} | {{rule 1 phát biểu ngắn}} | `application.{{feature}}` |
| BR-{{NNN}} | {{rule 2}} | `domain.{{aggregate}}` (invariant) |
| BR-{{NNN}} | {{rule 3 — e.g. idempotency key}} | `api.{{resource}}` (filter/interceptor) |

> Nếu rule đã được phát biểu ở FR hoặc tech-design, chỉ cần trỏ tới ID,
> không lặp lại nội dung đầy đủ.

## 6. Data & State Impact

- **Đọc**: {{table/aggregate A, table B}}
- **Ghi**: {{table/aggregate C}}
- **Transaction boundary**: {{e.g. "một transaction bao toàn bộ persist ở bước 7; external call ở bước 6 nằm ngoài"}}
- **Idempotency**: {{yes/no — nếu yes: key source là gì, strategy nào}}
- **Concurrency**: {{e.g. optimistic lock on version, hoặc N/A}}
- **Schema impact**: chọn 1 trong 3
  - [ ] `No schema change`
  - [ ] `See migration spec: {{../migrations/V{NNN}__{slug}.md}}`
  - [ ] Inline note: {{mô tả cực ngắn + link tới migration spec đầy đủ}}

## 7. Error Mapping

| Condition | Error Code | HTTP | Notes |
|---|---|---|---|
| {{input vi phạm schema}} | `VALIDATION_ERROR` | 400 | theo `error-codes.md` |
| {{aggregate không tồn tại}} | `{{RESOURCE}}_NOT_FOUND` | 404 | |
| {{business rule X vi phạm}} | `{{BUSINESS_ERROR_CODE}}` | 409/422 | |
| {{hết quyền}} | `FORBIDDEN` | 403 | |
| {{target service timeout}} | `UPSTREAM_UNAVAILABLE` | 503 | circuit breaker per tech-design §{{n}} |

## 8. Security & Authorization

- **Who can call**: {{public / authenticated / admin / owner / internal}}
- **Authorization rule**: {{e.g. "chỉ owner hoặc ADMIN"; hoặc "internal service-to-service"}}
- **Audit requirement**: {{yes/no — nếu yes: event type + resource type, trỏ `operations/audit-logging.md`}}
- **Sensitive data handling**: {{PII masking, log redaction note, hoặc N/A}}

## 9. Implementation Notes

- **Reuse**: {{existing component/service có thể tái sử dụng — list ngắn}}
- **Extension points**: {{hook/plugin point nếu feature mở rộng được}}
- **Naming/convention deviation**: {{nếu có khác conventions.md thì giải thích, nếu không thì "N/A"}}
- **Tech debt accepted for MVP**: {{e.g. "chưa cache layer; thêm sau khi NFR-PERF-xxx fail"}}
- **Observability hooks**: {{metric name, trace span, log event nếu cần out-of-band từ conventions}}

## 10. Acceptance Checklist

Khi feature này được coi là "done":

- [ ] Endpoint trả đúng status + body theo OpenAPI contract.
- [ ] Mọi error condition ở `§7` map đúng code + HTTP.
- [ ] Authorization hoạt động đúng cho từng role ở `§8`.
- [ ] Business rules `§5` enforced và có test cover.
- [ ] Transaction/idempotency behavior khớp `§6`.
- [ ] Không vi phạm hard boundaries (xem `hard-boundaries.md`).
- [ ] Test-spec tương ứng cover đủ golden path + error cases.
- [ ] Observability hooks hoạt động (metric/log/trace xuất hiện đúng).

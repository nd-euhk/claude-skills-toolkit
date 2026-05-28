---
title: "FR-{DOMAIN}-{NNN}: {Feature Name}"
status: draft
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
updated_by: {name}

# ── ROUTING — Agent đọc block này ĐẦU TIÊN ──────────────

# FR ID = business feature ID, KHÔNG chứa layer.
# Ví dụ: FR-AUTH-001--user-registration.md
# `layer` field dưới đây xác định scope: BE | FE | BE+FE
#
# QUY TẮC CONDITIONAL (theo layer):
#   layer=BE    → PHẢI có: backend_service, backend_impl, backend_test, api_endpoints (direction=expose)
#                 KHÔNG có: frontend_pages
#   layer=FE    → PHẢI có: frontend_pages (ít nhất 1 entry)
#                 KHÔNG có: backend_service, backend_impl, backend_test
#                 api_endpoints CÓ THỂ liệt kê endpoint đang consume (direction=consume)
#   layer=BE+FE → PHẢI có: CẢ backend_* lẫn frontend_pages
#
# Khi dùng FR-TEMPLATE này, XOÁ các block không áp dụng cho layer của feature.

layer: BE+FE                                  # BE | FE | BE+FE

# ── BLOCK BACKEND (chỉ giữ khi layer ∈ {BE, BE+FE}) ──────
backend_service: {name}-service               # Service chính implement feature
backend_impl: backend/{name}-service/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
backend_test: backend/{name}-service/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md

api_endpoints:
  # API mà service này CUNG CẤP cho feature này (chỉ có khi layer có BE)
  - method: POST                              # GET | POST | PUT | DELETE
    path: /api/v1/{resource}                  # Path đầy đủ
    contract: contracts/api-{domain}.yaml#{operationId}
    direction: expose                         # expose = service cung cấp API
    auth: required                            # required | public | internal

  # API mà service này GỌI từ service khác (BE) HOẶC API mà FE consume (FE)
  - method: GET
    path: /internal/{resource}/{id}
    contract: contracts/api-{other-domain}.yaml#{operationId}
    direction: consume                        # consume = gọi API service khác
    target_service: {other}-service           # Service cung cấp API

# ── BLOCK FRONTEND (chỉ giữ khi layer ∈ {FE, BE+FE}) ─────
frontend_pages:
  - page: /{route-path}                       # URL path trên frontend
    app: app-{name}                           # Tên app trong projects/
    component: {ComponentName}                # React component chính
    impl: frontend/{app}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
    test: frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
    interaction: docs/ux/interactions/{flow-name}.md

# ── BLOCK CROSS-SERVICE (chỉ BE, xoá nếu FE-only) ────────
cross_service_deps:
  - service: {other}-service
    reason: "{Tại sao cần gọi service này}"
    api: "{METHOD} /internal/{path}"
    failure_mode: "{Cache fallback | Queue retry | Reject request}"

# ── BLOCK SCOPE — Boundary enforcement (H-32) ────────────
# Consumer: scripts/blast-radius.sh + check-blast-radius.sh (Wave 3 H-31/H-33).
# Default: inherit từ owning module's paths.allowed (ownership-map.yaml).
# Override TẠI ĐÂY để narrow scope — KHÔNG widen beyond module's.
# Empty allowed_paths → default union(backend_service + frontend_pages modules).
scope:
  allowed_paths: []
    # Liệt kê glob patterns mà FR được phép touch. Ví dụ:
    # - "projects/auth-service/src/**"
    # - "agent_docs/backend/auth-service/implementation/FR-AUTH-001--*"
    # - "infra/auth-service/migrations/V*__FR-AUTH-001*.sql"

  forbidden_paths: []
    # Paths tuyệt đối không được edit (override module allowed).
    # Use case: protect shared config, cross-service boundaries.

  rationale: ""
    # Required nếu allowed_paths narrow hơn hoặc forbidden_paths override module.
    # Để trống khi inherit fully từ ownership-map.

# ── TRACEABILITY ─────────────────────────────────────────
# depends_on / referenced_by PHẢI conditional theo layer:
#   layer=BE    → depends_on chỉ liệt kê tech-design + api contract BE
#                 referenced_by chỉ backend/*/impl + backend/*/test
#   layer=FE    → depends_on liệt kê api contract + interaction + design-system
#                 referenced_by chỉ frontend/*/impl + frontend/*/test
#   layer=BE+FE → Cả hai (như ví dụ dưới)

depends_on:
  - ../contracts/api-{domain}.yaml            # Luôn có (cả BE lẫn FE đều cần)
  - ../tech-design/{name}-service.md          # Chỉ layer có BE
  - ../../docs/ux/interactions/{flow-name}.md # Chỉ layer có FE
  - ../../docs/ux/design-system.md            # Chỉ layer có FE

referenced_by:
  - ../backend/{name}-service/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md   # BE only
  - ../backend/{name}-service/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md       # BE only
  - ../frontend/{app}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md           # FE only
  - ../frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md               # FE only

changelog:
  - 1.2 | YYYY-MM-DD | Conditional blocks theo layer (BE/FE/BE+FE); thêm frontend test path
  - 1.1 | YYYY-MM-DD | Unify FR ID: bỏ {LAYER} khỏi ID, chuyển sang `layer` frontmatter
  - 1.0 | YYYY-MM-DD | Initial FR
---

# FR-{DOMAIN}-{NNN}: {Feature Name}

## Mô tả

{1-2 câu mô tả feature từ góc nhìn business}

## Preconditions

- {User đã đăng nhập / chưa}
- {Data nào phải tồn tại trước}
- {Permission nào cần}

## Input

| Field | Type | Required | Validation | Ví dụ |
|-------|------|----------|-----------|-------|
| {field1} | {type} | Yes/No | {rules} | {example} |

## Process

1. {Step 1 — validate / check}
2. {Step 2 — business logic}
3. {Step 3 — persist / notify}

## Output

### Success (HTTP {status})

```json
{
  "id": "uuid",
  "field1": "value"
}
```

### Errors

> **Code format**: `UPPER_SNAKE_CASE`, KHÔNG prefix `ERR_`. Xem `agent_docs/contracts/error-codes.md`.

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| {DOMAIN}_{DESCRIPTION_1} | {400/403/404/409} | {Khi nào xảy ra} | {Message} |
| {DOMAIN}_{DESCRIPTION_2} | {status} | {condition} | {message} |

## Gherkin Scenarios

```gherkin
Scenario: {Happy path}
  Given {precondition}
  When {action}
  Then {expected result}

Scenario Outline: Validation errors
  Given {precondition}
  When {action with <param>}
  Then <status> <error>

  Examples:
  | param | status | error |
  | {value1} | {400} | {ERROR_CODE} |
  | {value2} | {403} | {ERROR_CODE} |

Scenario: {Concurrency / Idempotency — nếu applicable}
  Given {setup}
  When {duplicate action}
  Then {idempotent result}
```

## Data Model References

- Entity: `{EntityName}` in `tech-design/{name}-service.md` §3
- Table: `{table_name}` owned by `{name}-service`
- Migration: `V{NNN}__{description}.sql`

## Constraints

- {Business rule 1}
- {Business rule 2}
- {NFR reference: NFR-PERF-{NNN} → P95 < {X}ms}

---
title: "Error Handling Standard"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - ../_framework/structure/api-contract.md
  - tech-design.md
  - ../docs/SECURITY/security-architecture.md
referenced_by:
  - impl-spec-backend.md
  - api-routing.md
  - contracts/error-codes.md
changelog:
  - 3.0 | {{date}} | Refactor lean-spec — flat ApiErrorResponse, bỏ GlobalExceptionHandler code skeleton
  - 2.0 | {{date}} | Expanded — full error handling standard
  - 1.0 | {{date}} | Initial error codes
---

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. File này mô tả CHUẨN (taxonomy, mapping policy, logging matrix) — KHÔNG
     cài đặt. Exception class, @RestControllerAdvice, handler method body
     thuộc source code.
  2. Response format SSOT: _framework/structure/api-contract.md.
     Không được đề xuất format khác (nested `{error: {...}}` là drift).
  3. Error code catalog chi tiết nằm ở `contracts/error-codes.md`.
     File này chỉ liệt kê global/canonical codes ở dạng bảng.
  4. Snippet ≤10 dòng, chỉ khi minh hoạ shape/assertion. Gắn nhãn
     "illustrative, not source of truth".
-->

# Error Handling Standard

> **Context budget**: ~220 dòng. Load khi thiết kế error flow hoặc tra error code canonical.

> **Mục đích**: Chuẩn hoá error handling toàn hệ thống — tất cả service dùng chung taxonomy, response format, logging policy. Cài đặt cụ thể (exception hierarchy, global handler) là việc của source code; file này là **standard**.

> **SSOT response format**: [`_framework/structure/api-contract.md`](../../_framework/structure/api-contract.md) §Error Response.
> **SSOT error code list**: [`contracts/error-codes.md`](contracts/error-codes.md).

---

## 1. Response Format (tham chiếu SSOT)

Mọi error response PHẢI là **flat `ApiErrorResponse`** với các field top-level:

| Field | Type | Required | Source of value |
|---|---|---|---|
| `status` | Integer | ✅ | HTTP status code |
| `code` | String | ✅ | Application error code — `UPPER_SNAKE_CASE`, **không** prefix `ERR_` |
| `message` | String | ✅ | User-friendly message (tiếng Việt hoặc i18n key) |
| `path` | String | ✅ | Request URI |
| `timestamp` | String | ✅ | ISO 8601 UTC |
| `traceId` | String | ✅ | OpenTelemetry trace ID |
| `details` | Object | ✅ | Context bổ sung; có thể `{}`. Validation dùng `details.errors[]` |

> Chi tiết shape + ví dụ JSON đầy đủ: xem SSOT. **KHÔNG copy ví dụ vào đây** để tránh drift.

### Validation error shape

Khi `code = VALIDATION_ERROR`, `details.errors[]` là bắt buộc với mỗi phần tử gồm `{ field, message, rejectedValue }`. `rejectedValue` **KHÔNG** được trả cho các field nhạy cảm (password, token, secret, PII).

---

## 2. Error Taxonomy

| Category | HTTP range | Khi nào dùng | Canonical codes |
|---|---|---|---|
| **Validation** | 400 | Input format sai, constraint fail | `VALIDATION_ERROR`, `INVALID_FORMAT` |
| **Auth (authentication)** | 401 | Chưa xác thực hoặc token lỗi | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` |
| **Authz (authorization)** | 403 | Đã xác thực nhưng không đủ quyền | `ACCESS_DENIED` |
| **Not found** | 404 | Resource không tồn tại | `DATA_NOT_FOUND`, `{RESOURCE}_NOT_FOUND` |
| **Conflict / state** | 409 | DB unique vi phạm, state transition sai | `DUPLICATE_ENTRY`, `INVALID_STATE_TRANSITION`, `OPTIMISTIC_LOCK_ERROR` |
| **Business rule** | 422 | Domain rule vi phạm | `BUSINESS_RULE_VIOLATION`, `{DOMAIN}_{RULE}` |
| **Rate limit** | 429 | Client vượt ngưỡng | `RATE_LIMITED` |
| **Integration** | 502 / 503 | Downstream fail, dependency down | `SERVICE_UNAVAILABLE`, `UPSTREAM_ERROR` |
| **System** | 500 | Unexpected / unhandled | `INTERNAL_ERROR` |

> Domain-specific codes (`AUTH_*`, `BOOK_*`, …): xem `contracts/error-codes.md`.

---

## 3. Mapping Policy

| Source | Mapping decision | Notes |
|---|---|---|
| Bean Validation (`@Valid`) fail | 400 + `VALIDATION_ERROR` + `details.errors[]` | Framework-level, không tự throw |
| Custom domain exception | HTTP status + code do exception tự carry | Mỗi exception gắn đúng category §2 |
| Spring Security `AccessDeniedException` | 403 + `ACCESS_DENIED` | Không lộ rule detail |
| Spring Security auth failure | 401 + `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Phân biệt được 3 case |
| `DataIntegrityViolationException` | 409 + `DUPLICATE_ENTRY` | **KHÔNG** expose SQL / column name |
| Timeout / CircuitBreaker open | 503 + `SERVICE_UNAVAILABLE` | Ghi target vào `details.target` |
| Unhandled `Exception` | 500 + `INTERNAL_ERROR` | **KHÔNG** expose stacktrace, class name, SQL |

**Ownership**: mỗi service có **đúng 1** global handler (tên/class do source code quyết định). Controller **KHÔNG** được tự handle exception → mất consistency.

---

## 4. Security Rules cho Error Response

| Rule | Reason |
|---|---|
| Không bao giờ trả stacktrace, exception class name, SQL error | Lộ internal structure → security risk |
| Không bao giờ trả `rejectedValue` cho password/token/secret/PII | Confidentiality |
| Generic message cho 5xx ("Lỗi hệ thống") — detail chỉ ở log | User không cần technical detail |
| `traceId` **luôn** có → support tra log bằng traceId | Debug mà không cần expose detail |
| `details` chỉ chứa data đã được sanitize | Không echo raw user input chưa mask |

---

## 5. Logging Matrix

| HTTP | Log level | Stacktrace? | Rationale |
|---|---|---|---|
| 400 | `WARN` | ❌ | Client error, không phải bug server |
| 401 | `WARN` | ❌ | Expected flow (token expired, wrong cred) |
| 403 | `WARN` | ❌ | Authorization denied, expected |
| 404 | `INFO` | ❌ | Normal flow (resource chưa tạo) |
| 409 | `WARN` | ❌ | Business conflict |
| 422 | `WARN` | ❌ | Business rule violation |
| 429 | `WARN` | ❌ | Rate limit triggered |
| 500 | `ERROR` | ✅ | **Bug — cần investigate** |
| 502/503 | `ERROR` | ✅ | **Dependency down — alert** |

### Security event logging (ngoài HTTP error)

| Event | Level | Destination |
|---|---|---|
| Login success | `INFO` | Audit log |
| Login failed | `WARN` | Audit + security monitor |
| Account lockout triggered | `WARN` | Audit + security alert |
| Unauthorized access attempt | `WARN` | Audit log |
| Admin state-changing action | `INFO` | Audit log |

> Field mapping chi tiết: `operations/audit-logging.md`.

---

## 6. Message Strategy (i18n)

| Approach | Khi nào dùng |
|---|---|
| Hardcode tiếng Việt | MVP / single-market — nhanh |
| `MessageSource` + key `error.{CODE}` | Multi-language / enterprise |

**Rule**: message **KHÔNG** chứa technical jargon (`NullPointerException`, `SQL error`, `Connection refused`). Nếu muốn lưu detail kỹ thuật → log server-side, **không** trả trong response.

---

## 7. Frontend Contract

Frontend parse `ApiErrorResponse` (flat) và ánh xạ theo bảng:

| Condition | UX treatment |
|---|---|
| `code = VALIDATION_ERROR` + `details.errors[]` | Inline error dưới từng field |
| 401 (`UNAUTHORIZED` / `TOKEN_EXPIRED`) | Silent refresh → retry; fail → redirect login |
| 403 (`ACCESS_DENIED`) | Full-page forbidden hoặc toast + disable CTA |
| 404 (`*_NOT_FOUND`) | Empty state / redirect |
| 409 (`DUPLICATE_ENTRY`, `OPTIMISTIC_LOCK_ERROR`) | Toast + giữ form state |
| 422 (`BUSINESS_RULE_VIOLATION`) | Inline banner hoặc toast |
| 429 (`RATE_LIMITED`) | Toast "thử lại sau" + hiển thị `Retry-After` nếu có |
| 5xx | Toast generic + hiển thị `traceId` cho support |
| Network / no response | Toast "Không có kết nối mạng" |

> Parsing utility (TypeScript interface shape) — **illustrative, not source of truth**, ≤10 dòng:
>
> ```ts
> interface ApiErrorResponse {
>   status: number; code: string; message: string; path: string;
>   timestamp: string; traceId: string;
>   details: { errors?: { field: string; message: string; rejectedValue?: unknown }[] };
> }
> ```

---

## 8. Test Expectations (assertion pattern)

Mọi endpoint PHẢI có test cover các scenario dưới. Path assertion dùng **flat** shape, không nested `$.error.*`:

| Scenario | Expected status | Assertion key |
|---|---|---|
| Valid input | 200 / 201 | body shape khớp contract |
| Missing required field | 400 | `$.code == "VALIDATION_ERROR"`, `$.details.errors[*].field` exists |
| Invalid format (email, UUID) | 400 | `$.code == "VALIDATION_ERROR"` |
| Unauthenticated | 401 | `$.code ∈ {UNAUTHORIZED, TOKEN_EXPIRED, INVALID_TOKEN}` |
| Forbidden | 403 | `$.code == "ACCESS_DENIED"` |
| Not found | 404 | `$.code == "DATA_NOT_FOUND"` hoặc `{RESOURCE}_NOT_FOUND` |
| Duplicate | 409 | `$.code == "DUPLICATE_ENTRY"` |
| Business rule | 422 | `$.code == "BUSINESS_RULE_VIOLATION"` hoặc domain-specific |
| Dependency down | 503 | `$.code == "SERVICE_UNAVAILABLE"` |
| Internal error | 500 | `$.code == "INTERNAL_ERROR"` + **không** có stacktrace trong body |

---

## 9. Anti-patterns

| Anti-pattern | Tại sao sai | Làm đúng |
|---|---|---|
| Response shape nested `{ "error": { ... } }` | Drift với SSOT; FE parse sai | Luôn flat, field top-level (§1) |
| `throw new RuntimeException("...")` | Trả 500 cho mọi lỗi, thiếu code | Dùng exception mang đủ code + status |
| Error trong body khi HTTP 200 | FE không parse được | Dùng đúng HTTP status |
| Expose stacktrace / SQL message | Security risk | Log server-side, trả generic |
| Catch `Exception` trong Controller | Bypass global handler → inconsistent | Để global handler xử lý |
| Log stacktrace cho 4xx | Noise log | Chỉ log stacktrace cho 5xx (§5) |
| Hardcode error message in-line | Khó maintain, khó i18n | Code → message mapping (§6) |
| Prefix code bằng `ERR_` | Drift SSOT (SSOT dùng UPPER_SNAKE_CASE không prefix) | Follow `contracts/error-codes.md` |

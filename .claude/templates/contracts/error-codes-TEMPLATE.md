---
title: "Error Codes Catalog"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - ../../../_framework/structure/api-contract.md
  - ../error-handling.md
referenced_by:
  - api-*.yaml
  - ../backend/*/implementation/*.md
  - ../frontend/*/implementation/*.md
changelog:
  - 2.0 | {{date}} | Align với flat ApiErrorResponse SSOT; bỏ prefix ERR_
  - 1.0 | {{date}} | Initial error codes catalog
---

# Error Codes Catalog

> **Mục đích**: SSOT cho tất cả error codes của hệ thống. Backend dùng khi emit error; Frontend dùng khi parse/map UX.

> **Response shape**: flat `ApiErrorResponse` — xem [`_framework/structure/api-contract.md`](../../../_framework/structure/api-contract.md) §Error Response.
> **Taxonomy + mapping policy**: xem [`error-handling.md`](../error-handling.md).

---

## 1. Code Format

```
{DOMAIN}_{DESCRIPTION}          ← domain-specific
{CANONICAL}                     ← canonical/global
```

- Case: `UPPER_SNAKE_CASE`.
- **KHÔNG** prefix `ERR_` (đã bị deprecate — drift với SSOT v2.0).
- DOMAIN: `AUTH`, `USER`, `BOOK`, … (viết HOA).
- DESCRIPTION: action / state / reason rõ ràng.

---

## 2. Canonical / Global Codes

| Code | HTTP | Category | Message (default vi) | Khi nào |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Validation | "Dữ liệu không hợp lệ" | `@Valid` fail — luôn kèm `details.errors[]` |
| `INVALID_FORMAT` | 400 | Validation | "Định dạng không hợp lệ" | Format check fail ngoài Bean Validation |
| `UNAUTHORIZED` | 401 | Auth | "Chưa xác thực" | Thiếu credential / auth header |
| `INVALID_TOKEN` | 401 | Auth | "Token không hợp lệ" | JWT malformed / tampered |
| `TOKEN_EXPIRED` | 401 | Auth | "Phiên đăng nhập hết hạn" | JWT expired |
| `ACCESS_DENIED` | 403 | Authz | "Không có quyền" | Authorization fail |
| `DATA_NOT_FOUND` | 404 | Not found | "Không tìm thấy" | Generic resource not found |
| `DUPLICATE_ENTRY` | 409 | Conflict | "Dữ liệu đã tồn tại" | DB unique vi phạm |
| `OPTIMISTIC_LOCK_ERROR` | 409 | Conflict | "Dữ liệu đã bị thay đổi" | Version mismatch |
| `INVALID_STATE_TRANSITION` | 409 | Conflict | "Trạng thái không hợp lệ" | State machine vi phạm |
| `BUSINESS_RULE_VIOLATION` | 422 | Business | "Vi phạm quy tắc nghiệp vụ" | Rule domain không thoả |
| `RATE_LIMITED` | 429 | Rate limit | "Quá nhiều yêu cầu" | Vượt ngưỡng |
| `SERVICE_UNAVAILABLE` | 503 | Integration | "Hệ thống tạm thời lỗi" | Dependency down + no fallback |
| `UPSTREAM_ERROR` | 502 | Integration | "Lỗi từ dịch vụ phụ thuộc" | Downstream trả lỗi không retry được |
| `INTERNAL_ERROR` | 500 | System | "Lỗi hệ thống" | Unhandled exception |

---

## 3. AUTH Domain

| Code | HTTP | Message | Khi nào |
|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | "Email hoặc mật khẩu sai" | Login failed |
| `AUTH_ACCOUNT_LOCKED` | 423 | "Tài khoản đã bị khóa" | Too many failed attempts |
| `AUTH_ACCOUNT_PENDING` | 403 | "Tài khoản chưa được duyệt" | Account not approved yet |
| `AUTH_EMAIL_EXISTS` | 409 | "Email đã được sử dụng" | Register duplicate |
| `AUTH_REFRESH_FAILED` | 401 | "Không thể gia hạn phiên" | Refresh token invalid/expired |

> Các code 401 generic (token issue thuần) dùng canonical `INVALID_TOKEN` / `TOKEN_EXPIRED` (§2), không tạo `AUTH_TOKEN_*`.

---

## 4. {{DOMAIN}} Template — copy section này cho mỗi domain mới

| Code | HTTP | Message | Khi nào |
|---|---|---|---|
| `{{DOMAIN}}_NOT_FOUND` | 404 | "{{Resource}} không tìm thấy" | Resource lookup failed |
| `{{DOMAIN}}_{{RULE_OR_STATE}}` | {{status}} | "{{message}}" | {{condition}} |

---

## 5. Quy tắc thêm code mới

1. **Check canonical trước** (§2) — nếu fit thì dùng canonical, KHÔNG tạo domain-specific chỉ để đổi tên.
2. Chọn đúng HTTP status theo taxonomy (`error-handling.md §2`).
3. Message **user-friendly** — không technical jargon.
4. Thêm row vào bảng domain tương ứng.
5. Cập nhật OpenAPI spec (`api-{domain}.yaml`) để list code được endpoint emit.
6. Nếu code carry extra context → ghi rõ shape của `details.*` trong row (ví dụ: `details.targetService`, `details.conflictingId`).

---

## 6. Frontend Display Mapping

| Match | UX action |
|---|---|
| `code = VALIDATION_ERROR` + `details.errors[]` | Inline error mỗi field |
| `code ∈ {UNAUTHORIZED, TOKEN_EXPIRED, INVALID_TOKEN}` (401) | Silent refresh → retry; fail → redirect `/login` |
| `code = ACCESS_DENIED` (403) | Toast "Không có quyền" hoặc forbidden page |
| `code matches *_NOT_FOUND` (404) | Empty state hoặc redirect |
| `code ∈ {DUPLICATE_ENTRY, OPTIMISTIC_LOCK_ERROR}` (409) | Toast + giữ form state |
| `code = BUSINESS_RULE_VIOLATION` (422) | Inline banner / toast |
| `code = RATE_LIMITED` (429) | Toast + tôn trọng `Retry-After` nếu có |
| `code = SERVICE_UNAVAILABLE` (503) | Toast "Hệ thống tạm thời lỗi" |
| `code = INTERNAL_ERROR` (500) | Toast + hiển thị `traceId` để user báo support |
| Network / no response | Toast "Không có kết nối mạng" |

---

## 7. Anti-patterns

- ❌ Prefix code bằng `ERR_` → drift với SSOT v2.0.
- ❌ Nested response `{ "error": { ... } }` → SSOT là flat.
- ❌ Tạo domain code để alias canonical (ví dụ `USER_VALIDATION_ERROR` cho 400 → dùng `VALIDATION_ERROR` + `details`).
- ❌ Dùng cùng code cho 2 HTTP status khác nhau → tách thành 2 code.

---
title: "Hard Boundaries — KHÔNG BAO GIỜ vi phạm"
status: current
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on: []
referenced_by:
  - README.md
  - conventions.md
changelog:
  - 2.0 | {{date}} | Mở rộng template — thêm Data Isolation, Eventing, API Contract Enforcement, Observability, Frontend BFF, Testing G/W/T
  - 1.0 | {{date}} | Initial hard boundaries
---

# Hard Boundaries

> Agent đọc file này TRƯỚC MỌI THỨ. Các rules dưới đây là TUYỆT ĐỐI.

## Architecture Boundaries

1. **KHÔNG import entity/service/repository từ service khác** — mỗi service có DTOs riêng
2. **KHÔNG gọi trực tiếp service khác** — luôn dùng REST client với circuit breaker + retry
3. **KHÔNG đọc/ghi DB tables của service khác** — mỗi service own tables riêng
4. **KHÔNG HTTP call trong transaction** — external calls ngoài transaction

## Security Boundaries

5. **KHÔNG hardcode credentials** — luôn dùng environment variables
6. **KHÔNG log sensitive data** (password, token, card number) — phải masking
7. **KHÔNG string concatenation trong SQL** — parameterized queries only
8. **KHÔNG disable security cho convenience** — mọi endpoint phải có auth/authz

## Code Quality Boundaries

9. **KHÔNG xóa/sửa test đang pass** để implementation dễ hơn
10. **KHÔNG dùng auto DDL** — schema do migration tool quản lý
11. **KHÔNG catch generic `Exception`** — catch specific exceptions
12. **KHÔNG dùng local datetime** cho business logic — dùng UTC/timezone-safe types

## Agent Boundaries

13. **KHÔNG sửa file trong `agent_docs/`, `.claude/`, `CLAUDE.md`**
14. **KHÔNG thay đổi API contracts** — human decision
15. **KHÔNG push/merge** — agent chỉ commit local, human merge

## Implementation Boundaries

16. **KHÔNG implement mà chưa đọc FR spec + impl spec** — phải load full context trước khi viết dòng code đầu tiên
17. **KHÔNG bỏ qua TDD protocol** — luôn viết test TRƯỚC (RED), implement sau (GREEN), refactor cuối
18. **KHÔNG return generic error response** — mỗi error case phải có error code riêng theo `contracts/error-codes.md`
19. **KHÔNG tạo endpoint mới ngoài API contract** — tất cả endpoints phải đã được định nghĩa trong API spec
20. **KHÔNG viết DB migration không có rollback plan** — mọi migration phải có backwards-compatible strategy hoặc rollback script
21. **KHÔNG log request/response body ở production level** — chỉ log ở DEBUG level, production dùng structured logging với correlation ID
22. **KHÔNG dùng field injection** — dùng constructor injection
23. **KHÔNG để business logic trong Controller** — Controller chỉ parse request → gọi Service → format response
24. **KHÔNG access shared mutable state không có synchronization**
25. **KHÔNG hardcode configuration values** — dùng config file hoặc environment variables

## Testing Boundaries

26. **KHÔNG viết test verify implementation details** — test verify BEHAVIOR từ FR, không verify internal method calls
27. **KHÔNG dùng sleep trong test** — dùng async assertion utilities
28. **KHÔNG share mutable state giữa test methods** — mỗi test method phải isolated
29. **KHÔNG mock quá sâu** — chỉ mock boundary dependencies (DB, external API), KHÔNG mock service internals
30. **KHÔNG bỏ qua edge cases trong test** — mỗi FR phải có ≥1 happy path + ≥2 error cases + boundary value tests
31. **KHÔNG dùng cấu trúc Arrange/Act/Assert (AAA) hoặc biến thể** — mọi test method BẮT BUỘC dùng comment block `// Given` / `// When` / `// Then` (Python: `# Given/When/Then`). Cấm `// Arrange|// Act|// Assert`, `// Setup|// Execute|// Verify`, `// 1./2./3.`. Block `// When` và `// Then` luôn bắt buộc; `// Given` được phép lược nếu scenario thực sự không có precondition. Khớp 1-1 với Gherkin scenario trong test spec. Chi tiết: `conventions.md` §Testing.

## Documentation Boundaries

32. **KHÔNG sửa code mà không update spec tương ứng** — thay đổi logic → update impl spec, thay đổi behavior → update FR spec
33. **KHÔNG tạo file spec thiếu frontmatter** — mọi file `.md` trong `agent_docs/` phải có YAML frontmatter đầy đủ
34. **KHÔNG để stale cross-references** — khi rename/delete file, update tất cả `depends_on` / `referenced_by` trỏ đến file đó

---

> Các section dưới đây là **OPTIONAL theo kiến trúc dự án**. Giữ lại section áp dụng, xoá section không áp dụng. Thay placeholder `{...}` bằng giá trị thật.

## Data Isolation Boundaries

> **Áp dụng khi**: kiến trúc microservice, dùng shared DB với prefix tables (hoặc schema isolation per service).

35. **KHÔNG JOIN / SELECT cross-prefix** — mỗi service chỉ được query tables có prefix của chính mình (vd: `{serviceA_prefix}_*`, `{serviceB_prefix}_*`). ArchUnit test `haveTableAnnotationStartingWith("{service_prefix}_")` fail build nếu vi phạm. Nếu DB role chung (không có GRANT-level enforcement), **kỷ luật application-layer là duy nhất hàng rào**.
36. **KHÔNG FK cross-prefix** — entity của service A KHÔNG `@JoinColumn` sang table của service B. Reference cross-service chỉ bằng UUID ID (không FK constraint), resolve qua REST (sync) hoặc event (async).
37. **KHÔNG shared entity class cross-service** — mỗi service có aggregate/DTO riêng trong package `{base_package}.{service}.domain` và `{base_package}.{service}.api.dto`. Import cross-service package bị ArchUnit block.
38. **KHÔNG migration chạm tables của service khác** — 1 migration file chỉ được CREATE/ALTER tables có prefix match filename theo convention `V{n}__{service_prefix}_{description}.sql`. CI parse filename + nội dung để check.
39. **KHÔNG tạo table thiếu prefix service** — table không có prefix service owner = violation, reject migration trong CI.

## Eventing Boundaries

> **Áp dụng khi**: dùng event-driven (Redis Streams / Kafka / RabbitMQ) cho async communication.

40. **KHÔNG publish event trực tiếp ra broker** — luôn INSERT vào `{service}_outbox` table trong cùng DB transaction với business state, background `OutboxProcessor` mới publish ra broker. Dùng shared lib `{outbox_lib}`.
41. **KHÔNG consumer handler thiếu idempotency check** — handler PHẢI check `{service}_processed_events` trước khi xử lý, INSERT vào processed_events + business change trong cùng TX, ACK broker sau khi commit. Dùng shared lib `{idempotent_consumer_lib}`.
42. **KHÔNG rely cross-entity event ordering** — broker chỉ guarantee per-partition / per-stream FIFO; events khác partition key có thể out-of-order. Handler phải tolerate.
43. **KHÔNG skip Dead-Letter handling** — sau N retry fail (theo policy `{retry_policy}`) → publish vào DLT/DLQ + alert. KHÔNG silently ACK fail.

## API Contract Enforcement

44. **KHÔNG endpoint public thiếu authorization annotation service-level** — deny-by-default. Gateway-level auth KHÔNG đủ; mỗi endpoint phải có annotation cấp service (vd: `@PreAuthorize`, `@RequireRole`) — defense-in-depth.
45. **KHÔNG wrap success response trong envelope** (`{data: ...}`, `{code, message, data}`) — trả DTO trực tiếp. Chỉ error mới dùng error envelope chuẩn (`contracts/error-codes.md`).
46. **KHÔNG hardcode HTTP status mapping** trong handler — dùng error code enum từ shared lib `{api_error_lib}`. Mapping `code → status` quản lý tập trung tại global exception handler (`@ControllerAdvice` hoặc tương đương).
47. **KHÔNG mutation endpoint thiếu Idempotency-Key check** — POST/PUT/DELETE có side effect (vd: tạo order, submit, đăng ký) PHẢI enforce header `Idempotency-Key`; dùng filter/decorator từ shared lib `{idempotency_lib}`.
48. **KHÔNG expose endpoint internal qua public gateway** — `/internal/**` chỉ accept traffic từ internal network (K8s ClusterIP, VPC). Gateway public route chỉ `/api/v1/**`.

## Observability Boundaries

49. **KHÔNG log PII đầy đủ** — email mask (`jo***@example.com`), JWT/access token / refresh token NEVER log dưới mọi level, session ID NEVER log, mã định danh nhạy cảm (CCCD, số thẻ) NEVER log. Dùng pattern masking từ shared lib `{observability_lib}`.
50. **KHÔNG log request/response body ở production** — chỉ DEBUG level cho development. Production log: tag (service, endpoint, status code, latency) + traceId + correlation ID.
51. **KHÔNG skip request-id propagation** — inbound header `X-Request-Id` (hoặc tương đương) → log MDC → outbound header tới downstream. Generate UUID nếu inbound thiếu.

## Frontend BFF Boundaries

> **Áp dụng khi**: frontend dùng BFF pattern (Next.js route handler / NestJS BFF / proxy server) đứng giữa browser và backend gateway.

52. **KHÔNG fetch URL tuyệt đối tới backend từ Client/Server Component, hook, lib client** — mọi request PHẢI dùng path tương đối `/api/v1/...` để đi qua BFF route. BFF tự bơm `Authorization: Bearer` từ HttpOnly cookie. Vi phạm = lộ access token cho JS, mất tác dụng HttpOnly cookie.
    - ❌ `fetch("http://localhost:8080/api/v1/...")` ở `lib/`, `features/`, `hooks/`, component
    - ❌ `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/...\`)` — biến `NEXT_PUBLIC_*` lộ ra browser
    - ❌ `axios.create({ baseURL: "https://gateway..." })` ở client
    - ✅ `fetch("/api/v1/{resource}/" + id)` — relative, đi qua BFF
53. **KHÔNG đọc/ghi access token trong JavaScript** — token chỉ tồn tại trong HttpOnly cookie do BFF set. Cấm `localStorage.setItem('token', ...)`, `document.cookie = "access=..."`, lưu token vào React state. Cần biết user đã login → check session qua BFF endpoint `/api/v1/auth/me` hoặc Server Component đọc cookie server-side.
54. **KHÔNG bypass BFF cho "performance"** — streaming/SSE/WebSocket vẫn proxy qua BFF route handler riêng (`runtime=nodejs` cho long-running). KHÔNG mở connection thẳng từ browser tới backend.
55. **Ngoại lệ duy nhất**: file BFF proxy `{bff_proxy_path}` (vd: `projects/app-*/src/app/api/**/route.ts`) được phép `fetch(gatewayBaseUrl() + ...)` vì chính nó là server-side BFF. Test files (`**/__tests__/**`, `*.test.*`, `*.spec.*`) cũng được phép vì dùng MSW/mock.
    - **Enforcement**: PreToolUse hook chặn cứng `Edit/Write/MultiEdit` nếu nội dung mới trong frontend source (trừ ngoại lệ) chứa `fetch(...)` với URL tuyệt đối `http(s)://`.

## Tech Stack Invariants

> **Tuỳ stack dự án**, điền version cố định + build tool. Mọi rule dưới đây áp dụng project-wide.

56. **KHÔNG downgrade language version** — `{language_version}` (vd: Java 21 LTS, Node 20 LTS) là mandatory. Liệt kê trong `project-overview.md`.
57. **KHÔNG dùng build tool khác chuẩn dự án** — build tool thống nhất: `{build_tool}` (vd: Gradle 8.x Groovy DSL, pnpm workspaces, Poetry). KHÔNG mix Maven/Gradle, npm/pnpm/yarn trong cùng monorepo.
58. **KHÔNG tự cấu hình toolchain ở subproject** — subproject phải apply convention plugin / preset chung (`{convention_plugin}`) — KHÔNG tự config Java toolchain, linter, formatter, ArchUnit riêng.
59. **KHÔNG disable schema-drift validation** (vd: Flyway `validate`, Liquibase `validateOnMigrate`) — schema drift phải phát hiện sớm.

---

## Thêm rules cho dự án cụ thể bên dưới

<!-- TODO: Thêm hard boundaries riêng cho dự án (vd: ràng buộc nghiệp vụ, regulatory, integration với hệ thống legacy) -->

---

**Enforcement**: ArchUnit/equivalent tests trong CI + DB role grant test (nếu có) + PreToolUse hooks (`{hooks_path}`) + code review checklist.

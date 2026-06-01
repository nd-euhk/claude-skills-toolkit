---
title: "Spec Boundaries — Matrix phân vai cho tech-design / impl-spec / migration-spec / test-spec / source code"
status: active
last_updated: {{date}}
updated_by: {{author}}
---

# Spec Boundaries

> **Vấn đề đang giải**: khi tech-design, impl-spec và code cùng mô tả nội dung
> ở mức chi tiết gần nhau, ta tạo ra 3 bản "sự thật" song song. Một bên thay
> đổi, hai bên kia drift. Rule dưới đây cố định ranh giới để mỗi artifact có
> vai trò duy nhất và không chồng lấn.

## 1. Matrix vai trò

| Artifact | Trả lời câu hỏi | CHỨA | KHÔNG chứa |
|---|---|---|---|
| `tech-design/{service}-service.md` | Service này **thiết kế thế nào** (service-level, stable) | Pattern, boundary, transaction model, error taxonomy, retry/cache/scale policy, ADR references | Feature-specific flow, acceptance, field list copy từ OpenAPI |
| `backend/{service}/implementation/FR-*-impl.md` | Feature này **chạm đâu, flow gì, rule gì, accept gì** (feature-level) | Purpose, references, affected areas, execution flow, business rules, data impact, error mapping, security, acceptance | `package`/`import`, annotation đầy đủ, method body, full SQL, class skeleton, field list trùng OpenAPI |
| `backend/{service}/migrations/{V..}.md` | Schema thay đổi **chính xác ra sao** | Forward SQL, rollback plan, data impact, downtime note, execution order | Business logic, controller flow |
| `backend/{service}/test-specs/FR-*-test.md` | **Verify** bằng cách nào | Test cases (Given/When/Then), fixtures, edge cases, contract tests | Implementation detail, code từ impl spec |
| Source code | Cài đặt **chính xác** ra sao | Class, annotation, import, method body, concrete SQL call | Business requirement narrative |
| `contracts/api-*.yaml` | Shape của API (source of truth cho request/response) | Field list, type, constraint, status codes | — |

## 2. Rule cứng khi viết spec

### R-1. Không duplicate shape data
Nếu một field list / schema đã tồn tại ở `contracts/*.yaml` hoặc tech-design:
- **Tech-design** mô tả bằng bảng `field | type | constraint`, KHÔNG Java/TS class.
- **Impl-spec** CHỈ reference tới OpenAPI `operationId` hoặc tech-design §.
- Không copy-paste lại trong file khác.

### R-2. Code-shape snippet có giới hạn
Trong tech-design và impl-spec:
- Snippet ≤ **10 dòng**, và CHỈ khi minh hoạ contract shape hoặc mapping khó.
- Phải gắn nhãn `illustrative, not source of truth`.
- Không `package`, không `import`, không annotation đầy đủ, không method body.

### R-3. SQL chỉ sống ở một nơi
- Full `CREATE TABLE`, `ALTER`, `INDEX` chỉ nằm trong **migration-spec**.
- Impl-spec chọn 1 trong 3 dạng `Schema impact`:
  - `No schema change`
  - `See migration spec: {path}`
  - Inline note cực ngắn + link migration spec

### R-4. "Area" thay vì "file path cứng"
Impl-spec mô tả **trách nhiệm logic** (`domain.{aggregate}`, `application.{feature}`),
không ép tên class cứng. Source code quyết định tên file/class chính xác.
Điều này tránh drift khi refactor đổi tên class nhưng quên đồng bộ spec.

### R-5. Rule dùng ID, không lặp nội dung
Business rule đã phát biểu ở FR hoặc tech-design → impl-spec chỉ trỏ `BR-NNN`
+ `enforcement point`. Không copy mô tả đầy đủ.

### R-6. "Execution Flow" không phải "Task Breakdown"
Impl-spec mô tả **flow hành vi** (1 câu/bước, không annotation).
Task breakdown dạng code block (`@PreAuthorize`, `@Transactional`, `@Valid`…)
là **anti-pattern** — thuộc về source code.

### R-7. Spec tối ưu cho review quyết định, không phải copy-paste
Tiêu chí tự-kiểm: nếu xoá file spec đi, một senior dev đọc source code có thể
dựng lại toàn bộ spec trong 5 phút? Nếu có → spec đang làm đúng vai trò
(capture **quyết định + ràng buộc**, không capture **cài đặt**).

## 3. Self-check trước khi merge spec

Trước khi PR spec, tự check:

- [ ] Không có `package ` / `import ` trong file spec.
- [ ] Không có method body (dấu hiệu: nhiều hơn 1 cặp `{}` lồng nhau trong code block).
- [ ] Không có full `CREATE TABLE` ở ngoài migration-spec.
- [ ] Field list không trùng với OpenAPI (dùng reference thay vì copy).
- [ ] Mỗi "area" mô tả trách nhiệm, không ép tên class cứng.
- [ ] Business rule dùng ID + enforcement point, không mô tả dài.
- [ ] Tổng độ dài ≤ ~150 dòng (context budget).

## 4. Khi phát hiện drift

Nếu tìm thấy spec có code compile-ready hoặc duplicate shape:

1. Xác định artifact nào là **source of truth** (theo matrix §1).
2. Xoá bản trùng ở artifact sai vai, thay bằng reference.
3. Ghi changelog: `Fixed: remove duplicate {X} from {artifact}, now references {source}`.
4. Nếu drift đã gây hiểu nhầm → tạo ADR hoặc note ở `incidents/`.

## 5. Phạm vi áp dụng

Rule này áp cho mọi spec trong `agent_docs/`:
- `tech-design/*`
- `backend/*/implementation/*`, `backend/*/test-specs/*`, `backend/*/migrations/*`
- `frontend/*/implementation/*`, `frontend/*/test-specs/*`

Feature spec (`features/FR-*.md`) KHÔNG bị ràng buộc rule R-1..R-3 vì nó là
tài liệu business-facing, được phép mô tả behavior ở mức cao mà không cần
reference kỹ thuật.

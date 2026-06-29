---
title: "Coding Conventions"
status: current
created: { { date } }
last_updated: { { date } }
updated_by: "{{author}}"
depends_on:
  - hard-boundaries.md
referenced_by:
  - README.md
changelog:
  - 1.0 | {{date}} | Initial conventions
---

# Coding Conventions

## Backend ({{backend_language}} / {{backend_framework}})

### Package Structure

```
com.{{company}}.{{project}}.{service}/
├── domain/          # Business logic (core)
│   ├── model/       # Entities, Value Objects, Enums
│   ├── repository/  # Data access interfaces
│   └── service/     # Business rules, orchestration
├── api/             # Driving layer (controllers, DTOs, mappers)
│   └── {feature}/
│       ├── {Feature}Controller.java
│       ├── dto/
│       └── mapper/
├── integration/     # Driven layer (external clients)
│   └── {target}/
│       ├── {Target}Client.java
│       └── {Target}ClientConfig.java
├── common/          # Cross-cutting (exception, response)
└── config/          # Configuration
```

### Naming

| Type        | Convention                            | Example                              |
| ----------- | ------------------------------------- | ------------------------------------ |
| Entity      | PascalCase, singular                  | `{{example_entity}}`                 |
| Repository  | `{Entity}Repository`                  | `{{example_entity}}Repository`       |
| Service     | `{Feature}Service`                    | `{{example_feature}}Service`         |
| Controller  | `{Feature}Controller`                 | `{{example_feature}}Controller`      |
| DTO         | `{Feature}Request/Response`           | `Submit{{example_feature}}Request`   |
| Migration   | `V{NNN}__{description}.sql`           | `V001__create_{{example_table}}.sql` |
| Test        | `{Class}Test`                         | `{{example_feature}}ServiceTest`     |
| Test method | `methodName_condition_expectedResult` | `submit_invalidInput_returns400`     |

### Response Format

**Success (2xx)** — trả DTO trực tiếp, KHÔNG wrap trong `{code, message, data}` envelope (theo ADR-002 & hard-boundary #API-RESP):

```json
// GET /api/v1/book-titles/{id}
{ "id": "01902f34-...", "title": "Clean Architecture", "availableCopies": 1 }
```

List response: `{ "items": [...], "page", "size", "totalElements", "totalPages", "hasNext" }` ở root level.

**Error (4xx/5xx)** — envelope chuẩn với business code:

```json
{
  "code": "COPY_ALREADY_BORROWED",
  "message": "Bản sách này đã được người khác mượn.",
  "details": { "copyId": "01902f34-..." },
  "traceId": "01902f34-abcd-..."
}
```

- `code`: UPPER_SNAKE_CASE business code — registry tại [`contracts/error-codes.md`](contracts/error-codes.md).
- KHÔNG dùng `{code:"00"|"99"}` hoặc HTTP status string làm `code`.

## Frontend ({{frontend_framework}} / {{frontend_language}})

### File Naming

- Files/folders: `kebab-case`
- Components: `PascalCase`
- Path alias: `@/` → `src/`
- Feature-private: prefix `_` (`_components/`, `_hooks/`)

### Component Pattern

<!-- TODO: Điền component pattern phù hợp với framework -->

## Git

- Convention: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `migration`, `spec`, `chore`, `docs`
- Branch: `agent/{FR-ID}` (agent), `feat/{slug}` (human), `fix/{slug}` (bugfix)

## Testing — BẮT BUỘC

### Cấu trúc test method (mandatory, no exception)

Mọi test (unit, component, controller, repository, integration, e2e) PHẢI dùng comment block **Given / When / Then**. Đây là quy ước cố định toàn project — agent và developer KHÔNG được tự ý đổi sang Arrange/Act/Assert hoặc biến thể khác.

| Block | Mục đích | Bắt buộc? |
|-------|----------|-----------|
| `// Given` (`# Given` cho Python) | Precondition: input, mocks, fixtures, state setup | Có (bỏ chỉ khi scenario thực sự không có precondition) |
| `// When` | Hành động duy nhất đang test | **BẮT BUỘC** |
| `// Then` | Assertion cụ thể về kết quả quan sát được | **BẮT BUỘC** |

Mỗi block Given/When/Then trong code phải khớp 1-1 với Gherkin scenario trong test spec (`backend/{svc}/test-specs/`). Nếu test spec có Given X / When Y / Then Z, code phải có đúng 3 block tương ứng.

### Cấm

- ❌ `// Arrange / // Act / // Assert` (AAA)
- ❌ `// Setup / // Execute / // Verify`
- ❌ `// 1. ... / // 2. ... / // 3. ...`
- ❌ Test method không có comment phân tách block

### Ví dụ chuẩn

**Java (JUnit 5)**
```java
@Test
void submitPrediction_deadlinePassed_returns403() {
  // Given: prediction window đã đóng
  var match = matchFixture.withDeadline(Instant.now().minusSeconds(60));
  // When: user submit prediction
  var ex = assertThrows(ForbiddenException.class,
      () -> service.submit(userId, match.id(), 2, 1));
  // Then: lỗi DEADLINE_PASSED
  assertEquals("DEADLINE_PASSED", ex.getCode());
}
```

**TypeScript (Vitest)**
```ts
it('submits form and shows success toast', async () => {
  // Given: form rendered với onSuccess callback
  const onSuccess = vi.fn();
  render(<Form onSuccess={onSuccess} />);
  // When: user submit form hợp lệ
  await user.click(screen.getByRole('button', { name: /submit/i }));
  // Then: callback được gọi
  await waitFor(() => expect(onSuccess).toHaveBeenCalled());
});
```

**Python (pytest)**
```python
def test_submit_prediction_deadline_passed_returns_403():
    # Given: deadline đã qua
    match = make_match(deadline=now() - timedelta(minutes=1))
    # When: submit prediction
    with pytest.raises(ForbiddenError) as exc:
        service.submit(user_id, match.id, 2, 1)
    # Then: lỗi DEADLINE_PASSED
    assert exc.value.code == "DEADLINE_PASSED"
```

### Naming

Test method giữ convention `methodName_condition_expectedResult()` — không thay bằng BDD-style `should_…` (nameing độc lập với cấu trúc Given/When/Then trong body).

### Gate

CI / code review fail nếu test method:
- Thiếu comment `// When` hoặc `// Then`.
- Dùng Arrange/Act/Assert hoặc biến thể.
- Trộn nhiều "When" trong một test (1 test = 1 hành động).

## Database

- Table/column: `snake_case`
- Index: `idx_{table}_{columns}`
- Foreign key: `fk_{table}_{ref_table}`
- Migration: `V{NNN}__{description}.sql`

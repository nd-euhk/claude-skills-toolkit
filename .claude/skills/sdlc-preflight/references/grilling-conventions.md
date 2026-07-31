# Grilling: conventions.md

Template: `.claude/templates/supporting/conventions-TEMPLATE.md`

> Gộp/tách decision đã được xác định TRƯỚC KHI vào file này
> (xem SKILL.md → "Conventions: Logic Gộp / Tách").
> File này chỉ chứa procedure phỏng vấn nội dung sau khi đã có decision.

## Nếu GỘP 1 file

Template có sẵn defaults. Hỏi human muốn giữ nguyên hay tùy chỉnh:

### Backend
1. **Package Structure**: Giữ `domain/api/integration/common/config` hay đổi?
2. **Naming**: Entity/Repo/Service/Controller/DTO conventions — giữ nguyên?
3. **Response Format**: Success (trả DTO trực tiếp) + Error (envelope business code) — OK?

### Frontend
4. **File Naming**: `kebab-case` files/folders, `PascalCase` components — OK?
5. **Component Pattern**: Pattern gì? (có thể skip, để IMP quyết định sau)

### Shared
6. **Git Convention**: `type(scope): description` — OK? Branch naming?
7. **Testing**: Given/When/Then mandatory — OK? Có điều chỉnh gì?
8. **Database**: `snake_case`, Flyway migration `V{NNN}__{desc}.sql` — OK?

## Nếu TÁCH theo stack (3+ services, khác stack)

Mỗi backend stack có conventions riêng — hỏi từng stack một:

- `backend/{stack}/conventions.md` — một file cho mỗi backend stack
  (vd `backend/java/conventions.md`, `backend/go/conventions.md`)
- Với mỗi stack, hỏi Package Structure, Naming, Response Format, Database
  (bộ câu tương ứng trong mục **Nếu GỘP 1 file**)

**Shared + Frontend** — tùy kịch bản:
- Git + Testing (Given/When/Then) → `conventions.md`
- Có FE team riêng → FE tách `frontend/conventions.md` (File Naming, Component Pattern, a11y)
- Không có FE riêng → FE section nằm chung trong `conventions.md`

## Nếu TÁCH FE riêng (BE + Shared gộp 1 file)

1. **`conventions.md`** — BE + Shared: Package Structure, Naming, Response Format, Database, Git, Testing
2. **`frontend/conventions.md`** — FE: File Naming, Component Pattern, a11y

Hỏi từng file riêng, mỗi file theo thứ tự section trong template.

## Tổng hợp sau grilling

```
## Grilling Results: conventions.md
### Decision: <Gộp 1 file / Tách theo stack / Tách FE riêng>
### Backend: ... (lặp cho từng stack nếu tách theo stack)
### Frontend: ...
### Shared: ...
```

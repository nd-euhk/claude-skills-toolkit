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

## Nếu TÁCH 3 file

1. **Shared** (`conventions.md`): Git, branch naming, cross-cutting rules
2. **Backend** (`backend/conventions.md`): Package structure, naming, response format, DB
3. **Frontend** (`frontend/conventions.md`): File naming, component pattern, a11y

Hỏi từng file riêng, mỗi file theo thứ tự section trong template.

## Tổng hợp sau grilling

```
## Grilling Results: conventions.md
### Decision: <Gộp / Tách>
### Backend: ...
### Frontend: ...
### Shared: ...
```

# Grilling: user-context.md

Template: `.claude/templates/supporting/user-context-TEMPLATE.md`
4 section: Personas → User Journeys → Communication → A11y.

## Context check (trước khi hỏi)

- Conversation có URD hoặc user research? → extract, chỉ hỏi thiếu
- Đã có `project-overview.md`? → dùng Glossary, Stakeholders từ đó

## Câu hỏi từng section

### 1. User Personas
> "Ai sẽ dùng hệ thống này? Mỗi persona: Role, Pain points/Goals, Hành vi chính."

Với mỗi persona, hỏi: Role? Vấn đề/nỗi đau? Làm gì mỗi ngày với hệ thống?
Hỏi "còn persona nào không?" đến khi human nói "hết".

### 2. User Journeys (Critical Paths)
> "Hành trình người dùng quan trọng nhất? Mô tả từng bước từ đầu đến cuối."

Với mỗi journey: Tên → từng bước (màn hình → thao tác → kết quả).
Hỏi ít nhất 1-2 paths. "Còn journey quan trọng nào không?"

### 3. Communication & Tone of Voice
> "Ngôn ngữ (tiếng Việt/Anh)? Giọng văn (chuyên nghiệp/thân thiện/ngắn gọn)?"

### 4. Accessibility & Support (A11y)
> "Mobile/Desktop ưu tiên? Screen reader? Light/Dark mode? Load time target?"
Hỏi từng sub-item.

## Tổng hợp sau grilling

```
## Grilling Results: user-context.md
### Personas
| Persona | Role | Pain points | Hành vi |
|---------|------|-------------|---------|

### User Journeys
#### Path 1: <tên>
1. ...
2. ...

### Communication
- Ngôn ngữ: ...
- Giọng văn: ...

### A11y
- ...
```

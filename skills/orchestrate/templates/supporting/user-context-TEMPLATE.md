---
title: "User Context — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on: []
referenced_by:
  - agent-routing.md
changelog:
  - 1.0 | {{date}} | Initial version
---

# User Context

> **Mục đích**: Cung cấp insight cho AI Agent hiểu rõ người dùng là ai, vấn đề họ đang gặp phải, và hành trình sử dụng.
> **Nguồn (URD)**: Tóm tắt từ User Research / Business Requirements.

## 1. User Personas

| Persona | Role | Pain points / Goals | Hành vi chính |
|---------|------|---------------------|---------------|
| **{{Persona 1}}** | {{Role}} | Cần giải quyết {{Vấn đề}} | Thực hiện {{Hành động}} mỗi ngày |
| **{{Persona 2}}** | {{Role}} | Nhức nhối vì {{Pain point}} | Dùng hệ thống để {{Mục tiêu}} |

## 2. User Journeys (Critical Paths)

Mô tả các chuỗi thao tác chính yếu nhất đem lại giá trị. AI Agent khi implement hoặc test UI phải focus vào trải nghiệm mượt mà dọc theo các path này.

### Path 1: {{Tên hành trình chính - vd: Onboarding}}
1. User truy cập màn hình {{Màn hình A}}
2. Điền thông tin {{Trường X, Trường Y}}
3. Chuyển sang bước {{Màn hình B}}, nhận thông báo {{Message}}
4. Bắt đầu dùng {{Feature Z}}

### Path 2: {{Tên hành trình chính - vd: Checkout}}
1. ...
2. ...

## 3. Communication & Tone of Voice

- **Ngôn ngữ**: {{Tiếng Việt / English / Đa ngôn ngữ}}
- **Giọng văn**: {{Chuyên nghiệp, thân thiện, ngắn gọn, v.v.}}
- **Thuật ngữ (Glossary)**: Tương đồng với Project Overview Glossary, tập trung vào từ định dạng UI.

## 4. Accessibility & Support (A11y)

| Requirement | Chi tiết |
|-------------|----------|
| Màn hình | Ưu tiên Mobile / Desktop / Responsive |
| Screen reader | Có cần ARIAs sâu không? |
| Chế độ màu | Light/Dark mode |
| Tốc độ | Yêu cầu load time Dưới {{X}} giây vì user dùng mạng 3G/4G |

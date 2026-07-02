# Grilling: project-overview.md

Template: `.claude/templates/supporting/project-overview-TEMPLATE.md`
11 section: What → Why → For Whom → Scope → NFRs → Glossary → Tech Stack →
Architecture → Business Rules → Stakeholders → Communication.

## Context check (trước khi hỏi)

- Conversation có BRD hoặc mô tả dự án? → extract, chỉ hỏi section thiếu
- Đã có `agent_docs/architecture.md`? → dùng cho section 8
- Nếu chưa có gì → phỏng vấn tuần tự từ section 1

## Câu hỏi từng section

### 1. What
> "Hệ thống này làm gì? (1-2 câu)"

### 2. Why
> "Giải quyết vấn đề kinh doanh gì?"

### 3. For Whom
> "Ai là người dùng chính? Họ muốn đạt được gì?"

### 4. Scope & Boundaries
> "Trong phạm vi phase này: In-Scope (gì được làm) và Out-of-Scope (gì KHÔNG làm)?"
Hỏi In-Scope trước, Out-of-Scope sau.

### 5. Non-Functional Requirements
> "Performance (latency, CCU), Availability (uptime %), Security (compliance), Data privacy?"
Gợi ý defaults: latency <200ms, 99.9% uptime, ISO 27001.

### 6. Glossary / Domain Terms
> "Thuật ngữ domain nào agent cần hiểu đúng?"
Mỗi term: Term + Định nghĩa + Ví dụ. Hỏi "còn term nào không?" đến khi human nói "hết".

### 7. Tech Stack
> "Backend (Java/Spring?), Frontend (Next.js?), Infra (Docker/K8s)?"
Default gợi ý: Java 21, Spring Boot 4, PostgreSQL 17, Next.js 15, TypeScript.

### 8. Architecture Style
> "Monolith, Microservices, hay Modular Monolith?"
Nếu context đã có số service → suggest phù hợp.

### 9. Key Business Rules
> "Quy tắc kinh doanh cốt lõi? (vd: 'không xóa mềm user có giao dịch')"
Hỏi từng rule, loop đến khi hết.

### 10. Stakeholders
> "PO, Tech Lead, DevOps? (có thể để trống)"

### 11. Communication Channels
> "Slack, Jira, Wiki? (có thể để trống)"

## Tổng hợp sau grilling

```
## Grilling Results: project-overview.md
### What: <kết quả>
### Why: <kết quả>
### For Whom: <kết quả>
... (tất cả section đã hỏi)
```

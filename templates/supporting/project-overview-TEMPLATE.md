---
title: "Project Overview — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on: []
referenced_by:
  - architecture.md
changelog:
  - 1.1 | {{date}} | Expanded to include Scope, NFRs, Glossary, Stakeholders
  - 1.0 | {{date}} | Condensed from BRD
---

# Project Overview

## 1. What
{{1-2 sentences: what the system does}}

## 2. Why
{{1-2 sentences: business problem it solves}}

## 3. For Whom
{{Primary users and their goals}}

## 4. Scope & Boundaries
- **In-Scope**:
  - {{Tính năng 1 nằm trong phạm vi}}
  - {{Tính năng 2 nằm trong phạm vi}}
- **Out-of-Scope**:
  - {{Tính năng KHÔNG làm trong phase này}}
  - {{Hệ thống KHÔNG được tích hợp}}

## 5. Non-Functional Requirements (NFRs)
- **Performance**: {{Latency < 200ms, Support 10,000 CCU, v.v.}}
- **Availability**: {{99.9% uptime}}
- **Security**: {{Tuân thủ ISO 27001 / PCI-DSS / Bắt buộc MFA}}
- **Compliance**: {{GDPR / PDPA data privacy}}

## 6. Glossary / Domain Terms
> Agent cần hiểu chính xác các thuật ngữ này để code đúng business logic.

| Term | Nghĩa (Definition) | Ví dụ (Example) |
|------|--------------------|-----------------|
| **{{Term_1}}** | {{Định nghĩa rõ ràng}} | {{Ví dụ}} |
| **{{Term_2}}** | {{Định nghĩa rõ ràng}} | {{Ví dụ}} |

## 7. Tech Stack
- **Backend**: Java 21, Spring Boot 4.x, PostgreSQL 17
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Infra**: Docker Compose (dev), K8s (staging/prod)

## 8. Architecture Style
{{Monolith / Microservices / Modular Monolith}} — See `architecture.md`

## 9. Key Business Rules
1. {{Quy tắc cốt lõi 1, ví dụ: Không được xoá mềm user có giao dịch}}
2. {{Quy tắc cốt lõi 2}}

## 10. Stakeholders & Contacts
- **Product Owner (PO)**: {{Name/Email}} — Quyết định business logic
- **Tech Lead**: {{Name/Email}} — Quyết định architecture
- **DevOps**: {{Name/Email}} — Hỗ trợ infra / CI/CD

## 11. Communication Channels
- **Slack/Teams**: {{Channel link}}
- **Jira/Trello**: {{Board link}}
- **Wiki/Confluence**: {{Confluence link}}

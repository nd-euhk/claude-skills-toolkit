---
title: "Project Roadmap — {{project_name}}"
status: active
created: {{date}}
last_updated: {{date}}
updated_by: "{{product_owner}}"
depends_on:
  - architecture.md
referenced_by:
  - ../.work/backlog.md
  - ../.work/board.md
changelog:
  - "1.0 | {{date}} | Created Baseline Roadmap"
---

# Project Roadmap — {{project_name}}

> **Project Vision**: {{1-2 câu mô tả mục tiêu tối thượng của dự án, giúp Agent hiểu context sâu hơn để code đúng định hướng}}
> **Current Phase**: Phase {{N}} - {{Tên Phase}}

---

## High-Level Phases / Milestones

| Phase | Milestone Name | Timeline Target | Key Objective | Status |
|-------|----------------|-----------------|---------------|--------|
| **Phase 1** | MVP Foundation | {{MM/YYYY}} | {{Setup base, Auth, Core API}} | 🚧 In Progress |
| **Phase 2** | Core Features | {{MM/YYYY}} | {{Tích hợp luồng nghiệp vụ chính}} | 🔲 Todo |
| **Phase 3** | Scale & Optimize| {{MM/YYYY}} | {{Performance, Cache, Analytics}} | 🔲 Todo |

---

## Epics Tracking (Map to Backlog Features)

> Epic quản lý các cụm tính năng lớn (Features). Các Features cụ thể sẽ được break down trong `backlog.md`.

| Epic ID | Epic Name | Description | Phase | Lead / Owner | Status | Success Metrics |
|---------|-----------|-------------|-------|--------------|--------|-----------------|
| EPIC-001 | User Identity & Auth | {{Đăng nhập, đăng ký, JWT, RBAC}} | Phase 1 | {{name}} | 🚧 In Progress | User login < 2s |
| EPIC-002 | {{Tên Epic}} | {{Mô tả}} | Phase {{N}}| {{name}} | 🔲 Todo | {{Metric}} |
| EPIC-003 | {{Tên Epic}} | {{Mô tả}} | Phase {{N}}| {{name}} | ✅ Done | {{Metric}} |

---

## Core Tech Stack & Global Constraints

> **Agent Instructions:** Các quy định kỹ thuật bất biến. Agent PHẢI tuân thủ các quy định này trong suốt quá trình triển khai Epics.

*   **Frontend**: {{React/Next.js, TailwindCSS}}
*   **Backend**: {{Node.js/NestJS, PostgreSQL}}
*   **Infrastructure**: {{Docker, AWS}}
*   **Code Style Constraints**:
    *   {{Ví dụ: Luôn sử dụng TypeScript strict mode}}
    *   {{Ví dụ: API Responses phải bọc trong chuẩn `{ data, message, status }`}}
    *   {{Ví dụ: Không sử dụng thư viện X, thay vào đó dùng thư viện Y}}

---

## Dependencies & External Integrations

| System / API | Provider | Purpose | Status | Documentation Link |
|--------------|----------|---------|--------|--------------------|
| Auth Provider | Auth0 | Quản lý Identity | ✅ Done | `https://auth0.com/docs` |
| Payment Gateway| Stripe | Thanh toán đơn hàng | 🔲 Todo | `docs/stripe.md` |

---

## Feature → Phase Mapping

> Map mỗi Feature ID về Phase/Sprint chứa nó. Giúp trace ngược từ feature → khi nào nó được implement.

| Feature ID | Epic | Phase | Sprint | Status |
|-----------|------|-------|--------|--------|
| FEAT-{{NNN}} | EPIC-{{NNN}} | Phase {{N}} | Sprint {{N}} | 🔲 Todo |
| FEAT-{{NNN}} | EPIC-{{NNN}} | Phase {{N}} | Sprint {{N}} | 🚧 In Progress |
| FEAT-{{NNN}} | EPIC-{{NNN}} | Phase {{N}} | Sprint {{N}} | ✅ Done |

---

## Dependencies Between Phases

> Vẽ dependency graph giữa các phase. Xác định critical path (chuỗi dài nhất không thể song song).

```
Phase 1 ({{Name}})
  └──→ Phase 2 ({{Name}})
         ├──→ Phase 3 ({{Name}}) ← {{lý do phụ thuộc}}
         │      └──→ Phase N ({{Name}})
         └──→ Phase N ({{Name}}) ← {{lý do phụ thuộc}}
```

**Critical path**: {{Phase 1}} → {{Phase 2}} → {{...}} → {{Phase N}}

---

## Rollback Plan

> Kịch bản rủi ro và action tương ứng. Mỗi scenario phải có action cụ thể + SLA.

| Scenario | Impact | Action | SLA |
|----------|--------|--------|-----|
| {{Mô tả scenario}} | {{Mức độ ảnh hưởng}} | {{Action cụ thể}} | {{Thời gian xử lý}} |
| {{Mô tả scenario}} | {{Mức độ ảnh hưởng}} | {{Action cụ thể}} | {{Thời gian xử lý}} |

---

## Status Conventions

| Status | Description |
|--------|-------------|
| 🔲 Todo | Not started |
| 🚧 In Progress | Active ({{N}}/{{M}} features) |
| ✅ Done | Completed + verified |
| ⛔ Blocked | Blocked (reason in backlog/board) |

---
title: "Service-Feature Matrix"
status: current
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"

depends_on:
  - tech-design/README.md

referenced_by:
  - README.md
  - features/README.md

changelog:
  - 1.0 | {{date}} | Initial matrix
---

# Service-Feature Matrix

> **Context budget**: ~100 dòng. Load khi cần tra cứu service → feature mapping.

> **Mục đích**: Agent đọc file này để biết ngay feature nào thuộc service nào, API nào, port nào.
>
> **Cập nhật**: Mỗi khi thêm feature mới hoặc thêm internal API.
>
> **Ai dùng**: Backend agent (tìm service), Frontend agent (tìm API), Human reviewer (verify boundary).

## Quick Lookup

| Service | Port | DB Tables Owned | Feature Count | FRs |
|---------|------|----------------|---------------|-----|
| auth-service | 8081 | {{tables}} | {{N}} | FR-AUTH-001 → {{N}} |
| {{name}}-service | {{port}} | {{tables}} | {{N}} | FR-{{DOM}}-001 → {{N}} |

## Service Details

### {{name}}-service (port {{XXXX}})

**Responsibility**: {1 câu mô tả trách nhiệm chính}

**Features:**

| FR ID | Feature | API Endpoint | Type |
|-------|---------|-------------|------|
| FR-{{DOM}}-001 | {Feature name} | {METHOD /path} | Exposed |
| FR-{{DOM}}-002 | {Feature name} | {METHOD /path} | Exposed |
| — | {Internal capability} | {METHOD /internal/path} | Internal |

**Dependencies (calls to):**

| Target Service | API | Purpose | Failure Mode |
|---------------|-----|---------|-------------|
| {{other}}-service | GET /internal/{{resource}} | {{reason}} | {fallback strategy} |

**Called by:**

| Calling Service | API | Purpose |
|----------------|-----|---------|
| {{other}}-service | GET /internal/{{resource}} | {{reason}} |

---

*(Repeat "### {{name}}-service" block for each service)*

---

## Service Communication Map

```
                    ┌─────────────┐
                    │   Gateway   │ (port 8080)
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌─────────────┐ ┌──────────┐ ┌────────────┐
     │   service1  │ │ service2 │ │  service3  │
     │   :{{port}}   │ │  :{{port}} │ │  :{{port}}   │
     └─────────────┘ └────┬─────┘ └─────┬──────┘
                          │              │
                    calls ▼        calls ▼
               ┌──────────────┐  ┌──────────┐
               │   service4   │  │ service2  │
               │   :{{port}}    │  │  :{{port}}  │
               └──────────────┘  └──────────┘
```

## Internal API Registry

> `/internal/*` endpoints: service-to-service only, NOT exposed via Gateway.

| Internal Endpoint | Provider | Consumer(s) | Contract |
|------------------|----------|-------------|----------|
| GET /internal/{{resource}}/{{id}} | {{provider}}-service | {{consumer}}-service | api-{{domain}}.yaml |

## API Gateway Route Table

> Gateway (port 8080) routes requests to backend services.

| Route Pattern | Target Service | Auth Required |
|--------------|---------------|---------------|
| /api/v1/auth/** | auth-service:8081 | No (public) |
| /api/v1/{{domain}}/** | {{name}}-service:{{port}} | Yes |
| /internal/** | — (blocked) | N/A — not routable |

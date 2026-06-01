---
title: "Service-to-Service Events"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - ../architecture.md
  - ../tech-design/cross-cutting.md
referenced_by:
  - ../backend/*/implementation/*.md
  - ../tech-design/*.md
changelog:
  - 1.0 | {{date}} | Initial events definition
---

# Service-to-Service Events

> **Mục đích**: Define tất cả async communication giữa các services.
> Agent đọc file này biết service nào publish/subscribe event nào.

> **Chi tiết kỹ thuật** (Kafka config, producer/consumer patterns, DLT, schema evolution):
> Xem `agent_docs/_template/event-schema-TEMPLATE.md` hoặc tạo file domain-specific
> `agent_docs/tech-design/{service}-events.md` từ template đó.

---

## 1. Event Flow Overview

```
┌──────────────┐    event     ┌──────────────┐
│  Service A   │─────────────▶│  Service B   │
│  (Producer)  │              │  (Consumer)  │
└──────────────┘              └──────────────┘
```

> Thay diagram trên bằng flow thực tế của dự án.

---

## 2. Event Registry

### Naming Convention
```
{company}.{domain}.{entity}.{event_type}

Ví dụ:
  acme.auth.user.registered
  acme.order.payment.completed
  acme.notification.email.sent
```

### Event Catalog

| Event Type | Producer | Consumer(s) | Trigger | Payload Summary |
|-----------|----------|-------------|---------|-----------------|
| {{company}}.{{domain}}.{{entity}}.created | {{service}}-service | {{consumer}} | Khi {{entity}} được tạo | id, fields, createdAt |
| {{company}}.{{domain}}.{{entity}}.updated | {{service}}-service | {{consumer}} | Khi {{entity}} được sửa | id, changes, updatedAt |
| {{company}}.{{domain}}.{{entity}}.deleted | {{service}}-service | {{consumer}} | Khi {{entity}} bị xóa | id, deletedAt, reason |

---

## 3. Event Envelope (Standard Format)

Mọi event PHẢI tuân theo format này:

```json
{
  "eventId": "uuid-v7",
  "eventType": "{domain}.{entity}.{action}",
  "eventVersion": "1.0",
  "timestamp": "ISO-8601",
  "source": "{service}-service",
  "correlationId": "uuid",
  "partitionKey": "{entityId}",
  "data": { },
  "metadata": {
    "userId": "uuid",
    "traceId": "OpenTelemetry trace ID"
  }
}
```

---

## 4. Service Communication Matrix

| From | To | Event | Sync/Async | Purpose |
|------|----|-------|-----------|---------|
| {{service-a}} | {{service-b}} | {{entity}}.created | Async (Kafka) | {{purpose}} |

---

## 5. Quy tắc

1. **Event = fact đã xảy ra** — dùng past tense: `created`, `completed`, `failed`
2. **Idempotent consumer** — mọi consumer PHẢI handle duplicate events
3. **Backward compatible** — chỉ thêm optional fields, KHÔNG xóa/rename fields
4. **Breaking change** — bump `eventVersion`, dual-write trong transition period
5. **Guaranteed delivery** — dùng Transactional Outbox pattern cho critical events
6. **Dead Letter Topic** — mọi consumer PHẢI có DLT strategy

---

## 6. Failure Scenarios

| Scenario | Handling |
|----------|----------|
| Consumer down | Kafka retains messages — consumer catches up khi recover |
| Processing failure | Retry 3 lần → Dead Letter Topic |
| Duplicate event | Idempotency check bằng `eventId` |
| Schema mismatch | Consumer ignore unknown fields (forward compatibility) |
| Kafka cluster down | Producer fallback: outbox table → retry khi Kafka recover |

---
adr_id: ADR-003
domain: AUTH
title: Event Taxonomy for Authentication Domain Events
status: accepted
version: 1.0.0
---

# ADR-003: Event Taxonomy

## Context

The auth service needs to emit domain events for cross-cutting concerns: audit logging, notification triggers (welcome emails, security alerts), analytics, and potential downstream service integration (e.g., user profile service needs to know when a user registers).

## Decision

### Event Envelope
All events follow a standard envelope:
```json
{
  "event_id": "evt-{uuid}",
  "event_type": "auth.{entity}.{action}",
  "timestamp": "2026-05-27T10:30:00Z",
  "correlation_id": "corr-{uuid}",
  "source": "auth-service",
  "version": "1.0",
  "payload": { /* event-specific data */ }
}
```

### Event Naming Convention
`{domain}.{entity}.{action_past_tense}`

### Event Catalog

| Event Type | Producer | Payload | Delivery | Retention |
|-----------|----------|---------|----------|-----------|
| `auth.user.registered` | auth-service | user_id, email, timestamp, ip_address | at-least-once | 7 days |
| `auth.user.verified` | auth-service | user_id, email, timestamp | at-least-once | 7 days |
| `auth.user.logged_in` | auth-service | user_id, timestamp, ip_address, user_agent | at-least-once | 7 days |
| `auth.user.logged_out` | auth-service | user_id, session_id, timestamp | at-least-once | 7 days |
| `auth.password.reset_requested` | auth-service | user_id, timestamp, ip_address | at-least-once | 7 days |
| `auth.password.reset` | auth-service | user_id, timestamp, ip_address | at-least-once | 7 days |
| `auth.session.expired` | auth-service | user_id, session_id, timestamp | at-least-once | 3 days |
| `auth.account.locked` | auth-service | user_id, timestamp, reason, lockout_minutes | at-least-once | 7 days |
| `auth.account.unlocked` | auth-service | user_id, timestamp, reason | at-least-once | 7 days |
| `auth.email.delivery_failed` | auth-service | user_id, email, email_type, error_reason, attempt | at-least-once | 7 days |

### Potential Consumers
- **Notification service**: Listens to `user.registered` to send welcome emails.
- **Audit service**: Listens to all events for security audit trail.
- **Analytics service**: Listens to `user.registered`, `user.logged_in` for user growth/funnel metrics.
- **User profile service**: Listens to `user.registered` to create a user profile record.
- **Security monitoring**: Listens to `account.locked`, `password.reset` for anomaly detection.

### Delivery Guarantee
- **at-least-once**: Consumers must be idempotent (use `event_id` for deduplication).
- Events have a TTL matching their retention period. After TTL, events are discarded.

### Schema Registry
- Event schemas are versioned: `version: "1.0"` in the envelope.
- Breaking schema changes require a new event type (e.g., `auth.user.registered.v2`).
- Non-breaking changes (adding optional fields) increment the minor version.

## Consequences

- **Positive**: Standard envelope and naming convention make event discovery and consumption predictable.
- **Positive**: Correlation IDs enable end-to-end request tracing across services.
- **Negative**: at-least-once delivery requires consumer deduplication logic.
- **Negative**: 7-day retention may not be sufficient for compliance audits. Mitigation: critical events are also written to an append-only audit log with longer retention.

# Event Contract Catalog

**Version:** 1.0.0

## Event Envelope

All auth domain events use this standard envelope:

```
event_id:        UUID v4, unique per event
event_type:      {domain}.{entity}.{action_past_tense}
timestamp:       ISO 8601 UTC
correlation_id:  UUID v4, shared across services for a single user request
source:          "auth-service"
version:         Semantic version of event schema
payload:         Event-specific data
```

## Event Types

### auth.user.registered
- **Producer:** auth-service (POST /api/v1/auth/register)
- **Consumers:** notification-service, audit-service, analytics-service, user-profile-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "email": "user@example.com",
  "timestamp": "2026-05-27T10:30:00Z",
  "ip_address": "203.0.113.42",
  "idempotency_key": "key-abc-123"
}
```

### auth.user.verified
- **Producer:** auth-service (POST /api/v1/auth/verify-email)
- **Consumers:** notification-service, audit-service, user-profile-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "email": "user@example.com",
  "timestamp": "2026-05-27T10:35:00Z"
}
```

### auth.user.logged_in
- **Producer:** auth-service (POST /api/v1/auth/login)
- **Consumers:** audit-service, analytics-service, security-monitoring
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "session_id": "sess-{uuid}",
  "timestamp": "2026-05-27T10:30:00Z",
  "ip_address": "203.0.113.42",
  "user_agent": "Mozilla/5.0...",
  "device_id": "device-{uuid}"
}
```

### auth.user.logged_out
- **Producer:** auth-service (POST /api/v1/auth/logout)
- **Consumers:** audit-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "session_id": "sess-{uuid}",
  "timestamp": "2026-05-27T12:00:00Z"
}
```

### auth.password.reset_requested
- **Producer:** auth-service (POST /api/v1/auth/password-reset)
- **Consumers:** audit-service, security-monitoring
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "timestamp": "2026-05-27T14:00:00Z",
  "ip_address": "203.0.113.42"
}
```

### auth.password.reset
- **Producer:** auth-service (PUT /api/v1/auth/password-reset)
- **Consumers:** audit-service, security-monitoring, notification-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "timestamp": "2026-05-27T14:05:00Z",
  "ip_address": "203.0.113.42",
  "sessions_invalidated": 3
}
```

### auth.account.locked
- **Producer:** auth-service (after 5th consecutive failed login)
- **Consumers:** audit-service, security-monitoring, notification-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "timestamp": "2026-05-27T15:00:00Z",
  "reason": "consecutive_failed_logins",
  "failed_attempts": 5,
  "lockout_minutes": 5,
  "ip_addresses": ["203.0.113.42", "198.51.100.7"]
}
```

### auth.account.unlocked
- **Producer:** auth-service (after password reset or lockout expiry)
- **Consumers:** audit-service, security-monitoring
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "timestamp": "2026-05-27T15:05:00Z",
  "reason": "password_reset"
}
```

### auth.session.expired
- **Producer:** auth-service (session expiry sweep or logout)
- **Consumers:** audit-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 3 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "session_id": "sess-{uuid}",
  "timestamp": "2026-05-27T20:00:00Z",
  "reason": "ttl_expiry"
}
```

### auth.email.delivery_failed
- **Producer:** auth-service (after all retry attempts exhausted)
- **Consumers:** ops-alerting, notification-service
- **Schema version:** 1.0
- **Delivery:** at-least-once
- **Retention:** 7 days

Payload:
```json
{
  "user_id": "usr-{uuid}",
  "email": "user@example.com",
  "email_type": "verification",
  "error_reason": "SMTP timeout",
  "attempt": 3,
  "timestamp": "2026-05-27T10:31:00Z"
}
```

# API Conventions

**Version:** 1.0.0

## URL Pattern
```
/api/v{major}/{domain}/{resource}
```

## Versioning
- URL path versioning: `/api/v1/`, `/api/v2/`
- N-1 support: previous major version supported for 6 months after new version release

## Auth Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /api/v1/auth/register | Register new user | No |
| POST | /api/v1/auth/login | Authenticate user | No |
| POST | /api/v1/auth/logout | Terminate session | Yes |
| GET | /api/v1/auth/session | Get current session info | Yes |
| POST | /api/v1/auth/verify-email | Verify email token | No |
| POST | /api/v1/auth/password-reset | Request password reset | No |
| PUT | /api/v1/auth/password-reset | Execute password reset with token | No |
| POST | /api/v1/auth/resend-verification | Resend verification email | No |

## Authentication Methods

### Session Cookie (Web Clients)
- Cookie name: `auth_session`
- Attributes: HTTP-only, Secure (production), SameSite=Strict, Path=/

### Bearer Token (Mobile/API Clients)
- Header: `Authorization: Bearer {session_token}`

## Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [
      {"field": "field_name", "message": "specific error"}
    ],
    "request_id": "req-uuid"
  }
}
```

## HTTP Status Code Mapping

| Business Error Code | HTTP Status | Retryable? |
|--------------------|-------------|------------|
| VALIDATION_ERROR | 400 | No (fix input) |
| INVALID_CREDENTIALS | 401 | No (fix credentials) |
| ACCOUNT_UNVERIFIED | 403 | No (verify first) |
| ACCOUNT_LOCKED | 423 | Yes (wait for unlock) |
| ACCOUNT_DEACTIVATED | 403 | No (contact support) |
| DUPLICATE_EMAIL | 409 | No |
| WEAK_PASSWORD | 400 | No (fix password) |
| WEAK_NEW_PASSWORD | 400 | No (fix password) |
| SAME_PASSWORD | 409 | No |
| INVALID_OR_EXPIRED_TOKEN | 400 | No (request new token) |
| ALREADY_VERIFIED | 409 | No |
| EMAIL_DELIVERY_FAILED | 502 | Yes (retry) |
| RATE_LIMITED | 429 | Yes (wait) |

## Rate Limiting Headers

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit | Maximum requests per window |
| X-RateLimit-Remaining | Remaining requests in current window |
| X-RateLimit-Reset | Unix timestamp when window resets |
| Retry-After | Seconds to wait before retry (only for 429) |

## Success Response Format

### Single Resource
```json
{
  "data": {
    "id": "usr-uuid",
    "type": "user",
    "attributes": { ... },
    "meta": { ... }
  }
}
```

### Collection
```json
{
  "data": [...],
  "meta": {
    "cursor": "next-page-token",
    "has_more": true,
    "total": 1000
  }
}
```

## Idempotency
- Clients may supply `Idempotency-Key` header for POST requests.
- Idempotency keys are stored for 24 hours.
- Same key + same request = same response returned.

## Pagination
- Cursor-based via `cursor` query parameter.
- `page[size]` parameter: default 50, max 200.

## Request/Response Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| Content-Type | Request/Response | application/json |
| Accept | Request | application/json |
| Idempotency-Key | Request | UUID for idempotent operations |
| Authorization | Request | Bearer token for authenticated requests |
| Cookie | Request | Session cookie for web clients |
| X-Request-ID | Request/Response | Correlation ID for tracing |
| X-RateLimit-* | Response | Rate limit status |
| Set-Cookie | Response | Session cookie for web clients |

---
adr_id: ADR-002
domain: AUTH
title: API Gateway, Versioning, and Status Code Mapping
status: accepted
version: 1.0.0
---

# ADR-002: API Gateway, Versioning, and Status Code Mapping

## Context

The auth service exposes HTTP APIs consumed by client applications (web, mobile) and potentially other backend services. We need consistent API versioning, error response formatting, rate limiting strategy, and HTTP status code mapping.

## Decision

### API URL Pattern
```
/api/v1/auth/{resource}
```

### Versioning Strategy
- **URL path versioning**: `/api/v1/`, `/api/v2/`.
- Version is a major version number. Breaking changes increment the version.
- Support N-1 version policy: `v1` remains active for at least 6 months after `v2` release.

### Auth Endpoint Layout
```
POST   /api/v1/auth/register        - User registration
POST   /api/v1/auth/login           - User login
POST   /api/v1/auth/logout          - User logout
GET    /api/v1/auth/session         - Get current session info
POST   /api/v1/auth/verify-email    - Verify email token
POST   /api/v1/auth/password-reset  - Request password reset
PUT    /api/v1/auth/password-reset  - Execute password reset
POST   /api/v1/auth/resend-verification - Resend verification email
```

### Authentication
- **Session-based**: Session cookie (`auth_session`) for web clients.
- **Header-based**: `Authorization: Bearer <session_token>` for mobile/API clients.
- **Where auth happens**: Auth service validates credentials and issues tokens. Other services validate tokens via the auth service or shared session store (see HLD system architecture).

### Rate Limiting
- Enforced at API gateway layer for public endpoints.
- Default thresholds: 100 requests/minute per authenticated user; 20 requests/minute per unauthenticated IP.
- Specific thresholds for auth operations as defined in NFR-SEC-004.
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

### Error Envelope
All error responses follow a standard envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      {"field": "email", "message": "Invalid email format"}
    ],
    "request_id": "req-abc123"
  }
}
```

### HTTP Status Code Mapping
| Business Error Code | HTTP Status |
|--------------------|-------------|
| VALIDATION_ERROR | 400 Bad Request |
| INVALID_CREDENTIALS | 401 Unauthorized |
| ACCOUNT_UNVERIFIED | 403 Forbidden |
| ACCOUNT_LOCKED | 423 Locked |
| ACCOUNT_DEACTIVATED | 403 Forbidden |
| DUPLICATE_EMAIL | 409 Conflict |
| WEAK_PASSWORD | 400 Bad Request |
| WEAK_NEW_PASSWORD | 400 Bad Request |
| SAME_PASSWORD | 409 Conflict |
| INVALID_OR_EXPIRED_TOKEN | 400 Bad Request |
| ALREADY_VERIFIED | 409 Conflict |
| EMAIL_DELIVERY_FAILED | 502 Bad Gateway |
| RATE_LIMITED | 429 Too Many Requests |

### Pagination
- Cursor-based for list endpoints.
- Default page size: 50. Max: 200.

## Consequences

- **Positive**: URL versioning is simple to understand, debug, and cache (CDN/API gateway level).
- **Positive**: Standard error envelope enables consistent client error handling.
- **Negative**: URL versioning requires careful route management if many versions exist simultaneously.
- **Negative**: Maintaining N-1 version adds overhead. Mitigation: auth API is small and stable; version churn is expected to be low.

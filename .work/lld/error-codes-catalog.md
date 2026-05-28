# Error Codes Catalog

**Service:** auth-service
**Version:** 1.0.0

| Error Code | HTTP Status | FR Reference | Description |
|-----------|-------------|-------------|-------------|
| VALIDATION_ERROR | 400 | FR-AUTH-001,002,003,004 | Input validation failed |
| INVALID_CREDENTIALS | 401 | FR-AUTH-002 | Email or password incorrect (intentionally vague) |
| ACCOUNT_UNVERIFIED | 403 | FR-AUTH-002 | Email not yet verified |
| ACCOUNT_LOCKED | 423 | FR-AUTH-002 | Too many failed login attempts |
| ACCOUNT_DEACTIVATED | 403 | FR-AUTH-001 | Account administratively deactivated |
| DUPLICATE_EMAIL | 409 | FR-AUTH-001 | Email already registered |
| WEAK_PASSWORD | 400 | FR-AUTH-001 | Password fails complexity requirements |
| WEAK_NEW_PASSWORD | 400 | FR-AUTH-003 | New password fails complexity requirements |
| SAME_PASSWORD | 409 | FR-AUTH-003 | New password matches current password |
| INVALID_OR_EXPIRED_TOKEN | 400 | FR-AUTH-003,004 | Reset or verification token invalid/expired |
| ALREADY_VERIFIED | 409 | FR-AUTH-004 | Email already verified |
| EMAIL_DELIVERY_FAILED | 502 | FR-AUTH-001,003 | Email provider unavailable |
| RATE_LIMITED | 429 | FR-AUTH-001,002,003 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | All | Unexpected server error |

## Error Code Mapping to Endpoints

| Endpoint | Possible Error Codes |
|----------|---------------------|
| POST /auth/register | VALIDATION_ERROR, DUPLICATE_EMAIL, WEAK_PASSWORD, EMAIL_DELIVERY_FAILED, RATE_LIMITED |
| POST /auth/login | VALIDATION_ERROR, INVALID_CREDENTIALS, ACCOUNT_UNVERIFIED, ACCOUNT_LOCKED, RATE_LIMITED |
| POST /auth/verify-email | VALIDATION_ERROR, INVALID_OR_EXPIRED_TOKEN, ALREADY_VERIFIED |
| POST /auth/password-reset (request) | VALIDATION_ERROR, RATE_LIMITED |
| PUT /auth/password-reset (execute) | VALIDATION_ERROR, INVALID_OR_EXPIRED_TOKEN, WEAK_NEW_PASSWORD, SAME_PASSWORD |
| POST /auth/logout | (no specific errors) |
| GET /auth/session | (no specific errors) |

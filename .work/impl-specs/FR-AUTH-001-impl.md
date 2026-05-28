---
fr_id: FR-AUTH-001
title: User Registration - Implementation Specification
version: 1.0.0
status: draft
---

# IMP Spec: FR-AUTH-001 - User Registration

## 1. Purpose
Implement user self-registration with email/password, including input validation, duplicate prevention, secure password storage, verification token generation, and asynchronous verification email dispatch. This is the entry point for new user onboarding.

## 2. References
- **FR:** .work/srs/FR-AUTH-001--user-registration.md
- **HLD:** ADR-002 (API conventions), ADR-003 (events)
- **LLD:** auth-service-tech-design.md (RegistrationService, UserRepository, TokenRepository)
- **OpenAPI:** api-auth.yaml (POST /auth/register)
- **Work Package:** .work/lld/agent_docs/features/FR-AUTH-001.md

## 3. Affected Areas
- **Controllers:** RegisterController (new)
- **Services:** RegistrationService (new), TokenService (tokens), EmailService (async email)
- **Repositories:** UserRepository (new), TokenRepository (new)
- **Database:** users table (new), verification_tokens table (new)
- **Middleware:** RateLimitMiddleware, RequestLogMiddleware
- **Events:** auth.user.registered event

## 4. Execution Flow

1. **Rate limit check:** Check IP-based rate limit (5 registrations/hour). If exceeded, return 429.
2. **Input validation:** Validate email format (RFC 5322), password complexity (8+ chars, upper+lower+digit+special), password confirmation match. Return 400 with field-level details on failure.
3. **Email normalization:** Trim whitespace, convert to lowercase.
4. **Duplicate check:** Query users table by normalized email.
   - If active user exists -> 409 DUPLICATE_EMAIL.
   - If deactivated user exists -> 403 ACCOUNT_DEACTIVATED.
   - If unverified user exists -> allow re-registration (reuse user record, generate new token).
5. **Password hashing:** Hash password using argon2id (t=3, m=65536, p=4) with unique random salt.
6. **Database transaction begin.**
7. **Upsert user:** INSERT or UPDATE (for re-registration) users table with email, password_hash, status="unverified".
8. **Generate verification token:** CSPRNG 256-bit token. Store HMAC-SHA256 hash in verification_tokens table with 24h expiry. Invalidate any prior unused tokens for this user.
9. **Publish event:** auth.user.registered event within transaction boundary.
10. **Database transaction commit.**
11. **Enqueue verification email:** Asynchronously post-commit via message queue. Email payload includes verification link with raw token.
12. **Return 201:** User registered, verification email sent.

## 5. Business Rules Realized

- **Password complexity enforced:** Reject passwords failing length or character class checks.
- **Email uniqueness:** UNIQUE constraint on users.email (normalized). DB-level enforcement prevents race conditions.
- **Unverified re-registration:** If user exists with status=unverified, reuse the record. This prevents accumulating orphan records.
- **Deactivated accounts cannot re-register:** Business rule to prevent banned users from creating new accounts.
- **Security through idempotency:** Idempotency-Key header prevents accidental duplicate registrations.
- **Privacy through timing:** All failure paths return in similar time to prevent email enumeration.

## 6. Data & State Impact

- **Users table:** New row inserted (or updated for re-registration). Columns: id, email, password_hash, status, failed_login_count, locked_until, created_at, updated_at.
- **Verification tokens table:** New row with user_id FK, token_hash, expires_at (NOW() + 24h).
- **No session created:** User must verify email before logging in.
- **Idempotency store:** If Idempotency-Key provided, store key -> response mapping for 24h.

## 7. Error Mapping

| Scenario | Error Code | HTTP | User Message |
|----------|-----------|------|-------------|
| Invalid email format | VALIDATION_ERROR | 400 | "Invalid email format" |
| Password too short | VALIDATION_ERROR | 400 | "Password must be at least 8 characters" |
| Password lacks complexity | WEAK_PASSWORD | 400 | "Password must include uppercase, lowercase, digit, and special character" |
| Passwords do not match | VALIDATION_ERROR | 400 | "Password confirmation does not match" |
| Email already active | DUPLICATE_EMAIL | 409 | "An account with this email already exists" |
| Account deactivated | ACCOUNT_DEACTIVATED | 403 | "Account deactivated. Contact support" |
| Rate limit exceeded | RATE_LIMITED | 429 | "Too many attempts. Try again in {n} minutes" |
| DB constraint violation | INTERNAL_ERROR | 500 | (logged, not exposed) |

## 8. Security & Authorization

- **Public endpoint:** No authentication required. Rate-limited by IP.
- **Password storage:** argon2id, never logged, never returned in responses.
- **Token security:** Verification token stored as hash. Raw token only in email -- never in logs, events, or DB in plaintext.
- **Idempotency keys:** Stored with TTL. Prevent replay attacks via one-time use.
- **Input sanitization:** Email validated and normalized. Password handled as byte array (not string in memory where possible).
- **Email enumeration prevention:** DUPLICATE_EMAIL is the only revealing response. Deactivated accounts return the same 409 but the message does not differ. Timing is constant across error paths.

## 9. Implementation Notes

- **Order dependency:** Registration must be implemented before login (login requires registered users) and before email verification (registration creates the token).
- **Concurrency gotcha:** Rely on DB UNIQUE constraint for duplicate prevention, not application-level check-then-act. Application check is a UX optimization, not a correctness mechanism.
- **Token double-write risk:** Invalidate old tokens BEFORE inserting new one to prevent token leak from unused re-registration tokens.
- **Email failure:** If email queue is unreachable, registration still succeeds with EMAIL_DELIVERY_FAILED event emitted. User can request resend later.
- **argon2id tuning:** t=3, m=65536, p=4 balances security (~64MB memory per hash) with P95 < 500ms. Adjust based on instance size.

## 10. Acceptance Checklist

- [ ] Registration with valid email/password creates unverified user
- [ ] Invalid email returns VALIDATION_ERROR with specific field message
- [ ] Weak password returns WEAK_PASSWORD
- [ ] Mismatched password confirmation returns VALIDATION_ERROR
- [ ] Duplicate email returns DUPLICATE_EMAIL
- [ ] Deactivated email returns ACCOUNT_DEACTIVATED
- [ ] Unverified re-registration generates new verification token
- [ ] Verification email is dispatched asynchronously
- [ ] Idempotency key prevents duplicate registration
- [ ] Concurrent registration for same email: exactly one succeeds
- [ ] Password hash is never logged or returned
- [ ] Rate limit enforced at 5 registrations/hour

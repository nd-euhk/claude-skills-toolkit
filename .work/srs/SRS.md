---
doc_type: SRS
domain: AUTH
title: User Authentication System - Software Requirements Specification
version: 1.0.0
status: draft
fr_list: [FR-AUTH-001, FR-AUTH-002, FR-AUTH-003, FR-AUTH-004]
---

# Software Requirements Specification: User Authentication System

## Overview

This SRS defines the functional and non-functional requirements for an email/password based user authentication system. The system provides user registration with email verification, secure login, and password reset capabilities.

## Functional Requirements Index

| FR ID | Title | Priority | Key Scenarios |
|-------|-------|----------|--------------|
| FR-AUTH-001 | User Registration with Email and Password | must-have | Register, validate input, prevent duplicates, send verification |
| FR-AUTH-002 | User Login with Email and Password | must-have | Authenticate, create session, lockout after failures |
| FR-AUTH-003 | Password Reset via Email | must-have | Request reset, validate token, update password, invalidate sessions |
| FR-AUTH-004 | Email Verification | must-have | Verify email token, activate account |

## Non-Functional Requirements

### NFR-SEC-001: Password Security
- **Hashing Algorithm:** bcrypt with cost factor >= 12, or argon2id with t=3, m=65536, p=4.
- **Unique salt per password:** Required. No shared or global salts.
- **Password complexity:** Min 8 chars, max 128 chars, >=1 uppercase, >=1 lowercase, >=1 digit, >=1 special char.
- **Password history:** Must not reuse last 5 passwords (applies to password reset).

### NFR-SEC-002: Token Security
- **Token entropy:** All tokens (session, verification, reset) must have at least 256 bits of entropy generated via a CSPRNG.
- **Token expiration:** Verification tokens: 24 hours. Reset tokens: 30 minutes. Session tokens: configurable (default 7 days idle, 30 days absolute).
- **Token storage:** Store as salted hash (SHA-256 HMAC), not plaintext.

### NFR-SEC-003: Session Security
- **Session cookie attributes:** HTTP-only, Secure (in production), SameSite=Strict, Path=/.
- **Session token length:** At least 256 bits of entropy.
- **Session invalidation:** All sessions invalidated on password reset. Individual session invalidation on logout.
- **Concurrent sessions:** Maximum 10 active sessions per user. Newest session replaces oldest if exceeded.

### NFR-SEC-004: Communication Security
- **Transport:** All API communication must use HTTPS (TLS 1.2+).
- **Rate limiting by IP:** Registration: 5/hour. Login: 10/minute. Password reset request: 3/hour. Verification: 10/minute.
- **Rate limiting by email:** Login: 5/minute. Password reset request: 3/hour.

### NFR-SEC-005: Information Disclosure Prevention
- **Login failure:** Always return "Invalid email or password" regardless of which credential was incorrect.
- **Password reset request:** Always return the same message whether email exists or not.
- **Timing attack prevention:** Constant-time comparison for all credential checks. Response times for failed auth must not differ based on reason.

### NFR-PERF-001: Response Time Targets
- **Registration (P95):** < 500ms (excluding email sending).
- **Login (P95):** < 200ms.
- **Password reset request (P95):** < 300ms (excluding email sending).
- **Password reset execution (P95):** < 300ms.
- **Email verification (P95):** < 200ms.
- **Registration (P99):** < 1000ms.
- **Login (P99):** < 500ms.

### NFR-PERF-002: Throughput Targets
- **Login throughput:** >= 1000 requests/second.
- **Registration throughput:** >= 100 requests/second.
- **Concurrent users:** Support >= 10,000 concurrent active sessions.

### NFR-AVAIL-001: Availability
- **Uptime:** 99.95% (excluding planned maintenance).
- **RTO (Recovery Time Objective):** < 15 minutes.
- **RPO (Recovery Point Objective):** < 5 minutes of data loss.

### NFR-REL-001: Reliability
- **Idempotency:** Registration with idempotency key must be safe to retry. Password reset tokens must be one-time use.
- **Email delivery retry:** If email delivery fails, retry with exponential backoff (1min, 5min, 15min), max 3 attempts. After 3 failures, flag account for manual intervention.
- **No partial failures:** Registration either completes fully (user + token + email queued) or rolls back entirely.

### NFR-SCAL-001: Scalability
- **Horizontal scaling:** All components must support horizontal scaling (no server-local state for auth).
- **Data volume:** Designed for up to 10 million user accounts.
- **Session storage:** Must support distributed session stores (not local memory).

## Traceability Matrix

See [traceability.md](traceability.md) for the full requirements traceability matrix.

## References

- FR-AUTH-001: [User Registration](./FR-AUTH-001--user-registration.md)
- FR-AUTH-002: [User Login](./FR-AUTH-002--user-login.md)
- FR-AUTH-003: [Password Reset](./FR-AUTH-003--password-reset.md)
- FR-AUTH-004: [Email Verification](./FR-AUTH-004--email-verification.md)

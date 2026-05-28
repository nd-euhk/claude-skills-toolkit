---
fr_id: FR-AUTH-002
domain: AUTH
title: User Login with Email and Password
priority: must-have
status: draft
nfr_refs: [NFR-SEC-001, NFR-SEC-002, NFR-SEC-003, NFR-PERF-001, NFR-REL-001]
cross_domain_deps: []
version: 1.0.0
---

# FR-AUTH-002: User Login with Email and Password

## Precondition

- The user has a registered and verified account.
- The user is not currently authenticated (no valid session).
- The user account is not locked out.

## Input

| Field | Type | Validation Rules |
|-------|------|-----------------|
| email | string | RFC 5322 compliant, max 254 chars |
| password | string | Max 128 chars, non-empty |

## Process

1. Validate input fields (email format, password non-empty).
2. Normalize email: trim whitespace, convert to lowercase.
3. Look up the user by normalized email.
   - If not found: return INVALID_CREDENTIALS (do not reveal whether email exists).
   - If found and account is unverified: return ACCOUNT_UNVERIFIED.
   - If found and account is locked: return ACCOUNT_LOCKED with lockout remaining time.
   - If found and account is deactivated: return INVALID_CREDENTIALS (no info leak).
4. Verify the password against the stored hash using constant-time comparison.
   - If password incorrect: increment failed login counter.
   - If failed login counter exceeds threshold (5 attempts): lock account for a progressive period (5 min, 15 min, 30 min, 60 min).
   - Return INVALID_CREDENTIALS (do not reveal whether email or password was wrong).
5. On successful authentication:
   - Reset the failed login counter.
   - Create a new session with a secure, random session token.
   - Session token is stored server-side with metadata (user_id, IP, user_agent, created_at, expires_at).
   - Set the session cookie (HTTP-only, Secure in production, SameSite=Strict).
   - Emit event: `UserLoggedIn` (user_id, timestamp, ip_address).
   - Return user profile data (id, email, display_name) and session token.

## Output

- Authenticated session established.
- Session cookie set.
- User profile data returned.
- Event: `UserLoggedIn` emitted.

## Error Catalog

| Error Code | Condition | User-Facing Message |
|-----------|-----------|-------------------|
| VALIDATION_ERROR | Email format invalid or password empty | "Invalid input: email and password are required." |
| INVALID_CREDENTIALS | Email not found, password incorrect, or account deactivated | "Invalid email or password." |
| ACCOUNT_UNVERIFIED | Account exists but email not verified | "Please verify your email address before logging in." |
| ACCOUNT_LOCKED | Failed login attempts exceeded threshold | "Account is temporarily locked. Please try again in {remaining} minutes or use password reset." |
| RATE_LIMITED | Too many login attempts from the same IP | "Too many login attempts. Please try again in {retry_after} minutes." |

## Concurrency / Idempotency

- **Concurrent logins from different devices:** Allowed. Each device gets an independent session.
- **Concurrent login from same device:** Update the existing session rather than creating a duplicate.
- **Login during password reset flow:** If a password reset is in progress, the existing session (if any) is invalidated upon successful password reset.
- **Race condition on failed counter:** Use atomic increment to prevent counter reset race conditions.

## Authorization

- None required (public endpoint).
- Rate limiting applies per IP address and per email.

## Security Requirements (NFR-SEC-003)

- Session token must be at least 256 bits of entropy.
- Constant-time password comparison must be used.
- Failed login counter must use atomic database operations.
- Session cookie attributes: HTTP-only, Secure, SameSite=Strict.
- Failed login attempts: progressively increasing lockout (5/15/30/60 minutes).

## Phase 06 HLD (completed)

- **Service owner:** auth-service -- [domain-service-mapping.yaml](../hld/domain-service-mapping.yaml)
- **Gateway route:** POST /api/v1/auth/login -- [ADR-002](../hld/ADR-002-api-gateway-and-versioning.md)
- **Session management:** Redis session cache, HTTP-only cookies -- [system-architecture.md](../hld/system-architecture.md)
- **HTTP status mapping:** See [api-conventions.md](../hld/contracts/api-conventions.md) for INVALID_CREDENTIALS (401), ACCOUNT_UNVERIFIED (403), ACCOUNT_LOCKED (423), RATE_LIMITED (429)
- **Event schemas:** `auth.user.logged_in`, `auth.account.locked` -- [events.md](../hld/contracts/events.md)
- **Hard boundaries:** HB-001, HB-003 (session management), HB-006 (constant-time comparison), HB-008 (rate limiting) -- [hard-boundaries.md](../hld/hard-boundaries.md)

> **Phase 07 LLD will add:** Domain model, transaction boundaries, OpenAPI contract, work package

## Gherkin Scenarios

### Scenario: Successful login

```gherkin
Scenario: User logs in with valid credentials
  Given the user "verified@example.com" exists with verified status
  And the account is not locked
  When the user logs in with email "verified@example.com" and password "CorrectP@ss1"
  Then the system authenticates the user
  And a session is created
  And the session cookie is set with HTTP-only, Secure, SameSite=Strict
  And the response includes the user profile
  And the failed login counter is reset to 0
```

### Scenario Outline: Login failure scenarios

```gherkin
Scenario Outline: Login fails with various error conditions
  Given the system is accepting login requests
  When the user logs in with email "<email>" and password "<password>"
  Then the system responds with error code "<error_code>"
  And the error message is "<message>"

  Examples:
    | email                        | password      | error_code          | message                                                      |
    | "not-an-email"               | "anything"    | VALIDATION_ERROR     | "Invalid input: email and password are required."            |
    | ""                           | "anything"    | VALIDATION_ERROR     | "Invalid input: email and password are required."            |
    | "nonexistent@example.com"    | "SomeP@ss1"   | INVALID_CREDENTIALS  | "Invalid email or password."                                 |
    | "verified@example.com"       | "WrongP@ss1"  | INVALID_CREDENTIALS  | "Invalid email or password."                                 |
    | "unverified@example.com"     | "CorrectP@ss1"| ACCOUNT_UNVERIFIED   | "Please verify your email address before logging in."        |
    | "deactivated@example.com"    | "CorrectP@ss1"| INVALID_CREDENTIALS  | "Invalid email or password."                                 |
```

### Scenario Outline: Account lockout after consecutive failed attempts

```gherkin
Scenario Outline: Account locks after exceeding failed login threshold
  Given the user "user@example.com" has a verified account
  And the user has made <previous_failures> consecutive failed login attempts
  When the user attempts login with email "user@example.com" and password "WrongP@ss1"
  Then the system responds with error code "<error_code>"
  And the lockout remaining time is approximately "<lockout_minutes>" minutes

  Examples:
    | previous_failures | error_code          | lockout_minutes |
    | 3                 | INVALID_CREDENTIALS  | 0               |
    | 4                 | INVALID_CREDENTIALS  | 0               |
    | 5                 | ACCOUNT_LOCKED       | 5               |
    | 10                | ACCOUNT_LOCKED       | 30              |
    | 15                | ACCOUNT_LOCKED       | 60              |
```

### Scenario: Successful login resets failed counter

```gherkin
Scenario: Successful login resets the failed attempts counter
  Given the user "user@example.com" has 4 failed login attempts
  When the user logs in with correct email "user@example.com" and password "CorrectP@ss1"
  Then the login succeeds
  And the failed login counter is reset to 0
  And subsequent failed attempts start counting from 0 again
```

### Scenario: Concurrent login sessions from multiple devices

```gherkin
Scenario: User logs in from multiple devices simultaneously
  Given the user "user@example.com" has a verified account
  When the user logs in from device A (Chrome on Windows)
  And simultaneously logs in from device B (Safari on iPhone)
  Then both login attempts succeed
  And two independent sessions are created
  And each session is associated with the correct device metadata
```

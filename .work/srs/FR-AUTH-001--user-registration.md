---
fr_id: FR-AUTH-001
domain: AUTH
title: User Registration with Email and Password
priority: must-have
status: draft
nfr_refs: [NFR-SEC-001, NFR-SEC-002, NFR-PERF-001, NFR-REL-001]
cross_domain_deps: []
version: 1.0.0
---

# FR-AUTH-001: User Registration with Email and Password

## Precondition

- The user has not previously registered with the same email address.
- The user is not currently authenticated.

## Input

| Field | Type | Validation Rules |
|-------|------|-----------------|
| email | string | RFC 5322 compliant, max 254 chars, not already registered |
| password | string | Min 8 chars, max 128 chars, includes >=1 uppercase, >=1 lowercase, >=1 digit, >=1 special char |
| password_confirmation | string | Must match password exactly |

## Process

1. Validate all input fields according to validation rules.
2. Normalize email: trim whitespace, convert to lowercase.
3. Check if a user account with the normalized email already exists.
   - If exists and is active: reject with DUPLICATE_EMAIL error.
   - If exists and is unverified: allow re-registration (resend verification).
   - If exists and is deactivated: reject with ACCOUNT_DEACTIVATED error.
4. Hash the password using a secure one-way hashing algorithm with unique per-user salt.
5. Create a user record with status "unverified".
6. Generate a unique email verification token with expiration (valid for 24 hours).
7. Store the verification token associated with the user.
8. Send a verification email to the user's email address containing the verification link.
9. Return success response indicating verification email has been sent.

## Output

- New user record (unverified status).
- Verification email sent.
- Event emitted: `UserRegistered` (user_id, email, timestamp).

## Error Catalog

| Error Code | Condition | User-Facing Message |
|-----------|-----------|-------------------|
| VALIDATION_ERROR | Input fields fail validation rules | "Invalid input: {field-specific message}" |
| DUPLICATE_EMAIL | Normalized email matches an existing active or deactivated account | "An account with this email already exists." |
| ACCOUNT_DEACTIVATED | Email matches a deactivated account | "This account has been deactivated. Please contact support." |
| WEAK_PASSWORD | Password does not meet complexity requirements | "Password must be at least 8 characters with uppercase, lowercase, digit, and special character." |
| EMAIL_DELIVERY_FAILED | Verification email could not be sent | "We could not send a verification email. Please try again later." |
| RATE_LIMITED | Too many registration attempts from same IP or email | "Too many attempts. Please try again in {retry_after} minutes." |

## Concurrency / Idempotency

- **Concurrency:** If two registration requests for the same email arrive simultaneously, exactly one must succeed. The second must receive DUPLICATE_EMAIL.
- **Idempotency:** Submitting the same registration payload twice (with idempotency key) must not create duplicate users. The second request returns the same result as the first.
- **Idempotency Key:** Clients may supply an `Idempotency-Key` header. The system stores the key with the response for 24 hours.

## Authorization

- None required (public endpoint).
- Rate limiting applies per IP address.

## Phase 06 HLD (completed)

- **Service owner:** auth-service -- [domain-service-mapping.yaml](../hld/domain-service-mapping.yaml)
- **Gateway route:** POST /api/v1/auth/register -- [ADR-002](../hld/ADR-002-api-gateway-and-versioning.md)
- **HTTP status mapping:** See [api-conventions.md](../hld/contracts/api-conventions.md) for VALIDATION_ERROR (400), DUPLICATE_EMAIL (409), WEAK_PASSWORD (400), RATE_LIMITED (429)
- **Event schema:** `auth.user.registered` -- [events.md](../hld/contracts/events.md)
- **Hard boundaries:** HB-001 (no cross-service DB access), HB-007 (async email sending) -- [hard-boundaries.md](../hld/hard-boundaries.md)

> **Phase 07 LLD will add:** Domain model, transaction boundaries, caching strategy, OpenAPI contract, work package

## Gherkin Scenarios

### Scenario: Successful user registration

```gherkin
Scenario: User registers with valid email and password
  Given the email "newuser@example.com" is not registered
  When the user submits registration with email "newuser@example.com" and password "StrongP@ss1"
  Then the system creates an unverified user account
  And a verification email is sent to "newuser@example.com"
  And the response indicates verification email sent
```

### Scenario Outline: Registration validation errors

```gherkin
Scenario Outline: User registration fails with invalid input
  Given the system is accepting registrations
  When the user submits registration with email "<email>" and password "<password>"
  Then the system responds with error code "<error_code>"
  And the error message is "<message>"

  Examples:
    | email                    | password    | error_code         | message                                                     |
    | ""                       | "StrongP@1" | VALIDATION_ERROR    | "Invalid input: email is required"                          |
    | "not-an-email"           | "StrongP@1" | VALIDATION_ERROR    | "Invalid input: email format is invalid"                    |
    | "user@example.com"       | ""          | VALIDATION_ERROR    | "Invalid input: password is required"                       |
    | "user@example.com"       | "weak"      | WEAK_PASSWORD       | "Password must be at least 8 characters..."                 |
    | "user@example.com"       | "NoDigits!" | WEAK_PASSWORD       | "Password must include at least one digit"                  |
    | "EXISTING@example.com"   | "StrongP@1" | DUPLICATE_EMAIL     | "An account with this email already exists."                |
    | "deactivated@ex.com"     | "StrongP@1" | ACCOUNT_DEACTIVATED | "This account has been deactivated. Please contact support." |
```

### Scenario: Duplicate registration with concurrent requests

```gherkin
Scenario: Concurrent registration for the same email
  Given the email "race@example.com" is not registered
  When two registration requests for "race@example.com" arrive simultaneously
  Then exactly one succeeds and creates the user
  And the other receives DUPLICATE_EMAIL error
  And only one user record exists for "race@example.com"
```

### Scenario: Idempotent registration with idempotency key

```gherkin
Scenario: Idempotent registration prevents duplicate users
  Given the email "idem@example.com" is not registered
  And the client sends a registration request with Idempotency-Key "key-abc-123"
  When the same request is sent again with Idempotency-Key "key-abc-123"
  Then the second request returns the same response as the first
  And only one user record exists for "idem@example.com"
```

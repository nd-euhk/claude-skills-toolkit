---
fr_id: FR-AUTH-004
domain: AUTH
title: Email Verification
priority: must-have
status: draft
nfr_refs: [NFR-SEC-001, NFR-SEC-002, NFR-PERF-001]
cross_domain_deps: []
version: 1.0.0
---

# FR-AUTH-004: Email Verification

## Precondition

- The user has registered with an email address and received a verification email containing a verification token.
- The user has clicked the verification link in the email.

## Input

| Field | Type | Validation Rules |
|-------|------|-----------------|
| verification_token | string | Non-empty, valid format |

## Process

1. Look up the verification token in the token store.
   - If not found: reject with INVALID_OR_EXPIRED_TOKEN.
   - If expired (over 24 hours): reject with INVALID_OR_EXPIRED_TOKEN.
2. Retrieve the associated user.
   - If user is already verified: return success with "Email already verified."
   - If user is deactivated: reject with INVALID_OR_EXPIRED_TOKEN (no info leak).
3. Update user status to "verified."
4. Invalidate the verification token (one-time use).
5. Emit event: `EmailVerified` (user_id, email, timestamp).
6. Return success with message "Email verified successfully. You can now log in."

## Output

- User status updated to "verified."
- Verification token invalidated.
- Event: `EmailVerified` emitted.

## Error Catalog

| Error Code | Condition | User-Facing Message |
|-----------|-----------|-------------------|
| VALIDATION_ERROR | Verification token is empty or malformed | "Invalid input: verification token is required." |
| INVALID_OR_EXPIRED_TOKEN | Token not found, expired, already used, or account deactivated | "This verification link is invalid or has expired. Please register again." |
| ALREADY_VERIFIED | User is already verified | "Email already verified. You can log in." |

## Concurrency / Idempotency

- **Concurrent verification requests:** If two verification requests with the same token arrive simultaneously, exactly one succeeds; the other receives ALREADY_VERIFIED.
- **Verification token one-time use:** After successful verification, the token is immediately invalidated.

## Authorization

- None required (token-based authorization via possession of valid verification token).

## Phase 06 HLD (completed)

- **Service owner:** auth-service -- [domain-service-mapping.yaml](../hld/domain-service-mapping.yaml)
- **Gateway route:** POST /api/v1/auth/verify-email -- [ADR-002](../hld/ADR-002-api-gateway-and-versioning.md)
- **HTTP status mapping:** See [api-conventions.md](../hld/contracts/api-conventions.md) for VALIDATION_ERROR (400), INVALID_OR_EXPIRED_TOKEN (400), ALREADY_VERIFIED (409)
- **Event schema:** `auth.user.verified` -- [events.md](../hld/contracts/events.md)
- **Hard boundaries:** HB-001, HB-005 (no plaintext tokens in logs) -- [hard-boundaries.md](../hld/hard-boundaries.md)

> **Phase 07 LLD will add:** Domain model, transaction boundaries, OpenAPI contract, work package

## Gherkin Scenarios

### Scenario: Successful email verification

```gherkin
Scenario: User verifies email successfully
  Given the user "newuser@example.com" has an unverified account
  And a verification token "verify-token-123" is valid for "newuser@example.com"
  When the user verifies their email with token "verify-token-123"
  Then the user status is set to "verified"
  And the token "verify-token-123" is invalidated
  And the user can now log in
```

### Scenario Outline: Email verification error scenarios

```gherkin
Scenario Outline: Email verification fails with various errors
  Given the system handles verification requests
  When the user verifies with token "<token>"
  Then the system responds with error code "<error_code>"

  Examples:
    | token              | error_code                |
    | ""                 | VALIDATION_ERROR           |
    | "expired-token"    | INVALID_OR_EXPIRED_TOKEN   |
    | "already-used"     | INVALID_OR_EXPIRED_TOKEN   |
    | "non-existent"     | INVALID_OR_EXPIRED_TOKEN   |
```

### Scenario: Concurrent verification with same token

```gherkin
Scenario: Only one concurrent verification succeeds for the same token
  Given the user "user@example.com" has a valid verification token "token-abc"
  When two verification requests arrive simultaneously with "token-abc"
  Then exactly one succeeds and sets status to "verified"
  And the other receives ALREADY_VERIFIED
```

### Scenario: Re-registration sends new verification

```gherkin
Scenario: Unverified user re-registers and gets new verification token
  Given the user "stale@example.com" registered but never verified
  And the original verification token has expired
  When the user registers again with email "stale@example.com"
  Then a new verification email is sent with a new token
  And the old unverified account data is reused
```

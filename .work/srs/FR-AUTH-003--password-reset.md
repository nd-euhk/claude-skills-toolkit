---
fr_id: FR-AUTH-003
domain: AUTH
title: Password Reset via Email
priority: must-have
status: draft
nfr_refs: [NFR-SEC-001, NFR-SEC-002, NFR-SEC-003, NFR-PERF-001, NFR-REL-001]
cross_domain_deps: []
version: 1.0.0
---

# FR-AUTH-003: Password Reset via Email

## Precondition

- The user has forgotten their password and cannot log in.
- The user knows the email address associated with their account.
- OR the user is authenticated and wants to change their password proactively.

## Input

### Request Password Reset (Step 1)

| Field | Type | Validation Rules |
|-------|------|-----------------|
| email | string | RFC 5322 compliant, max 254 chars |

### Reset Password (Step 2)

| Field | Type | Validation Rules |
|-------|------|-----------------|
| reset_token | string | Non-empty, valid format |
| new_password | string | Min 8 chars, max 128 chars, >=1 uppercase, >=1 lowercase, >=1 digit, >=1 special char |
| new_password_confirmation | string | Must match new_password exactly |

## Process

### Step 1: Request Password Reset

1. Validate email format.
2. Normalize email: trim whitespace, convert to lowercase.
3. Look up user by normalized email.
   - If not found: Return success with message "If an account with this email exists, a password reset link has been sent." (Prevent email enumeration).
4. Generate a cryptographically secure random reset token.
5. Store the reset token associated with the user record with an expiration of 30 minutes.
6. If a previous unused reset token exists, invalidate it.
7. Send a password reset email containing the reset link with the token.
8. Return success with message "If an account with this email exists, a password reset link has been sent."
9. Emit event: `PasswordResetRequested` (user_id, timestamp).

### Step 2: Reset Password

1. Validate reset_token format and new_password against complexity requirements.
2. Look up the reset token in the token store.
   - If not found or expired (over 30 min): reject with INVALID_OR_EXPIRED_TOKEN.
   - If found and valid: proceed.
3. Retrieve the associated user.
   - If user is deactivated: reject with INVALID_OR_EXPIRED_TOKEN (no info leak).
4. Verify the new password is different from the current password (optional: configurable rule).
5. Hash the new password using the same secure hashing algorithm.
6. Update the user's password hash in storage.
7. Invalidate ALL existing sessions for this user (force logout from all devices).
8. Invalidate the reset token (one-time use).
9. Invalidate any remaining unused reset tokens.
10. If the account was locked, unlock it.
11. Reset the failed login counter to 0.
12. Emit event: `PasswordReset` (user_id, timestamp).
13. Return success with message "Password has been reset successfully. Please log in with your new password."

## Output

- Password reset email sent (Step 1).
- Password updated in storage (Step 2).
- All existing sessions invalidated.
- Account unlocked if previously locked.
- Events emitted: `PasswordResetRequested` (Step 1), `PasswordReset` (Step 2).

## Error Catalog

| Error Code | Condition | User-Facing Message |
|-----------|-----------|-------------------|
| VALIDATION_ERROR | Email format invalid or new password fails complexity | "Invalid input: {field-specific message}" |
| WEAK_NEW_PASSWORD | New password does not meet complexity requirements | "Password must be at least 8 characters with uppercase, lowercase, digit, and special character." |
| INVALID_OR_EXPIRED_TOKEN | Reset token not found, expired, or already used | "This password reset link is invalid or has expired. Please request a new one." |
| SAME_PASSWORD | New password matches current password | "New password must be different from your current password." |
| RATE_LIMITED | Too many reset requests from same IP or email | "Too many password reset requests. Please try again in {retry_after} minutes." |

## Concurrency / Idempotency

- **Multiple reset requests:** Each new request invalidates the previous reset token. Only the most recent token is valid.
- **Reset during active session:** All existing sessions are invalidated upon successful password reset.
- **Reset token one-time use:** After successful reset, the token is immediately invalidated. Subsequent attempts with the same token fail.
- **Concurrent reset with same token:** If two reset attempts with the same token arrive simultaneously, exactly one succeeds; the other receives INVALID_OR_EXPIRED_TOKEN.
- **Password reset while account is locked:** Resetting the password unlocks the account and resets the failed counter, preventing a denial-of-service via lockout.

## Authorization

- **Step 1 (Request):** None required (public endpoint). Rate limiting applies.
- **Step 2 (Reset):** Token-based authorization (possession of valid reset token). No session required.

## Phase 06 HLD (completed)

- **Service owner:** auth-service -- [domain-service-mapping.yaml](../hld/domain-service-mapping.yaml)
- **Gateway routes:** POST /api/v1/auth/password-reset (request), PUT /api/v1/auth/password-reset (execute) -- [ADR-002](../hld/ADR-002-api-gateway-and-versioning.md)
- **HTTP status mapping:** See [api-conventions.md](../hld/contracts/api-conventions.md) for VALIDATION_ERROR (400), INVALID_OR_EXPIRED_TOKEN (400), SAME_PASSWORD (409), RATE_LIMITED (429)
- **Event schemas:** `auth.password.reset_requested`, `auth.password.reset`, `auth.account.unlocked` -- [events.md](../hld/contracts/events.md)
- **Hard boundaries:** HB-001, HB-002 (password hashes never leave), HB-006 (constant-time comparison), HB-007 (async email sending) -- [hard-boundaries.md](../hld/hard-boundaries.md)

> **Phase 07 LLD will add:** Domain model, transaction boundaries, OpenAPI contract, work package

## Gherkin Scenarios

### Scenario: Successful password reset flow

```gherkin
Scenario: User resets password successfully
  Given the user "user@example.com" has a verified account
  And the user requests a password reset for "user@example.com"
  And the user receives a reset token "valid-token-123" via email
  When the user resets password with token "valid-token-123" and new password "NewStr0ngP@ss!"
  Then the password is updated
  And all existing sessions for "user@example.com" are invalidated
  And the reset token "valid-token-123" is marked as used
  And the user must log in with new password "NewStr0ngP@ss!"
```

### Scenario Outline: Password reset error scenarios

```gherkin
Scenario Outline: Password reset fails with various errors
  Given the user "user@example.com" has requested a password reset
  When the user resets password with token "<token>" and new password "<new_password>"
  Then the system responds with error code "<error_code>"
  And the error message is "<message>"

  Examples:
    | token             | new_password    | error_code                | message                                                            |
    | ""                | "NewStr0ngP@1!" | VALIDATION_ERROR           | "Invalid input: reset token is required"                           |
    | "expired-token"   | "NewStr0ngP@1!" | INVALID_OR_EXPIRED_TOKEN   | "This password reset link is invalid or has expired."              |
    | "already-used"    | "NewStr0ngP@1!" | INVALID_OR_EXPIRED_TOKEN   | "This password reset link is invalid or has expired."              |
    | "non-existent"    | "NewStr0ngP@1!" | INVALID_OR_EXPIRED_TOKEN   | "This password reset link is invalid or has expired."              |
    | "valid-token"     | "weak"          | WEAK_NEW_PASSWORD           | "Password must be at least 8 characters..."                        |
    | "valid-token"     | "CurrentP@ss1"  | SAME_PASSWORD              | "New password must be different from your current password."       |
```

### Scenario: Password reset request does not leak email existence

```gherkin
Scenario: Password reset request preserves email privacy
  Given the email "nonexistent@example.com" is not registered
  When a password reset is requested for "nonexistent@example.com"
  Then the system responds with "If an account with this email exists, a password reset link has been sent."
  And no email is actually sent
  And the response time is similar to a valid request (no timing side-channel)
```

### Scenario: Concurrent reset token race condition

```gherkin
Scenario: Only one concurrent reset succeeds for the same token
  Given the user "user@example.com" has a valid reset token "token-123"
  When two reset requests arrive simultaneously with the same token "token-123"
  Then exactly one succeeds and updates the password
  And the other receives INVALID_OR_EXPIRED_TOKEN
  And the token "token-123" is consumed only once
```

### Scenario: Multiple reset requests invalidate previous tokens

```gherkin
Scenario: New reset request invalidates old token
  Given the user "user@example.com" requested password reset and received token "first-token"
  When the user requests another password reset for "user@example.com" and receives "second-token"
  Then password reset with "first-token" fails with INVALID_OR_EXPIRED_TOKEN
  And password reset with "second-token" succeeds
```

### Scenario: Password reset unlocks account

```gherkin
Scenario: Password reset unlocks a locked account
  Given the user "user@example.com" has a verified account
  And the account is locked due to too many failed login attempts
  And the user requests and receives a reset token "unlock-token"
  When the user resets password with token "unlock-token" and new password "FreshP@ss1!"
  Then the password is updated
  And the account lock is removed
  And the failed login counter is reset to 0
  And the user can log in with new password "FreshP@ss1!"
```

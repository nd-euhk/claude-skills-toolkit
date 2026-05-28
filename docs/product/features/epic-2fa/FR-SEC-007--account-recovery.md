---
title: "FR-SEC-007: Account Recovery When 2FA Device Lost"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-account-recovery-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-007--account-recovery-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-007--account-recovery-test.md
  - ../frontend/app-web/implementation/FR-SEC-007--account-recovery-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-007--account-recovery-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-007: Account Recovery When 2FA Device Lost

## Description

Provides a secure account recovery process for users who have lost access to their TOTP device and have no remaining recovery codes. The recovery process verifies the user's identity through alternate channels (email, SMS) before allowing 2FA to be disabled and re-enabled with a new device. The process includes a mandatory waiting period to prevent social engineering attacks.

## Preconditions

- User has an active account with 2FA enabled
- User cannot provide a valid TOTP code (device lost, reset, or damaged)
- User has no remaining unused recovery codes
- User has access to at least one verified recovery channel (email or phone) on their account
- User's account is not locked or suspended

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| username_or_email | string | Yes | Must match an existing account | "alice" or "alice@example.com" |
| recovery_channel | enum | Yes | "email" or "sms" | "email" |
| verification_code | string | Yes (step 2) | 6-digit code sent to recovery channel | "837201" |
| identity_answers | object | Conditional | Required if identity verification configured | {"question_1": "Fluffy"} |

## Process

### Initiating Recovery
1. User is at login screen, fails 2FA challenge, and clicks "Lost access to authenticator?"
2. User is asked if they have recovery codes -- if yes, directed to use recovery code flow (FR-SEC-003)
3. If no recovery codes, user initiates account recovery
4. System verifies the account exists and has 2FA enabled
5. System presents available recovery channels (email, SMS -- only verified channels on the account)

### Identity Verification (Step 1 -- Channel Verification)
1. User selects a recovery channel (email or SMS)
2. System sends a 6-digit time-limited verification code (TTL: 10 minutes) to the selected channel
3. Communication is rate-limited: maximum 3 codes sent per hour per account
4. User enters the verification code
5. If correct: proceed to waiting period
6. If incorrect: allow retry (max 3 attempts per code), then require new code

### Mandatory Waiting Period (Security Cooling-Off)
1. After successful channel verification, a 24-hour waiting period begins
2. User is shown a countdown timer
3. User receives an email notification: "An account recovery was initiated. If this was not you, contact support immediately."
4. During waiting period, user can cancel the recovery (which terminates the process)

### Identity Verification (Step 2 -- Post Waiting Period)
1. After 24-hour waiting period, user receives a second notification
2. If identity verification questions were configured: user must answer them correctly (minimum 2 of 3)
3. If no identity questions: user must provide 2 out of 3: last password character, account creation month, recent activity detail

### Completing Recovery
1. After successful identity verification, 2FA is disabled on the account
2. All existing sessions are invalidated
3. All trusted devices are revoked
4. All recovery codes are invalidated
5. User is redirected to set up 2FA with a new device (FR-SEC-001, FR-SEC-002)
6. New recovery codes are generated (FR-SEC-003)
7. Comprehensive audit log entries are created for the entire recovery process
8. Security notification email is sent

### Canceling Recovery
1. User can cancel recovery at any point during the waiting period
2. Cancellation requires no additional verification (user is already in control of the email/SMS channel)
3. All pending recovery state is purged
4. Existing 2FA remains active

## Output

### Success (Recovery Initiated)

```json
{
  "status": "recovery_initiated",
  "recovery_id": "rec_abc123",
  "recovery_channel": "email",
  "masked_channel": "a***e@example.com",
  "verification_code_expires_at": "2026-05-27T10:10:00Z",
  "message": "A verification code has been sent to your email. Enter the code to begin the recovery process."
}
```

### Success (Channel Verified -- Waiting Period)

```json
{
  "status": "waiting_period",
  "recovery_id": "rec_abc123",
  "waiting_period_ends_at": "2026-05-28T10:05:00Z",
  "remaining_seconds": 86400,
  "message": "For security reasons, account recovery requires a 24-hour waiting period. You will be notified when you can complete the recovery.",
  "can_cancel": true
}
```

### Success (Recovery Complete)

```json
{
  "status": "recovery_complete",
  "message": "Two-factor authentication has been disabled. Please set up 2FA with your new device.",
  "redirect_to": "2fa_setup"
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_ACCOUNT_NOT_FOUND | 404 | Username/email does not match any account | "No account found with the provided information." |
| SEC_2FA_NOT_ENABLED | 400 | Account does not have 2FA enabled | "Two-factor authentication is not enabled on this account." |
| SEC_RECOVERY_CODE_AVAILABLE | 400 | User still has unused recovery codes | "You have unused recovery codes. Please use a recovery code to log in instead." |
| SEC_INVALID_VERIFICATION_CODE | 401 | Submitted code does not match sent code | "Invalid verification code. Please try again." |
| SEC_CODE_EXPIRED | 410 | Verification code TTL (10 minutes) exceeded | "Verification code has expired. Please request a new code." |
| SEC_TOO_MANY_CODE_REQUESTS | 429 | More than 3 code requests per hour | "Too many verification code requests. Please try again in 1 hour." |
| SEC_IDENTITY_VERIFICATION_FAILED | 401 | Identity questions answered incorrectly | "Identity verification failed. Recovery cannot proceed." |
| SEC_WAITING_PERIOD_NOT_ELAPSED | 400 | User attempts to complete recovery before 24 hours | "The security waiting period has not elapsed. Please wait and try again." |
| SEC_RECOVERY_ALREADY_IN_PROGRESS | 409 | Another recovery is already in progress | "An account recovery is already in progress. Check your email for details." |
| SEC_RECOVERY_CANCELED | 410 | Recovery was canceled by user or admin | "This recovery request has been canceled." |
| SEC_TOO_MANY_IDENTITY_FAILURES | 429 | 3 failed identity verification attempts | "Too many failed identity verification attempts. Recovery has been canceled for security. Please contact support." |

## Gherkin Scenarios

```gherkin
Scenario Outline: User initiates account recovery via email
  Given a user "<username>" has 2FA enabled
  And the user has no remaining recovery codes
  And the user has a verified email "<email>" on the account
  When the user clicks "Lost access to authenticator?" at the 2FA challenge screen
  And the user confirms they have no recovery codes
  And the user selects recovery channel "email"
  Then a 6-digit verification code is sent to "<email>"
  And the code expires in exactly 10 minutes
  And a recovery session is created with status "recovery_initiated"

  Examples:
  | username | email              |
  | alice    | alice@example.com  |
  | bob      | bob@example.com    |

Scenario Outline: User completes full recovery process successfully
  Given a user "<username>" has initiated account recovery
  And the user received a verification code at "<recovery_channel>"
  When the user enters the correct verification code "<code>"
  Then the recovery enters the 24-hour waiting period
  And a notification email is sent warning about the recovery attempt
  When 24 hours have elapsed
  And the user correctly answers identity verification questions
  Then 2FA is disabled on the account
  And all sessions are invalidated
  And all trusted devices are revoked
  And all recovery codes are invalidated
  And the user is redirected to set up 2FA with a new device
  And new recovery codes are generated
  And a security notification email is sent

  Examples:
  | username | recovery_channel | code   |
  | alice    | email            | 837201 |
  | bob      | sms              | 492618 |

Scenario Outline: User provides invalid verification code
  Given a user "<username>" has initiated account recovery
  When the user enters verification code "<code>"
  Then the attempt fails with status "<status>"
  And the error code is "<error_code>"

  Examples:
  | username | code   | status | error_code                    |
  | alice    | 000000 | 401    | SEC_INVALID_VERIFICATION_CODE  |
  | alice    | 123456 | 401    | SEC_INVALID_VERIFICATION_CODE  |
  | bob      |        | 400    | SEC_VALIDATION_ERROR           |

Scenario: User cancels recovery during waiting period
  Given a user "alice" is in the 24-hour waiting period for account recovery
  When the user clicks "Cancel recovery"
  Then the recovery is immediately canceled
  And all recovery state is purged
  And 2FA remains enabled on the account
  And a cancellation confirmation email is sent

Scenario: Recovery fails due to identity verification
  Given a user "alice" has completed the 24-hour waiting period
  When the user fails identity verification 3 times
  Then the recovery is canceled for security
  And the error code is SEC_TOO_MANY_IDENTITY_FAILURES
  And the user is directed to contact support
  And a security alert email is sent

Scenario: User attempts recovery when they have unused recovery codes
  Given a user "alice" has 2FA enabled
  And the user has 3 unused recovery codes
  When the user attempts to initiate account recovery
  Then the request is rejected with status 400
  And the error code is SEC_RECOVERY_CODE_AVAILABLE
  And the user is directed to use a recovery code instead

Scenario: Verification code expires before use
  Given a user "alice" has initiated account recovery
  And a verification code was sent
  And 11 minutes have elapsed
  When the user enters the verification code
  Then the request is rejected with status 410
  And the error code is SEC_CODE_EXPIRED
  And the user must request a new code

Scenario: Rate limiting on verification code requests
  Given a user "alice" has requested 3 verification codes in the past hour
  When the user requests a 4th verification code
  Then the request is rejected with status 429
  And the error code is SEC_TOO_MANY_CODE_REQUESTS

Scenario: Concurrency -- two recovery processes for same account
  Given a user "alice" has initiated account recovery via email
  And the recovery is in "waiting_period" state
  When the user attempts to initiate a second recovery via SMS
  Then the second request is rejected with status 409
  And the error code is SEC_RECOVERY_ALREADY_IN_PROGRESS

Scenario: Concurrency -- recovery completion race condition
  Given a user "alice" is at the identity verification step after the waiting period
  When two concurrent requests attempt to complete the recovery with correct identity answers
  Then exactly one recovery completion succeeds
  And the second request detects recovery has already been completed
```

## Constraints

- User must have NO remaining unused recovery codes to initiate recovery
- Verification code TTL: exactly 10 minutes
- Maximum 3 verification code requests per hour per account
- Maximum 3 verification code entry attempts per code
- Mandatory waiting period: exactly 24 hours (cannot be shortened by any user or admin)
- Identity verification: minimum 2 out of 3 questions answered correctly
- Maximum 3 identity verification attempts; failure cancels recovery
- NFR-SEC-006: All recovery steps produce audit log entries
- Recovery notification email is mandatory at initiation and completion
- Only verified channels (email, phone) on the user's account may be used for recovery

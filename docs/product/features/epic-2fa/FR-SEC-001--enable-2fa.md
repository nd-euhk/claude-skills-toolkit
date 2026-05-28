---
title: "FR-SEC-001: Enable Two-Factor Authentication"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-enable-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-001--enable-2fa-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-001--enable-2fa-test.md
  - ../frontend/app-web/implementation/FR-SEC-001--enable-2fa-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-001--enable-2fa-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-001: Enable Two-Factor Authentication

## Description

Allows an authenticated user to enable two-factor authentication on their account. The user must re-authenticate with their current password, then set up a TOTP authenticator app (see FR-SEC-002). Once TOTP is configured and verified, 2FA becomes active. The user may also disable 2FA by providing a valid second factor or recovery code.

## Preconditions

- User is authenticated with a valid session
- User's account exists and is in good standing
- User has not already enabled 2FA on this account (for enable flow)
- User has already enabled 2FA (for disable flow)

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| current_password | string | Yes (enable) | Must match stored credential | "MyS3cur3P@ss!" |
| second_factor_code | string | Yes (disable) | Valid TOTP or recovery code | "482916" |
| action | enum | Yes | "enable" or "disable" | "enable" |

## Process

1. Validate that the user's current session is valid and authenticated
2. For enable: verify current_password is correct
3. For disable: verify second_factor_code is valid (TOTP or recovery code)
4. Update account 2FA status
5. Generate audit log entry for the state change
6. Invalidate all existing sessions (force global logout)
7. Notify user via email about the 2FA status change

## Output

### Success (2FA Enabled)

```json
{
  "status": "enabled",
  "message": "Two-factor authentication has been enabled on your account.",
  "backup_codes_available": true
}
```

### Success (2FA Disabled)

```json
{
  "status": "disabled",
  "message": "Two-factor authentication has been disabled on your account."
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_INVALID_PASSWORD | 401 | Current password does not match | "Current password is incorrect." |
| SEC_2FA_ALREADY_ENABLED | 409 | User attempts to enable when already enabled | "Two-factor authentication is already enabled on this account." |
| SEC_2FA_NOT_ENABLED | 409 | User attempts to disable when 2FA is not active | "Two-factor authentication is not enabled on this account." |
| SEC_INVALID_2FA_CODE | 401 | TOTP or recovery code is invalid | "The provided verification code is invalid." |
| SEC_RATE_LIMITED | 429 | Too many attempts in time window | "Too many attempts. Please wait 5 minutes and try again." |
| SEC_SESSION_EXPIRED | 401 | Session is no longer valid | "Your session has expired. Please log in again." |

## Gherkin Scenarios

```gherkin
Scenario Outline: User enables 2FA successfully
  Given a user "<username>" is authenticated
  And the user's account does not have 2FA enabled
  And the user has set up a TOTP authenticator app
  When the user requests to enable 2FA with their current password "<password>"
  And the user provides a valid TOTP code "<totp_code>"
  Then 2FA is enabled on the account
  And the user receives "<num_backup_codes>" backup recovery codes
  And all existing sessions are invalidated
  And an audit log entry is created for the 2FA enable event
  And a notification email is sent to "<email>"

  Examples:
  | username    | password       | totp_code | num_backup_codes | email              |
  | alice       | S3cur3P@ss!    | 482916    | 10               | alice@example.com  |
  | bob         | B0bP@ssw0rd!   | 739201    | 10               | bob@example.com    |
  | charlie     | Ch@rlieP@ss1   | 105847    | 10               | charlie@example.com |

Scenario Outline: User attempts to enable 2FA with invalid password
  Given a user "<username>" is authenticated
  And the user's account does not have 2FA enabled
  When the user requests to enable 2FA with password "<password>"
  Then the request is rejected with status "<status>"
  And the error code is "<error_code>"
  And the error message is "<error_message>"
  And 2FA remains disabled on the account

  Examples:
  | username | password      | status | error_code              | error_message                                |
  | alice    | WrongP@ss!    | 401    | SEC_INVALID_PASSWORD     | "Current password is incorrect."             |
  | alice    |               | 400    | SEC_VALIDATION_ERROR     | "Current password is required."              |
  | bob      | OldP@ssword!  | 401    | SEC_INVALID_PASSWORD     | "Current password is incorrect."             |

Scenario Outline: User disables 2FA successfully
  Given a user "<username>" is authenticated
  And the user's account has 2FA enabled
  When the user requests to disable 2FA with a valid "<code_type>" code "<code_value>"
  Then 2FA is disabled on the account
  And all existing sessions are invalidated
  And an audit log entry is created for the 2FA disable event
  And a notification email is sent to "<email>"

  Examples:
  | username | code_type      | code_value | email              |
  | alice    | totp           | 482916     | alice@example.com  |
  | bob      | recovery_code  | A1B2C3D4E5F6G7H8 | bob@example.com    |

Scenario Outline: User attempts to disable 2FA with invalid code
  Given a user "<username>" is authenticated
  And the user's account has 2FA enabled
  When the user requests to disable 2FA with code "<code_value>"
  Then the request is rejected with status "<status>"
  And the error code is "<error_code>"
  And 2FA remains enabled on the account

  Examples:
  | username | code_value    | status | error_code           |
  | alice    | 000000        | 401    | SEC_INVALID_2FA_CODE  |
  | alice    | expired_code  | 401    | SEC_INVALID_2FA_CODE  |
  | bob      |               | 400    | SEC_VALIDATION_ERROR  |

Scenario: Idempotent 2FA enable request
  Given a user "alice" is authenticated
  And the user's account does not have 2FA enabled
  When the user submits two concurrent requests to enable 2FA
  Then exactly one enable operation succeeds
  And the second request receives status 409 with error SEC_2FA_ALREADY_ENABLED

Scenario: Rate limiting on failed enable attempts
  Given a user "alice" is authenticated
  And the user's account does not have 2FA enabled
  When the user makes 5 failed attempts to enable 2FA with wrong password within 5 minutes
  Then the 6th attempt is rejected with status 429
  And the error code is SEC_RATE_LIMITED
  And the user must wait 5 minutes before retrying
```

## Constraints

- 2FA cannot be enabled unless TOTP setup (FR-SEC-002) has been verified with at least one successful code
- 2FA cannot be disabled without a valid second factor or recovery code
- Enabling 2FA must invalidate all existing sessions
- Password re-authentication is mandatory before enabling 2FA
- NFR-SEC-006: All state changes produce immutable audit log entries
- NFR-SEC-003: Rate limit of 5 attempts per 5 minutes per user applies
- NFR-SEC-012: Session invalidation on 2FA enable/disable

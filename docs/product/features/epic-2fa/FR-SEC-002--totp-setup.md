---
title: "FR-SEC-002: TOTP Authenticator App Setup"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-totp-setup-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-002--totp-setup-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-002--totp-setup-test.md
  - ../frontend/app-web/implementation/FR-SEC-002--totp-setup-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-002--totp-setup-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-002: TOTP Authenticator App Setup

## Description

Guides the user through setting up a Time-based One-Time Password (TOTP) authenticator app following RFC 6238. The system generates a unique TOTP secret, displays it as a QR code and manual entry key, and verifies that the user can successfully produce a valid TOTP code before activating the setup.

## Preconditions

- User is authenticated with a valid session
- User has re-authenticated with current password (per FR-SEC-001 enable flow, or standalone re-auth)
- User's account does not have an active TOTP secret (or user is re-configuring, which requires disabling 2FA first)

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| totp_code | string | Yes (for verification) | Exactly 6 digits, valid per RFC 6238 | "482916" |

## Process

1. Generate a cryptographically secure random secret key of >= 160 bits (20 bytes)
2. Derive the otpauth:// URI per the Google Authenticator key URI format
3. Present the secret to the user via:
   - QR code image (rendered from otpauth:// URI)
   - Manual entry key (Base32-encoded secret)
4. Store the secret in encrypted form (encrypted at rest), marked as "pending_verification"
5. User scans QR code or enters manual key into their authenticator app
6. User submits the current TOTP code from their app
7. Verify the submitted code is valid for the current 30-second window
8. If valid: mark secret as "active", enable 2FA on account
9. If invalid: allow retries (up to 3 attempts), then require restarting setup
10. Generate audit log entry for TOTP setup completion

## Output

### Success (TOTP Setup Initiated)

```json
{
  "status": "pending_verification",
  "qr_code_uri": "otpauth://totp/ExampleApp:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ExampleApp",
  "manual_entry_key": "JBSWY3DPEHPK3PXP",
  "expires_at": "2026-05-27T10:05:00Z"
}
```

### Success (TOTP Verified)

```json
{
  "status": "verified",
  "message": "TOTP authenticator app has been set up successfully.",
  "backup_codes_generated": true
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_INVALID_TOTP_CODE | 401 | Submitted TOTP code does not match expected value | "The verification code is invalid. Please try again." |
| SEC_TOTP_SETUP_EXPIRED | 410 | Pending setup has timed out (5 minute expiry) | "Setup session has expired. Please start the setup process again." |
| SEC_TOTP_ALREADY_ACTIVE | 409 | User already has an active TOTP configuration | "A TOTP authenticator is already configured for this account." |
| SEC_TOO_MANY_VERIFY_ATTEMPTS | 429 | 3 failed verification attempts | "Too many failed attempts. Please restart the setup process." |
| SEC_WEAK_SECRET | 500 | Random number generator failure produced insufficient entropy | "Unable to generate a secure secret. Please try again." |

## Gherkin Scenarios

```gherkin
Scenario Outline: User sets up TOTP authenticator app successfully
  Given a user "<username>" is authenticated and has re-authenticated with password
  And the user's account does not have an active TOTP configuration
  When the user initiates TOTP setup
  Then a cryptographically secure secret key of at least 160 bits is generated
  And a QR code containing the otpauth:// URI is displayed
  And a manual entry key in Base32 format is displayed
  And the secret is stored in encrypted form with status "pending_verification"
  When the user scans the QR code with their authenticator app "<app_name>"
  And the user submits the current TOTP code "<totp_code>" from the app
  Then the TOTP code is verified as valid
  And the TOTP configuration status changes to "active"
  And backup recovery codes are generated (see FR-SEC-003)
  And an audit log entry is created

  Examples:
  | username | app_name              | totp_code | email              |
  | alice    | Google Authenticator  | 482916    | alice@example.com  |
  | bob      | Authy                 | 739201    | bob@example.com    |
  | charlie  | Microsoft Authenticator | 105847  | charlie@example.com |

Scenario Outline: User provides invalid TOTP code during setup verification
  Given a user "<username>" has initiated TOTP setup
  And the setup is in "pending_verification" state
  When the user submits TOTP code "<totp_code>"
  Then the verification fails with status "<status>"
  And the error code is "<error_code>"
  And the TOTP configuration remains "pending_verification"

  Examples:
  | username | totp_code | status | error_code                |
  | alice    | 000000    | 401    | SEC_INVALID_TOTP_CODE      |
  | alice    | 999999    | 401    | SEC_INVALID_TOTP_CODE      |
  | bob      | abcdef    | 400    | SEC_VALIDATION_ERROR       |

Scenario: TOTP setup session expires before verification
  Given a user "alice" has initiated TOTP setup
  And the setup has been in "pending_verification" state for 5 minutes
  When the user submits a TOTP code
  Then the request is rejected with status 410
  And the error code is SEC_TOTP_SETUP_EXPIRED
  And the pending secret is purged

Scenario: User exceeds maximum verification attempts
  Given a user "alice" has initiated TOTP setup
  And the setup is in "pending_verification" state
  When the user submits 3 consecutive invalid TOTP codes
  Then the 4th attempt is rejected with status 429
  And the error code is SEC_TOO_MANY_VERIFY_ATTEMPTS
  And the pending secret is purged
  And the user must restart the setup process

Scenario: TOTP secret generation produces sufficient entropy
  Given a user requests TOTP setup
  When the system generates a TOTP secret key
  Then the secret key length is at least 160 bits (20 bytes)
  And the secret is generated using a FIPS 140-2 compliant random number generator

Scenario: Concurrency -- duplicate setup initiation
  Given a user "alice" is authenticated
  And the user does not have an active TOTP configuration
  When the user submits two concurrent TOTP setup requests
  Then exactly one setup session is created
  And the second request receives status 409 with error SEC_TOTP_ALREADY_ACTIVE or the first session's details

Scenario: Concurrency -- duplicate verification
  Given a user "alice" has a pending TOTP setup
  When the user submits two concurrent TOTP verification requests with the same valid code
  Then exactly one verification succeeds
  And the second request receives status 409 (already active) or detects the code has already been consumed
```

## Constraints

- TOTP implementation MUST conform to RFC 6238 (TOTP: Time-Based One-Time Password Algorithm)
- Secret key MUST be >= 160 bits as recommended by RFC 4226 (HOTP)
- QR code MUST use the standard otpauth:// URI format (Google Authenticator key URI format)
- Secret MUST be encrypted at rest using AES-256-GCM (NFR-SEC-001)
- Setup session expires after exactly 5 minutes of inactivity
- Maximum 3 verification attempts per setup session
- NFR-SEC-008: TOTP secret must never appear in logs, responses, or error messages after initial display
- The manual entry key (Base32) displayed during setup is the ONLY time the secret is shown in plaintext

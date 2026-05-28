---
title: "FR-SEC-003: Backup Recovery Codes"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-recovery-codes-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-003--recovery-codes-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-003--recovery-codes-test.md
  - ../frontend/app-web/implementation/FR-SEC-003--recovery-codes-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-003--recovery-codes-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-003: Backup Recovery Codes

## Description

Generates a set of single-use backup recovery codes when 2FA is first enabled. These codes allow a user to authenticate when their TOTP device is unavailable. Each code can be used exactly once. Users can view remaining unused codes, regenerate a new set (invalidating the old set), and use a recovery code during login.

## Preconditions

- User is authenticated with a valid session
- User has 2FA enabled on their account
- For code generation: TOTP has just been verified (FR-SEC-002) or user explicitly requests regeneration
- For code regeneration: user provides a valid second factor or an existing unused recovery code

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| recovery_code | string | Yes (for use) | 16 alphanumeric characters | "A1B2C3D4E5F6G7H8" |
| action | enum | Yes (for management) | "generate" or "regenerate" | "regenerate" |
| auth_code | string | Yes (for regenerate) | Valid TOTP or existing recovery code | "482916" |

## Process

### Generation (on 2FA enable)
1. After TOTP verification succeeds (FR-SEC-002), generate exactly 10 recovery codes
2. Each code: 16 alphanumeric characters from cryptographically secure random source
3. Hash each code with a strong one-way hash before storage
4. Display all 10 codes to the user exactly once
5. User is prompted to download, print, or copy the codes

### Usage (during login)
1. User submits a recovery code instead of TOTP code
2. Hash the submitted code and compare against stored unused hashed codes
3. If match found: mark code as consumed, authenticate the user
4. If no match: increment failed attempt counter
5. After 3 invalid recovery code attempts in 10 minutes: lock the account

### Regeneration
1. Verify user identity (TOTP code or existing unused recovery code)
2. Invalidate all existing unused recovery codes
3. Generate a new set of 10 codes
4. Display new codes exactly once
5. Notify user via email about code regeneration

## Output

### Success (Codes Generated)

```json
{
  "recovery_codes": [
    "A1B2C3D4E5F6G7H8",
    "I9J0K1L2M3N4O5P6",
    "Q7R8S9T0U1V2W3X4",
    "Y5Z6A7B8C9D0E1F2",
    "G3H4I5J6K7L8M9N0",
    "O1P2Q3R4S5T6U7V8",
    "W9X0Y1Z2A3B4C5D6",
    "E7F8G9H0I1J2K3L4",
    "M5N6O7P8Q9R0S1T2",
    "U3V4W5X6Y7Z8A9B0"
  ],
  "message": "Save these recovery codes in a secure location. Each code can be used once. You will not be able to view these codes again.",
  "total_codes": 10,
  "generated_at": "2026-05-27T10:00:00Z"
}
```

### Success (Code Used for Authentication)

```json
{
  "authenticated": true,
  "method": "recovery_code",
  "codes_remaining": 9,
  "warning": "You have 9 recovery codes remaining. Consider regenerating your codes."
}
```

### Success (Codes Regenerated)

```json
{
  "message": "New recovery codes generated. Previous codes are now invalid.",
  "total_codes": 10,
  "generated_at": "2026-05-27T12:00:00Z"
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_INVALID_RECOVERY_CODE | 401 | Submitted code does not match any unused code | "Invalid recovery code. Please try again." |
| SEC_RECOVERY_CODE_USED | 401 | Submitted code was already consumed | "This recovery code has already been used." |
| SEC_RECOVERY_LOCKOUT | 423 | 3 invalid recovery code attempts in 10 minutes | "Account temporarily locked due to too many failed recovery attempts. Please try again in 10 minutes." |
| SEC_NO_RECOVERY_CODES | 404 | User has no remaining recovery codes | "No recovery codes available. Please use your authenticator app or contact support." |
| SEC_REGEN_AUTH_REQUIRED | 401 | Regeneration attempted without valid auth | "Authentication required to regenerate recovery codes." |
| SEC_RATE_LIMITED | 429 | Too many regeneration requests | "Too many requests. Please wait before regenerating again." |

## Gherkin Scenarios

```gherkin
Scenario Outline: Recovery codes are generated on 2FA enable
  Given a user "<username>" has just verified TOTP setup
  When the TOTP verification succeeds
  Then exactly 10 recovery codes are generated
  And each code is 16 alphanumeric characters
  And the codes are displayed to the user exactly once
  And the codes are stored as one-way hashes
  And no plaintext codes are retained after display

  Examples:
  | username | email              |
  | alice    | alice@example.com  |
  | bob      | bob@example.com    |

Scenario Outline: User authenticates with a valid recovery code
  Given a user "<username>" has 2FA enabled
  And the user has "<codes_remaining>" unused recovery codes
  And the user is at the 2FA challenge screen
  When the user submits recovery code "<recovery_code>"
  Then authentication succeeds
  And the code is marked as consumed
  And the user has "<codes_after>" recovery codes remaining
  And a warning is displayed if remaining codes are below threshold "<warn_threshold>"

  Examples:
  | username | codes_remaining | recovery_code       | codes_after | warn_threshold |
  | alice    | 10              | A1B2C3D4E5F6G7H8   | 9           | 3              |
  | bob      | 3               | I9J0K1L2M3N4O5P6   | 2           | 3              |
  | charlie  | 1               | Q7R8S9T0U1V2W3X4   | 0           | 3              |

Scenario Outline: User submits invalid or already-used recovery code
  Given a user "<username>" is at the 2FA challenge screen
  When the user submits recovery code "<recovery_code>"
  Then the request is rejected with status "<status>"
  And the error code is "<error_code>"

  Examples:
  | username | recovery_code       | status | error_code                 |
  | alice    | 0000000000000000    | 401    | SEC_INVALID_RECOVERY_CODE   |
  | alice    | A1B2C3D4E5F6G7H8   | 401    | SEC_RECOVERY_CODE_USED      |
  | bob      | XXXXXXXXXXXXXXXX    | 401    | SEC_INVALID_RECOVERY_CODE   |

Scenario: Account locks after multiple failed recovery code attempts
  Given a user "alice" is at the 2FA challenge screen
  When the user submits 3 invalid recovery codes within 10 minutes
  Then the account is locked with status 423
  And the error code is SEC_RECOVERY_LOCKOUT
  And the lockout persists for 10 minutes
  And an audit log entry is created
  And a security notification email is sent

Scenario: User regenerates recovery codes
  Given a user "alice" has 2FA enabled with 7 remaining recovery codes
  When the user requests to regenerate recovery codes
  And provides a valid TOTP code for authorization
  Then all 7 existing unused codes are invalidated
  And 10 new recovery codes are generated
  And the new codes are displayed exactly once
  And a notification email is sent about code regeneration

Scenario: Recovery codes are NOT viewable after initial display
  Given a user "alice" has 2FA enabled
  And recovery codes were generated during setup
  When the user navigates to the security settings page
  Then the plaintext recovery codes are NOT displayed
  And only the count of remaining codes and generation date are shown

Scenario: Concurrency -- same recovery code used twice simultaneously
  Given a user "alice" has an unused recovery code "A1B2C3D4E5F6G7H8"
  When two concurrent authentication requests submit the same recovery code
  Then exactly one authentication succeeds
  And the second request receives status 401 with error SEC_RECOVERY_CODE_USED or SEC_INVALID_RECOVERY_CODE

Scenario: Regeneration concurrency
  Given a user "alice" has 2FA enabled
  When two concurrent recovery code regeneration requests are submitted
  Then exactly one regeneration succeeds
  And the second request receives status 429 (rate limited) or detects codes were just regenerated
```

## Constraints

- Exactly 10 recovery codes per set
- Each code: 16 characters, alphanumeric (A-Z, 0-9), generated with cryptographic randomness
- Codes stored as one-way hashes only (NFR-SEC-004)
- Codes displayed exactly once -- never retrievable in plaintext after initial display (NFR-SEC-010)
- Maximum 3 invalid recovery code attempts in 10 minutes (NFR-SEC-005)
- Regeneration requires re-authentication with valid TOTP or existing recovery code (NFR-SEC-009)
- NFR-SEC-006: All code usage and regeneration events produce audit log entries
- Codes are single-use only; used codes cannot be restored

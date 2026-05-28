---
title: "FR-SEC-004: 2FA Challenge During Login"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-login-challenge-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-004--2fa-login-challenge-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-004--2fa-login-challenge-test.md
  - ../frontend/app-web/implementation/FR-SEC-004--2fa-login-challenge-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-004--2fa-login-challenge-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-004: 2FA Challenge During Login

## Description

After a user successfully authenticates with username and password, the system checks whether 2FA is enabled. If enabled, the user is presented with a 2FA challenge before gaining full access. The user must provide a valid TOTP code or recovery code. If the user has a remembered trusted device (FR-SEC-005), the 2FA challenge may be skipped.

## Preconditions

- User has submitted valid username and password credentials
- User's account exists and is not locked or suspended
- User has 2FA enabled on their account

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| challenge_response | string | Yes | 6-digit TOTP code or 16-char recovery code | "482916" |
| challenge_type | enum | Yes | "totp" or "recovery_code" | "totp" |
| session_token | string | Yes | Interim session token from password auth step | "eyJ..." |

## Process

1. Receive username/password authentication request
2. Validate credentials
3. If credentials valid: check if 2FA is enabled on the account
4. If 2FA is disabled: issue full session token immediately
5. If 2FA is enabled: issue an interim session token (limited privileges, short TTL)
6. Check if the request includes a valid trusted device token (FR-SEC-005)
7. If trusted device token is valid: skip challenge, issue full session token
8. If no trusted device: present 2FA challenge to user
9. User submits TOTP code or recovery code
10. Validate the code:
    - TOTP: verify against current 30-second window (RFC 6238), allow one window of clock drift
    - Recovery code: hash and compare against stored unused codes
11. If valid: issue full session token, consume code if applicable
12. If invalid: increment failure counter, apply progressive delay
13. After 5 consecutive failures: apply rate limiting (NFR-SEC-003)
14. Record audit log entry for the 2FA challenge result

## Output

### Success (2FA Required -- Interim Token)

```json
{
  "status": "2fa_required",
  "session_token": "eyJ...interim...",
  "methods": ["totp", "recovery_code"],
  "expires_in": 300
}
```

### Success (2FA Verified -- Full Token)

```json
{
  "status": "authenticated",
  "session_token": "eyJ...full...",
  "expires_in": 900,
  "refresh_token": "eyJ...refresh...",
  "user": {
    "id": "usr_abc123",
    "username": "alice"
  }
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_INVALID_CHALLENGE | 401 | TOTP or recovery code is invalid | "Invalid verification code. Please try again." |
| SEC_CHALLENGE_EXPIRED | 401 | Interim session token has expired (> 5 minutes) | "Login session expired. Please log in again." |
| SEC_CHALLENGE_RATE_LIMITED | 429 | 5 failed 2FA attempts in 5 minutes | "Too many failed attempts. Please wait 5 minutes and try again." |
| SEC_PROGRESSIVE_DELAY | 429 | Progressive delay after consecutive failures | "Please wait <N> seconds before retrying." |
| SEC_ACCOUNT_LOCKED | 423 | Account locked due to excessive failures or admin action | "Account is temporarily locked. Please contact support." |
| SEC_INVALID_SESSION | 401 | Interim token is invalid or tampered | "Invalid login session." |

## Gherkin Scenarios

```gherkin
Scenario Outline: User completes 2FA challenge with valid TOTP code
  Given a user "<username>" has valid username and password credentials
  And the user's account has 2FA enabled
  When the user submits their username "<username>" and password "<password>"
  Then an interim session token is issued with status "2fa_required"
  When the user submits TOTP code "<totp_code>" with the interim token
  Then authentication succeeds with status "authenticated"
  And a full session token is issued with expiry of "<session_ttl>" seconds
  And a refresh token is issued

  Examples:
  | username | password       | totp_code | session_ttl |
  | alice    | S3cur3P@ss!    | 482916    | 900         |
  | bob      | B0bP@ssw0rd!   | 739201    | 900         |

Scenario Outline: User completes 2FA challenge with valid recovery code
  Given a user "<username>" has valid credentials and 2FA enabled
  When the user receives the 2FA challenge
  And the user submits recovery code "<recovery_code>"
  Then authentication succeeds
  And the recovery code is consumed (marked as used)
  And the user is warned about "<remaining>" remaining recovery codes

  Examples:
  | username | recovery_code       | remaining |
  | alice    | A1B2C3D4E5F6G7H8   | 9         |
  | bob      | I9J0K1L2M3N4O5P6   | 2         |

Scenario Outline: User provides invalid TOTP code during challenge
  Given a user "<username>" is at the 2FA challenge screen
  When the user submits TOTP code "<totp_code>"
  Then the challenge fails with status "<status>"
  And the error code is "<error_code>"
  And the failure count increments

  Examples:
  | username | totp_code | status | error_code              |
  | alice    | 000000    | 401    | SEC_INVALID_CHALLENGE    |
  | alice    | 999999    | 401    | SEC_INVALID_CHALLENGE    |
  | bob      | abcdef    | 400    | SEC_VALIDATION_ERROR     |

Scenario: Progressive delay after consecutive 2FA failures
  Given a user "alice" is at the 2FA challenge screen
  When the user submits an invalid TOTP code (1st failure)
  Then the user can retry immediately
  When the user submits another invalid TOTP code (2nd failure)
  Then a 1-second delay is enforced before retry
  When the user submits another invalid TOTP code (3rd failure)
  Then a 2-second delay is enforced
  When the user submits another invalid TOTP code (4th failure)
  Then a 4-second delay is enforced
  When the user submits another invalid TOTP code (5th failure)
  Then an 8-second delay is enforced
  When the user submits another invalid TOTP code (6th failure)
  Then the request is rejected with status 429
  And the error code is SEC_CHALLENGE_RATE_LIMITED
  And a 5-minute lockout is enforced

Scenario: Login session expires during 2FA challenge
  Given a user "alice" has received an interim session token
  And 5 minutes have elapsed since the interim token was issued
  When the user submits a TOTP code with the expired interim token
  Then the request is rejected with status 401
  And the error code is SEC_CHALLENGE_EXPIRED
  And the user must restart the login process from username/password

Scenario: User without 2FA enabled logs in directly
  Given a user "dave" has valid credentials
  And the user's account does NOT have 2FA enabled
  When the user submits username and password
  Then authentication succeeds immediately
  And a full session token is issued
  And no 2FA challenge is presented

Scenario: Concurrency -- multiple simultaneous 2FA challenges
  Given a user "alice" has received an interim session token
  When two concurrent requests submit valid TOTP codes for the same interim token
  Then exactly one authentication succeeds
  And the second request detects the session has already been upgraded and returns an error

Scenario: TOTP code replay prevention
  Given a user "alice" is at the 2FA challenge screen
  When the user submits a valid TOTP code "482916" that was already used in the last 30 seconds
  Then the code is rejected with status 401
  And the error code is SEC_INVALID_CHALLENGE
  And the message indicates the code has already been used
```

## Constraints

- TOTP verification must follow RFC 6238, allowing +/- 1 time step for clock drift
- TOTP codes must be single-use within their validity window (replay prevention)
- Interim session token TTL: exactly 300 seconds (5 minutes)
- Full session token TTL: exactly 900 seconds (15 minutes)
- Progressive delay on consecutive failures: 0s, 1s, 2s, 4s, 8s (NFR-SEC-013)
- Rate limit: 5 failed 2FA attempts per 5 minutes per user (NFR-SEC-003)
- Account lockout after 15 total failed login attempts (password + 2FA combined) in 1 hour
- NFR-SEC-006: All challenge results produce audit log entries
- Trusted device check (FR-SEC-005) occurs between password validation and 2FA challenge

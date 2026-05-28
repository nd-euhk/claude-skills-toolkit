---
title: "FR-SEC-005: Remember Trusted Device"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/2fa-trusted-device-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-005--trusted-device-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-005--trusted-device-test.md
  - ../frontend/app-web/implementation/FR-SEC-005--trusted-device-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-005--trusted-device-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-005: Remember Trusted Device

## Description

Allows users to mark a device or browser as "trusted" during the 2FA challenge. On subsequent logins from the same device, the 2FA challenge is skipped for a configurable period. Users can view and revoke trusted devices from their security settings. Trusted device tokens are bound to the specific browser/device combination and expire after a period of inactivity.

## Preconditions

- User has successfully completed a 2FA challenge (FR-SEC-004)
- User's account has 2FA enabled
- The device/browser supports persistent storage (cookies or local storage)

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| remember_device | boolean | Yes | true/false | true |
| device_name | string | No | Max 100 characters, user-provided label | "My Work Laptop" |

## Process

### Marking a Device as Trusted
1. User completes 2FA challenge successfully (FR-SEC-004)
2. User selects "Remember this device for 30 days"
3. System generates a cryptographically secure trusted device token
4. Token is stored as a secure cookie on the device
5. Token metadata (hash, device fingerprint, expiry, label) is stored server-side
6. On subsequent logins from the same device, the token is sent automatically

### Skipping 2FA with Trusted Device
1. After password validation, check for trusted device token
2. Validate token: not expired, not revoked, matches device fingerprint
3. If valid: skip 2FA challenge, issue full session token
4. Update last-used timestamp on the trusted device record

### Managing Trusted Devices
1. User views list of trusted devices with: name, browser/OS, first trusted date, last used date
2. User can revoke individual devices or all devices
3. Revocation invalidates the token immediately

### Automatic Expiry
- Tokens expire after exactly 30 days of inactivity (no successful login)
- Expired tokens are purged from the server-side registry

## Output

### Success (Device Trusted)

```json
{
  "status": "device_trusted",
  "device_id": "dev_xyz789",
  "device_name": "My Work Laptop",
  "expires_at": "2026-06-26T10:00:00Z",
  "message": "This device will be trusted for 30 days. You will not need to enter a 2FA code from this device."
}
```

### Success (Trusted Device List)

```json
{
  "trusted_devices": [
    {
      "device_id": "dev_xyz789",
      "device_name": "My Work Laptop",
      "browser": "Firefox 126",
      "os": "Ubuntu 24.04",
      "first_trusted_at": "2026-05-27T10:00:00Z",
      "last_used_at": "2026-05-27T14:30:00Z",
      "expires_at": "2026-06-26T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_TRUSTED_DEVICE_EXPIRED | 401 | Token has exceeded 30-day inactivity window | "Trusted device has expired. Please complete 2FA challenge." |
| SEC_TRUSTED_DEVICE_REVOKED | 401 | Token has been revoked by user or admin | "Trusted device has been revoked. Please complete 2FA challenge." |
| SEC_DEVICE_FINGERPRINT_MISMATCH | 401 | Device fingerprint doesn't match stored metadata | "Device verification failed. Please complete 2FA challenge." |
| SEC_TRUSTED_DEVICE_LIMIT | 409 | User has reached maximum of 10 trusted devices | "Maximum number of trusted devices reached. Please revoke an unused device first." |
| SEC_DEVICE_NOT_FOUND | 404 | Attempted to revoke non-existent device | "Device not found." |

## Gherkin Scenarios

```gherkin
Scenario Outline: User trusts a device during 2FA login
  Given a user "<username>" is at the 2FA challenge screen
  When the user submits a valid TOTP code "<totp_code>"
  And the user selects "Remember this device for 30 days"
  And optionally provides a device name "<device_name>"
  Then authentication succeeds
  And a trusted device token is stored on the device
  And the device is registered server-side with expiry of exactly 30 days

  Examples:
  | username | totp_code | device_name      |
  | alice    | 482916    | My Work Laptop   |
  | bob      | 739201    |                  |
  | charlie  | 105847    | Personal iPhone  |

Scenario Outline: 2FA challenge is skipped for trusted device
  Given a user "<username>" has a trusted device token
  And the token has not expired (last used within 30 days)
  And the device fingerprint matches
  When the user logs in with username and password
  Then the 2FA challenge is skipped
  And a full session token is issued directly

  Examples:
  | username | device_name        |
  | alice    | My Work Laptop     |
  | bob      | Personal iPhone    |

Scenario Outline: 2FA challenge is required when trusted device conditions not met
  Given a user "<username>" has a trusted device
  But "<failure_condition>"
  When the user logs in with username and password
  Then the 2FA challenge is NOT skipped
  And the user must provide a TOTP or recovery code

  Examples:
  | username | failure_condition                              |
  | alice    | the token has expired (31 days of inactivity)  |
  | bob      | the token has been revoked by the user         |
  | charlie  | the device fingerprint does not match          |
  | dave     | the token was tampered with or is invalid      |

Scenario: User views all trusted devices
  Given a user "alice" is authenticated
  And has 3 trusted devices
  When the user navigates to security settings and views trusted devices
  Then all 3 devices are listed with name, browser, OS, first trusted date, last used date
  And each device shows when it will expire

Scenario: User revokes a specific trusted device
  Given a user "alice" has 3 trusted devices
  When the user revokes device "dev_xyz789"
  Then the device token is invalidated immediately
  And the device is removed from the trusted device list
  And any active session using that trusted device token must re-authenticate with 2FA
  And an audit log entry is created

Scenario: User revokes all trusted devices
  Given a user "alice" has 3 trusted devices
  When the user selects "Revoke all trusted devices"
  Then all device tokens are invalidated immediately
  And the trusted device list is empty
  And all active sessions require 2FA on next login
  And a security notification email is sent

Scenario: Trusted device limit enforcement
  Given a user "alice" has 10 trusted devices (the maximum)
  When the user logs in on a new device and selects "Remember this device"
  Then the request is rejected with status 409
  And the error code is SEC_TRUSTED_DEVICE_LIMIT
  And the user is prompted to revoke an unused device first

Scenario: Concurrency -- device token used from different IP simultaneously
  Given a trusted device token "dev_xyz789" is stored on Alice's laptop
  When two login requests arrive with the same trusted device token from different IP addresses within 1 second
  Then the first login succeeds and skips 2FA
  And the second login triggers a security review
  And an audit log entry records the IP mismatch
  And the trusted device may be flagged for revocation
```

## Constraints

- Maximum 10 trusted devices per user account (NFR-SEC-007 related)
- Trusted device tokens expire after exactly 30 days of inactivity (NFR-SEC-007)
- Tokens must be bound to device/browser fingerprint (User-Agent, screen resolution, timezone -- approximate fingerprinting)
- A token used from a significantly different IP/geolocation should trigger a security notification
- All device trust and revocation events produce audit log entries (NFR-SEC-006)
- Revoking all trusted devices sends email notification to the user
- Trusted device tokens are stored as secure, httpOnly cookies

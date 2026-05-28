---
title: "FR-SEC-006: Admin 2FA Enrollment Policy"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
layer: BE+FE
depends_on:
  - ../contracts/api-sec.yaml
  - ../tech-design/auth-service.md
  - ../../docs/ux/interactions/admin-2fa-policy-flow.md
  - ../../docs/ux/design-system.md
referenced_by:
  - ../backend/auth-service/implementation/FR-SEC-006--admin-2fa-policy-impl.md
  - ../backend/auth-service/test-specs/FR-SEC-006--admin-2fa-policy-test.md
  - ../frontend/app-web/implementation/FR-SEC-006--admin-2fa-policy-impl.md
  - ../frontend/app-web/test-specs/FR-SEC-006--admin-2fa-policy-test.md
changelog:
  - 1.0 | 2026-05-27 | Initial FR
---

# FR-SEC-006: Admin 2FA Enrollment Policy

## Description

Allows administrators to enforce two-factor authentication enrollment policies across the organization. Admins can mandate 2FA for all users, specific roles, or individual users. When 2FA is mandated, affected users are blocked from accessing the application until they complete 2FA setup. Admins can view compliance status across the organization and configure grace periods for new users.

## Preconditions

- Requester has administrator or super-administrator privileges
- Requesting admin's session is valid and authenticated
- For policy changes on specific roles: roles exist in the system
- Admin's own account has 2FA enabled (cannot enforce 2FA without having it themselves)

## Input

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| policy_scope | enum | Yes | "all_users", "role", "user" | "all_users" |
| target_role | string | Conditional | Required when scope is "role", must be valid role name | "admin" |
| target_user_id | string | Conditional | Required when scope is "user", must be valid user ID | "usr_abc123" |
| grace_period_days | integer | Yes | 0 to 30 days | 7 |
| action | enum | Yes | "enable_policy" or "disable_policy" or "exempt_user" | "enable_policy" |
| exemption_reason | string | Conditional | Required when action is "exempt_user", max 500 chars | "Medical leave until 2026-07-01" |
| admin_2fa_code | string | Yes | Valid TOTP code from the admin performing the action | "482916" |

## Process

### Enabling Mandatory 2FA Policy
1. Verify requesting user has admin privileges
2. Verify admin has 2FA enabled on their own account (enforce: admins must lead by example)
3. Verify admin's TOTP code for sensitive action authorization
4. Create or update 2FA enforcement policy for the specified scope
5. If grace period > 0: affected users without 2FA are notified and given N days to enroll
6. If grace period = 0: affected users without 2FA are immediately blocked from non-2FA actions
7. Queue notification to all affected users (email + in-app notification)
8. Generate audit log entry

### Disabling Mandatory 2FA Policy
1. Verify admin privileges and admin 2FA status
2. Verify admin's TOTP code
3. Disable the policy for the specified scope
4. Users who were blocked regain access (even without 2FA, unless blocked by another policy)
5. Generate audit log entry

### Exempting a Specific User
1. Verify admin privileges
2. Exempt a specific user from the mandatory policy
3. Record exemption reason (mandatory)
4. Exemption has an auto-expiry (configurable, default 30 days)
5. Generate audit log entry

### Checking Compliance Status
1. Admin queries compliance report for a scope
2. Report shows: total users, 2FA enabled count, 2FA pending count, exempt count, blocked count

### Blocking Unenrolled Users
1. On every authenticated request, check if user is subject to an active mandatory 2FA policy
2. If user is subject to policy and has not enrolled in 2FA:
   - If within grace period: allow access but show persistent reminder banner
   - If past grace period: block access to all non-2FA-setup endpoints
3. Redirect blocked users to 2FA setup flow

## Output

### Success (Policy Enabled)

```json
{
  "policy_id": "pol_2fa_001",
  "scope": "all_users",
  "status": "active",
  "grace_period_days": 7,
  "grace_period_ends_at": "2026-06-03T00:00:00Z",
  "affected_users_count": 1250,
  "currently_compliant": 1100,
  "currently_non_compliant": 150,
  "message": "Mandatory 2FA policy has been enabled. Affected users have been notified."
}
```

### Success (Compliance Report)

```json
{
  "policy_id": "pol_2fa_001",
  "scope": "all_users",
  "total_users": 1250,
  "compliant": 1100,
  "pending_enrollment": 100,
  "exempt": 5,
  "blocked": 45,
  "compliance_percentage": 88.0
}
```

### Errors

| Error Code | HTTP Status | Condition | Message |
|-----------|-------------|-----------|---------|
| SEC_ADMIN_REQUIRED | 403 | Requester does not have admin privileges | "Administrator privileges required to manage 2FA policies." |
| SEC_ADMIN_2FA_REQUIRED | 403 | Admin does not have 2FA enabled on own account | "You must enable 2FA on your own account before enforcing it on others." |
| SEC_INVALID_ADMIN_TOTP | 401 | Admin TOTP code is invalid | "Invalid verification code. Policy change requires 2FA confirmation." |
| SEC_POLICY_ALREADY_ACTIVE | 409 | Policy scope already has active mandatory 2FA | "A mandatory 2FA policy is already active for this scope." |
| SEC_POLICY_NOT_FOUND | 404 | Attempting to modify non-existent policy | "Policy not found." |
| SEC_INVALID_GRACE_PERIOD | 400 | Grace period exceeds max of 30 days | "Grace period must be between 0 and 30 days." |
| SEC_INVALID_ROLE | 400 | Specified role does not exist | "The specified role does not exist." |
| SEC_EXEMPTION_LIMIT_REACHED | 409 | Too many exemptions (max 5% of affected users) | "Exemption limit reached. Maximum 5% of affected users may be exempt." |

## Gherkin Scenarios

```gherkin
Scenario Outline: Admin enables mandatory 2FA policy for all users
  Given an admin "<admin_username>" is authenticated with admin privileges
  And the admin has 2FA enabled on their own account
  When the admin enables mandatory 2FA for scope "<scope>" with grace period "<grace_days>" days
  And provides a valid admin TOTP code "<admin_totp>"
  Then a 2FA enforcement policy is created with status "active"
  And "<affected_count>" users are identified as affected
  And all affected users receive an email notification
  And users without 2FA have "<grace_days>" days to enroll
  And an audit log entry is created

  Examples:
  | admin_username | scope      | grace_days | admin_totp | affected_count |
  | admin_sarah    | all_users   | 7          | 482916     | 1250           |
  | admin_sarah    | all_users   | 0          | 739201     | 1250           |
  | admin_tom      | all_users   | 14         | 105847     | 890            |

Scenario Outline: Admin enables mandatory 2FA for specific role
  Given an admin "admin_sarah" is authenticated
  When the admin enables mandatory 2FA for role "<role>" with grace period 7 days
  Then the policy applies only to users with role "<role>"
  And users with other roles are unaffected

  Examples:
  | role          |
  | admin         |
  | finance       |
  | developer     |

Scenario: Admin attempts to enable 2FA policy without having 2FA themselves
  Given an admin "admin_john" is authenticated with admin privileges
  And admin_john does NOT have 2FA enabled on their own account
  When the admin attempts to enable mandatory 2FA
  Then the request is rejected with status 403
  And the error code is SEC_ADMIN_2FA_REQUIRED
  And the message states the admin must enable 2FA first

Scenario: Non-admin user attempts to manage 2FA policy
  Given a user "alice" is authenticated without admin privileges
  When the user attempts to enable, disable, or modify a 2FA policy
  Then the request is rejected with status 403
  And the error code is SEC_ADMIN_REQUIRED

Scenario Outline: User blocked by mandatory 2FA policy after grace period
  Given a mandatory 2FA policy is active for all users
  And the grace period has expired
  And user "<username>" has not enrolled in 2FA
  When the user attempts to access any non-2FA-setup functionality
  Then access is denied
  And the user is redirected to the 2FA setup flow
  And the user sees a message: "Two-factor authentication is required to continue."

  Examples:
  | username |
  | bob      |
  | charlie  |
  | dave     |

Scenario Outline: User within grace period sees reminder but can still work
  Given a mandatory 2FA policy is active with 7-day grace period
  And 3 days remain in the grace period
  And user "<username>" has not enrolled in 2FA
  When the user accesses the application
  Then access is allowed
  And a persistent reminder banner is displayed: "2FA will be required in 3 days. Set it up now."
  And the banner links to the 2FA setup flow

  Examples:
  | username |
  | eve      |
  | frank    |

Scenario: Admin exempts a specific user from mandatory 2FA
  Given a mandatory 2FA policy is active
  And user "bob" has a valid reason for exemption
  When admin "admin_sarah" exempts user "bob" with reason "Medical leave until 2026-07-01"
  And provides a valid admin TOTP code
  Then user "bob" is exempt from the 2FA policy
  And exemption expires in 30 days (auto-re-enrollment)
  And an audit log entry records the exemption with the reason
  And user "bob" receives a notification about the exemption

Scenario: Admin checks compliance report
  Given a mandatory 2FA policy is active for all users
  When admin "admin_sarah" requests the compliance report
  Then the report shows total users, compliant count, pending count, exempt count, blocked count
  And compliance percentage is calculated and displayed

Scenario: Concurrency -- two admins modify the same policy
  Given a mandatory 2FA policy "pol_2fa_001" is active
  When admin "admin_sarah" and admin "admin_tom" simultaneously attempt to disable the policy
  Then exactly one disable operation succeeds
  And the second admin receives status 409 (policy already disabled or modified)
```

## Constraints

- Admin must have 2FA enabled to manage 2FA policies (NFR-SEC-011)
- Policy changes require admin TOTP re-authentication (NFR-SEC-011)
- Grace period maximum: exactly 30 days
- Maximum exemptions: 5% of affected users per policy
- Policy bypasses (exemptions) must be audited and require reason
- NFR-SEC-006: All policy changes produce audit log entries
- Blocked users may ONLY access 2FA setup, account recovery, and support contact pages
- Policy changes must notify all affected users within 10 minutes of activation

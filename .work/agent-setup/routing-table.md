# Routing Table: FR -> Service -> Specs -> Tests

| FR ID | Title | Service | Priority | FR Spec | Impl Spec | Test Spec | Work Package |
|-------|-------|---------|----------|---------|-----------|-----------|-------------|
| FR-AUTH-001 | User Registration | auth-service | must-have | [SRS](../srs/FR-AUTH-001--user-registration.md) | [IMP](../impl-specs/FR-AUTH-001-impl.md) | [TST](../test-specs/FR-AUTH-001-test.md) | [WP](../lld/agent_docs/features/FR-AUTH-001.md) |
| FR-AUTH-002 | User Login | auth-service | must-have | [SRS](../srs/FR-AUTH-002--user-login.md) | [IMP](../impl-specs/FR-AUTH-002-impl.md) | [TST](../test-specs/FR-AUTH-002-test.md) | [WP](../lld/agent_docs/features/FR-AUTH-002.md) |
| FR-AUTH-003 | Password Reset | auth-service | must-have | [SRS](../srs/FR-AUTH-003--password-reset.md) | [IMP](../impl-specs/FR-AUTH-003-impl.md) | [TST](../test-specs/FR-AUTH-003-test.md) | [WP](../lld/agent_docs/features/FR-AUTH-003.md) |
| FR-AUTH-004 | Email Verification | auth-service | must-have | [SRS](../srs/FR-AUTH-004--email-verification.md) | [IMP](../impl-specs/FR-AUTH-004-impl.md) | [TST](../test-specs/FR-AUTH-004-test.md) | [WP](../lld/agent_docs/features/FR-AUTH-004.md) |

## Dependency Order

```
FR-AUTH-001 (Registration)
    └── FR-AUTH-004 (Email Verification)  -- depends on tokens from registration
            └── FR-AUTH-002 (Login)       -- depends on verified users
                    └── FR-AUTH-003 (Password Reset) -- depends on registered users
```

## Implementation Order

1. **Sprint 1, Task 1:** Database schema (migration)
2. **Sprint 1, Task 2:** FR-AUTH-001 - User Registration
3. **Sprint 1, Task 3:** FR-AUTH-004 - Email Verification
4. **Sprint 1, Task 4:** FR-AUTH-002 - User Login
5. **Sprint 1, Task 5:** FR-AUTH-003 - Password Reset

---
fr_id: FR-AUTH-002
title: User Login with Email and Password
service: auth-service
route: POST /api/v1/auth/login
impl_spec: .work/impl-specs/FR-AUTH-002-impl.md
test_spec: .work/test-specs/FR-AUTH-002-test.md
status: lld-complete
---

# Work Package: FR-AUTH-002 - User Login

## Routing
- **Service:** auth-service (port 8080)
- **Gateway route:** POST /api/v1/auth/login
- **OpenAPI contract:** api-auth.yaml, operationId: loginUser

## Design References
- **FR spec:** .work/srs/FR-AUTH-002--user-login.md
- **HLD:** ADR-002 (API conventions), ADR-003 (events), hard-boundaries.md (HB-006)
- **LLD:** auth-service-tech-design.md

## Key Implementation Decisions
- Constant-time password comparison (timing attack prevention)
- Session stored in Redis with TTL (7d idle, 30d absolute)
- Session cookie: HTTP-only, Secure, SameSite=Strict
- Failed login counter: atomic increment on users table
- Progressive lockout: 5min / 15min / 30min / 60min
- Max 10 concurrent sessions per user

## Acceptance Checklist
- [ ] Valid credentials create session and return user profile
- [ ] Invalid credentials return INVALID_CREDENTIALS (vague message)
- [ ] Account lockout after 5 failed attempts
- [ ] Successful login resets failed counter
- [ ] Session cookie has correct security attributes
- [ ] Concurrent logins from different devices both succeed

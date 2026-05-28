---
fr_id: FR-AUTH-003
title: Password Reset via Email
service: auth-service
route: POST + PUT /api/v1/auth/password-reset
impl_spec: .work/impl-specs/FR-AUTH-003-impl.md
test_spec: .work/test-specs/FR-AUTH-003-test.md
status: lld-complete
---

# Work Package: FR-AUTH-003 - Password Reset

## Routing
- **Service:** auth-service (port 8080)
- **Gateway route:** POST /api/v1/auth/password-reset (request), PUT /api/v1/auth/password-reset (execute)
- **OpenAPI contract:** api-auth.yaml, operationId: requestPasswordReset, executePasswordReset

## Design References
- **FR spec:** .work/srs/FR-AUTH-003--password-reset.md
- **HLD:** ADR-002, ADR-003, hard-boundaries.md (HB-002, HB-006, HB-007)
- **LLD:** auth-service-tech-design.md

## Key Implementation Decisions
- Reset token: CSPRNG, 256-bit entropy, 30min TTL
- Token stored as HMAC-SHA256 hash (not plaintext)
- Password reset: UPDATE password_hash + invalidate reset_token + DELETE all sessions (DB transaction)
- New request invalidates previous unused tokens
- Reset unlocks account and clears failed login counter
- Email privacy: same response whether email exists or not

## Acceptance Checklist
- [ ] Password reset request sends email for existing account
- [ ] Password reset request returns same message for non-existent account
- [ ] Valid token + new password resets password and logs out all sessions
- [ ] Expired/used tokens return INVALID_OR_EXPIRED_TOKEN
- [ ] Multiple reset requests invalidate previous tokens
- [ ] Password reset unlocks locked account

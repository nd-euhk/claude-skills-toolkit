---
fr_id: FR-AUTH-004
title: Email Verification
service: auth-service
route: POST /api/v1/auth/verify-email
impl_spec: .work/impl-specs/FR-AUTH-004-impl.md
test_spec: .work/test-specs/FR-AUTH-004-test.md
status: lld-complete
---

# Work Package: FR-AUTH-004 - Email Verification

## Routing
- **Service:** auth-service (port 8080)
- **Gateway route:** POST /api/v1/auth/verify-email
- **OpenAPI contract:** api-auth.yaml, operationId: verifyEmail

## Design References
- **FR spec:** .work/srs/FR-AUTH-004--email-verification.md
- **HLD:** ADR-002, ADR-003, hard-boundaries.md (HB-001, HB-005)
- **LLD:** auth-service-tech-design.md

## Key Implementation Decisions
- Verification token: CSPRNG, 256-bit entropy, 24h TTL
- Token stored as HMAC-SHA256 hash (not plaintext)
- Verification: UPDATE user.status + UPDATE token.used_at (DB transaction)
- One-time use: WHERE used_at IS NULL prevents replay
- Re-registration sends new verification token for unverified accounts

## Acceptance Checklist
- [ ] Valid verification token sets user to verified
- [ ] Expired token returns INVALID_OR_EXPIRED_TOKEN
- [ ] Already-used token returns INVALID_OR_EXPIRED_TOKEN
- [ ] Already-verified user returns ALREADY_VERIFIED
- [ ] Concurrent verification with same token: only one succeeds

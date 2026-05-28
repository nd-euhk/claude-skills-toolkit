---
fr_id: FR-AUTH-004
title: Email Verification - Implementation Specification
version: 1.0.0
status: draft
---

# IMP Spec: FR-AUTH-004 - Email Verification

## 1. Purpose
Implement email verification via one-time token. Verify user email ownership before allowing login. Handle expired, used, and invalid tokens gracefully.

## 2. References
- **FR:** .work/srs/FR-AUTH-004--email-verification.md
- **HLD:** ADR-002, ADR-003, hard-boundaries.md (HB-001, HB-005)
- **LLD:** auth-service-tech-design.md (VerifyController, TokenService)
- **OpenAPI:** api-auth.yaml (POST /auth/verify-email)
- **Work Package:** .work/lld/agent_docs/features/FR-AUTH-004.md

## 3. Affected Areas
- **Controllers:** VerifyController (new)
- **Services:** TokenService (validate + invalidate)
- **Repositories:** UserRepository (update status), TokenRepository (invalidate)
- **Database:** users table (status), verification_tokens table (used_at)
- **Events:** auth.user.verified

## 4. Execution Flow

1. Validate verification_token non-empty. Return 400 if empty.
2. Lookup token by hash in verification_tokens table.
   - Not found -> 400 INVALID_OR_EXPIRED_TOKEN.
   - used_at IS NOT NULL -> 400 INVALID_OR_EXPIRED_TOKEN.
   - expires_at < NOW() -> 400 INVALID_OR_EXPIRED_TOKEN.
3. Lookup associated user.
   - status=deactivated -> 400 INVALID_OR_EXPIRED_TOKEN (no info leak).
   - status=verified -> 409 ALREADY_VERIFIED.
4. **DB Transaction:**
   - UPDATE users SET status = 'verified'.
   - UPDATE verification_tokens SET used_at = NOW() WHERE id = token_id AND used_at IS NULL (guard).
5. Commit, emit auth.user.verified event.
6. Return 200 "Email verified successfully."

## 5. Business Rules Realized
- Token one-time use: UPDATE with WHERE used_at IS NULL prevents replay.
- Already verified idempotent: returns success, not error.
- Deactivated account cannot verify: returns generic error.

## 6. Data & State Impact
- User status: unverified -> verified.
- Verification token: marked as used.
- User can now log in.

## 7. Error Mapping
| Scenario | Error Code | HTTP |
|----------|-----------|------|
| Empty/malformed token | VALIDATION_ERROR | 400 |
| Not found/expired/used/deactivated | INVALID_OR_EXPIRED_TOKEN | 400 |
| Already verified | ALREADY_VERIFIED | 409 |

## 8. Security & Authorization
- Public endpoint (token-based auth).
- Token hash comparison: constant-time.
- No user enumeration: deactivated accounts return same error as invalid tokens.

## 9. Implementation Notes
- **Token hash storage:** HMAC-SHA256 of raw token. The raw token only exists in the email link.
- **Verification link format:** https://app.example.com/verify?token={raw_token}. Frontend extracts and POSTs to API.
- **Dependency:** Must be implemented after registration (which creates tokens).

## 10. Acceptance Checklist
- [ ] Valid token verifies email and sets status to verified
- [ ] Expired token returns INVALID_OR_EXPIRED_TOKEN
- [ ] Already used token returns INVALID_OR_EXPIRED_TOKEN
- [ ] Already verified returns ALREADY_VERIFIED
- [ ] Concurrent verification with same token: only one succeeds
- [ ] Verified event emitted

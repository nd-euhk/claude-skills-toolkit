---
fr_id: FR-AUTH-003
title: Password Reset - Implementation Specification
version: 1.0.0
status: draft
---

# IMP Spec: FR-AUTH-003 - Password Reset

## 1. Purpose
Implement two-step password reset: (1) request reset via email, (2) execute reset with valid token. Preserve email privacy, invalidate all sessions, unlock account if locked.

## 2. References
- **FR:** .work/srs/FR-AUTH-003--password-reset.md
- **HLD:** ADR-002, ADR-003, hard-boundaries.md (HB-002, HB-006, HB-007)
- **LLD:** auth-service-tech-design.md (PasswordController, TokenService, SessionService)
- **OpenAPI:** api-auth.yaml (POST + PUT /auth/password-reset)
- **Work Package:** .work/lld/agent_docs/features/FR-AUTH-003.md

## 3. Affected Areas
- **Controllers:** PasswordController (new, handles both POST and PUT)
- **Services:** TokenService (reset tokens), EmailService (async email), SessionService (delete all sessions)
- **Repositories:** UserRepository (update password), TokenRepository (create/invalidate)
- **Database:** users table (password_hash, failed_login_count, locked_until), reset_tokens table
- **Redis:** Session cache (delete all sessions for user)
- **Events:** auth.password.reset_requested, auth.password.reset, auth.account.unlocked

## 4. Execution Flow

**Step 1 - Request Reset (POST):**
1. Rate limit: 3/hour per IP and per email. Return 429 if exceeded.
2. Validate email format.
3. Normalize email.
4. User lookup by email.
   - Not found -> return 200 "If account exists, reset link sent" (no email enumeration).
   - Found -> continue.
5. Invalidate all prior unused reset tokens for this user.
6. Generate new reset token (256-bit CSPRNG, 30min TTL), store hash.
7. Enqueue reset email asynchronously with raw token link.
8. Emit auth.password.reset_requested event.
9. Return 200 "If account exists, reset link sent."

**Step 2 - Execute Reset (PUT):**
1. Validate reset_token non-empty, new_password complexity, password confirmation match.
2. Lookup token hash in reset_tokens table.
   - Not found or used_at IS NOT NULL or expires_at < NOW() -> 400 INVALID_OR_EXPIRED_TOKEN.
3. Lookup associated user. Deactivated -> 400 INVALID_OR_EXPIRED_TOKEN (no info leak).
4. Verify new password != current (optional). If equal -> 409 SAME_PASSWORD.
5. **DB Transaction:**
   - UPDATE users SET password_hash = new_hash.
   - UPDATE reset_tokens SET used_at = NOW() WHERE id = token_id.
   - UPDATE users SET failed_login_count = 0, locked_until = NULL (unlock).
   - DELETE all sessions from Redis for this user.
   - Invalidate all other unused reset tokens for this user.
   - Publish auth.password.reset event.
   - Publish auth.account.unlocked event (if account was locked).
6. Commit transaction.
7. Return 200 "Password reset successful. Please log in."

## 5. Business Rules Realized
- Email privacy: same response whether email exists or not.
- Token one-time use via used_at IS NOT NULL check in transaction.
- Older tokens invalidated on new request.
- Password reset unlocks account.
- All sessions force-terminated on password change.

## 6. Data & State Impact
- Password hash updated in users table.
- All reset tokens for user invalidated (used or unused).
- All Redis sessions for user deleted.
- Account unlocked: failed_login_count=0, locked_until=NULL.

## 7. Error Mapping
| Scenario | Error Code | HTTP |
|----------|-----------|------|
| Invalid/expired/used token | INVALID_OR_EXPIRED_TOKEN | 400 |
| Weak new password | WEAK_NEW_PASSWORD | 400 |
| Same as current password | SAME_PASSWORD | 409 |
| Rate limited | RATE_LIMITED | 429 |

## 8. Security & Authorization
- Step 1: Public, rate-limited. Token-based auth for Step 2 (possession of reset token).
- Constant-time token lookup to prevent timing oracle on token validity.

## 9. Implementation Notes
- **Redis unavailable during reset:** Session deletion may fail. Mark sessions for async cleanup in DB. User will be force-logged-out on next request.
- **Token double-use:** Transactional UPDATE ... WHERE used_at IS NULL guarantees one-time use even under concurrency.
- **Password history:** Optional enhancement: store last 5 password hashes in password_history table. Check before allowing reset.

## 10. Acceptance Checklist
- [ ] Reset request sends email for existing account
- [ ] Reset request returns same message for non-existent email
- [ ] Valid token + new password resets password
- [ ] Expired token returns error
- [ ] Used token returns error
- [ ] Sessions invalidated after reset
- [ ] Account unlocked after reset

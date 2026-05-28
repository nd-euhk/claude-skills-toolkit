---
fr_id: FR-AUTH-002
title: User Login - Implementation Specification
version: 1.0.0
status: draft
---

# IMP Spec: FR-AUTH-002 - User Login

## 1. Purpose
Implement email/password authentication: validate credentials, create secure sessions, enforce account lockout on repeated failures, and emit login events. This is the most performance-critical endpoint (P95 < 200ms, 1000 req/s).

## 2. References
- **FR:** .work/srs/FR-AUTH-002--user-login.md
- **HLD:** ADR-002 (API conventions), ADR-003 (events), hard-boundaries.md (HB-006 constant-time comparison)
- **LLD:** auth-service-tech-design.md (AuthenticationService, SessionService)
- **OpenAPI:** api-auth.yaml (POST /auth/login)
- **Work Package:** .work/lld/agent_docs/features/FR-AUTH-002.md

## 3. Affected Areas
- **Controllers:** LoginController (new)
- **Services:** AuthenticationService (new), SessionService (new)
- **Repositories:** UserRepository (read/update), SessionRepository (Redis write)
- **Database:** users table (read failed_login_count, update on success/failure), sessions in Redis
- **Events:** auth.user.logged_in, auth.account.locked

## 4. Execution Flow

1. **Rate limit check:** IP-based (10/min) and email-based (5/min). Return 429 if exceeded.
2. **Input validation:** Email format + password non-empty. Return 400 on failure.
3. **Normalize email:** Trim, lowercase.
4. **User lookup:** Query users table by normalized email.
   - Not found -> 401 INVALID_CREDENTIALS (same timing as found path to prevent timing oracle).
   - Status=unverified -> 403 ACCOUNT_UNVERIFIED.
   - Status=deactivated -> 401 INVALID_CREDENTIALS (no info leak).
   - locked_until > NOW() -> 423 ACCOUNT_LOCKED with remaining minutes.
5. **Password verification:** Constant-time comparison of provided password against stored hash.
   - Mismatch -> atomic increment failed_login_count. If count >= 5, set locked_until to NOW() + progressive lockout. Return 401.
6. **On success:**
   - Reset failed_login_count to 0.
   - Clear locked_until if set.
   - Generate session token (256-bit CSPRNG).
   - Store session in Redis: key=sess-{id}, value={user_id, metadata, token_hash}, TTL=7d idle.
   - Enforce max 10 concurrent sessions: if exceeded, delete oldest.
   - Set session cookie (HTTP-only, Secure, SameSite=Strict).
   - Emit auth.user.logged_in event.
   - Return 200 with user profile.

## 5. Business Rules Realized
- **No credential differentiation:** Same error message and timing for "wrong password" vs "user not found."
- **Progressive lockout:** 5 failures -> 5min, next 5 -> 15min, next 5 -> 30min, next 5 -> 60min.
- **Counter reset:** Successful login resets to 0.
- **Session limits:** Max 10 concurrent sessions per user.

## 6. Data & State Impact
- **Session created:** Redis entry with TTL-based auto-expiry.
- **Failed counter:** Updated atomically in PostgreSQL.
- **Session cookie:** Set on response.

## 7. Error Mapping
| Scenario | Error Code | HTTP |
|----------|-----------|------|
| Invalid email/password | INVALID_CREDENTIALS | 401 |
| Account unverified | ACCOUNT_UNVERIFIED | 403 |
| Account locked | ACCOUNT_LOCKED | 423 |
| Rate limited | RATE_LIMITED | 429 |

## 8. Security & Authorization
- Public endpoint, no prior auth required.
- Constant-time comparison for password AND for user lookup timing.
- Session token entropy: 256-bit CSPRNG.
- Session cookie: HTTP-only, Secure, SameSite=Strict.

## 9. Implementation Notes
- **Performance critical:** Target P95 < 200ms. Requires indexed email lookup + fast password verification + Redis session write in sequence.
- **Atomic counter:** Use UPDATE ... SET failed_login_count = failed_login_count + 1. Do not read-then-write (race condition).
- **Session concurrency limit:** Check count in Redis before inserting. Use Redis MULTI/EXEC or Lua script for atomicity.
- **IP and email rate limits:** Separate Redis counters with sliding windows.

## 10. Acceptance Checklist
- [ ] Valid credentials return session + user profile
- [ ] Invalid credentials return 401 with same message regardless of reason
- [ ] Account locks after 5 consecutive failures
- [ ] Progressive lockout timing works as specified
- [ ] Successful login resets counter and clears lock
- [ ] Session cookie attributes verified
- [ ] Concurrent sessions counted correctly
- [ ] Login event emitted

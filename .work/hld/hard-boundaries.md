# Hard Boundaries

**Version:** 1.0.0
**Last updated:** 2026-05-27

Hard boundaries are rules that MUST NEVER be violated. Each rule includes its detection method.

## Boundary Rules

### HB-001: No Cross-Service Database Joins
- **Rule:** The auth service is the sole owner of the users table, password_hashes table, tokens table, and failed_logins table. No other service may perform SQL queries or joins against these tables.
- **Rationale:** Data ownership is sacred. Cross-service DB access creates hidden coupling, prevents independent schema evolution, and makes compliance auditing impossible.
- **Detection:** Database permission grants (only auth-service credentials have access to auth_db). Lint rule checking for imports of auth data models in other services.

### HB-002: Password Hashes Never Leave the Auth Service
- **Rule:** Password hashes must never be returned in API responses, logged, included in events, or replicated to other data stores.
- **Rationale:** Even hashed, passwords are sensitive. Limiting their exposure reduces the blast radius of a potential breach.
- **Detection:** Code review checklist. Grep for password_hash in API response schemas and event payloads. Static analysis rule.

### HB-003: Sessions Managed Exclusively by Auth Service
- **Rule:** Session creation, validation, and invalidation is the exclusive responsibility of auth-service. Other services must validate sessions via the auth service API or a readonly Redis replica -- they must never write session data.
- **Rationale:** Centralized session management ensures consistent session lifecycle and simplifies logout (invalidate once, effective everywhere).
- **Detection:** Redis ACL rules (read-only access for non-auth services). Code review for session write operations outside auth-service.

### HB-004: Authentication Tokens Are Immutable After Creation
- **Rule:** Once issued, session tokens, verification tokens, and reset tokens cannot be modified. They can only be created, validated, or invalidated (deleted).
- **Rationale:** Immutable tokens eliminate a class of security vulnerabilities where token tampering could grant unauthorized access.
- **Detection:** API design review. No PATCH/PUT endpoints for token resources.

### HB-005: No Plaintext Tokens in Logs or Events
- **Rule:** Session tokens, verification tokens, and reset tokens must never appear in plaintext in application logs, error messages, or event payloads.
- **Rationale:** Tokens in logs create a permanent record of credentials, violating security best practices and compliance requirements.
- **Detection:** Log redaction middleware. Pre-commit hook scanning for token patterns. Log sampling review.

### HB-006: Constant-Time Comparison for All Credential Validation
- **Rule:** Password verification, token comparison, and any credential check must use constant-time comparison algorithms. Timing-based differentiation is forbidden.
- **Rationale:** Non-constant-time comparison enables timing side-channel attacks that can leak credential validity.
- **Detection:** Static analysis rule requiring `crypto.timingSafeEqual` or equivalent. Code review for custom comparison logic.

### HB-007: Email Sending Is Always Asynchronous
- **Rule:** Email sending must never block the synchronous API response. Emails are dispatched asynchronously via a message queue or background job.
- **Rationale:** Email provider latency (50ms-5s) would violate P95 response time targets (500ms for registration) if synchronous.
- **Detection:** Architecture review. No direct email API calls in request handlers -- only queue/event publishers.

### HB-008: Rate Limiting Before Authentication
- **Rule:** Rate limiting for auth endpoints (register, login, password-reset) is enforced at the API gateway layer BEFORE requests reach the auth service. The auth service may add additional per-user limits but the gateway must provide the first line of defense.
- **Rationale:** Preventing resource exhaustion attacks (credential stuffing, brute force) requires defense at the edge. The gateway absorbs the traffic before it reaches application resources.
- **Detection:** Gateway configuration review. Load test verifying rate limits are enforced under load.

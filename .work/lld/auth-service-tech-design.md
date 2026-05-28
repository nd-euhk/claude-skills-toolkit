---
doc_type: TechDesign
service: auth-service
version: 1.0.0
status: draft
---

# Auth Service - Technical Design

## 1. Service Boundary

- **Service:** auth-service
- **Port:** 8080 (HTTP), 9090 (metrics)
- **Database:** PostgreSQL (auth_db), Redis (session_cache)
- **Responsibilities:** User registration, email verification, login/logout, session management, password reset
- **Does NOT handle:** User profiles (profile service), authorization/roles (separate service), OAuth/social login (future)

## 2. Internal Architecture

```
Controllers (HTTP Layer)
  ├── RegisterController  → POST /api/v1/auth/register
  ├── LoginController     → POST /api/v1/auth/login
  ├── LogoutController    → POST /api/v1/auth/logout
  ├── SessionController   → GET /api/v1/auth/session
  ├── VerifyController    → POST /api/v1/auth/verify-email
  └── PasswordController  → POST/PUT /api/v1/auth/password-reset

Services (Business Logic Layer)
  ├── RegistrationService    → validates, hashes, persists user + sends email
  ├── AuthenticationService  → validates credentials, manages sessions, lockout logic
  ├── TokenService           → generates, validates, invalidates tokens (verify, reset)
  ├── SessionService          → CRUD for sessions in Redis, concurrency limits
  └── EmailService            → publishes email events to queue (async)

Repositories (Data Access Layer)
  ├── UserRepository          → CRUD for users table
  ├── TokenRepository         → CRUD for verification_tokens, reset_tokens tables
  ├── SessionRepository       → CRUD for session_cache (Redis)
  └── EventPublisher          → Publishes to message queue

Middleware (Cross-Cutting)
  ├── RateLimitMiddleware     → Per-IP and per-email rate limits
  ├── SessionAuthMiddleware   → Validates session token for protected routes
  ├── RequestLogMiddleware    → Structured logging with correlation IDs
  └── ErrorHandlerMiddleware  → Catches exceptions, maps to error envelope
```

## 3. Domain Model

### Entities
```
User:
  - id: UUID (PK)
  - email: string (unique, normalized, indexed)
  - password_hash: string (bcrypt or argon2id)
  - status: enum(unverified, verified, deactivated)
  - failed_login_count: integer (default 0)
  - locked_until: timestamp (nullable)
  - created_at: timestamp
  - updated_at: timestamp

VerificationToken:
  - id: UUID (PK)
  - user_id: UUID (FK → users.id, indexed)
  - token_hash: string (HMAC-SHA256, indexed)
  - expires_at: timestamp
  - used_at: timestamp (nullable)
  - created_at: timestamp

ResetToken:
  - id: UUID (PK)
  - user_id: UUID (FK → users.id, indexed)
  - token_hash: string (HMAC-SHA256, indexed)
  - expires_at: timestamp (30 min from creation)
  - used_at: timestamp (nullable)
  - created_at: timestamp

Session (stored in Redis, not PostgreSQL):
  - session_id: UUID (key)
  - user_id: UUID
  - token_hash: string
  - ip_address: string
  - user_agent: string
  - created_at: timestamp
  - expires_at: timestamp (idle: 7d, absolute: 30d)
  - TTL: auto-expiring Redis key
```

### Value Objects
```
Email: normalized (lowercase + trimmed), validated (RFC 5322)
Password: validated against complexity rules before hashing
SessionToken: CSPRNG-generated, 256-bit entropy
VerificationToken: CSPRNG-generated, 256-bit entropy, 24h TTL
ResetToken: CSPRNG-generated, 256-bit entropy, 30min TTL
```

### Aggregates
- **User Aggregate:** User (root) + VerificationTokens + ResetTokens
- **Session Aggregate:** Session (standalone, Redis, TTL-managed)

## 4. REST Clients (External Service Calls)

| External Service | Call Type | Purpose | Timeout | Retry |
|-----------------|-----------|---------|---------|-------|
| Email Provider | Async (via queue) | Send verification/reset emails | N/A (async) | 3 retries, exponential backoff |
| Message Broker | Async publish | Emit domain events | 500ms | 3 retries |
| Redis (Session Cache) | Sync | Session CRUD operations | 50ms | None (fail open or closed per config) |

## 5. Transaction Boundaries

### Atomic (Database Transaction)
- **Registration:** INSERT user + INSERT verification_token + publish event (all-or-nothing, DB transaction)
- **Password Reset Execution:** UPDATE user.password_hash + UPDATE reset_token.used_at + DELETE all sessions + publish event (DB transaction)
- **Email Verification:** UPDATE user.status + UPDATE verification_token.used_at + publish event

### Eventual Consistency
- **Email sending:** Published to queue after DB transaction commits. If email fails, `auth.email.delivery_failed` event emitted.
- **Session invalidation on password reset:** Active session entries in Redis are deleted within the DB transaction (Redis is fast, ~1ms), but if Redis is unavailable, sessions are marked for async cleanup.
- **Event publishing:** Events published as part of DB transaction (outbox pattern or transactional outbox) to prevent lost events.

### Concurrent Operations
- **Duplicate registration:** UNIQUE constraint on users.email. Second transaction rolls back.
- **Token one-time use:** UPDATE with WHERE used_at IS NULL. Zero rows affected = token already used.
- **Failed login counter:** UPDATE users SET failed_login_count = failed_login_count + 1 (atomic increment).

## 6. Integration Points

| Integration | Protocol | Direction | Data |
|-------------|----------|-----------|------|
| API Gateway → Auth Service | HTTP/REST (internal) | Inbound | All auth requests |
| Auth Service → PostgreSQL | SQL/TCP | Outbound | User data, tokens |
| Auth Service → Redis | Redis protocol | Outbound | Session data |
| Auth Service → Message Broker | AMQP/Kafka | Outbound | Domain events |
| Auth Service → Email Provider | HTTPS API | Outbound (async) | Email payload |
| Monitoring ← Auth Service | HTTP (pull) | Inbound | /metrics endpoint |
| Downstream Services ← Message Broker | AMQP/Kafka | (consumers) | Domain events |

## 7. Caching Strategy

| What | Where | TTL | Invalidation |
|------|-------|-----|-------------|
| Active Sessions | Redis | 7d idle, 30d absolute | On logout, password reset, or TTL expiry |
| Rate Limit Counters | Redis | Per-window (1min, 1hour) | Auto-expire based on window |
| Failed Login Counters | PostgreSQL (atomic) | N/A (persistent) | Reset on successful login or password reset |
| User Lookup by Email | Application-level cache (optional) | 5 min | Invalidate on user update |

**Cache warming:** Not required. User lookups are fast with database index on email.
**Cache failure mode:** If Redis is unavailable for sessions, fail closed (reject auth requests) or fall back to DB session lookup if configured.

## 8. Performance & Scale Targets

| Operation | P95 Target | P99 Target | Expected Throughput |
|-----------|-----------|-----------|-------------------|
| Register | < 500ms (excl. email) | < 1000ms | 100 req/s |
| Login | < 200ms | < 500ms | 1000 req/s |
| Verify Email | < 200ms | < 500ms | 100 req/s |
| Password Reset (request) | < 300ms (excl. email) | < 500ms | 50 req/s |
| Password Reset (execute) | < 300ms | < 500ms | 50 req/s |
| Session Lookup | < 200ms | < 500ms | 1000 req/s |

**Scaling strategy:**
- Stateless auth service: scale horizontally behind load balancer.
- PostgreSQL: read replicas for session/user lookups; primary for writes.
- Redis Cluster for session cache at scale (>10K concurrent users).
- Connection pooling: HikariCP or equivalent with min=10, max=50 connections per instance.

## 9. Error Flows & Degraded Mode

### Redis Unavailable
- **Impact:** Session lookups fail. New logins fail (cannot create session). Existing sessions: fail closed (reject) or fail open (allow) per configuration.
- **Degraded mode:** Fall back to database-backed session lookup (higher latency, P95 may exceed 500ms).
- **Recovery:** Auto-reconnect when Redis is available.

### PostgreSQL Unavailable
- **Impact:** All auth operations fail. System is unavailable.
- **Degraded mode:** Return 503 Service Unavailable. No degraded operation possible (auth is critical path).
- **Recovery:** Failover to read replica or standby.

### Email Provider Unavailable
- **Impact:** Verification and password reset emails are not delivered.
- **Degraded mode:** Queue email jobs; retry with exponential backoff (1min, 5min, 15min). After 3 failures, emit `auth.email.delivery_failed` event. UI shows "email sending delayed" message.
- **Recovery:** Retry queue drains when provider is back.

### Message Broker Unavailable
- **Impact:** Domain events are not published. Downstream services miss events.
- **Degraded mode:** Buffer events in outbox table (PostgreSQL). Publish when broker is available.
- **Recovery:** Outbox poller catches up when broker reconnects.

### Rate Limit Exceeded
- **Response:** 429 Too Many Requests with Retry-After header.
- **User experience:** Clear message with wait time.

---
doc_type: SystemArchitecture
domain: AUTH
version: 1.0.0
status: draft
---

# System Architecture: User Authentication

## C4 Level 1: System Context

```mermaid
C4Context
  title System Context Diagram - Authentication System

  Person(user, "End User", "Registers, logs in, resets password")
  Person(admin, "Admin", "Manages user accounts")

  System(auth_system, "Authentication System", "Handles user registration, login, session management, password reset, email verification")

  System_Ext(email_provider, "Email Service", "Sends verification and password reset emails (e.g., SendGrid, SES)")
  System_Ext(monitoring, "Monitoring & Alerting", "Collects metrics, logs, and alerts (e.g., Prometheus, Grafana, ELK)")

  Rel(user, auth_system, "Registers, logs in, resets password via", "HTTPS")
  Rel(admin, auth_system, "Manages users via", "HTTPS")
  Rel(auth_system, email_provider, "Sends emails via", "SMTP/API")
  Rel(auth_system, monitoring, "Emits metrics and logs via", "HTTPS/metrics endpoint")
```

## C4 Level 2: Container Diagram

```mermaid
C4Container
  title Container Diagram - Authentication System

  Person(user, "End User", "Uses the auth system")

  Container_Boundary(auth_boundary, "Authentication System") {
    Container(api_gateway, "API Gateway", "Nginx/Envoy", "Routes requests, enforces rate limits, terminates TLS")
    Container(auth_service, "Auth Service", "Node.js/Python/Go", "Handles registration, login, password reset, email verification, session management")
    Container(auth_db, "Auth Database", "PostgreSQL", "Stores user accounts, password hashes, tokens, sessions")
    Container(session_cache, "Session Cache", "Redis", "Stores active sessions for fast lookup and distributed access")
    Container(event_queue, "Event Queue", "Message Broker", "Publishes auth domain events to subscribers")
  }

  System_Ext(email_provider, "Email Service", "SendGrid / AWS SES")
  System_Ext(monitoring, "Monitoring", "Prometheus + Grafana + ELK")

  Rel(user, api_gateway, "Uses", "HTTPS")
  Rel(api_gateway, auth_service, "Proxies requests to", "HTTP (internal)")
  Rel(auth_service, auth_db, "Reads/Writes user data", "SQL/TCP")
  Rel(auth_service, session_cache, "Stores/Lookup sessions", "Redis Protocol")
  Rel(auth_service, event_queue, "Publishes domain events", "AMQP/Kafka")
  Rel(auth_service, email_provider, "Sends emails via", "HTTPS API")
  Rel(auth_service, monitoring, "Exposes metrics on", "/metrics")
  Rel(auth_db, monitoring, "DB metrics", "exporter")
  Rel(session_cache, monitoring, "Cache metrics", "exporter")
```

## Communication Patterns

### Synchronous (REST)
- All client-to-auth-service communication is synchronous REST over HTTPS.
- Auth service exposes REST endpoints for: register, login, logout, verify-email, password-reset (request + execute), session-info.

### Asynchronous (Events)
- Auth service publishes domain events (registration, login, password reset, account lock/unlock).
- Downstream services (notification, audit, analytics, user profile) consume events asynchronously.

### Internal Communication
- Auth service communicates with PostgreSQL for user data and token storage.
- Auth service communicates with Redis for session cache (distributed session store for horizontal scaling).
- Auth service communicates with email provider via HTTPS API for sending transactional emails.

## Data Architecture

### Data Stores

| Store | Technology | Purpose | Data |
|-------|-----------|---------|------|
| Primary Database | PostgreSQL | Source of truth | Users, password hashes, tokens, failed login counters |
| Session Cache | Redis | Fast session lookup | Active sessions (token, user_id, metadata, TTL) |
| Event Queue | Message Broker | Async event distribution | Domain events (temporary, TTL-based retention) |

### Data Ownership Matrix

| Entity | Owner Service | Accessed By | Access Method |
|--------|--------------|-------------|---------------|
| User (account) | auth-service | auth-service only | Direct SQL |
| Password Hash | auth-service | auth-service only | Direct SQL |
| Verification Token | auth-service | auth-service only | Direct SQL |
| Reset Token | auth-service | auth-service only | Direct SQL |
| Session | auth-service | auth-service (read/write), API gateway (validate) | Redis |
| Failed Login Counter | auth-service | auth-service only | Direct SQL |
| Domain Events | auth-service | Downstream services | Message queue |

### Data Ownership Rules
1. **Users table**: Owned by auth-service. No other service reads or writes directly.
2. **Sessions**: Owned by auth-service. API gateway may validate sessions via a readonly Redis endpoint or a dedicated session-validation API.
3. **Events**: Published by auth-service. Subscribers never modify.

## Security Architecture

### Authentication Flow
1. Client submits credentials (email + password) to POST /api/v1/auth/login.
2. Auth service validates credentials, creates session in Redis.
3. Session cookie/token returned to client.
4. Subsequent requests include session cookie/token.
5. API gateway or auth service validates session on each request.

### Service-to-Service Authentication
- Internal service communication uses mTLS or a service mesh.
- Other services calling auth-service for session validation use a service API key (stored in secrets manager).

### Encryption
- **In transit**: TLS 1.2+ for all external and internal communication.
- **At rest**: Password hashes (bcrypt/argon2). Tokens stored as HMAC hashes. Database encryption at rest (cloud provider managed keys).

### Key Rotation
- Session signing keys: Rotated every 90 days.
- Password hashing: Algorithm upgrade path documented. Existing hashes re-hashed on next login.

## Infrastructure

### Deployment
- Auth service: Containerized, deployed to Kubernetes or equivalent orchestrator.
- PostgreSQL: Managed service with primary + read replica.
- Redis: Managed service with primary + replica, or Redis Cluster for larger deployments.

### CI/CD
- Automated testing pipeline: Unit, integration, E2E tests run on every PR.
- Deployment pipeline: Canary -> Staging -> Production with automated rollback on error rate threshold.

### Observability
- **Metrics**: Prometheus metrics exposed on /metrics (request count, latency, error rate, auth success/failure rate, active sessions).
- **Logging**: Structured JSON logs with correlation IDs.
- **Tracing**: Distributed tracing with correlation ID propagation.
- **Alerting**: Error rate > 1% (5min window), P95 latency > 500ms, login failure rate spike, DB connection pool exhaustion.

## External Systems

| System | Purpose | Integration Method |
|--------|---------|-------------------|
| Email Provider (SendGrid/AWS SES) | Send verification and password reset emails | HTTPS REST API |
| Monitoring (Prometheus/Grafana) | Metrics collection and visualization | Pull-based /metrics endpoint |
| Log Aggregation (ELK) | Centralized logging | Log shipper (Fluentd/Filebeat) |
| Secrets Manager (Vault/AWS SM) | Store API keys, signing keys, DB credentials | API at startup, auto-refresh |

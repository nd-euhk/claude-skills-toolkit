---
adr_id: ADR-001
domain: AUTH
title: Service Decomposition - Monolithic Authentication Service
status: accepted
version: 1.0.0
---

# ADR-001: Service Decomposition

## Context

The user authentication system handles four bounded contexts: user registration, email verification, login/session management, and password reset. These contexts are tightly coupled -- they share the same user entity, password hashes, and token stores. They have a shared data consistency model.

The system must support P95 login response times under 200ms, 10,000 concurrent sessions, and up to 10 million user accounts.

## Decision

**Deploy the authentication domain as a single monolithic service** (auth-service).

Rationale:
1. **Strong data consistency**: All four contexts operate on the same user entity. Registration, login, verification, and password reset all read/write the same user record and token stores. A monolithic design avoids distributed transactions.
2. **Performance**: No inter-service network calls for core auth operations. Password verification, session creation, and token validation all run in-process.
3. **Simplicity**: A single auth service is easier to secure, audit, and deploy. The blast radius for auth is contained.
4. **Scale needs**: The throughput targets (1000 login req/s) are achievable with horizontal scaling of a single stateless service backed by a properly provisioned database.
5. **Team topology**: Authentication is typically owned by a single team (platform/identity team).

## Consequences

- **Positive**: Simple deployment, no distributed auth transactions, easy auditing.
- **Positive**: Horizontal scaling via stateless service instances is straightforward.
- **Positive**: All auth operations share the same session store -- no need for distributed session invalidation across services.
- **Negative**: Auth service becomes a critical single point of failure. Mitigation: deploy with redundancy across availability zones.
- **Negative**: All auth changes require deploying the entire service. Mitigation: auth domain is stable; feature flags for gradual rollout.
- **Negative**: Database must scale to handle all auth traffic. Mitigation: read replicas for session/token lookups.

## Alternatives Considered

1. **Microservices per bounded context** (auth-registration, auth-session, auth-password): Rejected due to distributed transaction complexity and performance overhead of inter-service calls for every login.
2. **Auth as library in API gateway**: Rejected because gateway becomes stateful, violates separation of concerns.

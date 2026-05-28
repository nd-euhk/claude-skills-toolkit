---
project: User Authentication System
version: 1.0.0
status: ready-for-implementation
---

# AGENTS.md - User Authentication System

## Project Overview

Email/password authentication system with registration, email verification, login, session management, and password reset.

## Service Topology

```
auth-service (port 8080, 9090 metrics)
  ├── PostgreSQL (auth_db) - User accounts, tokens
  ├── Redis (session_cache) - Active sessions
  └── Message Broker - Domain events
```

## Workflow: How to Implement

1. **Read the routing table** in `agent_docs/README.md` to understand FR -> file mapping.
2. **Read the implementation spec** for the FR you're working on.
3. **Read the test spec** to understand what tests must pass.
4. **Implement in order:** FR-AUTH-001 (Registration) -> FR-AUTH-004 (Verification) -> FR-AUTH-002 (Login) -> FR-AUTH-003 (Password Reset).
5. **Follow the tech design** in `.work/lld/auth-service-tech-design.md` for architecture.
6. **Write tests first** (TDD): RED -> GREEN -> REFACTOR cycle.

## Key Constraints

- **No cross-service DB access** (HB-001): Only auth-service touches auth DB tables.
- **Constant-time comparison** (HB-006): All credential checks use crypto.timingSafeEqual.
- **Password hashes never leave the service** (HB-002).
- **Email sending is always async** (HB-007): Never block API response on email.
- **Rate limiting at gateway** (HB-008): First line of defense before auth service.
- **Hard boundaries** document: `.work/hld/hard-boundaries.md`.

## Specifications Index

| Phase | Output | Path |
|-------|--------|------|
| SRS | Requirements | .work/srs/ |
| HLD | Architecture | .work/hld/ |
| LLD | Tech Design | .work/lld/ |
| IMP | Implementation Specs | .work/impl-specs/ |
| TST | Test Specs | .work/test-specs/ |
| AGT | Agent Config | .work/agent-setup/ |

## Before You Start Coding

1. Run `./pre-flight.sh` to validate environment.
2. Read the migration spec at `.work/impl-specs/migration-spec.md`.
3. Set up the database schema.

## After You Finish

1. Run `./check-traceability.sh` to verify FR coverage.
2. Ensure all acceptance checklist items in impl specs are checked.
3. Run the full test suite.

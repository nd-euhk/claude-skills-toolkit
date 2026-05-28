---
title: "Requirements Traceability Matrix -- Two-Factor Authentication (2FA)"
version: "1.0"
status: current
created: 2026-05-27
last_updated: 2026-05-27
updated_by: "orchestrate-skill (Phase 05)"
depends_on:
  - ../features/README.md
changelog:
  - 1.0 | 2026-05-27 | Initial traceability matrix for 2FA epic
---

# Requirements Traceability Matrix

Single source of truth (SSOT) to trace each FR back to its PRD feature and BRD objective, and forward to impl spec + test spec.

> **Canonical location**: `agent_docs/traceability/requirements-matrix.md`

## Functional Requirements -- Spec Layer

| FR-ID        | FR Title                          | PRD Feature (Phase 2)     | BRD Objective (Phase 1)   | Layer | Impl Spec | Test Spec | Status      |
| ------------ | --------------------------------- | ------------------------- | ------------------------- | ----- | --------- | --------- | ----------- |
| FR-SEC-001   | Enable Two-Factor Authentication  | F-SEC-01 2FA Enrollment   | OBJ-1 Account Security    | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-002   | TOTP Authenticator App Setup      | F-SEC-01 2FA Enrollment   | OBJ-1 Account Security    | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-003   | Backup Recovery Codes             | F-SEC-02 Recovery Tools   | OBJ-2 User Trust           | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-004   | 2FA Challenge During Login        | F-SEC-01 2FA Enrollment   | OBJ-1 Account Security    | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-005   | Remember Trusted Device           | F-SEC-03 User Experience  | OBJ-3 User Convenience     | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-006   | Admin 2FA Enrollment Policy       | F-SEC-04 Admin Controls   | OBJ-4 Compliance           | BE+FE | --        | --        | ⬜ PLANNED  |
| FR-SEC-007   | Account Recovery (Device Lost)    | F-SEC-02 Recovery Tools   | OBJ-2 User Trust           | BE+FE | --        | --        | ⬜ PLANNED  |

## Git Artifacts -- Implementation Layer

Auto-populated by `scripts/check-traceability.sh --populate`. Populated during Phase 08+ (implementation).

| FR-ID        | Branch | PR  | Merge Commit | Owner | Merged At | Changed Paths |
| ------------ | ------ | --- | ------------ | ----- | --------- | ------------- |
| FR-SEC-001   | --     | --  | --           | --    | --        | --            |
| FR-SEC-002   | --     | --  | --           | --    | --        | --            |
| FR-SEC-003   | --     | --  | --           | --    | --        | --            |
| FR-SEC-004   | --     | --  | --           | --    | --        | --            |
| FR-SEC-005   | --     | --  | --           | --    | --        | --            |
| FR-SEC-006   | --     | --  | --           | --    | --        | --            |
| FR-SEC-007   | --     | --  | --           | --    | --        | --            |

## Non-Functional Requirements

| NFR-ID        | Category     | Constraint                                              | Verified Where? | Owner     |
| ------------- | ------------ | ------------------------------------------------------- | --------------- | --------- |
| NFR-PERF-001  | Performance  | 2FA challenge API latency P95 <= 300ms                  | --              | Tech Lead |
| NFR-PERF-002  | Performance  | TOTP code verification latency P99 <= 500ms             | --              | Tech Lead |
| NFR-PERF-003  | Performance  | Recovery code generation P95 <= 200ms                   | --              | Tech Lead |
| NFR-PERF-004  | Performance  | Concurrent 2FA verifications >= 500/sec                 | --              | Tech Lead |
| NFR-PERF-005  | Performance  | Error rate under load < 0.1%                            | --              | Tech Lead |
| NFR-AVAIL-001 | Availability | 2FA service uptime 99.9% monthly                        | --              | SRE       |
| NFR-AVAIL-002 | Availability | TOTP verification availability 99.99% (critical path)   | --              | SRE       |
| NFR-SEC-001   | Security     | TOTP secrets encrypted at rest (AES-256-GCM)            | --              | Security  |
| NFR-SEC-002   | Security     | TOTP code valid exactly 30s (RFC 6238)                  | --              | Security  |
| NFR-SEC-003   | Security     | Rate limit: 5 attempts / 5 min / user                   | --              | Security  |
| NFR-SEC-004   | Security     | Backup codes hashed with strong one-way hash            | --              | Security  |
| NFR-SEC-005   | Security     | Recovery code rate limit: 3 invalid in 10 min           | --              | Security  |
| NFR-SEC-006   | Security     | Immutable audit log for all 2FA state changes           | --              | Security  |
| NFR-SEC-007   | Security     | Trusted device tokens expire after 30 days inactivity   | --              | Security  |
| NFR-SEC-008   | Security     | TOTP secret never in logs/responses/errors              | --              | Security  |
| NFR-SEC-009   | Security     | 2FA setup requires password re-authentication           | --              | Security  |
| NFR-SEC-010   | Security     | Recovery codes shown exactly once, never plaintext after| --              | Security  |
| NFR-SEC-011   | Security     | Admin policy bypass audited, requires super-admin       | --              | Security  |
| NFR-SEC-012   | Security     | Session invalidation on 2FA enable/disable/regenerate   | --              | Security  |
| NFR-SEC-013   | Security     | Progressive delay: 0s, 1s, 2s, 4s, 8s                   | --              | Security  |
| NFR-SCALE-001 | Scalability  | Stateless TOTP verification                             | --              | Tech Lead |
| NFR-SCALE-002 | Scalability  | Recovery code lookup < 10ms p95                         | --              | Tech Lead |
| NFR-SCALE-003 | Scalability  | Trusted device registry >= 10M devices                  | --              | Tech Lead |

## Legend

### Spec Layer

| Field               | Meaning                                                            |
| ------------------- | ------------------------------------------------------------------ |
| **FR-ID**           | Functional Requirement ID -- pattern `FR-{DOMAIN}-{NNN}`           |
| **PRD Feature**     | Epic feature from Phase 2 PRD                                      |
| **BRD Objective**   | Business objective from Phase 1 BRD                                |
| **Layer**           | `BE` / `FE` / `BE+FE`                                              |
| **Impl Spec**       | Link to implementation spec (Phase 8)                              |
| **Test Spec**       | Link to test spec (Phase 9)                                        |
| **Status**          | ⬜ PLANNED / 🟡 IN_PROGRESS / ✅ GREEN / 🔴 RED / ⚠️ BLOCKED        |

## Update Rules

1. **Spec Layer update when**: new FR added, FR modified, status changes
2. **Git Artifacts auto-populated**: after each PR merge via `scripts/check-traceability.sh --populate`
3. **Verify**: `scripts/check-traceability.sh` in CI flags missing impl/test spec

## Anti-Patterns

- Not updating matrix when adding FR
- Status conflict between matrix and real state
- Broken impl/test spec links
- BRD Objective orphan (FR not linked to any business objective)
- NFR without "Verified Where?" = non-testable requirement

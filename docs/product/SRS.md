---
title: "SRS -- Two-Factor Authentication (2FA)"
status: draft
created: 2026-05-27
last_updated: 2026-05-27
updated_by: orchestrate-skill (Phase 05)
depends_on:
  - ../business/BRD.md
  - ../business/business-rules/
  - ../product/PRD.md
  - ../user/URD.md
  - ../ux/UX-UI-SPEC.md
referenced_by:
  - ./SRS-BACKEND.md
  - ./SRS-FRONTEND.md
  - ./features/README.md
  - ../../agent_docs/traceability/requirements-matrix.md
changelog:
  - 1.0 | 2026-05-27 | Initial SRS for two-factor authentication feature
---

# Software Requirements Specification -- Two-Factor Authentication (2FA)

> This is the SRS Master -- contains system overview.
> For detailed backend/frontend SRS, see SRS-BACKEND.md and SRS-FRONTEND.md.

## 1. Functional Requirements

Each FR = 1 file in `docs/product/features/epic-2fa/FR-SEC-NNN--{slug}.md`.

| FR ID | Feature | Domain | Epic | Priority | Layer |
|-------|---------|--------|------|----------|-------|
| FR-SEC-001 | Enable Two-Factor Authentication | SEC | epic-2fa | Must | BE+FE |
| FR-SEC-002 | TOTP Authenticator App Setup | SEC | epic-2fa | Must | BE+FE |
| FR-SEC-003 | Backup Recovery Codes | SEC | epic-2fa | Must | BE+FE |
| FR-SEC-004 | 2FA Challenge During Login | SEC | epic-2fa | Must | BE+FE |
| FR-SEC-005 | Remember Trusted Device | SEC | epic-2fa | Should | BE+FE |
| FR-SEC-006 | Admin 2FA Enrollment Policy | SEC | epic-2fa | Must | BE+FE |
| FR-SEC-007 | Account Recovery When 2FA Device Lost | SEC | epic-2fa | Must | BE+FE |

## 2. Non-Functional Requirements

### 2.1 Performance

| NFR ID | Metric | Target | Measurement | Priority |
|--------|--------|--------|-------------|----------|
| NFR-PERF-001 | 2FA challenge API latency P95 | <= 300ms | Load test (sustained 30 min) | Must |
| NFR-PERF-002 | TOTP code verification latency P99 | <= 500ms | Load test (sustained 30 min) | Must |
| NFR-PERF-003 | Recovery code generation latency P95 | <= 200ms | Load test | Must |
| NFR-PERF-004 | Concurrent 2FA verifications | >= 500 per second | Stress test | Must |
| NFR-PERF-005 | Error rate under load | < 0.1% | Load test | Must |

### 2.2 Availability

| NFR ID | Metric | Target |
|--------|--------|--------|
| NFR-AVAIL-001 | 2FA service uptime | 99.9% monthly |
| NFR-AVAIL-002 | TOTP verification availability during degraded mode | 99.99% (critical path) |

### 2.3 Security

| NFR ID | Requirement | OWASP Ref | Priority |
|--------|------------|-----------|----------|
| NFR-SEC-001 | TOTP secrets stored encrypted at rest (AES-256-GCM) | A02 | Must |
| NFR-SEC-002 | TOTP code valid for exactly 30 seconds (RFC 6238), no grace period extension beyond one window | A07 | Must |
| NFR-SEC-003 | Rate limiting on 2FA challenge: 5 attempts per 5 minutes per user | A05 | Must |
| NFR-SEC-004 | Backup codes hashed with strong one-way hash before storage | A02 | Must |
| NFR-SEC-005 | Backup code attempt rate limit: 3 invalid codes in 10 minutes triggers account lock | A05 | Must |
| NFR-SEC-006 | All 2FA state changes produce immutable audit log entries | A09 | Must |
| NFR-SEC-007 | Trusted device tokens expire after 30 days of inactivity | A07 | Must |
| NFR-SEC-008 | TOTP secret must never appear in logs, responses, or error messages | A09 | Must |
| NFR-SEC-009 | 2FA setup requires re-authentication (current password) before proceeding | A07 | Must |
| NFR-SEC-010 | Recovery code display: shown exactly once, never stored in plaintext after initial display | A02 | Must |
| NFR-SEC-011 | Admin 2FA policy enforcement bypass is audited and requires super-admin approval | A01 | Must |
| NFR-SEC-012 | Session invalidation on 2FA enable/disable or recovery code regeneration | A07 | Must |
| NFR-SEC-013 | Brute force protection: progressive delay after consecutive 2FA failures (1s, 2s, 4s, 8s, 16s) | A05 | Must |

### 2.4 Scalability

| NFR ID | Requirement | Target | Priority |
|--------|------------|--------|----------|
| NFR-SCALE-001 | Stateless TOTP verification (no server-side session for code check) | All verification nodes handle any request | Must |
| NFR-SCALE-002 | Recovery code lookup optimized for high throughput | < 10ms p95 lookup time | Should |
| NFR-SCALE-003 | Trusted device registry supports | >= 10 million devices | Should |

## 3. Interface Requirements

| IR ID | External System | Protocol | Direction |
|-------|----------------|----------|-----------|
| IR-001 | Authenticator App (Google Authenticator, Authy, etc.) | TOTP (RFC 6238) via user device | Inbound (user provides code) |
| IR-002 | Notification Service (email/SMS for recovery) | Event-driven | Outbound |

## 4. Constraints

- TOTP implementation MUST conform to RFC 6238
- TOTP secret key length MUST be >= 160 bits (20 bytes) as recommended by RFC 4226
- QR code for TOTP setup MUST use the standard otpauth:// URI format
- Recovery codes: exactly 10 codes, each 16 characters, generated with cryptographically secure random
- All 2FA operations MUST be performed over TLS 1.3
- Account recovery MUST require identity verification through at least one alternate channel (email or SMS)
- The system MUST NOT allow 2FA to be disabled without a valid second factor or recovery code

## 5. Traceability Matrix

| FR/NFR | PRD Feature | BRD Objective |
|--------|-------------|---------------|
| FR-SEC-001 | F-SEC-01 2FA Enrollment | OBJ-1 Account Security |
| FR-SEC-002 | F-SEC-01 2FA Enrollment | OBJ-1 Account Security |
| FR-SEC-003 | F-SEC-02 Account Recovery Tools | OBJ-2 User Trust |
| FR-SEC-004 | F-SEC-01 2FA Enrollment | OBJ-1 Account Security |
| FR-SEC-005 | F-SEC-03 User Experience | OBJ-3 User Convenience |
| FR-SEC-006 | F-SEC-04 Admin Controls | OBJ-4 Compliance |
| FR-SEC-007 | F-SEC-02 Account Recovery Tools | OBJ-2 User Trust |
| NFR-SEC-001 to NFR-SEC-013 | F-SEC-01 through F-SEC-04 | OBJ-1 through OBJ-4 |

# Product Backlog

Auto-generated from: `agent_docs/roadmap.md` Phase 1 features.
Convention: BL-{DOMAIN}-{NNN} for backlog items, traceable to FR-{DOMAIN}-{NNN}.

---

## Phase 1: Core Foundation (Q2 2026)

Status: 🚧 In Progress

### FR-AUTH-001: User Login

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 1 | BL-AUTH-001 | Design login API contract | auth-service | Must | 🔲 Todo | Sprint 1 | None |
| 2 | BL-AUTH-002 | Implement POST /auth/login endpoint | auth-service | Must | 🔲 Todo | Sprint 1 | BL-AUTH-001 |
| 3 | BL-AUTH-003 | Implement JWT token issuance and validation | auth-service | Must | 🔲 Todo | Sprint 1 | BL-AUTH-002 |
| 4 | BL-AUTH-004 | Build login page UI component | web-app | Must | 🔲 Todo | Sprint 1 | BL-AUTH-001 |
| 5 | BL-AUTH-005 | Write tests for login flow | auth-service, web-app | Must | 🔲 Todo | Sprint 1 | BL-AUTH-002, BL-AUTH-004 |

### FR-AUTH-002: Password Reset

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 6 | BL-AUTH-006 | Design password reset API contract | auth-service | Should | 🔲 Todo | Sprint 2 | FR-AUTH-001 |
| 7 | BL-AUTH-007 | Implement POST /auth/forgot-password endpoint | auth-service | Should | 🔲 Todo | Sprint 2 | BL-AUTH-006 |
| 8 | BL-AUTH-008 | Implement POST /auth/reset-password with token validation | auth-service | Should | 🔲 Todo | Sprint 2 | BL-AUTH-007 |
| 9 | BL-AUTH-009 | Build password reset UI flow (forgot + reset pages) | web-app | Should | 🔲 Todo | Sprint 2 | BL-AUTH-006 |
| 10 | BL-AUTH-010 | Write tests for password reset flow | auth-service, web-app | Should | 🔲 Todo | Sprint 2 | BL-AUTH-007, BL-AUTH-009 |

### FR-DASH-001: Dashboard UI

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 11 | BL-DASH-001 | Design dashboard data API contract | web-app | Must | ✅ Done | Sprint 1 | FR-AUTH-001 |
| 12 | BL-DASH-002 | Implement GET /dashboard/summary aggregation endpoint | web-app | Must | 🔲 Todo | Sprint 1 | BL-DASH-001 |
| 13 | BL-DASH-003 | Build dashboard layout and navigation shell | web-app | Must | 🔲 Todo | Sprint 1 | None |
| 14 | BL-DASH-004 | Implement key metric widgets (cards, charts) | web-app | Must | 🔲 Todo | Sprint 1 | BL-DASH-002, BL-DASH-003 |
| 15 | BL-DASH-005 | Write tests for dashboard UI and API | web-app | Must | 🔲 Todo | Sprint 1 | BL-DASH-002, BL-DASH-004 |

---

## Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| 🔲 | Todo | Not yet started |
| ✅ | Ready | Ready for development |
| 🟡 | In Progress | Actively being worked on |
| ✅ | Done | Completed and verified |
| ⚠️ | Blocked | Waiting on dependency |
| ❌ | Cancelled | No longer needed |

## Phase 2: Enhanced Experience (Q3 2026)

Status: 🔲 Todo

### FR-DASH-002: Advanced Analytics

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 16 | BL-DASH-006 | Design analytics data pipeline | web-app | Should | 🔲 Todo | Sprint 3 | FR-DASH-001 |
| 17 | BL-DASH-007 | Implement chart rendering engine | web-app | Should | 🔲 Todo | Sprint 3 | BL-DASH-006 |

### FR-AUTH-003: OAuth Integration

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 18 | BL-AUTH-011 | Implement Google OAuth provider | auth-service | Could | 🔲 Todo | Sprint 3 | FR-AUTH-001 |
| 19 | BL-AUTH-012 | Implement GitHub OAuth provider | auth-service | Could | 🔲 Todo | Sprint 3 | FR-AUTH-001 |

### FR-PAY-001: Payment Gateway

| # | Backlog ID | Title | Component | Priority | Status | Sprint | Dependencies |
|---|------------|-------|-----------|----------|--------|--------|--------------|
| 20 | BL-PAY-001 | Design payment API contract | payment-service | Must | ✅ Ready | Sprint 2 | FR-AUTH-001 |
| 21 | BL-PAY-002 | Implement payment gateway integration | payment-service | Must | 🔲 Todo | Sprint 2 | BL-PAY-001 |
| 22 | BL-PAY-003 | Write tests for payment flow | payment-service | Must | 🔲 Todo | Sprint 2 | BL-PAY-002 |

---

## ID Convention

- **Feature (roadmap)**: `FR-{DOMAIN}-{NNN}` (e.g., FR-AUTH-001)
- **Backlog item**: `BL-{DOMAIN}-{NNN}` (e.g., BL-AUTH-001)
- **Board task**: `TSK-{DOMAIN}-{NNN}` (e.g., TSK-AUTH-001)

## Traceability

- Each backlog item maps to exactly one parent feature via its `FR-*` prefix.
- Backlog items are the bridge between roadmap features and sprint board tasks.
- Status changes flow: Board tasks → Backlog items → Roadmap features → Phase.

## Direct Backlog Entries (BL-NNN Format)

| # | Feature ID | Feature | Priority | Phase | Status | Dependencies | Notes |
|---|-----------|---------|----------|-------|--------|-------------|-------|
| BL-001 | FR-AUTH-001 | User Login | Must | Phase 1 | 🔲 Todo | — | Core authentication |
| BL-002 | FR-AUTH-002 | Password Reset | Should | Phase 1 | 🔲 Todo | BL-001 | Depends on login |
| BL-003 | FR-DASH-001 | Dashboard UI | Must | Phase 1 | 🔲 Todo | BL-001 | Post-login landing |
| BL-004 | FR-PAY-001 | Payment Gateway | Must | Phase 2 | ✅ Ready | — | payment-service |

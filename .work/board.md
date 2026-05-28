# Sprint 1 Board

Sprint: 1  
Duration: 2 weeks  
Scope: Phase 1 Must-have features (FR-AUTH-001 User Login, FR-DASH-001 Dashboard UI)  
Goal: Working login flow + basic dashboard visible behind authentication  

---

## Sprint Backlog (from Phase 1 Must items)

| Backlog ID | Title | Feature | Priority |
|------------|-------|---------|----------|
| BL-AUTH-001 | Design login API contract | FR-AUTH-001 | Must |
| BL-AUTH-002 | Implement POST /auth/login endpoint | FR-AUTH-001 | Must |
| BL-AUTH-003 | Implement JWT token issuance and validation | FR-AUTH-001 | Must |
| BL-AUTH-004 | Build login page UI component | FR-AUTH-001 | Must |
| BL-AUTH-005 | Write tests for login flow | FR-AUTH-001 | Must |
| BL-DASH-001 | Design dashboard data API contract | FR-DASH-001 | Must |
| BL-DASH-002 | Implement GET /dashboard/summary aggregation endpoint | FR-DASH-001 | Must |
| BL-DASH-003 | Build dashboard layout and navigation shell | FR-DASH-001 | Must |
| BL-DASH-004 | Implement key metric widgets (cards, charts) | FR-DASH-001 | Must |
| BL-DASH-005 | Write tests for dashboard UI and API | FR-DASH-001 | Must |

---

## Board Columns

| Column | Meaning |
|--------|---------|
| 🔲 **Todo** | Ready to be picked up |
| 🟡 **In Progress** | Actively being worked on |
| 👀 **Review** | Awaiting code review / QA |
| ✅ **Done** | Completed, merged, verified |
| ⚠️ **Blocked** | Waiting on external dependency |

---

## Auth Service Tasks (FR-AUTH-001: User Login)

### BL-AUTH-001: Design login API contract

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-AUTH-001 | Define POST /auth/login request/response JSON schema | ✅ Done | 2 | -- | -- |
| TSK-AUTH-002 | Document authentication error codes and HTTP status mapping | 🚧 In Progress | 1 | -- | -- |
| TSK-AUTH-003 | Create OpenAPI spec for auth endpoints | ✅ Ready | 3 | -- | TSK-AUTH-001 |

### BL-AUTH-002: Implement POST /auth/login endpoint

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-AUTH-004 | Create /auth/login route handler | 🔲 Todo | 3 | -- | TSK-AUTH-001 |
| TSK-AUTH-005 | Implement credential validation against user store | 🔲 Todo | 5 | -- | TSK-AUTH-004 |
| TSK-AUTH-006 | Add rate limiting middleware (5 attempts / 5 min) | 🔲 Todo | 3 | -- | TSK-AUTH-004 |
| TSK-AUTH-007 | Implement account lockout after N failed attempts | 🔲 Todo | 5 | -- | TSK-AUTH-005 |

### BL-AUTH-003: Implement JWT token issuance and validation

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-AUTH-008 | Implement JWT access token generation on login success | 🔲 Todo | 3 | -- | TSK-AUTH-005 |
| TSK-AUTH-009 | Implement JWT refresh token generation and rotation | 🔲 Todo | 5 | -- | TSK-AUTH-008 |
| TSK-AUTH-010 | Build auth middleware for protected route verification | 🔲 Todo | 5 | -- | TSK-AUTH-008 |
| TSK-AUTH-011 | Implement POST /auth/refresh endpoint | 🔲 Todo | 3 | -- | TSK-AUTH-009 |

### BL-AUTH-004: Build login page UI component

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-AUTH-012 | Create login form with email/password fields and validation | ✅ Ready | 5 | -- | -- |
| TSK-AUTH-013 | Wire login form to POST /auth/login API with error display | ✅ Ready | 3 | -- | TSK-AUTH-004, TSK-AUTH-012 |
| TSK-AUTH-014 | Implement loading state, success redirect, and "remember me" | 🔲 Todo | 3 | -- | TSK-AUTH-013 |
| TSK-AUTH-015 | Add client-side route guard for unauthenticated redirects | 🔲 Todo | 3 | -- | TSK-AUTH-010 |

### BL-AUTH-005: Write tests for login flow

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-AUTH-016 | Write unit tests for login endpoint (valid, invalid, edge cases) | 🔲 Todo | 5 | -- | TSK-AUTH-004 |
| TSK-AUTH-017 | Write unit tests for JWT middleware (valid, expired, tampered) | 🔲 Todo | 5 | -- | TSK-AUTH-010 |
| TSK-AUTH-018 | Write E2E test: user navigates to app, logs in, reaches dashboard | 🔲 Todo | 5 | -- | TSK-AUTH-013, TSK-AUTH-015 |

---

## Web App Tasks (FR-DASH-001: Dashboard UI)

### BL-DASH-001: Design dashboard data API contract

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-DASH-001 | Define GET /dashboard/summary response JSON schema | ✅ Done | 2 | -- | -- |
| TSK-DASH-002 | Document dashboard API endpoints and query parameters | ✅ Done | 1 | -- | -- |
| TSK-DASH-003 | Create OpenAPI spec for dashboard endpoints | ✅ Done | 3 | -- | TSK-DASH-001 |

### BL-DASH-002: Implement GET /dashboard/summary aggregation endpoint

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-DASH-004 | Create /dashboard/summary route handler (auth-protected) | 🔲 Todo | 3 | -- | TSK-DASH-001, TSK-AUTH-010 |
| TSK-DASH-005 | Implement data aggregation queries (users, activity, metrics) | 🔲 Todo | 8 | -- | TSK-DASH-004 |
| TSK-DASH-006 | Add response caching layer (TTL 60s) | 🔲 Todo | 3 | -- | TSK-DASH-005 |

### BL-DASH-003: Build dashboard layout and navigation shell

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-DASH-007 | Create responsive dashboard shell with header + sidebar | ✅ Ready | 5 | -- | -- |
| TSK-DASH-008 | Implement sidebar navigation with active state highlighting | ✅ Ready | 3 | -- | TSK-DASH-007 |
| TSK-DASH-009 | Add user info header (name, avatar, logout button) | 🔲 Todo | 2 | -- | TSK-DASH-007 |

### BL-DASH-004: Implement key metric widgets (cards, charts)

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-DASH-010 | Build summary stat cards component (total users, active now, etc.) | 🔲 Todo | 5 | -- | TSK-DASH-007 |
| TSK-DASH-011 | Build time-series chart widget (user signups over time) | 🔲 Todo | 8 | -- | TSK-DASH-007 |
| TSK-DASH-012 | Wire all widgets to /dashboard/summary API data | 🔲 Todo | 3 | -- | TSK-DASH-004, TSK-DASH-010, TSK-DASH-011 |
| TSK-DASH-013 | Add loading skeletons and empty states for widgets | 🔲 Todo | 3 | -- | TSK-DASH-012 |

### BL-DASH-005: Write tests for dashboard UI and API

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| TSK-DASH-014 | Write unit tests for /dashboard/summary endpoint | 🔲 Todo | 5 | -- | TSK-DASH-004 |
| TSK-DASH-015 | Write component tests for dashboard widgets | 🔲 Todo | 5 | -- | TSK-DASH-010, TSK-DASH-011 |
| TSK-DASH-016 | Write E2E test: login -> dashboard renders with live data | 🔲 Todo | 5 | -- | TSK-DASH-012, TSK-AUTH-018 |

---

## Sprint 1 Summary

| Metric | Count |
|--------|-------|
| Backlog items in scope | 10 (5 auth + 5 dashboard) |
| Total board tasks | 34 |
| Total story points | 146 |
| Auth tasks | 18 |
| Dashboard tasks | 16 |

## Task Identifier Convention

| Prefix | Level | Example | Traces to |
|--------|-------|---------|-----------|
| `FR-` | Feature (roadmap) | FR-AUTH-001 | Phase |
| `BL-` | Backlog item | BL-AUTH-001 | FR-AUTH-001 |
| `TSK-` | Board task | TSK-AUTH-001 | BL-AUTH-001 |

## Dependency Flow (critical path)

```
BL-AUTH-001 (contract)
  -> TSK-AUTH-004 (route handler)
    -> TSK-AUTH-005 (credential validation)
      -> TSK-AUTH-008 (JWT generation)
        -> TSK-AUTH-010 (auth middleware)
          -> TSK-DASH-004 (protected dashboard API)
```

## Done Definition per Task

A board task is **Done** when:
1. Code passes all unit tests
2. Code reviewed and approved by one peer
3. Merged to `main` branch
4. Feature flag enabled (if applicable)
5. No unresolved comments on PR

---

## Payment Service Tasks (FR-PAY-001: Payment Gateway, BL-PAY-001)

| Task ID | Title | Status | Story Pts | Assignee | Depends On |
|---------|-------|--------|-----------|----------|------------|
| T-010 | Implement Payment Gateway integration with Stripe | ✅ Ready | 8 | unassigned | -- |

# Sprint 1 Roadmap: User Authentication

**Duration:** 2 weeks
**Goal:** Working email/password auth with registration, verification, login, password reset

## Sprint Backlog

### Day 1-2: Foundation
- [ ] **TASK-1:** Set up project structure (auth-service skeleton, database, Redis, CI)
- [ ] **TASK-2:** Run database migration (users, verification_tokens, reset_tokens, idempotency_keys)
- [ ] **TASK-3:** Configure API gateway routes and rate limiting

### Day 3-5: Registration & Verification
- [ ] **TASK-4:** [FR-AUTH-001] Implement user registration
  - [ ] Write failing tests (RED) based on FR-AUTH-001-test.md
  - [ ] Implement RegistrationService, RegisterController (GREEN)
  - [ ] Implement email event publishing
  - [ ] Refactor (REFACTOR)
  - [ ] Acceptance checklist pass
- [ ] **TASK-5:** [FR-AUTH-004] Implement email verification
  - [ ] Write failing tests based on FR-AUTH-004-test.md
  - [ ] Implement TokenService verification, VerifyController
  - [ ] Acceptance checklist pass

### Day 6-8: Authentication
- [ ] **TASK-6:** [FR-AUTH-002] Implement user login
  - [ ] Write failing tests based on FR-AUTH-002-test.md
  - [ ] Implement AuthenticationService, LoginController, SessionService
  - [ ] Implement account lockout logic
  - [ ] Implement session creation in Redis
  - [ ] Acceptance checklist pass

### Day 9-10: Password Reset
- [ ] **TASK-7:** [FR-AUTH-003] Implement password reset
  - [ ] Write failing tests based on FR-AUTH-003-test.md
  - [ ] Implement PasswordController, reset flow
  - [ ] Implement session invalidation on reset
  - [ ] Acceptance checklist pass

### Day 11-12: Hardening
- [ ] **TASK-8:** Run full test suite (all layers)
- [ ] **TASK-9:** Run performance tests (k6) - verify P95 targets
- [ ] **TASK-10:** Security review (constant-time, token entropy, password hashing)
- [ ] **TASK-11:** Run pre-flight.sh and check-traceability.sh
- [ ] **TASK-12:** Fix any gate review failures

### Day 13-14: Deploy
- [ ] **TASK-13:** Deploy to staging
- [ ] **TASK-14:** Smoke test in staging
- [ ] **TASK-15:** Deploy to production (canary)
- [ ] **TASK-16:** Monitor error rates and latency

## Dependencies
- TASK-5 depends on TASK-4 (verification tokens come from registration)
- TASK-6 depends on TASK-5 (login requires verified users)
- TASK-7 depends on TASK-4 (reset requires registered users)

---
fr_id: FR-AUTH-002
title: User Login - Test Specification
version: 1.0.0
status: draft
context_isolation: true
---

# Test Spec: FR-AUTH-002 - User Login

## 1. Unit Tests (Service Layer)

### UT-002-001: Constant-time password comparison
- **Scenario:** SRS FR-AUTH-002, Security (NFR-SEC-005)
- **Test data:** Compare correct and incorrect passwords, time both
- **Expected:** Time difference < 1ms between correct and incorrect
- **Layer:** Unit

### UT-002-002: Progressive lockout timing
- **Scenario:** SRS FR-AUTH-002, Scenario Outline "Account locks after exceeding threshold"
- **Test data:** Simulate 5, 10, 15, 20 failed attempts
- **Expected:** Lockout durations: 5min, 15min, 30min, 60min respectively
- **Layer:** Unit

### UT-002-003: Successful login resets failed counter
- **Scenario:** SRS FR-AUTH-002, "Successful login resets failed counter"
- **Test data:** User with failed_login_count=4, valid login
- **Expected:** failed_login_count=0, locked_until=NULL
- **Layer:** Unit

### UT-002-004: Session token entropy >= 256 bits
- **Scenario:** SRS NFR-SEC-003
- **Test data:** Generate 1000 session tokens
- **Expected:** All tokens unique, entropy test passes (monobit, runs test)
- **Layer:** Unit

## 2. Controller Tests

### CT-002-001: POST /auth/login returns 200 with session cookie
- **Scenario:** SRS FR-AUTH-002, "User logs in with valid credentials"
- **Test data:** Valid email + valid password
- **Expected:** 200, Set-Cookie header present with HttpOnly/Secure/SameSite flags
- **Layer:** Controller

### CT-002-002: POST /auth/login returns 401 for invalid credentials
- **Scenario:** SRS FR-AUTH-002, Scenario Outline
- **Test data:** Wrong password for existing email
- **Expected:** 401, body: INVALID_CREDENTIALS, no Set-Cookie
- **Layer:** Controller

### CT-002-003: POST /auth/login returns 423 for locked account
- **Scenario:** SRS FR-AUTH-002, Scenario Outline
- **Test data:** User with locked_until in the future
- **Expected:** 423, body includes remaining lockout time
- **Layer:** Controller

### CT-002-004: Response time similar for wrong password vs nonexistent email
- **Scenario:** SRS NFR-SEC-005, timing attack prevention
- **Test data:** 1000 requests for wrong password and 1000 for nonexistent email
- **Expected:** P95 time difference < 5ms (account for DB variance)
- **Layer:** Controller (statistical test)

## 3. Repository Tests

### RT-002-001: Atomic failed_login_count increment
- **Test data:** Concurrent increments on same user from 5 threads
- **Expected:** Final count = initial + 5 (no lost updates)
- **Layer:** Repository

### RT-002-002: Session stored in Redis with correct TTL
- **Test data:** Create session, check Redis TTL
- **Expected:** TTL = 7 days (604800 seconds) within 5s tolerance
- **Layer:** Repository (embedded Redis)

## 4. Client Tests (WireMock)

### CL-002-001: No external calls during login
- **Scenario:** Login flow is self-contained
- **Test data:** WireMock proxy recording
- **Expected:** No calls to external services during login (email/queue)
- **Layer:** Client

## 5. Integration Tests

### IT-002-001: Full login and session validation flow
- **Scenario:** SRS FR-AUTH-002 happy path
- **Test data:** Login -> extract session cookie -> GET /auth/session
- **Expected:** Session returns correct user_id and email
- **Layer:** Integration

### IT-002-002: Concurrent logins from different devices
- **Scenario:** SRS FR-AUTH-002, "User logs in from multiple devices"
- **Test data:** Two concurrent login requests with different User-Agent headers
- **Expected:** Both succeed, two distinct session IDs
- **Layer:** Integration

### IT-002-003: Max concurrent session enforcement
- **Scenario:** SRS NFR-SEC-003, max 10 sessions
- **Test data:** Login 11 times from different "devices"
- **Expected:** 10 active sessions, oldest session invalidated
- **Layer:** Integration

## 6. Architecture Tests

### AT-002-001: Login response DTO excludes password_hash
- **Scenario:** Hard boundary HB-002
- **Expected:** Response DTO has no password-related field
- **Layer:** Architecture

### AT-002-002: SessionService isolated from UserRepository
- **Scenario:** Separation of concerns
- **Expected:** SessionService has no dependency on UserRepository
- **Layer:** Architecture

## 7. Performance Tests (k6)

### PT-002-001: Login throughput at 1000 req/s
- **Scenario:** NFR-PERF-002
- **Test data:** k6, 1000 VUs, pre-seeded user accounts
- **Expected:** >= 1000 req/s sustained for 5 minutes, error rate < 0.1%
- **Layer:** Performance

### PT-002-002: Login P95 latency
- **Scenario:** NFR-PERF-001, P95 < 200ms
- **Test data:** k6 ramping test
- **Expected:** P95 < 200ms at 1000 req/s
- **Layer:** Performance

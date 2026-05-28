---
fr_id: FR-AUTH-001
title: User Registration - Test Specification
version: 1.0.0
status: draft
context_isolation: true
---

# Test Spec: FR-AUTH-001 - User Registration

## 1. Unit Tests (Service Layer)

### UT-001-001: Password validation - weak password rejected
- **Scenario:** SRS FR-AUTH-001, Scenario Outline "Registration validation errors"
- **Test data:** password="weak", email="user@test.com"
- **Expected:** WEAK_PASSWORD error
- **Layer:** Unit (RegistrationService)

### UT-001-002: Email normalization
- **Scenario:** SRS FR-AUTH-001, "Successful user registration"
- **Test data:** email="  User@Example.COM  "
- **Expected:** Email normalized to "user@example.com"
- **Layer:** Unit (Email value object)

### UT-001-003: Password hashing produces unique salt
- **Scenario:** SRS FR-AUTH-001, Security requirements
- **Test data:** Hash same password twice
- **Expected:** Two different hashes (unique salts)
- **Layer:** Unit (PasswordService)

### UT-001-004: Duplicate email detection
- **Scenario:** SRS FR-AUTH-001, "Registration fails with DUPLICATE_EMAIL"
- **Test data:** Existing user "existing@test.com", register with same email
- **Expected:** DUPLICATE_EMAIL error
- **Layer:** Unit (RegistrationService with mock UserRepository)

## 2. Controller Tests (HTTP Layer)

### CT-001-001: POST /auth/register returns 201 on success
- **Scenario:** SRS FR-AUTH-001, "Successful user registration"
- **Test data:** valid email + valid password + matching confirmation
- **Expected:** 201 Created, response body includes success message
- **Layer:** Controller (MockMvc or equivalent)

### CT-001-002: POST /auth/register returns 400 on validation failure
- **Scenario:** SRS FR-AUTH-001, Scenario Outline examples
- **Test data:** Request with empty email field
- **Expected:** 400, error body has VALIDATION_ERROR, details include email field
- **Layer:** Controller

### CT-001-003: Idempotency key returns same response
- **Scenario:** SRS FR-AUTH-001, "Idempotent registration"
- **Test data:** Register with Idempotency-Key, repeat same request
- **Expected:** Both return 201, identical response body
- **Layer:** Controller

### CT-001-004: Invalid JSON body returns 400
- **Scenario:** Edge case - malformed request
- **Test data:** Non-JSON body
- **Expected:** 400 VALIDATION_ERROR
- **Layer:** Controller

## 3. Repository Tests (Data Layer)

### RT-001-001: Insert user and retrieve by email
- **Test data:** Insert user row
- **Expected:** Retrieved row matches, email is normalized
- **Layer:** Repository (Testcontainers or embedded DB)

### RT-001-002: UNIQUE constraint on email enforced
- **Test data:** Insert two users with same email
- **Expected:** Second insert throws constraint violation
- **Layer:** Repository

### RT-001-003: Verification token created with 24h expiry
- **Test data:** Create token, check expires_at
- **Expected:** expires_at = created_at + 24h (within 1s tolerance)
- **Layer:** Repository

## 4. Client Tests (WireMock)

### CL-001-001: Email provider called with correct payload
- **Scenario:** SRS FR-AUTH-001, async email sending
- **Test data:** WireMock stub for email provider API
- **Expected:** Email provider receives POST with email, verification link, template
- **Layer:** Client (WireMock)

### CL-001-002: Email provider failure retry
- **Scenario:** SRS NFR-REL-001, email retry with exponential backoff
- **Test data:** WireMock returns 503 for first 2 attempts, 200 for 3rd
- **Expected:** Retried 3 times, succeeds on 3rd attempt
- **Layer:** Client

## 5. Integration Tests

### IT-001-001: Full registration flow end-to-end
- **Scenario:** SRS FR-AUTH-001 happy path
- **Test data:** Register -> verify inserted user -> check token created -> check email queued
- **Expected:** User in DB, token in DB, email event in queue
- **Layer:** Integration (real DB, mock email, mock queue)

### IT-001-002: Concurrent registration race condition
- **Scenario:** SRS FR-AUTH-001, "Concurrent registration for same email"
- **Test data:** Two threads simultaneously register "race@test.com"
- **Expected:** Exactly one 201, one 409. Only one user in DB.
- **Layer:** Integration (concurrent test runner)

### IT-001-003: Transaction rollback on partial failure
- **Scenario:** Edge case - DB constraint failure
- **Test data:** Registration where token insert intentionally fails
- **Expected:** User NOT persisted (full rollback). No orphan record.
- **Layer:** Integration

## 6. Architecture Tests

### AT-001-001: No cross-service imports
- **Scenario:** Hard boundary HB-001 enforcement
- **Expected:** Auth service has no imports from other services' data models
- **Layer:** Architecture (ArchUnit or equivalent)

### AT-001-002: Registration controller depends on registration service
- **Scenario:** Layered architecture enforcement
- **Expected:** Controller -> Service -> Repository dependency direction only
- **Layer:** Architecture

### AT-001-003: No password hash in API response
- **Scenario:** Hard boundary HB-002 enforcement
- **Expected:** Response DTO for registration has no password_hash field
- **Layer:** Architecture (static analysis on DTO classes)

## 7. Performance Tests (k6)

### PT-001-001: Registration throughput
- **Scenario:** NFR-PERF-002, 100 registration requests/second
- **Test data:** k6 script with 100 VUs, 1 minute duration, unique emails
- **Expected:** >= 100 req/s, P95 < 500ms, P99 < 1000ms
- **Layer:** Performance (k6)

### PT-001-002: Registration response time under load
- **Scenario:** NFR-PERF-001, P95 < 500ms
- **Test data:** Gradual ramp from 1 to 100 VUs over 2 minutes
- **Expected:** P95 < 500ms at all load levels
- **Layer:** Performance (k6)

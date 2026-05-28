---
fr_id: FR-AUTH-003
title: Password Reset - Test Specification
version: 1.0.0
status: draft
context_isolation: true
---

# Test Spec: FR-AUTH-003 - Password Reset

## 1. Unit Tests

### UT-003-001: Reset token generation with 30min TTL
- **Scenario:** SRS FR-AUTH-003, reset token created with expiration
- **Test data:** Generate reset token
- **Expected:** expires_at = created_at + 30 minutes, token entropy >= 256 bits
- **Layer:** Unit (TokenService)

### UT-003-002: New reset request invalidates old tokens
- **Scenario:** SRS FR-AUTH-003, "Multiple reset requests invalidate previous tokens"
- **Test data:** Create token 1, then request token 2 for same user
- **Expected:** Token 1 marked as invalid (used_at set or deleted)
- **Layer:** Unit

## 2. Controller Tests

### CT-003-001: POST /auth/password-reset returns 200 for existing email
- **Scenario:** SRS FR-AUTH-003, Step 1 success
- **Test data:** Existing user email
- **Expected:** 200, "If account exists" message
- **Layer:** Controller

### CT-003-002: POST /auth/password-reset returns 200 for nonexistent email
- **Scenario:** SRS FR-AUTH-003, "Password reset request preserves email privacy"
- **Test data:** Non-existent email
- **Expected:** 200, SAME message as existing email. Response time within 10ms.
- **Layer:** Controller

### CT-003-003: PUT /auth/password-reset with valid token succeeds
- **Scenario:** SRS FR-AUTH-003, "User resets password successfully"
- **Test data:** Valid reset token + new password + confirmation
- **Expected:** 200, password updated, sessions cleared
- **Layer:** Controller

### CT-003-004: PUT /auth/password-reset with expired token fails
- **Scenario:** SRS FR-AUTH-003, Scenario Outline
- **Test data:** Expired reset token
- **Expected:** 400, INVALID_OR_EXPIRED_TOKEN
- **Layer:** Controller

## 3. Repository Tests

### RT-003-001: Token one-time use via WHERE used_at IS NULL
- **Scenario:** SRS FR-AUTH-003, "Concurrent reset with same token"
- **Test data:** Two concurrent UPDATE attempts on same token
- **Expected:** Exactly one sets used_at, other finds zero rows affected
- **Layer:** Repository

## 4. Client Tests (WireMock)

### CL-003-001: Email provider receives reset email payload
- **Scenario:** SRS FR-AUTH-003, reset email sent asynchronously
- **Test data:** WireMock stub for email provider
- **Expected:** Email API called with reset template, reset link contains token
- **Layer:** Client

## 5. Integration Tests

### IT-003-001: Full reset flow with session invalidation
- **Scenario:** SRS FR-AUTH-003, complete flow
- **Test data:** Login to create session -> request reset -> execute reset -> attempt to use old session
- **Expected:** Old session rejected (401), login with new password succeeds
- **Layer:** Integration

### IT-003-002: Password reset unlocks account
- **Scenario:** SRS FR-AUTH-003, "Password reset unlocks account"
- **Test data:** Lock account via 5 failed logins -> reset password -> attempt login
- **Expected:** Login with new password succeeds, failed_login_count=0
- **Layer:** Integration

## 6. Architecture Tests

### AT-003-001: Password hash never in reset response
- **Scenario:** Hard boundary HB-002
- **Expected:** No response endpoint returns password_hash
- **Layer:** Architecture

## 7. Performance Tests

### PT-003-001: Reset request P95 < 300ms
- **Scenario:** NFR-PERF-001
- **Test data:** k6, 50 VUs
- **Expected:** P95 < 300ms (excl. email sending)
- **Layer:** Performance

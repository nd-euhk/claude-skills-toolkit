---
fr_id: FR-AUTH-004
title: Email Verification - Test Specification
version: 1.0.0
status: draft
context_isolation: true
---

# Test Spec: FR-AUTH-004 - Email Verification

## 1. Unit Tests

### UT-004-001: Verification token validation with 24h TTL
- **Scenario:** SRS FR-AUTH-004, successful verification
- **Test data:** Token within 24h window
- **Expected:** Token valid, user status updated
- **Layer:** Unit (TokenService)

## 2. Controller Tests

### CT-004-001: POST /auth/verify-email with valid token returns 200
- **Scenario:** SRS FR-AUTH-004, "User verifies email successfully"
- **Test data:** Valid verification token
- **Expected:** 200, user verified
- **Layer:** Controller

### CT-004-002: POST /auth/verify-email with expired token returns 400
- **Scenario:** SRS FR-AUTH-004, Scenario Outline
- **Test data:** Token with expires_at < NOW()
- **Expected:** 400, INVALID_OR_EXPIRED_TOKEN
- **Layer:** Controller

### CT-004-003: POST /auth/verify-email with already-used token returns 400
- **Scenario:** SRS FR-AUTH-004, Scenario Outline
- **Test data:** Token with used_at IS NOT NULL
- **Expected:** 400, INVALID_OR_EXPIRED_TOKEN
- **Layer:** Controller

### CT-004-004: POST /auth/verify-email for already-verified user returns 409
- **Scenario:** SRS FR-AUTH-004, edge case
- **Test data:** Request verification for already-verified user
- **Expected:** 409, ALREADY_VERIFIED
- **Layer:** Controller

## 3. Repository Tests

### RT-004-001: Token one-time use under concurrency
- **Scenario:** SRS FR-AUTH-004, "Concurrent verification with same token"
- **Test data:** Two concurrent UPDATEs on same token
- **Expected:** Exactly one succeeds (one row updated)
- **Layer:** Repository

## 4. Integration Tests

### IT-004-001: Unverified user can verify, then login
- **Scenario:** End-to-end verification flow
- **Test data:** Register -> get verification token -> verify -> attempt login
- **Expected:** Login succeeds after verification
- **Layer:** Integration

### IT-004-002: Re-registration resends verification
- **Scenario:** SRS FR-AUTH-004, "Unverified user re-registers"
- **Test data:** Unverified user re-registers with same email
- **Expected:** New verification token generated, old one invalidated
- **Layer:** Integration

## 5. Performance Tests

### PT-004-001: Verification P95 < 200ms
- **Scenario:** NFR-PERF-001
- **Test data:** k6, 100 VUs
- **Expected:** P95 < 200ms
- **Layer:** Performance

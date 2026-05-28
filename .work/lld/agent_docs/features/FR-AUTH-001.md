---
fr_id: FR-AUTH-001
title: User Registration with Email and Password
service: auth-service
route: POST /api/v1/auth/register
impl_spec: .work/impl-specs/FR-AUTH-001-impl.md
test_spec: .work/test-specs/FR-AUTH-001-test.md
status: lld-complete
---

# Work Package: FR-AUTH-001 - User Registration

## Routing
- **Service:** auth-service (port 8080)
- **Gateway route:** POST /api/v1/auth/register
- **OpenAPI contract:** api-auth.yaml, operationId: registerUser

## Design References
- **FR spec:** .work/srs/FR-AUTH-001--user-registration.md
- **HLD:** ADR-002 (API conventions), domain-service-mapping.yaml
- **LLD:** auth-service-tech-design.md (controllers, services, repositories, domain model)

## Key Implementation Decisions
- Registration is an ACID transaction: INSERT user + INSERT token + publish event
- Password hashing: argon2id with t=3, m=65536, p=4
- Email is sent asynchronously via event queue
- UNIQUE constraint on users.email handles duplicate prevention
- Idempotency key: stored for 24h, prevents duplicate registration

## Acceptance Checklist
- [ ] User can register with valid email/password
- [ ] Invalid inputs return VALIDATION_ERROR with field details
- [ ] Duplicate email returns DUPLICATE_EMAIL
- [ ] Verification email is sent asynchronously
- [ ] Concurrent registration for same email: only one succeeds
- [ ] Idempotency key prevents duplicate registrations

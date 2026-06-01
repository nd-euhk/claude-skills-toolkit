---
fr_id: FR-VAL-001
service: sanitizer-service
spec_type: test-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: TST Agent
depends_on:
  - ../../features/FR-VAL-001--email-format-validation.md
  - ../../tech-design/sanitizer-service.md
  - ../../../../tests/test_sanitizer.py
referenced_by:
  - ../../features/FR-VAL-001-impl.md
  - ../../traceability/requirements-matrix.md
changelog:
  - 1.0 | 2026-06-01 | Initial test spec for FR-VAL-001
---

# FR-VAL-001 Test Specification: Email Format Validation

## 1. Test Scope

This test specification covers all behavioral test cases for `validate_email()` per FR-VAL-001 (Email Format Validation). Each test verifies behavior described in the Gherkin scenario outlines from the FR spec.

**Test class**: `TestValidateEmail` in `tests/test_sanitizer.py`
**Function under test**: `validate_email(email: str | None) -> bool`
**Test framework**: pytest

## 2. Unit Tests -- Valid Inputs (FR-VAL-001)

### 2.1 Standard Email Format

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_valid` (existing) |
| **Gherkin row** | `user@domain.com` |
| **Given** | A user provides an email string `"user@domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user@domain.com"
# When the system validates the email format
result = validate_email("user@domain.com")
# Then the result shall be true
assert result is True
```

### 2.2 Email with Dot in Local Part

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_email_with_dot_in_local` (new) |
| **Gherkin row** | `user.name@domain.com` |
| **Given** | A user provides `"user.name@domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user.name@domain.com"
# When the system validates the email format
result = validate_email("user.name@domain.com")
# Then the result shall be true
assert result is True
```

### 2.3 Email with Plus Tag

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_email_with_plus_tag` (new) |
| **Gherkin row** | `user+tag@domain.com` |
| **Given** | A user provides `"user+tag@domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user+tag@domain.com"
# When the system validates the email format
result = validate_email("user+tag@domain.com")
# Then the result shall be true
assert result is True
```

### 2.4 Email with Subdomain

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_email_with_subdomain` (new) |
| **Gherkin row** | `user@sub.domain.com` |
| **Given** | A user provides `"user@sub.domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user@sub.domain.com"
# When the system validates the email format
result = validate_email("user@sub.domain.com")
# Then the result shall be true
assert result is True
```

### 2.5 Minimal Valid Email

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_valid` (existing -- includes `a@b.co`) |
| **Gherkin row** | `a@b.co` |
| **Given** | A user provides `"a@b.co"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

### 2.6 Multi-level TLD

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_multilevel_tld` (new) |
| **Gherkin row** | `user@domain.co.uk` |
| **Given** | A user provides `"user@domain.co.uk"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user@domain.co.uk"
# When the system validates the email format
result = validate_email("user@domain.co.uk")
# Then the result shall be true
assert result is True
```

### 2.7 Email with Dot and Plus in Local Part

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_accepts_dot_and_plus_in_local` (new) |
| **Gherkin row** | `user.name+tag@domain.org` |
| **Given** | A user provides `"user.name+tag@domain.org"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `True` |

```python
# Given a user provides an email string "user.name+tag@domain.org"
# When the system validates the email format
result = validate_email("user.name+tag@domain.org")
# Then the result shall be true
assert result is True
```

## 3. Unit Tests -- Invalid Inputs (FR-VAL-001)

### 3.1 Missing At Symbol

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_missing_at` (existing) |
| **Gherkin rows** | `userdomain.com`, `user` |
| **Given** | A user provides an email without `@` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.2 Empty Domain (user@)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_no_domain` (existing -- includes `user@`) |
| **Gherkin row** | `user@` |
| **Given** | A user provides `"user@"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.3 Empty Local Part (@domain.com)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_no_domain` (existing -- includes `@domain.com`) |
| **Gherkin row** | `@domain.com` |
| **Given** | A user provides `"@domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.4 No TLD (user@domain)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_no_tld` (new) |
| **Gherkin row** | `user@domain` |
| **Given** | A user provides `"user@domain"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

```python
# Given a user provides an email string "user@domain"
# When the system validates the email format
result = validate_email("user@domain")
# Then the result shall be false
assert result is False
```

### 3.5 Whitespace Before At

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_spaces` (existing -- includes `user @domain.com`) |
| **Gherkin row** | `user @domain.com` |
| **Given** | A user provides `"user @domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.6 Whitespace After At

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_spaces` (existing -- includes `user@do main.com`) |
| **Gherkin row** | `user@do main.com` |
| **Given** | A user provides `"user@do main.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.7 Leading Whitespace

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_spaces` (existing -- includes ` user@domain.com`) |
| **Gherkin row** | `  user@domain.com` |
| **Given** | A user provides `"  user@domain.com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

### 3.8 Double Dot in Domain

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_double_dot_in_domain` (new) |
| **Gherkin row** | `user.name@domain..com` |
| **Given** | A user provides `"user.name@domain..com"` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

```python
# Given a user provides an email string "user.name@domain..com"
# When the system validates the email format
result = validate_email("user.name@domain..com")
# Then the result shall be false
assert result is False
```

## 4. Integration Test Patterns

### 4.1 In-Process Function Integration

`validate_email` is a pure function with no external dependencies. "Integration" is solely in-process function call integration from the User Service.

| Integration Point | Caller | Pattern | Test Approach |
|-------------------|--------|---------|--------------|
| Registration Flow | `if not validate_email(email): return None` | Conditional guard | Unit test on User Service mock verifies validate_email is called |
| Login Flow | `if not validate_email(email): return None` | Conditional guard | Same pattern as Registration |
| Profile Update Flow | `if not validate_email(new_email): return False` | Conditional guard with return | Same pattern as above |

**Integration test specification** (for User Service test suite, NOT sanitizer-service):

```python
# illustrative -- belongs in User Service test suite
def test_registration_rejects_invalid_email():
    # Given an invalid email address
    # When registration is attempted
    # Then registration is rejected with appropriate message
    pass
```

No integration tests in the sanitizer-service test suite because `validate_email` has zero outbound integrations. The function is a leaf with no dependencies.

## 5. Test Fixtures and Mocks

### 5.1 Fixtures

**Minimal -- pure function needs no complex fixtures.**

```python
import pytest
from src.sanitizer import validate_email

@pytest.fixture
def valid_emails():
    """Fixture providing a list of valid email formats per FR-VAL-001 Gherkin examples."""
    return [
        "user@domain.com",
        "user.name@domain.com",
        "user+tag@domain.com",
        "user@sub.domain.com",
        "a@b.co",
        "user@domain.co.uk",
        "user.name+tag@domain.org",
    ]

@pytest.fixture
def invalid_emails():
    """Fixture providing a list of invalid email formats per FR-VAL-001 Gherkin examples."""
    return [
        "userdomain.com",
        "user",
        "user@",
        "@domain.com",
        "user@domain",
        "user @domain.com",
        "user@do main.com",
        "  user@domain.com",
        "user.name@domain..com",
    ]
```

### 5.2 Parametrized Test Pattern

```python
@pytest.mark.parametrize("email", [
    "user@domain.com",
    "user.name@domain.com",
    "user+tag@domain.com",
    "user@sub.domain.com",
    "a@b.co",
    "user@domain.co.uk",
    "user.name+tag@domain.org",
])
def test_accepts_all_valid_formats(email):
    # Given a valid email address
    # When the system validates the email format
    result = validate_email(email)
    # Then the result shall be true
    assert result is True


@pytest.mark.parametrize("email", [
    "userdomain.com",
    "user",
    "user@",
    "@domain.com",
    "user@domain",
    "user @domain.com",
    "user@do main.com",
    "  user@domain.com",
    "user.name@domain..com",
])
def test_rejects_all_invalid_formats(email):
    # Given an invalid email address
    # When the system validates the email format
    result = validate_email(email)
    # Then the result shall be false
    assert result is False
```

### 5.3 Mocks

**No mocks needed.** The function is a pure computation with no external dependencies. There are no databases to mock, no network calls to stub, no filesystem to patch. The only "dependency" is `re.match()`, which is a Python standard library function and should never be mocked (Hard Boundary #23: tests verify behavior, not implementation details).

## 6. Gherkin Scenario Mapping

### Full Gherkin-to-Test Traceability

| Gherkin Row (email) | Expected | Test Method | Status |
|---------------------|----------|-------------|--------|
| `user@domain.com` | `true` | `test_accepts_valid` | Existing |
| `user.name@domain.com` | `true` | `test_accepts_email_with_dot_in_local` | New |
| `user+tag@domain.com` | `true` | `test_accepts_email_with_plus_tag` | New |
| `user@sub.domain.com` | `true` | `test_accepts_email_with_subdomain` | New |
| `a@b.co` | `true` | `test_accepts_valid` | Existing |
| `user@domain.co.uk` | `true` | `test_accepts_multilevel_tld` | New |
| `user.name+tag@domain.org` | `true` | `test_accepts_dot_and_plus_in_local` | New |
| `userdomain.com` | `false` | `test_rejects_missing_at` | Existing |
| `user` | `false` | `test_rejects_missing_at` | Existing |
| `user@` | `false` | `test_rejects_no_domain` | Existing |
| `@domain.com` | `false` | `test_rejects_no_domain` | Existing |
| `user@domain` | `false` | `test_rejects_no_tld` | New |
| `user @domain.com` | `false` | `test_rejects_spaces` | Existing |
| `user@do main.com` | `false` | `test_rejects_spaces` | Existing |
| `  user@domain.com` | `false` | `test_rejects_spaces` | Existing |
| `user.name@domain..com` | `false` | `test_rejects_double_dot_in_domain` | New |

**Coverage**: 16/16 Gherkin rows mapped (100%).

## 7. NFR Verification Tests

| NFR | Test Approach |
|-----|--------------|
| NFR-PERF-001 (<1ms P95) | Benchmark test with 7 valid emails, measure P95 execution time |
| NFR-REL-001 (no exceptions) | Exhaustive test: all valid + invalid emails from Gherkin table, assert no exception |
| NFR-REL-002 (deterministic) | Repeated invocation test: same input called 100x, assert all results identical |
| NFR-SEC-001 (no resource exhaustion) | Pathological input test: 10KB string, assert completes in <10ms |
| NFR-SEC-002 (no exception bypass) | Fuzzing test: 1000 randomized byte sequences, assert no exception |

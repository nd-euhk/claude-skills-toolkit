---
fr_id: FR-VAL-002
service: sanitizer-service
spec_type: test-spec
status: draft
created: 2026-06-01
last_updated: 2026-06-01
updated_by: TST Agent
depends_on:
  - ../../features/FR-VAL-002--null-empty-input-handling.md
  - ../../tech-design/sanitizer-service.md
  - ../../../../tests/test_sanitizer.py
referenced_by:
  - ../../features/FR-VAL-002-impl.md
  - ../../traceability/requirements-matrix.md
changelog:
  - 1.0 | 2026-06-01 | Initial test spec for FR-VAL-002
---

# FR-VAL-002 Test Specification: Null and Empty Input Handling

## 1. Test Scope

This test specification covers behavioral tests for `validate_email()` per FR-VAL-002 (Null and Empty Input Handling). Each test verifies behavior described in the Gherkin scenario outlines from the FR spec.

**Function under test**: `validate_email(email: str | None) -> bool`
**Test framework**: pytest

## 2. Unit Tests -- Null Input (FR-VAL-002)

### 2.1 Null Input Returns False

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_none` (existing in `TestValidateEmail`) |
| **Gherkin row** | A null value |
| **Given** | A user provides a null value |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |
| **And** | No exception shall be raised |

```python
def test_rejects_none():
    # Given a user provides a null value
    # When the system validates the email format
    result = validate_email(None)
    # Then the result shall be false
    assert result is False
    # And no exception shall be raised
```

**Pass criteria**:
1. `result` is strictly `False` (not falsy, not `None` -- `assert result is False`)
2. No exception propagates from `validate_email(None)`

### 2.2 Null Input is Deterministic

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_none_is_deterministic` (new) |
| **Given** | A user provides a null value |
| **When** | The system validates the email format multiple times |
| **Then** | Every invocation shall return `False` |

```python
def test_none_is_deterministic():
    # Given a user provides a null value
    # When the system validates the email format repeatedly
    results = [validate_email(None) for _ in range(100)]
    # Then every invocation shall return false
    assert all(r is False for r in results)
```

**Rationale**: Verifies NFR-REL-002 (deterministic output) for the null input path. The guard clause is pure and must produce identical output every time.

## 3. Unit Tests -- Empty String Input (FR-VAL-002)

### 3.1 Empty String Returns False

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_empty` (existing in `TestValidateEmail`) |
| **Gherkin row** | An empty string |
| **Given** | A user provides an empty string |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |
| **And** | No exception shall be raised |

```python
def test_rejects_empty():
    # Given a user provides an empty string
    # When the system validates the email format
    result = validate_email("")
    # Then the result shall be false
    assert result is False
    # And no exception shall be raised
```

**Pass criteria**:
1. `result` is strictly `False`
2. No exception propagates from `validate_email("")`

### 3.2 Empty String is Deterministic

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_empty_string_is_deterministic` (new) |
| **Given** | A user provides an empty string |
| **When** | The system validates the email format multiple times |
| **Then** | Every invocation shall return `False` |

```python
def test_empty_string_is_deterministic():
    # Given a user provides an empty string
    # When the system validates the email format repeatedly
    results = [validate_email("") for _ in range(100)]
    # Then every invocation shall return false
    assert all(r is False for r in results)
```

### 3.3 Whitespace-Only String (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test method** | `test_rejects_whitespace_only` (new) |
| **Given** | A user provides a whitespace-only string `"   "` |
| **When** | The system validates the email format |
| **Then** | The result shall be `False` |

```python
def test_rejects_whitespace_only():
    # Given a user provides a whitespace-only string
    # When the system validates the email format
    result = validate_email("   ")
    # Then the result shall be false (whitespace rejected by regex)
    assert result is False
```

**Note**: This is an edge case that straddles FR-VAL-001 and FR-VAL-002. Whitespace-only strings are truthy in Python (non-empty), so they bypass the guard clause. The regex `[^\s@]+` requires at least one non-whitespace character, so the regex rejects them. The output is still `False`, consistent with the contract. Including this test ensures the whitespace rejection behavior is explicit and tested.

## 4. Integration Test Patterns

### 4.1 In-Process Function Integration

Same as FR-VAL-001 test spec -- `validate_email` has zero outbound integrations. No integration tests in the sanitizer-service test suite.

The integration test belongs in the User Service test suite, verifying that registration/login/profile flows handle `False` from `validate_email` appropriately when the input is `None` or `""`.

**Example** (User Service, NOT sanitizer-service):

```python
def test_registration_handles_null_email():
    # Given a null email value passed to registration
    # When validate_email is called by the registration flow
    # Then registration returns an appropriate user-facing message
    pass
```

### 4.2 Cross-Feature Integration with validate_email

FR-VAL-002's guard clause is the execution gate for FR-VAL-001's regex. The integration point is:

```python
if not email:      # FR-VAL-002
    return False
# ... regex      # FR-VAL-001 (only reached for truthy strings)
```

**Test implication**: All tests for FR-VAL-001 valid emails implicitly verify FR-VAL-002 pass-through (the guard lets truthy strings through). No separate integration test needed.

## 5. Test Fixtures and Mocks

### 5.1 Fixtures

**Minimal.** The null/empty test cases require only two inputs:

```python
import pytest
from src.sanitizer import validate_email

@pytest.fixture
def absent_inputs():
    """Fixture providing null/empty inputs per FR-VAL-002."""
    return [None, ""]

@pytest.fixture(params=[None, ""])
def absent_input(request):
    """Parametrized fixture for null and empty string."""
    return request.param
```

### 5.2 Parametrized Test

```python
@pytest.mark.parametrize("email", [None, ""])
def test_handles_absent_input(email):
    # Given an absent email input (null or empty)
    # When the system validates the email format
    result = validate_email(email)
    # Then the result shall be false
    assert result is False
    # And no exception shall be raised
```

### 5.3 Mocks

**No mocks needed.** The null/empty handling is a pure boolean check (`if not email`) with no external dependencies. No filesystem, database, network, or library calls occur in this code path.

## 6. Gherkin Scenario Mapping

### Full Gherkin-to-Test Traceability

| Gherkin Row (input_desc) | Expected | Exception Expected | Test Method | Status |
|--------------------------|----------|--------------------|-------------|--------|
| A null value | `false` | No | `test_rejects_none` | Existing |
| An empty string | `false` | No | `test_rejects_empty` | Existing |

### Extended Edge Case Mapping

| Edge Case | Expected | Test Method | Status |
|-----------|----------|-------------|--------|
| `"   "` (whitespace only) | `false` | `test_rejects_whitespace_only` | New |
| `None` called 100x | Always `False` | `test_none_is_deterministic` | New |
| `""` called 100x | Always `False` | `test_empty_string_is_deterministic` | New |

**Coverage**: 2/2 Gherkin rows mapped (100%). 3 additional edge cases added.

## 7. NFR Verification Tests

| NFR | Test Approach | Input |
|-----|--------------|-------|
| NFR-PERF-003 (<0.5ms P95 for null) | Micro-benchmark: `timeit` 10000 calls with `None` | `None` |
| NFR-PERF-003 (<0.5ms P95 for empty) | Micro-benchmark: `timeit` 10000 calls with `""` | `""` |
| NFR-REL-001 (no exception for None) | Direct call: `validate_email(None)` | `None` |
| NFR-REL-001 (no exception for empty) | Direct call: `validate_email("")` | `""` |
| NFR-REL-002 (deterministic output) | 100 repeated calls, assert all same result | `None`, `""` |

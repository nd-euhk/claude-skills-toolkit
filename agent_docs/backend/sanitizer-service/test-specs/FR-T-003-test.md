# Test Spec: FR-T-003 Input Sanitizer

## Module: sanitizer.py (projects/sanitizer-service/src/sanitizer.py)
## Test file: projects/sanitizer-service/tests/test_sanitizer.py
## Framework: pytest

## Test Cases

### sanitizeInput()
- [CRITICAL] Trims whitespace from both ends of string
- [CRITICAL] Escapes HTML special characters (< > & " ')
- [HIGH] Normalizes unicode to NFC form
- [HIGH] Strips null bytes and control characters (0x00-0x1F except \t, \n, \r)
- [MEDIUM] Returns empty string for empty input
- [MEDIUM] Returns empty string for null/undefined input
- [MEDIUM] Handles strings with only whitespace

### validateEmail()
- [CRITICAL] Returns true for valid email (user@domain.com)
- [CRITICAL] Returns false for invalid email (missing @)
- [HIGH] Returns false for email with no domain
- [MEDIUM] Returns false for email with spaces
- [MEDIUM] Returns false for empty string
- [MEDIUM] Returns false for null/undefined

## Hard boundaries
- No database access
- No network calls
- Pure functions only (no side effects)

# sanitizer-service Tech Design

## Service: sanitizer-service
## Type: Standalone utility library
## Language: Python 3
## Test Framework: pytest

## Domain Model
- `sanitize_input(input_val) -> str`: Pure function, no side effects
- `validate_email(email) -> bool`: Pure function, no side effects

## Hard Boundaries
- No database access
- No network calls
- No file system access
- Pure computation only

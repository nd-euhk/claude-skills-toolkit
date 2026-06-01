# Implementation Spec: FR-T-003 Input Sanitizer

## Module: sanitizer.py
## Location: projects/sanitizer-service/src/sanitizer.py
## Language: Python 3

## Functions

### sanitize_input(input_val)
- Signature: `def sanitize_input(input_val: str|None) -> str`
- Returns trimmed, HTML-escaped, unicode-normalized string with null bytes stripped
- Returns '' for None/empty inputs

### validate_email(email)
- Signature: `def validate_email(email: str|None) -> bool`
- Returns True if email matches valid email pattern
- Returns False for invalid/None/empty inputs
- Uses regex: r'^[^\s@]+@[^\s@]+\.[^\s@]+$'

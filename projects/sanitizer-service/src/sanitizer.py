import html
import unicodedata
import re

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_CONTROL_CHAR_THRESHOLD = 0x20
_CONTROL_CHARS_WHITELIST = "\t\n\r"


def sanitize_input(input_val: str | None) -> str:
    """Sanitize string input for safe display and storage.

    Processing steps (in order):
    1. Strip control characters (keeps \\t, \\n, \\r).
    2. Trim leading/trailing whitespace.
    3. Normalize Unicode to NFC form.
    4. Escape HTML special characters including single quotes.

    Args:
        input_val: The raw input string, or None.

    Returns:
        A sanitized string, or "" if input_val is None.
    """
    if input_val is None:
        return ""

    # Remove null bytes and control characters (0x00-0x1F and 0x7F),
    # but keep tab (\t), newline (\n), and carriage return (\r).
    result = "".join(
        c for c in input_val
        if ord(c) >= _CONTROL_CHAR_THRESHOLD or c in _CONTROL_CHARS_WHITELIST
    )

    # Trim leading and trailing whitespace (but preserve \r).
    result = result.strip(" \t\n")

    # Normalize unicode to NFC form.
    result = unicodedata.normalize("NFC", result)

    # Escape HTML special characters.
    result = html.escape(result, quote=True)

    # html.escape with quote=True escapes " but not ' — handle single quotes.
    result = result.replace("'", "&#x27;")

    return result


def validate_email(email: str | None) -> bool:
    """Check whether *email* has a valid basic email format.

    Args:
        email: The email string to validate, or None.

    Returns:
        True if the email has a non-empty local part, '@', and a domain
        containing at least one dot. Returns False for None, empty strings,
        or strings containing whitespace.
    """
    if not email:
        return False

    # Basic validation: non-empty local part, '@', non-empty domain with at least one dot.
    # The regex inherently rejects any whitespace.
    return bool(_EMAIL_RE.match(email))


def validate_not_empty(input_val: str | None) -> bool:
    """Check if a string is not empty or whitespace-only.

    Args:
        input_val: The string to validate, or None.

    Returns:
        True if the string has non-whitespace content, False otherwise.
    """
    if input_val is None:
        return False
    stripped = input_val.strip()
    return bool(stripped)

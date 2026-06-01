"""Tests for sanitizer.py — T-003 Input Sanitizer (TDD RED phase).

These tests describe the REQUIRED behavior of sanitize_input() and validate_email().
The stub implementations do NO actual sanitization/validation, so all tests
below MUST fail. This is the expected RED phase of TDD.
"""

import pytest
from src.sanitizer import sanitize_input, validate_email


# ---------------------------------------------------------------------------
# sanitize_input
# ---------------------------------------------------------------------------

class TestSanitizeInput:
    """sanitize_input should clean and normalize user-provided strings."""

    def test_trims_whitespace(self):
        """Leading and trailing whitespace must be stripped."""
        assert sanitize_input("  hello  ") == "hello"
        assert sanitize_input("\t  world \n") == "world"

    def test_escapes_html(self):
        """HTML special characters < > & \" ' must be escaped."""
        assert sanitize_input("<script>") == "&lt;script&gt;"
        assert sanitize_input("a & b") == "a &amp; b"
        assert sanitize_input('"hello"') == "&quot;hello&quot;"
        assert sanitize_input("it's") == "it&#x27;s"

    def test_normalizes_unicode(self):
        """Unicode must be normalized to NFC form.

        The input uses NFD (decomposed) form for 'e' with acute accent
        (U+0065 U+0301). NFC normalization should produce the composed
        form (U+00E9).
        """
        nfd_input = "café"       # 'cafe' + combining acute accent (NFD)
        nfc_expected = "café"     # 'cafe' with precomposed e-acute (NFC)
        result = sanitize_input(nfd_input)
        assert result == nfc_expected

    def test_strips_null_bytes_and_control_chars(self):
        """Null bytes (\\x00) and control characters (0x00-0x1F, except
        \\t, \\n, \\r) must be removed.
        """
        assert sanitize_input("hel\x00lo") == "hello"
        assert sanitize_input("a\x01b\x1Fc") == "abc"
        # Tab, newline, carriage return are kept
        assert sanitize_input("a\tb\nc\r") == "a\tb\nc\r"

    def test_handles_empty_string(self):
        """Empty string input must return an empty string."""
        assert sanitize_input("") == ""

    def test_handles_none(self):
        """None input must return an empty string."""
        assert sanitize_input(None) == ""

    def test_handles_whitespace_only(self):
        """A string containing only whitespace characters must return
        an empty string after trimming.
        """
        assert sanitize_input("   ") == ""
        assert sanitize_input("\t \n") == ""


# ---------------------------------------------------------------------------
# validate_email
# ---------------------------------------------------------------------------

class TestValidateEmail:
    """validate_email should accept valid emails and reject invalid ones."""

    def test_accepts_valid(self):
        """Valid email addresses must be accepted."""
        assert validate_email("user@domain.com") is True
        assert validate_email("a@b.co") is True
        assert validate_email("user+tag@sub.domain.com") is True

    def test_rejects_missing_at(self):
        """Email without '@' must be rejected."""
        assert validate_email("userdomain.com") is False
        assert validate_email("user") is False

    def test_rejects_no_domain(self):
        """Email with '@' but no domain part must be rejected."""
        assert validate_email("user@") is False
        assert validate_email("@domain.com") is False

    def test_rejects_spaces(self):
        """Email containing spaces must be rejected."""
        assert validate_email("user @domain.com") is False
        assert validate_email(" user@domain.com") is False
        assert validate_email("user@do main.com") is False

    def test_rejects_empty(self):
        """Empty string must be rejected."""
        assert validate_email("") is False

    def test_rejects_none(self):
        """None must be rejected."""
        assert validate_email(None) is False

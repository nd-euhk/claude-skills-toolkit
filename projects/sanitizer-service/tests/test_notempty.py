"""Tests for validate_not_empty() — T-006 RED phase.

These tests describe the REQUIRED behavior of validate_not_empty().
The function does not exist yet, so all tests below MUST fail.
This is the expected RED phase of TDD.
"""

import pytest
from src.sanitizer import validate_not_empty


# ---------------------------------------------------------------------------
# validate_not_empty
# ---------------------------------------------------------------------------

class TestValidateNotEmpty:
    """validate_not_empty should correctly detect non-empty strings."""

    def test_non_empty_string_returns_true(self):
        """A non-empty, non-whitespace string must return True."""
        assert validate_not_empty("hello") is True
        assert validate_not_empty("a") is True
        assert validate_not_empty("  hello world  ") is True

    def test_empty_string_returns_false(self):
        """Empty string must return False."""
        assert validate_not_empty("") is False

    def test_whitespace_only_returns_false(self):
        """Whitespace-only strings must return False."""
        assert validate_not_empty("   ") is False
        assert validate_not_empty("\t \n") is False
        assert validate_not_empty("\r\n\t") is False

    def test_none_returns_false(self):
        """None must return False."""
        assert validate_not_empty(None) is False

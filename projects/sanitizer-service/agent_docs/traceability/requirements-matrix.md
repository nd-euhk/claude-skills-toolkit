# Requirements Traceability Matrix

**Project:** Email Validation Utility (sanitizer-service)
**SRS Version:** 1.0.0
**Date:** 2026-06-01
**Mode:** Reverse-Engineered from Source Code

---

## Traceability Map

Each functional requirement traces to its source code location, test coverage, and applicable non-functional requirements.

| FR ID | Description | Source File | Source Lines | Test Class/Method | Gherkin Scenarios | NFRs Affected |
|-------|-------------|-------------|--------------|--------------------|-------------------|---------------|
| FR-VAL-001 | Email Format Validation | `src/sanitizer.py` | 50-66 | `TestValidateEmail`: `test_accepts_valid`, `test_rejects_missing_at`, `test_rejects_no_domain`, `test_rejects_spaces` | Validate email address format (13 examples) | NFR-PERF-001, NFR-PERF-002, NFR-REL-001, NFR-REL-002, NFR-SEC-001, NFR-SEC-002, NFR-MNT-001, NFR-MNT-002, NFR-USE-001 |
| FR-VAL-002 | Null and Empty Input Handling | `src/sanitizer.py` | 61-62 | `TestValidateEmail`: `test_rejects_empty`, `test_rejects_none` | Handle absent email input (2 examples) | NFR-PERF-003, NFR-REL-001, NFR-REL-002, NFR-SEC-001, NFR-MNT-001, NFR-USE-001 |

---

## Full Traceability Expansion

### FR-VAL-001: Email Format Validation

| Source Artifact | Detail |
|-----------------|--------|
| **Source Code** | `src/sanitizer.py`, function `validate_email`, lines 50-66 |
| **Core Logic** | Regex match: `^[^\s@]+@[^\s@]+\.[^\s@]+$` at line 66 |
| **Test: Accepts Valid** | `test_accepts_valid` (line 75): `user@domain.com`, `a@b.co`, `user+tag@sub.domain.com` |
| **Test: Rejects Missing @** | `test_rejects_missing_at` (line 81): `userdomain.com`, `user` |
| **Test: Rejects No Domain** | `test_rejects_no_domain` (line 86): `user@`, `@domain.com` |
| **Test: Rejects Spaces** | `test_rejects_spaces` (line 91): `user @domain.com`, ` user@domain.com`, `user@do main.com` |
| **Gherkin Examples** | 13 data rows: 6 valid (happy path), 7 invalid (error cases including missing @, missing domain, whitespace) |
| **NFRs** | NFR-PERF-001 (<1ms P95), NFR-PERF-002 (<5ms P99), NFR-REL-001 (0 exceptions), NFR-REL-002 (deterministic), NFR-SEC-001 (memory control), NFR-SEC-002 (no bypass), NFR-MNT-001 (reusable), NFR-MNT-002 (testable), NFR-USE-001 (boolean output) |

### FR-VAL-002: Null and Empty Input Handling

| Source Artifact | Detail |
|-----------------|--------|
| **Source Code** | `src/sanitizer.py`, function `validate_email`, lines 61-62 |
| **Core Logic** | Falsy check: `if not email: return False` at line 61 |
| **Test: Rejects Empty** | `test_rejects_empty` (line 98): `validate_email("") is False` |
| **Test: Rejects None** | `test_rejects_none` (line 102): `validate_email(None) is False` |
| **Gherkin Examples** | 2 data rows: null value, empty string |
| **NFRs** | NFR-PERF-003 (<0.5ms P95), NFR-REL-001 (0 exceptions), NFR-REL-002 (deterministic), NFR-SEC-001 (no resource consumption on null/empty), NFR-MNT-001 (consistent interface), NFR-USE-001 (boolean output) |

---

## Coverage Summary

| Metric | Count |
|--------|-------|
| Total FRs | 2 |
| FRs with source code trace | 2 (100%) |
| FRs with test coverage | 2 (100%) |
| FRs with Gherkin scenarios | 2 (100%) |
| Total Gherkin example rows | 15 |
| Happy path examples | 6 |
| Error/edge case examples | 9 |
| NFRs defined | 8 |
| NFRs with quantified thresholds | 8 (100%) |

---

## Gap Analysis

| Check | Status |
|-------|--------|
| Every FR has >=1 Gherkin Scenario Outline with Examples | PASS |
| Every FR traces to source code | PASS |
| Every FR traces to test coverage | PASS |
| Every FR traces to NFRs | PASS |
| All NFRs have quantified, measurable thresholds | PASS |
| No architecture decisions in SRS (no "service", "API path", "database schema") | VERIFIED |
| No implementation technology names in SRS | VERIFIED |

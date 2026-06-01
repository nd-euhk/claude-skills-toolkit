# Orchestrator Response Plan: Cook Workflow

**Task:** "Add input validation to user registration form"
**Workflow:** Cook (keyword detected: "Cook this task")
**Date:** 2026-06-01

---

## Phase 1: Pick Task

### Input Parsing and Routing

1. **Keyword detection:** The user's message contains the explicit keyword "Cook" ("Cook this task"), which triggers the Cook workflow variant of the orchestrator skill. No other workflow keywords (feature, cr, change request) are present.

2. **Task identification:** The user explicitly states the task name and status: "I have a task that's Ready for implementation: 'Add input validation to user registration form'." Because the task is named and its status is declared as "Ready," I do NOT need to invoke Skill(sprint) to browse the board and pick a task. The task is already selected.

3. **Board sync (quick check):** Although the task is given explicitly, I would still invoke Skill(sprint) briefly to verify that this task exists on the board with status "Ready" and to log the in-progress transition. If the task is not found on the board, I would ask the user for clarification before proceeding.

---

## Phase 2: Plan (Impact Assessment)

### BE Impact Assessment: YES

Input validation on a registration form has mandatory backend impact for the following reasons:

- **Security:** Client-side validation is a UX convenience only. All input must be re-validated on the server to prevent malicious data injection, SQL injection, XSS, and other attack vectors. This is a non-negotiable security requirement.
- **API endpoint changes:** The registration endpoint (e.g., `POST /api/register` or `POST /api/users`) must validate fields such as email format, password strength, username constraints (length, allowed characters, uniqueness), and required field presence. Validation error responses must be standardized.
- **Database constraints:** Backend validation interacts with database-level constraints (unique email, unique username). The backend must catch and handle constraint violations gracefully (e.g., returning a 409 Conflict with a user-friendly message rather than a 500 Internal Server Error).
- **Business logic validation:** Rules like "password must not contain username" or "age must be >= 13" require server-side enforcement.

### FE Impact Assessment: YES

Input validation on a registration form has mandatory frontend impact for the following reasons:

- **User experience:** The registration form UI must provide real-time or on-submit validation feedback. This includes highlighting invalid fields, displaying inline error messages, disabling the submit button until the form is valid, and clearing errors when the user corrects input.
- **Field-level validation logic:** Each input field needs validation rules: email format regex, password strength indicator, password confirmation match, required field checks, minimum/maximum length for username.
- **Form state management:** The form component must track validation state per field (touched, dirty, valid, invalid), aggregate form-level validity, and handle submission lifecycle (submitting, success, error states).
- **Accessibility:** Error messages must be associated with inputs via `aria-describedby`, error states must be communicated to screen readers, and focus management must move to the first invalid field on failed submission.

### Combined Assessment: BOTH BE and FE impacted

Since both layers have independent and essential validation concerns, both pipelines must run in **parallel**.

---

## Phase 3: Execute TDD Pipeline

### Pipeline Architecture

Because both BE and FE are impacted, the orchestrator spawns two independent TDD pipelines that run **in parallel**:

```
                    ┌─────────────────────────────┐
                    │     Orchestrator (Cook)      │
                    │  Task: Add input validation  │
                    │  to user registration form   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
     (PARALLEL SPAWN)                  (PARALLEL SPAWN)
              │                                 │
    ┌─────────▼─────────┐          ┌───────────▼───────────┐
    │   BE Pipeline     │          │     FE Pipeline       │
    │  (Agent spawns)   │          │   (Agent spawns)      │
    └───────────────────┘          └───────────────────────┘
```

### BE Pipeline Sequence

Each agent is spawned sequentially within the BE pipeline. Gate rejections cause re-spawns of the preceding phase.

#### Step 1: `tdd-be-red`
- **Agent spawned:** Agent(`tdd-be-red`)
- **Input:** Task description, routes/controllers/models related to user registration, any existing test patterns.
- **Expected output:** Failing test(s) covering backend validation rules:
  - Test: `POST /register` with missing required fields returns 400
  - Test: `POST /register` with invalid email format returns 400
  - Test: `POST /register` with password shorter than minimum length returns 400
  - Test: `POST /register` with duplicate email returns 409
  - Test: `POST /register` with duplicate username returns 409
  - Test: `POST /register` with XSS payload in username returns 400 (sanitized)
- **Exit condition:** Tests exist and are RED (failing). If tests are green before any implementation, the agent must iterate until they are properly red (testing the absence of validation).

#### Step 2: `tdd-be-green`
- **Agent spawned:** Agent(`tdd-be-green`)
- **Input:** The red test suite from Step 1, plus the current registration handler/controller code.
- **Expected output:** Minimal implementation that makes all red tests pass:
  - Input validation middleware or validation logic in the registration controller
  - Request body schema validation (e.g., using Joi, Zod, or Yup)
  - Email format validation
  - Password strength enforcement
  - Duplicate detection (email/username) with appropriate error responses
  - Input sanitization
- **Exit condition:** ALL tests are GREEN. Agent must not add any behavior beyond what the tests verify.

#### Step 3 Gate: `tdd-be-gate --mode=light`
- **Agent spawned:** Agent(`tdd-be-gate`, mode=`light`)
- **Purpose:** Catch implementation issues. The light gate reviews the implementation produced in Step 2 against test coverage and correctness.
- **Checks performed:**
  - Do all tests pass? (re-run to confirm)
  - Is test coverage adequate? (are edge cases covered?)
  - Is the implementation minimal? (no over-engineering)
  - Are there any implementation bugs visible in the green code?
  - Does validation logic have gaps? (e.g., forgot to validate a field that is in the spec)
- **Rejection handling:**
  - If light gate **fails**: re-spawn `tdd-be-green` with the gate's feedback. The re-spawned green agent must address the gate's concerns while keeping tests green.
  - **3-strike limit**: If the BE pipeline requires more than 3 re-spawns of the green agent, the orchestrator halts the BE pipeline and reports failure with the accumulated feedback for manual intervention.
  - Example rejection: "Password validation allows 'password' as a valid password — add a common-password deny-list test, re-spawn green."
- **On pass:** Proceed to Step 4.

#### Step 4: `tdd-be-refactor`
- **Agent spawned:** Agent(`tdd-be-refactor`)
- **Input:** The green implementation, the test suite, and any code quality standards for the project.
- **Expected output:** Refactored code that keeps all tests green while improving:
  - Extract validation logic into a dedicated validation middleware or service class
  - Consolidate duplicate validation patterns
  - Improve error message consistency and internationalization readiness
  - Add proper TypeScript types/interfaces for validation schemas
  - Ensure validation logic is reusable (e.g., shared between create and update endpoints)
- **Exit condition:** All tests are STILL GREEN after refactoring. No behavioral changes.

#### Step 5 Gate: `tdd-be-gate --mode=full`
- **Agent spawned:** Agent(`tdd-be-gate`, mode=`full`)
- **Purpose:** Catch refactoring deficiencies. The full gate reviews the entire BE pipeline output comprehensively.
- **Checks performed:**
  - All tests still pass after refactoring
  - Code quality: Is the refactored code clean, DRY, well-structured?
  - Test quality: Are the tests themselves well-written, maintainable, and not brittle?
  - Security review: Are there validation bypass risks? Is input sanitization adequate?
  - Performance: Does validation add unnecessary overhead?
  - Integration: Do validation error responses match the API contract the FE expects?
- **Rejection handling:**
  - If full gate **fails**: re-spawn `tdd-be-refactor` with the gate's feedback.
  - **3-strike limit**: If more than 3 re-spawns of the refactor agent are needed, halt the BE pipeline.
  - Example rejection: "Refactored validation middleware is not stateless — it caches results from a previous request, creating a subtle bug. Re-spawn refactor."
- **On pass:** BE pipeline is complete. Proceed to Summary.

### FE Pipeline Sequence

Runs in parallel with the BE pipeline. Same gate/re-spawn logic.

#### Step 1: `tdd-fe-red`
- **Agent spawned:** Agent(`tdd-fe-red`)
- **Input:** Task description, the registration form component code, UI framework in use (React/Vue/Angular/etc.), testing framework in use (Jest + Testing Library / Vitest / Cypress component tests).
- **Expected output:** Failing test(s) covering frontend validation behavior:
  - Test: Empty form submission shows validation errors on all required fields
  - Test: Invalid email format shows email-specific error
  - Test: Password mismatch shows confirmation error
  - Test: Password too short shows length requirement error
  - Test: Username with special characters shows format error
  - Test: Valid form enables submit button (no errors shown)
  - Test: Error clears when user corrects field
  - Test: Focus moves to first invalid field on failed submit
  - Test (accessibility): Error messages have `aria-describedby` linking to inputs
- **Exit condition:** Tests exist and are RED (failing).

#### Step 2: `tdd-fe-green`
- **Agent spawned:** Agent(`tdd-fe-green`)
- **Input:** Red test suite from Step 1, registration form component.
- **Expected output:** Minimal implementation making all FE validation tests pass:
  - Per-field validation functions (email, password, username, required)
  - Inline error message rendering
  - Form submission prevention when invalid
  - Error clearing on field change
  - Focus management to first error
  - ARIA attributes for accessibility
- **Exit condition:** ALL tests are GREEN.

#### Step 3 Gate: `tdd-fe-gate --mode=light`
- **Agent spawned:** Agent(`tdd-fe-gate`, mode=`light`)
- **Purpose:** Catch implementation issues in the FE green phase.
- **Checks performed:**
  - All tests pass
  - Is validation debounced/throttled appropriately (no flickering on every keystroke)?
  - Are error states visually distinct and accessible?
  - Is the submit button disabled state correct?
  - Are there console errors during test runs?
- **Rejection handling:**
  - If light gate **fails**: re-spawn `tdd-fe-green`.
  - **3-strike limit**: Halt FE pipeline after 3 re-spawns.
  - Example rejection: "Email validation fires on every keystroke, causing error flicker. Add debounce before re-spawn green."
- **On pass:** Proceed to Step 4.

#### Step 4: `tdd-fe-refactor`
- **Agent spawned:** Agent(`tdd-fe-refactor`)
- **Input:** Green implementation, test suite, component structure.
- **Expected output:** Refactored FE code keeping all tests green:
  - Extract validation rules into a shared validation config (same rules as BE schema)
  - Create reusable `useFormValidation` hook or composable
  - Extract `ValidationMessage` component for consistent error display
  - Consolidate duplicate validation patterns across fields
  - Optimize re-renders (memoize validation functions)
- **Exit condition:** All tests STILL GREEN.

#### Step 5 Gate: `tdd-fe-gate --mode=full`
- **Agent spawned:** Agent(`tdd-fe-gate`, mode=`full`)
- **Purpose:** Catch refactoring deficiencies in the FE pipeline.
- **Checks performed:**
  - All tests still pass
  - Code quality: DRY, well-structured, idiomatic for the framework
  - Test quality: Tests not brittle, use realistic user interactions
  - Accessibility audit: Screen reader experience, keyboard navigation, focus management
  - Performance: No unnecessary re-renders, validation not blocking UI thread
  - Visual regression: Error states look correct across viewport sizes
- **Rejection handling:**
  - If full gate **fails**: re-spawn `tdd-fe-refactor`.
  - **3-strike limit**.
  - Example rejection: "Refactored `useFormValidation` hook causes full form re-render on every field change. Memoize per-field validators before re-spawn refactor."
- **On pass:** FE pipeline is complete.

---

## Gate Mode Routing Summary

| Gate | Mode | Catches | Re-spawn Target | Max Re-spawns |
|------|------|---------|-----------------|---------------|
| `tdd-be-gate` | light | Implementation bugs, coverage gaps | `tdd-be-green` | 3 |
| `tdd-be-gate` | full | Refactoring deficiencies, security, integration | `tdd-be-refactor` | 3 |
| `tdd-fe-gate` | light | Implementation issues, UX bugs | `tdd-fe-green` | 3 |
| `tdd-fe-gate` | full | Refactoring quality, a11y, performance | `tdd-fe-refactor` | 3 |

---

## Phase 4: Summary and Next Steps

After both pipelines complete (all gates pass), the orchestrator:

1. **Aggregates results:** Collects the outputs from both BE and FE pipelines, including any re-spawn counts and gate results.
2. **Reports completion:** Produces a summary of what was built:
   - BE: Validation middleware/service with tests covering all input fields, error responses standardized.
   - FE: Form validation with inline errors, accessibility support, debounced validation.
3. **Highlights important notes:** Warnings about BE/FE validation rule alignment (BE and FE must agree on validation schemas to prevent false negatives where FE says valid but BE rejects).
4. **Invokes AskUserQuestion:** "Task 'Add input validation to user registration form' is complete. What would you like to do next?"
   - Option 1: Cook another Ready task
   - Option 2: Review the implemented changes
   - Option 3: Commit and push the changes
   - Option 4: Done for now

---

## Estimated Agent Spawns (Best Case, No Gate Rejections)

| Order | Agent | Pipeline |
|-------|-------|----------|
| 1 (parallel with 6) | `tdd-be-red` | BE |
| 2 (parallel with 7) | `tdd-be-green` | BE |
| 3 (parallel with 8) | `tdd-be-gate --mode=light` | BE |
| 4 (parallel with 9) | `tdd-be-refactor` | BE |
| 5 (parallel with 10) | `tdd-be-gate --mode=full` | BE |
| 6 (parallel with 1) | `tdd-fe-red` | FE |
| 7 (parallel with 2) | `tdd-fe-green` | FE |
| 8 (parallel with 3) | `tdd-fe-gate --mode=light` | FE |
| 9 (parallel with 4) | `tdd-fe-refactor` | FE |
| 10 (parallel with 5) | `tdd-fe-gate --mode=full` | FE |

**Total:** 10 agent spawns (5 BE + 5 FE), running in 5 sequential phases, each phase running BE and FE in parallel.

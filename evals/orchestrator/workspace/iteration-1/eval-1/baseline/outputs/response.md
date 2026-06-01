# Baseline Response Plan: Email/Password Authentication Feature

## 1. Approach

I would approach this task using a structured, phase-based methodology. Since this is a greenfield feature ("start a new feature"), I would first gather context about the existing codebase, then design, implement, test, and document the feature in a linear progression of phases. Each phase produces concrete deliverables before moving to the next. The scope is focused on core authentication: email/password registration, login, session management, and password security best practices.

I would begin by understanding the project's tech stack, existing patterns, and any conventions I must follow. Then I would produce a specification, a high-level design, a detailed implementation plan, and finally the working code with tests.

## 2. Steps (In Order)

### Phase 0: Context Gathering
1. **Explore the codebase structure** -- Use `ls` and `find` to understand the project layout, language, framework, and directory conventions.
2. **Read existing configuration files** -- Check `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, or equivalent to identify the tech stack, existing dependencies, and any auth-related libraries already present.
3. **Examine existing models/schemas** -- Look for user models, database schemas, or migration files to understand data layer patterns.
4. **Review existing middleware/routes** -- Understand how the application handles HTTP requests, middleware pipelines, and route registration.
5. **Check for existing auth code** -- Search for keywords like "login", "password", "bcrypt", "jwt", "session", "auth" to avoid duplication.

### Phase 1: Specification and Design
6. **Draft a Software Requirements Specification (SRS)** covering:
   - Functional requirements: user registration with email/password, email verification, login, logout, password reset, session persistence.
   - Non-functional requirements: password hashing (bcrypt/argon2), rate limiting on login attempts, secure session tokens, input validation.
   - Edge cases: duplicate emails, weak passwords, expired sessions, concurrent logins.
7. **Create a High-Level Design (HLD)** covering:
   - Architecture diagram (text-based): client -> API routes -> auth service -> database.
   - Data flow for registration: POST /register -> validate -> hash password -> store user -> return token.
   - Data flow for login: POST /login -> find user -> verify hash -> generate token -> return token.
   - Database schema: `users` table with id, email, password_hash, created_at, updated_at, verified_at.
   - Session strategy: JWT (stateless) or server-side sessions (stateful) -- decide based on project needs.
8. **Create a Low-Level Design (LLD)** covering:
   - Exact API contract (request/response shapes, status codes, error formats).
   - Validation rules (email regex, password minimum length/complexity).
   - Token lifecycle (expiry, refresh, revocation).
   - Specific library choices (bcrypt vs argon2, JWT library, etc.).

### Phase 2: Implementation
9. **Create database migration** -- Add the `users` table migration file following the project's existing migration pattern.
10. **Implement the User model** -- Create a model class/struct with fields for id, email, password_hash, and timestamps.
11. **Implement password hashing utility** -- Write helper functions for hashing passwords (with salt) and verifying hashes.
12. **Implement token generation/validation** -- Create JWT or session token utilities.
13. **Implement validation helpers** -- Email format validation, password strength validation.
14. **Implement the AuthService** -- Core business logic: register, login, verify token, logout.
15. **Implement API routes/controllers**:
    - `POST /api/auth/register` -- Accept email + password, validate, create user, return token.
    - `POST /api/auth/login` -- Accept email + password, verify credentials, return token.
    - `POST /api/auth/logout` -- Invalidate session/token.
    - `GET /api/auth/me` -- Return current user from token.
16. **Implement auth middleware** -- Protect routes that require authentication.
17. **Wire everything together** -- Register routes, apply middleware, ensure proper dependency injection.

### Phase 3: Testing
18. **Write unit tests for**:
    - Password hashing and verification.
    - Token generation and validation.
    - Email validation.
    - AuthService business logic (register, login edge cases).
19. **Write integration tests for**:
    - Full registration flow (success + duplicate email).
    - Login flow (success + wrong password + non-existent user).
    - Protected route access (with + without valid token).
    - Logout flow.
20. **Run the test suite** -- Execute all tests, verify they pass.
21. **Manual smoke testing** -- If possible, start the application and test the endpoints with curl or similar.

### Phase 4: Documentation and Wrap-Up
22. **Update project documentation** -- Add notes about the auth system, environment variables needed (JWT_SECRET, etc.).
23. **Review the diff for security issues** -- Check for hardcoded secrets, missing input validation, SQL injection vectors, improper error messages that leak information.
24. **Summarize changes** -- Create a summary of what was built and any decisions made.

## 3. Verification

At each phase I would perform gate checks before proceeding:

- **After Phase 0:** Confirm I understand the tech stack, project conventions, and that no auth feature already exists.
- **After Phase 1:** Review the SRS, HLD, and LLD against the task requirement -- does the design cover email/password registration and login? Are edge cases addressed?
- **After Phase 2 (implementation):** Verify that compilation succeeds (or there are no syntax errors), that all new files follow project conventions, and that routes are properly registered.
- **After Phase 3 (testing):** Confirm all tests pass with `npm test` or equivalent. Verify test coverage covers both happy paths and error paths.
- **Final verification:** Run a linter if available, check for any TODO comments left behind, confirm no secrets are committed.

## 4. Handling Issues

- **If the tech stack is unclear:** I would read the project's README, main entry point, and build configuration files. If still unclear, I would ask the user.
- **If an auth library is already installed:** I would use the existing library rather than introducing a new one, maintaining consistency.
- **If the database layer is abstract (e.g., ORM):** I would follow the existing ORM patterns for migrations and models.
- **If tests fail:** I would debug systematically -- check the failing test, trace the code path, fix the issue, re-run tests. I would not proceed past this phase until all tests pass.
- **If I discover ambiguous requirements (e.g., should sessions persist across restarts?):** I would make a reasonable default choice, document it, and note it for the user to review.
- **If the codebase has security-sensitive code already:** I would follow the same patterns and avoid introducing inconsistencies.
- **If the project uses TypeScript/Python/Go/etc. and I am unsure about conventions:** I would look at existing similar features (e.g., another CRUD module) and mirror the patterns.

## 5. Deliverables

1. **SRS document** (in the project or as part of the PR description) -- Functional and non-functional requirements.
2. **HLD document** -- Architecture, data flow, database schema.
3. **LLD document** -- API contracts, validation rules, token strategy.
4. **Database migration file** -- Creates the `users` table.
5. **User model/entity** -- Code file with user data structure.
6. **Auth service** -- Core business logic module.
7. **Auth routes/controllers** -- HTTP endpoint handlers.
8. **Auth middleware** -- Route protection middleware.
9. **Unit tests** -- Testing individual components.
10. **Integration tests** -- Testing end-to-end flows.
11. **Updated documentation** -- Any README or env-var documentation updates.
12. **Summary of changes** -- For the commit message / PR description.

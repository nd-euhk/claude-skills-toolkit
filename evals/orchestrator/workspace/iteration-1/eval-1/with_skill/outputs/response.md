# Orchestrator Execution Plan: Add User Authentication with JWT (--auto)

## Step 1: Input Parsing and Workflow Routing

**Input:** "feature moi: add user authentication with JWT, tu dong"

**Parse result:**
- **Workflow type:** `feature` -- matches the `feature|task|story` pattern in the router
- **Description:** "add user authentication with JWT"
- **--auto flag:** Present ("tu dong" = automatic). Plan Mode is SKIPPED.

**Routing:** Since `feature` matches the Task Workflow pattern, route to `references/task-workflow.md` and execute the Task Workflow pipeline.

## Step 2: Phase 1 -- Pick Task

1. Invoke `Skill(sprint)` to interact with the sprint board.
2. Current board state (from `.work/board.md`):
   - **TODO:** T-002 (Password strength checker)
   - **In Review:** T-001 (Email validation utility)
   - **Ready:** T-003 (Input sanitizer)
   - **Done:** T-000 (Project setup)
3. The user's feature "add user authentication with JWT" does not match any existing TODO task.
4. `Skill(sprint)` creates a new task from the backlog (FEAT-001: User Login maps closest) or creates a fresh task:
   - **Task ID:** T-004
   - **Title:** JWT User Authentication
   - **Description:** Add user authentication with JWT -- implement JWT-based login, token issuance, token validation middleware, and protected route access.
   - **Status:** TODO (placed on board)
   - **Services:** auth-service

## Step 3: Phase 2 -- Plan Mode: SKIPPED (--auto present)

Since `--auto` flag is active, the Common Phase: Plan Mode is **bypassed entirely**. No `EnterPlanMode`, no `Agent(Plan)`, no human clarification. The orchestrator proceeds directly to the SDLC pipeline with the task description as the sole requirements source.

This means:
- No plan file is written to `.work/plans/`
- No human approval gate before execution
- Agents use the task description directly as their context

## Step 4: Phase 3 -- Execute SDLC Pipeline (Task Workflow)

Each phase must pass gate verification before the next phase begins. The sequence is strictly linear with one exception (IMP+TST in parallel).

### Phase 3a: SRS (Software Requirements Specification)

**Spawn `Agent(srs)`** with brief:
```
Context: Task T-004: JWT User Authentication — Add user authentication with JWT:
implement JWT-based login, token issuance, token validation middleware,
and protected route access.
Inputs: Task description from sprint board (no plan file due to --auto)
Task: Transform the feature description into precise, testable software
specifications with Gherkin Scenario Outlines, quantified NFRs, and full
traceability matrices.
Output: Agent will use its default template at .claude/templates/srs/
Constraints: Output will be gate-verified for completeness, traceability,
and testability.
```

**Expected SRS outputs:**
- Functional requirements (JWT login, token generation, token validation, token refresh, protected route middleware, token revocation/logout)
- Non-functional requirements (RS256 signing, token expiry 15min access / 7d refresh, auth latency < 100ms, OWASP compliance)
- Gherkin scenarios for each flow (successful login with JWT, expired token rejection, invalid signature rejection, missing token, refresh token flow)
- Traceability matrix linking requirements to test scenarios

### Gate Verification: SRS

**Spawn `Agent(gate-verifier)`** with brief:
```
Context: Verifying SRS output for task T-004: JWT User Authentication
Inputs: SRS output at {srs-output-path}
Task: Verify the SRS output against gate criteria:
  - Completeness: All feature aspects (login, token issuance, validation,
    refresh, revocation) are reflected in the SRS
  - Traceability: Every functional requirement maps to at least one Gherkin scenario
  - Testability: Each requirement has measurable acceptance criteria
  - NFR quantification: Token expiry, signing algorithm, latency targets are numeric
Output: Pass/fail verdict with specific feedback.
Constraints: Read-only — do not modify any files.
```

**On rejection:** Re-spawn `Agent(srs)` with the gate feedback prepended (re-spawn template). Retry up to 3 times before stopping and reporting to human.

### Phase 3b: HLD (High-Level Design)

**Prerequisite:** SRS gate passed.

**Spawn `Agent(hld)`** with brief:
```
Context: Task T-004: JWT User Authentication
Inputs: SRS at {srs-output-path}
Task: Design system architecture with C4 diagrams, Architecture Decision
Records, bounded context mapping, and service decomposition for a JWT-based
authentication system.
Output: Agent will use its default format (see hld agent ## Templates section)
Constraints: No implementation details, no code, no per-service internals.
Output must reference all SRS requirements.
```

**Expected HLD outputs:**
- C4 System Context diagram (Auth Service, User Store, Client App, Token Store)
- C4 Container diagram (Auth API, User Database, Token Blacklist Cache)
- Architecture Decision Records:
  - ADR-001: Use RS256 asymmetric signing for JWT (rationale: public key distribution for microservices)
  - ADR-002: Access token 15min / Refresh token 7d expiry (rationale: balance security and UX)
  - ADR-003: Redis for token blacklist on logout (rationale: fast revocation without DB load)
  - ADR-004: PostgreSQL for user credentials storage (consistent with existing stack)
- Bounded context mapping (Auth bounded context boundary, User identity context)
- Service decomposition (Auth Service: token issuance, validation, refresh, revocation)

### Gate Verification: HLD

**Spawn `Agent(gate-verifier)`** to verify HLD output:
- Completeness: All SRS requirements are addressed by architectural decisions
- No implementation details: No code or class-level design present
- Consistency: All SRS requirements are referenced
- ADR quality: Each decision includes context, options considered, and rationale

**On rejection:** Re-spawn `Agent(hld)` with feedback. 3-strike limit.

### Phase 3c: LLD (Low-Level Design)

**Prerequisite:** HLD gate passed.

**Spawn `Agent(lld)`** with brief:
```
Context: Task T-004: JWT User Authentication
Inputs: HLD at {hld-output-path}, SRS at {srs-output-path}
Task: Produce per-service technical design for JWT authentication with
domain models, transaction boundaries, REST client specs, caching strategies,
error flows, and feature work packages.
Output: Agent will use its default format (see lld agent ## Templates section)
Constraints: Service internals only. No new architectural decisions —
follow HLD boundaries.
```

**Expected LLD outputs:**
- Domain models (User, UserCredential, RefreshToken, JwtClaims, TokenBlacklistEntry)
- REST API specs:
  - `POST /auth/login` -- accepts credentials, returns access+refresh tokens
  - `POST /auth/refresh` -- accepts refresh token, returns new access token
  - `POST /auth/logout` -- blacklists tokens
  - `GET /auth/verify` -- validates token, returns claims
- Transaction boundaries (login requires atomic credential check + token issuance)
- Caching strategy (token blacklist in Redis with TTL matching token expiry, public key cache)
- Error flows (401 Unauthorized, 403 Forbidden with token-specific error codes)
- Feature work packages:
  - WP-1: JWT Token Service (issuance, validation, refresh)
  - WP-2: Auth Middleware (protected route enforcement)
  - WP-3: Login Endpoint (credential verification + token issuance)
  - WP-4: Logout/Revocation (token blacklisting)

### Gate Verification: LLD

**Spawn `Agent(gate-verifier)`** to verify LLD output:
- Completeness: All HLD architecture decisions are reflected in LLD
- HLD boundary compliance: No new architectural decisions introduced
- Service internals: Domain models, API specs, error flows present
- Work package decomposition: Features broken into implementable units

**On rejection:** Re-spawn `Agent(lld)` with feedback. 3-strike limit.

### Phase 3d: IMP + TST (Parallel)

**Prerequisite:** LLD gate passed.

**Spawn `Agent(imp)` and `Agent(tst)` simultaneously in a single message.**

**Agent(imp) brief:**
```
Context: Task T-004: JWT User Authentication
Inputs: LLD at {lld-output-path}, HLD at {hld-output-path}
Task: Write implementation specifications for each feature covering
execution flow, business rules, data impact, error mapping, and security
considerations for JWT auth.
Output: Agent will use .claude/templates/impl/impl-spec-backend-TEMPLATE.md
Constraints: Specifications only — no actual code. References LLD work packages.
```

**Agent(tst) brief:**
```
Context: Task T-004: JWT User Authentication
Inputs: IMP at {imp-output-path}, LLD at {lld-output-path}
Task: Write test specifications with concrete test cases for unit,
integration, E2E, and performance testing following TDD-first approach.
Output: Agent will use .claude/templates/tst/test-spec-backend-TEMPLATE.md
Constraints: Test specifications only — no implementation code.
References IMP specs for feature behavior.
```

**Expected IMP outputs:** Implementation specifications covering JWT token service internals, auth middleware pipeline, login request/response flow, token refresh flow, token blacklist management, security considerations (CSRF, XSS, token storage).

**Expected TST outputs:** Test specifications for:
- Unit tests (JWT token generation/validation, password verification, claims extraction)
- Integration tests (login -> get token -> access protected endpoint, expired token rejection, invalid signature rejection)
- E2E tests (full login journey with token refresh, logout followed by rejected access)
- Performance tests (login endpoint under 1000 concurrent users, token validation throughput)

### Gate Verification: IMP and TST (Parallel)

**Spawn two `Agent(gate-verifier)` instances in parallel:**

- **Gate Verifier A (IMP)** -- Verify implementation spec completeness, LLD work package coverage, security considerations documented
- **Gate Verifier B (TST)** -- Verify test spec completeness, coverage of all IMP scenarios, TDD-first approach followed

**Both must pass** before proceeding. If either fails, re-spawn the corresponding agent (IMP or TST) with gate feedback.

**On rejection:** Re-spawn the specific agent that failed (not both). 3-strike limit per agent.

### Phase 3e: Sprint Update

**Prerequisite:** Both IMP gate and TST gate passed.

**Invoke `Skill(sprint)`** to update the task status:
- From: `TODO`
- To: `Ready` (no blockers identified -- auth-service is standalone)

## Step 5: Gate Rejection Handling and Re-spawn Loop Safety

For EVERY gate verification across ALL phases:

1. If `gate-verifier` returns a **PASS** verdict, advance to the next phase.
2. If `gate-verifier` returns a **REJECT** verdict:
   - Capture the exact rejection feedback.
   - Prepend the re-spawn brief to the preceding agent's standard brief:
     ```
     RETRY #{N}: Previous attempt was rejected by gate-verifier.

     Gate feedback:
     {exact gate-verifier rejection message}

     Fix these specific issues before re-submitting.
     Do not change anything that was not flagged.
     ```
   - Re-spawn the preceding `Agent(phase)` (NOT the gate verifier).
   - Re-run `Agent(gate-verifier)` on the new output.
3. If the same agent fails gate verification **3 times consecutively**:
   - Stop the pipeline immediately.
   - Report to the human with all accumulated gate feedback across all 3 attempts.
   - Ask human: abort / adjust gate criteria / manual fix and retry.
   - Do NOT loop indefinitely -- hard safety limit.

## Step 6: Phase 4 -- Summary

After all gates pass and the task status is updated to Ready, write a summary report to:
`.work/reports/task-20260602-jwt-auth--add-user-authentication-with-jwt.md`

**Report contents:**
- Task ID: T-004
- Title: JWT User Authentication
- Description: Add user authentication with JWT -- JWT-based login, token issuance, token validation middleware, protected route access
- SRS summary: N functional requirements (login, token issuance, validation, refresh, revocation), N Gherkin scenarios, quantified NFRs (RS256 signing, 15min access / 7d refresh expiry, auth latency < 100ms)
- HLD summary: 4 ADRs (RS256, token expiry policy, Redis blacklist, PostgreSQL), bounded context mapped, C4 diagrams (System Context + Container level)
- LLD summary: 5 domain models (User, UserCredential, RefreshToken, JwtClaims, TokenBlacklistEntry), 4 REST endpoints, 4 feature work packages
- IMP summary: Backend implementation specs covering all 4 work packages (JWT Token Service, Auth Middleware, Login Endpoint, Logout/Revocation)
- TST summary: Test specs with N unit tests, N integration tests, N E2E scenarios, N performance tests
- Gate verification results:
  - SRS gate: PASS (1 attempt)
  - HLD gate: PASS (1 attempt)
  - LLD gate: PASS (1 attempt)
  - IMP gate: PASS (1 attempt)
  - TST gate: PASS (1 attempt)
- Final status: Ready
- Re-spawn summary: None (all gates passed on first attempt)

## Step 7: Phase 5 -- Next Steps

Use `AskUserQuestion` to present the user with options:

**Question:** "Task workflow complete. What next?"
**Header:** "Next"
**Options:**
1. "Cook this task now" -- Re-invoke orchestrator with `cook JWT User Authentication` (with --auto since this was already an --auto run)
2. "Start a new feature/task" -- Re-invoke orchestrator for a new task workflow
3. "Create a change request" -- Re-invoke orchestrator for CR workflow
4. "Done for now" -- End the session

## Complete Agent Spawning Sequence (--auto, no plan mode)

```
Phase 1: Skill(sprint)                          → Create T-004 in TODO
Phase 2: SKIPPED (--auto)                       → No plan mode
Phase 3a: Agent(srs)                            → Produce SRS
          Agent(gate-verifier)                  → Verify SRS [PASS/REJECT]
Phase 3b: Agent(hld)                            → Produce HLD
          Agent(gate-verifier)                  → Verify HLD [PASS/REJECT]
Phase 3c: Agent(lld)                            → Produce LLD
          Agent(gate-verifier)                  → Verify LLD [PASS/REJECT]
Phase 3d: Agent(imp) + Agent(tst) [PARALLEL]    → Produce IMP + TST specs
          Agent(gate-verifier) [IMP]            → Verify IMP [PASS/REJECT]
          Agent(gate-verifier) [TST]  [PARALLEL]→ Verify TST [PASS/REJECT]
Phase 3e: Skill(sprint)                         → Update status: TODO→Ready
Phase 4:  Write summary report                  → .work/reports/task-*.md
Phase 5:  AskUserQuestion                       → Next action routing
```

**Total agents spawned (ideal path, no re-spawns, --auto mode):**
- 1 sprint skill invocation (Phase 1: create task)
- 4 SDLC agents: SRS, HLD, LLD, IMP, TST
- 5 gate-verifier agents (SRS gate, HLD gate, LLD gate, IMP gate, TST gate)
- 1 sprint skill invocation (Phase 3e: status update)
- **Total: 11 spawned entities** (1 fewer than non-auto mode which has 2 plan agents)

## Key Differences: --auto vs Non-Auto Mode

| Aspect | Non-Auto | --auto (this execution) |
|--------|----------|------------------------|
| Plan Mode | EnterPlanMode, Agent(Plan), Agent(general-purpose), ExitPlanMode | SKIPPED |
| Human interaction | Requirements clarification during plan | None until Phase 5 (next steps) |
| Plan file | Written to `.work/plans/` | Not created |
| Agent briefs | Include plan file path as input | Reference task description directly |
| Total agents | 12 | 11 |
| Execution speed | Slower (human-in-the-loop) | Faster (fully automated) |

## Error Recovery Strategy

For each agent invocation:
- **Agent failure (not gate rejection):** Log the error. Ask human via AskUserQuestion whether to retry or skip. Do NOT auto-retry on agent errors.
- **Gate rejection:** Re-spawn the preceding agent with feedback, up to 3 times.
- **3-strike limit hit:** Stop pipeline. Present accumulated feedback to human with options: abort / adjust criteria / manual fix and retry.
- **Directory missing before file writes:** Run `mkdir -p .work/plans/` and `mkdir -p .work/reports/` before any file writes.
- **Sprint board inconsistency:** Never modify board files directly. Always use `Skill(sprint)` for board operations.

## Workflow Summary

```
INPUT: feature "add user authentication with JWT" --auto

ROUTE: feature → Task Workflow (references/task-workflow.md)

EXECUTE:
  1. Skill(sprint) → Create T-004 on board (TODO)
  2. SKIP Plan Mode (--auto)
  3. Agent(srs) → Agent(gate-verifier) → SRS approved
  4. Agent(hld) → Agent(gate-verifier) → HLD approved
  5. Agent(lld) → Agent(gate-verifier) → LLD approved
  6. Agent(imp) || Agent(tst) → Agent(gate-verifier) x2 → IMP+TST approved
  7. Skill(sprint) → T-004: TODO → Ready
  8. Write summary → .work/reports/task-20260602-jwt-auth--add-user-authentication-with-jwt.md
  9. AskUserQuestion → Cook / New feature / CR / Done

OUTPUT: T-004 marked Ready on sprint board. Full SDLC artifacts produced.
```

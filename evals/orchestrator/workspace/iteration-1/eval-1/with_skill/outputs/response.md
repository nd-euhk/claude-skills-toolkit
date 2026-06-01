# Orchestrator Response Plan: User Authentication with Email/Password Login

## Step 1: Input Parsing and Workflow Routing

**Input:** "I need to build a new feature: user authentication with email/password login. Start a new feature for this."

**Parse result:**
- **Workflow type:** `feature` -- matches the `feature|task|story` pattern in the router
- **Description:** "user authentication with email/password login"
- **--auto flag:** Not present, so we enter plan mode

**Routing:** Since `feature` matches the Task Workflow pattern, I would route to `references/task-workflow.md` and execute the Task Workflow pipeline.

## Step 2: Phase 1 -- Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **TODO**.
2. The sprint skill would either find an existing TODO task matching "user authentication with email/password login" or help create a new task for it on the board.
3. If no TODO tasks exist on the board, I would report to the human and stop immediately.
4. On success, capture the task ID, title, and description for context throughout all subsequent phases. For this scenario, assume task ID `T-001`, title "User Authentication - Email/Password Login".

## Step 3: Phase 2 -- Plan Mode (Not Skipped Since No --auto)

Since the `--auto` flag was not provided, I execute the Common Phase: Plan Mode:

1. **Call `EnterPlanMode`** to enter structured planning mode.
2. **Spawn `Agent(Plan)`** with a self-contained brief:
   - Context: Task T-001: User Authentication - Email/Password Login
   - Task: Clarify requirements with the human (password policies, session management, account lockout rules, email verification flow, etc.)
   - Support: Use `Skill(sequential-thinking)` and `Skill(problem-solving)` as needed
   - Draft the plan covering scope, deliverables, and acceptance criteria
3. **When human approves the plan**, spawn `Agent(general-purpose)` to write it to:
   - Path: `.work/plans/task-20260601-user-auth--email-password-login.md`
4. **AskUserQuestion** to confirm: "Plan written. Continue to execution or review further?"
   - Options: "Continue to execution" | "Let me review the plan first"
5. **Call `ExitPlanMode`** when ready to proceed.

## Step 4: Phase 3 -- Execute SDLC Pipeline

This is the core of the Task Workflow. Each phase must pass gate verification before the next phase begins. The sequence is strictly linear with one exception (IMP+TST in parallel).

### Phase 3a: SRS (Software Requirements Specification)

**Spawn `Agent(srs)`** with brief:
```
Context: Task T-001: User Authentication - Email/Password Login — Implement secure email/password authentication with registration, login, password reset, and session management.
Inputs: Plan file at .work/plans/task-20260601-user-auth--email-password-login.md
Task: Transform the business requirements from the plan into precise, testable software specifications with Gherkin Scenario Outlines, quantified NFRs, and full traceability matrices.
Output: Agent will use its default template at .claude/templates/srs/
Constraints: Output will be gate-verified for completeness, traceability, and testability.
```

**Expected SRS outputs would include:**
- Functional requirements (registration, login, logout, password reset, email verification)
- Non-functional requirements (encryption standards, response time < 200ms, OWASP compliance)
- Gherkin scenarios for each flow (happy path, invalid credentials, locked account, etc.)
- Traceability matrix linking requirements to test scenarios

### Gate Verification: SRS

**Spawn `Agent(gate-verifier)`** with brief:
```
Context: Verifying SRS output for task T-001: User Authentication - Email/Password Login
Inputs: SRS output at {srs-output-path}
Task: Verify the SRS output against the gate criteria:
  - Completeness: All plan requirements are reflected in the SRS
  - Traceability: Every functional requirement maps to at least one Gherkin scenario
  - Testability: Each requirement has measurable acceptance criteria
  - NFR quantification: Performance, security, and availability targets are numeric
Output: Pass/fail verdict with specific feedback.
Constraints: Read-only — do not modify any files.
```

**On rejection:** Re-spawn `Agent(srs)` with the gate feedback prepended. Retry up to 3 times before stopping and reporting to human.

### Phase 3b: HLD (High-Level Design)

**Prerequisite:** SRS gate passed.

**Spawn `Agent(hld)`** with brief:
```
Context: Task T-001: User Authentication - Email/Password Login
Inputs: SRS at {srs-output-path}, Plan at .work/plans/task-20260601-user-auth--email-password-login.md
Task: Design system architecture with C4 diagrams, Architecture Decision Records, bounded context mapping, and service decomposition.
Output: Agent will use its default format (see hld agent ## Templates section)
Constraints: No implementation details, no code, no per-service internals. Output must reference all SRS requirements.
```

**Expected HLD outputs:**
- C4 System Context diagram (Auth Service, User DB, Email Service, Frontend App)
- C4 Container diagram (Auth API, Auth Database, Session Store)
- Architecture Decision Records (e.g., "ADR-001: Use bcrypt for password hashing", "ADR-002: JWT for stateless sessions", "ADR-003: PostgreSQL for user storage")
- Bounded context mapping (Auth bounded context, User bounded context)
- Service decomposition (Auth Service responsibilities and boundaries)

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
Context: Task T-001: User Authentication - Email/Password Login
Inputs: HLD at {hld-output-path}, SRS at {srs-output-path}
Task: Produce per-service technical design with domain models, transaction boundaries, REST client specs, caching strategies, error flows, and feature work packages.
Output: Agent will use its default format (see lld agent ## Templates section)
Constraints: Service internals only. No new architectural decisions — follow HLD boundaries.
```

**Expected LLD outputs:**
- Domain models (User, Session, PasswordResetToken, EmailVerification)
- REST API specs (POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/reset-password, GET /auth/verify-email)
- Transaction boundaries (registration requires atomic user+credentials write)
- Caching strategy (session validation cache with TTL, rate limiting counters)
- Error flows and error response schema
- Feature work packages (WP-1: Registration, WP-2: Login, WP-3: Session Mgmt, WP-4: Password Reset)

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
Context: Task T-001: User Authentication - Email/Password Login
Inputs: LLD at {lld-output-path}, HLD at {hld-output-path}
Task: Write implementation specifications for each feature covering execution flow, business rules, data impact, error mapping, and security considerations.
Output: Agent will use .claude/templates/impl/impl-spec-backend-TEMPLATE.md or .claude/templates/impl/impl-spec-frontend-TEMPLATE.md
Constraints: Specifications only — no actual code. References LLD work packages.
```

**Agent(tst) brief:**
```
Context: Task T-001: User Authentication - Email/Password Login
Inputs: IMP at {imp-output-path}, LLD at {lld-output-path}
Task: Write test specifications with concrete test cases for unit, integration, E2E, and performance testing following TDD-first approach.
Output: Agent will use .claude/templates/tst/test-spec-backend-TEMPLATE.md or .claude/templates/tst/test-spec-frontend-TEMPLATE.md
Constraints: Test specifications only — no implementation code. References IMP specs for feature behavior.
```

**Expected IMP outputs:** Implementation specifications covering auth middleware, password hashing service, token management, rate limiting, email verification flows, account lockout logic.

**Expected TST outputs:** Test specifications for unit tests (password validation, token generation), integration tests (registration→login→protected endpoint flow), E2E tests (full registration and login journey), performance tests (login endpoint under load).

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
- To: `Ready` (or `Blocked` if dependencies exist, e.g., awaiting email service integration)

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

     Fix these specific issues before re-submitting. Do not change anything that was not flagged.
     ```
   - Re-spawn the preceding `Agent(phase)` (NOT the gate verifier).
   - Re-run `Agent(gate-verifier)` on the new output.
3. If the same agent fails gate verification **3 times consecutively**:
   - Stop the pipeline immediately.
   - Report to the human with all accumulated gate feedback across all 3 attempts.
   - Ask the human whether to: abort the workflow / adjust gate criteria / manually intervene and retry.
   - Do NOT loop indefinitely -- this is a hard safety limit.

### Example Rejection Scenario (LLD Gate Fails)

```
Phase 3c: Agent(lld) produces LLD output
  → Agent(gate-verifier) reviews → REJECT
  → Reason: "Missing transaction boundary analysis for password reset flow. 
              Redis caching strategy not defined for rate limiting counters."
  
RETRY #1: Re-spawn Agent(lld) with feedback
  → Agent(lld) fixes issues, produces updated LLD
  → Agent(gate-verifier) reviews → REJECT
  → Reason: "Caching strategy added but missing eviction policy. 
              Transaction boundary still incomplete."

RETRY #2: Re-spawn Agent(lld) with accumulated feedback
  → Agent(lld) fixes remaining issues
  → Agent(gate-verifier) reviews → PASS
  → Advance to Phase 3d (IMP+TST)
```

## Step 6: Phase 4 -- Summary

After all gates pass and the task status is updated to Ready/Blocked, write a summary report to:
`.work/reports/task-20260601-user-auth--email-password-login.md`

**Report contents:**
- Task ID: T-001
- Title: User Authentication - Email/Password Login
- Description: Implement secure email/password authentication with registration, login, password reset, session management
- SRS summary: N functional requirements captured, N Gherkin scenarios, quantified NFRs (auth latency < 200ms, bcrypt cost factor 12, JWT RS256)
- HLD summary: 4 ADRs (bcrypt, JWT, PostgreSQL, rate limiting), bounded contexts mapped, C4 diagrams completed
- LLD summary: Domain models defined (User, Session, 2 support entities), REST API contracts specified, 4 feature work packages
- IMP summary: Backend implementation specs covering all 4 work packages, security middleware specification
- TST summary: Test specs with N unit tests, N integration tests, N E2E test scenarios
- Gate verification results:
  - SRS gate: PASS (1 attempt)
  - HLD gate: PASS (1 attempt)
  - LLD gate: PASS (2 attempts, minor rework on caching strategy)
  - IMP gate: PASS (1 attempt)
  - TST gate: PASS (1 attempt)
- Final status: Ready
- Re-spawn summary: LLD required 1 re-spawn (LLD gate found caching gaps)

## Step 7: Phase 5 -- Next Steps

Use `AskUserQuestion` to present the user with options:

**Question:** "Task workflow complete. What next?"
**Header:** "Next"
**Options:**
1. "Cook this task now" -- Re-invoke orchestrator with `cook User Authentication - Email/Password Login` (with --auto since the plan was already approved)
2. "Start a new feature/task" -- Re-invoke orchestrator for a new task workflow
3. "Create a change request" -- Re-invoke orchestrator for CR workflow
4. "Done for now" -- End the session

## Agent Spawning Summary (Complete Sequence)

```
Phase 1: Skill(sprint)                          → Pick TODO task
Phase 2: EnterPlanMode                          → Enter planning
         Agent(Plan)                            → Draft plan with human
         Agent(general-purpose)                 → Write plan to file
         AskUserQuestion                        → Confirm proceed
         ExitPlanMode                           → Exit planning
Phase 3a: Agent(srs)                            → Produce SRS
          Agent(gate-verifier)                  → Verify SRS [PASS/REJECT]
Phase 3b: Agent(hld)                            → Produce HLD
          Agent(gate-verifier)                  → Verify HLD [PASS/REJECT]
Phase 3c: Agent(lld)                            → Produce LLD
          Agent(gate-verifier)                  → Verify LLD [PASS/REJECT]
Phase 3d: Agent(imp) + Agent(tst) [PARALLEL]    → Produce IMP + TST specs
          Agent(gate-verifier) [IMP]            → Verify IMP [PASS/REJECT]
          Agent(gate-verifier) [TST]  [PARALLEL]→ Verify TST [PASS/REJECT]
Phase 4:  Skill(sprint)                         → Update status: TODO→Ready
          Write summary report                  → .work/reports/task-*.md
Phase 5:  AskUserQuestion                       → Next action routing
```

**Total agents spawned (ideal path, no re-spawns):**
- 1 sprint skill invocation (Phase 1)
- 2 agents for planning (Phase 2)
- 4 SDLC agents: SRS, HLD, LLD, IMP, TST
- 5 gate-verifier agents (SRS gate, HLD gate, LLD gate, IMP gate, TST gate)
- 1 sprint skill invocation (Phase 4 status update)
- **Total: ~12 spawned entities**

## Error Recovery Strategy

For each agent invocation:
- **Agent failure (not gate rejection):** Log the error to the summary report. Ask human via AskUserQuestion whether to retry the agent or skip the phase. Do NOT auto-retry on agent errors -- this is a human decision point.
- **Gate rejection:** Distinct from agent errors. This is the normal quality control flow. Re-spawn the preceding agent with feedback, up to 3 times.
- **3-strike limit hit:** Stop the pipeline. Present accumulated feedback to human with options: abort / adjust criteria / manual fix and retry.
- **Directory missing before file writes:** Run `mkdir -p .work/plans/` and `mkdir -p .work/reports/` before any file writes.
- **Sprint board inconsistency:** Never modify board files directly. Always use `Skill(sprint)` for board operations.

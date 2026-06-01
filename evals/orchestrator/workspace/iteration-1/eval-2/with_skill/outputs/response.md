# Orchestrator Response Plan: CR -- Payment Service Refund Endpoint

## 1. Input Parsing and Routing to CR Workflow

### Parsing the Input

The human input is:

> I need to make a change request: the payment service API needs a new 'refund' endpoint added to the existing REST API. Create a CR for this.

Following the Quick Start (Step 1) from SKILL.md, I parse the input to extract:

- **Workflow type**: `cr` -- The presence of the phrase "change request" and the abbreviation "CR" in the user's message matches the `cr` route. The SKILL.md Step 2 routing table maps `cr` directly to `references/change-request-workflow.md`.
- **Description**: "The payment service API needs a new 'refund' endpoint added to the existing REST API."
- **--auto flag**: Not present in the input. Therefore, Plan Mode will be entered (the user will be asked to review and approve a plan before execution proceeds).

### Routing Decision

```
INPUT: cr "payment service API needs a new refund endpoint"
       (no --auto flag detected)

MATCH workflow-type:
  cr → references/change-request-workflow.md ✓

ROUTING: Change Request Workflow
PLAN MODE: Enabled (--auto not present)
```

Since the match is unambiguous (the user explicitly said "change request" and "CR"), no `AskUserQuestion` disambiguation is needed.

### Workflow Entry

I load `references/change-request-workflow.md` and enter the CR workflow at Phase 1.

---

## 2. HLD and LLD Impact Assessment

During Phase 2 (Plan Mode), `Agent(Plan)` must specifically assess HLD and LLD impact as required by the CR workflow. Here is how the assessment proceeds for this specific change.

### HLD Impact Assessment: "Does this change affect system architecture, component boundaries, or data flow?"

**Assessment for the refund endpoint change:**

The question: does adding a `refund` REST endpoint to the payment service affect the high-level design?

**Factors considered:**

a) **Component boundaries** -- The payment service already exists as a component. Adding an endpoint to an existing service does not introduce a new component or change component boundaries. No new services, no service splits, no service merges.

b) **System architecture** -- The system architecture at the HLD level (C4 container diagram, service mesh, deployment topology) is unchanged. The payment service remains a single container with the same responsibilities (payment processing), now extended to include refund processing.

c) **Data flow** -- THIS IS THE CRITICAL QUESTION. A refund endpoint introduces a new data flow direction. An existing payment endpoint likely follows: `Client → Payment Service → Payment Gateway → Bank`. A refund endpoint might reverse or modify this flow: does it follow the same path in reverse, or does it introduce new data flow participants? Specifically:

- If the refund calls the same external payment gateway for reversal transactions, the data flow at the container level is unchanged (same arrows, same participants).
- If the refund triggers a new integration (e.g., a notification service, an accounting ledger, a fraud detection service), then the data flow diagram would change.
- If the refund uses an event-driven pattern (e.g., emitting a `PaymentRefunded` event on a message bus consumed by other services), that would be an HLD-level change.

**Preliminary verdict:** The change is **likely contained** within the payment service boundaries. The data flow at the container level probably does not change (the same gateway is used for refund/reversal transactions). However, the plan agent should confirm by asking the user: "Does this refund endpoint integrate with any NEW external services, or does it use the same payment gateway for reversal transactions?" If same gateway, HLD is NOT affected. If new services/events, HLD IS affected.

**Assume for this plan: HLD is NOT affected** (refund calls the same gateway for reversals, no new service integrations).

### LLD Impact Assessment: "Does this change affect domain models, API contracts, or service internals?"

**Assessment for the refund endpoint change:**

The question: does adding a `refund` REST endpoint change anything at the low-level design level?

**Factors considered:**

a) **API contracts** -- DEFINITELY AFFECTED. Adding a `POST /api/v1/payments/{id}/refund` (or similar) endpoint is a new API operation. This adds to the REST client spec, OpenAPI/Swagger definition, and API contract. New request body schema (refund amount, reason), new response schema (refund status, refund ID, transaction reference), new error responses (refund not allowed, amount exceeds original payment, etc.).

b) **Domain models** -- LIKELY AFFECTED. The domain model gains new concepts: `Refund` entity (with fields like refundId, paymentId, amount, reason, status, createdAt, processedAt), `RefundStatus` enum (PENDING, PROCESSING, COMPLETED, FAILED), and possibly modifications to the existing `Payment` entity (add refundableAmount, refunds[] collection, or a status transition to allow REFUNDED state).

c) **Service internals** -- AFFECTED. The payment service internals must change:
- New controller/route handler for the refund endpoint
- New service-layer logic: validate refund eligibility, calculate refundable amount, call payment gateway reversal API, update payment and refund entities, handle idempotency
- New repository/data access for the `Refund` entity
- New error handling flows: payment not found, already fully refunded, gateway rejection, partial refund logic
- Possibly new transaction boundaries (refund should be atomic: gateway call + DB update)

**Verdict: LLD IS affected.** The change touches API contracts, domain models, and service internals.

### Summary of Impact Assessment

| Artifact     | Affected? | Rationale |
|-------------|-----------|-----------|
| HLD         | **No**    | Same component boundaries, same container-level data flow (uses existing payment gateway), no new services or architecture patterns |
| LLD         | **Yes**   | New API endpoint contract, new Refund domain entity, new service-layer logic, new repository, new error flows, new transaction boundaries |

This means the optional phases play out as follows:

- **HLD phase**: SKIPPED (not affected per assessment)
- **HLD gate verifier**: SKIPPED (no HLD output to verify)
- **LLD phase**: EXECUTED (affected per assessment)
- **LLD gate verifier**: EXECUTED (must verify LLD output)
- **IMP phase**: EXECUTED (always executed)
- **TST phase**: EXECUTED (always executed)
- **IMP gate verifier**: EXECUTED (always executed)
- **TST gate verifier**: EXECUTED (always executed)

---

## 3. Which Optional Phases Apply and Why

### HLD Phase: SKIPPED

**Reason:** The plan's impact assessment determined that HLD is NOT affected. Adding a refund endpoint to an existing payment service that already communicates with a payment gateway does not alter system architecture, component boundaries, or container-level data flow. The payment service still communicates with the same gateway -- the interaction is a reversal/refund transaction rather than a capture transaction, but the architecture topology is identical.

**Gate for HLD:** Also skipped (no output to verify).

### LLD Phase: EXECUTED

**Reason:** The plan's impact assessment determined that LLD IS affected. The change introduces:

1. A new REST API contract (`POST /api/v1/payments/{paymentId}/refund`)
2. New domain entities (`Refund`, `RefundStatus`)
3. Modifications to existing domain entities (`Payment` gets new relationships/status transitions)
4. New service-internal flows (validation, processing, error handling)
5. New transaction boundaries
6. New repository/data access patterns for refunds

These are textbook LLD-level changes.

### IMP Phase: ALWAYS EXECUTED

Per the CR workflow rules: "IMP+TST always execute regardless."

### TST Phase: ALWAYS EXECUTED

Per the CR workflow rules: "IMP+TST always execute regardless."

---

## 4. Exact Agent Spawning Sequence

### Prerequisites

Before spawning any agents, I ensure:
- Directories `.work/plans/` and `.work/reports/` exist (create with `mkdir -p` if needed)
- The plan file path is determined: `.work/plans/cr-20260601-payment-refund-endpoint--refund-endpoint.md`

### Phase 1: Pick Task

1. Invoke `Skill(sprint)` to pick a task from the board with status **Done** or **In Review**.
2. Capture the task details: task ID, title, description.
3. If no tasks with Done or In Review status exist, report to the human and stop.

For this scenario, assume a task exists, e.g., `PAY-0042: Payment Service REST API`.

### Phase 2: Plan Mode

1. Call `EnterPlanMode`.
2. Spawn `Agent(Plan)` with this brief:

```
Context: CR -- Payment Service REST API (PAY-0042)
         Current state: Done/In Review
         Change: Add a new 'refund' REST endpoint to the existing payment service API

Task: Assess impact on HLD and LLD artifacts, then draft a plan.

Specifically assess:
- HLD impact: Does this change affect system architecture, component boundaries, or data flow?
  (Consider: does the refund use the same payment gateway for reversals, or require new service integrations?)
- LLD impact: Does this change affect domain models (new Refund entity, Payment modifications),
  API contracts (new endpoint, request/response schemas), or service internals (new controller,
  service logic, repository, transaction boundaries)?

Draft the plan with:
- The CR summary
- Impact assessment (HLD: yes/no, LLD: yes/no) with rationale
- Scope of LLD changes needed
- Scope of IMP and TST changes needed
- Any risks or dependencies
```

3. When the human approves the plan, spawn `Agent(general-purpose)` to write it to `.work/plans/cr-20260601-payment-refund-endpoint--refund-endpoint.md`.

4. Use `AskUserQuestion`:
   - Header: "Proceed"
   - Options: "Continue to execution" | "Let me review the plan first"

5. When ready, call `ExitPlanMode`.

### Phase 3: Execute CR Pipeline

#### Step 3a: HLD Agent -- SKIPPED

The plan determined HLD is not affected. No `Agent(hld)` is spawned. No HLD gate verifier runs.

#### Step 3b: LLD Agent -- EXECUTED

Spawn `Agent(lld)` with this self-contained brief:

```
Context: CR -- Task PAY-0042: Payment Service REST API
         Change: Add a new 'refund' REST endpoint to the existing payment service API
Inputs: Plan at .work/plans/cr-20260601-payment-refund-endpoint--refund-endpoint.md
        Existing SRS at {srs-output-path} (from original task)
        Existing HLD at {hld-output-path} (from original task -- unchanged but provides architecture context)
Task: Produce per-service technical design for the refund endpoint, focused specifically on:
  - New domain model: Refund entity with fields (refundId, paymentId, amount, reason, status,
    idempotencyKey, createdAt, processedAt), RefundStatus enum (PENDING, PROCESSING, COMPLETED, FAILED)
  - Modifications to existing Payment entity: add refundableAmount, status transition to allow
    PARTIALLY_REFUNDED and REFUNDED states, optional refunds[] collection
  - New REST API contract: POST /api/v1/payments/{paymentId}/refund with request body
    (amount, reason, idempotencyKey) and response (refundId, status, transactionRef, processedAt)
  - New error responses: 404 (payment not found), 409 (already fully refunded), 422 (amount exceeds
    refundable), 502 (gateway failure)
  - Service-layer logic: refund eligibility validation, gateway reversal call, idempotency handling,
    concurrent refund prevention
  - Repository: RefundRepository with create, findById, findByPaymentId operations
  - Transaction boundaries: refund processing must be atomic (gateway call + entity persistence)
  - Feature work packages breaking down the LLD into implementable units
Output: Agent will use its default format (see lld agent ## Templates section)
Constraints: Service internals only. No new architectural decisions -- follow HLD boundaries.
            The HLD is unchanged; this is purely a LLD-level extension.
```

#### Step 3c: LLD Gate Verifier -- EXECUTED

After `Agent(lld)` completes, spawn `Agent(gate-verifier)` with this brief:

```
Context: Verifying LLD output for CR task PAY-0042: Payment Service REST API (refund endpoint)
Inputs: LLD output at {lld-output-path}
        Plan at .work/plans/cr-20260601-payment-refund-endpoint--refund-endpoint.md
        HLD at {hld-output-path}
Task: Verify the LLD output against gate criteria for LLD phase type:
  - Does the LLD cover all required areas (domain model, API contract, service internals, repository,
    transaction boundaries)?
  - Are the new domain entities (Refund, RefundStatus) complete with all necessary fields?
  - Is the API contract fully specified (endpoint, request schema, response schema, error responses)?
  - Do service internals cover the full refund flow (validation → gateway call → persistence)?
  - Does the LLD respect HLD boundaries (no new architectural decisions)?
  - Are there feature work packages breaking down the implementation?
  - Is the design consistent with the existing payment service patterns?
Output: Pass/fail verdict with specific feedback. If rejected, list exact issues to fix.
Constraints: Read-only -- do not modify any files. Report pass/fail only.
```

**On rejection:** Re-spawn `Agent(lld)` with the re-spawn template prepended (exact gate feedback), up to 3 times. On 3rd consecutive rejection, stop and report to human.

#### Step 3d: IMP Agent and TST Agent -- EXECUTED IN PARALLEL

Spawn BOTH agents simultaneously:

**Agent(imp) brief:**

```
Context: CR -- Task PAY-0042: Payment Service REST API (refund endpoint)
Inputs: LLD at {lld-output-path}
        Existing HLD at {hld-output-path} (unchanged, for architecture context)
Task: Write implementation specifications for the refund endpoint covering:
  - Controller/route handler: POST /api/v1/payments/{paymentId}/refund with input validation
  - Service-layer logic:
    - Refund eligibility check (payment exists, status allows refund, amount ≤ refundableAmount)
    - Idempotency: check idempotencyKey, return existing refund if already processed
    - Concurrent refund protection (optimistic locking or database constraint)
    - Payment gateway reversal API call (with retry logic)
    - Refund entity creation and persistence
    - Payment entity update (refundableAmount decrement, status transition if fully refunded)
  - Repository: RefundRepository methods (save, findByIdempotencyKey, findByPaymentId)
  - Error mapping: PaymentNotFoundException → 404, RefundNotAllowedException → 409,
    AmountExceedsRefundableException → 422, GatewayException → 502
  - Security: validate user authorization for the payment, audit log for refund operations
  - Feature work packages from LLD mapped to concrete implementation steps
Output: Agent will use .claude/templates/impl/impl-spec-backend-TEMPLATE.md
Constraints: Specifications only -- no actual code. References LLD work packages.
```

**Agent(tst) brief:**

```
Context: CR -- Task PAY-0042: Payment Service REST API (refund endpoint)
Inputs: IMP spec at {imp-output-path} (will be ready; both agents run in parallel, so include the
        planned IMP output path)
        LLD at {lld-output-path}
Task: Write test specifications for the refund endpoint with concrete test cases:
  - Unit tests:
    - RefundService: successful full refund, successful partial refund, refund amount exceeds
      refundable, refund on non-existent payment, idempotent refund (same key twice), concurrent
      refund conflict, gateway failure handling
    - RefundController: valid request → 200, missing required fields → 400, payment not found → 404,
      amount exceeds refundable → 422, idempotent retry → 200 with same result
  - Integration tests:
    - Full refund flow: POST refund → gateway mock returns success → refund entity persisted →
      payment status updated
    - Partial refund: refund $50 of $100 → refundableAmount becomes $50
    - Database transaction rollback on gateway failure
  - API contract tests: validate request/response schemas match LLD specification
  - Performance test: concurrent refund requests with same idempotencyKey → only one succeeds
Output: Agent will use .claude/templates/tst/test-spec-backend-TEMPLATE.md
Constraints: Test specifications only -- no implementation code. References IMP specs for behavior.
```

#### Step 3e: IMP Gate Verifier and TST Gate Verifier -- EXECUTED IN PARALLEL

After both IMP and TST agents complete, spawn BOTH gate verifiers simultaneously:

**IMP Gate Verifier brief:**

```
Context: Verifying IMP output for CR task PAY-0042: Payment Service REST API (refund endpoint)
Inputs: IMP output at {imp-output-path}
        LLD at {lld-output-path}
Task: Verify IMP output against gate criteria:
  - Does IMP cover all LLD work packages?
  - Are all controller, service, repository layers specified?
  - Are error flows and edge cases documented?
  - Is idempotency handling specified?
  - Is concurrent access handling specified?
  - Are security and audit considerations addressed?
  - Does IMP reference the correct LLD sections?
Output: Pass/fail verdict with specific feedback.
Constraints: Read-only -- do not modify any files.
```

**TST Gate Verifier brief:**

```
Context: Verifying TST output for CR task PAY-0042: Payment Service REST API (refund endpoint)
Inputs: TST output at {tst-output-path}
        IMP spec at {imp-output-path}
        LLD at {lld-output-path}
Task: Verify TST output against gate criteria:
  - Do tests cover all IMP feature behaviors?
  - Are there unit, integration, and API contract tests?
  - Are error scenarios covered (404, 409, 422, 502)?
  - Is the idempotency case tested?
  - Is the concurrent refund case tested?
  - Are partial and full refund scenarios both covered?
  - Do test cases have clear arrange/act/assert structure?
Output: Pass/fail verdict with specific feedback.
Constraints: Read-only -- do not modify any files.
```

#### Step 3f: Sprint Update

After both gate verifiers pass, invoke `Skill(sprint)` to add the CR task to the board with status:
- **Ready** if no dependencies exist
- **Blocked** if dependencies exist (e.g., waiting for gateway sandbox access or API key configuration)

---

## 5. Gate Verification and Failure Handling

### Normal Gate Flow (all pass)

```
Agent(lld) → produces LLD output
  ↓
Agent(gate-verifier) → verifies LLD → PASS
  ↓
Agent(imp) + Agent(tst) → both produce outputs IN PARALLEL
  ↓
Agent(gate-verifier:IMP) → PASS
Agent(gate-verifier:TST) → PASS (both run in parallel)
  ↓
Skill(sprint) → add CR task to Board as Ready
  ↓
Phase 4: Write summary report
  ↓
Phase 5: AskUserQuestion for next steps
```

### Gate Rejection Flow (Example: LLD fails)

```
Agent(lld) → produces LLD output
  ↓
Agent(gate-verifier) → verifies LLD → REJECT
  Feedback: "Missing RefundStatus enum definition. No idempotency handling in service flow.
            Transaction boundary not specified for gateway call + DB write."
  ↓
Re-spawn Agent(lld) with re-spawn brief:

  RETRY #1: Previous attempt was rejected by gate-verifier.

  Gate feedback:
  Missing RefundStatus enum definition. No idempotency handling in service flow.
  Transaction boundary not specified for gateway call + DB write.

  Fix these specific issues before re-submitting. Do not change anything that was not flagged.

  [original LLD brief follows]
  ↓
Agent(gate-verifier) → verifies revised LLD → PASS
  ↓
[pipeline continues]
```

### Re-spawn Loop Safety (3-strike rule)

If LLD fails gate verification 3 times consecutively:

```
Attempt 1: LLD → gate REJECT (missing RefundStatus enum)
Attempt 2: LLD re-spawn → gate REJECT (idempotency still incomplete)
Attempt 3: LLD re-spawn → gate REJECT (transaction boundary unclear)
  ↓
STOP. Report to human:

  "LLD agent failed gate verification 3 times consecutively for CR PAY-0042.
   Accumulated feedback:

   Attempt 1: Missing RefundStatus enum definition.
   Attempt 2: Idempotency handling incomplete -- doesn't specify idempotencyKey storage or
              duplicate request detection.
   Attempt 3: Transaction boundary unclear -- doesn't specify whether gateway call and DB write
              are in the same transaction or use compensating transactions.

   The pipeline cannot proceed. Please review the feedback and decide how to continue."

Use AskUserQuestion:
  Header: "LLD Gate Failed (3 strikes)"
  Options: "I'll fix the LLD manually and re-run" | "Skip LLD gate and proceed with
            implementation" | "Abort this CR"
```

The same 3-strike pattern applies to IMP and TST gate verifiers independently. Each agent tracks its own strike count.

### Error Recovery (agent failure, not gate rejection)

If any agent fails with an actual error (crash, timeout, unavailable model), the protocol is:

1. Log the error to the report.
2. Use `AskUserQuestion`:
   - Header: "Agent Error"
   - Options: "Retry the agent" | "Skip this phase" | "Abort CR"
3. Do NOT auto-retry on agent errors.

### Phase 4: Summary Report

After all gates pass and sprint is updated, write the summary report to `.work/reports/cr-20260601-payment-refund-endpoint--refund-endpoint.md`:

```markdown
# CR Summary: Payment Service Refund Endpoint

## Task
- ID: PAY-0042
- Title: Payment Service REST API
- Description: Add a new 'refund' REST endpoint to the existing payment service API

## Impact Assessment
- HLD affected: No -- same component boundaries, same container-level data flow (uses existing payment gateway for reversal transactions)
- LLD affected: Yes -- new API contract, new domain entities (Refund, RefundStatus), modified Payment entity, new service/repository layers, new transaction boundaries

## HLD Changes
None (phase skipped per impact assessment).

## LLD Changes
- New Refund domain entity and RefundStatus enum added
- Payment entity modified with refundableAmount and REFUNDED/PARTIALLY_REFUNDED statuses
- New REST endpoint: POST /api/v1/payments/{paymentId}/refund
- New service logic: refund eligibility, idempotency, gateway reversal call, concurrent protection
- New repository: RefundRepository
- Transaction boundary: atomic gateway call + persistence

## IMP Summary
- Controller: POST /api/v1/payments/{paymentId}/refund with validation
- Service: RefundService with eligibility check, idempotency, gateway integration, error handling
- Repository: RefundRepository with save, findByIdempotencyKey, findByPaymentId
- Error mapping: 404/409/422/502 responses
- Security: authorization check, audit logging

## TST Summary
- Unit tests: RefundService (6 cases), RefundController (5 cases)
- Integration tests: full refund flow, partial refund, DB rollback on gateway failure
- API contract tests: schema validation
- Performance test: concurrent idempotent refund requests

## Gate Verification Results
- HLD gate: Skipped (HLD not affected)
- LLD gate: PASS (1 attempt)
- IMP gate: PASS (1 attempt)
- TST gate: PASS (1 attempt)

## Final Status
Ready -- added to board.
```

### Phase 5: Next Steps

Use `AskUserQuestion`:
- Header: "Next"
- Options: "Cook this task now" | "Start a new feature/task" | "Create another change request" | "Done for now"

Route based on selection. If "Cook this task now", re-invoke orchestrator with `cook PAY-0042` (with --auto since plan was already approved).

---

## Complete Agent Spawning Summary

| Order | Agent | Mode | Optional? | Executed? | Gate Verifier |
|-------|-------|------|-----------|-----------|---------------|
| 1 | `Skill(sprint)` | N/A | No | Yes | N/A |
| 2 | `Agent(Plan)` | Plan Mode | No (no --auto) | Yes | N/A (human approval) |
| 3 | `Agent(general-purpose)` | Plan Mode | No | Yes (write plan file) | N/A |
| 4 | `Agent(hld)` | Normal | YES | **NO** (HLD not affected) | Skipped |
| 5 | `Agent(lld)` | Normal | YES | **YES** (LLD affected) | `Agent(gate-verifier)` |
| 6 | `Agent(imp)` | Normal | No | **YES** | `Agent(gate-verifier)` |
| 7 | `Agent(tst)` | Normal | No | **YES** | `Agent(gate-verifier)` |
| 8 | `Skill(sprint)` | N/A | No | Yes | N/A |

Agents 6 and 7 spawn in parallel. Their respective gate verifiers also run in parallel.

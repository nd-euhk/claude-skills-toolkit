# Cook Workflow (TDD Loop)

Direct TDD implementation following RED → GREEN → REFACTOR cycle. Best for features with complete specs (phases 05-09 outputs exist).

## Pre-Flight Check

Before cooking, verify readiness:

```
Agent type: Explore
Prompt: "Check if feature <FR-ID> is ready for TDD implementation.

Verify existence:
1. FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (has Gherkin scenarios)
2. API contract: agent_docs/contracts/api-{domain}.yaml (endpoints defined)
3. Impl spec: agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md (10 sections complete)
4. Test spec: agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md (test cases defined)
5. Work package: agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md (routing overlay)

Report: READY (all exist) / NOT READY (list what's missing)."
```

If NOT READY, tell user what's missing and suggest running the New Feature workflow first.

---

## TDD Cycle

Each feature follows this pattern. The orchestrator coordinates but NEVER writes code.

```
┌─────────────────────────────────────────┐
│  RED: test-writer writes failing tests   │
│       ↓                                  │
│  Verify tests FAIL (exit code != 0)      │
│       ↓                                  │
│  GREEN: implementer writes minimum code  │
│       ↓                                  │
│  Verify tests PASS                       │
│       ↓                                  │
│  REFACTOR: implementer cleans code       │
│       ↓                                  │
│  reviewer checks quality                 │
└─────────────────────────────────────────┘
```

## Step 1: RED - Write Failing Tests

Delegate to test-writer:

```
Agent type: test-writer (or general-purpose agent as test-writer)
Model: sonnet
Permission: acceptEdits
Prompt: "Write failing tests for feature <FR-ID>.

Read from:
- FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (Gherkin scenarios)
- API contract: agent_docs/contracts/api-{domain}.yaml
- Test spec: agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md

CRITICAL RULES:
- NEVER read agent_docs/backend/*/implementation/ or any implementation code
- Write tests at layers: Unit → Controller → Repository → Client (WireMock) → Integration
- After writing each test class, run it and VERIFY IT FAILS
- If a test passes without implementation, it's WRONG - rewrite it
- Commit after each test class with: test({service}): add failing tests for <FR-ID>

Output: Failing test files committed to the repository."
```

### Gate: Verify RED

Delegate verification:

```
Agent type: general-purpose (as verifier)
Prompt: "Verify the RED phase for feature <FR-ID>:

1. Run all new tests: <test command>
2. Confirm they FAIL (exit code != 0)
3. Confirm no test passes accidentally
4. Check commits follow format: test({service}): add failing tests for <FR-ID>

Report: RED_PASS (all tests fail) / RED_FAIL (some tests pass - need rewrite)."
```

If RED_FAIL, send the specific failures back to test-writer for correction. Do NOT proceed to GREEN.

---

## Step 2: GREEN - Implement Minimum Code

Delegate to implementer:

```
Agent type: implementer (or general-purpose agent as implementer)
Model: opus
Permission: acceptEdits
Prompt: "Implement the minimum code to pass failing tests for feature <FR-ID>.

Read from:
- Impl spec: agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md (execution flow, business rules)
- FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (what to build)
- Tech design: agent_docs/tech-design/ (domain model, contracts)
- Contracts: agent_docs/contracts/

CRITICAL RULES:
- NEVER modify tests - only write implementation code
- Follow impl spec task order: Entity → Repository → DTOs → Mapper → REST Client → Service → Controller → Migration
- After each component, run the specific test class
- When ALL tests pass, commit: feat({service}): implement <FR-ID>
- Include traceability footers: FR-ID, Impl-Spec path, Test-Spec path

Output: Implementation code committed to the repository."
```

### Gate: Verify GREEN

Delegate verification:

```
Agent type: general-purpose (as verifier)
Prompt: "Verify the GREEN phase for feature <FR-ID>:

1. Run all tests for this feature: <test command>
2. Confirm ALL tests PASS (exit code = 0)
3. Run full service test suite to check for regressions
4. Check commits follow format: feat({service}): implement <FR-ID>
5. Verify commit has FR-ID, Impl-Spec, Test-Spec footers

Report: GREEN_PASS (all tests pass, no regressions) / GREEN_FAIL (failing tests or regressions)."
```

If GREEN_FAIL, send failures back to implementer. If regression in OTHER services, note it but don't block (the other service's owner should fix).

---

## Step 3: REFACTOR - Clean Code

Delegate to implementer:

```
Agent type: implementer (or general-purpose agent as implementer)
Model: sonnet
Permission: acceptEdits
Prompt: "Refactor the implementation for feature <FR-ID>.

Actions:
1. Run formatter (spotlessApply / prettier / etc.)
2. Check for:
   - Code duplication (extract common logic)
   - Magic numbers (replace with named constants)
   - Missing error handling
   - Missing logging
   - Missing Javadoc/JSDoc on public methods
3. Run all service tests after each change
4. Commit: refactor({service}): clean up <FR-ID>

Output: Refactored code committed to the repository."
```

### Gate: Verify REFACTOR

Delegate verification:

```
Agent type: reviewer (or general-purpose agent as reviewer)
Model: sonnet
Permission: plan (read-only)
Prompt: "Review the refactored implementation for feature <FR-ID> against quality criteria:

1. [ ] Formatting applied consistently
2. [ ] No code duplication (DRY violations)
3. [ ] No magic numbers
4. [ ] Error handling present for all error scenarios
5. [ ] Logging at appropriate levels
6. [ ] All public methods documented
7. [ ] Architecture rules: no cross-service imports, no HTTP in transactions, circuit breakers on external calls
8. [ ] All tests still pass after refactoring

Report: REVIEW_PASS / REVIEW_NOTES (minor issues, proceed) / REVIEW_FAIL (must fix before done)."
```

---

## Step 4: Integration Check

Final verification across the full system:

```
Agent type: general-purpose (as verifier)
Prompt: "Run the full integration check for feature <FR-ID>:

1. Run full test suite: <full test command>
2. Check coverage meets threshold (>= 80%)
3. Run lint/static analysis
4. Verify traceability: every commit has FR-ID → Impl-Spec → Test-Spec chain

Report: INTEGRATION_PASS / INTEGRATION_FAIL with specific failures."
```

---

## Completion

After all TDD cycles pass, report:

```
Cook workflow complete for feature <FR-ID>.

Cycle: RED ✓ → GREEN ✓ → REFACTOR ✓
Coverage: <percentage>
Commits: <count>
Traceability: <FR-ID chain verified>

Artifacts:
  Tests: <test files created>
  Implementation: <source files created/modified>
  Review: <review report path>

Feature is ready for QA Gate (Phase 12).
```

---

## Batch Cooking (Multiple Features)

For multiple independent features, run in parallel using git worktrees:

1. Scout features to confirm they're independent (no shared services, no data dependencies)
2. For each independent feature, spawn a cook cycle in its own worktree
3. Features sharing services run sequentially
4. Gate review each feature independently

### Parallel Dispatch Pattern

```
For each independent feature:
  Agent type: general-purpose (as cook-executor)
  Isolation: worktree
  Prompt: "Execute the full TDD cycle for feature <FR-ID> following the cook workflow.
  RED → Verify → GREEN → Verify → REFACTOR → Review → Integration Check.
  Report back when complete."
```

Features with dependencies: run sequentially in dependency order.

---

## Stuck Protocol

If any subagent gets stuck (fails 5 times on the same step):

1. STOP the cycle for that feature
2. Generate stuck report: `.work/reports/FR-<id>-stuck.md`
3. Include: error encountered, approaches tried, root cause hypothesis, suggested fix
4. Present stuck report to user
5. Do NOT retry the same approach - wait for user guidance

```
Agent type: general-purpose
Prompt: "Feature <FR-ID> is stuck after 5 attempts at <step>.
  Error: <error details>
  Approaches tried: <list of attempts>
  Generate a stuck report at .work/reports/FR-<id>-stuck.md with:
  - Error description
  - All approaches tried
  - Root cause hypothesis
  - Suggested fix direction
  Do NOT attempt to fix - flag for human review."
```

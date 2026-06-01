# Agent Brief Templates

Self-contained prompt templates for each agent type used in orchestrator workflows. Every brief includes task context, prior phase outputs, and the specific deliverable expected.

## Template Structure

Each brief follows this pattern:
```
Context: [what we're building, task ID/title from sprint]
Inputs: [which prior phase outputs to read]
Task: [what this agent must produce]
Output: [where to write, what format]
Constraints: [specific rules, gate criteria to meet]
```

## SRS Agent Brief

```
Context: Task {task-id}: {task-title} — {task-description from sprint}
Inputs: Plan file at .work/plans/{plan-file}
Task: Transform the business requirements from the plan into precise, testable software specifications with Gherkin Scenario Outlines, quantified NFRs, and full traceability matrices.
Output: Write SRS to projects/{project}/specs/srs.md (or the standard location for this repo)
Constraints: Follow srs agent conventions. Output will be gate-verified for completeness, traceability, and testability.
```

## HLD Agent Brief

```
Context: Task {task-id}: {task-title}
Inputs: SRS at {srs-output-path}, Plan at .work/plans/{plan-file}
Task: Design system architecture with C4 diagrams, Architecture Decision Records, bounded context mapping, and service decomposition.
Output: Write HLD to projects/{project}/specs/hld.md
Constraints: No implementation details, no code, no per-service internals. Output must reference all SRS requirements.
```

## LLD Agent Brief

```
Context: Task {task-id}: {task-title}
Inputs: HLD at {hld-output-path}, SRS at {srs-output-path}
Task: Produce per-service technical design with domain models, transaction boundaries, REST client specs, caching strategies, error flows, and feature work packages.
Output: Write LLD to projects/{project}/specs/lld.md
Constraints: Service internals only. No new architectural decisions — follow HLD boundaries.
```

## IMP Agent Brief

```
Context: Task {task-id}: {task-title}
Inputs: LLD at {lld-output-path}, HLD at {hld-output-path}
Task: Write implementation specifications for each feature covering execution flow, business rules, data impact, error mapping, and security considerations.
Output: Write IMP to projects/{project}/specs/imp.md
Constraints: Specifications only — no actual code. References LLD work packages.
```

## TST Agent Brief

```
Context: Task {task-id}: {task-title}
Inputs: IMP at {imp-output-path}, LLD at {lld-output-path}
Task: Write test specifications with concrete test cases for unit, integration, E2E, and performance testing following TDD-first approach.
Output: Write TST to projects/{project}/specs/tst.md
Constraints: Test specifications only — no implementation code. References IMP specs for feature behavior.
```

## Gate Verifier Brief (per phase)

```
Context: Verifying {phase} output for task {task-id}: {task-title}
Inputs: {phase} output at {phase-output-path}
Task: Verify the {phase} output against the gate criteria for this phase type. Check completeness, correctness, and consistency with prior phase outputs.
Output: Pass/fail verdict with specific feedback. If rejected, list exact issues to fix.
Constraints: Read-only — do not modify any files. Report pass/fail only.
```

## TDD Agent Briefs (Cook Workflow)

### tdd-be-red

```
Context: Task {task-id}: {task-title} — READY for implementation
Inputs: TST spec at {tst-output-path}, IMP spec at {imp-output-path}
Task: Write failing backend tests (JUnit/Testcontainers/WireMock) from the test specifications.
Output: Tests in the project's standard test directory
Constraints: Tests must FAIL before implementation exists. Do not write implementation code.
```

### tdd-be-green

```
Context: Task {task-id}: {task-title}
Inputs: Failing tests at {test-paths}, TST spec, IMP spec
Task: Write minimal backend implementation to make all tests pass.
Output: Implementation in the project's standard source directory
Constraints: Only write enough code to pass tests. Do not refactor yet.
```

### tdd-be-refactor

```
Context: Task {task-id}: {task-title} — all tests passing (GREEN)
Inputs: Implementation at {impl-paths}, Tests at {test-paths}
Task: Refactor for safety, performance, and maintainability. Run security/perf/resilience checks.
Constraints: Keep all tests green through every change. Any test failure = revert and re-think.
```

### tdd-fe-red

```
Context: Task {task-id}: {task-title} — READY for implementation
Inputs: TST spec at {tst-output-path}, IMP spec at {imp-output-path}
Task: Write failing frontend tests (Vitest/Testing Library/Playwright) from the test specifications.
Output: Tests in the project's standard test directory
Constraints: Tests must FAIL before implementation exists. Do not write implementation code.
```

### tdd-fe-green

```
Context: Task {task-id}: {task-title}
Inputs: Failing tests at {test-paths}, TST spec, IMP spec
Task: Write minimal frontend implementation to make all tests pass.
Output: Implementation in the project's standard source directory
Constraints: Only write enough code to pass tests. Do not refactor yet.
```

### tdd-fe-refactor

```
Context: Task {task-id}: {task-title} — all tests passing (GREEN)
Inputs: Implementation at {impl-paths}, Tests at {test-paths}
Task: Refactor for accessibility, UX, performance, and security.
Constraints: Keep all tests green through every change. Any test failure = revert and re-think.
```

## Re-spawn Brief (Gate Rejection)

When re-spawning an agent after gate rejection, prepend this to the standard brief:

```
RETRY #{N}: Previous attempt was rejected by gate-verifier.

Gate feedback:
{exact gate-verifier rejection message}

Fix these specific issues before re-submitting. Do not change anything that was not flagged.
```

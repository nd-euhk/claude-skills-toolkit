# Gate Review Protocol

Every phase must pass an independent gate review before proceeding. The reviewer must be a DIFFERENT subagent type than the one that produced the work.

## Core Principles

1. **Separation of concerns** — Producer and reviewer are never the same
2. **Fail fast** — Don't stack broken phases; fix before proceeding
3. **Specific feedback** — Vague "looks good" is not a review; every checklist item must be explicitly checked
4. **Actionable failures** — If FAIL, list exactly what needs fixing, not just "incomplete"

## Review Dispatch Pattern

For every phase output, dispatch a review:

```
Agent type: <reviewer - different from producer>
Prompt: "Review the output of <phase name> at <output path> produced by <producer subagent>.

Gate criteria checklist:
1. [ ] <criterion 1>
2. [ ] <criterion 2>
...

For each criterion: PASS or FAIL with evidence.
Final verdict: PASS / PASS_WITH_WARNINGS / FAIL
If FAIL: list exact items that need fixing with specific file paths and line numbers if applicable."
```

## Phase-Specific Gate Checklists

### Phase 05 (SRS) Gate

Reviewer: component-validator or general-purpose
Producer: srs-specifier

```
1. [ ] Every FR has Gherkin Scenario Outline + data-driven Examples
2. [ ] >= 3 error/edge cases per FR (count them)
3. [ ] All NFRs have concrete numbers (not ranges, not "fast enough")
4. [ ] Traceability matrix: every FR → business objective (no orphans)
5. [ ] NO Phase 06/07 leaks: grep for API paths (/api/), service names, DB tables, frameworks
6. [ ] Concurrency scenarios covered (what happens with concurrent requests?)
7. [ ] Idempotency expectations stated (retry behavior)
```

### Phase 06 (HLD) Gate

Reviewer: component-validator or general-purpose
Producer: hld-architect

```
1. [ ] ADR-001 (service decomposition): decision + context + consequences
2. [ ] ADR-002 (API gateway/versioning): strategy defined
3. [ ] ADR-003 (event taxonomy): event types cataloged
4. [ ] C4 Level 1 diagram: all external systems shown
5. [ ] C4 Level 2 diagram: containers per service
6. [ ] domain-service-mapping.yaml: 100% coverage of bounded contexts
7. [ ] hard-boundaries.md: OWNS vs REFERENCES explicit per service
8. [ ] Data ownership matrix: each entity has exactly one owner service
9. [ ] No circular dependencies in service dependency graph
10. [ ] SRS backfill: "will be added" placeholders in SRS replaced with HLD links
```

### Phase 07 (LLD) Gate

Reviewer: component-validator or general-purpose
Producer: lld-designer

```
1. [ ] All 9 tech-design sections complete per service
2. [ ] Error Flows & Degraded Mode section present (not just "TBD")
3. [ ] Every FR has a work package (agent_docs/features/FR-*.md)
4. [ ] Work packages have correct routing frontmatter
5. [ ] OpenAPI contracts match work package endpoints (spot check 3 FRs)
6. [ ] Error codes catalog covers all error flows
7. [ ] Caching strategy defined for read-heavy endpoints
8. [ ] Transaction boundaries explicit (atomic vs eventual per operation)
9. [ ] Performance targets match NFR-PERF from SRS
```

### Phase 08 (IMP) Gate

Reviewer: component-validator or general-purpose
Producer: imp-specifier

```
1. [ ] All 10 sections complete per impl spec
2. [ ] NO code snippets, import statements, or package paths
3. [ ] Every business rule from FR is realized in execution flow
4. [ ] Error mapping covers all FR error scenarios (cross-reference)
5. [ ] Security & Authorization section: per-endpoint authZ stated
6. [ ] Migration spec exists for any DB schema changes
7. [ ] Acceptance checklist items are testable yes/no questions
8. [ ] Feature dependencies noted (must implement X before Y)
```

### Phase 09 (TST) Gate

Reviewer: component-validator or general-purpose
Producer: tst-specifier

```
1. [ ] Happy path + >= 2 error cases + edge cases per FR
2. [ ] Tests specified at correct layers (unit, controller, repo, client, integration, arch, perf)
3. [ ] WireMock/Stub specs for all external service calls
4. [ ] Performance test specs for all NFR-PERF items
5. [ ] CONTEXT ISOLATION: no references to implementation details or impl spec
6. [ ] Test data/fixtures are concrete and reproducible
7. [ ] Each test references the specific Gherkin scenario it validates
```

### Phase 10 (AGT) Gate

Reviewer: component-validator or general-purpose
Producer: agt-configurator

```
1. [ ] AGENTS.md covers all services, workflows, and constraints
2. [ ] Routing table: every FR → service → impl spec → test spec
3. [ ] Roadmap Sprint 1: concrete tasks, ordered, dependencies noted
4. [ ] Board/backlog: tasks in correct status columns
5. [ ] scripts/check-docs-sync.sh runs without errors (execute it)
6. [ ] scripts/check-traceability.sh runs with 0 errors (execute it)
7. [ ] Agent Validation Protocol: smoke test plan defined
```

### TDD Cycle Gates

See `cook-workflow.md` for RED, GREEN, REFACTOR, and Integration gates.

## Reviewer Selection

Always use a DIFFERENT subagent type from the producer:

| Producer | Valid Reviewers |
|----------|----------------|
| srs-specifier | component-validator, general-purpose |
| hld-architect | component-validator, general-purpose |
| lld-designer | component-validator, general-purpose |
| imp-specifier | component-validator, general-purpose |
| tst-specifier | component-validator, general-purpose |
| agt-configurator | component-validator, general-purpose |
| test-writer | reviewer, general-purpose |
| implementer | reviewer, general-purpose |

**Rule:** Never use the same subagent type for review. If the only available reviewer would be the same type, use a general-purpose agent as reviewer instead.

## Handling Review Outcomes

### PASS
Proceed to next phase immediately. Report to user: "Phase <N> gate: PASSED."

### PASS_WITH_WARNINGS
Proceed to next phase but flag warnings. Report: "Phase <N> gate: PASSED with warnings. [list warnings]. Proceeding but these should be addressed before production."

### FAIL
Do NOT proceed. Report to user: "Phase <N> gate: FAILED. [list failures]."

Then re-delegate to the original producer subagent:

```
Agent type: <same producer subagent>
Prompt: "Fix the following gate review failures from <phase> review:

Failures:
1. <failure 1 with file path>
2. <failure 2 with file path>

Fix each failure. After fixing, I will re-run the gate review."
```

After fixes, re-run the gate review. Repeat until PASS.

## Skipping Gate Review

Never skip gate review. If the user asks to skip:
- Explain: "Skipping gate review risks propagating errors across phases. Each phase builds on the previous one."
- Offer: "I can do a lighter review (spot check 3 items instead of full checklist) if you're time-constrained."
- If user insists: proceed but mark the phase as "GATE SKIPPED" prominently in reports.

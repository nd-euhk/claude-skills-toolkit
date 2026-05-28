# Change Request Workflow

Handles modifications to an existing feature. Focuses on re-spec phases 08-10, with optional design updates to 06-07 if architecture is affected.

## Phase Overview

```
Scout current state → Assess impact → Route to appropriate path:

Path A (No design impact):
  Phase 08 (IMP) → Phase 09 (TST) → Phase 10 (AGT/Board Update)
       ↓ Gate         ↓ Gate              ↓ Gate

Path B (Design impacted):
  Phase 06 (HLD) → Phase 07 (LLD) → Phase 08 (IMP) → Phase 09 (TST) → Phase 10 (AGT/Board Update)
       ↓ Gate         ↓ Gate          ↓ Gate          ↓ Gate              ↓ Gate
```

## Step 1: Scout Current State

Delegate to Explore agent to understand the existing feature:

```
Agent type: Explore
Prompt: "Scout the current state of feature: <feature identifier or description>.

Find:
1. Existing specs in docs/product/, docs/product/features/
2. Existing HLD in docs/architecture/, agent_docs/architecture.md
3. Existing LLD in agent_docs/tech-design/, agent_docs/contracts/
4. Existing impl specs in agent_docs/backend/*/implementation/, agent_docs/frontend/*/implementation/
5. Existing test specs in agent_docs/backend/*/test-specs/, agent_docs/frontend/*/test-specs/
6. Routing tables in agent_docs/README.md, AGENTS.md
7. Current implementation (find relevant source files in projects/)

Report: What exists, what's marked 'done', what's in progress."
```

### Step 1b: Check Board for Affected Tasks

Use sprint skill to find tasks related to this feature on the board:

```
Skill: sprint
Description: "Find all board tasks related to feature <FR-ID or feature name>. 
Check both .work/board.md (current sprint) for matching tasks. 
Report: task IDs, current status, and whether they need updating."
```

**If NO matching tasks found on the board:** This change doesn't affect any tracked work. It's effectively a new feature request. **Redirect to the New Feature workflow** (`references/new-feature-workflow.md`).

**If matching tasks found:** Proceed with Step 2 (Impact Assessment) below.

## Step 2: Assess Impact

Based on the scouting report, determine what the change affects.

### Design Impact Assessment

Use AskUserQuestion to confirm impact assessment:

Ask: "Based on scouting, the change affects: [summary]. Does this require design changes?" (header: "Design Impact")
Options:
- "Yes, architecture changes needed" (new APIs, services, data model changes)
- "No, implementation-only change" (logic, validation, error handling)
- "Not sure, let me assess"

If "Not sure", delegate assessment:

```
Agent type: hld-architect (or general-purpose agent)
Prompt: "Review this change request against the existing HLD and LLD:
  - agent_docs/architecture.md
  - agent_docs/domain-service-mapping.yaml
  - agent_docs/hard-boundaries.md
  - agent_docs/tech-design/
  - agent_docs/contracts/
  Change: <change description>

  Determine if the change requires:
  - New services or service decomposition changes?
  - New API endpoints or contract changes?
  - Data model changes (new entities, new relationships)?
  - New external integration points?
  - Changes to transaction boundaries?

  Report: DESIGN_CHANGE_NEEDED or IMPLEMENTATION_ONLY with reasoning."
```

## Path A: Implementation-Only Change

### Phase 08: Update Implementation Spec

```
Agent type: imp-specifier
Prompt: "Update the implementation spec for feature <FR-ID>.

Change request: <description>

Read existing impl spec from:
- agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
- agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md

Templates available at skills/orchestrate/templates/impl/

What to update:
1. Affected Areas section - add/modify affected files
2. Execution Flow - insert/update steps for the change
3. Business Rules Realized - add new rules if any
4. Data & State Impact - update state changes
5. Error Mapping - add new error scenarios
6. Implementation Notes - note any ordering constraints

Preserve all existing sections that don't change. Mark revisions with 'CR: <date>' comments.

Output to: same file path (updated in-place)"
```

### Gate Review (Phase 08)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the updated IMP spec against change request requirements:

Read from:
- agent_docs/backend/{service-name}/implementation/FR-*-impl.md
- agent_docs/frontend/{app-name}/implementation/FR-*-impl.md

Gate checklist:
1. [ ] Change request is fully addressed in execution flow
2. [ ] No existing functionality accidentally removed
3. [ ] Error mapping covers new/modified scenarios
4. [ ] Migration spec updated if DB changes exist
5. [ ] Change markers (CR: date) present on all modified sections

Report: PASS / FAIL with specific gaps."
```

### Phase 09: Update Test Spec

**Context-isolated:** tst-specifier reads FR spec + API contracts, NOT impl spec.

```
Agent type: tst-specifier
Prompt: "Update the test spec for feature <FR-ID>.

Change: <change description>

Read from:
- docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (FR spec, updated if applicable)
- agent_docs/contracts/api-{domain}.yaml
- Existing test spec: agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
  or agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md

Add/modify tests for:
- New/modified happy path scenarios
- Error cases for new logic
- Regression tests for unchanged behavior (verify it still works)

DO NOT read agent_docs/backend/*/implementation/ or agent_docs/frontend/*/implementation/ - context isolation required.

Templates available at skills/orchestrate/templates/tst/

Output to: same file path (updated in-place)"
```

### Gate Review (Phase 09)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the updated TST spec:

Read from:
- agent_docs/backend/{service-name}/test-specs/FR-*-test.md
- agent_docs/frontend/{app-name}/test-specs/FR-*-test.md

Gate checklist:
1. [ ] New scenarios covered at correct test layers
2. [ ] Regression tests included for unchanged behavior
3. [ ] Error cases cover new logic paths
4. [ ] Context isolation maintained (no impl details in test spec)

Report: PASS / FAIL with specific gaps."
```

### Phase 10: Update Board & Backlog

```
Agent type: agt-configurator
Prompt: "Update the agent configuration for the change request to feature <FR-ID>.

Actions:
1. If feature was marked 'done' on the board → REOPEN it
2. Update board/backlog: move feature to 'in-progress' or 'pending'
3. Update AGENTS.md if routing changed
4. Update agent_docs/roadmap.md if timeline affected
5. Update agent_docs/README.md routing table if needed
6. Run scripts/check-docs-sync.sh and report results

Context:
- Board: .work/board.md
- Backlog: .work/backlog.md
- Updated impl specs: agent_docs/backend/{service}/implementation/FR-*-impl.md
- Updated test specs: agent_docs/backend/{service}/test-specs/FR-*-test.md
- AGENTS.md (project root)
- agent_docs/README.md
- agent_docs/roadmap.md

Report: Board state before → after, reopened items, validation script results."
```

### Gate Review (Phase 10)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the AGT update:

Read from:
- AGENTS.md (project root)
- agent_docs/README.md
- agent_docs/roadmap.md
- .work/board.md
- .work/backlog.md

Gate checklist:
1. [ ] Board correctly reflects feature state (reopened if was done)
2. [ ] Backlog updated with change request tasks
3. [ ] scripts/check-docs-sync.sh passes
4. [ ] scripts/check-traceability.sh passes (FR → impl → test chain intact)
5. [ ] No orphaned references in routing table

Report: PASS / FAIL with specific gaps."
```

---

## Path B: Design-Impacted Change

When the change affects architecture, run phases 06-07 BEFORE 08-10.

### Phase 06: Update HLD

```
Agent type: hld-architect
Prompt: "Update the High-Level Design for change request: <description>.

Read existing HLD from:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/events.md
- agent_docs/contracts/api-conventions.md

Templates available at skills/orchestrate/templates/hld/

Review and update:
1. ADRs - add new ADR if the change introduces a new architectural decision
2. C4 diagrams - add new services/relationships if needed
3. domain-service-mapping.yaml - add new bounded contexts
4. hard-boundaries.md - update ownership if data moves between services
5. contracts/events.md - add new events
6. contracts/api-conventions.md - add new API patterns

Preserve existing decisions unless explicitly superseded. Mark all changes with 'CR: <date>'.

Output to: same file paths (updated in-place)"
```

### Gate Review (Phase 06)

Same gate review as new-feature Phase 06, plus: "Verify existing architecture decisions are preserved unless explicitly changed."

### Phase 07: Update LLD

```
Agent type: lld-designer
Prompt: "Update the Low-Level Design based on updated HLD for change: <description>.

Read from:
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/
- agent_docs/tech-design/

Templates available at skills/orchestrate/templates/lld/ and skills/orchestrate/templates/contracts/

For each affected service, update:
1. Internal Architecture - new components
2. Domain Model - new/modified entities
3. REST Clients - new external calls
4. Integration Points - new connections
5. Error Flows - new degraded mode scenarios
6. OpenAPI contracts - new/modified endpoints
7. Work packages - regenerate affected FR-*.md in agent_docs/features/

Preserve existing sections that don't change. Mark changes with 'CR: <date>'.

Output to:
- agent_docs/tech-design/{name}-service.md (updated)
- agent_docs/contracts/api-{domain}.yaml (updated if needed)
- agent_docs/contracts/error-codes.md (updated if needed)
- agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md (regenerated if needed)"
```

### Gate Review (Phase 07)

Same gate review as new-feature Phase 07.

After phases 06-07 pass, continue with phases 08-10 from Path A above.

---

## Completion

After all phases pass gate review:

1. **Update/Create board task via sprint skill:**

If updating an existing task (feature was already on the board):
```
Skill: sprint
Description: "Update board task for <FR-ID> to status ✅ Ready. 
The change request specs (IMP, TST, AGT) are complete. 
If the task was previously ✅ Done, reopen it and set to ✅ Ready."
```

If creating a new task (feature is new to the board after change request):
```
Skill: sprint
Description: "Create a new board task in .work/board.md:
- Task: '<description of change>'
- Feature: <FR-ID or BL-XXX>
- Service: <affected service>
- Status: ✅ Ready
The change request specs are complete and the task is ready for Cook implementation."
```

2. **Report to user:**

```
Change Request workflow complete.

Path: <A or B>
Phases updated: <list>
Board state: <before> → <after>
Reopened items: <list or none>

Output updated:
  docs/architecture/    - [if Path B] High-Level Design
  agent_docs/           - [if Path B] Architecture, contracts, tech-design
  agent_docs/backend/{service}/implementation/  - Updated Implementation Specs
  agent_docs/backend/{service}/test-specs/      - Updated Test Specs
  .work/board.md        - Updated Board (task set to ✅ Ready)

Next: Ready for Cook (TDD execution) to implement the changes.
```

## Special Cases

### Feature Was Marked "Done"

If the feature was completed and marked "done" on the board:
1. Reopen the feature on .work/board.md
2. Create a new change request task linked to the original feature
3. All updated specs should reference the original FR-ID with a change revision number

### Change Affects Multiple Features

If the change spans multiple FRs:
1. Run the impact assessment once for all affected FRs
2. Process FRs in dependency order
3. Run Phase 08-10 per FR, or batch independent FRs
4. Gate review covers the batch as a whole

### Rollback Request

If the change is a rollback to a previous version:
1. Scout git history to find the previous spec versions
2. Restore specs from git instead of rewriting
3. Update board with rollback reason
4. Gate review focuses on: "Does the restored spec still match the current system state?"

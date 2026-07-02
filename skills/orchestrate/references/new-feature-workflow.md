# New Feature Workflow (Phases 05-10)

Implements a new feature from requirements through agent setup. Every phase has a mandatory gate review by a DIFFERENT subagent.

## Phase Overview

```
Phase 05 (SRS) → Phase 06 (HLD) → Phase 07 (LLD) → Phase 08 (IMP) → Phase 09 (TST) → Phase 10 (AGT)
     ↓ Gate         ↓ Gate          ↓ Gate          ↓ Gate          ↓ Gate          ↓ Gate
```

## SDLC Output Path Conventions

All output follows the SDLC framework conventions from `_framework/sdlc/`:

| Directory | Purpose | Phases |
|-----------|---------|--------|
| `docs/` | Human-readable specs (business, product, architecture) | 05-06 |
| `agent_docs/` | Agent-facing condensed specs, contracts, work packages | 05-10 |
| `.work/` | Tracking artifacts (board, backlog, reports, incidents) | 10+ |
| `scripts/` | Validation and utility scripts | 10 |
| `AGENTS.md` | Root-level vendor-neutral agent instructions | 10 |

**Templates available at:** `skills/orchestrate/templates/` — subagents MUST use these templates for all outputs.

## Pre-Flight: Plan Mode (MANDATORY)

**Before any scouting or phase execution, enter plan mode per the Plan Mode Protocol in SKILL.md.**

The orchestrator MUST follow this sequence before proceeding to Phase 05:

### Step P1: Enter Plan Mode

```
EnterPlanMode
```

This puts the session into plan mode. No writes allowed — only reads, questions, and delegation.

### Step P2: Delegate to Plan Subagent

```
Agent type: Plan
Prompt: "Analyze the New Feature request and create a comprehensive orchestration plan.

Feature: <feature description>
Scope: Full SDLC phases 05 (SRS) → 06 (HLD) → 07 (LLD) → 08 (IMP) → 09 (TST) → 10 (AGT)

Plan should include:
1. What this feature does (from user's request)
2. Phase-by-phase breakdown: inputs, outputs, subagent assignments
3. Gate review assignments: different reviewer per phase
4. Output paths following SDLC conventions
5. Dependencies and ordering
6. Estimated complexity per phase

Report the plan in structured format ready for documentation."
```

### Step P3: Write Plan to File

```
Agent type: general-purpose
Model: sonnet
Prompt: "Write the New Feature orchestration plan to .work/plans/<YYYYMMDD>/plan-new-feature-<feature-slug>.md.

Plan content:
<plan from Step P2>

Create directory .work/plans/<YYYYMMDD>/ if it doesn't exist.

Write the complete plan to .work/plans/<YYYYMMDD>/plan-new-feature-<feature-slug>.md
Include: phase sequence, subagent assignments per phase, gate review assignments, output paths, and timeline."
```

### Step P4: Present Plan for Human Confirmation

Read `.work/plans/<YYYYMMDD>/plan-new-feature-<feature-slug>.md` and present:

```
New Feature Plan: .work/plans/<YYYYMMDD>/plan-new-feature-<feature-slug>.md

Phases: <N> phases from SRS to AGT
Subagents: <list per phase>
Outputs: <directory structure>
Gate reviews: <assignments>

Confirm to proceed with execution.
```

Use AskUserQuestion for any branching decisions. Wait for explicit approval.

### Step P5: Exit Plan Mode

```
ExitPlanMode
```

Only after human confirms. This exits plan mode and allows phase execution.

### Step P6: Proceed with Execution

Return to the workflow below, starting with Pre-Flight Check. All phases execute per the approved plan. Every phase still requires mandatory gate review.

**If the user's feature request is ambiguous (no specific FR-ID or feature name):** Use sprint skill during plan mode to query `.work/board.md` for 🔲 Todo tasks and present candidates in the plan.

---

## Pre-Flight Check

Before starting, scout the project structure using Explore agent:

```
Agent type: Explore
Prompt: "Scout the project structure. Find: existing specs in docs/, agent_docs/, .work/,
existing AGENTS.md, CLAUDE.md, settings files, and any existing phase outputs.
Report what exists and what's missing."
```

Use the scouting report to determine starting phase. If phases 0-4 (Intake, BRD, PRD, URD, UX) don't exist, note this to the user but proceed from Phase 05 — those are business-side phases.

**If the user's feature request is ambiguous (no specific FR-ID or feature name):**
1. Use sprint skill to query `.work/board.md` for 🔲 Todo tasks
2. Present the todo task list to the user as implementation candidates
3. Let the user select which task/feature to implement
4. Proceed with the selected feature through phases 05-10

**Sprint board interaction:**
```
Skill: sprint
Description: "Get all 🔲 Todo tasks from the board. List them with task IDs, feature IDs, and descriptions."
```

---

## Phase 05: Software Requirements Specification (SRS)

### Delegate to srs-specifier

```
Agent type: srs-specifier
Prompt: "Write the SRS for feature: <feature description>.

Templates to use:
- Master SRS: skills/orchestrate/templates/srs/SRS-TEMPLATE.md
- Individual FR: skills/orchestrate/templates/srs/FR-TEMPLATE.md
- Traceability matrix: skills/orchestrate/templates/srs/requirements-matrix-TEMPLATE.md

Requirements:
- Every FR must have Gherkin Scenario Outline + data-driven Examples
- >= 3 error cases per FR
- NFRs with concrete numbers (not ranges)
- Traceability matrix linking FRs → business objectives
- CRITICAL: NO API paths, service names, DB specifics, or technology decisions
  These belong in Phase 06/07. The SRS is technology-agnostic.
- Include concurrency/idempotency scenarios where applicable

Output:
- docs/product/SRS.md — master SRS
- docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md — one file per FR
- agent_docs/traceability/requirements-matrix.md — traceability matrix

If context from Phases 0-4 exists, also produce (large teams):
- docs/product/SRS-BACKEND.md — backend SRS with bounded context registry
- docs/product/SRS-FRONTEND.md — frontend SRS with app architecture + CWV\n

If context from Phases 0-4 exists (docs/business/, docs/product/, docs/user/, docs/ux/),
read those first for business objectives, user profiles, and UX specs."
```

### Gate Review (Phase 05)

Delegate to a DIFFERENT subagent for review:

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the SRS output against Phase 05 gate criteria:

Read from:
- docs/product/SRS.md
- docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md
- agent_docs/traceability/requirements-matrix.md

Gate checklist:
1. [ ] Every FR has Gherkin Scenario Outline + Examples (not just Scenario)
2. [ ] >= 3 error/edge cases per FR
3. [ ] All NFRs have concrete, measurable numbers
4. [ ] Traceability matrix complete (every FR → business objective)
5. [ ] NO Phase 06/07 leaks: grep for API paths, service names, DB table names, technology choices
6. [ ] Concurrency scenarios covered (what happens with concurrent requests?)
7. [ ] Idempotency expectations stated (retry behavior)

Report: PASS / FAIL with specific gaps. If FAIL, list exact FRs that need fixes."
```

---

## Phase 06: High-Level Design (HLD)

### Delegate to hld-architect

```
Agent type: hld-architect
Prompt: "Create the High-Level Design based on SRS:
- docs/product/SRS.md
- docs/product/features/epic-{name}/FR-*.md

Templates to use:
- HLD: skills/orchestrate/templates/hld/HLD-TEMPLATE.md
- ADR: skills/orchestrate/templates/hld/ADR-TEMPLATE.md
- Architecture: skills/orchestrate/templates/hld/architecture-TEMPLATE.md
- Hard boundaries: skills/orchestrate/templates/hld/hard-boundaries-TEMPLATE.md

Requirements:
- 3 mandatory ADRs: ADR-001 service decomposition, ADR-002 API gateway/versioning, ADR-003 event taxonomy
- C4 Level 1 (System Context) and Level 2 (Container) diagrams (text-based or Mermaid)
- domain-service-mapping.yaml covering all bounded contexts
- hard-boundaries.md: what each service OWNS vs what it REFERENCES
- contracts/events.md and contracts/api-conventions.md
- Data ownership matrix

After completing HLD, backfill any 'will be added' placeholders in SRS files
with concrete references to HLD artifacts.

Output:
- docs/architecture/system-architecture.md — C4 diagrams + architecture narrative
- docs/architecture/ADRs/ADR-{NNN}-{decision}.md — 3 mandatory + any additional ADRs
- docs/architecture/diagrams/{name}.mermaid — diagram source files
- agent_docs/architecture.md — agent-facing architecture summary
- agent_docs/domain-service-mapping.yaml — bounded context → service mapping
- agent_docs/hard-boundaries.md — ownership & reference rules
- agent_docs/contracts/events.md — event taxonomy
- agent_docs/contracts/api-conventions.md — API conventions"
```

### Gate Review (Phase 06)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the HLD output against Phase 06 gate criteria:

Read from:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/events.md
- agent_docs/contracts/api-conventions.md

Gate checklist:
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

Report: PASS / FAIL with specific gaps."
```

---

## Phase 07: Low-Level Design (LLD)

### Delegate to lld-designer

```
Agent type: lld-designer
Prompt: "Create the Low-Level Design for each service defined in HLD:
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md

Templates to use:
- LLD: skills/orchestrate/templates/lld/lld-TEMPLATE.md
- SPEC-BOUNDARIES: skills/orchestrate/templates/lld/SPEC-BOUNDARIES.md
- API contract: skills/orchestrate/templates/contracts/api-TEMPLATE.yaml
- Events: skills/orchestrate/templates/contracts/events-TEMPLATE.md
- Error codes: skills/orchestrate/templates/contracts/error-codes-TEMPLATE.md
- FR template (for work packages): skills/orchestrate/templates/srs/FR-TEMPLATE.md

For each service, produce a tech-design with 9 sections:
1. Service Boundary
2. Internal Architecture (controllers → services → repositories)
3. Domain Model (entities, value objects, aggregates)
4. REST Clients (external service calls)
5. Transaction Boundaries
6. Integration Points
7. Caching Strategy
8. Performance & Scale targets
9. Error Flows & Degraded Mode

Also produce:
- OpenAPI contracts per service
- Error codes catalog
- Work packages: agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md
  (routing overlays compiling FR + HLD + contracts — no duplication of business logic)

Output:
- agent_docs/tech-design/{name}-service.md — per service (1 deployment unit = 1 file)
- agent_docs/tech-design/cross-cutting.md — shared concerns across services
- agent_docs/contracts/api-{domain}.yaml — OpenAPI 3.1 contract per domain
- agent_docs/contracts/error-codes.md — error code catalog
- agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md — work packages with routing overlay"
```

### Gate Review (Phase 07)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the LLD output against Phase 07 gate criteria:

Read from:
- agent_docs/tech-design/
- agent_docs/contracts/api-*.yaml
- agent_docs/contracts/error-codes.md
- agent_docs/features/FR-*.md

Gate checklist:
1. [ ] All 9 sections complete per service (including Error Flows & Degraded Mode)
2. [ ] Every FR has a work package (agent_docs/features/FR-*.md)
3. [ ] Work package frontmatter routes to correct service
4. [ ] API contracts match work package endpoints
5. [ ] No missing error codes (every error flow has a code)
6. [ ] Caching strategy defined for all read-heavy endpoints
7. [ ] Transaction boundaries explicit (what's atomic, what's eventual)
8. [ ] Performance targets match NFR-PERF from SRS

Report: PASS / FAIL with specific gaps."
```

---

## Phase 08: Implementation Specification (IMP)

### Delegate to imp-specifier

```
Agent type: imp-specifier
Prompt: "Write implementation specs for each FR based on:
- SRS: docs/product/features/epic-{name}/FR-*.md
- HLD: agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml
- LLD: agent_docs/tech-design/
- Work packages: agent_docs/features/FR-*.md

Templates to use:
- Backend impl spec: skills/orchestrate/templates/impl/impl-spec-backend-TEMPLATE.md
- Frontend impl spec: skills/orchestrate/templates/impl/impl-spec-frontend-TEMPLATE.md
- Migration spec: skills/orchestrate/templates/impl/migration-spec-TEMPLATE.md
- SPEC-BOUNDARIES: skills/orchestrate/templates/lld/SPEC-BOUNDARIES.md

For each feature, produce a 10-section lean spec:
1. Purpose
2. References (FR, HLD, LLD links)
3. Affected Areas (services, packages, files)
4. Execution Flow (step-by-step, not code)
5. Business Rules Realized
6. Data & State Impact
7. Error Mapping (error code → scenario → response)
8. Security & Authorization
9. Implementation Notes (gotchas, ordering, dependencies)
10. Acceptance Checklist

Rules:
- NO code snippets, package names as imports, or file paths
- Decision-rich: explain WHY each choice, not just WHAT
- If DB changes needed: produce separate migration spec

Output:
- agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
- agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
- agent_docs/backend/conventions.md (if new service, or update if existing)
- agent_docs/backend/{service-name}/README.md — service overview
- agent_docs/frontend/conventions.md (if new app, or update if existing)"
```

### Gate Review (Phase 08)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the IMP specs against Phase 08 gate criteria:

Read from:
- agent_docs/backend/{service-name}/implementation/FR-*-impl.md
- agent_docs/frontend/{app-name}/implementation/FR-*-impl.md

Gate checklist:
1. [ ] All 10 sections complete per feature
2. [ ] NO code, imports, or package paths in any spec
3. [ ] Every business rule from FR is realized in execution flow
4. [ ] Error mapping covers all FR error scenarios
5. [ ] Security section addresses authZ per endpoint
6. [ ] Migration spec exists for any DB changes
7. [ ] Acceptance checklist is testable (each item is a yes/no question)
8. [ ] Feature dependencies noted (must implement X before Y)

Report: PASS / FAIL with specific gaps."
```

---

## Phase 09: Test Specification (TST)

### Delegate to tst-specifier

**CRITICAL:** The tst-specifier must be context-isolated. It reads SRS + API contracts but NEVER reads implementation specs.

```
Agent type: tst-specifier
Prompt: "Write test specifications based on:
- FR specs: docs/product/features/epic-{name}/FR-*.md (READ ONLY - no impl specs)
- API contracts: agent_docs/contracts/api-*.yaml
- NFRs: docs/product/SRS.md (NFR section)

Templates to use:
- Backend test spec: skills/orchestrate/templates/tst/test-spec-backend-TEMPLATE.md
- Frontend test spec: skills/orchestrate/templates/tst/test-spec-frontend-TEMPLATE.md

For each feature, specify tests at these layers:
1. Unit tests (service layer logic)
2. Controller tests (HTTP layer)
3. Repository tests (data layer)
4. Client tests (WireMock for external calls)
5. Integration tests (end-to-end within service boundary)
6. Architecture tests (ArchUnit / dependency rules)
7. Performance tests (k6 scripts for NFR-PERF)

Each test spec must include:
- What to test (specific scenario from FR Gherkin)
- Test data / fixtures needed
- Expected result
- Layer where it belongs

Rules:
- Happy path + >= 2 error cases + edge cases per FR
- NEVER read agent_docs/backend/*/implementation/ or agent_docs/frontend/*/implementation/ (context isolation)

Output:
- agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
- agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
- agent_docs/performance/README.md
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md"
```

### Gate Review (Phase 09)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the TST specs against Phase 09 gate criteria:

Read from:
- agent_docs/backend/{service-name}/test-specs/FR-*-test.md
- agent_docs/frontend/{app-name}/test-specs/FR-*-test.md
- agent_docs/performance/

Gate checklist:
1. [ ] Covers all FR scenarios (happy path + errors + edges)
2. [ ] All 7 test layers addressed where applicable
3. [ ] WireMock specs for all external service calls
4. [ ] Performance test specs for all NFR-PERF items
5. [ ] Context isolation verified: no references to implementation details
6. [ ] Test data/fixtures are concrete and reproducible
7. [ ] Each test references the specific Gherkin scenario it validates

Report: PASS / FAIL with specific gaps."
```

---

## Phase 10: Agent Setup (AGT)

### Delegate to agt-configurator

```
Agent type: agt-configurator
Prompt: "Configure the agent environment for execution based on all specs:
- SRS: docs/product/SRS.md, docs/product/features/epic-{name}/FR-*.md
- HLD: agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md
- LLD: agent_docs/tech-design/, agent_docs/contracts/
- IMP: agent_docs/backend/*/implementation/, agent_docs/frontend/*/implementation/
- TST: agent_docs/backend/*/test-specs/, agent_docs/frontend/*/test-specs/

Templates to use:
- AGENTS.md: skills/orchestrate/templates/agt/AGENTS-TEMPLATE.md
- Routing table: skills/orchestrate/templates/agt/agent-routing-TEMPLATE.md
- Roadmap: skills/orchestrate/templates/agt/roadmap-TEMPLATE.md
- Feature index: skills/orchestrate/templates/agt/feature-index-TEMPLATE.md

Produce:
1. AGENTS.md — vendor-neutral agent instructions (project root)
2. agent_docs/README.md — routing table (FR → service → specs)
3. agent_docs/roadmap.md — Sprint 1 with concrete, ordered tasks
4. Tool-specific configs (.claude/ settings if missing)
5. scripts/check-traceability.sh — traceability validation
6. scripts/check-docs-sync.sh — docs sync validation
7. Health check: verify all FRs have complete traceability chain

Output:
- AGENTS.md (project root)
- agent_docs/README.md — routing table
- agent_docs/roadmap.md — sprint roadmap
- scripts/check-traceability.sh
- scripts/check-docs-sync.sh
- .claude/ (tool-specific settings)"
```

### Gate Review (Phase 10)

```
Agent type: component-validator (or general-purpose agent as reviewer)
Prompt: "Review the AGT output against Phase 10 gate criteria:

Read from:
- AGENTS.md (project root)
- agent_docs/README.md
- agent_docs/roadmap.md
- scripts/

Gate checklist:
1. [ ] AGENTS.md covers all services and workflows
2. [ ] Routing table maps every FR → service → impl spec → test spec
3. [ ] Roadmap Sprint 1 has concrete, ordered, dependency-aware tasks

4. [ ] scripts/check-traceability.sh runs without errors
5. [ ] scripts/check-docs-sync.sh runs without errors
6. [ ] Agent Validation Protocol ready: smoke test plan defined

Report: PASS / FAIL with specific gaps."
```

---

## Completion

After all phases pass gate review:

1. **Create board & backlog via sprint skill:** 

```
Skill: sprint
Description: "Create initial board and backlog from agent_docs/roadmap.md. 
The roadmap defines Sprint 1 with concrete, ordered tasks. 
Create .work/board.md with those tasks as 🔲 Todo and 
.work/backlog.md as a pointer to roadmap.md for full context."
```

2. **Update board via sprint skill:** Mark the corresponding task on `.work/board.md` as ✅ Ready (from 🔲 Todo):

```
Skill: sprint
Description: "Update board task for feature <FR-ID> from 🔲 Todo to ✅ Ready. 
The specs (SRS, HLD, LLD, IMP, TST) are all complete and the feature is ready for Cook implementation."
```

3. **Report to user:**

```
New Feature workflow complete. All phases 05-10 passed gate review.

Output:
  docs/product/SRS.md               - Software Requirements (master)
  docs/product/features/epic-{name}/ - Individual FR specs
  docs/architecture/                 - High-Level Design (human)
  agent_docs/architecture.md         - Architecture (agent)
  agent_docs/domain-service-mapping.yaml
  agent_docs/hard-boundaries.md
  agent_docs/contracts/              - API contracts, events, error codes
  agent_docs/tech-design/            - Per-service LLD
  agent_docs/features/               - Work packages (routing overlays)
  agent_docs/backend/{service}/implementation/  - Implementation specs
  agent_docs/backend/{service}/test-specs/      - Test specs
  agent_docs/README.md               - Routing table
  agent_docs/roadmap.md              - Sprint roadmap
  AGENTS.md                          - Agent instructions (root)
  scripts/                           - Validation scripts

Next: Ready for Phase 11 (Cook/TDD execution).
Use /orchestrate and select "Cook (TDD Loop)" to implement.
```

## Dependency Management

Phases run sequentially because each depends on the previous. If a subagent needs clarification:
1. Forward the question to the user with context about which phase and what's blocked
2. Do NOT guess or fill gaps yourself
3. Once answered, re-delegate to the same subagent type to continue

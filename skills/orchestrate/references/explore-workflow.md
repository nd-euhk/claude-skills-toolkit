# Explore / Reverse Engineer Workflow

Extract documentation from an existing codebase. Generates HLD, LLD, SRS, IMP, and TST by analyzing code, configuration, and infrastructure files.

**Key rule:** NEVER fabricate. Everything must be detected FROM CODE. Write "Not detected in code" when unsure.

## Phase Overview

```
Scout Codebase → Extract HLD → Extract LLD → Extract SRS → Extract IMP → Extract TST → Assess Docs
       ↓            ↓ Gate       ↓ Gate       ↓ Gate       ↓ Gate       ↓ Gate
```

---

## Step 1: Scout Codebase Structure

**CRITICAL SCOPING RULE:** Minimum 1 Explore subagent per project. NEVER assign 1 Explore subagent to scout **more than 1 project**. If the codebase has N projects/services, spawn N Explore subagents (one per project) in parallel. This prevents context overload and ensures thorough per-project reconnaissance.

### Step 1a: Discover Projects (Lightweight Scout)

First, determine how many projects exist. Use a single lightweight Explore agent to list project directories only — no deep analysis:

```
Agent type: Explore
Prompt: "Scan the repository root for project/service directories. Look for:
- Top-level directories with build files (pom.xml, build.gradle, package.json, Cargo.toml, etc.)
- Monorepo packages (packages/*, services/*, apps/*, modules/*)
- Independent deployable units (each with its own Dockerfile or deployment config)
- Multi-module project structure (settings.gradle, parent pom.xml modules)

Report ONLY: list of project/service names and their root paths. Do NOT deep-dive into each project.
This is a lightweight directory scan to determine how many Explore subagents to spawn next."
```

### Step 1b: Deep Scout — One Explore per Project

Based on the project list from Step 1a, spawn **1 Explore subagent per project**. All subagents run in parallel. Never let 1 Explore agent scout more than 1 project:

```
For EACH project discovered in Step 1a, spawn in parallel:

Agent type: Explore
Prompt: "Thoroughly scout ONLY project <project-name> at <project-path>. Do NOT look at any other projects. Find and catalog:

1. PROJECT STRUCTURE:
   - Directory layout (monorepo? multi-module? services?)
   - Build system (gradle/maven/npm/cargo/etc.)
   - Language(s) and frameworks

2. SERVICE BOUNDARIES:
   - Each service/module directory
   - Build files per service (dependencies, plugins)
   - Inter-service communication (REST clients, message queues, gRPC)

3. DATA LAYER:
   - Database migration files (Flyway/Liquibase/etc.)
   - Entity/model files
   - Repository/DAO patterns

4. INFRASTRUCTURE:
   - Docker files (Dockerfile, docker-compose.yaml)
   - K8s manifests (deployment, service, configmap)
   - CI/CD config (.github/workflows/, Jenkinsfile, etc.)

5. CONFIGURATION:
   - application.yml / application.properties / .env files
   - Feature flags, circuit breakers, timeouts

6. API SURFACE:
   - Controller/Handler files
   - OpenAPI/Swagger specs if present
   - GraphQL schemas if present

7. EXISTING DOCS:
   - AGENTS.md, CLAUDE.md, README files
   - docs/ directory (any existing specs: BRD, PRD, SRS, architecture)
   - agent_docs/ directory (architecture.md, contracts, tech-design, features)
   - agent_docs/backend/*/implementation/ (reverse-engineered IMP specs)
   - agent_docs/backend/*/test-specs/ (reverse-engineered TST specs)
   - Architecture Decision Records (docs/architecture/ADRs/)
   - .work/ directory (board, backlog, reports)

8. SPEC-TEST DOCS ASSESSMENT:
   - Does docs/product/SRS.md exist? How complete?
   - Does docs/architecture/ exist? How complete?
   - Does agent_docs/ exist? How complete? (architecture.md, tech-design/, contracts/, features/)
   - Does agent_docs/backend/*/test-specs/ exist?
   - Are existing docs consistent with actual code? (spot check 3 items)

Report everything found with file paths. Flag any existing docs that are out of date or inconsistent."
```

Present scouting report to user. Highlight what docs exist and what's missing.

### Step 1b-split: Per-Project Scouting Rule

**CRITICAL SCOPING RULE:** Minimum 1 Explore subagent per project. NEVER assign 1 Explore subagent to scout **more than 1 project**. If the codebase has N projects/services, refactor the Step 1 delegation into:

1. **Step 1a (Discover):** Lightweight Explore to list project directories only
2. **Step 1b (Deep Scout):** Spawn N Explore subagents in parallel — one per project. Never let 1 Explore agent scout > 1 project.
3. **Step 1c (Root-Level):** One additional Explore for cross-cutting concerns (root docs, shared config)
4. **Step 1d (Merge):** General-purpose agent synthesizes all reports into `.work/reports/scouting-report.md`

The original Step 1 prompt above serves as the template for each per-project Explore agent in Step 1b.

### Step 1c: Root-Level Scout (Cross-Cutting Concerns)

One additional Explore agent for repository-wide artifacts that span all projects. Runs in parallel with Step 1b per-project agents:

```
Agent type: Explore
Prompt: "Scout repository-level (cross-cutting) artifacts only. Do NOT dive into individual projects.
Find and catalog:

1. EXISTING DOCS (root-level only):
   - AGENTS.md, CLAUDE.md, README files at repository root
   - docs/ directory (any existing specs: BRD, PRD, SRS, architecture)
   - agent_docs/ directory (architecture.md, contracts, tech-design, features)
   - agent_docs/backend/*/implementation/
   - agent_docs/backend/*/test-specs/
   - Architecture Decision Records (docs/architecture/ADRs/)
   - .work/ directory (board, backlog, reports)

2. SPEC-TEST DOCS ASSESSMENT:
   - Does docs/product/SRS.md exist? How complete?
   - Does docs/architecture/ exist? How complete?
   - Does agent_docs/ exist? How complete?
   - Does agent_docs/backend/*/test-specs/ exist?
   - Are existing docs consistent with actual code? (spot check 3 items)

3. CROSS-CUTTING CONFIG:
   - Root-level docker-compose, CI/CD, shared configs
   - Repository-wide conventions (editorconfig, linter configs)

Report everything found with file paths. Flag any existing docs that are out of date or inconsistent."
```

### Step 1d: Merge Scout Reports

After all Explore subagents (1a + N×1b + 1c) complete, merge their findings:

```
Agent type: general-purpose
Prompt: "Merge the scouting reports from all Explore subagents into a unified catalog.

Inputs:
- Step 1a: Project list (<N> projects discovered)
- Step 1b: <N> per-project scouting reports  
- Step 1c: 1 root-level cross-cutting report

Produce a consolidated scouting report organized by project, with a cross-cutting section at the top.
Flag any discrepancies between project-level and root-level findings.

Output to: .work/reports/scouting-report.md"
```

---

## Step 2: Assess & Plan Documentation

Based on scouting, use AskUserQuestion to determine scope:

Ask: "What documentation should be generated from the codebase?" (header: "Doc Scope")
Options:
- "Full pipeline: HLD + LLD + SRS + IMP + TST" (complete reverse-engineering)
- "Architecture only: HLD + LLD" (architecture and service design)
- "Spec generation: HLD + LLD + SRS + IMP + TST — no architecture docs" (specs from code, skipping architecture narratives)
- "Fill gaps: supplement existing docs" (only what's missing or outdated)

If existing spec-test docs exist but are outdated/incomplete, prioritize updating them over creating from scratch.

---

## Step 3: Extract High-Level Design (HLD)

Delegate to hld-architect (or Explore + general-purpose for analysis):

```
Agent type: hld-architect
Prompt: "Reverse-engineer the High-Level Design from this codebase.

Based on the scouting report, produce a 10-section HLD:

1. Architecture Style (detected from code patterns: microservices? modular monolith? layered?)
2. C4 Level 1: System Context Diagram (external systems detected from REST clients, configs)
3. C4 Level 2: Container Diagram (services/modules detected from directory structure)
4. Communication Patterns (sync REST, async events, message queues — detected from code)
5. Data Ownership (which service owns which data — detected from entities + migrations)
6. Security Architecture (auth mechanism, token handling — detected from security config)
7. Infrastructure (deployment model — detected from Docker/K8s files)
8. Architecture Decision Records (one ADR per discovered decision)
9. Hard Boundaries (what each service OWNS vs REFERENCES — detected from imports)
10. Agent Architecture Summary (agent_docs/architecture.md for agent consumption)

Templates available at skills/orchestrate/templates/hld/

CRITICAL RULES:
- Everything must be DETECTED FROM CODE — cite file paths as evidence
- If something is unclear, write 'Not detected in code' — NEVER guess
- Anti-patterns found MUST be marked with ALERT markers
- Gaps in documentation must be marked with TODO

Output:
- docs/architecture/system-architecture.md — C4 diagrams + architecture narrative
- docs/architecture/ADRs/ADR-{NNN}-{decision}.md — detected architectural decisions
- docs/architecture/diagrams/{name}.mermaid — diagram source files
- agent_docs/architecture.md — agent-facing architecture summary
- agent_docs/domain-service-mapping.yaml — bounded context → service mapping
- agent_docs/hard-boundaries.md — ownership & reference rules
- agent_docs/contracts/events.md — event taxonomy (if events detected)
- agent_docs/contracts/api-conventions.md — API conventions (if patterns detected)"
```

### Gate Review (HLD)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered HLD:

Read from:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md

Gate checklist:
1. [ ] Every claim has a code reference (file path)
2. [ ] No fabricated information (check 3 random claims against actual code)
3. [ ] ALERT markers on detected anti-patterns
4. [ ] TODO markers on information gaps
5. [ ] C4 diagrams are consistent with code structure
6. [ ] Data ownership matrix matches entity locations
7. [ ] All external systems in C4 Level 1 are actually referenced in code

Report: PASS / FAIL with specific issues."
```

---

## Step 4: Extract Low-Level Design (LLD) Per Service

For each service detected in scouting, delegate to lld-designer:

```
Agent type: lld-designer
Prompt: "Reverse-engineer the Low-Level Design for service: <service-name>.

Based on the scouting report and extracted HLD, produce a 10-section LLD:

1. Service Boundary (what this service owns, from package structure)
2. Internal Architecture (controllers → services → repositories, from code)
3. Domain Model (entities, value objects, aggregates — from entity classes)
4. API Surface (endpoints — from controller annotations/handlers)
5. REST Clients (external calls — from client classes/proxies)
6. Transaction Boundaries (from @Transactional or equivalent)
7. Integration Points (message handlers, event listeners)
8. Caching Strategy (from @Cacheable annotations or cache config)
9. Performance & Scale (connection pools, timeouts — from config)
10. Error Flows & Degraded Mode (from exception handlers, circuit breakers, retry config)

Rules:
- LLD file name must match codebase directory structure 1:1 ({service-name}-service.md)
- Mark everything you CAN'T detect as 'TODO: Not detected in code'
- Reference specific files and line numbers

Templates available at skills/orchestrate/templates/lld/

Output to: agent_docs/tech-design/{service-name}-service.md"
```

Repeat for each service. Independent services can be parallelized:

```
For each independent service:
  Agent type: lld-designer
  Prompt: "Reverse-engineer LLD for service <name>..."
  (Run in background for parallelism)
```

### Gate Review (LLD)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered LLD for service <name>:

Read from:
- agent_docs/tech-design/{service-name}-service.md

Gate checklist:
1. [ ] All 10 sections present (even if some are TODO)
2. [ ] File name matches codebase directory structure
3. [ ] API endpoints match controller code (spot check 3 endpoints)
4. [ ] Domain model reflects actual entity classes
5. [ ] Error handling patterns detected from actual exception handlers
6. [ ] TODO markers are honest (not hiding gaps as filled sections)

Report: PASS / FAIL with specific issues."
```

---

## Step 5: Extract Software Requirements (SRS) from Code

SRS extraction IS mandatory. Delegate to srs-specifier:

```
Agent type: srs-specifier
Prompt: "Reverse-engineer Software Requirements from this codebase.

Based on HLD and LLD, extract functional requirements.

Read from:
- docs/architecture/ (if generated)
- agent_docs/architecture.md
- agent_docs/tech-design/
- agent_docs/contracts/

Templates available at skills/orchestrate/templates/srs/

CRITICAL RULES:
- Each feature (login, registration, password-reset, etc.) MUST be a SEPARATE FR file — NEVER group multiple features into one "authentication" FR
- Use correct FR naming convention: FR-{DOMAIN}-{NNN}--{slug}.md
- Example: FR-AUTH-001--user-login.md, FR-AUTH-002--user-registration.md, FR-AUTH-003--password-reset.md
- DOMAIN is short uppercase code (AUTH, PAY, INV, etc.)
- NNN is 3-digit zero-padded sequential number
- slug is lowercase-hyphenated feature name

For each API endpoint / feature detected:
1. Infer the FR from what the code does (NOT what it should do)
2. Write Gherkin Scenario Outline (reconstruct from code paths)
3. Note: 'Reverse-engineered from: <file paths>'
4. Mark inferred requirements as: 'STATUS: Reverse-engineered - needs business validation'

CRITICAL: These are DETECTED requirements, not designed ones. Business stakeholders must validate.
Mark all as 'NEEDS VALIDATION'.

Output:
- docs/product/SRS.md — master SRS (reverse-engineered)
- docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md — one file per detected feature
- agent_docs/traceability/requirements-matrix.md — traceability matrix (reverse-engineered)"
```

### Gate Review (SRS)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered SRS:

Read from:
- docs/product/SRS.md
- docs/product/features/epic-{name}/FR-*.md
- agent_docs/traceability/requirements-matrix.md

Gate checklist:
1. [ ] Every FR has Gherkin Scenario Outline + data-driven Examples
2. [ ] >= 3 error/edge cases per FR
3. [ ] All NFRs have concrete numbers
4. [ ] Traceability matrix: every FR → business objective
5. [ ] NO Phase 06/07 leaks
6. [ ] Concurrency scenarios covered
7. [ ] Idempotency expectations stated
Plus reverse-engineering specific:
8. [ ] Every FR cites the code files it was extracted from
9. [ ] All FRs marked 'NEEDS VALIDATION'

Report: PASS / FAIL with specific issues."
```

---

## Step 6: Extract Implementation Specifications (IMP) Per Feature

For each FR extracted in Step 5, reverse-engineer the implementation spec from actual code:

```
Agent type: imp-specifier
Prompt: "Reverse-engineer the Implementation Specification for feature: <FR-ID>.

Based on:
- FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (from Step 5)
- HLD: agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml (from Step 3)
- LLD: agent_docs/tech-design/{service-name}-service.md (from Step 4)
- Actual code: <path to service source code detected in Step 1>

For each feature, produce a 10-section lean spec by reading actual code:

1. Purpose — what the code does (from behavior, not documentation)
2. References — links to FR, HLD, LLD
3. Affected Areas — actual files touched (from code structure)
4. Execution Flow — step-by-step reconstructed from code paths (NOT code snippets)
5. Business Rules Realized — rules detected in code (validation, constraints, invariants)
6. Data & State Impact — entities read/written (from entity classes, repositories)
7. Error Mapping — error handling detected in code (exception handlers, error responses)
8. Security & Authorization — authZ patterns detected (annotations, middleware, guards)
9. Implementation Notes — detected gotchas, ordering, dependencies between components
10. Acceptance Checklist — testable items derived from actual behavior

CRITICAL RULES:
- NO code snippets, import statements, or package paths in the spec
- Everything must be DETECTED FROM CODE — cite file paths and line numbers as evidence
- If something is unclear from code, write 'Not clearly detectable in code'
- Decision-rich: explain WHY the code does what it does (from code patterns), not just WHAT

Templates available at skills/orchestrate/templates/impl/

Output:
- agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md — per feature
- agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md — if frontend detected
- agent_docs/backend/conventions.md — detected backend conventions
- agent_docs/frontend/conventions.md — detected frontend conventions"
```

### Gate Review (IMP)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered IMP specs for feature <FR-ID>:

Read from:
- agent_docs/backend/{service-name}/implementation/FR-*-impl.md
- agent_docs/frontend/{app-name}/implementation/FR-*-impl.md

Gate checklist:
1. [ ] All 10 sections present per feature
2. [ ] NO code, imports, or package paths in any spec
3. [ ] Every claim has a code reference (file path + line number)
4. [ ] Execution flow matches actual code behavior (spot check 3 paths against source)
5. [ ] Error mapping covers all detected error handlers
6. [ ] Security section reflects actual authZ patterns in code
7. [ ] Feature dependencies noted (must implement X before Y)
8. [ ] All specs marked 'Reverse-engineered — needs business validation'

Report: PASS / FAIL with specific issues."
```

---

## Step 7: Extract Test Specifications (TST) From Existing Tests

Reverse-engineer test specs from existing test code and Gherkin scenarios:

```
Agent type: tst-specifier
Prompt: "Reverse-engineer Test Specifications for feature: <FR-ID>.

Read from:
- FR spec: docs/product/features/epic-{name}/FR-{DOMAIN}-{NNN}--{slug}.md (Gherkin scenarios from Step 5)
- API contracts: agent_docs/contracts/api-{domain}.yaml
- Existing test code: <detected test directories from Step 1>

For each feature, reverse-engineer tests at these layers:
1. Unit tests — from existing *Test.java, *_test.go, *.test.ts files
2. Controller tests — from @WebMvcTest, MockMvc, supertest patterns
3. Repository tests — from @DataJpaTest, @DataMongoTest patterns
4. Client tests — from WireMock, MockServer, nock patterns
5. Integration tests — from @SpringBootTest, TestContainers patterns
6. Architecture tests — from ArchUnit, dependency-check patterns
7. Performance tests — from k6, JMeter, artillery patterns

Each test spec must include:
- What to test (specific scenario from FR Gherkin)
- What test already exists (file path + line numbers)
- What's covered and what's MISSING (gap analysis)
- Test data / fixtures used (from actual test fixtures)
- Expected result (from actual assertions in test code)

CRITICAL RULES:
- NEVER read agent_docs/backend/*/implementation/ or agent_docs/frontend/*/implementation/ (context isolation)
- If no existing tests found, write 'GAP: No tests detected for this scenario'
- Mark all specs: 'Reverse-engineered from existing tests — needs validation'

SUPPLEMENTING GAPS (MANDATORY):
After gap analysis, for EVERY scenario where existing tests are MISSING or INSUFFICIENT:
1. Flag the gap with: 'GAP: <scenario> — no existing test coverage detected'
2. GENERATE the missing test spec using the standard TST template:
   - What to test (from FR Gherkin scenario)
   - Layer (unit, controller, repository, client, integration, architecture, perf)
   - Test data / fixtures needed
   - Expected result
   - WireMock/Stub specs if external calls involved
3. Mark generated specs: 'STATUS: Generated — needs implementation (no existing test found)'
4. Add a coverage summary per FR: X/Y Gherkin scenarios have test coverage (Y-X gaps supplemented)

Example: If FR-AUTH-001--user-login.md has 4 Gherkin scenarios but only 2 have existing tests,
generate test specs for the 2 missing scenarios. The output file will contain:
- 2 test specs reverse-engineered from existing tests (marked 'Reverse-engineered')
- 2 test specs generated for missing coverage (marked 'Generated — needs implementation')
- Coverage summary: 2/4 scenarios covered, 2 gaps supplemented

Templates available at skills/orchestrate/templates/tst/

Output:
- agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md — per feature (existing + supplemented)
- agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md — if frontend tests exist
- agent_docs/performance/README.md — detected performance test setup
- agent_docs/performance/nfr-mapping.md — NFR to test mapping
- agent_docs/performance/baseline.md — detected performance baselines"
```

### Gate Review (TST)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered TST specs for feature <FR-ID>:

Read from:
- agent_docs/backend/{service-name}/test-specs/FR-*-test.md
- agent_docs/frontend/{app-name}/test-specs/FR-*-test.md
- agent_docs/performance/

Gate checklist:
1. [ ] All 7 test layers addressed where existing tests found
2. [ ] Gap analysis: missing tests explicitly marked with 'GAP:' markers
3. [ ] Missing scenarios SUPPLEMENTED: new test specs generated for every detected gap (not just flagged)
4. [ ] Each test (existing + generated) references the specific Gherkin scenario it validates
5. [ ] Test data/fixtures match actual test code (spot check 3 existing)
6. [ ] Generated test specs are complete (what, layer, data, expected result, WireMock if needed)
7. [ ] WireMock/Stub specs reflect actual stub configurations
8. [ ] Context isolation maintained: no impl spec references
9. [ ] Coverage summary present per FR: X/Y scenarios covered, Z gaps supplemented

Report: PASS / FAIL with specific issues."
```

---

## Step 8: Spec-Test Documentation Assessment

After extraction, assess the documentation coverage:

```
Agent type: component-validator (or general-purpose)
Prompt: "Assess the documentation health of this codebase after reverse engineering.

Check:
1. Coverage: what % of services have LLD? What % of FRs are documented?
2. Consistency: spot check 5 claims in docs against actual code
3. Freshness: are docs marked with extraction date? Are they older than the last code change?
4. Completeness: which sections are TODO vs filled?
5. Gaps: what's still missing?

Generate a documentation health report at .work/reports/doc-health.md with:
- Coverage score (%)
- Consistency score (matches/mismatches)
- Freshness check
- Gap list: what still needs to be documented
- Recommendation: what to tackle next

Output to: .work/reports/doc-health.md"
```

---

## Completion

Report:

```
Explore/Reverse Engineer workflow complete.

Generated:
  docs/architecture/                          - High-Level Design (reverse-engineered)
  agent_docs/architecture.md                 - Agent architecture summary
  agent_docs/domain-service-mapping.yaml     - Service mapping
  agent_docs/hard-boundaries.md              - Ownership boundaries
  agent_docs/contracts/                      - Events, API conventions
  agent_docs/tech-design/{name}-service.md   - Low-Level Design per service (<N> services)
  docs/product/SRS.md                        - Software Requirements (reverse-engineered)
  docs/product/features/epic-{name}/         - Individual FR specs (one per feature)
  agent_docs/traceability/requirements-matrix.md - Traceability matrix
  agent_docs/backend/{service}/implementation/  - Implementation Specs (reverse-engineered)
  agent_docs/backend/{service}/test-specs/      - Test Specs (reverse-engineered from existing tests)
  agent_docs/performance/                       - Performance test baseline

Documentation Health: .work/reports/doc-health.md
  Coverage: <percentage>
  TODO items: <count>
  ALERT items: <count>

Next Steps:
1. Business stakeholders validate reverse-engineered SRS (if generated)
2. Address TODO markers with manual investigation
3. Resolve ALERT anti-patterns
4. Run /orchestrate "New Feature" for any gaps that need forward engineering
```

---

## Key Principles for Reverse Engineering

1. **Evidence over intuition** — Every claim backed by a file path
2. **Honesty over completeness** — "Not detected in code" is better than a guess
3. **ALERT over silence** — Anti-patterns must be flagged, not quietly documented
4. **Freshness matters** — Docs must note extraction date; stale docs are worse than no docs
5. **Don't impose** — Reverse engineering describes what IS, not what SHOULD BE
6. **One FR per feature** — Each detected feature (login, register, reset) gets its own FR file. Never group unrelated functionality into one file.
7. **Specs from code** — IMP and TST are reverse-engineered from actual source and test code, not generated from requirements. Every claim must cite a source file and line number.

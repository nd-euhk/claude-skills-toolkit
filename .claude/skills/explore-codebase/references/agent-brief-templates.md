# Agent Brief Templates

Self-contained brief templates for each agent type used in the explore-codebase pipeline. Copy and fill in placeholders.

## Explore Agent

```
Explore the sub-project at {path}. Return findings in plain text covering:

1. Technologies used:
   - Primary language(s) and version(s)
   - Frameworks and libraries
   - Database systems
   - Message queues / event systems
   - Infrastructure tools (Docker, K8s, etc.)

2. Main directory structure:
   - Top-level directories and their purpose
   - Key configuration files and their role
   - Build/test/CI configuration locations

3. Key modules/packages:
   - Each module's name and primary responsibility
   - How modules relate to each other (dependencies, call patterns)
   - Which modules are core vs. utility/support

4. Entry points:
   - Application entry point(s) (main files, bootstrap)
   - API route registrations (REST endpoints, GraphQL schemas, gRPC services)
   - Configuration loading mechanisms
   - CLI command definitions if applicable

5. Dependencies:
   - Internal: cross-module dependencies within the project
   - External: key third-party packages and their purposes
   - Shared libraries or common utilities

6. Architectural patterns:
   - High-level architecture style (layered, hexagonal, microservices, CQRS, event-driven, etc.)
   - Design patterns observed (repository, factory, adapter, etc.)
   - Data flow patterns (sync vs async, request-response vs event-driven)
```

## SRS Agent

```
Write a Software Requirements Specification based on the scout report at {scout_report_path}.

Output: {output_path}

Include:
1. Functional Requirements with Gherkin Scenario Outlines:
   - Feature: {feature_name}
     As a {role}
     I want to {action}
     So that {benefit}

     Scenario Outline: {scenario_name}
       Given {precondition}
       When {action}
       Then {expected_result}

     Examples:
       | param1 | param2 | expected |
       | ...    | ...    | ...      |

2. Non-Functional Requirements with quantified thresholds:
   - Performance: response time < Xms at p95, throughput > Y req/s
   - Availability: uptime > 99.X%, recovery time < Z min
   - Security: authentication, authorization, data encryption requirements
   - Scalability: horizontal/vertical scaling targets

3. Traceability Matrix:
   - Map each functional requirement back to discovered modules
   - Map NFRs to architectural components

4. Constraints and Assumptions:
   - Technical constraints observed from scout report
   - Assumptions made where information was incomplete
```

## HLD Agent

```
Design system architecture based on the SRS at {srs_path} and scout report at {scout_report_path}.

Output: {output_path}

Include:
1. C4 Container Diagram (described in text/ASCII):
   - System context: external users, systems, and their interactions
   - Containers: applications, data stores, message buses
   - Relationships: data flow and communication patterns between containers

2. Architecture Decision Records (ADR format):
   For each key architectural decision:
   - Title: Short noun phrase
   - Status: Proposed | Accepted | Deprecated
   - Context: What is the issue we're addressing?
   - Decision: What is the decision?
   - Consequences: What becomes easier, harder, or different?

3. Bounded Context Mapping:
   - Identify domain boundaries
   - Map relationships between contexts (shared kernel, customer-supplier, etc.)
   - Define communication patterns between contexts (sync REST, async events, etc.)

4. Service Decomposition:
   - List each service/container with its primary responsibility
   - Data ownership per service
   - API contracts between services

5. Event Taxonomy (if applicable):
   - Domain events, integration events
   - Event channels/topics
   - Publishing and subscription rules

6. Cross-Cutting Concerns:
   - Authentication/authorization approach
   - Logging and monitoring strategy
   - Error handling patterns across services
```

## LLD Agent

```
Produce per-service technical design based on the HLD at {hld_path}.

Output: {output_path}

For each service identified in the HLD, include these 9 sections:

1. Service Overview:
   - Name, purpose, bounded context
   - Technology stack (language, framework, database)

2. Domain Model:
   - Entities, value objects, aggregates
   - Relationships and cardinality
   - State diagrams for key aggregates

3. API Design:
   - REST endpoints / gRPC methods / GraphQL schema
   - Request/response schemas with types
   - Error codes and response formats
   - Authentication requirements per endpoint

4. Data Store Design:
   - Schema design (tables, collections, indexes)
   - Migration strategy
   - Data access patterns (read/write ratio, query patterns)

5. Transaction Boundaries:
   - Unit of work scope
   - Saga patterns for distributed transactions
   - Idempotency guarantees

6. Caching Strategy:
   - What to cache, TTLs, invalidation rules
   - Cache layer placement (application, distributed)

7. Error Handling and Degraded Modes:
   - Error classification (retryable, non-retryable)
   - Circuit breaker configurations
   - Fallback behaviors and degraded responses

8. Configuration:
   - Environment variables and their defaults
   - Feature flags
   - Runtime configuration sources

9. Work Packages:
   - For each functional requirement from SRS: a work package describing implementation approach, affected components, and dependencies on other packages
```

## IMP Agent

```
Write implementation specifications based on the LLD at {lld_path}.

Output: {output_path}

For each feature/work package from the LLD, include:

1. Execution Flow:
   - Step-by-step code path from entry point to response
   - Conditional branches and their conditions
   - Error paths and exception flows

2. Business Rules:
   - Validation rules with exact conditions
   - Authorization rules (who can do what)
   - Data transformation rules (input → output mappings)

3. Data Impact:
   - Database operations (insert, update, delete, select) with affected tables/collections
   - Cache operations (read, write, invalidate)
   - Event publishing (topic, payload schema)

4. Error Mapping:
   - Exception type → HTTP status code / error code
   - Error messages (user-facing and internal)
   - Logging requirements (level, context fields)

5. Security Considerations:
   - Input validation points
   - Authentication and authorization checks
   - Data sanitization requirements
   - Rate limiting considerations
```

## TST Agent

```
Write test specifications based on the IMP at {imp_path} and LLD at {lld_path}.

Output: {output_path}

Include concrete test cases for:

1. Unit Tests:
   - Test case name, class/function under test
   - Input values and expected output
   - Mock/stub dependencies and their behavior
   - Edge cases and boundary conditions

2. Integration Tests:
   - API endpoint tests with request/response assertions
   - Database integration tests (Testcontainers where applicable)
   - Message queue integration tests
   - External service mocking (WireMock patterns)

3. End-to-End Tests:
   - User journey scenarios
   - Setup prerequisites (data fixtures)
   - Assertions on final state

4. Performance Tests:
   - Load test scenarios (concurrent users, request rate)
   - Performance thresholds (response time, throughput)
   - Stress test boundaries

5. Test Fixtures and Mock Definitions:
   - Shared test data factories
   - Mock server configurations
   - Test database seeding scripts
```

## Gate Verifier Agent

```
Verify the artifact at {artifact_path} of type {srs|hld|lld|imp|tst}.

Check quality criteria for this artifact type:
- Completeness: all required sections present
- Consistency: internal coherence, no contradictions
- Traceability: references to prior phase artifacts are valid
- Specification quality: concrete, testable, quantified (not vague)
- Format compliance: matches expected output structure

Return: PASS with summary of findings, or REJECT with specific, actionable reasons.
```

## General-Purpose Agent (Scout Report Writer)

```
Based on the Agent(Explore) output for sub-project {name}, write a scout report to:
.work/reports/explore-YYYYMMDD--{slug}/scout-{project-name}--{slug}.md

Organize into sections:
## {Project Name} — Scout Report

### Overview
Brief summary of the sub-project's purpose and role in the overall system.

### Technologies
Table of technologies with columns: Category | Technology | Version | Purpose

### Directory Structure
```
project/
├── src/
│   ├── module-a/   — Responsibility
│   └── module-b/   — Responsibility
├── config/         — Configuration files
└── tests/          — Test suites
```

### Modules and Responsibilities
For each module: name, primary responsibility, dependencies, public API surface.

### Entry Points
List all entry points with file paths and what triggers them (HTTP, CLI, cron, queue).

### Dependencies
Two tables:
- Internal Dependencies: module → depends_on → relationship
- External Dependencies: package | version | purpose

### Architectural Patterns
Document observed patterns with evidence from code structure.

If the target file already exists, back it up as .bak before overwriting.
```

## General-Purpose Agent (Plan Writer)

```
Write the execution plan to: .work/plans/explore-YYYYMMDD--{slug}.md

Based on the plan approved by the human during plan mode.

Structure:
# Exploration Plan: {project_name}

## Date
YYYY-MM-DD

## Mode
{full|architect|sync}

## Scope
- Sub-projects to analyze: {list}
- Sub-projects to skip: {list with reasons}

## Execution Order
For multi-subproject: priority order and rationale.

## Phase Plan
| Phase | Sub-project | Expected Output | Dependencies |
|-------|------------|-----------------|--------------|
| Scout | ... | ... | ... |
| SRS   | ... | ... | ... |
| HLD   | ... | ... | ... |
| LLD   | ... | ... | ... |
| IMP   | ... | ... | ... |
| TST   | ... | ... | ... |

## Risks and Mitigations
- Risk: description → Mitigation: approach

## Decisions Made
- Decision 1 with rationale
- Decision 2 with rationale
```

## General-Purpose Agent (Summary Writer)

```
Consolidate codebase exploration findings from these artifacts under {SANDBOX}/ (single project)
or {SANDBOX_ROOT}/merged/ (multi-subproject):
- Scout reports: {SANDBOX}/../scout-*.md
- SRS: {SANDBOX}/docs/product/SRS.md
- HLD: {SANDBOX}/docs/architecture/
- LLD: {SANDBOX}/agent_docs/tech-design/
- IMP: {SANDBOX}/agent_docs/backend/*/implementation/
- TST: {SANDBOX}/agent_docs/backend/*/test-specs/

Write to: .work/reports/explore-YYYYMMDD--{slug}.md

Report structure:
# Codebase Exploration Report: {project_name}

## 1. Project Overview
Brief summary of the project, its purpose, and the sub-projects discovered.
Include a diagram or list showing how sub-projects relate.

## 2. System Architecture
Summary from HLD — include C4 context diagram, key ADRs, service topology.

## 3. Functional Requirements
Summary table from SRS — feature name, key scenarios, NFR thresholds.

## 4. Technical Design
Summary from LLD — per-service highlights, data model overview, API surface summary.

## 5. Implementation Specifications
Summary from IMP — execution flow highlights, key business rules.

## 6. Test Strategy
Summary from TST — test coverage matrix, key test scenarios.

## 7. Sprint Artifacts Status
- Roadmap: {created|updated|verified} — link
- Backlog: {created|updated|verified} — link
- Board: {created|updated|verified} — link

## 8. Risks and Recommendations
- Risk 1: {description} → Recommendation: {action}
- Risk 2: ...

## 9. Detailed Artifacts
Links to each artifact:
- [Scout Reports](path/)
- [SRS](path/srs--{slug}.md)
- [HLD](path/hld--{slug}.md)
- [LLD](path/lld--{slug}.md)
- [IMP](path/imp--{slug}.md)
- [TST](path/tst--{slug}.md)
```

## Merge: SRS Agent

```
Reverse-engineering mode. Merge all per-project SRS artifacts into a unified cross-project SRS.

Input (all per-project SRS outputs):
  {SANDBOX_ROOT}/{project-1}/docs/product/SRS.md
  {SANDBOX_ROOT}/{project-1}/docs/product/features/epic-*/FR-*.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/traceability/requirements-matrix.md
  {SANDBOX_ROOT}/{project-2}/docs/product/SRS.md
  {SANDBOX_ROOT}/{project-2}/docs/product/features/epic-*/FR-*.md
  {SANDBOX_ROOT}/{project-2}/agent_docs/traceability/requirements-matrix.md
  ... (all projects)

Output (under {SANDBOX_ROOT}/merged/):
  - docs/product/SRS.md                                  ← MERGE nội dung (singular)
  - docs/product/features/epic-{domain}/FR-*.md          ← COPY nguyên file (per-entity)
  - agent_docs/traceability/requirements-matrix.md        ← MERGE nội dung (singular)

Requirements:
- SRS.md: consolidate all FRs, NFRs, scope from every project into one document
- requirements-matrix.md: merge all project matrices, add project column for attribution
- FR-*.md: mỗi feature file duy nhất cho 1 project — copy as-is
- Merge NFRs: take the strictest value, document which project drove each threshold
```

## Merge: HLD Agent

```
Reverse-engineering mode. Merge all per-project HLD artifacts into a unified cross-project HLD.

Input (all per-project HLD outputs):
  {SANDBOX_ROOT}/{project-1}/docs/architecture/*
  {SANDBOX_ROOT}/{project-1}/agent_docs/architecture.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/domain-service-mapping.yaml
  {SANDBOX_ROOT}/{project-1}/agent_docs/hard-boundaries.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/contracts/*
  {SANDBOX_ROOT}/{project-2}/docs/architecture/*
  ... (all projects)

Output (under {SANDBOX_ROOT}/merged/):
  - docs/architecture/system-architecture.md               ← MERGE nội dung (singular)
  - docs/architecture/diagrams/*.mermaid                   ← MERGE nội dung (singular)
  - agent_docs/architecture.md                              ← MERGE nội dung (singular)
  - agent_docs/domain-service-mapping.yaml                  ← MERGE nội dung (singular)
  - agent_docs/hard-boundaries.md                           ← MERGE nội dung (singular)
  - agent_docs/contracts/api-conventions.md                 ← MERGE nội dung (singular)
  - agent_docs/contracts/events.md                          ← MERGE nội dung (singular)
  - docs/architecture/ADRs/ADR-{NNN}-*.md                  ← COPY file, đánh lại NNN nếu trùng

Requirements:
- Singular files: merge service topologies, API conventions, event taxonomy từ tất cả project
- ADRs: copy từ mỗi project, renumber NNN if collision. Flag conflicting ADR decisions for human review
```

## Merge: LLD Agent

```
Reverse-engineering mode. Merge all per-project LLD artifacts into a unified cross-project LLD.

Input (all per-project LLD outputs):
  {SANDBOX_ROOT}/{project-1}/agent_docs/tech-design/*
  {SANDBOX_ROOT}/{project-1}/agent_docs/contracts/api-*.yaml
  {SANDBOX_ROOT}/{project-1}/agent_docs/features/FR-*.md
  {SANDBOX_ROOT}/{project-2}/agent_docs/tech-design/*
  ... (all projects)

Output (under {SANDBOX_ROOT}/merged/):
  - agent_docs/tech-design/{service-name}-service.md     ← COPY file (per-service, unique)
  - agent_docs/tech-design/cross-cutting.md              ← MERGE nội dung (singular)
  - agent_docs/contracts/api-{domain}.yaml               ← COPY file (per-domain, unique)
  - agent_docs/features/FR-*.md                          ← COPY file (per-FR, unique)

Requirements:
- {service}-service.md, api-{domain}.yaml, FR-*.md: tất cả per-entity → copy nguyên file
- cross-cutting.md: tổng hợp shared concerns từ tất cả project
- Nếu trùng tên service giữa các project → thêm project prefix
```

## Merge: IMP Agent

```
Reverse-engineering mode. Merge all per-project IMP artifacts into a unified cross-project IMP.

Input (all per-project IMP outputs):
  {SANDBOX_ROOT}/{project-1}/agent_docs/backend/*/implementation/FR-*-impl.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/frontend/*/implementation/FR-*-impl.md
  {SANDBOX_ROOT}/{project-2}/agent_docs/backend/*/implementation/FR-*-impl.md
  ... (all projects)

Output (under {SANDBOX_ROOT}/merged/):
  - agent_docs/backend/{service}/implementation/FR-*-impl.md   ← COPY file (per-FR, unique)
  - agent_docs/frontend/{app}/implementation/FR-*-impl.md      ← COPY file (per-FR, unique)

Requirements:
- Toàn bộ là per-FR → copy nguyên file, tổ chức theo service/app giữ nguyên cấu trúc
```

## Merge: TST Agent

```
Reverse-engineering mode. Merge all per-project TST artifacts into a unified cross-project TST.

Input (all per-project TST outputs):
  {SANDBOX_ROOT}/{project-1}/agent_docs/backend/*/test-specs/FR-*-test.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/frontend/*/test-specs/FR-*-test.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/performance/*
  {SANDBOX_ROOT}/{project-2}/agent_docs/backend/*/test-specs/FR-*-test.md
  ... (all projects)

Output (under {SANDBOX_ROOT}/merged/):
  - agent_docs/backend/{service}/test-specs/FR-*-test.md      ← COPY file (per-FR, unique)
  - agent_docs/frontend/{app}/test-specs/FR-*-test.md         ← COPY file (per-FR, unique)
  - agent_docs/performance/nfr-mapping.md                     ← MERGE nội dung (singular)
  - agent_docs/performance/baseline.md                        ← MERGE nội dung (singular)

Requirements:
- FR-*-test.md: tất cả per-FR → copy nguyên file
- nfr-mapping.md + baseline.md: merge nội dung, strictest threshold, ghi rõ project drive
```

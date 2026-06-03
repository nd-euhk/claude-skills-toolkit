# Report Templates

Templates for all report types produced during codebase exploration.

## Scout Report

**As of v3.0.0**, scout reports are produced by the scout skill (`Skill(scout)`) which spawns Agent(Explore) subagents internally. The orchestrator invokes the scout skill per sub-project; results land in `.work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md`. This template serves as the expected format specification passed to the scout skill via its search-target argument.

```markdown
# {Project Name} — Scout Report

**Date:** YYYY-MM-DD
**Source:** Scout skill analysis of {path}
**Repomix snapshot:** .work/repomix/{project-name}--{slug}.xml

## Overview

{2-3 sentence summary of the sub-project's purpose, role, and key characteristics.}

## Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | {lang} | {version} | Primary development language |
| Framework | {framework} | {version} | Web/application framework |
| Database | {db} | {version} | Primary data store |
| ... | ... | ... | ... |

## Directory Structure

```
project/
├── src/
│   ├── domain/       — Domain models and business logic
│   ├── application/  — Application services and use cases
│   ├── infrastructure/ — External adapters (DB, HTTP, messaging)
│   └── interfaces/   — API controllers, CLI commands
├── config/           — Environment-specific configuration
├── migrations/       — Database migration files
└── tests/            — Test suites (unit, integration, E2E)
```

## Modules and Responsibilities

### Module: {module_name}
- **Responsibility:** {what it does}
- **Dependencies:** {other modules it depends on}
- **Public API:** {key interfaces, classes, or functions exposed}

{Repeat for each module}

## Entry Points

| Entry Point | Type | Path | Description |
|------------|------|------|-------------|
| HTTP API | REST | `src/interfaces/http/` | Main API on port {N} |
| CLI | Console | `src/cli/main.ts` | Admin commands |
| Worker | Queue | `src/workers/` | Background job processor |

## Dependencies

### Internal Dependencies
| Module | Depends On | Relationship |
|--------|-----------|-------------|
| application | domain | Uses domain entities and services |
| infrastructure | domain | Implements domain interfaces |

### External Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| {package} | {version} | {purpose} |

## Architectural Patterns

### Observed Patterns
- **{pattern_name}:** {evidence from code structure}

### Architecture Style
{layered | hexagonal | microservices | CQRS | event-driven | modular monolith}

### Data Flow
{description of how data moves through the system}
```

## Plan File

Written by Agent(general-purpose) after plan mode approval.

```markdown
# Exploration Plan: {project_name}

**Date:** YYYY-MM-DD
**Mode:** {full | architect | sync}
**Auto:** {true | false}

## Scope

### Sub-projects to Analyze
| # | Name | Path | Priority | Reason |
|---|------|------|----------|--------|
| 1 | {name} | {path} | High | Core service |
| 2 | {name} | {path} | Medium | Support service |

### Sub-projects to Skip
| Name | Path | Reason |
|------|------|--------|
| {name} | {path} | {reason for skipping} |

## Execution Order

{For multi-subproject: explain priority order.}

## Phase Plan

| Phase | Expected Output | Depends On |
|-------|-----------------|------------|
| Scout | `scout-*--{slug}.md` | — |
| SRS | SRS artifacts | Scout |
| HLD | HLD artifacts | SRS |
| LLD | LLD artifacts | HLD |
| IMP | IMP artifacts | LLD |
| TST | TST artifacts | LLD, IMP |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| {description} | Low/Med/High | Low/Med/High | {mitigation approach} |

## Decisions Made

1. **{decision title}:** {what was decided and why}
2. **{decision title}:** {what was decided and why}
```

## Summary Report

Written by Agent(general-purpose) as the final deliverable.

```markdown
# Codebase Exploration Report: {project_name}

**Date:** YYYY-MM-DD
**Mode:** {full | architect | sync}
**Sub-projects analyzed:** {count}

## 1. Project Overview

{2-3 paragraphs summarizing the project, its purpose, and high-level structure.}

### Sub-Project Topology

```
┌─────────────────┐     ┌─────────────────┐
│  {sub-project A}  │────▶│  {sub-project B}  │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  {sub-project C}  │
└─────────────────┘
```

## 2. System Architecture

### C4 Context
{System context summary from HLD — external actors, system boundaries, key interactions}

### Key Architecture Decisions
| ADR | Status | Summary |
|-----|--------|---------|
| {title} | Accepted | {one-line summary} |

### Service Topology
{List of services with their relationships, data ownership, and communication patterns}

## 3. Functional Requirements

| # | Feature | Key Scenarios | Sub-project |
|---|---------|--------------|-------------|
| FR-1 | {name} | {summary of Gherkin scenarios} | {source} |

### Non-Functional Requirements
| Category | Threshold | Source |
|----------|----------|--------|
| Performance | {metric} | {which sub-project drove this} |
| Availability | {metric} | {source} |
| Security | {requirement} | {source} |

## 4. Technical Design

### Per-Service Highlights
**{service_name}:**
- Technology: {stack}
- Data store: {type and key entities}
- API surface: {REST/GraphQL/gRPC endpoints}
- Key design pattern: {pattern}

### Cross-Cutting Design Decisions
- **Authentication:** {approach}
- **Error Handling:** {pattern}
- **Caching:** {strategy}
- **Observability:** {logging, metrics, tracing approach}

## 5. Implementation Specifications

### Key Execution Flows
| Feature | Flow Summary | Complexity |
|---------|-------------|------------|
| {feature} | {brief description} | Low/Med/High |

### Critical Business Rules
- {rule} — {enforcement point}

## 6. Test Strategy

### Test Coverage Matrix
| Layer | Approach | Tools | Key Scenarios |
|-------|----------|-------|---------------|
| Unit | {approach} | {tools} | {scenarios} |
| Integration | {approach} | {tools} | {scenarios} |
| E2E | {approach} | {tools} | {scenarios} |
| Performance | {approach} | {tools} | {scenarios} |

## 7. Sprint Artifacts Status

| Artifact | Status | Link |
|----------|--------|------|
| Roadmap | {Created / Updated / Verified} | [roadmap.md](.work/sprint/roadmap.md) |
| Backlog | {Created / Updated / Verified} | [backlog.md](.work/sprint/backlog.md) |
| Board | {Created / Updated / Verified} | [board.md](.work/sprint/board.md) |

## 8. Risks and Recommendations

| # | Risk | Severity | Recommendation |
|---|------|----------|---------------|
| 1 | {description} | High/Med/Low | {actionable recommendation} |

## 9. Detailed Artifacts

- [Scout Reports](.work/scouts/)
- Software Requirements Specification
- High-Level Design (architecture, ADRs, diagrams)
- Low-Level Design (tech-design, work packages)
- Implementation Specifications
- Test Specifications (test specs, performance)
```

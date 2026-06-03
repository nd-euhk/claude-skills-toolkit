# Codebase Exploration Report: toolkit

**Date:** 2026-06-02
**Mode:** Architect Only (--auto)
**Sub-projects analyzed:** 1

## 1. Project Overview

The **toolkit** is a Claude Code plugin that provides Agent Skills, sub-agents, hooks, templates, and evaluation infrastructure for automating the full SDLC pipeline within Claude Code. It functions as both a development toolkit and a reference implementation for building Claude Code plugins. The project contains 14 Agent Skills, 11 sub-agents, 30 document templates, and a reference Python sub-project (`sanitizer-service`) demonstrating the SDLC pipeline's document generation capabilities.

The toolkit follows a **Plugin-Based Modular Architecture with Skill-Driven Orchestration**. Skills act as orchestrators that spawn specialized sub-agents for SDLC phases (SRS, HLD, LLD, IMP, TST), gate verification, sprint management, and support tasks. All state is file-based -- there is no HTTP server, database, or message broker. The Claude Code CLI provides the execution environment (Read, Write, Bash, Agent, Skill tools).

### Sub-Project Topology

```
+----------------------------------+
|         toolkit (plugin)          |
|  Skills -> Agents -> Templates    |
|  Hooks -> Evals -> Docs           |
+---------------+------------------+
                | references
                v
+----------------------------------+
|  projects/sanitizer-service       |
|  Python utility (ref. impl.)      |
|  validate_email, sanitize_input   |
+----------------------------------+
```

## 2. System Architecture

### C4 Context
- **External Actors**: Developer (invokes skills), Code Reviewer (reviews PRs)
- **System Boundary**: Toolkit Plugin loaded by Claude Code CLI host runtime
- **Key Systems**: Skills Layer (14 skills), Agents Layer (11 agents), Templates Layer (30 templates), Hooks Layer (1 hook), Evaluation Layer (evals/), Reference Project (sanitizer-service)
- **External Systems**: Claude Code CLI (host), Git (VCS), Filesystem (artifact storage)

### Key Architecture Decisions

| ADR | Status | Summary |
|-----|--------|---------|
| ADR-001: Service Decomposition | Accepted | Skill-per-domain with agent-based delegation within a single plugin |
| ADR-002: API Conventions | Accepted | Skill frontmatter + Agent briefs as inter-component contract with template-based output |
| ADR-003: Event Taxonomy | Accepted | Three-category event system: Claude Code Lifecycle, SDLC Pipeline, Skill Trigger |

### Service Topology

| Service | Domain | Data Owned |
|---------|--------|------------|
| explore-codebase | SDLC Pipeline | Pipeline config, agent briefs |
| orchestrator | SDLC Pipeline | Orchestration rules |
| sprint | SDLC Pipeline | Roadmap, backlog, board |
| skill-composer | Skill Authoring | Creation patterns, templates |
| skill-refiner | Skill Authoring | Quality standards |
| skill-tester | Skill Authoring | Test cases, benchmarks |
| plugin-creator | Plugin Management | Manifest, layout |
| hook-creator | Component Authoring | Event matchers, schemas |
| subagent-creator | Component Authoring | Tool scoping, permissions |
| 5 support skills | Support | Patterns, frameworks |

Communication: In-process (Agent() and Skill() tool calls) + file-based (Read/Write/Edit tools). No network communication.

## 3. Functional Requirements

*Skipped in architect mode. Architect mode generates architecture only -- functional requirements are part of the SRS phase.*

## 4. Technical Design

*Skipped in architect mode. Technical design (per-service internals) is part of the LLD phase.*

## 5. Implementation Specifications

*Skipped in architect mode. Implementation specifications are part of the IMP phase.*

## 6. Test Strategy

*Skipped in architect mode. Test specifications are part of the TST phase.*

## 7. Sprint Artifacts Status

*Skipped in architect mode. Sprint integration only runs in Full Pipeline mode. Per sprint-integration.md: "SRS and HLD not generated (architect-only mode): Only update roadmap with architectural themes. Skip backlog and board updates (no features to add)."*

## 8. Risks and Recommendations

| # | Risk | Severity | Recommendation |
|---|------|----------|---------------|
| 1 | Knowledge duplication between plugin-creator and specialist skills | Low | Documented limitation -- wait for Claude `context: fork` support before refactoring |
| 2 | Context window pressure from loading multiple skills | Low | Progressive disclosure (references/ loaded on-demand) mitigates this |
| 3 | Template drift: agents may deviate from templates | Low | Gate verifier checks output structure against criteria |
| 4 | No runtime contract validation | Med | Consider adding validation hooks for critical outputs |
| 5 | Single plugin scope limits independent skill versioning | Low | Plugin version tracks aggregate; skill versions are independent but must trigger plugin bump |

## 9. Detailed Artifacts

- [Scout Report](scout-toolkit--explore-codebase.md)
- High-Level Design:
  - [System Architecture](../docs/architecture/system-architecture.md)
  - [ADR-001: Service Decomposition](../docs/architecture/ADRs/ADR-001-service-decomposition.md)
  - [ADR-002: API Conventions](../docs/architecture/ADRs/ADR-002-api-conventions.md)
  - [ADR-003: Event Taxonomy](../docs/architecture/ADRs/ADR-003-event-taxonomy.md)
  - [System Context Diagram](../docs/architecture/diagrams/system-context.mermaid)
  - [Container Diagram](../docs/architecture/diagrams/container-diagram.mermaid)
  - [Data Flow Diagram](../docs/architecture/diagrams/data-flow.mermaid)
  - [Agent Architecture](../agent_docs/architecture.md)
  - [Domain-Service Mapping](../agent_docs/domain-service-mapping.yaml)
  - [Hard Boundaries](../agent_docs/hard-boundaries.md)
  - [API Conventions](../agent_docs/contracts/api-conventions.md)
  - [Event Conventions](../agent_docs/contracts/events.md)

### Pipeline Summary

| Phase | Status | Output |
|-------|--------|--------|
| Phase 1: Scout | Complete | 1 sub-project detected (toolkit) |
| Phase 2: Explore | Complete | scout-toolkit--explore-codebase.md |
| Phase 3: Plan | Skipped | --auto flag |
| Phase 4: HLD | Complete | System architecture, 3 ADRs, 3 diagrams, agent docs, contracts |
| Phase 4: Gate Verify | PASS | All 7 gate criteria passed |
| Phase 5: Sprint | Skipped | Architect mode |
| Phase 6: Summary | Complete | This report |

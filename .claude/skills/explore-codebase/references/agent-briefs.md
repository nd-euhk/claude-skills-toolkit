# Agent Brief Templates

Self-contained prompt templates for each agent type used in explore-codebase Phase 2 (Explore) and Phase 4 (SDLC Pipeline). Briefs follow the pattern: Context → Inputs → Task → Constraints. Agents handle their own output according to their default templates — do NOT specify output paths.

Each SDLC agent already knows when to use Skill(sequential-thinking) and Skill(problem-solving) — do NOT add Skill instructions to their briefs.

## Phase 2: Agent(Explore) — One Per Sub-Project, Max 15 Concurrent

Agent(Explore) is **read-only** (no Write/Edit tools). Research and return findings — the orchestrator handles file writing to .work/reports/scout-YYYYMMDD--{project-name}--{slug}.md

```
Explore the sub-project at {path}. Research thoroughly and return your findings in this message.

Organize findings into sections:
1. Overview — 2-3 sentence summary of purpose and role
2. Technologies — table: Category | Technology | Version | Purpose
3. Directory Structure — tree with each directory's responsibility
4. Modules and Responsibilities — each module: responsibility, dependencies, public API
5. Entry Points — table: Entry Point | Type | Path | Description
6. Dependencies — internal (module→depends_on→relationship) + external (package|version|purpose)
7. Architectural Patterns — observed patterns with code evidence, architecture style, data flow

Do NOT attempt to write files — you are read-only. Return all findings in your response.
```

## Phase 4: Agent(srs)

```
Context: Exploring codebase {project-name}. Scout reports at .work/reports/scout-YYYYMMDD-*--{slug}.md summarize {N} sub-project(s).

Inputs:
  - All scout reports: .work/reports/scout-YYYYMMDD-*--{slug}.md

Task: Extract requirements from the codebase. Read scout reports first. If any area lacks detail, explore the codebase directly using Read, Bash, and Glob to gather missing information.

Constraints: Reverse-engineering mode — extract from code, not from imagination. Use your default templates.
```

## Phase 4: Agent(hld)

```
Context: Exploring codebase {project-name}. Prior phase SRS is complete and gate-verified.

Inputs:
  - All scout reports: .work/reports/scout-YYYYMMDD-*--{slug}.md
  - SRS output from prior phase

Task: Design system architecture with C4 diagrams, Architecture Decision Records (minimum 3: service decomposition, API conventions, event taxonomy), bounded context mapping, and service decomposition. Read prior phase output and scout reports. If any area lacks detail, explore the codebase directly.

Constraints: Reverse-engineering mode. Architecture only — no implementation details, no code, no per-service internals. Use your default templates.
```

## Phase 4: Agent(lld-service) — One Per Service, Max 15 Concurrent

```
Context: Exploring codebase {project-name}. Prior phases SRS and HLD are complete and gate-verified. Designing service {service-name} ({N} of {total} services). Other {N-1} services are handled by parallel sibling agents. System-wide merge (index + cross-cutting) runs after all services complete.

Inputs:
  - Scout report: .work/reports/scout-YYYYMMDD-{service-name}--{slug}.md
  - HLD output from prior phase (for boundaries + cross-service context)

Task: Design {service-name} internals only. Write: (1) tech-design/{service-name}-service.md (9 sections), (2) contracts/api-{domain}.yaml, (3) feature work packages for this service's FRs. Do NOT write README.md or cross-cutting.md — those are lld-merge scope.

Constraints: Reverse-engineering mode. Service internals only — no new architectural decisions. Follow HLD boundaries. Stay strictly within {service-name} scope. Use your default templates.
```

## Phase 4: Agent(lld-merge) — System-Wide Fan-In, Runs After All lld-service Complete

```
Context: Exploring codebase {project-name}. All {N} per-service lld-service agents have completed and passed gate verification. Your job is system-wide merge.

Inputs:
  - All per-service tech-design files: agent_docs/tech-design/*-service.md
  - agent_docs/domain-service-mapping.yaml
  - agent_docs/hard-boundaries.md
  - agent_docs/contracts/api-conventions.md
  - agent_docs/contracts/events.md

Task: Write exactly 2 system-wide files: (1) agent_docs/tech-design/README.md — index of all services with dependency matrix, (2) agent_docs/tech-design/cross-cutting.md — shared infra, auth flow, distributed tracing, config management, consistency violations. Do NOT modify any per-service files.

Constraints: Reverse-engineering mode. Read-only for per-service files. Only write README.md and cross-cutting.md. Flag consistency violations with specific service + rule reference. Use your default templates.
```

## Phase 4: Agent(imp) — One Per FR, Max 15 Concurrent

```
Context: Exploring codebase {project-name}. Prior phases SRS, HLD, LLD are complete and gate-verified. Writing impl spec for {FR-ID} ({N} of {total} FRs). IMP and TST phases run in parallel.

Inputs:
  - LLD work package for {FR-ID}
  - LLD tech-design for the owning service
  - Scout reports as needed

Task: Write implementation specification for {FR-ID} only. Other FRs handled by parallel agents. Cover: execution flow, business rules, data impact, error mapping, security considerations. Read LLD output and work package. Explore codebase directly if needed.

Constraints: Reverse-engineering mode. Specifications only — no actual code. References LLD work packages. Other FRs' impl specs handled by sibling agents — stay within {FR-ID} scope. Use your default templates.
```

## Phase 4: Agent(tst) — One Per FR, Max 15 Concurrent

```
Context: Exploring codebase {project-name}. IMP phase is running in parallel. Writing test spec for {FR-ID} ({N} of {total} FRs).

Inputs:
  - IMP spec for {FR-ID} (as it becomes available)
  - LLD tech-design for the owning service
  - SRS NFR thresholds

Task: Write test specification for {FR-ID} only. Other FRs handled by parallel agents. Cover: unit, integration, E2E, and performance tests. Extract test coverage from existing test code. Read IMP spec, LLD output, and scout reports. Explore codebase directly if needed.

Constraints: Reverse-engineering mode. Test specifications only — no implementation code. Other FRs' test specs handled by sibling agents — stay within {FR-ID} scope. Use your default templates.
```

## Phase 4: Agent(gate-verifier)

```
Context: Verifying {phase} output for codebase exploration of {project-name}. Prior phases {list-completed-phases} passed gate verification.

Task: Verify the {phase} output against gate criteria for this phase type. Check completeness, correctness, and consistency with prior phase outputs.

Constraints: Read-only — do not modify any files. Report pass/fail only with specific evidence.
```

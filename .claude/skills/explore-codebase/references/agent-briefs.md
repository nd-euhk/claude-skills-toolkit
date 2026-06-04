# Agent Brief Templates

Self-contained prompt templates for each agent type used in explore-codebase Phase 2 (Explore) and Phase 4 (SDLC Pipeline). Briefs follow the pattern: Context → Inputs → Task → Constraints. Agents handle their own output according to their default templates — do NOT specify output paths.

Each SDLC agent already knows when to use Skill(sequential-thinking) and Skill(problem-solving) — do NOT add Skill instructions to their briefs.

## Phase 2: Agent(Explore) — DEPRECATED as of v3.0.0

**DEPRECATED as of v3.0.0.** The scout skill (`Skill(scout)`) handles Agent(Explore) spawning internally. This brief is retained ONLY as a fallback if the scout skill fails for a specific sub-project (see SKILL.md Phase 2 error handling).

Agent(Explore) is **read-only** (no Write/Edit tools). Research and return findings — the orchestrator handles file writing to .work/scouts/scout-YYYYMMDD--{project-name}--{slug}.md

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

## Phase 2: Scout Invocation Format

Invoke `Skill(scout)` per sub-project with this format:

```
Skill(scout, "Explore sub-project {project-name} at path {project-path}. 
A repomix codebase snapshot is available at .work/repomix/{project-name}--{slug}.xml — use it for fast file navigation and structure overview.
Total codebase size: ~{token_count} tokens.

Produce a detailed scout report with these 7 sections:
1. Overview — 2-3 sentence summary of purpose and role
2. Technologies — table: Category | Technology | Version | Purpose
3. Directory Structure — tree with each directory's responsibility
4. Modules and Responsibilities — each module: responsibility, dependencies, public API
5. Entry Points — table: Entry Point | Type | Path | Description
6. Dependencies — internal (module → depends_on → relationship) + external (package|version|purpose)
7. Architectural Patterns — observed patterns with code evidence, architecture style, data flow

Adjust your internal SCALE based on the token count — spawn more agents and subdivide further for larger codebases. 
Write the final report to .work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md. Full template: `references/report-templates.md#scout-report`.")
```

**If repomix snapshot is unavailable** for a sub-project (not installed or failed), omit the repomix reference line. The scout skill operates identically with or without the snapshot.

## Phase 4: Agent(srs)

```
Context: Exploring codebase {project-name}. {N} scout report(s) from this exploration run ({run_date}, slug: {slug}). Each report covers one sub-project — they may interact but have independent codebases, technologies, and requirements.

Inputs — read these exact files (not globs):
{scout_report_paths}

Task: Extract requirements from the codebase. Read all scout reports first. Treat each as a source of functional and non-functional requirements. If any area lacks detail, explore the codebase directly using Read, Bash, and Glob.

Output: docs/product/SRS.md and agent_docs/traceability/requirements-matrix.md
Constraints: Reverse-engineering mode — extract from code, not from imagination. Use your default templates.
```

## Phase 4: Agent(hld)

```
Context: Exploring codebase {project-name}. Prior phase SRS is complete and gate-verified. {N} scout report(s) from this exploration run ({run_date}, slug: {slug}).

Inputs — read these exact files (not globs):
{scout_report_paths}
  - SRS output from prior phase

Task: Design system architecture with C4 diagrams, Architecture Decision Records (minimum 3: service decomposition, API conventions, event taxonomy), bounded context mapping, and service decomposition. Read prior phase output and scout reports. If any area lacks detail, explore the codebase directly.

Output: docs/architecture/system-architecture.md, docs/architecture/ADRs/*.md, agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md
Constraints: Reverse-engineering mode. Architecture only — no implementation details, no code, no per-service internals. Use your default templates.
```

## Phase 4: Agent(lld-service) — One Per Service, Max 15 Concurrent

```
Context: Exploring codebase {project-name}. Prior phases SRS and HLD are complete and gate-verified. Designing service {service-name} ({N} of {total} services). Other {N-1} services are handled by parallel sibling agents. System-wide merge (index + cross-cutting) runs after all services complete.

Inputs — read these exact files (not globs):
  - SRS output from prior phase (to identify FRs assigned to this service)
  - Scout report for this service: {scout_report_path}
  - HLD output from prior phase (for boundaries + cross-service context)

Task: Design {service-name} internals only. Write: (1) tech-design/{service-name}-service.md (9 sections), (2) contracts/api-{domain}.yaml, (3) feature work packages per FR — one section per FR, grouped by topic/domain where natural. Each work package must reference its FR-ID from SRS so downstream IMP agents can map correctly. List {service-name}'s FR-IDs explicitly at the top of work packages for easy extraction. Do NOT write README.md or cross-cutting.md — those are lld-merge scope.

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

## Phase 4: Agent(imp) — One Per FR Group (Orchestrator batches, max 15 combined IMP+TST per batch)

```
Context: Exploring codebase {project-name}. Prior phases SRS, HLD, LLD are complete and gate-verified. Writing impl specs for {FR-LIST} ({N} of {total} IMP agents for service {service-name}). IMP and TST phases run in parallel.

Inputs:
  - LLD work packages for {FR-LIST}
  - LLD tech-design for service {service-name}
  - Scout reports as needed

Task: Write implementation specifications for {FR-LIST}. Other FR groups handled by parallel agents. Cover for each FR: execution flow, business rules, data impact, error mapping, security considerations. Read LLD output and work package. Explore codebase directly if needed.

Output: agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}-impl.md (one per FR in your group)
Constraints: Reverse-engineering mode. Specifications only — no actual code. References LLD work packages. Other FR groups handled by sibling agents — stay within {FR-LIST} scope. Use your default templates.
```

## Phase 4: Agent(tst) — One Per FR Group (Orchestrator batches, max 15 combined IMP+TST per batch)

```
Context: Exploring codebase {project-name}. IMP phase is running in parallel. Writing test specs for {FR-LIST} ({N} of {total} TST agents for service {service-name}).

Inputs:
  - IMP specs for {FR-LIST} (as they become available)
  - LLD tech-design for service {service-name}
  - SRS NFR thresholds

Task: Write test specifications for {FR-LIST}. Other FR groups handled by parallel agents. Cover for each FR: unit, integration, E2E, and performance tests. Extract test coverage from existing test code. Read IMP spec, LLD output, and scout reports. Explore codebase directly if needed.

Output: agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}-test.md (one per FR in your group)
Constraints: Reverse-engineering mode. Test specifications only — no implementation code. Other FR groups handled by sibling agents — stay within {FR-LIST} scope. Use your default templates.
```

## Phase 4: Agent(gate-verifier)

```
Context: Verifying {phase} output for codebase exploration of {project-name}. Prior phases {list-completed-phases} passed gate verification.

Task: Verify the {phase} output against gate criteria for this phase type. Check completeness, correctness, and consistency with prior phase outputs.

Constraints: Read-only — do not modify any files. Report pass/fail only with specific evidence.
```

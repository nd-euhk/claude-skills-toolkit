# Explore / Reverse Engineer Workflow

Extract documentation from an existing codebase. Generates HLD, LLD, SRS, IMP, and TST by analyzing code, configuration, and infrastructure files.

**Key rule:** NEVER fabricate. Everything must be detected FROM CODE. Write "Not detected in code" when unsure.

## Phase Overview

```
Discover → Deep Scout → Merge → Scope → HLD Per Proj → LLD Per Proj → SRS Per Proj → IMP Per Proj → TST Per Proj → Assess Per Proj → Merge
   ↓          ↓ Gate       ↓       ↓       ↓ Gate          ↓ Gate         ↓ Gate         ↓ Gate         ↓ Gate          ↓ Gate            ↓
(1a→1b→1c→1d)
                                          [Cross-project merge after HLD and Assessment]
```

---

## Pre-Flight: Plan Mode (MANDATORY)

**Before any scouting, enter plan mode per the Plan Mode Protocol in SKILL.md.**

The orchestrator MUST follow this sequence before proceeding to Step 1:

### Step P1: Enter Plan Mode

```
EnterPlanMode
```

This puts the session into plan mode. No writes allowed — only reads, questions, and delegation.

### Step P2: Delegate to Plan Subagent

```
Agent type: Plan
Prompt: "Analyze the Explore/Reverse Engineer request and create a comprehensive orchestration plan.

Codebase: <path or repository>
Goal: <what documentation to extract, or full pipeline>

Plan should include:
1. Discovery strategy: how many projects to expect, what to look for
2. Scouting plan: per-project deep scout scope, cross-cutting concerns
3. Documentation scope: Full pipeline (HLD+LLD+SRS+IMP+TST), Architecture only, or Fill gaps
4. Phase-by-phase plan: HLD→LLD→SRS→IMP→TST→Assessment per project
5. Subagent assignments: 1 per project per phase (parallel execution)
6. Gate review assignments: 1 per project per phase
7. Output paths: project-scoped directory structure
8. Merge strategy: when/how to synthesize cross-project docs

Report the plan in structured format ready for documentation."
```

### Step P3: Write Plan to File

```
Agent type: general-purpose
Model: sonnet
Prompt: "Write the Explore/Reverse Engineer orchestration plan to .work/plans/<YYYYMMDD>/plan-explore-<slug>.md.

Plan content:
<plan from Step P2>

Create directory .work/plans/<YYYYMMDD>/ if it doesn't exist.

Write the complete plan to .work/plans/<YYYYMMDD>/plan-explore-<slug>.md
Include: discovery strategy, project count estimate, documentation scope, phase plan per project, subagent assignments, and output paths."
```

### Step P4: Present Plan for Human Confirmation

Read `.work/plans/<YYYYMMDD>/plan-explore-<slug>.md` and present:

```
Explore Plan: .work/plans/<YYYYMMDD>/plan-explore-<slug>.md

Scope: <Full/Architecture/Fill gaps>
Estimated projects: <N>
Phases per project: <HLD, LLD, SRS, IMP, TST, Assess>
Output: agent_docs/projects/{project-name}/, docs/, .work/reports/

Confirm to proceed with execution.
```

Use AskUserQuestion to confirm documentation scope if not yet decided. Wait for explicit approval.

### Step P5: Exit Plan Mode

```
ExitPlanMode
```

Only after human confirms. This exits plan mode and allows scouting + extraction.

### Step P6: Proceed with Execution

Return to the workflow below, starting with Step 1 (Scout Codebase Structure). All scoping decisions made in the plan guide execution.

---

## Step 1: Scout Codebase Structure

**CRITICAL SCOPING RULE:** Minimum 1 Explore subagent per project. NEVER assign 1 Explore subagent to scout **more than 1 project**. If the codebase has N projects/subprojects, spawn N Explore subagents (one per project) in parallel. This prevents context overload and ensures thorough per-project reconnaissance.

Scouting follows a strict two-phase pattern:
```
Phase 1: DISCOVER — How many projects/submodules/subprojects exist?
          ↓
Phase 2: DEEP SCOUT — Spawn 1 Explore per discovered project (parallel)
```

### Step 1a: Discover Projects & Submodules

First, determine how many projects, submodules, and subprojects exist. Spawn a single Explore subagent with `glob` and `bash` tools for filesystem discovery — no deep code analysis:

```
Agent type: Explore
Prompt: "Discover ALL projects, submodules, and subprojects in this repository. Use glob patterns and bash commands for filesystem discovery. Do NOT deep-dive into source code.

1. GIT SUBMODULES (check first):
   - Run: git submodule status (if .gitmodules exists)
   - For each submodule found, note: name, path, URL, commit hash
   - Run: cat .gitmodules (if exists) to get full submodule metadata

2. BUILD SYSTEM CLUSTERS (glob scan):
   - Glob for build files: **/pom.xml, **/build.gradle*, **/settings.gradle, **/package.json, **/Cargo.toml, **/Makefile, **/CMakeLists.txt, **/go.mod, **/pyproject.toml, **/setup.py, **/*.csproj, **/*.sln
   - Each build file location is a potential project/subproject root
   - Group by directory depth and relationship (parent pom.xml → child modules)

3. MONOREPO STRUCTURES:
   - Glob: packages/*/package.json, services/*/pom.xml, apps/*/build.gradle, modules/*/, libs/*/
   - Check for workspace configs: pnpm-workspace.yaml, lerna.json, nx.json, turbo.json, rush.json
   - Check for multi-module markers: settings.gradle modules list, parent pom.xml <modules>

4. DEPLOYABLE UNITS:
   - Glob: **/Dockerfile, **/docker-compose*.yml, **/docker-compose*.yaml
   - Glob: **/deployment.yaml, **/helm/Chart.yaml
   - Each Dockerfile's directory is a candidate deployable unit

5. INDEPENDENT DIRECTORY CLUSTERS:
   - Directories with their own build file AND distinct purpose (not just build tool config)
   - Separate README.md or CLAUDE.md at project level
   - Distinct package namespace (e.g., com.example.serviceA vs com.example.serviceB)

6. DOMAIN / BOUNDED CONTEXT DETECTION (for each project):
   - Quick grep for package/namespace declarations: grep -r \"^package \" {project}/src/ | head -20 (Java/Kotlin)
   - For Go: check go.mod module path
   - For Rust: check Cargo.toml [package] name
   - For Node: read package.json \"name\" field
   - For Python: check setup.py / pyproject.toml project name
   - Derive domain_short_code (2-6 uppercase chars) from the dominant namespace/service name
   - Derive domain_slug (lowercase-hyphenated) for file path usage
   - Example: user-service with package com.example.user → code=USER, slug=user-management
   - Example: payment-service → code=PAY, slug=payment-processing

Report a flat list: project/subproject name, root path, type (git-submodule|build-project|monorepo-package|deployable-unit), build system, and domain candidates. ONE line per project. This is a lightweight discovery scan — no source code analysis."
```

**Expected output format:**
```
| # | Name | Path | Type | Build System | Domain Code | Domain Slug |
|---|------|------|------|-------------|-------------|-------------|
| 1 | api-gateway | ./services/api-gateway | build-project | gradle | GATEWAY | gateway-routing |
| 2 | user-service | ./services/user-service | build-project | gradle | USER | user-management |
| 3 | shared-lib | ./libs/shared | git-submodule | maven | SHARED | shared-library |
| 4 | web-app | ./apps/web | monorepo-package | npm | WEB | web-frontend |
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

9. DOMAIN / BOUNDED CONTEXT EXTRACTION (MANDATORY):
   - Extract top-level packages from source files (grep for package/namespace declarations)
   - What bounded contexts does this code represent?
   - What is the domain language? (Entity names, service names, API resource names)
   - Detect domain boundaries: which packages belong together? Which are separate?
   - Produce: domain_short_code (2-6 uppercase), domain_slug (lowercase-hyphen), domain_description
   - Example: domain_short_code=USER, domain_slug=user-management, description=\"User identity, authentication, registration, and profile management\"
   - Multiple domains per project are valid (e.g., a service handling both USER and NOTIFICATION)

10. SERVICE INVENTORY (MANDATORY):
    - List every deployable service/module/application within this project
    - For each: name, deployable_type (backend|frontend|library|infra), primary_language, framework
    - For backend services: list REST controllers/handlers found (file paths + endpoints)
    - For frontend apps: list page/route components found
    - For libraries: list public API surface (exported packages/modules)

CRITICAL: At the TOP of your report, include structured metadata blocks for the merge agent to parse:

#META project-name: <name>
#META project-path: <path>
#META project-type: <type>
#META primary-language: <lang>
#META build-system: <system>
#META framework: <framework>
#DOMAIN code: <SHORTCODE> slug: <slug> description: <desc>
#SERVICE name: <svc1> type: <backend|frontend|lib|infra> lang: <lang> framework: <fw>
#SERVICE name: <svc2> type: <backend|frontend|lib|infra> lang: <lang> framework: <fw>

Report everything found with file paths. Flag any existing docs that are out of date or inconsistent."
```

Present scouting report to user. Highlight what docs exist and what's missing.

### Step 1 Scouting Summary

The complete scouting pipeline has 4 sub-steps:

1. **Step 1a (Discover):** Single Explore agent with glob+bash discovers all projects, submodules, subprojects + domain candidates
2. **Step 1b (Deep Scout):** Spawn N Explore subagents in parallel — one per project discovered in 1a
3. **Step 1c (Root-Level):** One additional Explore for cross-cutting concerns (root docs, shared config, CI/CD)
4. **Step 1d (Merge):** General-purpose agent synthesizes all reports into `.work/reports/scouting-report.md` AND `.work/reports/project_registry.yaml` (SSOT for all subsequent phases)

The per-project deep scout prompt in Step 1b above serves as the template for each parallel Explore agent.

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

### Step 1d: Merge Scout Reports + Produce Project Registry

After all Explore subagents (1a + N×1b + 1c) complete, merge their findings into TWO outputs:

```
Agent type: general-purpose
Prompt: "Merge the scouting reports from all Explore subagents into TWO outputs:

INPUTS:
- Step 1a: Project list with domain candidates (<N> projects discovered)
- Step 1b: <N> per-project scouting reports (each has #META, #DOMAIN, #SERVICE blocks)
- Step 1c: 1 root-level cross-cutting report

OUTPUT 1 — HUMAN-READABLE: .work/reports/scouting-report.md
- Consolidated scouting report organized by project
- Cross-cutting section at the top
- Flag discrepancies between project-level and root-level findings

OUTPUT 2 — MACHINE-READABLE: .work/reports/project_registry.yaml
Parse the #META, #DOMAIN, #SERVICE comment blocks from each per-project report.
Produce a structured YAML registry following this exact schema:

\`\`\`yaml
# SSOT for all subsequent explore/reverse phases. Generated by Step 1d.
version: \"1.0\"
generated_at: \"<timestamp>\"
projects:
  - name: api-gateway              # Unique project ID (used in all output paths)
    root_path: ./services/api-gateway
    type: build-project            # git-submodule | build-project | monorepo-package | deployable-unit
    build_system: gradle
    primary_language: java
    framework: spring-cloud-gateway
    domains:
      - code: GATEWAY              # Short uppercase for FR-{DOMAIN}-{NNN}
        slug: gateway-routing       # Lowercase-hyphen for file/dir paths
        description: \"API gateway routing and rate limiting\"
    services:
      - name: api-gateway           # Deployable unit name
        type: backend
        language: java
        framework: spring-cloud-gateway
        controllers:
          - path: src/main/java/com/example/gateway/RouteController.java
            endpoints: [\"GET /api/v1/routes\", \"POST /api/v1/routes\"]
    existing_docs_summary:
      hld: missing
      lld: missing
      srs: missing

cross_cutting:
  root_docs_found:
    - path: CLAUDE.md
    - path: .github/workflows/ci.yml
  existing_docs_summary:
    hld: missing
    agent_docs: missing
\`\`\`

CRITICAL RULES:
- Project name MUST be unique. If duplicates found, qualify with parent dir (e.g., 'services-api' vs 'libs-api')
- Domain code and slug MUST come from the #DOMAIN blocks in per-project reports (derived FROM CODE, not invented)
- Service names MUST come from #SERVICE blocks in per-project reports
- If a per-project report is missing #META/#DOMAIN/#SERVICE blocks, infer from the free-text report content
- cross_cutting section captures root-level artifacts from Step 1c

Output to: .work/reports/scouting-report.md AND .work/reports/project_registry.yaml"
```

---

## Step 2: Assess & Plan Documentation

### Step 2a: Present Discovery Summary

Read `.work/reports/project_registry.yaml` and present findings to the user:

```
Scouting complete. Found <N> projects:

  {project-name-1}: {services count} service(s), domains=[{domain codes}], existing docs: {summary}
  {project-name-2}: {services count} service(s), domains=[{domain codes}], existing docs: {summary}
  ...

Each project will get dedicated subagents per phase:
  - HLD: <N> hld-architect subagent(s) (1 per project, parallel)
  - LLD: <N> lld-designer subagent(s) (1 per project, parallel)
  - SRS: <N> srs-specifier subagent(s) (1 per project, parallel)
  - IMP: <N> imp-specifier subagent(s) (1 per project, batched if >30 FRs)
  - TST: <N> tst-specifier subagent(s) (1 per project, batched if >30 FRs)
  - Assessment: <N> component-validator subagent(s) (1 per project)
```

### Step 2b: Choose Scope

Use AskUserQuestion to determine scope:

Ask: "What documentation should be generated from the codebase?" (header: "Doc Scope")
Options:
- "Full pipeline: HLD + LLD + SRS + IMP + TST" (complete reverse-engineering, all projects)
- "Architecture only: HLD + LLD" (architecture and service design, all projects)
- "Spec generation: HLD + LLD + SRS + IMP + TST" (specs from code, all projects)
- "Fill gaps: supplement existing docs" (only what's missing per project, based on registry)

If existing spec-test docs exist but are outdated/incomplete, prioritize updating them over creating from scratch. The project_registry.yaml `existing_docs_summary` fields guide gap analysis.

---

## Step 3: Extract High-Level Design (HLD) — Per Project

**CRITICAL:** Spawn 1 hld-architect PER PROJECT. All run in parallel. Never let 1 hld-architect handle multiple projects.

### Step 3a: Per-Project HLD Extraction

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: hld-architect
Prompt: "REVERSE-ENGINEER the High-Level Design from code for project: {project-name}.

INPUTS:
- .work/reports/project_registry.yaml (read the entry for {project-name})
- Source code at: {root_path} (from registry)
- Step 1b scouting report for this project (if available)

You are operating in REVERSE-ENGINEERING MODE. Instead of designing architecture from SRS, you are EXTRACTING architecture from existing code.

READ THE CODE FIRST (do not fabricate):
1. Read build files ({root_path}/pom.xml, build.gradle, etc.) to understand module structure
2. Read REST clients / HTTP proxy classes to detect external system dependencies
3. Read config files (application.yml, Dockerfile, docker-compose, K8s) for infrastructure
4. Read security config classes for auth mechanism
5. Read entity/model file locations for data ownership
6. Read message queue producers/consumers for async patterns
7. Read import statements across packages to detect hard boundaries

Then produce a 10-section HLD DETECTED FROM CODE:

1. Architecture Style — detected from code patterns (not chosen)
2. C4 Level 1: System Context — external systems detected from REST clients, configs
3. C4 Level 2: Container Diagram — services/modules detected from directory structure
4. Communication Patterns — sync REST, async events, gRPC detected from imports/annotations
5. Data Ownership — which entities belong to which service (from entity file locations)
6. Security Architecture — auth mechanism detected from security config classes
7. Infrastructure — deployment model detected from Docker/K8s files
8. Architecture Decision Records — inferred from code structure (one ADR per decision)
9. Hard Boundaries — what each service OWNS vs REFERENCES (from import analysis)
10. Agent Architecture Summary — for agent consumption

CRITICAL RULES:
- Everything must be DETECTED FROM CODE — cite file paths as evidence
- If something is unclear, write 'Not detected in code' — NEVER guess
- Anti-patterns found MUST be marked with ALERT markers
- Gaps in documentation must be marked with TODO
- Mark output: 'REVERSE-ENGINEERED — needs architect validation'

Templates available at skills/orchestrate/templates/hld/

Output to PROJECT-SCOPED paths:
- agent_docs/projects/{project-name}/architecture.md — per-project architecture summary
- agent_docs/projects/{project-name}/hard-boundaries.md — per-project ownership rules
- agent_docs/projects/{project-name}/contracts/api-conventions.md — detected API conventions
- agent_docs/projects/{project-name}/contracts/events.md — detected events (if any)
- agent_docs/projects/{project-name}/domain-service-mapping.yaml — domain→service mapping for THIS project
- docs/architecture/ADRs/{project-name}-ADR-{NNN}-{decision}.md — per-project ADRs (prefixed with project name)
- docs/architecture/diagrams/{project-name}-{name}.mermaid — per-project diagram sources"
```

### Step 3b: Gate Review — Per Project

For EACH project's HLD output, run gate review in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered HLD for project {project-name}:

Read from:
- agent_docs/projects/{project-name}/architecture.md
- agent_docs/projects/{project-name}/hard-boundaries.md
- agent_docs/projects/{project-name}/contracts/
- docs/architecture/ADRs/{project-name}-ADR-*.md

Gate checklist:
1. [ ] Every claim has a code reference (file path in {root_path})
2. [ ] No fabricated information (check 3 random claims against actual code)
3. [ ] ALERT markers on detected anti-patterns
4. [ ] TODO markers on information gaps
5. [ ] C4 diagrams are consistent with actual code structure at {root_path}
6. [ ] Data ownership matrix matches entity locations in source
7. [ ] All external systems in C4 Level 1 are actually referenced in code

Report: PASS / FAIL with specific issues for project {project-name}."
```

### Step 3c: Merge Cross-Project HLD

After all per-project HLD agents pass gate review, spawn 1 merge agent:

```
Agent type: general-purpose
Prompt: "Merge per-project HLD outputs into cross-project system architecture.

Read from:
- .work/reports/project_registry.yaml (all projects)
- agent_docs/projects/{project-name}/architecture.md (for each project)
- agent_docs/projects/{project-name}/hard-boundaries.md (for each project)

Produce:
- docs/architecture/system-architecture.md — merged C4 Level 1/2 diagrams showing all projects
- agent_docs/cross-project/architecture.md — cross-project agent summary
- agent_docs/cross-project/domain-service-mapping.yaml — merged domain→service mapping

The per-project docs remain the authoritative per-project source. Cross-project docs are synthesis only."
```

---

## Step 4: Extract Low-Level Design (LLD) — Per Project

**CRITICAL:** Spawn 1 lld-designer PER PROJECT. All run in parallel. The agent processes all services within its assigned project.

### Step 4a: Per-Project LLD Extraction

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: lld-designer
Prompt: "REVERSE-ENGINEER the Low-Level Design from code for ALL services in project: {project-name}.

INPUTS:
- .work/reports/project_registry.yaml (read the entry for {project-name})
  Contains: services[] list with names, types, languages, and controllers found
- Per-project HLD: agent_docs/projects/{project-name}/architecture.md
- Per-project hard boundaries: agent_docs/projects/{project-name}/hard-boundaries.md
- Source code at: {root_path} (from registry)

You are operating in REVERSE-ENGINEERING MODE. Instead of designing service internals from requirements, you are EXTRACTING internals from existing source code.

For EACH service in this project (from registry services[] list):

READ THE CODE FIRST:
1. Read controller/handler files to map API endpoints
2. Read service/business logic classes to understand internal architecture
3. Read entity/model classes to extract domain model
4. Read REST client / HTTP proxy classes for external dependencies
5. Read @Transactional or equivalent for transaction boundaries
6. Read @Cacheable annotations / cache config for caching strategy
7. Read exception handlers for error flows and degraded modes
8. Read config files for timeouts, connection pools, circuit breakers

Produce per-service LLD with 10 sections (DETECTED FROM CODE):
1. Service Boundary — what this service owns (from package structure)
2. Internal Architecture — controllers → services → repositories (from code)
3. Domain Model — entities, value objects, aggregates (from entity classes)
4. API Surface — endpoints (from controller annotations/handlers)
5. REST Clients — external calls (from client classes/proxies)
6. Transaction Boundaries — from @Transactional or equivalent
7. Integration Points — message handlers, event listeners
8. Caching Strategy — from @Cacheable annotations or cache config
9. Performance & Scale — connection pools, timeouts (from config)
10. Error Flows & Degraded Mode — from exception handlers, circuit breakers, retry config

CRITICAL RULES:
- File name must match the service name from project_registry.yaml
- Mark everything you CAN'T detect as 'TODO: Not detected in code'
- Reference specific files and line numbers
- Mark output: 'REVERSE-ENGINEERED — needs service owner validation'

Templates available at skills/orchestrate/templates/lld/

Output to PROJECT-SCOPED paths:
- agent_docs/projects/{project-name}/tech-design/{service-name}.md — per service LLD
- agent_docs/projects/{project-name}/contracts/api-{domain}.yaml — OpenAPI (if reconstructable from code)
- agent_docs/projects/{project-name}/contracts/error-codes.md — detected error codes
- agent_docs/projects/{project-name}/conventions.md — detected coding conventions"
```

### Step 4b: Gate Review — Per Project

For EACH project's LLD output, run gate review in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered LLD for project {project-name}:

Read from:
- agent_docs/projects/{project-name}/tech-design/*.md

Gate checklist per service:
1. [ ] All 10 sections present (even if some are TODO)
2. [ ] File name matches service name from project_registry.yaml
3. [ ] API endpoints match controller code (spot check 3 endpoints per service)
4. [ ] Domain model reflects actual entity classes
5. [ ] Error handling patterns detected from actual exception handlers
6. [ ] TODO markers are honest (not hiding gaps as filled sections)

Report: PASS / FAIL with specific issues for project {project-name}."
```

---

## Step 5: Extract Software Requirements (SRS) — Per Project

**CRITICAL:** Spawn 1 srs-specifier PER PROJECT. All run in parallel. Epic names are auto-detected from project_registry.yaml.

### Step 5a: Per-Project SRS Extraction

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: srs-specifier
Prompt: "REVERSE-ENGINEER Software Requirements from code for project: {project-name}.

INPUTS:
- .work/reports/project_registry.yaml (read the entry for {project-name})
  This contains the detected DOMAINS for this project — use domains[].code and domains[].slug
- Per-project HLD: agent_docs/projects/{project-name}/architecture.md
- Per-project LLD: agent_docs/projects/{project-name}/tech-design/*.md
- Per-project contracts: agent_docs/projects/{project-name}/contracts/
- Source code at: {root_path} (from registry)

You are operating in REVERSE-ENGINEERING MODE. Instead of writing requirements from PRD/BRD inputs, you are EXTRACTING requirements from existing code behavior.

CRITICAL — EPIC NAME DERIVATION (auto-detect, don't guess):
- The epic name comes from project_registry.yaml → projects[].domains[] entries
- For project '{project-name}' with domain code={CODE} and slug={domain-slug}:
  - Epic directory: docs/product/features/{project-name}-epic-{domain-slug}/
  - Example: docs/product/features/user-service-epic-user-management/
- If a project has multiple domains, create separate epic directories per domain
- The {project-name} prefix in the epic path prevents name collisions across projects

READ THE CODE FIRST:
- Read controller/handler files to identify API endpoints and their behavior
- Map each endpoint or logical feature grouping to a Functional Requirement
- Read validation logic to extract business rules
- Read config files for NFR indicators (timeout values, pool sizes, rate limits)

For each API endpoint / feature detected in this project:
1. Infer the FR from what the code DOES (not what it should do)
2. Write Gherkin Scenario Outline (reconstruct from code paths — success, validation error, auth error, not found)
3. Note: 'Reverse-engineered from: <file paths>'
4. Mark: 'STATUS: Reverse-engineered — needs business validation'
5. Use FR naming: FR-{DOMAIN}-{NNN}--{slug}.md
   - DOMAIN comes from project_registry.yaml domains[].code (e.g., USER, GATEWAY)
   - NNN is sequential within the domain (001, 002, ...)
   - slug is lowercase-hyphen feature name derived from endpoint/resource

CRITICAL RULES:
- Each feature (login, register, reset password) gets its own FR file — never group
- FR files must have >= 3 error/edge cases reconstructed from actual error handling in code
- All NFRs should have concrete numbers where detectable from config (or 'Not detected in code')
- Mark ALL FRs as 'NEEDS VALIDATION'

Templates available at skills/orchestrate/templates/srs/

Output to PROJECT-QUALIFIED paths:
- docs/product/SRS-{project-name}.md — master SRS for this project
- docs/product/features/{project-name}-epic-{domain-slug}/FR-{DOMAIN}-{NNN}--{slug}.md — per feature
- agent_docs/projects/{project-name}/traceability/requirements-matrix.md — traceability for this project"
```

### Step 5b: Gate Review — Per Project

For EACH project's SRS output, run gate review in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered SRS for project {project-name}:

Read from:
- docs/product/SRS-{project-name}.md
- docs/product/features/{project-name}-epic-{slug}/FR-*.md
- agent_docs/projects/{project-name}/traceability/requirements-matrix.md

Gate checklist:
1. [ ] Every FR has Gherkin Scenario Outline + data-driven Examples
2. [ ] >= 3 error/edge cases per FR
3. [ ] All NFRs have concrete numbers (or 'Not detected in code')
4. [ ] Traceability matrix: every FR → business objective
5. [ ] NO Phase 06/07 leaks
6. [ ] Concurrency scenarios covered
7. [ ] Idempotency expectations stated
Plus reverse-engineering specific:
8. [ ] Every FR cites the code files it was extracted from
9. [ ] All FRs marked 'NEEDS VALIDATION'
10. [ ] Epic directory name uses project prefix: {project-name}-epic-{domain-slug}

Report: PASS / FAIL with specific issues for project {project-name}."
```

---

## Step 6: Extract Implementation Specifications (IMP) — Per Project

**CRITICAL:** Spawn 1 imp-specifier PER PROJECT. All run in parallel. Batch if >30 FRs per project.

### Step 6a: Per-Project IMP Extraction

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: imp-specifier
Prompt: "REVERSE-ENGINEER Implementation Specifications from code for project: {project-name}.

INPUTS:
- .work/reports/project_registry.yaml (read {project-name} entry)
  Contains: services[] list with controllers_found, which maps to FRs
- FR specs for this project: docs/product/features/{project-name}-epic-*/FR-*.md
- Per-project HLD: agent_docs/projects/{project-name}/architecture.md
- Per-project LLD: agent_docs/projects/{project-name}/tech-design/{service-name}.md
- Per-project contracts: agent_docs/projects/{project-name}/contracts/
- Source code at: {root_path} (from registry)

You are operating in REVERSE-ENGINEERING MODE. Instead of writing implementation specs from work packages, you are EXTRACTING implementation details from existing code.

PROCESS ALL FRs FOR THIS PROJECT:
Group FRs by service (using project_registry.yaml services[] to map controller→service).
Process service-by-service. If >30 FRs, request batching into groups of ~15.

For each FR in this project:
READ THE CODE:
1. Find the controller/handler that implements the FR endpoint
2. Trace the full execution path: controller → service → repository → response
3. Read validation logic, business rules, error handling
4. Read entity classes for data/state impact
5. Read security annotations for authZ
6. Read transaction boundaries

Produce per-FR IMP spec with 10 sections (DETECTED FROM CODE):
1. Purpose — what the code does (from behavior, not docs)
2. References — links to FR, HLD, LLD
3. Affected Areas — actual files touched (from code structure)
4. Execution Flow — step-by-step reconstructed from code paths
5. Business Rules Realized — rules detected in code
6. Data & State Impact — entities read/written
7. Error Mapping — error handling detected in code
8. Security & Authorization — authZ patterns detected
9. Implementation Notes — detected gotchas, dependencies
10. Acceptance Checklist — testable items from actual behavior

CRITICAL RULES:
- NO code snippets, import statements, or package paths in spec
- Everything must be DETECTED FROM CODE — cite file paths + line numbers
- If unclear from code, write 'Not clearly detectable in code'
- Mark: 'REVERSE-ENGINEERED — needs business validation'

Templates available at skills/orchestrate/templates/impl/

Output to PROJECT-QUALIFIED paths:
- agent_docs/projects/{project-name}/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
- agent_docs/projects/{project-name}/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-migration.md (if DB changes detected)
- agent_docs/projects/{project-name}/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md (if frontend)
- agent_docs/projects/{project-name}/conventions.md (if not already created in LLD step)"
```

BATCHING: If a project has >30 FRs, split into batches of ~15 FRs per subagent. Spawn multiple imp-specifier subagents per project, one per batch.

### Step 6b: Gate Review — Per Project

For EACH project's IMP output, run gate review in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered IMP specs for project {project-name}:

Read from:
- agent_docs/projects/{project-name}/backend/*/implementation/FR-*-impl.md
- agent_docs/projects/{project-name}/frontend/*/implementation/FR-*-impl.md

Gate checklist:
1. [ ] All 10 sections present per feature
2. [ ] NO code, imports, or package paths in any spec
3. [ ] Every claim has a code reference (file path + line number)
4. [ ] Execution flow matches actual code behavior (spot check 3 paths against source)
5. [ ] Error mapping covers all detected error handlers
6. [ ] Security section reflects actual authZ patterns in code
7. [ ] Feature dependencies noted (must implement X before Y)
8. [ ] All specs marked 'Reverse-engineered — needs business validation'

Report: PASS / FAIL with specific issues for project {project-name}."
```

---

## Step 7: Extract Test Specifications (TST) — Per Project

**CRITICAL:** Spawn 1 tst-specifier PER PROJECT. All run in parallel. Batch if >30 FRs per project.

### Step 7a: Per-Project TST Extraction

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: tst-specifier
Prompt: "REVERSE-ENGINEER Test Specifications from existing test code for project: {project-name}.

INPUTS:
- .work/reports/project_registry.yaml (read {project-name} entry)
- FR specs: docs/product/features/{project-name}-epic-*/FR-*.md (Gherkin scenarios from Step 5)
- Per-project contracts: agent_docs/projects/{project-name}/contracts/
- Existing test code in: {root_path}/src/test/ (or equivalent test directories from registry)

CRITICAL — CONTEXT ISOLATION:
NEVER read agent_docs/projects/{project-name}/backend/*/implementation/ (IMP specs)
Test specs derive from FR scenarios + existing test code ONLY.

You are operating in REVERSE-ENGINEERING MODE. Instead of writing test specs from requirements+contracts, you are EXTRACTING test coverage from existing test code and supplementing gaps.

PROCESS ALL FRs FOR THIS PROJECT (batched by service if >30 FRs):

For each FR:
1. READ existing test files for the FR's service (from project_registry.yaml controllers_found mapping)
2. Match existing tests to Gherkin scenarios from the FR spec
3. For each matched test: document what exists (file path, line numbers, what it tests)
4. For each unmatched scenario: flag as GAP and GENERATE test spec to fill it

Each test spec must cover these layers:
1. Unit tests — from existing *Test.* files
2. Controller tests — from @WebMvcTest / MockMvc patterns
3. Repository tests — from @DataJpaTest patterns
4. Client tests — from WireMock/MockServer patterns
5. Integration tests — from @SpringBootTest/TestContainers patterns
6. Architecture tests — from ArchUnit patterns
7. Performance tests — from k6/JMeter patterns

CRITICAL RULES:
- NEVER read IMP specs (context isolation)
- If no existing tests found, write 'GAP: No tests detected for this scenario'
- Supplement ALL detected gaps with generated test specs
- Coverage summary per FR: X/Y Gherkin scenarios have test coverage
- Mark: 'Reverse-engineered from existing tests' for found tests
- Mark: 'Generated — needs implementation (no existing test found)' for gaps

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

Templates available at skills/orchestrate/templates/tst/

Output to PROJECT-QUALIFIED paths:
- agent_docs/projects/{project-name}/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
- agent_docs/projects/{project-name}/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
- agent_docs/projects/{project-name}/performance/README.md
- agent_docs/projects/{project-name}/performance/nfr-mapping.md
- agent_docs/projects/{project-name}/performance/baseline.md"
```

BATCHING: If a project has >30 FRs, split into batches of ~15 FRs per subagent. Spawn multiple tst-specifier subagents per project, one per batch.

### Step 7b: Gate Review — Per Project

For EACH project's TST output, run gate review in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered TST specs for project {project-name}:

Read from:
- agent_docs/projects/{project-name}/backend/*/test-specs/FR-*-test.md
- agent_docs/projects/{project-name}/frontend/*/test-specs/FR-*-test.md
- agent_docs/projects/{project-name}/performance/

Gate checklist:
1. [ ] All 7 test layers addressed where existing tests found
2. [ ] Gap analysis: missing tests explicitly marked with 'GAP:' markers
3. [ ] Missing scenarios SUPPLEMENTED: new test specs generated for every detected gap
4. [ ] Each test references the specific Gherkin scenario it validates
5. [ ] Test data/fixtures match actual test code (spot check 3 existing)
6. [ ] Generated test specs are complete (what, layer, data, expected result, WireMock if needed)
7. [ ] WireMock/Stub specs reflect actual stub configurations
8. [ ] Context isolation maintained: no impl spec references
9. [ ] Coverage summary present per FR: X/Y scenarios covered, Z gaps supplemented

Report: PASS / FAIL with specific issues for project {project-name}."
```

---

## Step 8: Spec-Test Documentation Assessment — Per Project

**CRITICAL:** Spawn 1 component-validator PER PROJECT. All run in parallel.

### Step 8a: Per-Project Assessment

Read `.work/reports/project_registry.yaml`. For EACH project, spawn in parallel:

```
Agent type: component-validator (or general-purpose)
Prompt: "Assess the documentation health for project: {project-name} after reverse engineering.

Read from (PROJECT-SCOPED ONLY):
- agent_docs/projects/{project-name}/architecture.md
- agent_docs/projects/{project-name}/tech-design/*.md
- agent_docs/projects/{project-name}/backend/*/implementation/*.md
- agent_docs/projects/{project-name}/backend/*/test-specs/*.md
- agent_docs/projects/{project-name}/performance/

Check for THIS PROJECT ONLY:
1. Coverage: what % of services have LLD? What % of FRs are documented?
2. Consistency: spot check 5 claims in docs against actual code at {root_path}
3. Freshness: are docs marked with extraction date? Are they older than last code change?
4. Completeness: which sections are TODO vs filled?
5. Gaps: what's still missing for this project?

Generate per-project doc health report:
Output to: .work/reports/doc-health-{project-name}.md"
```

### Step 8b: Merge Assessment Reports

After all per-project assessments complete, spawn 1 merge agent:

```
Agent type: general-purpose
Prompt: "Merge per-project doc health reports into a unified assessment.

Read from:
- .work/reports/doc-health-{project-name}.md (for each project)
- .work/reports/project_registry.yaml

Produce:
- .work/reports/doc-health.md — combined health report with per-project breakdowns
  - Overall coverage score
  - Per-project coverage table
  - Consolidated TODO and ALERT counts
  - Per-project gap list
  - Recommendation: what to tackle next per project"
```

---

## Completion

Report:

```
Explore/Reverse Engineer workflow complete.

Generated:
  .work/reports/project_registry.yaml              - Project registry (SSOT for all phases)

  CROSS-PROJECT:
    docs/architecture/system-architecture.md       - Merged C4 diagrams
    docs/architecture/ADRs/                        - Architecture Decision Records
    agent_docs/cross-project/architecture.md       - Cross-project agent summary
    agent_docs/cross-project/domain-service-mapping.yaml

  PROJECT: {project-name-1}/
    agent_docs/projects/{name}/architecture.md              - Per-project HLD
    agent_docs/projects/{name}/hard-boundaries.md           - Ownership rules
    agent_docs/projects/{name}/contracts/                   - API conventions, events
    agent_docs/projects/{name}/tech-design/{svc}.md         - Per-service LLD
    docs/product/SRS-{name}.md                              - Master SRS
    docs/product/features/{name}-epic-{domain-slug}/        - FR specs (one per feature)
    agent_docs/projects/{name}/backend/{svc}/implementation/  - IMP specs
    agent_docs/projects/{name}/backend/{svc}/test-specs/      - TST specs
    agent_docs/projects/{name}/performance/                   - Perf baselines

  PROJECT: {project-name-2}/
    ...

Documentation Health: .work/reports/doc-health.md
  Coverage: <overall %> (per-project breakdowns inside)
  TODO items: <total count> across <N> projects
  ALERT items: <total count> across <N> projects

Next Steps:
1. Business stakeholders validate reverse-engineered SRS per project
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
8. **Per-project isolation** — Each project gets dedicated subagents. 1 subagent per project per phase, running in parallel. Never let 1 subagent handle multiple projects.
9. **Structured registry** — `project_registry.yaml` is the SSOT for all phases. Every step reads from it; no step re-parses free-text scouting reports.
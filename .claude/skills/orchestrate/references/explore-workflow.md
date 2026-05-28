# Explore / Reverse Engineer Workflow

Extract documentation from an existing codebase. Generates HLD, LLD, and optionally SRS by analyzing code, configuration, and infrastructure files.

**Key rule:** NEVER fabricate. Everything must be detected FROM CODE. Write "Not detected in code" when unsure.

## Phase Overview

```
Scout Codebase → Extract HLD → Extract LLD (per service) → (Optional) Extract SRS → Assess Docs
       ↓            ↓ Gate          ↓ Gate                    ↓ Gate            ↓
```

---

## Step 1: Scout Codebase Structure

Delegate to Explore agent for comprehensive reconnaissance:

```
Agent type: Explore
Prompt: "Thoroughly scout this codebase for reverse engineering. Find and catalog:

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

---

## Step 2: Assess & Plan Documentation

Based on scouting, use AskUserQuestion to determine scope:

Ask: "What documentation should be generated from the codebase?" (header: "Doc Scope")
Options:
- "Full: HLD + LLD + SRS" (complete greenfield documentation)
- "Architecture only: HLD + LLD" (architecture and service design)
- "Fill gaps: supplement existing docs" (only what's missing or outdated)
- "LLD only: per-service deep dives"

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

## Step 5 (Optional): Extract SRS from Code

If the codebase has no SRS and user wants functional requirements extracted:

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

For each API endpoint / feature detected:
1. Infer the FR from what the code does (NOT what it should do)
2. Write Gherkin Scenario Outline (reconstruct from code paths)
3. Note: 'Reverse-engineered from: <file paths>'
4. Mark inferred requirements as: 'STATUS: Reverse-engineered - needs business validation'

CRITICAL: These are DETECTED requirements, not designed ones. Business stakeholders must validate.
Mark all as 'NEEDS VALIDATION'.

Output to: docs/product/features/epic-reverse/FR-reverse-{NNN}--{slug}.md"
```

### Gate Review (SRS)

```
Agent type: component-validator (or general-purpose)
Prompt: "Review the reverse-engineered SRS:

Read from:
- docs/product/features/epic-reverse/FR-reverse-*.md

Gate checklist:
1. [ ] Every FR cites the code files it was extracted from
2. [ ] All FRs marked 'NEEDS VALIDATION'
3. [ ] Gherkin scenarios are consistent with actual code behavior (spot check 3)
4. [ ] No fabricated requirements (code evidence for every claim)

Report: PASS / FAIL with specific issues."
```

---

## Step 6: Spec-Test Documentation Assessment

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
  docs/architecture/                       - High-Level Design (reverse-engineered)
  agent_docs/architecture.md               - Agent architecture summary
  agent_docs/domain-service-mapping.yaml   - Service mapping
  agent_docs/hard-boundaries.md            - Ownership boundaries
  agent_docs/contracts/                    - Events, API conventions
  agent_docs/tech-design/{service}.md      - Low-Level Design per service (<N> services)
  docs/product/features/epic-reverse/      - [if extracted] Reverse-engineered SRS

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

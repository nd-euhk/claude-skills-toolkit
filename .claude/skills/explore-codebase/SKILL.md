---
name: explore-codebase
description: >-
  Explore and analyze codebases end-to-end, generating full SDLC documentation (SRS, HLD, LLD, IMP, TST) with gate verification.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
  Supports multi-subproject discovery, plan mode, and sprint integration.
argument-hint: [full][architect][sync] [--auto]
version: 1.0.0
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep, AskUserQuestion, Agent, Skill, EnterPlanMode, ExitPlanMode
---

# Explore Codebase

Explore codebases end-to-end: scout sub-projects → generate SDLC documentation (SRS → HLD → LLD → IMP+TST) with gate verification → sync sprint artifacts → summarize.

## Quick Start

### Step 1: Parse Arguments

Extract from human input:
- **mode**: `full` → [Full Pipeline](#mode-full-pipeline) | `architect` → [Architect Only](#mode-architect-only) | `sync` → [Sync Mode](#mode-sync) | (empty) → AskUserQuestion
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Mode

```
INPUT: [full][architect][sync] [--auto]

MATCH mode:
  full      → Mode: Full Pipeline
  architect → Mode: Architect Only
  sync      → Mode: Sync
  (empty)   → AskUserQuestion to select mode
```

**If mode is empty**, use AskUserQuestion (single question):
- Question: "Which exploration mode do you want to run?" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

Then route based on the answer.

## Mode: Full Pipeline

Generate all SDLC artifacts (SRS, HLD, LLD, IMP, TST) with gate verification at each phase. Updates sprint artifacts on completion.

**Use when:** exploring a new codebase for the first time, need comprehensive documentation of the entire system.

**Flow:** Scout → Explore → Plan (unless --auto) → SDLC Pipeline → Merge (if multi-subproject) → Sprint → Summary.

## Mode: Architect Only

Generate only the High-Level Design (HLD) artifact with C4 diagrams, ADRs, and bounded context mapping. Gate-verified architecture only.

**Use when:** you only need to understand system architecture and service topology without deep implementation details. Faster than full pipeline — skips requirements, detailed design, and implementation specs.

**Flow:** Scout → Explore → Plan (unless --auto) → HLD → gate-verify → Summary.

Explicitly excludes: SRS, LLD, IMP, TST, Sprint Integration.

## Mode: Sync

Interactive mode for updating existing documentation. Uses AskUserQuestion to determine sync scope, then executes only the selected phases.

With `--auto`: skip plan mode and execute selected sync actions directly.

**Use when:** previously explored codebase needs updating, sprint artifacts need alignment, or specific artifact types need regeneration.

**Flow:** Use AskUserQuestion to ask what to sync:
- Question: "What do you want to sync?" (header: "Sync Scope", multiSelect: true)
- Options: "Everything (full pipeline)" | "Architecture documents only" | "Sprint artifacts only (roadmap/backlog/board)" | "Implementation specs only"

Then execute the corresponding phases based on selection. Plan mode applies per standard rules unless --auto.

## Phase 1: Scout — Discover Sub-Projects

Goal: determine how many sub-projects exist in the repository.

### Step 1.1: Check Git Submodules (preferred)

```bash
git submodule status 2>/dev/null
```

If submodules exist, record the count and path of each submodule.

### Step 1.2: If No Git Submodules

Use Bash and Grep to detect sub-projects via directory structure and build files:

```bash
# Check common monorepo structures
ls -d packages/*/ 2>/dev/null
ls -d apps/*/ 2>/dev/null
ls -d services/*/ 2>/dev/null
ls -d modules/*/ 2>/dev/null

# Check independent build files (excluding node_modules, target, vendor)
find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null
find . -maxdepth 3 -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null
find . -maxdepth 3 -name "go.mod" -not -path "*/vendor/*" 2>/dev/null
find . -maxdepth 3 -name "pom.xml" 2>/dev/null
```

### Step 1.3: Classify

- **1 project**: single project — subsequent phases run directly on the root directory
- **>1 project**: multi-subproject — create sandbox and run each subproject separately

### Step 1.4: Create Sandbox (Multi-Subproject Only)

```bash
SANDBOX=".work/reports/explore-$(date +%Y%m%d)--{slug}/sandbox"
mkdir -p "$SANDBOX"
```

Where `{slug}` is a URL-safe short identifier derived from the root directory name.

## Phase 2: Explore — Scout Each Sub-Project

### Step 2.1: Spawn Agent(Explore) Per Sub-Project

Based on the sub-project count from Phase 1, spawn Agent(Explore) for each sub-project in parallel.

**Brief for each Agent(Explore):**
```
Explore the sub-project at {path}. Return:
1. Technologies used (language, framework, database, message queue, etc.)
2. Main directory structure and purpose of each directory
3. Key modules/packages and their responsibilities
4. Entry points (main files, API routes, configs, CLI entry)
5. Dependencies (internal cross-module + external packages)
6. Architectural patterns in use (layered, hexagonal, microservices, CQRS, etc.)
```

### Step 2.2: Write Scout Reports

When each Agent(Explore) completes, spawn Agent(general-purpose) to write the report.

**Brief for Agent(general-purpose):**
```
Based on the Agent(Explore) output for sub-project {name}, write a scout report to:
.work/reports/explore-YYYYMMDD--{slug}/scout-{project-name}--{slug}.md

Organize into sections:
- Sub-project overview
- Technologies used
- Directory structure
- Modules and responsibilities
- Entry Points
- Dependencies (internal + external)
- Architectural patterns

If the target file already exists, back it up as .bak before overwriting.
```

## Phase 3: Plan — Create Execution Plan

### If --auto flag is present

Skip Phase 3, proceed directly to Phase 4.

### If --auto is NOT present

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to:
   - Clarify requirements with the human based on scout reports
   - Determine scope: which sub-projects need deep analysis
   - For multi-subproject: establish priority order
   - Use `Skill(sequential-thinking)` and `Skill(problem-solving)` as needed
   - Draft a detailed plan
3. When the human approves the plan, spawn `Agent(general-purpose)` to write it to:
   ```
   .work/plans/explore-YYYYMMDD--{slug}.md
   ```
4. Use `AskUserQuestion` to confirm:
   - Question: "Plan written. Continue to execution or review further?" (header: "Proceed")
   - Options: "Continue to execution" | "Let me review the plan first"
5. When ready, call `ExitPlanMode` to proceed.

## Phase 4: SDLC Pipeline

Execute phases sequentially with gate verification after each phase.

### Pipeline Flow

```
Agent(srs)
  → Agent(gate-verifier) → [re-spawn srs if reject]
→ Agent(hld)
  → Agent(gate-verifier) → [re-spawn hld if reject]
→ Agent(lld)
  → Agent(gate-verifier) → [re-spawn lld if reject]
→ Agent(imp) + Agent(tst) [parallel]
  → Agent(gate-verifier) × 2 [verify imp and tst in parallel]
```

### Sandbox Root

All agents read and write under a sandbox root. Set it once and pass to every spawn brief:

- **Single project:** `SANDBOX=".work/reports/explore-$(date +%Y%m%d)--{slug}"`
- **Multi-subproject:** `SANDBOX=".work/reports/explore-$(date +%Y%m%d)--{slug}/{project-name}"`

Create directories: `mkdir -p "$SANDBOX/docs/product/features" "$SANDBOX/docs/architecture/ADRs" "$SANDBOX/docs/architecture/diagrams" "$SANDBOX/agent_docs"`

### Spawn Briefs

Each agent operates in **reverse-engineering mode** — extracting from existing code behavior rather than enriching PRD drafts. Every brief must pass SANDBOX so the agent knows where to read inputs and write outputs. Output structure mirrors the standard SDLC layout (`docs/`, `agent_docs/`) but rooted under SANDBOX.

**Agent(srs):**
```
Reverse-engineering mode. Extract requirements from the codebase based on the scout report.

Input:
  - Scout report: {SANDBOX}/../scout-{project-name}--{slug}.md (single project)
    or {SANDBOX}/../../scout-{project-name}--{slug}.md (multi-subproject)

Output (under {SANDBOX}/):
  - docs/product/SRS.md
  - docs/product/features/epic-{domain}/FR-{DOMAIN}-{NNN}--{slug}.md (one per feature)
  - agent_docs/traceability/requirements-matrix.md

Templates: .claude/templates/srs/ unless overridden by spawn prompt.
```

**Agent(hld):**
```
Reverse-engineering mode. Extract architecture from the codebase based on the SRS and scout report.

Input:
  - SRS: {SANDBOX}/docs/product/SRS.md
  - Feature files: {SANDBOX}/docs/product/features/epic-*/FR-*.md
  - Traceability matrix: {SANDBOX}/agent_docs/traceability/requirements-matrix.md
  - Scout report: {SANDBOX}/../scout-{project-name}--{slug}.md (adjust path for multi-subproject)

Output (under {SANDBOX}/):
  - docs/architecture/system-architecture.md
  - docs/architecture/ADRs/ADR-001-service-decomposition.md
  - docs/architecture/ADRs/ADR-002-api-conventions.md
  - docs/architecture/ADRs/ADR-003-event-taxonomy.md
  - docs/architecture/diagrams/system-context.mermaid
  - docs/architecture/diagrams/container-diagram.mermaid
  - docs/architecture/diagrams/data-flow.mermaid
  - agent_docs/architecture.md
  - agent_docs/domain-service-mapping.yaml
  - agent_docs/hard-boundaries.md
  - agent_docs/contracts/api-conventions.md
  - agent_docs/contracts/events.md

Templates: .claude/templates/hld/ unless overridden by spawn prompt.
```

**Agent(lld):**
```
Reverse-engineering mode. Extract service internals from the codebase based on the HLD. Reverse-engineering LLD has 10 sections — adds "API Surface" as a separate section because endpoints are detected directly from controller source code.

Input:
  - Architecture summary: {SANDBOX}/agent_docs/architecture.md
  - Domain-service mapping: {SANDBOX}/agent_docs/domain-service-mapping.yaml
  - Hard boundaries: {SANDBOX}/agent_docs/hard-boundaries.md
  - API conventions: {SANDBOX}/agent_docs/contracts/api-conventions.md
  - Event contracts: {SANDBOX}/agent_docs/contracts/events.md
  - SRS: {SANDBOX}/docs/product/SRS.md
  - Feature files: {SANDBOX}/docs/product/features/epic-*/FR-*.md

Output (under {SANDBOX}/):
  - agent_docs/tech-design/README.md
  - agent_docs/tech-design/{service-name}-service.md (one per service, 10 sections)
  - agent_docs/tech-design/cross-cutting.md
  - agent_docs/contracts/api-{domain}.yaml (one per service with external APIs)
  - agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md (work packages, one per FR)

Templates: .claude/templates/lld/ unless overridden by spawn prompt.
```

**Agent(imp):**
```
Reverse-engineering mode. Extract implementation patterns from the codebase based on the LLD.

Input:
  - Work packages: {SANDBOX}/agent_docs/features/FR-*.md
  - Tech-design: {SANDBOX}/agent_docs/tech-design/{service}-service.md
  - API contracts: {SANDBOX}/agent_docs/contracts/api-{domain}.yaml
  - Cross-cutting: {SANDBOX}/agent_docs/tech-design/cross-cutting.md
  - Feature files: {SANDBOX}/docs/product/features/epic-*/FR-*.md

Output (under {SANDBOX}/):
  - agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md (backend features)
  - agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}-impl.md (frontend features)

Templates: .claude/templates/impl/ unless overridden by spawn prompt.
```

**Agent(tst):**
```
Reverse-engineering mode. Extract test coverage from existing test code and supplement gaps — rather than writing test specs from FRs for new features.

Input:
  - Implementation specs: {SANDBOX}/agent_docs/backend/*/implementation/FR-*-impl.md
  - Implementation specs: {SANDBOX}/agent_docs/frontend/*/implementation/FR-*-impl.md
  - Tech-design: {SANDBOX}/agent_docs/tech-design/{service}-service.md
  - SRS (NFR thresholds): {SANDBOX}/docs/product/SRS.md

Output (under {SANDBOX}/):
  - agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md
  - agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}-test.md
  - agent_docs/performance/nfr-mapping.md
  - agent_docs/performance/baseline.md

Templates: .claude/templates/tst/ unless overridden by spawn prompt.
```

**Agent(gate-verifier):**
```
Reverse-engineering mode. Verify artifact at {SANDBOX}/{artifact_relative_path} of type {srs|hld|lld|imp|tst}. Skip PRD/URD traceability — verify FR traces to source code locations instead. All other gate criteria apply as written.

Return: PASS with summary, or REJECT with specific reasons citing file:line evidence.
```

### Gate Verification

After each phase, spawn `Agent(gate-verifier)` to verify the output:
- Input: path to the artifact to verify + artifact type (srs/hld/lld/imp/tst)
- Output: pass/reject with specific reasons

**If gate REJECTs:**
- Re-spawn the preceding phase's agent (not the gate) with feedback from the gate
- Include feedback in the brief: "Gate verification failed with: {reasons}. Fix these issues and regenerate the artifact."
- Maximum 3 re-spawns per phase
- **After 3 failures**: stop the pipeline, report to human with accumulated feedback from all 3 rejections

## Phase 5: Merge (Multi-Subproject Only)

After all subprojects complete their SDLC pipelines, merge per-project sandboxes into unified artifacts. Each agent type merges its own domain — Agent(srs) consolidates SRS outputs from all projects, Agent(hld) consolidates HLD, etc.

Set `SANDBOX_ROOT` to the parent of per-project sandboxes:
```
SANDBOX_ROOT=".work/reports/explore-$(date +%Y%m%d)--{slug}"
```

Create merged directory: `mkdir -p "$SANDBOX_ROOT/merged/docs/product/features" "$SANDBOX_ROOT/merged/docs/architecture/ADRs" "$SANDBOX_ROOT/merged/docs/architecture/diagrams" "$SANDBOX_ROOT/merged/agent_docs"`

### Merge Flow

Each merge agent reads all per-project artifacts of its type and produces a single unified output. Run sequentially with gate verification:

```
Agent(srs) → Agent(gate-verifier)
→ Agent(hld) → Agent(gate-verifier)
→ Agent(lld) → Agent(gate-verifier)
→ Agent(imp) + Agent(tst) [parallel] → Agent(gate-verifier) × 2 [parallel]
```

Two types of files determine how each agent handles its merge:
- **Singular files** (SRS.md, system-architecture.md, domain-service-mapping.yaml, cross-cutting.md, nfr-mapping.md, etc.): written by every project → **MERGE nội dung**
- **Per-entity files** (FR-*.md, {service}-service.md, *-impl.md, *-test.md, api-*.yaml): mỗi project có file riêng → **COPY nguyên file**

### Merge Spawn Briefs

**Agent(srs) — merge:**
```
Reverse-engineering mode. Merge all per-project SRS artifacts into a unified cross-project SRS.

Input (all per-project SRS outputs):
  {SANDBOX_ROOT}/{project-1}/docs/product/SRS.md
  {SANDBOX_ROOT}/{project-1}/docs/product/features/epic-*/FR-*.md
  {SANDBOX_ROOT}/{project-1}/agent_docs/traceability/requirements-matrix.md
  {SANDBOX_ROOT}/{project-2}/docs/product/SRS.md
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

**Agent(hld) — merge:**
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

**Agent(lld) — merge:**
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

**Agent(imp) — merge:**
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

**Agent(tst) — merge:**
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

## Phase 6: Sprint Integration

Use `Skill(sprint)` to verify roadmap, backlog, and board.

### Step 6.1: Check Current State

```bash
ls .work/sprint/roadmap.md 2>/dev/null
ls .work/sprint/backlog.md 2>/dev/null
ls .work/sprint/board.md 2>/dev/null
```

### Step 6.2: Route Based on State

**First run (files don't exist or are empty):**
- Use `Skill(sprint)` to create new roadmap, backlog, board from SRS and HLD results
- Themes/epics/features are created from functional requirements and architecture

**Files exist but don't match template:**
- Backup: `cp file.md file.md.bak`
- Create new from template
- Notify human: "Existing sprint artifacts don't match template. Backed up as .bak. Please recheck."

**Files exist and match template:**
- Use `Skill(sprint)` to verify theme/epic/feature/task/story alignment
- Missing → add new entries and link them
- Extra → flag for human review

See `references/sprint-integration.md` for detailed integration logic.

## Phase 7: Summary

Spawn `Agent(general-purpose)` to write the summary.

**Brief:**
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
1. Project overview
2. System architecture (summary from HLD)
3. Functional requirements (summary from SRS)
4. Technical design (summary from LLD)
5. Implementation specs (summary from IMP)
6. Test strategy (summary from TST)
7. Sprint artifacts status
8. Risks and recommendations
9. Links to each detailed artifact
```

## Key Notes

**Gate verification limit.** Maximum 3 re-spawns per phase if gate rejects. After 3: stop pipeline, report to human. Never auto-retry beyond the limit.

**Re-spawn the right agent.** When gate rejects, re-spawn the preceding phase's agent (not the gate). Pass gate feedback into the agent's brief.

**Parallel execution.** IMP and TST run in parallel. Gate verify for IMP and TST runs in parallel. Merge agents follow the same pattern. Scout reports are also written in parallel.

**Agent briefs must be self-contained.** Each spawned agent receives a complete brief: scout report context, prior phase outputs, gate feedback (if re-spawning), and the specific deliverable expected.

**Sandbox for multi-subproject.** When >1 sub-project, all per-subproject outputs go into `.work/reports/explore-YYYYMMDD--{slug}/sandbox/{project-name}/`. The merge phase consolidates into the parent directory.

**Sprint integration.** Use `Skill(sprint)` for all sprint operations — never modify sprint files directly. Back up existing files as `.bak` before creating new ones.

**Error recovery.** If an agent errors (not gate reject), log the error, ask human whether to retry or skip. Never auto-retry on agent errors.

**Report paths.** Ensure `.work/reports/` and `.work/plans/` directories exist before writing. Use `mkdir -p`.

**Backup before overwrite.** Scout reports and sprint artifacts are backed up as `.bak` if the target file already exists.

## Reference Files

- `references/agent-brief-templates.md` — Detailed brief templates for each agent type: Explore, SRS, HLD, LLD, IMP, TST, gate-verifier, merge agents, general-purpose
- `references/sprint-integration.md` — Sprint integration logic details: creation, template verification, backup, update, adding new tasks/stories
- `references/report-templates.md` — Templates for scout reports, summary reports, and plan files

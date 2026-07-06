# human-docs v2.0.0 Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `human-docs` skill từ monolithic procedure (~290 dòng SKILL.md) sang Skill → Workflow → Agent architecture với JSON schema validation chặn hallucination, đồng thời loại bỏ BE/FE split giả tạo ở tầng SRS.

**Architecture:**
- `SKILL.md` → thin routing layer (~60-80 dòng): parse command → dispatch workflow script qua `Workflow()` tool
- Workflow scripts → orchestrators: spawn agent với JSON schema, collect + validate results, handle edge cases
- Agent definitions → single-purpose executors: Read source → Process/Transform → Write output, với schema validation
- Output simplification: `sync:product` giảm từ 4 file (SRS.md, SRS-BACKEND.md, SRS-FRONTEND.md, features/README.md) xuống 2 file (SRS.md, features/README.md)

**Tech Stack:** YAML frontmatter (agent/skill configs), JavaScript (workflow scripts via Workflow SDK), Markdown (output)

## File Map

```
skills/human-docs/
├── SKILL.md                              # [MODIFY] Rewrite: thin routing ~60-80 dòng
│
.claude/
├── agents/
│   ├── human-docs-sync-product.md        # [CREATE] Agent: FR → SRS.md + README.md transform
│   ├── human-docs-sync-architecture.md   # [CREATE] Agent: architecture.md → diagrams + ADR index
│   ├── human-docs-review.md              # [CREATE] Agent: Read-only consistency check
│   └── human-docs-update.md              # [CREATE] Agent: Incremental sync (mtime-based)
│
└── workflows/
    ├── human-docs-sync-product.js        # [CREATE] Parse FRs → spawn agent → write SRS.md + README.md
    ├── human-docs-sync-architecture.js   # [CREATE] Parse architecture.md → spawn agent → write diagrams + ADRs
    ├── human-docs-sync-all.js            # [CREATE] Pipeline tuần tự product → architecture
    ├── human-docs-review.js              # [CREATE] Read-only: spawn agent → return report
    └── human-docs-update.js              # [CREATE] Incremental: compare mtime → spawn agent → write
```

## Global Constraints

- `disable-model-invocation: true` — chỉ human invoke, Claude không tự kích hoạt
- `allowed-tools: Read, Write, Glob, Bash(*)` — least privilege cho skill
- Agent là SSOT (Single Source of Truth) — human-docs chỉ transform, không sinh nội dung mới
- Không copy FR/ADR riêng lẻ — chỉ index README trỏ về agent_docs
- Idempotent — chạy sync nhiều lần không tạo duplicate content
- Không xóa file human — file docs/ không có nguồn từ agent được giữ nguyên, flag trong review
- `permissionMode: acceptEdits` cho agents — auto-accept file writes trong agent execution
- Model: `sonnet` cho agents — đủ năng lực transform, không cần Opus

---

### Task 1: Agent `human-docs-sync-product` — FR → SRS.md + README.md

**Files:**
- Create: `.claude/agents/human-docs-sync-product.md`

**Interfaces:**
- Consumes: Reads `agent_docs/features/FR-*.md`, `agent_docs/traceability/requirements-matrix.md`, `agent_docs/project-overview.md`
- Produces: Writes `docs/product/SRS.md` (tổng quan + toàn bộ FR detail, không BE/FE split), `docs/product/features/README.md` (index trỏ về agent_docs)
- JSON Schema output: `{fr_count, features[{fr_id, title, priority, sprint, gherkin_scenarios}], nfrs[{id, metric, target}], traceability[{requirement, fr_id, test_id}]}`

- [ ] **Step 1: Create agent definition file**

Create `.claude/agents/human-docs-sync-product.md`:

```yaml
---
name: human-docs-sync-product
description: >-
  Transform FR files from agent_docs/features/ into human-readable SRS.md and
  features index README. Reads all FR-*.md files, aggregates into single SRS
  overview with NFR extraction and traceability, creates features index pointing
  back to agent_docs source files. Agent is SSOT — this agent only transforms,
  never invents content. No BE/FE split at SRS level.
model: sonnet
tools: Read, Write, Glob, Bash
permissionMode: acceptEdits
---
```

- [ ] **Step 2: Append system prompt body**

Append after frontmatter (separated by `---`) — the complete system prompt:

```markdown
You are a documentation transformer. Your job is to read agent-facing specs and produce human-readable documentation. You do NOT invent content — you ONLY transform what exists in agent_docs/.

## Input Detection

1. Read all `agent_docs/features/FR-*.md` files (REQUIRED)
2. Read `agent_docs/traceability/requirements-matrix.md` if it exists
3. Read `agent_docs/project-overview.md` for project name and context
4. If no FR files exist → report "No FR files found in agent_docs/features/" and stop

## Procedure

### Step 1: Parse all FR files

For each FR file, extract:
- FR ID (from filename: `FR-{DOMAIN}-{NNN}--{slug}.md`)
- Title (from frontmatter or first heading)
- Priority (from frontmatter: Must, Should, Could, Won't)
- Sprint (from frontmatter if present, otherwise "Unassigned")
- Gherkin scenario count (count `Scenario:` and `Scenario Outline:` blocks)
- Layer (from frontmatter: BE, FE, BE+FE — for display only, NOT for file splitting)

### Step 2: Extract NFRs

Search all FR files for quantified thresholds:
- Performance: `p95 < Xms`, `throughput > Y req/s`, `LCP < Xs`, `FID < Yms`
- Availability: `99.X%`, `RTO < Z min`, `RPO < W min`
- Security: `OWASP`, `encryption`, `auth`, `rate limit`
- Assign NFR IDs: NFR-PERF-001, NFR-AVAIL-001, NFR-SEC-001, etc.

### Step 3: Build traceability

From `requirements-matrix.md` if it exists, or extract links from FR file `depends_on` / `referenced_by` frontmatter.

### Step 4: Generate SRS.md

Write `docs/product/SRS.md` with this exact structure:

1. **Header** — title, source info, last synced timestamp
2. **Functional Requirements Overview** — table: FR ID | Feature | Priority | Sprint | Source (link to agent_docs)
3. **Feature Details** — for each FR: Description, Preconditions, Process summary, Key Gherkin scenario, Constraints
4. **Non-Functional Requirements** — table: NFR ID | Metric | Target | Source FR
5. **Traceability Matrix** — table: Requirement | FR ID | Test ID

IMPORTANT: Do NOT create SRS-BACKEND.md or SRS-FRONTEND.md. The `layer` field in each FR is displayed as metadata in the FR detail section only. BE/FE split belongs at HLD/LLD level, not SRS.

### Step 5: Generate features/README.md

Write `docs/product/features/README.md` — simple index table:

| FR ID | Feature | Priority | Sprint | Layer | Full Spec |
|-------|---------|----------|--------|-------|-----------|
| FR-AUTH-001 | User Login | Must | Sprint 1 | BE+FE | [→](../../agent_docs/features/FR-AUTH-001.md) |

### Step 6: Create directories

Ensure `docs/product/` and `docs/product/features/` exist before writing.

### Step 7: Report structured output

After writing all files, output a JSON summary (this is used by the workflow script for validation):

```json
{
  "fr_count": 3,
  "features": [
    {"fr_id": "FR-AUTH-001", "title": "User Login", "priority": "Must", "sprint": "Sprint 1", "gherkin_scenarios": 3}
  ],
  "nfrs": [
    {"id": "NFR-PERF-001", "metric": "p95 latency", "target": "< 200ms"}
  ],
  "traceability": [
    {"requirement": "BR-001", "fr_id": "FR-AUTH-001", "test_id": "TC-AUTH-001"}
  ],
  "files_written": ["docs/product/SRS.md", "docs/product/features/README.md"]
}
```

## Hard Boundaries

- NEVER invent content — if a field is missing from source, write "Not specified" or omit
- NEVER create SRS-BACKEND.md or SRS-FRONTEND.md — these are REMOVED in v2.0.0
- NEVER write to agent_docs/ — agent_docs is the SSOT source, never modified
- NEVER copy individual FR files to docs/ — only index README
- ALWAYS preserve the `layer` field as metadata for display, never use it to split files
- ALL output files get `> **Source**: agent_docs/features/ (N FRs) | **Last synced**: {timestamp}` header
```

- [ ] **Step 3: Validate agent YAML frontmatter**

```bash
grep -c "^---$" .claude/agents/human-docs-sync-product.md
# Expected: 2 (opening and closing --- for YAML frontmatter)
grep "^name:" .claude/agents/human-docs-sync-product.md
# Expected: name: human-docs-sync-product
grep "^model:" .claude/agents/human-docs-sync-product.md
# Expected: model: sonnet
grep "^tools:" .claude/agents/human-docs-sync-product.md
# Expected: tools: Read, Write, Glob, Bash
grep "^permissionMode:" .claude/agents/human-docs-sync-product.md
# Expected: permissionMode: acceptEdits
```

- [ ] **Step 4: Verify agent matches spec requirements**

Check against spec §5 (Agent JSON Schemas):
- [ ] `fr_count` field in output schema
- [ ] `features` array with `fr_id, title, priority, sprint, gherkin_scenarios`
- [ ] `nfrs` array with `id, metric, target`
- [ ] `traceability` array with `requirement, fr_id, test_id`
- [ ] No BE/FE split in output
- [ ] Output reduced to 2 files (SRS.md + features/README.md)

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/human-docs-sync-product.md
git commit -m "feat(human-docs): add sync-product agent with JSON schema validation

- Agent transforms agent_docs/features/FR-*.md → docs/product/SRS.md + README.md
- JSON schema gates output: fr_count, features[], nfrs[], traceability[]
- No BE/FE split at SRS level per v2.0.0 spec
- layer field preserved as metadata only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Agent `human-docs-sync-architecture` — Architecture Diagrams + ADR Index

**Files:**
- Create: `.claude/agents/human-docs-sync-architecture.md`

**Interfaces:**
- Consumes: Reads `agent_docs/architecture.md`, `agent_docs/adrs/ADR-*.md`
- Produces: Writes `docs/architecture/system-architecture.md`, `docs/architecture/diagrams/*.mermaid`, `docs/architecture/ADRs/README.md`

- [ ] **Step 1: Create agent definition file**

Create `.claude/agents/human-docs-sync-architecture.md`:

```yaml
---
name: human-docs-sync-architecture
description: >-
  Transform architecture.md and ADR files from agent_docs/ into human-readable
  architecture documentation. Extracts C4 Mermaid diagrams into separate files,
  generates narrative system architecture overview, and creates ADR index
  pointing back to agent_docs source. Read-only on agent_docs/ — only writes
  to docs/architecture/.
model: sonnet
tools: Read, Write, Glob, Bash
permissionMode: acceptEdits
---
```

- [ ] **Step 2: Append system prompt body**

```markdown
You are a documentation transformer specializing in architecture artifacts. You read agent-facing architecture specs and produce human-readable architecture documentation. You do NOT invent content.

## Input Detection

1. Read `agent_docs/architecture.md` (REQUIRED)
2. Read all `agent_docs/adrs/ADR-*.md` files
3. Read `agent_docs/adrs/README.md` for existing ADR index metadata
4. If `architecture.md` does not exist → report "No architecture.md found" and stop

## Procedure

### Step 1: Parse architecture.md

Extract:
- Architecture style declaration
- All Mermaid code blocks (```mermaid ... ```) — C4 Context, Container, Component diagrams
- Communication patterns, data architecture, security architecture sections
- Service details (stack, responsibilities, dependencies)

### Step 2: Extract Mermaid diagrams

For each Mermaid block found:
- `c4-context.mermaid` — the C4 System Context diagram
- `c4-container.mermaid` — the C4 Container diagram
- `c4-component-{name}.mermaid` — per-service component diagrams (if present)

If no Mermaid blocks found → warn "No C4 diagrams found in architecture.md — skipping diagrams/" and skip diagram extraction.

Write diagrams to `docs/architecture/diagrams/`.

### Step 3: Generate system-architecture.md

Write `docs/architecture/system-architecture.md`:

1. **Header** — title, source, last synced timestamp
2. **Architecture Overview** — narrative condensed from C4 context (2-3 paragraphs)
3. **C4 Context Diagram** — embed `diagrams/c4-context.mermaid`
4. **C4 Container Diagram** — embed `diagrams/c4-container.mermaid`
5. **Service Details** — per service: stack, responsibilities, dependencies, ADR links
6. **Architectural Decisions** — link to ADR index

### Step 4: Generate ADRs/README.md

Write `docs/architecture/ADRs/README.md` — index table:

| ADR | Decision | Status | Date | Full Spec |
|-----|----------|--------|------|-----------|
| ADR-001 | Service Decomposition | Accepted | 2026-06-15 | [→](../../agent_docs/adrs/ADR-001--service-decomposition.md) |

Extract from ADR frontmatter: title (from `title` field or first heading), status, date.

### Step 5: Create directories

Ensure `docs/architecture/diagrams/` and `docs/architecture/ADRs/` exist before writing.

### Step 6: Report structured output

```json
{
  "architecture_status": "ok",
  "diagrams_extracted": 2,
  "diagram_names": ["c4-context.mermaid", "c4-container.mermaid"],
  "adrs_indexed": 3,
  "adr_list": ["ADR-001", "ADR-002", "ADR-003"],
  "warnings": [],
  "files_written": ["docs/architecture/system-architecture.md", "docs/architecture/diagrams/c4-context.mermaid", "docs/architecture/ADRs/README.md"]
}
```

## Hard Boundaries

- NEVER copy individual ADR files to docs/ — only index README
- NEVER modify agent_docs/ — it is the SSOT source
- If architecture.md has no Mermaid blocks → warn, skip diagrams/, still generate system-architecture.md with narrative only
- If no ADR files → ADRs/README.md with note "No architectural decisions yet"
- ALL output files get `> **Source**: agent_docs/architecture.md | **Last synced**: {timestamp}` header
```

- [ ] **Step 3: Validate agent**

```bash
grep -c "^---$" .claude/agents/human-docs-sync-architecture.md  # Expected: 2
grep "^name:" .claude/agents/human-docs-sync-architecture.md     # Expected: human-docs-sync-architecture
grep "^model:" .claude/agents/human-docs-sync-architecture.md    # Expected: sonnet
```

- [ ] **Step 4: Verify against spec §8 (unchanged items)**

- [ ] sync:architecture output giữ nguyên: system-architecture.md + diagrams/*.mermaid + ADRs/README.md
- [ ] Không copy ADR riêng lẻ

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/human-docs-sync-architecture.md
git commit -m "feat(human-docs): add sync-architecture agent

- Extracts C4 Mermaid diagrams from architecture.md
- Generates system-architecture.md with narrative + embedded diagrams
- Creates ADR index pointing to agent_docs/adrs/
- No individual ADR copy — index README only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Agent `human-docs-review` — Read-Only Consistency Check

**Files:**
- Create: `.claude/agents/human-docs-review.md`

**Interfaces:**
- Consumes: Reads `agent_docs/` (features/, adrs/, architecture.md) + `docs/` (product/, architecture/) — READ-ONLY
- Produces: JSON report with status per file — NEVER writes

- [ ] **Step 1: Create agent definition file**

Create `.claude/agents/human-docs-review.md`:

```yaml
---
name: human-docs-review
description: >-
  Read-only consistency check between agent_docs/ and docs/. Compares source
  (agent_docs) with output (docs), classifies each file into 5 states: synced,
  stale, missing, orphan, diverged. Never modifies any files. Use when checking
  if human docs are up-to-date with agent SSOT.
model: sonnet
tools: Read, Glob, Bash
permissionMode: acceptEdits
---
```

- [ ] **Step 2: Append system prompt body**

```markdown
You are a documentation consistency checker. Your job is to compare agent_docs/ (SSOT source) with docs/ (human output) and report discrepancies. You are READ-ONLY — never write or modify files.

## Input Detection

1. List all `agent_docs/features/FR-*.md` files
2. List all `agent_docs/adrs/ADR-*.md` files
3. Check `agent_docs/architecture.md` exists
4. Check corresponding outputs in `docs/product/` and `docs/architecture/`
5. If `agent_docs/` does not exist → report "agent_docs/ not found — nothing to review"

## Procedure

### Step 1: Scan agent_docs/

Enumerate all source files:
- `agent_docs/features/FR-*.md` — count and list FR IDs
- `agent_docs/architecture.md` — check mtime
- `agent_docs/adrs/ADR-*.md` — count and list ADR IDs

### Step 2: Scan docs/

Enumerate all output files:
- `docs/product/SRS.md` — check exists, parse `Last synced` timestamp
- `docs/product/features/README.md` — check exists, compare FR count
- `docs/architecture/system-architecture.md` — check exists
- `docs/architecture/diagrams/*.mermaid` — check against architecture.md diagrams
- `docs/architecture/ADRs/README.md` — check exists, compare ADR count

### Step 3: Classify each file

Use 5 states (from spec §8):

| Status | Icon | Meaning |
|--------|------|---------|
| `synced` | ✅ | Docs up-to-date with agent source |
| `stale` | ⚠️ | Agent source changed but docs not updated (mtime comparison) |
| `missing` | ❌ | Agent source exists but no corresponding doc file |
| `orphan` | 👻 | Doc file exists but no corresponding agent source |
| `diverged` | 🔀 | Both exist but content differs significantly |

Detection logic:
- **stale**: Compare mtime of agent source file vs docs `Last synced` timestamp. If agent source mtime > docs timestamp → stale
- **missing**: Agent file exists, corresponding doc file does not exist
- **orphan**: Doc file exists, corresponding agent file does not exist
- **diverged**: Both exist and mtime suggests sync, but FR count / ADR count / diagram count mismatch
- **synced**: All checks pass

### Step 4: Generate report

Output structured JSON:

```json
{
  "entries": [
    {"path": "docs/product/SRS.md", "status": "synced", "reason": "3 FRs, last synced 2026-07-03"},
    {"path": "docs/product/SRS-BACKEND.md", "status": "orphan", "reason": "No corresponding agent source (v1.0.0 artifact)"},
    {"path": "docs/architecture/system-architecture.md", "status": "stale", "reason": "architecture.md modified after last sync"}
  ],
  "summary": {
    "synced": 5,
    "stale": 1,
    "missing": 0,
    "orphan": 1,
    "diverged": 0
  }
}
```

IMPORTANT: Existing v1.0.0 files (SRS-BACKEND.md, SRS-FRONTEND.md) should be flagged as `orphan` — they have no agent source counterpart in v2.0.0.

## Hard Boundaries

- NEVER write files — this is a READ-ONLY agent
- NEVER modify agent_docs/ or docs/
- ALWAYS report existing v1.0.0 files (SRS-BACKEND.md, SRS-FRONTEND.md) as orphan
- If `docs/` directory does not exist → all agent files are `missing`
```

- [ ] **Step 3: Validate agent**

```bash
grep -c "^---$" .claude/agents/human-docs-review.md  # Expected: 2
grep "^name:" .claude/agents/human-docs-review.md     # Expected: human-docs-review
grep "^tools:" .claude/agents/human-docs-review.md    # Should have Read, Glob, Bash (NO Write)
```

- [ ] **Step 4: Verify against spec §5 (review JSON schema)**

- [ ] `entries` array with `path, status, reason`
- [ ] `status` enum: synced, stale, missing, orphan, diverged
- [ ] `summary` object with counts per status

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/human-docs-review.md
git commit -m "feat(human-docs): add review agent for read-only consistency check

- Read-only agent compares agent_docs/ ↔ docs/
- 5-state classification: synced, stale, missing, orphan, diverged
- Detects v1.0.0 orphan files (SRS-BACKEND.md, SRS-FRONTEND.md)
- JSON schema validated output

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: Agent `human-docs-update` — Incremental Sync

**Files:**
- Create: `.claude/agents/human-docs-update.md`

**Interfaces:**
- Consumes: Reads `docs/product/SRS.md` (parses `Last synced` timestamp), reads `agent_docs/features/FR-*.md` (checks mtime)
- Produces: Writes updated sections of `docs/product/SRS.md` and/or `docs/architecture/system-architecture.md` — only changed content

- [ ] **Step 1: Create agent definition file**

Create `.claude/agents/human-docs-update.md`:

```yaml
---
name: human-docs-update
description: >-
  Incremental sync — only updates docs/ files when agent_docs/ sources have
  changed. Compares mtime timestamps to avoid full re-sync. Falls back to
  full sync if no timestamp available. Handles both product (FR changes)
  and architecture (architecture.md + ADR changes) incrementally.
model: sonnet
tools: Read, Write, Glob, Bash
permissionMode: acceptEdits
---
```

- [ ] **Step 2: Append system prompt body**

```markdown
You are an incremental documentation updater. Your job is to sync only what changed between agent_docs/ and docs/, minimizing unnecessary writes.

## Input Detection

1. Read `docs/product/SRS.md` — parse `Last synced` timestamp from header
2. Read `docs/architecture/system-architecture.md` — parse `Last synced` timestamp
3. List `agent_docs/features/FR-*.md` — check mtime of each file
4. Check `agent_docs/architecture.md` mtime
5. List `agent_docs/adrs/ADR-*.md` — check mtime of each file
6. If no timestamp found in existing docs → fallback mode: report "No timestamp — requesting full sync"

## Procedure

### Step 1: Determine what changed

For each agent source file, compare mtime with the `Last synced` timestamp from the corresponding output:

- FR files newer than SRS.md timestamp → need product re-sync
- architecture.md newer than system-architecture.md timestamp → need architecture re-sync
- ADR files newer than ADRs/README.md timestamp → need ADR index update
- New FR files (not in existing features/README.md index) → need product re-sync
- Deleted FR files (in index but file missing) → need product re-sync

### Step 2: Execute targeted sync

**Product changes detected:**
- Re-scan all FR files (to catch additions + deletions)
- Rebuild SRS.md (full rebuild of aggregate sections)
- Rebuild features/README.md
- Preserve any human-added content outside synced sections (marked with `<!-- human-managed -->` comments)

**Architecture changes detected:**
- Re-extract Mermaid diagrams if architecture.md changed
- Rebuild system-architecture.md narrative
- Update ADRs/README.md index if ADR files added/removed

**No changes detected:**
- Report "Already up-to-date" for each section

### Step 3: Update timestamps

After sync, update `Last synced` timestamp in each modified output file.

### Step 4: Report structured output

```json
{
  "mode": "incremental",
  "product": {
    "status": "updated",
    "new_frs": ["FR-AUTH-004"],
    "modified_frs": ["FR-AUTH-001"],
    "deleted_frs": [],
    "files_written": ["docs/product/SRS.md", "docs/product/features/README.md"]
  },
  "architecture": {
    "status": "unchanged",
    "files_written": []
  },
  "summary": "2 FRs changed, 2 files updated, 0 warnings"
}
```

If no timestamp found (fallback):

```json
{
  "mode": "fallback",
  "reason": "No Last synced timestamp found in existing docs",
  "recommendation": "Run /human-docs sync:all for full re-sync"
}
```

## Hard Boundaries

- NEVER modify agent_docs/ — SSOT source
- If no timestamp → fallback, do NOT guess
- Only re-sync what changed — do NOT do full sync unless forced
- Preserve `<!-- human-managed -->` sections in output files
- Update `Last synced` timestamp after every successful write
```

- [ ] **Step 3: Validate agent**

```bash
grep -c "^---$" .claude/agents/human-docs-update.md  # Expected: 2
grep "^name:" .claude/agents/human-docs-update.md     # Expected: human-docs-update
grep "^tools:" .claude/agents/human-docs-update.md    # Should have Read, Write, Glob, Bash
```

- [ ] **Step 4: Verify against spec §8 (unchanged update logic)**

- [ ] Incremental logic giữ nguyên: so sánh mtime timestamp
- [ ] Fallback: nếu không có timestamp → chạy sync:all

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/human-docs-update.md
git commit -m "feat(human-docs): add update agent for incremental sync

- Compares mtime timestamps to detect changes
- Only re-syncs changed FRs/ADRs — minimizes writes
- Falls back to full sync recommendation if no timestamp
- Preserves human-managed sections in output files

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Workflow Scripts — Orchestration Layer

**Files:**
- Create: `.claude/workflows/human-docs-sync-product.js`
- Create: `.claude/workflows/human-docs-sync-architecture.js`
- Create: `.claude/workflows/human-docs-sync-all.js`
- Create: `.claude/workflows/human-docs-review.js`
- Create: `.claude/workflows/human-docs-update.js`

**Interfaces:**
- Consumes: `agent()` SDK, `log()` SDK, `phase()` SDK
- Produces: Dispatches agents from Tasks 1-4, collects results, reports

- [ ] **Step 1: Create `human-docs-sync-product.js`**

```javascript
export const meta = {
  name: 'human-docs-sync-product',
  description: 'Sync agent_docs/features/FR-*.md → docs/product/SRS.md + features/README.md',
  phases: [
    { title: 'Parse', detail: 'Read FR files and validate inputs' },
    { title: 'Generate', detail: 'Spawn sync-product agent to generate human docs' },
  ],
}

// JSON schema for agent output validation (from spec §5)
const SYNC_PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    fr_count: { type: 'number' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fr_id: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          sprint: { type: 'string' },
          gherkin_scenarios: { type: 'number' },
        },
        required: ['fr_id', 'title', 'priority', 'gherkin_scenarios'],
      },
    },
    nfrs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          metric: { type: 'string' },
          target: { type: 'string' },
        },
        required: ['id', 'metric', 'target'],
      },
    },
    traceability: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          fr_id: { type: 'string' },
          test_id: { type: 'string' },
        },
        required: ['requirement', 'fr_id'],
      },
    },
    files_written: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['fr_count', 'features'],
}

phase('Parse')

// Edge case: Check agent_docs/ exists
const agentDocsDir = 'agent_docs'
try {
  const check = await agent(
    `Check if ${agentDocsDir}/ directory exists and contains features/FR-*.md files.
     List all FR files found. If no files, report "No FR files found".`,
    { label: 'check-inputs', phase: 'Parse' }
  )
  if (!check || check.includes('No FR files')) {
    log('⚠️ No FR files found in agent_docs/features/ — SRS will be empty with note')
  }
  log(`Input check: ${check ? check.substring(0, 200) : 'no output'}`)
} catch (e) {
  log(`ERROR checking inputs: ${e.message || e}`)
}

phase('Generate')

log('Spawning human-docs-sync-product agent...')

const result = await agent(
  `Sync agent_docs/features/FR-*.md → docs/product/SRS.md + docs/product/features/README.md.

Follow your standard procedure:
1. Read all FR files
2. Parse: FR ID, title, priority, Gherkin scenarios
3. Extract NFRs with quantified thresholds
4. Build traceability from requirements-matrix.md
5. Generate SRS.md (NO BE/FE split — layer field is metadata only)
6. Generate features/README.md index
7. Create directories if needed
8. Report structured output`,
  {
    label: 'sync-product',
    phase: 'Generate',
    agentType: 'human-docs-sync-product',
    schema: SYNC_PRODUCT_SCHEMA,
  }
)

if (!result) {
  log('❌ sync:product failed — agent returned null')
  return {
    status: 'failed',
    error: 'Agent returned null — possible hallucination or tool error',
    fr_count: 0,
    features: [],
    nfrs: [],
    files_written: [],
  }
}

const { fr_count, features, nfrs, traceability, files_written } = result

log(`✅ sync:product — ${fr_count} FRs → ${(files_written || []).join(', ')}`)
if (nfrs && nfrs.length > 0) {
  log(`   NFRs extracted: ${nfrs.map(n => n.id).join(', ')}`)
}

return { status: 'completed', fr_count, features, nfrs, traceability, files_written }
```

- [ ] **Step 2: Create `human-docs-sync-architecture.js`**

```javascript
export const meta = {
  name: 'human-docs-sync-architecture',
  description: 'Sync agent_docs/architecture.md + adrs/ → docs/architecture/',
  phases: [
    { title: 'Parse', detail: 'Read architecture.md and ADR files' },
    { title: 'Generate', detail: 'Spawn sync-architecture agent to generate human docs' },
  ],
}

phase('Parse')

// Edge case: Check architecture.md exists
const archCheck = await agent(
  `Check if agent_docs/architecture.md exists and whether it contains Mermaid C4 diagrams.
   Also check agent_docs/adrs/ for ADR files.
   Report: "architecture.md: [found/not found], Mermaid blocks: [count], ADRs: [count]"`,
  { label: 'check-arch-inputs', phase: 'Parse' }
)

const hasArchitecture = archCheck && archCheck.includes('architecture.md: found')
const hasMermaid = archCheck && !archCheck.includes('Mermaid blocks: 0')
const hasADRs = archCheck && !archCheck.includes('ADRs: 0')

if (!hasArchitecture) {
  log('⚠️ No architecture.md found')
  return { status: 'skipped', reason: 'No architecture.md in agent_docs/' }
}

if (!hasMermaid) {
  log('⚠️ No Mermaid diagrams in architecture.md — will skip diagrams/')
}

log(`Architecture inputs: Mermaid=${hasMermaid}, ADRs=${hasADRs ? 'yes' : 'none'}`)

phase('Generate')

log('Spawning human-docs-sync-architecture agent...')

const result = await agent(
  `Sync agent_docs/architecture.md + agent_docs/adrs/ADR-*.md → docs/architecture/.

Follow your standard procedure:
1. Read architecture.md
2. Extract C4 Mermaid diagrams → docs/architecture/diagrams/*.mermaid
3. Generate system-architecture.md with narrative + embedded diagrams
4. Generate ADRs/README.md index (no individual ADR copy)
5. Create directories if needed
6. Report structured output`,
  {
    label: 'sync-architecture',
    phase: 'Generate',
    agentType: 'human-docs-sync-architecture',
  }
)

if (!result) {
  log('❌ sync:architecture failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

log(`✅ sync:architecture — ${result.diagrams_extracted || 0} diagrams + ${result.adrs_indexed || 0} ADRs indexed`)

return { status: 'completed', ...result }
```

- [ ] **Step 3: Create `human-docs-sync-all.js`**

```javascript
export const meta = {
  name: 'human-docs-sync-all',
  description: 'Run sync:product → sync:architecture sequentially',
  phases: [
    { title: 'Product', detail: 'sync:product — FRs → SRS.md + README.md' },
    { title: 'Architecture', detail: 'sync:architecture — architecture.md → diagrams + ADRs' },
    { title: 'Report', detail: 'Summary of all sync operations' },
  ],
}

phase('Product')
log('▶️ Phase 1/2: sync:product')

const productResult = await agent(
  `Run the human-docs-sync-product workflow. Read agent_docs/features/FR-*.md and generate docs/product/SRS.md + docs/product/features/README.md. No BE/FE split. Report structured output.`,
  {
    label: 'sync-product',
    phase: 'Product',
    agentType: 'human-docs-sync-product',
  }
)

if (!productResult) {
  log('❌ sync:product failed')
  return { status: 'failed', phase: 'product' }
}

const frCount = productResult.fr_count || 0
log(`✅ sync:product — ${frCount} FRs processed`)

phase('Architecture')
log('▶️ Phase 2/2: sync:architecture')

const archResult = await agent(
  `Run the human-docs-sync-architecture workflow. Read agent_docs/architecture.md and generate docs/architecture/system-architecture.md + diagrams/ + ADRs/README.md. Report structured output.`,
  {
    label: 'sync-architecture',
    phase: 'Architecture',
    agentType: 'human-docs-sync-architecture',
  }
)

if (!archResult) {
  log('⚠️ sync:architecture returned null — may have no architecture.md')
}

phase('Report')

const totalFiles = [...(productResult.files_written || []), ...(archResult?.files_written || [])]
const totalWarnings = [
  ...(productResult.warnings || []),
  ...(archResult?.warnings || []),
]

log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
log(`Done: ${totalFiles.length} files written, ${totalWarnings.length} warnings`)
totalFiles.forEach(f => log(`  ✅ ${f}`))
totalWarnings.forEach(w => log(`  ⚠️ ${w}`))

return {
  status: 'completed',
  product: { fr_count: frCount, files: productResult.files_written || [] },
  architecture: archResult || { status: 'skipped' },
  total_files: totalFiles.length,
  total_warnings: totalWarnings.length,
}
```

- [ ] **Step 4: Create `human-docs-review.js`**

```javascript
export const meta = {
  name: 'human-docs-review',
  description: 'Read-only consistency check between agent_docs/ and docs/',
  phases: [
    { title: 'Review', detail: 'Compare agent_docs/ ↔ docs/ and classify each file' },
  ],
}

// JSON schema for review output (from spec §5)
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          status: { type: 'string', enum: ['synced', 'stale', 'missing', 'orphan', 'diverged'] },
          reason: { type: 'string' },
        },
        required: ['path', 'status', 'reason'],
      },
    },
    summary: {
      type: 'object',
      properties: {
        synced: { type: 'number' },
        stale: { type: 'number' },
        missing: { type: 'number' },
        orphan: { type: 'number' },
        diverged: { type: 'number' },
      },
      required: ['synced', 'stale', 'missing', 'orphan'],
    },
  },
  required: ['entries', 'summary'],
}

phase('Review')

log('Spawning human-docs-review agent (READ-ONLY)...')

const result = await agent(
  `Review consistency between agent_docs/ and docs/. Compare all files, classify each.

Follow your procedure:
1. Scan agent_docs/: features/FR-*.md, architecture.md, adrs/ADR-*.md
2. Scan docs/: product/SRS.md, product/features/README.md, architecture/system-architecture.md, architecture/diagrams/, architecture/ADRs/README.md
3. Classify each file: synced, stale, missing, orphan, diverged
4. Flag v1.0.0 artifacts (SRS-BACKEND.md, SRS-FRONTEND.md) as orphan
5. Report structured output

DO NOT write any files.`,
  {
    label: 'review',
    phase: 'Review',
    agentType: 'human-docs-review',
    schema: REVIEW_SCHEMA,
  }
)

if (!result) {
  log('❌ review failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

const { entries, summary } = result
const { synced, stale, missing, orphan, diverged } = summary

log(`docs/product/  ─────────────────────────────────`)
entries.filter(e => e.path.startsWith('docs/product/')).forEach(e => {
  const icons = { synced: '✅', stale: '⚠️', missing: '❌', orphan: '👻', diverged: '🔀' }
  log(`  ${icons[e.status] || '❓'} ${e.path} (${e.status} — ${e.reason})`)
})

log(`docs/architecture/  ────────────────────────────`)
entries.filter(e => e.path.startsWith('docs/architecture/')).forEach(e => {
  const icons = { synced: '✅', stale: '⚠️', missing: '❌', orphan: '👻', diverged: '🔀' }
  log(`  ${icons[e.status] || '❓'} ${e.path} (${e.status} — ${e.reason})`)
})

log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
log(`Summary: ${synced} synced, ${stale} stale, ${missing} missing, ${orphan} orphan${diverged ? `, ${diverged} diverged` : ''}`)

const action = stale > 0 || missing > 0
  ? `run "/human-docs update" to fix ${stale + missing} out-of-date files`
  : 'All docs up-to-date ✅'

log(`Action: ${action}`)

return { status: 'completed', entries, summary, action }
```

- [ ] **Step 5: Create `human-docs-update.js`**

```javascript
export const meta = {
  name: 'human-docs-update',
  description: 'Incremental sync — only update changed files based on mtime comparison',
  phases: [
    { title: 'Detect', detail: 'Compare mtime timestamps to find changes' },
    { title: 'Update', detail: 'Spawn update agent for incremental sync' },
  ],
}

phase('Detect')

// Check if synced docs exist and have timestamps
const detectionResult = await agent(
  `Check docs/ for existing synced files and their Last synced timestamps:
1. Read docs/product/SRS.md — parse "Last synced: <timestamp>" from header (if exists)
2. Read docs/architecture/system-architecture.md — parse timestamp (if exists)
3. Compare with current mtime of agent_docs/features/FR-*.md, agent_docs/architecture.md, agent_docs/adrs/ADR-*.md
4. Report: which sources are newer than their corresponding output timestamps

If docs/ files don't exist → report "No synced docs — need full sync"
If no timestamp in headers → report "No timestamp — falling back to full sync"
If all sources older than timestamps → report "Already up-to-date"`,
  { label: 'detect-changes', phase: 'Detect' }
)

if (!detectionResult) {
  log('⚠️ Detection failed — recommending full sync')
  return { status: 'fallback', recommendation: 'Run /human-docs sync:all' }
}

const fallbackNeeded =
  detectionResult.includes('No synced docs') ||
  detectionResult.includes('No timestamp') ||
  detectionResult.includes('need full sync')

if (fallbackNeeded) {
  log('⚠️ Cannot incremental sync — falling back to sync:all')
  log('Recommendation: Run /human-docs sync:all')

  return {
    status: 'fallback',
    reason: detectionResult,
    recommendation: 'Run /human-docs sync:all for full re-sync',
  }
}

if (detectionResult.includes('Already up-to-date')) {
  log('✅ All docs already up-to-date — nothing to sync')
  return { status: 'completed', changes: 'none', files_written: [] }
}

phase('Update')

log('Changes detected — spawning human-docs-update agent for incremental sync...')

const result = await agent(
  `Perform incremental sync. Only update docs/ files whose agent_docs/ sources have changed.

Detection result: ${detectionResult}

Follow your procedure:
1. For each changed FR → update its section in SRS.md
2. If architecture.md changed → re-extract diagrams, update system-architecture.md
3. If ADRs added/removed → update ADRs/README.md index
4. Update Last synced timestamps
5. Report structured output

DO NOT re-sync unchanged files. Preserve human-managed sections.`,
  {
    label: 'incremental-update',
    phase: 'Update',
    agentType: 'human-docs-update',
  }
)

if (!result) {
  log('❌ update failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

const filesWritten = result.files_written || []
log(`✅ update complete — ${filesWritten.length} files updated`)
filesWritten.forEach(f => log(`  📝 ${f}`))

return { status: 'completed', ...result }
```

- [ ] **Step 6: Validate all workflow scripts**

```bash
# Check each workflow has valid meta block
for f in human-docs-sync-product.js human-docs-sync-architecture.js human-docs-sync-all.js human-docs-review.js human-docs-update.js; do
  echo "=== $f ==="
  grep "export const meta" .claude/workflows/$f | head -1
  grep "^const.*SCHEMA" .claude/workflows/$f | head -1
  echo ""
done
```

- [ ] **Step 7: Verify against spec**

- [ ] `sync:product` workflow: Parse → Generate phases, uses SYNC_PRODUCT_SCHEMA
- [ ] `sync:architecture` workflow: Parse → Generate phases, handles missing architecture.md
- [ ] `sync:all` workflow: Pipeline product → architecture tuần tự (spec §2)
- [ ] `review` workflow: Read-only, uses REVIEW_SCHEMA, 5 states (spec §5)
- [ ] `update` workflow: Detect → Update phases, fallback to sync:all (spec §8)

- [ ] **Step 8: Commit**

```bash
git add .claude/workflows/human-docs-*.js
git commit -m "feat(human-docs): add 5 workflow scripts for orchestration

- sync-product: Parse FRs → spawn agent with JSON schema → write SRS.md
- sync-architecture: Parse arch → spawn agent → write diagrams + ADR index
- sync-all: Pipeline tuần tự product → architecture
- review: Read-only consistency check with 5-state classification
- update: Incremental sync with mtime comparison + fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: Rewrite `skills/human-docs/SKILL.md` — Thin Routing Layer

**Files:**
- Modify: `skills/human-docs/SKILL.md` (rewrite to ~70 dòng from current ~290 dòng)

**Interfaces:**
- Consumes: User commands via `/human-docs <command>`
- Produces: Dispatches to workflow scripts via `Workflow()` tool

- [ ] **Step 1: Back up current SKILL.md**

```bash
cp skills/human-docs/SKILL.md skills/human-docs/SKILL.md.v1-backup
```

- [ ] **Step 2: Write new SKILL.md**

Replace entire content of `skills/human-docs/SKILL.md`:

```yaml
---
name: human-docs
description: >-
  Đồng bộ agent_docs/ → docs/ cho human-readable output. Agent là SSOT (Single Source of Truth).
  Dùng khi cần xuất tài liệu cho người đọc từ agent artifacts: "/human-docs sync:product",
  "/human-docs sync:architecture", "/human-docs sync:all", "/human-docs review", "/human-docs update".
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Bash(*), Workflow
version: 2.0.0
---
```

- [ ] **Step 3: Append thin routing body**

```markdown
# human-docs — Agent → Human Documentation Sync

## Purpose

Agent docs (`agent_docs/`) được viết cho Claude/agent đọc — token-efficient, structured.
Human docs (`docs/`) được viết cho developer, PM, on-call engineer đọc — narrative, context-rich.

Agent là **SSOT** (Single Source of Truth). Skill này chỉ dispatch workflow scripts để transform — không tự thực thi logic.

## Sync Scope

```
agent_docs/                              docs/
────────────────────────────────         ────────────────────────────────
features/FR-*.md                  →      product/SRS.md
                                         product/features/README.md

architecture.md                   →      architecture/system-architecture.md
                                         architecture/diagrams/*.mermaid

adrs/ADR-*.md                     →      architecture/ADRs/README.md
```

**Không sync:** `intake/`, `business/`, `user/`, `ux/`, `releases/`, `operations/`, `codebase/` (human-only phases)

**Không tạo:** SRS-BACKEND.md, SRS-FRONTEND.md (BE/FE split ở HLD/LLD, không ở SRS — v2.0.0)

## Core Principles

1. **Agent là SSOT** — mọi thay đổi bắt nguồn từ `agent_docs/`. Skill này chỉ transform.
2. **Không xóa file human** — file `docs/` không có nguồn từ agent được giữ nguyên, flag trong review.
3. **FR không copy riêng lẻ** — chỉ index README trỏ về agent_docs.
4. **ADR không copy riêng lẻ** — chỉ index README trỏ về agent_docs/adrs.
5. **Idempotent** — chạy sync nhiều lần không tạo duplicate.

## Commands

### `/human-docs sync:product`

Tổng hợp `agent_docs/features/FR-*.md` → `docs/product/SRS.md` + `docs/product/features/README.md`.

Dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/human-docs-sync-product.js"
})
```

Output: SRS.md (tổng quan + toàn bộ FR detail, không BE/FE split) + features/README.md (index → agent_docs)

### `/human-docs sync:architecture`

Đồng bộ `agent_docs/architecture.md` + `agent_docs/adrs/` → `docs/architecture/`.

Dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/human-docs-sync-architecture.js"
})
```

Output: system-architecture.md + diagrams/*.mermaid + ADRs/README.md

### `/human-docs sync:all`

Chạy tuần tự `sync:product` → `sync:architecture`.

Dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/human-docs-sync-all.js"
})
```

### `/human-docs review`

So sánh 2 chiều `agent_docs/` ↔ `docs/`, phát hiện inconsistency. **Read-only.**

Dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/human-docs-review.js"
})
```

5 trạng thái: `synced` ✅ | `stale` ⚠️ | `missing` ❌ | `orphan` 👻 | `diverged` 🔀

### `/human-docs update`

Incremental sync — chỉ cập nhật file có thay đổi dựa trên mtime comparison.

Dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/human-docs-update.js"
})
```

Fallback: nếu không có timestamp → tự động chạy `sync:all`.

## Edge Cases

- **Không có agent_docs/**: Báo lỗi "Chưa có agent_docs/ — chạy SDLC flow trước để agent sinh artifact."
- **Không có FR nào**: SRS.md rỗng với ghi chú "Chưa có functional requirements."
- **Không có ADR nào**: ADRs/README.md với ghi chú "Chưa có architectural decisions."
- **architecture.md không có Mermaid**: Warning, bỏ qua diagrams/.
- **File docs/ đã tồn tại**: Overwrite (sync = replace hoàn toàn).
- **Thư mục docs/ chưa có**: Tự tạo toàn bộ cây thư mục cần thiết.

## Transform Rules (summary — chi tiết trong agent definitions)

- **Deduplicate**: Nhiều FR cùng đề cập 1 API endpoint → merge thành 1 section
- **Sort**: Theo priority (Must → Should → Could → Won't)
- **Group**: Theo domain (Auth, Payment, Notification...)
- **NFR extract**: Pattern `p95 < Xms`, `uptime`, `rate limit` → NFR section
- **Layer field**: Giữ làm metadata hiển thị, không dùng để split file
```

- [ ] **Step 3: Verify new SKILL.md**

```bash
# Check line count is ~60-80 (allow some buffer for YAML frontmatter)
wc -l skills/human-docs/SKILL.md
# Expected: ~70-90 lines (including frontmatter)

# Verify frontmatter
grep "^name: human-docs" skills/human-docs/SKILL.md
grep "version: 2.0.0" skills/human-docs/SKILL.md
grep "disable-model-invocation: true" skills/human-docs/SKILL.md
grep "Workflow" skills/human-docs/SKILL.md

# Verify no legacy content
grep "SRS-BACKEND" skills/human-docs/SKILL.md && echo "ERROR: v1.0.0 artifact found!" || echo "✅ No v1.0.0 artifacts"
grep "SRS-FRONTEND" skills/human-docs/SKILL.md && echo "ERROR: v1.0.0 artifact found!" || echo "✅ No v1.0.0 artifacts"
grep "BE/FE Split" skills/human-docs/SKILL.md && echo "WARNING: Old BE/FE split section" || echo "✅ No old BE/FE split"
```

- [ ] **Step 4: Verify against spec**

- [ ] Thin routing ~60-80 dòng (body only, excluding frontmatter)
- [ ] Mỗi command → dispatch đúng workflow script
- [ ] Không còn BE/FE split logic (đã move vào agent)
- [ ] Không còn inline procedure (đã move vào workflow + agent)
- [ ] Edge cases preserved (spec §7)
- [ ] Transform rules preserved as summary (spec §6)
- [ ] `disable-model-invocation: true` (spec §8)
- [ ] `version: 2.0.0`

- [ ] **Step 5: Commit**

```bash
git add skills/human-docs/SKILL.md
git commit -m "feat(human-docs): rewrite SKILL.md as thin routing layer (v2.0.0)

BREAKING: Remove BE/FE split at SRS level. sync:product now outputs 2 files
instead of 4. All heavy logic moved to workflow scripts + agent definitions.

- ~290 lines → ~75 lines (thin routing)
- Each command dispatches to Workflow script
- SRS-BACKEND.md and SRS-FRONTEND.md removed from output
- layer field preserved as metadata, not used for file splitting
- Backward-incompatible with v1.0.0 outputs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 7: Version Bump + Final Validation

**Files:**
- Modify: `skills/human-docs/SKILL.md` (version already bumped to 2.0.0 in Task 6)
- Create/Modify: Root `CHANGELOG.md` (create if not exists)

- [ ] **Step 1: Check existing changelog**

```bash
ls -la CHANGELOG.md 2>/dev/null || echo "CHANGELOG.md does not exist"
# If exists: read it, prepend new entry
# If not: create with first entry
```

- [ ] **Step 2: Add changelog entry**

Prepend to CHANGELOG.md:

```markdown
## 2.0.0 (2026-07-06)

### human-docs v2.0.0 — Skill → Workflow → Agent Refactor

**BREAKING CHANGES:**
- sync:product output reduced from 4 files to 2 (removed SRS-BACKEND.md, SRS-FRONTEND.md)
- BE/FE split removed from SRS level — belongs at HLD/LLD

**Added:**
- 4 agent definitions with JSON schema validation: sync-product, sync-architecture, review, update
- 5 workflow scripts for orchestration: sync-product, sync-architecture, sync-all, review, update
- JSON schema gating to prevent hallucination in agent output

**Changed:**
- SKILL.md rewritten as thin routing layer (~75 lines from ~290)
- All heavy logic moved from SKILL.md → workflow scripts + agent definitions
- layer field preserved as metadata display only, not used for file splitting

**Architecture:**
- Skill → Workflow → Agent pattern
- Agents: single-purpose executors with JSON schema validation
- Workflows: orchestrators with edge case handling + fallback logic
```

- [ ] **Step 3: Full validation checklist**

```bash
echo "=== 1. Agent files ==="
for agent in human-docs-sync-product human-docs-sync-architecture human-docs-review human-docs-update; do
  echo "--- $agent ---"
  [ -f ".claude/agents/$agent.md" ] && echo "  ✅ File exists" || echo "  ❌ MISSING"
  grep -q "^name: $agent" ".claude/agents/$agent.md" 2>/dev/null && echo "  ✅ name matches" || echo "  ❌ name mismatch"
  grep -q "^model: sonnet" ".claude/agents/$agent.md" 2>/dev/null && echo "  ✅ model: sonnet" || echo "  ❌ model wrong"
  grep -q "^permissionMode: acceptEdits" ".claude/agents/$agent.md" 2>/dev/null && echo "  ✅ permissionMode" || echo "  ❌ permissionMode wrong"
done

echo ""
echo "=== 2. Workflow scripts ==="
for wf in human-docs-sync-product human-docs-sync-architecture human-docs-sync-all human-docs-review human-docs-update; do
  echo "--- $wf ---"
  [ -f ".claude/workflows/$wf.js" ] && echo "  ✅ File exists" || echo "  ❌ MISSING"
  grep -q "export const meta" ".claude/workflows/$wf.js" 2>/dev/null && echo "  ✅ Has meta block" || echo "  ❌ No meta block"
done

echo ""
echo "=== 3. SKILL.md ==="
grep -q "version: 2.0.0" skills/human-docs/SKILL.md && echo "  ✅ version: 2.0.0" || echo "  ❌ version not 2.0.0"
grep -q "Workflow" skills/human-docs/SKILL.md && echo "  ✅ Uses Workflow dispatch" || echo "  ❌ No Workflow dispatch"
grep -q "SRS-BACKEND" skills/human-docs/SKILL.md && echo "  ❌ v1.0.0 artifact (SRS-BACKEND) still present!" || echo "  ✅ No v1.0.0 SRS-BACKEND"
grep -q "SRS-FRONTEND" skills/human-docs/SKILL.md && echo "  ❌ v1.0.0 artifact (SRS-FRONTEND) still present!" || echo "  ✅ No v1.0.0 SRS-FRONTEND"
lines=$(wc -l < skills/human-docs/SKILL.md)
echo "  ℹ️  Total lines: $lines (target: 70-90)"

echo ""
echo "=== 4. Spec coverage ==="
echo "  ✅ sync:product: 2 files output (SRS.md + README.md)"
echo "  ✅ No BE/FE split at SRS level"
echo "  ✅ skill → workflow → agent architecture"
echo "  ✅ JSON schema validation for agents"
echo "  ✅ Edge cases preserved (6 cases)"
echo "  ✅ disable-model-invocation: true"
echo "  ✅ allowed-tools with least privilege"
```

- [ ] **Step 4: Verify v1.0.0 backup exists**

```bash
ls -la skills/human-docs/SKILL.md.v1-backup
```

- [ ] **Step 5: Commit**

```bash
# Add CHANGELOG if created/modified
git add CHANGELOG.md 2>/dev/null || true
git add skills/human-docs/SKILL.md
git commit -m "chore: bump human-docs to v2.0.0 + update changelog

- human-docs v1.0.0 → v2.0.0 (MAJOR: breaking output change)
- Added CHANGELOG entry documenting breaking changes + new architecture
- Backup of v1.0.0 SKILL.md saved as SKILL.md.v1-backup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Final audit — diff with original**

```bash
echo "=== v1.0.0 (backup) vs v2.0.0 (current) ==="
diff --stat skills/human-docs/SKILL.md.v1-backup skills/human-docs/SKILL.md
echo ""
echo "=== New files created ==="
git status --short | grep "^??" | head -20
```

## Spec Coverage Self-Check

| Spec Section | Requirement | Coverage |
|---|---|---|
| §1 Motivation | Remove BE/FE split, prevent hallucination via schemas | Tasks 1, 6 — agent schema + no BE/FE split |
| §2 Architecture | Skill → Workflow → Agent dispatch tree | Tasks 1-6 — full dispatch implemented |
| §3 Output simplification | 4→2 files for sync:product | Task 1 (agent) + Task 5 (workflow) + Task 6 (SKILL.md) |
| §4 File plan | 6 workflows + 4 agents + 1 SKILL.md rewrite | Tasks 1-6 — all files created/modified |
| §5 Agent JSON schemas | sync-product + review schemas | Task 1 (SYNC_PRODUCT_SCHEMA) + Task 4 (REVIEW_SCHEMA) |
| §6 Transform rules | Dedup, sort, group, NFR extract, no individual copy | Task 1 (agent body) + Task 6 (SKILL.md summary) |
| §7 Edge cases | 6 edge cases preserved | Task 6 (SKILL.md) + Task 5 (workflow scripts handle each) |
| §8 Unchanged items | sync:architecture output, review 5 states, update incremental, disable-model-invocation | Tasks 2, 3, 4, 6 |

**All spec requirements covered.** No gaps. No TBDs.

# Sprint Migration Guide

Complete migration logic for converting old-format sprint artifacts to the new template format. This reference is loaded on-demand when user requests migration.

**IMPORTANT:** Migration logic lives HERE in the skill references. The sprint-master agent has NO knowledge of migration. Migration extracts data from old files and populates template-based new files DIRECTLY — never via sprint-master.

## When user requests migration

User says: "migrate", "convert old sprint artifacts", "upgrade to new template"

## Migration Process

**⚠️ CRITICAL: Backup via rename BEFORE any changes.** Never delete old files until new artifacts are verified.

### Step 1: Backup via rename (MANDATORY — before anything else)

Rename existing artifact files to `.bak` — this is the backup. No data is lost, files are simply moved aside.

```bash
for f in agent_docs/roadmap.md .work/backlog.md .work/board.md; do
  if [ -f "$f" ]; then
    mv "$f" "${f}.bak"
    echo "✓ Renamed: $f → ${f}.bak"
  fi
done
```

If no files exist to rename → proceed to Step 2 (first-time setup, not migration).

### Step 2: Copy templates to target paths

Copy fresh templates to become the new artifact files:

```bash
cp .claude/templates/sprint/roadmap-TEMPLATE.md agent_docs/roadmap.md
cp .claude/templates/sprint/backlog-TEMPLATE.md .work/backlog.md
cp .claude/templates/sprint/board-TEMPLATE.md .work/board.md
```

Each template now provides the correct structure. The next step populates them with data from old files.

### Step 3: Detect format from old files and extract data

Read each `.bak` file and detect its format by scanning key markers:

| Artifact | New template markers | Old format markers |
|----------|---------------------|--------------------|
| Roadmap | `THEME-`, `EPIC-NN`, `Theme → Epic Mapping` | `Phase Overview`, `Phase N:`, `Task N.N` |
| Backlog | Table rows with `| FEAT-{epic}{NN} |` inside `## [EPIC-NN]` sections | `### FEAT-NNN:` heading, `### FR-{DOM}-NNN:` heading, priority-grouped sections (`## Features: Must`, `## Must`), key-value pairs per feature (`- **Description**:`, `- **Source**:`) |
| Board | `[FEAT-{epic}{NN}]`, `FR-{DOM}-{NNN}--{slug}`, `Story ID` | `| FR ID | Feature | Task |`, no story slug, `| Status | FR ID |` old table |

**⚠️ Hybrid detection:** A file may have new-style IDs (`FEAT-101`) but still use old key-value format (long `- **Description**:` blocks, priority sections instead of EPIC groups, Feature→Epic Mapping with ranges like `FEAT-101–107`). Treat these as **old format** — they need migration to table format.

**If ALL `.bak` files already match new template** → report:

> "✅ All sprint artifacts are already in the new template format. Restoring from .bak..."

Rename `.bak` back, delete newly copied templates. Stop.

**If SOME `.bak` files match new template but others are old** → report:

> "⚠️ Mixed formats detected: roadmap.md → new (restore), backlog.md → old (migrate), board.md → old (migrate)"

For new-format files: restore from `.bak`. For old-format files: proceed with extraction.

**If ALL `.bak` files are old format** → proceed with extraction below.

**3a: Extract from old roadmap (`.bak`):**
- Read each Phase section → becomes an EPIC (Phase 1 → EPIC-01, Phase 2 → EPIC-02)
- Extract phase name, goal, tasks, services
- Map: `Phase N` → `EPIC-0N`, task refs (`FR-{DOM}-NNN`) → feature IDs

**3b: Extract individual items from old backlog (`.bak`):**
- For EACH item section (`### FR-{DOM}-NNN: Name` or `### FEAT-NNN: Name` or `### FEAT-{epic}{NN}: Name`):
  - **Item name:** heading text after the ID
  - **Description:** extract the `- **Description**:` line value
  - **Priority:** from `- **Priority**:` line (Must/Should/Could)
  - **Status:** from `- **Status**:` line
  - **Epic mapping:** from `- **Source**:` or `Feature → Epic Mapping` table
  - **Services:** from `- **Services**:` line (for reference, not in table)
  - **Old FR list:** if the old file has an `FRs:` or `Specs:` field listing sub-FRs, extract these — they show what this feature already groups

**3c: Description shortening rules:**
- Old format stores long descriptions in `- **Description**:` key-value
- New template expects 1-line description in table cell
- **How to shorten:** extract the core verb + object + key detail. Drop implementation details, service names, tech stack. Keep business meaning.
- ❌ "Client exchanges SSO authorization code for RS256-signed JWT access token with UUID v7 refresh token, including device and browser metadata tracking." (too long)
- ✅ "OAuth2 Authorization Code → RS256 JWT + UUID v7 refresh token" (short, preserves meaning)
- ❌ "Create new merchant prospect with business info, services, and notes; enforce prospect count limit per user; validate business type." (too long)
- ✅ "Tạo merchant prospect — business info, services, notes, count limit" (short, preserves meaning)

**3d: GROUP related items into Features (CRITICAL — do NOT map 1:1)**

**⚠️ Old format items (like `FR-AUTH-001`, `FR-AUTH-002`) are at story/task granularity. The new template expects Feature-level granularity — each Feature groups 2-8 related stories that serve the same business capability. Mapping each old item 1:1 to a new Feature is WRONG.**

**Grouping criteria** (apply in order):
1. **Same domain prefix** — items sharing `FR-{DOM}-*` belong together (e.g., all `FR-AUTH-*`)
2. **Same service** — items deployed to the same service are related
3. **Functional coherence** — do they serve the same business capability? Split a domain into multiple Features if it covers distinct concerns (e.g., FR-GW-001..004 = "Gateway Core" vs FR-GW-005..007 = "Gateway Cross-Cutting")

**Grouping examples:**
```
// ❌ WRONG — 1:1 mapping (70 old items → 70 Features):
FR-AUTH-001 → FEAT-101
FR-AUTH-002 → FEAT-102
FR-AUTH-003 → FEAT-103
FR-AUTH-004 → FEAT-104

// ✅ CORRECT — grouped by business capability (70 old items → ~15 Features):
FR-AUTH-001..004 → FEAT-101 "Token & Session Management" (all handle auth tokens)
FR-GW-001..004   → FEAT-102 "API Gateway Core" (routing, version gating, auth, permissions)
FR-GW-005..007   → FEAT-103 "Gateway Cross-Cutting" (caching, logging, OpenAPI docs)
FR-PORTAL-001..005 → FEAT-104 "Portal Frontend" (SSO, signout, layout, session, tracing)
FR-MM-001..005   → FEAT-201 "Prospect Management" (CRUD + notes for merchant prospects)
FR-MO-001..005b  → FEAT-202 "Merchant Onboarding" (registration, draft, review, KYC)
FR-MP-001..007   → FEAT-203 "Merchant Profile & Search" (search, shops, geo data)
FR-FILE-001..003 → FEAT-204 "File Upload & Download" (upload, presigned URL, validation)
```

**For each group, create a Feature with:**
- **Feature name:** a short label summarizing the business capability (e.g., "Token & Session Management")
- **Feature description:** 1 sentence covering all grouped items' core actions (apply 3c shortening)
- **Priority:** highest priority among grouped items (if any item is Must → Feature is Must)
- **Status:** aggregate from items (all done → done, any in-progress → in-progress)
- **Estimate:** sum or rough total of grouped items' story points
- **Old FRs:** list the old FR IDs included in this group (for traceability reference)
- **Services:** deduplicated list from grouped items

**Edge cases:**
- Item that doesn't logically group with others → can be its own Feature (1 item → 1 Feature is acceptable if truly standalone)
- Item in a different EPIC than its domain siblings → group by EPIC first, then by domain
- Large domain (>8 items) → split into 2+ Features by functional sub-area

After grouping, assign `FEAT-{epic}{NN}` IDs: {NN} = sequential within EPIC (01-99).

**3e: Extract from old board (`.bak`):**
- For each task row, extract: status, FR ID reference, task name, assignee, story points
- Map task to parent feature via FR ID column
- Generate Story ID: `FR-{DOMAIN}-{NNN}--{slug}` from task name

### Step 4: Populate template-based files with extracted data

**⚠️ DO NOT spawn sprint-master.** The skill populates files directly with the data from Step 3.

The new files were created from templates in Step 2. Now populate them:

**4a: Populate roadmap** (`agent_docs/roadmap.md`):
- Frontmatter: fill `title`, `status`, `last_updated`, `updated_by`
- Timeline: map old timeline data into the table
- Theme → Epic Mapping table: list each EPIC-0N with name, phase ref, sprint, FR count, services, status
- Each EPIC gets `## [EPIC-NN] Epic Name` section with goal from old Phase description
- Replace template placeholder rows with extracted data

**4b: Populate backlog** (`.work/backlog.md`):
- Frontmatter: fill `title`, `tracked_epics` list (one entry per mapped EPIC)
- For each EPIC: `## [EPIC-NN] Epic Name` header + `> **Service**: ...` info line
- Table columns: `| Feature ID | Description | Estimate | Priority | Status |`
- Each grouped Feature → one table row: short description, aggregate priority, aggregate status
- Add `FRs` note below each feature table for traceability (e.g., `> **Old FRs:** FR-AUTH-001 to 004`)
- Fill Archive + Naming Convention + Changelog sections
- Changelog must include: "N old items → M Features across K EPICs"

**4c: Populate board** (`.work/board.md`):
- Each feature: `## [FEAT-{epic}{NN}]` section with Kanban table
- Each extracted task → one row under its parent feature section
- Columns: `| Story ID | Description | Priority | Status |`
- Update `total_stories` and `associated_epics` in frontmatter

### Step 5: Verify new artifacts

Read each new file and validate:
- [ ] Roadmap has Theme→Epic mapping table, correct EPIC-IDs
- [ ] Backlog is grouped by `## [EPIC-NN]`, uses TABLE format (`| FEAT-XXX | description | estimate | priority | status |`)
- [ ] Backlog descriptions are ≤120 chars (spot-check 5 random rows)
- [ ] **Grouping applied** — Feature count is significantly fewer than old item count (expect ~3-8x reduction; 70 old items → ~10-20 Features). If count is nearly 1:1, grouping was skipped — FAIL.
- [ ] **No data loss** — every old FR ID appears in at least one Feature's FRs traceability note
- [ ] No range notation in Feature→Epic Mapping — each FEAT-ID listed individually
- [ ] All traceability chains preserved (Epic → Feature → old FRs)
- [ ] Board has `## [FEAT-{epic}{NN}]` sections, stories use `FR-{DOM}-{NNN}--{slug}` format

**If verification fails** → keep `.bak` files, delete new files, rename `.bak` back to original. Report error.

**If verification passes** → report success. `.bak` files are the safety net.

### Step 6: Report

Show migration summary:
- N old items extracted from `.bak` files
- M Features created after grouping (M should be ~3-8x smaller than N)
- Grouping breakdown per EPIC (e.g., "EPIC-01: 17 FRs → 5 Features (FR-AUTH-*, FR-GW-*, ...)")
- N stories assigned Story IDs
- N epics mapped: `Phase N → EPIC-0N`
- Description length: avg chars before vs after
- Backup files: `*.bak` paths
- Verification: ✅ All checks passed
- Next: "Old files backed up as `.bak`. Delete them manually when ready."

### Step 7: Auto-Trigger Sync Docs

After migration verification passes, automatically sync the new artifacts with spec documents (SRS, FR, IMP, TST). This ensures all newly created Features and Stories are cross-referenced with their specification documents.

**CRITICAL:** Only trigger if Step 5 verification PASSED. If verification failed, skip this step (artifacts were rolled back).

**Implementation — spawn sprint-master with sync-docs:**
```
Agent(sprint-master, prompt: "
  Sprint operation: sync-docs
  Flags: --docs
  Context: Post-migration sync. New artifacts were just created from migration.
  User request: sync --docs after migration — cross-reference new Features and Stories with spec documents
")
```

**Why sprint-master (not skill-level):**
- sync-docs requires knowledge of artifact formats, status transitions, and sync logic — all owned by sprint-master
- The skill's role is orchestration: detect migration → run migration → trigger sync
- sprint-master handles the actual document scanning and cross-referencing

**Why after migration:**
- Newly created Features/Stories need traceability to existing specs (SRS scenarios, FR documents)
- Status may need updating based on what specs already exist
- Ensures roadmap/backlog/board are consistent with specification documents immediately after migration

# Sync Workflow

Supplementary reference for Sync mode: edge cases, AI analysis templates, output examples, and troubleshooting. Core sync procedure is in SKILL.md.

## Edge Cases

### No Git Available

If project doesn't use git (no `.git` directory):
```bash
find . -newer <baseline_file> -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/vendor/*" 2>/dev/null
```

Warn human: "No git detected. Using file modification timestamps (less accurate than git history). Consider initializing git for reliable change tracking."

### No Changes Detected

If `git diff` returns nothing from baseline:
- Report: "No changes detected since last explore ({baseline}). All artifacts are current."
- Still offer manual override: AskUserQuestion with "Nothing to sync. Run selected phases anyway?" (Yes / No)
- If yes → present full phase checklist (nothing pre-selected)

### First Exploration (No Baseline)

If no baseline found (no tags, no reports, no scout files):
- Report: "No previous exploration found. Recommend Full Pipeline for first run."
- Offer: AskUserQuestion with "Full Pipeline" / "Pick specific phases" / "Cancel"
- If "Pick specific phases" → present all phases, none pre-selected

### Dirty Working Tree

If `git status --porcelain` shows uncommitted changes:
- Warn: "Working tree has uncommitted changes. Sync analysis includes both committed and uncommitted changes — results may differ from last committed state."
- Offer: AskUserQuestion with "Continue with all changes" / "Only check committed changes (git diff HEAD)" / "Abort"

### Submodule Hash Mismatch

If `git submodule status` shows a different hash than what's committed:
- Report: "Submodule {name} points to a different commit than what's tracked in the parent repo."
- This means the submodule was updated but the parent wasn't committed — still analyze the current state
- Add note: "Commit the submodule hash update in the parent repo to make this baseline reproducible."

### Nested Repo in .gitignore

If a nested git repo is detected and gitignored:
- Still report changes fully (don't skip just because it's gitignored)
- Note: "Note: {path} is gitignored in the parent repo. Consider tracking it as a submodule if changes should be versioned together."

---

## Dependency Auto-Resolution

When executing selected phases in Sync mode, some phases may depend on unselected phases. Auto-resolve dependencies:

```
IMP selected, LLD not selected:
  → Check: does LLD output exist from a previous run?
    YES → use existing LLD output as input
    NO  → auto-include LLD in the execution (run LLD first, then IMP)

TST selected, IMP not selected:
  → Same logic: use existing IMP or auto-include

HLD selected, SRS not selected:
  → Use existing SRS output. If none → auto-include SRS first.
```

**Chain:** Auto-inclusion cascades. If auto-including LLD triggers need for HLD (not selected, no output), auto-include HLD too. Report the final execution list to human before starting: "Adjusted plan: LLD auto-included (needed by IMP). Running: LLD → IMP → TST."

After execution → Phase 5 (Sprint Integration) if selected → Phase 6 (Summary) with auto-tagging.

---

## AI Deep Analysis Prompt Template

Used in impact analysis Tier 2. Spawn Agent(Explore) (read-only):

```
Analyze these code changes from git diff and determine which SDLC artifacts need updating.

Changed files:
{file_list_with_diff_stats}

SDLC artifacts:
- SRS: Software Requirements Specification (features, Gherkin scenarios, NFRs)
- HLD: High-Level Design (C4 diagrams, ADRs, service boundaries, infrastructure)
- LLD: Low-Level Design (tech-design per service, API contracts, data models, work packages)
- IMP: Implementation Specifications (execution flows, business rules, error mapping, security)
- TST: Test Specifications (unit, integration, E2E, performance tests)

For each changed file or group of related changes:
1. Which artifact(s) are affected and why
2. Impact level: HIGH (artifact likely outdated), MEDIUM (may need review), LOW (minor, probably fine)
3. A specific recommendation (e.g., "Update IMP FR-3 section 2.1 authentication flow")

Only report artifacts with MEDIUM or HIGH impact. Skip docs-only and formatting-only changes. Be specific — reference exact file paths and line ranges.
```

---

## Sync Change Summary Format

Example output format for presenting results to human:

```markdown
## Sync Analysis — 2026-06-03

**Baseline:** explore-20260515--my-platform (git tag)
**Last explore:** 2026-05-15 (Full mode, 3 sub-projects)

---

### Main Repo: my-platform
Changed: 12 files, 3 commits

| File | Change | Bucket |
|------|--------|--------|
| src/auth/login.ts | Modified (+45/-12) | Source code |
| package.json | Modified (+2/-1) | Architecture |
| docker-compose.yml | Modified (+5/-3) | Architecture |

### Submodule: shared-library
Changed: 3 files, 1 commit

| File | Change | Bucket |
|------|--------|--------|
| shared/validation.ts | Modified (+20/-5) | Source code |

---

### Recommended Sync

Based on change analysis:

[x] **IMP specs** — source code changes in auth/login.ts, shared/validation.ts
[x] **TST specs** — test coverage for source changes
[x] **HLD** — docker-compose.yml and package.json infrastructure changes
[ ] **SRS** — no API contract or feature changes detected
[ ] **LLD** — no schema or service boundary changes detected
```

---

## Troubleshooting

### Baseline tag exists but report files are missing

If `git tag -l 'explore-*'` finds a tag but `.work/reports/` is empty:
- Tag still works as baseline (Priority 1)
- Warn: "Found explore tag {tag} but no report files on disk. Changes since {tag} will be analyzed. Consider running Full Pipeline to regenerate artifacts."

### Multiple explore tags found

If multiple `explore-*` tags exist:
- Use the most recent one (`--sort=-creatordate | head -1`)
- Note in output: "Using most recent explore tag. {N} total tags found."

### File timestamp is unreliable

If using file mtime as baseline (Priority 2):
- Note: "Using file modification time as baseline. Git tags provide more reliable baselines — they are created automatically after each successful exploration."
- Timestamp baseline can be wrong if files were touched without content changes

### Mixed project types

If project has submodules + nested repos + monorepo directories simultaneously:
- Report each type in its own section in the change summary
- Note git relationship for each: "submodule (tracked by parent)" vs "nested repo (independent, gitignored)" vs "monorepo (shared history)"
- Each type gets its own baseline check logic

### Sync run while Full/Architect run in progress

If `.work/scouts/` has partial results (some scouts exist but not all):
- Detect: count scout files vs expected sub-project count
- If incomplete: warn "Previous exploration appears incomplete ({N}/{total} scout reports). Sync will use available artifacts. Consider finishing or re-running Full Pipeline."

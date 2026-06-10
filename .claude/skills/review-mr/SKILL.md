---
name: review-mr
description: >-
  Review merge requests from GitLab/GitHub with deep analysis across architecture,
  security, bugs, CLAUDE.md conventions, feature impact, and operational risk.
  Use when reviewing MR/PR, review merge request, check MR, audit pull request,
  code review before merge, evaluate merge request changes, or run pre-merge review.
  Supports --arch, --security, --bugs, --conventions, --impact, --ops, --full flags.
version: 1.1.0
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(git:*,gh:*,glab:*,ls:*,find:*,cat:*)
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - TaskList
---

# Review Merge Request

Deep review of GitLab/GitHub merge requests across 6 independent dimensions, each handled by a specialized subagent running in parallel.

## When to use this skill

**Use this skill when:**
- Reviewing a merge request or pull request on GitHub/GitLab
- Checking MR/PR for architectural impact or violations
- Auditing merge request changes for security vulnerabilities
- Detecting bugs, edge cases, or race conditions in MR changes
- Verifying MR compliance with project CLAUDE.md conventions
- Assessing cross-feature impact and interface/implementation consistency
- Evaluating operational safety (DB migration, performance, deploy risk, rollback)
- Running pre-merge validation across multiple quality dimensions

**Key review dimensions:**
- **Architecture** (URGENT): C4 model impact, ADR compliance, SOLID, coupling, breaking changes
- **Security** (CRITICAL): OWASP Top 10, secret detection, auth/authz, data exposure, dependencies
- **Bugs** (BUG_FOUND): Logic errors, race conditions, edge cases, error handling, type safety
- **Conventions** (VIOLATION): CLAUDE.md compliance, naming, patterns, structure, testing standards
- **Feature Impact** (BLOCKER): Cross-feature impact, interface/impl consistency, shared code consumers, regression risk
- **Operational** (BLOCKER): Database migration safety, performance impact, deployment risk, rollback complexity

**Not recommended for:**
- Local uncommitted changes — use `/code-review` or `code-reviewer` agent instead
- Code style or formatting review — use linter/prettier
- General architecture consulting — use `/architect` instead

## Quick Start

```bash
# Full review (all 6 dimensions in parallel)
/review-mr --full https://github.com/owner/repo/pull/123

# Single dimension
/review-mr --security gl-456          # GitLab MR #456, security only
/review-mr --arch gh-789              # GitHub PR #789, architecture only
/review-mr --impact gh-789            # GitHub PR #789, feature impact only
/review-mr --ops gl-456               # GitLab MR #456, operational impact only

# Multiple dimensions
/review-mr --impact --ops gh-789      # Feature impact + operational

# Interactive (no args)
/review-mr                            # Menu routing + workspace discovery
```

## Core Workflow

### Phase 1: Parse Input

Extract from user args:
- **Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`, `--full`
- **MR identifier**: URL (`https://github.com/...`), or platform prefix + number (`gh-123`, `gl-456`), or bare number

If no dimension flag → go to Phase 1b (Menu Routing).

If MR identifier found → skip to Phase 3.

### Phase 1b: Menu Routing (no flags)

Use `AskUserQuestion` with these options:
1. "Full Review (all 6 dimensions)" — runs all 6 subagents in parallel
2. "Code Quality: Architecture + Bugs + Conventions" — code structure, logic, compliance
3. "Safety & Impact: Security + Feature Impact + Operational" — vulnerabilities, cross-feature impact, deploy safety
4. "Specific dimensions" — user provides flags (e.g., `--impact --ops`, `--security`)

If user selects "Specific dimensions", ask them to specify which flags to use (e.g., `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`).

### Phase 2: Workspace Discovery

When no MR identifier was given, discover available repos:

1. **Current repo**: `git rev-parse --show-toplevel` → if git repo → candidate
2. **Submodules**: `git submodule status` → each submodule → candidate
3. **projects/ directory** (gitignored): `for d in projects/*/; do cd "$d" && git rev-parse --show-toplevel 2>/dev/null && echo "$d"; done`
4. **Deduplicate**: Remove overlaps between submodules and projects/
5. **Present to user**:
   - 0 repos → "No repos found. Please provide an MR/PR URL."
   - 1 repo → auto-select
   - 2-4 repos → `AskUserQuestion` (label = relative path)
   - 5+ repos → numbered table, wait for numeric input

See `references/workspace-discovery.md` for detailed discovery logic and edge cases.

### Phase 3: MR Discovery (per selected repo)

1. **Detect platform** from git remote URL:
   - Contains `github.com` → GitHub (`gh` CLI)
   - Contains `gitlab.com` or `gitlab.` → GitLab (`glab` CLI)

2. **Fetch open MRs**:
   ```
   GitHub: gh pr list --repo <owner/repo> --state open --json number,title,headRefName,baseRefName,updatedAt,author,url
   GitLab: glab mr list --repo <owner/repo> --state opened --output json
   ```

3. **Present MRs to user** (grouped by repo if multi-repo):
   - Each MR: `#number title (author) source→target updated`
   - ≤4 MRs → `AskUserQuestion`
   - 5+ MRs → numbered table, wait for numeric input

### Phase 4: Fetch MR Content

Once the target MR is identified:
```bash
# GitHub
gh pr diff <number> --repo <owner/repo>
gh pr view <number> --repo <owner/repo> --json title,author,headRefName,baseRefName,additions,deletions,files,url,createdAt

# GitLab
glab mr diff <number> --repo <owner/repo>
glab mr view <number> --repo <owner/repo> --output json
```

Analyze diff structure: files changed, LOC, change types (code/config/docs/test/dependency).

### Phase 5: Dispatch Subagents

**ALL subagents run in parallel.** Launch them simultaneously via `Agent` tool.

Each subagent receives:
- The full MR diff
- MR metadata (title, author, branch, URL, files, LOC)
- Repo path (for accessing project files, CLAUDE.md, etc.)
- Platform info (GitHub/GitLab)

| Subagent | Flag | Focus |
|----------|------|-------|
| `review-mr-arch` | `--arch` | C4 model, ADR, patterns, coupling, impact analysis |
| `review-mr-security` | `--security` | OWASP Top 10, secrets, auth/authz, data exposure, dependencies |
| `review-mr-bugs` | `--bugs` | Logic bugs, race conditions, edge cases, error handling, type safety |
| `review-mr-conventions` | `--conventions` | CLAUDE.md compliance, naming, patterns, project conventions |
| `review-mr-impact` | `--impact` | Cross-feature impact, interface/impl consistency, shared code consumers, regression risk |
| `review-mr-ops` | `--ops` | Database migration safety, performance, deployment risk, rollback complexity |

Dispatch rules:
- `--full` → all 6 subagents
- `--arch` → only `review-mr-arch`
- `--security` → only `review-mr-security`
- `--bugs` → only `review-mr-bugs`
- `--conventions` → only `review-mr-conventions`
- `--impact` → only `review-mr-impact`
- `--ops` → only `review-mr-ops`
- Multiple flags (e.g., `--security --bugs`; `--impact --ops`) → specified subagents in parallel
- No flag + menu "Full Review" → all 6

For dimension workflows and checklists, see:
- `references/dimension-architecture.md` — Architecture review workflow + checklist (C4, ADR, SOLID)
- `references/dimension-security.md` — Security review workflow + checklist (OWASP, CWE, secrets)
- `references/dimension-bugs.md` — Bug detection workflow + checklist (logic, race, edge cases)
- `references/dimension-conventions.md` — CLAUDE.md compliance workflow + checklist (naming, patterns, structure)
- `references/dimension-impact.md` — Feature impact workflow + checklist (cross-feature, interface consistency, regression)
- `references/dimension-ops.md` — Operational impact workflow + checklist (DB migration, performance, deploy, rollback)

### Phase 6: Synthesize Results

Collect outputs from all dispatched subagents. Each returns: `{verdict, findings[]}`.

**Merge & deduplicate**: If the same issue is flagged by multiple subagents (e.g., "missing input validation" flagged by both security and bugs), merge into one finding with multiple category tags.

**Compute overall verdict** (based on highest severity):
- Any CRITICAL (security), URGENT (arch), or BLOCKER (impact/ops) → **URGENT**
- Any BUG_FOUND (bugs), VIOLATION (conventions), or HIGH_RISK (impact/ops) → **NEEDS_ATTENTION**
- Otherwise → **APPROVED**

### Phase 7: Generate Report

Create markdown report with sections:

```markdown
# MR Review: {title}
**MR**: {url} | **Author**: {author} | **Branch**: {source} → {target}
**Files**: {count} | **+{additions} -{deletions}** | **Reviewed**: {timestamp}

## Overall Verdict: {APPROVED | NEEDS_ATTENTION | URGENT}

## Architecture Review — Verdict: {verdict}
| Severity | Category | Description | Recommendation |
|----------|----------|-------------|----------------|
| URGENT   | ADR      | ...         | ...            |

## Security Review — Verdict: {verdict}
| Severity | CWE | Description | Recommendation |
|----------|-----|-------------|----------------|
| CRITICAL | 89  | ...         | ...            |

## Bug Detection — Verdict: {verdict}
| Severity | Category | Description | Repro |
|----------|----------|-------------|-------|
| BUG      | Race     | ...         | ...   |

## CLAUDE.md Compliance — Verdict: {verdict}
| Severity  | Rule Source | Description | Recommendation |
|-----------|-------------|-------------|----------------|

## Feature Impact — Verdict: {verdict}
| Severity | Category | Description | Recommendation |
|----------|----------|-------------|----------------|
| BLOCKER  | Feature  | ...         | ...            |

## Operational Impact — Verdict: {verdict}
| Severity | Category | Description | Recommendation |
|----------|----------|-------------|----------------|
| BLOCKER  | DB Mig   | ...         | ...            |

## Summary
| # | Dimension | Severity | Description |
|---|-----------|----------|-------------|
| 1 | Security  | CRITICAL | ...         |
```

Save to: `.work/review-mr/REVIEW-YYYYMMDD--{mr-slug}.md`

For the full template, see `references/report-template.md`.

### Phase 8: Post Comments (Optional)

Use `AskUserQuestion`:
- **Question**: "Post findings lên MR/PR?"
- **Options**:
  1. "Post tất cả findings" — each finding as a separate comment
  2. "Chỉ post CRITICAL + URGENT + BLOCKER" — only highest severity
  3. "Không post, chỉ lưu report"

If user chooses to post, use the platform-specific CLI:

**GitHub** (`gh pr comment`):
```bash
gh pr comment <number> --repo <owner/repo> --body "<formatted finding>"
```

**GitLab** (`glab mr note`):
```bash
glab mr note <number> --repo <owner/repo> --message "<formatted finding>"
```

**Comment format** (each finding = one comment):
```markdown
**[{severity}] [{dimension}]** {description}

**Recommendation**: {recommendation}

**File**: `{file_path}:{line}`

🤖 Generated by review-mr skill
```

## Flag Handling Reference

```
/review-mr --arch https://github.com/owner/repo/pull/123
  → Parse URL → GitHub PR #123 → review-mr-arch only

/review-mr --security --bugs
  → No MR → workspace discovery → list → user selects → review-mr-security + review-mr-bugs in parallel

/review-mr --full gl-456
  → Detect platform from current repo → GitLab MR #456 → all 6 subagents in parallel

/review-mr --conventions gh-789
  → GitHub PR #789 → review-mr-conventions only

/review-mr --impact --ops
  → No MR → workspace discovery → feature impact + operational impact in parallel

/review-mr
  → Menu routing → workspace discovery → MR selection → review per chosen mode
```

## Platform Detection

Detect platform from:
1. **URL** (if provided): `github.com` → GitHub, `gitlab.com`/`gitlab.*` → GitLab
2. **Prefix** (if number provided): `gh-123` → GitHub, `gl-456` → GitLab
3. **Git remote** (fallback): `git remote get-url origin`

For CLI command references, see:
- `references/gh-cli-reference.md` — all `gh pr` commands used
- `references/glab-cli-reference.md` — all `glab mr` commands used

## Report Output Location

All reports saved to: `.work/review-mr/REVIEW-YYYYMMDD--{mr-slug}.md`

Where `{mr-slug}` is derived from: `{platform}-{number}-{sanitized-title}`.

## Key Principles

- **Main agent coordinates, subagents review** — SKILL.md only handles routing, fetching, synthesis, and comment posting. All analysis happens in subagents.
- **All subagents run in parallel** — never sequential. Launch them simultaneously in a single `Agent` call batch.
- **Subagents receive the full diff** — do not split by file. Each subagent reviews the complete MR diff for its dimension.
- **Deduplicate before reporting** — the same underlying issue may be flagged by multiple dimensions. Merge, don't duplicate.
- **URGENT beats everything** — if any dimension says URGENT, CRITICAL, or BLOCKER, the overall verdict is URGENT.
- **Each finding = one comment** — when posting to MR/PR, each finding gets its own comment for independent resolution tracking.
- **Interactive at key decision points** — ask the user before workspace discovery (>1 repo) and before posting comments.
- **Platform-agnostic flow** — same workflow for GitHub and GitLab; only the CLI commands differ.
- **Token efficiency** — main SKILL.md is ~300 lines. Detailed workflows live in `references/` and load on-demand.

## Reference Guide

- `references/dimension-architecture.md` — Architecture review workflow + checklist: C4 model, ADR, SOLID, coupling, impact
- `references/dimension-security.md` — Security review workflow + checklist: OWASP Top 10, CWE, secrets, auth, dependencies
- `references/dimension-bugs.md` — Bug detection workflow + checklist: logic, race conditions, edge cases, error handling, types
- `references/dimension-conventions.md` — CLAUDE.md compliance workflow + checklist: naming, patterns, structure, testing
- `references/dimension-impact.md` — Feature impact workflow + checklist: cross-feature impact, interface/impl consistency, shared code consumers, regression risk
- `references/dimension-ops.md` — Operational impact workflow + checklist: DB migration safety, performance impact, deployment risk, rollback complexity
- `references/workspace-discovery.md` — Multi-repo workspace discovery: submodules, gitignored projects/, deduplication
- `references/workflow-full.md` — Full review orchestration: 6-subagent parallel dispatch, synthesis, deduplication
- `references/gh-cli-reference.md` — GitHub CLI commands for review: pr list, pr diff, pr view, pr comment
- `references/glab-cli-reference.md` — GitLab CLI commands for review: mr list, mr diff, mr view, mr note
- `references/report-template.md` — Full markdown report template with all sections and verdict color coding

---
name: sdlc-review-mr
description: >-
  Review merge requests with workflow-driven parallel analysis across architecture,
  security, bugs, CLAUDE.md conventions, feature impact, and operational risk.
  Supports optional adversarial verification to reduce false positives.
  Use when reviewing MR/PR, review merge request, check MR, audit pull request,
  code review before merge, evaluate merge request changes, or run pre-merge review.
  Supports --arch, --security, --bugs, --conventions, --impact, --ops, --full, --adversarial flags.
version: 1.0.1
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(git:*,gh:*,glab:*,ls:*,find:*,cat:*)
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
  - Workflow
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - TaskList
---

# Review Merge Request (Workflow-Driven)

Deep review of GitLab/GitHub merge requests across 6 independent dimensions, orchestrated via the Workflow tool for resumability and token efficiency. Optional adversarial verification reduces false positives by having each finding survive 3 independent skeptical reviews.

**Key difference from `/review-mr`:** This skill delegates the review pipeline (dispatch → verify → synthesize → report) to a deterministic Workflow script. The main agent handles only interactive phases (input parsing, workspace discovery, MR selection, comment posting). This means: resumable on failure, visible progress in `/workflows`, and lower token usage in context.

## When to use this skill

**Use this skill when:**
- Reviewing a merge request or pull request on GitHub/GitLab
- Checking MR/PR for architectural impact or violations
- Auditing merge request changes for security vulnerabilities
- Detecting bugs, edge cases, or race conditions in MR changes
- Verifying MR compliance with project CLAUDE.md conventions
- Assessing cross-feature impact and interface/implementation consistency
- Evaluating operational safety (DB migration, performance, deploy risk, rollback)
- You want fewer false positives (use `--adversarial`)
- You want resumable reviews (workflow pauses/resumes on failure)

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
- Simple/quick reviews where workflow overhead isn't worth it — use `/review-mr` instead

## Quick Start

```bash
# Full review (all 6 dimensions in parallel)
/sdlc-review-mr --full https://github.com/owner/repo/pull/123

# Full review with adversarial verification (fewer false positives)
/sdlc-review-mr --full --adversarial https://github.com/owner/repo/pull/123

# Single dimension
/sdlc-review-mr --security gl-456          # GitLab MR #456, security only
/sdlc-review-mr --arch gh-789              # GitHub PR #789, architecture only

# Multiple dimensions with adversarial
/sdlc-review-mr --security --bugs --adversarial gh-789

# Interactive (no args)
/sdlc-review-mr                            # Menu routing + workspace discovery
```

## Core Workflow

### Phase 1: Parse Input

Extract from user args:
- **Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`, `--full`
- **Mode flag**: `--adversarial` — enable adversarial verification (default: off)
- **MR identifier**: URL (`https://github.com/...`), or platform prefix + number (`gh-123`, `gl-456`), or bare number

If no dimension flag → go to Phase 1b (Menu Routing).

If MR identifier found → skip to Phase 3.

### Phase 1b: Menu Routing (no flags)

Use **batch `AskUserQuestion`** with 2 questions:

**Question 1** (header: "Scope", multiSelect: false):
1. "Full Review (all 6 dimensions)" (Recommended)
2. "Code Quality: Architecture + Bugs + Conventions"
3. "Safety & Impact: Security + Feature Impact + Operational"
4. "Specific dimensions"

If user selects "Specific dimensions", present a follow-up `AskUserQuestion` (multiSelect: true) with: Architecture, Security, Bugs, CLAUDE.md Conventions, Feature Impact, Operational Impact.

**Question 2** (header: "Verification", multiSelect: false):
1. "Standard (faster)" (Recommended)
2. "Adversarial (slower, fewer false positives — each finding verified by 3 independent reviewers)"

Map menu selections to flags:

| Menu Choice | dimensions[] | adversarial |
|---|---|---|
| Full Review | `['arch','security','bugs','conventions','impact','ops']` | from Q2 |
| Code Quality | `['arch','bugs','conventions']` | from Q2 |
| Safety & Impact | `['security','impact','ops']` | from Q2 |
| Specific dimensions | user-selected dimensions | from Q2 |

**When user DOES provide CLI flags:** Skip the menu entirely. `adversarial` is set from `--adversarial` flag presence. If no `--adversarial` flag, `adversarial = false`.

### Phase 2: Workspace Discovery

When no MR identifier was given, discover available repos. See `../review-mr/references/workspace-discovery.md` for detailed logic.

1. **Current repo**: `git rev-parse --show-toplevel` → if git repo → candidate
2. **Submodules**: `git submodule status` → each submodule → candidate
3. **projects/ directory** (gitignored): check for additional repos
4. **Deduplicate**: Remove overlaps between submodules and projects/
5. **Present to user**:
   - 0 repos → "No repos found. Please provide an MR/PR URL."
   - 1 repo → auto-select
   - 2-4 repos → `AskUserQuestion`
   - 5+ repos → numbered table, wait for numeric input

### Phase 3: MR Discovery (per selected repo)

1. **Detect platform** from git remote URL:
   - Contains `github.com` → GitHub (`gh` CLI)
   - Contains `gitlab.com` or `gitlab.` → GitLab (`glab` CLI)

2. **Fetch open MRs** using platform-specific CLI. See `../review-mr/references/gh-cli-reference.md` and `../review-mr/references/glab-cli-reference.md`.

3. **Present MRs to user** (grouped by repo if multi-repo):
   - ≤4 MRs → `AskUserQuestion`
   - 5+ MRs → numbered table, wait for numeric input

### Phase 4: Fetch MR Content

Once the target MR is identified, fetch the full diff and metadata. See CLI references for exact commands.

Analyze diff structure: files changed, LOC, change types (code/config/docs/test/dependency).

### Phase 5: Dispatch Workflow

Build workflow args and invoke the pipeline:

```js
const workflowArgs = {
  diff,           // full unified diff string
  metadata: {     // MR metadata object
    id, title, author, branch, files, loc, url
  },
  repoPath,       // absolute path to repo
  platform,       // 'github' | 'gitlab'
  dimensions,     // string[] from Phase 1/1b
  adversarial,    // boolean from Phase 1/1b
  runDate,        // $(date +%Y%m%d)
}

// Guard: check workflow script exists
// ls .claude/workflows/workflow-review-mr-pipeline.js
// If missing → tell user to install/update the plugin

const result = await Workflow({
  scriptPath: ".claude/workflows/workflow-review-mr-pipeline.js",
  args: workflowArgs
})
```

The workflow runs these phases internally (visible in `/workflows`):
1. **Review** — 6 subagents in parallel
2. **Verify** — adversarial verification (only if `adversarial: true`)
3. **Synthesize** — merge, deduplicate, compute overall verdict
4. **Report** — generate markdown report → `.work/review-mr/`

For the full args schema, result schema, and error handling patterns, see `references/workflow-handoff.md`.

### Phase 6: Post Comments (Optional)

After workflow completes, use `AskUserQuestion`:
- **Question**: "Post findings lên MR/PR?"
- **Options**:
  1. "Post tất cả findings" — each finding as a separate comment
  2. "Chỉ post CRITICAL + URGENT + BLOCKER" — only highest severity
  3. "Không post, chỉ lưu report"

Post using `gh pr comment` or `glab mr note`. Each finding = one comment with format:
```markdown
**[{severity}] [{dimension}]** {description}

**Recommendation**: {recommendation}

**File**: `{file_path}:{line}`

🤖 Generated by sdlc-review-mr skill
```

## Error Handling

### Partial subagent failure
If workflow returns `failedDimensions: ['security']`, the report still includes results from other 5 dimensions. Tell user and offer to retry failed dimension(s) manually via `Agent(review-mr-security, ...)`.

### Workflow unavailable
If `.claude/workflows/workflow-review-mr-pipeline.js` doesn't exist:
```
"Workflow script not found. Please ensure the plugin is installed correctly.
Falling back to manual review mode — this may take longer and won't be resumable."
```
Then fall back to the same manual orchestration as `/review-mr`.

### Workflow complete failure
If workflow returns `verdict: 'ERROR'`:
- Show what's available (partial findings, failed dimensions)
- Offer to retry with `Workflow({ resumeFromRunId })` or fall back to manual

## Flag Handling Reference

```
/sdlc-review-mr --arch https://github.com/owner/repo/pull/123
  → Parse URL → GitHub PR #123 → review-mr-arch only, adversarial=false

/sdlc-review-mr --security --bugs --adversarial
  → No MR → workspace discovery → list → user selects
  → review-mr-security + review-mr-bugs in parallel → adversarial verification

/sdlc-review-mr --full gl-456
  → GitLab MR #456 → all 6 subagents in parallel → standard (no adversarial)

/sdlc-review-mr --full --adversarial gl-456
  → GitLab MR #456 → all 6 subagents → adversarial verification of all findings

/sdlc-review-mr
  → Batch AskUserQuestion (Q1: scope, Q2: verification) → workspace discovery
  → MR selection → workflow dispatch → post comments
```

## Platform Detection

Detect platform from:
1. **URL** (if provided): `github.com` → GitHub, `gitlab.com`/`gitlab.*` → GitLab
2. **Prefix** (if number provided): `gh-123` → GitHub, `gl-456` → GitLab
3. **Git remote** (fallback): `git remote get-url origin`

## Report Output Location

All reports saved to: `.work/review-mr/REVIEW-YYYYMMDD--{platform}-{number}-{sanitized-title}.md`

## Subagent Architecture

This skill reuses the same 6 subagent definitions as `/review-mr`:
- `.claude/agents/review-mr-arch.md` → `agentType: 'review-mr-arch'`
- `.claude/agents/review-mr-security.md` → `agentType: 'review-mr-security'`
- `.claude/agents/review-mr-bugs.md` → `agentType: 'review-mr-bugs'`
- `.claude/agents/review-mr-conventions.md` → `agentType: 'review-mr-conventions'`
- `.claude/agents/review-mr-impact.md` → `agentType: 'review-mr-impact'`
- `.claude/agents/review-mr-ops.md` → `agentType: 'review-mr-ops'`

All 6 run in parallel inside the workflow. Each receives the full MR diff + metadata.

## Key Principles

- **Main agent coordinates, workflow executes** — SKILL.md handles interactive phases (input, discovery, selection, posting). Workflow handles deterministic pipeline (review, verify, synthesize, report).
- **All subagents run in parallel** — never sequential. The workflow dispatches them in a single `parallel()` call.
- **Subagents receive the full diff** — do not split by file. Each subagent reviews the complete MR diff for its dimension.
- **Adversarial verification is opt-in** — default is standard mode. Users choose via menu Q2 or `--adversarial` flag.
- **Deduplicate before reporting** — synthesis phase merges cross-dimension findings.
- **URGENT beats everything** — if any dimension says URGENT, CRITICAL, or BLOCKER, the overall verdict is URGENT.
- **Each finding = one comment** — when posting to MR/PR, each finding gets its own comment.
- **Resumable on failure** — if subagent fails mid-workflow, resume with `Workflow({ resumeFromRunId })`.
- **Token efficient** — intermediate agent outputs stay in workflow script variables, not in Claude's context.

## Reference Guide

- `references/workflow-handoff.md` — Workflow args schema, result schema, error handling patterns, retry strategy
- `../review-mr/references/dimension-architecture.md` — Architecture review workflow + checklist
- `../review-mr/references/dimension-security.md` — Security review workflow + checklist
- `../review-mr/references/dimension-bugs.md` — Bug detection workflow + checklist
- `../review-mr/references/dimension-conventions.md` — CLAUDE.md compliance workflow + checklist
- `../review-mr/references/dimension-impact.md` — Feature impact workflow + checklist
- `../review-mr/references/dimension-ops.md` — Operational impact workflow + checklist
- `../review-mr/references/workspace-discovery.md` — Multi-repo workspace discovery
- `../review-mr/references/gh-cli-reference.md` — GitHub CLI commands
- `../review-mr/references/glab-cli-reference.md` — GitLab CLI commands
- `../review-mr/references/report-template.md` — Markdown report template

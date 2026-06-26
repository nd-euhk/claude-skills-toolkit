---
name: sdlc-review
description: >-
  Review merge requests, pull requests, and source code with workflow-driven
  parallel analysis across 7 dimensions: architecture, security, bugs, CLAUDE.md
  conventions, feature impact, operational risk, and test quality. Supports optional
  adversarial verification to reduce false positives. Use when reviewing MR/PR,
  code reviewing, reviewing source code, auditing code quality, checking architecture,
  detecting bugs in code, evaluating security, or running pre-merge review.
  Supports --mr, --pr, --code mode flags and --arch, --security, --bugs, --conventions,
  --impact, --ops, --tests, --full, --adversarial flags.
argument-hint: "[--mr <id>] [--pr <id>] [--code <path>] [--full] [--arch] [--security] [--bugs] [--conventions] [--impact] [--ops] [--tests] [--adversarial]"
version: 1.2.0
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(git:*,gh:*,glab:*,ls:*,find:*,cat:*,which:*,npm:*,apt:*,brew:*)
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

# SDLC Review (Workflow-Driven)

Deep review of code across 7 independent dimensions, orchestrated via the Workflow tool for resumability and token efficiency. Supports two review modes: **MR/PR review** (GitHub/GitLab merge requests) and **Source code review** (local codebase exploration). Optional adversarial verification reduces false positives by having each finding survive 3 independent skeptical reviews.

**Key difference from `/sdlc-review-mr`:** This skill unifies MR/PR review and source code review into one skill with mode selection via `--mr`/`--pr`/`--code` flags. All subagent prompts are inlined into workflow scripts (no external agent file dependencies).

## When to use this skill

**Use this skill when:**
- Reviewing a merge request or pull request on GitHub/GitLab
- Reviewing local source code for quality, architecture, security, or bugs
- Checking MR/PR for architectural impact or violations
- Auditing code for security vulnerabilities
- Detecting bugs, edge cases, or race conditions
- Verifying compliance with project CLAUDE.md conventions
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
- **Test Quality** (URGENT): Cheating patterns, test-to-impl mapping, assertion quality, coverage gaps

**Not recommended for:**
- Local uncommitted changes (use `sdlc-review --code` or `code-reviewer` agent instead)
- Code style or formatting review (use linter/prettier)
- General architecture consulting (use `/architect` instead)

## Quick Start

```bash
# Full MR review (all 7 dimensions)
/sdlc-review --mr --full https://github.com/owner/repo/pull/123

# Full PR review with adversarial verification (fewer false positives)
/sdlc-review --pr --full --adversarial https://github.com/owner/repo/pull/123

# Source code review
/sdlc-review --code --full src/auth/

# Source code review with specific dimensions + adversarial
/sdlc-review --code --security --bugs --adversarial src/api/

# Single dimension on MR
/sdlc-review --mr --security gl-456          # GitLab MR #456, security only

# Single dimension on PR
/sdlc-review --pr --arch gh-789              # GitHub PR #789, architecture only

# Multiple dimensions with adversarial
/sdlc-review --mr --security --bugs --adversarial gh-789

# Interactive (no args) — menu routing + workspace discovery
/sdlc-review
```

## Core Workflow

### Phase 1: Parse Input

Extract from user args:

**Mode flags** (exactly ONE, conflict if ≥2):
- `--mr` — Review a GitLab merge request
- `--pr` — Review a GitHub pull request
- `--code` — Review local source code (no MR/PR involved)

**Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`, `--tests`, `--full`

**Verification flag**: `--adversarial` — enable adversarial verification (default: off)

**Identifier** (MR/PR mode only): URL or platform prefix + number (`gh-123`, `gl-456`) or bare number

**Path** (code mode only): Directory or file path to review (default: current directory)

```
Parse order:
1. Extract --mr/--pr/--code → mode
   - If ≥2 of these exist → CONFLICT → go to Phase 1b (Q1 resolves mode)
   - If 1 exists → use that mode
   - If 0 exists → go to Phase 1b (full menu)
2. Extract dimension flags
   - --full → all 7 dimensions
   - No dimension flag → go to Phase 1b (menu routing)
3. Extract --adversarial → adversarial=true
4. Extract identifier (MR/PR mode) or path (code mode)
```

**Mode routing:**
- `--mr` or `--pr` mode → proceed to Phase 3 (platform check) → Phase 4 (fetch MR) → Phase 5 (dispatch MR workflow)
- `--code` mode → skip Phase 3-4 → Phase 5 (dispatch code workflow)

### Phase 1b: Menu Routing (interactive, no flags or conflict)

Use **sequential `AskUserQuestion`** (3 questions, asked one at a time):

**Q1 — Mode** (header: "Chế độ Review", multiSelect: false):
This question is asked when: no mode flag provided, OR ≥2 of `--mr`/`--pr`/`--code` conflict.
1. "Review Merge Request / Pull Request" — GitLab MR hoặc GitHub PR
2. "Review Source Code" — Review source code hiện tại trong workspace

**Q2 — Scope** (header: "Phạm vi", multiSelect: false):
1. "Full Review (all 7 dimensions)" (Recommended)
2. "Code Quality: Architecture + Bugs + Conventions + Tests"
3. "Safety & Impact: Security + Feature Impact + Operational"
4. "Specific dimensions" — presents 2 follow-up multi-selects (split: max 4 options each per AskUserQuestion limit)

**If "Specific dimensions" selected — ask Q2a then Q2b sequentially:**

Q2a (header: "Dimensions (1/2)", multiSelect: true):
1. "Architecture" — C4 model, ADR, SOLID, coupling
2. "Security" — OWASP, secrets, auth, data exposure
3. "Bugs" — Logic errors, race conditions, edge cases
4. "CLAUDE.md Conventions" — naming, patterns, structure

Q2b (header: "Dimensions (2/2)", multiSelect: true):
1. "Feature Impact" — Cross-feature, interface consistency, regression
2. "Operational" — DB migration, performance, deploy risk
3. "Test Quality" — Cheating patterns, coverage, assertions

Combine Q2a + Q2b selections into dimensions[].

**Q3 — Verification** (header: "Xác minh", multiSelect: false):
1. "Standard (nhanh hơn)" (Recommended)
2. "Adversarial (chậm hơn, ít false positive — mỗi finding được 3 skeptic xác minh)"

Map menu selections:

| Q1 Choice | Mode | dimensions[] | adversarial |
|---|---|---|---|
| MR/PR | mr or pr (detected later) | from Q2 | from Q3 |
| Source Code | code | from Q2 | from Q3 |

| Q2 Choice | dimensions[] |
|---|---|
| Full Review | `['arch','security','bugs','conventions','impact','ops','tests']` |
| Code Quality | `['arch','bugs','conventions','tests']` |
| Safety & Impact | `['security','impact','ops']` |
| Specific dimensions | user-selected subset (from Q2a+Q2b) |

**Q3 → adversarial**: Standard → `false`, Adversarial → `true`

**When user DOES provide CLI flags:** Skip the menu entirely. `adversarial` is set from `--adversarial` flag presence.

### Phase 2: Workspace Discovery (MR/PR mode only)

When no MR identifier was given, discover available repos:

1. **Current repo**: `git rev-parse --show-toplevel` → if git repo → candidate
2. **Submodules**: `git submodule status` → each submodule → candidate
3. **projects/ directory** (gitignored): check for additional repos
4. **Deduplicate**: Remove overlaps between submodules and projects/
5. **Present to user**:
   - 0 repos → "No repos found. Please provide an MR/PR URL."
   - 1 repo → auto-select
   - 2-4 repos → `AskUserQuestion`
   - 5+ repos → numbered table, wait for numeric input

### Phase 3: Platform Detection & CLI Check (MR/PR mode only)

**Step 3a: Detect platform**

Detect from (in priority order):
1. **Flag**: `--mr` → GitLab, `--pr` → GitHub
2. **URL** (if provided): `github.com` → GitHub, `gitlab.com`/`gitlab.*` → GitLab
3. **Prefix** (if number provided): `gh-123` → GitHub, `gl-456` → GitLab
4. **Git remote** (fallback): `git remote get-url origin`

**Step 3b: Verify CLI tool installed**

Check platform-specific CLI:

```bash
# GitHub
which gh && gh auth status

# GitLab
which glab && glab auth status
```

**If CLI not installed → `AskUserQuestion`:**

```
"gh CLI chưa được cài đặt. Cần cài để review GitHub PR."
Options:
  1. "Cài đặt gh CLI" — install + guide login + STOP (user must re-run skill)
  2. "Không cài, hủy review"
```

Install instructions by platform:
- **GitHub**: `gh` — https://cli.github.com/manual/installation
  - Linux: `apt install gh` or `brew install gh`
  - After install: `gh auth login`
- **GitLab**: `glab` — https://gitlab.com/gitlab-org/cli
  - Linux: `apt install glab` or `brew install glab`
  - After install: `glab auth login`

**After successful install + login guide → STOP.** Tell user: "CLI đã sẵn sàng. Vui lòng chạy lại skill để review."

**If CLI installed but not authenticated:**
```
"gh CLI đã cài nhưng chưa đăng nhập."
Options:
  1. "Đăng nhập ngay" — run `gh auth login` + STOP
  2. "Hủy review"
```

### Phase 4: Fetch MR Content (MR/PR mode only)

Once the target MR is identified:

1. **Fetch open MRs** (if no identifier): `gh pr list` or `glab mr list`
2. **Present MRs to user** (if multiple): ≤4 → `AskUserQuestion`, 5+ → numbered table
3. **Fetch diff**: `gh pr diff <id>` or `glab mr diff <id>` → full unified diff
4. **Fetch metadata**: `gh pr view <id> --json title,author,baseRefName,headRefName,files,additions,deletions,url` or `glab mr view <id> --output json`
5. **Analyze diff structure**: files changed, LOC, change types (code/config/docs/test/dependency)

### Phase 5: Dispatch Workflow

**Route to the correct workflow based on mode:**

```js
// Mode: mr or pr → use MR workflow
if (mode === 'mr' || mode === 'pr') {
  const mrArgs = {
    diff,           // full unified diff string
    metadata: { id, title, author, branch, files, loc, url },
    repoPath,       // absolute path to repo
    platform,       // 'github' | 'gitlab' (from Phase 3)
    dimensions,     // string[] from Phase 1/1b
    adversarial,    // boolean from Phase 1/1b
    runDate,        // $(date +%Y%m%d)
  }

  // Guard: check workflow script exists
  // ls .claude/workflows/workflow-sdlc-review-mr.js
  // If missing → "Workflow script not found. Please ensure the plugin is installed correctly."

  const result = await Workflow({
    scriptPath: ".claude/workflows/workflow-sdlc-review-mr.js",
    args: mrArgs
  })
}

// Mode: code → scout first via sdlc-scout, then review workflow
if (mode === 'code') {
  // Phase 5a: Scout via sdlc-scout (structured output, scale-aware routing)
  // sdlc-scout handles project discovery, strategy selection, caching, and audit
  const scoutResult = await Skill(sdlc-scout, `${targetPath} --mode review --focus "${focus || ''}"`)

  const codeArgs = {
    repoPath,       // absolute path to repo
    targetPath,     // directory/file to review (from user input or cwd)
    dimensions,     // string[]
    adversarial,    // boolean
    runDate,        // $(date +%Y%m%d)
    scoutReports: scoutResult?.reports || [],  // structured scout output, consumed by workflow
  }

  // Guard: ls .claude/workflows/workflow-sdlc-review-code.js

  const result = await Workflow({
    scriptPath: ".claude/workflows/workflow-sdlc-review-code.js",
    args: codeArgs
  })
}
```

Both workflows run phases internally (visible in `/workflows`):
1. **Review** — 7 subagents in parallel (with inline prompts)
2. **Verify** — adversarial verification (only if `adversarial: true`)
3. **Synthesize** — merge, deduplicate, compute overall verdict
4. **Report** — generate markdown report

For the full args schema, result schema, and error handling patterns, see `references/workflow-handoff.md`.

### Phase 6: Post Comments (MR/PR mode only)

After workflow completes, use `AskUserQuestion`:
- **Question**: "Post findings lên MR/PR?"
- **Options**:
  1. "Post tất cả findings" — each finding as a separate comment
  2. "Chỉ post CRITICAL + URGENT + BLOCKER" — only highest severity
  3. "Không post, chỉ lưu report"

Post using `gh pr comment <id> --body "<markdown>"` or `glab mr note <id> --message "<markdown>"`. Each finding = one comment.

Comment format:
```markdown
**[{severity}] [{dimension}]** {description}

**Recommendation**: {recommendation}

**File**: `{file_path}:{line}`

🤖 Generated by sdlc-review skill
```

## Error Handling

### Partial subagent failure
If workflow returns `failedDimensions: ['security']`, the report still includes results from other 6 dimensions. Tell user and offer to retry failed dimension(s) manually.

### Workflow unavailable
If `.claude/workflows/workflow-sdlc-review-{mr,code}.js` doesn't exist:
```
"Workflow script not found. Please ensure the plugin is installed correctly."
```
Abort — do not fall back to manual mode.

### Workflow complete failure
If workflow returns `verdict: 'ERROR'`:
- Show what's available (partial findings, failed dimensions)
- Offer to retry with `Workflow({ resumeFromRunId })` 

### CLI not installed (Phase 3)
Already handled in Phase 3b — AskUserQuestion → install → guide login → STOP.

## Flag Handling Reference

| Input | mode | dimensions | adversarial | Routing |
|---|---|---|---|---|
| `--mr`/`--pr <flags> <url\|id>` | mr/pr | from flags | `--adversarial` flag | Platform from URL/prefix/remote. If no ID → workspace discovery |
| `--code <flags> <path>` | code | from flags | `--adversarial` flag | targetPath=<path>, skip Phases 3-4 |
| ≥2 of `--mr`/`--pr`/`--code` | CONFLICT | — | — | Phase 1b Q1 resolves mode |
| (no args) | menu | menu | menu | Q1(mode) → Q2(scope) → Q3(verify) → discovery → dispatch |

`--full` → all 7 dimensions. No dimension flag + no `--full` → Phase 1b Q2.

## Report Output Location

All reports saved to: `.work/review/`

- **MR/PR**: `REVIEW-MR-YYYYMMDD--{platform}-{number}-{sanitized-title}.md`
- **Code**: `REVIEW-CODE-YYYYMMDD--{sanitized-path}.md`

## Key Principles

- **Main agent coordinates, workflow executes** — SKILL.md handles interactive phases (input, discovery, selection, posting, CLI check). Workflow handles deterministic pipeline (review, verify, synthesize, report).
- **All subagents run in parallel** — never sequential. The workflow dispatches them in a single `parallel()` call.
- **Mode flag enforces context** — `--mr`/`--pr` for merge requests, `--code` for source code. Conflict detection ensures exactly one mode.
- **CLI verification gate** — Phase 3 blocks progress until `gh`/`glab` is installed and authenticated.
- **Adversarial verification is opt-in** — default is standard mode. Users choose via menu Q3 or `--adversarial` flag.
- **Deduplicate before reporting** — synthesis phase merges cross-dimension findings.
- **URGENT beats everything** — if any dimension says URGENT, CRITICAL, or BLOCKER, the overall verdict is URGENT.
- **Each finding = one comment** — when posting to MR/PR, each finding gets its own comment.
- **Resumable on failure** — if subagent fails mid-workflow, resume with `Workflow({ resumeFromRunId })`.
- **Token efficient** — intermediate agent outputs stay in workflow script variables, not in Claude's context.
- **Self-contained** — all subagent prompts are inlined into workflow scripts. No external agent file dependencies.

## Reference Guide

- `references/workflow-handoff.md` — Workflow args schemas, result schemas, error handling patterns, retry strategy for both MR and code workflows

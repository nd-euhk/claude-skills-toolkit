# Workflow Handoff — sdlc-review ↔ Workflows

Handoff mechanism between `sdlc-review` skill and its two workflow scripts. Skill prepares all inputs, selects the appropriate workflow, processes results.

## Which workflow to use

| Mode Flag | Workflow Script | Purpose |
|---|---|---|
| `--mr` or `--pr` | `workflow-sdlc-review-mr.js` | Review a merge/pull request diff |
| `--code` | `workflow-sdlc-review-code.js` | Review local source code via exploration |

## MR/PR Workflow: workflow-sdlc-review-mr.js

### Args Structure (Skill → Workflow)

```js
const mrArgs = {
  diff: "diff --git a/src/...\n...",    // string — full unified diff from gh/glab
  metadata: {                             // object — MR metadata
    id: 123,                              // number — MR/PR number
    title: "Add user authentication",     // string
    author: "username",                   // string
    branch: "feature/auth",               // string — source branch
    files: ["src/auth/login.ts", ...],    // string[] — changed file paths
    loc: 245,                             // number — total lines changed
    url: "https://github.com/o/r/pull/123", // string — MR/PR URL
  },
  repoPath: "/absolute/path/to/repo",    // string — absolute path
  platform: "github",                    // "github" | "gitlab"
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"], // string[]
  adversarial: true,                     // boolean — enable Verify phase
  runDate: "20260626",                   // string YYYYMMDD
}
```

### Preparing args from skill

1. **diff**: From `gh pr diff <id>` or `glab mr diff <id>` — full unified diff, never truncated
2. **metadata**: From `gh pr view <id> --json ...` or `glab mr view <id> --output json`
   - `files`: list of changed file paths
   - `loc`: additions + deletions total
3. **repoPath**: Absolute path from `git rev-parse --show-toplevel`
4. **platform**: From Phase 3 — `--mr` → `gitlab`, `--pr` → `github`, or detected from URL/remote
5. **dimensions**: From Phase 1 flag parsing or Phase 1b menu Q2
6. **adversarial**: From `--adversarial` flag or menu Q3
7. **runDate**: `$(date +%Y%m%d)`

### Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-review-mr.js", args: mrArgs })
```

**Guard**: `ls .claude/workflows/workflow-sdlc-review-mr.js` → if missing, abort with error.

### Result Structure (Workflow → Skill)

#### Success — Standard Mode
```js
{
  reportPath: ".work/review/REVIEW-MR-20260626--github-123-add-user-authentication.md",
  verdict: "NEEDS_ATTENTION",
  findings: [
    {
      severity: "BUG_FOUND",
      categories: ["bugs"],
      description: "Missing null check on user object before accessing .email",
      recommendation: "Add null guard before accessing nested properties",
      affected_files: ["src/auth/login.ts:42"],
    },
  ],
  dimensions: {
    arch: { label: "Architecture", verdict: "APPROVED", findings: [] },
    security: { label: "Security", verdict: "CRITICAL", findings: [...] },
    // ...
  },
  stats: {
    totalFindings: 5,
    rawFindings: 7,
    dimensionsRun: 7,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

#### Success — Adversarial Mode
```js
{
  // ... same as standard +
  stats: {
    totalFindings: 3,        // after verification (was 7 raw)
    rawFindings: 7,
    verifiedFindings: 3,     // survived adversarial review
    rejectedFindings: 4,     // flagged as false positives
    dimensionsRun: 7,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

#### Error — Partial Subagent Failure
```js
{
  reportPath: ".work/review/REVIEW-MR-20260626--github-123-feature.md",
  verdict: "URGENT",
  findings: [...],
  dimensions: { ... },
  stats: {
    totalFindings: 3,
    rawFindings: 3,
    dimensionsRun: 7,
    dimensionsFailed: 1,
    duration: "completed",
  },
  failedDimensions: ["security"]
}
```

#### Error — All Subagents Failed
```js
{
  reportPath: null,
  verdict: "ERROR",
  findings: [],
  dimensions: {},
  stats: { totalFindings: 0, duration: "N/A" },
  failedDimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"]
}
```

## Code Review Workflow: workflow-sdlc-review-code.js

### Args Structure (Skill → Workflow)

```js
const codeArgs = {
  repoPath: "/absolute/path/to/repo",    // string — absolute path
  targetPath: "src/auth/",               // string — relative path within repo to review
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"], // string[]
  adversarial: true,                     // boolean
  runDate: "20260626",                   // string YYYYMMDD
}
```

### Preparing args from skill

1. **repoPath**: Absolute path from `git rev-parse --show-toplevel`
2. **targetPath**: From user input (after `--code` flag) or default to `"."` (current directory)
   - If relative → resolve against repoPath
   - If absolute → verify it's within repoPath
3. **dimensions**: From Phase 1 flag parsing or Phase 1b menu Q2
4. **adversarial**: From `--adversarial` flag or menu Q3
5. **runDate**: `$(date +%Y%m%d)`

### Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-review-code.js", args: codeArgs })
```

**Guard**: `ls .claude/workflows/workflow-sdlc-review-code.js` → if missing, abort.

### Result Structure (Workflow → Skill)

Same as MR workflow result, with `reportPath` using `REVIEW-CODE-` prefix:
```
.work/review/REVIEW-CODE-YYYYMMDD--{sanitized-path}.md
```

### Code Review Workflow Phases

Unlike the MR workflow which receives a diff, the code workflow must explore the codebase first:

```
Phase: Scout
  Explore targetPath → discover file structure, identify key modules
  → produces: file list, module map, dependency graph overview

Phase: Review
  parallel(all 7 dimensions, each exploring + reviewing)
  → each agent uses Bash(git:*,ls:*,find:*,cat:*) + Grep + Glob + Agent(Explore)
  → inline prompts adapted for source code exploration (not diff analysis)

Phase: Verify (adversarial only)
  pipeline(each finding → 3 skeptics) — same pattern as MR workflow

Phase: Synthesize
  merge + deduplicate + compute overall verdict

Phase: Report
  generate markdown → .work/review/REVIEW-CODE-YYYYMMDD--{slug}.md
```

## Error Handling Patterns

### Pattern 1: Partial Subagent Failure (1-2 dimensions)
```
Workflow returned: failedDimensions: ["security"]
→ Report: "Security review failed. Other dimensions completed."
→ AskUserQuestion: "Retry security review?"
  - "Retry" → re-run Workflow with resumeFromRunId
  - "Skip" → report is already generated with remaining dimensions
```

### Pattern 2: Workflow Total Failure
```
Workflow returned: verdict: 'ERROR', reportPath: null
→ Tell user: "Workflow failed to produce results."
→ AskUserQuestion: "Retry workflow?"
  - "Retry" → Workflow({ resumeFromRunId: "<previous-id>" })
  - "Abort" → stop
```

### Pattern 3: Workflow File Not Found
```
ls .claude/workflows/workflow-sdlc-review-{mr,code}.js → no file
→ Tell user: "Workflow script missing. Plugin may need reinstallation."
→ Abort
```

## Adversarial Verification Flow

When `adversarial: true`, the workflow adds a Verify phase before Synthesis:

```
Phase: Review
  parallel(7 dimension agents) → raw findings

Phase: Verify (adversarial only)
  pipeline(each finding):
    parallel([
      skeptic: correctness lens
      skeptic: security lens
      skeptic: reproducibility lens
    ])
    → finding survives if ≥2/3 skeptics confirm
  → filtered findings

Phase: Synthesize
  merge + deduplicate (uses ONLY verified findings)

Phase: Report
  generate markdown (notes adversarial mode + rejection stats)
```

**Skeptic instructions (inlined in workflow):**
- **Correctness skeptic**: Looks for mitigating controls upstream. Defaults to "refute" if uncertain.
- **Security skeptic**: Checks if code is reachable from user input, compensating controls exist. Defaults to "refute" if uncertain.
- **Reproducibility skeptic**: Checks if affected code path is actually in scope, if existing tests would catch it. Defaults to "refute" if uncertain.

A finding is **confirmed** only if ≥2/3 skeptics vote `confirmed: true`.

## Token Efficiency

| Scenario | Old /sdlc-review-mr (Workflow + agent files) | New /sdlc-review (Workflow + inline prompts) |
|---|---|---|
| 7 dimensions, 10 findings | ~15K tokens in context | ~15K tokens in context |
| 7 dimensions + adversarial | ~25K tokens | ~25K tokens |
| 2 dimensions, 3 findings | ~8K tokens | ~8K tokens |
| Subagent failure + retry | Resume: only failed agents re-run | Resume: only failed agents re-run |

**Mechanism:** Both approaches use the Workflow tool — intermediate results stay in script variables. The inline approach eliminates the need to load 7 separate agent definition files but does not significantly change context usage for the skill-level agent.

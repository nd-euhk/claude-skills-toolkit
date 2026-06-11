# Workflow Handoff — sdlc-review-mr ↔ workflow-review-mr-pipeline

Handoff mechanism between `sdlc-review-mr` skill and `workflow-review-mr-pipeline.js` workflow. Skill prepares all inputs, workflow runs the pipeline, skill processes results and handles Phase 6 (post comments).

## Args Structure (Skill → Workflow)

```js
const workflowArgs = {
  diff: "diff --git a/src/...\n...",    // string — full unified diff from gh/glab
  metadata: {                             // object — MR metadata
    id: 123,                              // number — MR/PR number
    title: "Add user authentication",     // string
    author: "username",                   // string
    branch: "feature/auth",               // string — source branch
    files: ["src/auth/login.ts", ...],    // string[] — changed file paths
    loc: 245,                             // number — total lines changed (+additions -deletions)
    url: "https://github.com/o/r/pull/123", // string — MR/PR URL
  },
  repoPath: "/absolute/path/to/repo",    // string — absolute path
  platform: "github",                    // "github" | "gitlab"
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops"], // string[]
  adversarial: true,                     // boolean — enable Verify phase
  runDate: "20260611",                   // string YYYYMMDD
}
```

### Preparing args from skill

1. **diff**: From `gh pr diff` or `glab mr diff` — full unified diff, never truncated
2. **metadata**: From `gh pr view --json ...` or `glab mr view --output json`
   - `files`: list of changed file paths
   - `loc`: additions + deletions total
3. **repoPath**: Absolute path from `git rev-parse --show-toplevel`
4. **platform**: Detected from remote URL (`github.com` → `github`, `gitlab.*` → `gitlab`)
5. **dimensions**: From Phase 1 flag parsing or Phase 1b menu selection
6. **adversarial**: From `--adversarial` flag (CLI) or menu Q2 answer (interactive)
7. **runDate**: `$(date +%Y%m%d)`

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-review-mr-pipeline.js", args: workflowArgs })
```

**Guard check before invoking:**
```bash
ls .claude/workflows/workflow-review-mr-pipeline.js
```
If missing → "Workflow script not found. Please ensure the plugin is installed correctly." + fallback to manual orchestration (same pattern as `/review-mr`).

## Result Structure (Workflow → Skill)

### Success — Standard Mode
```js
{
  reportPath: ".work/review-mr/REVIEW-20260611--github-123-add-user-authentication.md",
  verdict: "NEEDS_ATTENTION",
  findings: [
    {
      severity: "BUG_FOUND",
      categories: ["bugs"],
      description: "Missing null check on user object before accessing .email",
      recommendation: "Add null guard before accessing nested properties",
      affected_files: ["src/auth/login.ts:42"],
    },
    // ... more findings (merged/deduplicated)
  ],
  dimensions: {
    arch: { label: "Architecture", verdict: "APPROVED", findings: [] },
    security: { label: "Security", verdict: "CRITICAL", findings: [...] },
    bugs: { label: "Bug Detection", verdict: "BUG_FOUND", findings: [...] },
    // ... other dimensions
  },
  stats: {
    totalFindings: 5,
    rawFindings: 7,
    dimensionsRun: 6,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

### Success — Adversarial Mode
```js
{
  // ... same as standard +
  stats: {
    totalFindings: 3,        // after verification (was 7 raw)
    rawFindings: 7,           // before verification
    verifiedFindings: 3,      // survived adversarial review
    rejectedFindings: 4,      // flagged as false positives
    dimensionsRun: 6,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

### Error — Partial Subagent Failure
```js
{
  reportPath: ".work/review-mr/REVIEW-20260611--github-123-feature.md",
  verdict: "URGENT",
  findings: [...],           // findings from surviving dimensions
  dimensions: { ... },       // only successful dimensions
  stats: {
    totalFindings: 3,
    rawFindings: 3,
    dimensionsRun: 6,
    dimensionsFailed: 1,
    duration: "completed",
  },
  failedDimensions: ["security"]
}
```

### Error — All Subagents Failed
```js
{
  reportPath: null,
  verdict: "ERROR",
  findings: [],
  dimensions: {},
  stats: {
    totalFindings: 0,
    duration: "N/A",
  },
  failedDimensions: ["arch", "security", "bugs", "conventions", "impact", "ops"]
}
```

### Error — Synthesis Failed
```js
{
  reportPath: null,
  verdict: "ERROR",
  findings: [...],           // raw findings from review (unmerged)
  dimensions: { ... },
  stats: {
    totalFindings: 7,
    rawFindings: 7,
    dimensionsRun: 6,
    dimensionsFailed: 0,
    duration: "N/A",
  }
}
```

## Error Handling Patterns

### Pattern 1: Partial Subagent Failure (1-2 dimensions)
```
Workflow returned: failedDimensions: ["security"]
→ Report: "Security review failed. Other 5 dimensions completed."
→ AskUserQuestion: "Retry security review?"
  - "Retry" → spawn Agent(review-mr-security) manually with same diff
  - "Skip" → report is already generated with 5/6 dimensions
→ If retry succeeds: manually merge security findings into report
```

### Pattern 2: Workflow Total Failure
```
Workflow returned: verdict: 'ERROR', reportPath: null
→ Tell user: "Workflow failed to produce results."
→ AskUserQuestion: "Retry workflow or fall back to manual review?"
  - "Retry" → Workflow({ resumeFromRunId: "<previous-id>" }) — cached agents skip re-run
  - "Manual" → fall back to same orchestration as /review-mr (Agent tool)
```

### Pattern 3: Workflow File Not Found
```
ls .claude/workflows/workflow-review-mr-pipeline.js → no file
→ Tell user: "Workflow script missing. Plugin may need reinstallation."
→ AskUserQuestion: "Use manual review mode instead?"
  - "Yes" → fall back to /review-mr style orchestration
  - "No" → abort
```

## Adversarial Verification Flow

When `adversarial: true`, the workflow adds a Verify phase before Synthesis:

```
Phase: Review
  parallel([review-mr-arch, review-mr-security, ...])
  → raw findings (e.g., 7 findings across all dimensions)

Phase: Verify (adversarial only)
  pipeline(each finding):
    parallel([
      skeptic: correctness lens ("Could this be handled elsewhere?")
      skeptic: security lens   ("Is this genuinely exploitable?")
      skeptic: repro lens      ("Can you actually trigger this?")
    ])
    → survived if ≥2/3 skeptics confirm
  → filtered findings (e.g., 3 survived, 4 rejected as false positives)

Phase: Synthesize
  merge + deduplicate + verdict (uses ONLY verified findings)

Phase: Report
  generate markdown (notes adversarial mode + rejection stats)
```

**Skeptic instructions:**
- **Correctness skeptic**: Looks for mitigating controls upstream (middleware, framework, existing validators). Defaults to "refute" if uncertain.
- **Security skeptic**: Checks if code is reachable from user input, if compensating controls exist (WAF, rate limiting, auth). Defaults to "refute" if uncertain.
- **Reproducibility skeptic**: Checks if the affected code path is actually changed in the diff, if existing tests would catch it. Defaults to "refute" if uncertain.

A finding is **confirmed** only if ≥2 out of 3 skeptics vote `confirmed: true`. This is intentionally strict to eliminate false positives.

## Token Efficiency

| Scenario | /review-mr (manual Agent) | /sdlc-review-mr (Workflow) |
|---|---|---|
| 6 dimensions, 10 findings | ~80K tokens in context | ~15K tokens in context |
| 6 dimensions, 10 findings + adversarial | N/A (not supported) | ~25K tokens in context |
| 2 dimensions, 3 findings | ~25K tokens | ~8K tokens |
| Subagent failure + retry | ×2 tokens (full re-run) | Resume: only failed agents re-run |

**Mechanism:** Workflow agents still consume tokens during execution, but intermediate results (prompts, outputs, tool calls) stay in script variables. Claude's context receives only the final structured result from `return {...}`.

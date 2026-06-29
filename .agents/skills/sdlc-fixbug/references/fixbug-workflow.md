# Fixbug Workflow — Step 5 Verify + Prevent

How `sdlc:fixbug` skill delegates Step 5 to `workflow-sdlc-fixbug-pipeline`.

## Workflow Args (Complete)

```js
const workflowArgs = {
  // ── Identity ──
  bugId: "BUG-20260610-FR-AUTH-003--login-timeout",
  rootCause: "Connection pool exhaustion in auth middleware — no max-lifetime set",
  workflowMode: "standard",  // "quick" | "standard" | "deep"

  // ── Codebase context from Step 1 ──
  projectType: "node",       // node | python | go | rust | ...
  blastRadius: [
    "src/auth/",
    "src/middleware/",
    "src/api/login/",
  ],
  affectedFiles: [
    "src/auth/middleware.ts",
    "src/db/pool.ts",
    "src/api/login/handler.ts",
  ],
  fixFiles: [
    "src/db/pool.ts",       // only files actually modified in Step 4
  ],

  // ── Pre-fix state from Step 2 ──
  preFixState: "Error: connect ETIMEDOUT 10.0.1.5:5432\n    at Pool.acquire (/app/src/db/pool.ts:42:15)",
  verifyCommands: [
    "bun test src/auth/",
    "bun test src/middleware/",
    "bun test src/api/login/",
  ],

  // ── Configuration ──
  language: "vi",           // vi | en — output language for agents
}
```

## Workflow Modes

| Mode | When | What Runs |
|------|------|-----------|
| `quick` | Simple — type/lint errors, single file | typecheck + lint only. Skip code-review, skip side-effect sweep. |
| `standard` | Moderate — multi-file, unclear root cause | Full pipeline: pre-fix verify, parallel checks, code-review, side-effect sweep, prevention gate, artifacts |
| `deep` | Complex — system-wide, architecture impact | Standard + brainstormer verify + research cross-check |

## Matching Complexity to Mode

Map Step 3 classification to `workflowMode`:

```
Simple    → "quick"
Moderate  → "standard"
Complex   → "deep"
```

For `--parallel` flag: invoke workflow separately per independent issue, each with its own complexity mode.

## Result Processing

### Quick Checklist (on workflow return)

```
1. Read result.status
2. If "passed" → proceed to Step 6 (Finalize)
3. If "failed" → follow decision tree in error-handling.md
4. Extract result.results.artifacts for bug report frontmatter
```

### Success Path

Workflow returns `status: "passed"`:
- Extract artifact paths → pass to Step 6 bug report
- Extract confidence_score + review_score → frontmatter
- Count testsAdded + guardsAdded → Step 5 output line

### Failure Paths

See `references/error-handling.md` for detailed decision trees.

Quick reference:
- **preFixVerify fails** → symptom still reproduces. Loop back to Step 2.
- **parallelChecks fail** → new errors from fix. Fix issues, re-run workflow.
- **codeReview rejects** → AskUserQuestion: rework/accept/abort.
- **sideEffectSweep fails** → AskUserQuestion: revert/narrow/update/accept.
- **preventionGate fails** → AskUserQuestion: add missing guards/skip/abort.

## Invocation Guard

Before calling `Workflow()`, verify the script exists:

```
ls .claude/workflows/workflow-sdlc-fixbug-pipeline.js
```

If missing → report "Workflow script not found" and fall back to manual verification (same as fixbug skill Step 5).

## Fallback: Manual Verification

When workflow tool is unavailable or script is missing:

Execute Step 5 manually following the fixbug skill's Step 5 procedure:
1. Re-run exact pre-fix commands, compare output
2. Regression test
3. Side-effect sweep (blast radius)
4. Code review via `Agent(code-reviewer)`
5. Prevention gate
6. Write artifacts to `.work/bugs/{BUG-ID}/`

Same outputs, same gates — only the execution mechanism differs.

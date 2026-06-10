# Scout Workflow — Steps 4-5: Parallel Search + Aggregate + Report

How `scout` skill delegates Steps 4-5 to `workflow-sdlc-scout-pipeline`.

## Workflow Args (Complete)

```js
const workflowArgs = {
  // ── Search target ──
  topic: "authentication",                    // what we're searching for

  // ── Pre-divided scopes from Step 3 ──
  scopes: [
    {
      name: "auth-core",                      // unique scope identifier
      paths: ["src/auth/", "src/middleware/auth/"],
      patterns: ["authenticate", "session", "login", "token"],
      focus: "auth logic, middleware, sessions",
    },
    {
      name: "auth-api",
      paths: ["src/api/auth/", "src/routes/auth/"],
      patterns: ["router", "controller", "handler", "login", "register"],
      focus: "auth endpoints, login, registration",
    },
    // ... more scopes
  ],

  // ── Project context ──
  projectType: "node",                        // node | python | go | rust | ...
  language: "vi",                             // vi | en

  // ── Output ──
  outputPath: ".work/scouts/scout-20260610-authentication--login-flow.md",

  // ── Configuration ──
  scale: "medium",                            // small | medium | large
  includeContent: false,                      // read file contents?
  deepMode: false,                            // trace dependencies?
}
```

## Mode Flags

| Flag | Behavior |
|------|----------|
| (default) | Standard: multi-modal sweep + dedup + completeness critic + report |
| `--deep` | Deep: also traces dependencies between files (what imports what) |
| `--content` | Content: reads first 100 lines of high-relevance files for key exports |
| `--deep --content` | Both: full deep scan with content reading |

## Workflow Phases

### Phase 1: Scout (Multi-Modal Sweep)

Parallel Explore agents, each covering one scope. Each agent uses the `SCOUT_FINDING` schema:

```js
{
  scopeName: "auth-core",
  filesFound: 12,
  files: [
    { path: "src/auth/middleware.ts", relevance: "high", reason: "Main auth middleware", keyExports: ["authenticate", "authorize"] },
    ...
  ],
  patterns: [
    { pattern: "Middleware chain pattern", evidence: "src/auth/middleware.ts:42" },
    ...
  ],
  directoryStructure: "src/auth/\n├── middleware.ts  - Auth middleware\n├── ...",
  technologies: [
    { category: "Library", name: "passport", version: "0.7.0", purpose: "Auth strategy framework" },
    ...
  ],
  questions: ["How are refresh tokens handled?", ...],
  timedOut: false,
}
```

### Phase 2: Aggregate

- Dedup files by path (keep highest relevance)
- Dedup patterns by normalized name
- Merge technologies (dedup by name)
- Collect all questions
- Run completeness critic → identifies missed directories, uncovered topics, gaps

### Phase 3: Report

Write structured markdown report to `outputPath` with 9 sections:
1. Header (topic, date, scale, mode)
2. Summary (counts)
3. Relevant Files (high/medium/low)
4. Technologies Detected (table)
5. Patterns Observed
6. Directory Map (per-scope ASCII trees)
7. Gaps Identified (from completeness critic)
8. Unresolved Questions
9. Footer

## Result Processing

### Success Path

```js
if (result.status === 'completed') {
  // Extract counts
  const { filesFound, highRelevance, mediumRelevance, patternsObserved, questions, gaps, reportPath } = result.results
  
  // Present to user
  console.log(`✓ Scout complete: ${filesFound} files (${highRelevance} high, ${mediumRelevance} medium)`)
  
  // If gaps found → suggest re-scout
  if (gaps) {
    console.log(`⚠ Gaps: ${gaps.missedDirectories} missed dirs, ${gaps.uncoveredTopics} uncovered`)
  }
}
```

### Empty Path

```js
if (result.status === 'empty') {
  console.log('No files found matching the search target.')
  // Suggest broader search or different keywords
}
```

### Timeout Handling

Agents that time out return partial results with `timedOut: true`. The workflow includes these in the aggregate but flags them. The skill should:

1. Note timed-out agents in the user-facing output
2. If >50% of agents timed out → suggest reducing scope count or splitting into multiple scout runs

## Error Recovery

| Scenario | Action |
|----------|--------|
| No scopes provided | Workflow writes empty report, returns status: 'empty' |
| All agents timed out | Workflow returns available partial results |
| Completeness critic fails | Falls back to null gaps, workflow continues |
| Report write fails | Agent retries internally; if persistent, workflow returns error |
| Workflow file missing | Skill falls back to manual scout (original scout skill Steps 4-5) |


# Pipeline Handoff — sdlc-scout ↔ workflow-sdlc-scout-pipeline

Args schema, result structures, error handling, and retry strategy for the scout pipeline workflow.

## When to Use Pipeline Strategy

| Condition | Strategy |
|-----------|----------|
| `mode = 'explore'` | Always pipeline (needs full Preflight→Scout→Report→Audit) |
| `mode = 'review'` + >200 files | Pipeline with repomix |
| `mode = 'review'` + ≤200 files | Direct Explore agents (no pipeline) |

## Args Structure

```js
const workflowArgs = {
  subProjects: [
    {
      name: "auth-service",                    // string — sub-project identifier
      paths: ["src/auth/"],                    // string[] — directories to scout
      projectType: "node",                     // node | python | go | rust | java | ...
      outputPath: ".work/scouts/scout-20260626-auth--myproject.md",
      repomixSnapshot: ".work/repomix/auth--myproject.xml",  // string | null
      patterns: ["JWT", "OAuth", "token"],     // string[] | null — keywords for Grep
      focus: "Authentication and authorization flow",  // string | null
    },
  ],
  language: "vi",                              // "vi" | "en"
}
```

### Field Details

- **name**: Used in log messages, agent labels, report title. Keep ≤30 chars.
- **paths**: Array of directory paths. Each path must exist and be within repoPath.
- **projectType**: Detected from build files. Used to set agent search patterns.
- **outputPath**: Absolute or relative to cwd. Directory auto-created. Convention: `.work/scouts/scout-YYYYMMDD-{name}--{slug}.md`
- **repomixSnapshot**: Path to repomix XML file or null. If provided, agent reads it first as a map.
- **patterns**: Comma-separated keywords from user's `--patterns` flag or auto-detected from file names.
- **focus**: From user's `--focus` flag. Controls agent exploration scope.

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js", args: workflowArgs })
```

**Guard**: `ls .claude/workflows/workflow-sdlc-scout-pipeline.js` → if missing, fall back to `scout` skill.

## Result Structure

### Success (all sub-projects completed)

```js
{
  mode: "scout",
  status: "completed",
  subProjects: 3,
  completed: 3,
  skipped: 0,
  failed: 0,
  totalFiles: 210,
  reports: [
    {
      name: "auth-service",
      outputPath: ".work/scouts/scout-20260626-auth--myproject.md",
      filesFound: 42,
      highRelevance: 15,
      mediumRelevance: 20,
      lowRelevance: 7,
      patternsObserved: 8,
      technologiesDetected: 12,
      modulesFound: 6,
      entryPointsFound: 3,
      questions: 2,
      skipped: false,
    },
  ],
  failedReports: [],
  gaps: {
    foundGaps: false,
    crossProject: [],
    missedDirectories: [],
    uncoveredTopics: [],
    lowQualityReports: [],
    recommendations: [],
  },
}
```

### Partial Failure (some sub-projects failed)

```js
{
  mode: "scout",
  status: "partial",            // some sub-projects failed — partial results available
  subProjects: 3,
  completed: 2,                 // 2 succeeded
  skipped: 0,
  failed: 1,                    // 1 failed
  totalFiles: 150,
  reports: [...],               // completed + skipped reports
  failedReports: [
    { name: "payment-service", outputPath: ".work/scouts/scout-20260626-payment--myproject.md" },
  ],
  gaps: { ... },
}
```

### Complete Failure

```js
{
  mode: "scout",
  status: "failed",
  subProjects: 1,
  completed: 0,
  failed: 1,
  totalFiles: 0,
  reports: [],
  failedReports: [{ name: "...", outputPath: "..." }],
  gaps: null,
}
```

## Error Handling

### Pattern 1: One sub-project failed

```
Workflow returned: failed: 1, failedReports: [{name: "auth"}]
→ AskUserQuestion: "Scout cho auth-service thất bại. Làm gì tiếp?"
  (header: "Scout Failed")
  Options:
  - "Thử lại" → re-invoke workflow with only failed sub-projects
  - "Bỏ qua" → continue with remaining reports
  - "Dừng"
```

### Pattern 2: Workflow script missing

```
ls .claude/workflows/workflow-sdlc-scout-pipeline.js → no file
→ log warning: "Scout pipeline không tìm thấy. Dùng Explore agent trực tiếp thay thế."
→ fall back to direct Explore agents for all sub-projects
→ note in output: gaps.foundGaps = false (no audit without pipeline)
```

### Pattern 3: Repomix missing (pipeline strategy, explore mode)

Already handled in SKILL.md Phase 2 — AskUserQuestion to install or skip.

## Retry Strategy

```js
// Retry only failed sub-projects
const retryArgs = {
  subProjects: originalArgs.subProjects.filter(
    p => failedNames.includes(p.name)
  ),
  language: originalArgs.language,
}

// Resume if prior run partially completed
Workflow({
  scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js",
  args: retryArgs,
  resumeFromRunId: previousRunId,  // optional — use for in-session retry
})
```

Preflight phase auto-skips sub-projects with existing valid reports, so re-invoking with full `subProjects` list is also safe.

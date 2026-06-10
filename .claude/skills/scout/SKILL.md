---
name: scout
description: >-
  Fast codebase scouting with workflow-driven multi-modal sweep.
  Skill handles interactive phases (analyze task, divide scopes). Workflow handles deterministic parallel Explore agents + dedup + completeness critic + report.
  Use for file discovery, task context gathering, quick searches across directories, or before changes that span multiple codebase areas.
  Trigger phrases: scout, find files, locate, search codebase, explore structure, map project, discover patterns.
argument-hint: "[search-target] [--deep] [--content] [--lang vi|en]"
version: 1.0.0
category: sdlc
keywords: [scout, explore, file-discovery, search, codebase, multi-modal, workflow]
when_to_use: "Invoke for workflow-driven multi-modal codebase scouting with completeness verification. Use for thorough multi-scope sweeps (4+ directories) when token efficiency and resumability matter."
allowed-tools: Read, Write, Bash(*), Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, Workflow
---
# SDLC Scout (Hybrid: Skill + Workflow)

Fast codebase scouting with workflow-driven multi-modal sweep. **Skill** handles interactive phases (analyze task, divide scopes). **Workflow** handles deterministic parallel Explore agents + dedup + completeness critic + report writing.

**Key difference from scout**: Steps 4-5 (parallel agents + aggregate + report) run as a single `Workflow()` call. Benefits: multi-modal sweep pattern, resumable parallel fan-out, structured schema output per agent, completeness critic catches missed areas, token-efficient (intermediate results stay in script variables).

## Quick Start

### Step 1: Analyze Task

Parse user prompt to extract:
- **topic**: what we're searching for (e.g., "authentication", "payment flow", "error handling")
- **flags**: `--deep` (trace dependencies), `--content` (read file contents), `--lang vi|en`
- **language**: `vi` (default) or `en`

### Step 2: Estimate Scale + Map Codebase

Use Grep and Glob to gauge codebase size and locate relevant directories:

```bash
# Estimate scale
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \) ! -path "*/node_modules/*" ! -path "*/.git/*" | wc -l

# Quick structure overview
ls -d src/*/ 2>/dev/null || ls -d lib/*/ 2>/dev/null || ls -d app/*/ 2>/dev/null
```

**Scale classification:**
- **small** (<50 source files): 2-3 scopes
- **medium** (50-200 files): 4-6 scopes
- **large** (200+ files): 6-10 scopes

### Step 3: Divide into Scopes

Split codebase logically into non-overlapping scopes:

```
Example: topic="authentication", projectType="node"

Scope 1: { name: "auth-core", paths: ["src/auth/", "src/middleware/auth/"], focus: "auth logic, middleware, sessions" }
Scope 2: { name: "auth-api", paths: ["src/api/auth/", "src/routes/auth/"], focus: "auth endpoints, login, registration" }
Scope 3: { name: "auth-types", paths: ["src/types/auth/", "src/interfaces/"], focus: "auth types, interfaces, DTOs" }
Scope 4: { name: "auth-utils", paths: ["src/utils/auth/", "src/lib/auth/"], focus: "auth utilities, token handling, encryption" }
Scope 5: { name: "auth-config", paths: ["config/auth/", "src/config/auth/"], focus: "auth configuration, env vars" }
Scope 6: { name: "auth-tests", paths: ["tests/auth/", "src/__tests__/auth/"], focus: "auth test files" }
```

**Division rules:**
- Each scope has 1-3 directories with a clear focus
- No overlap between scopes (dedup handled by workflow)
- Project-type-aware: check `package.json`/`Cargo.toml`/`go.mod` for conventions
- Adjust scope count to `scale` (2-3 for small, 4-6 for medium, 6-10 for large)

### Step 4: Invoke Workflow

#### Step 4.1: Prepare Args

```js
const workflowArgs = {
  topic: "authentication",                    // what we're searching for
  scopes: [                                    // pre-divided directory scopes
    {
      name: "auth-core",                      // unique scope identifier
      paths: ["src/auth/", "src/middleware/auth/"],
      patterns: ["authenticate", "session", "login", "token"],  // keywords
      focus: "auth logic, middleware, sessions",
    },
    // ... more scopes
  ],
  projectType: "node",                        // node | python | go | rust | ...
  language: "vi",                             // vi | en
  outputPath: ".work/scouts/scout-20260610-authentication--login-flow.md",
  scale: "medium",                            // small | medium | large
  includeContent: false,                      // --content flag
  deepMode: false,                            // --deep flag
}
```

**outputPath convention:** `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`

#### Step 4.2: Invoke

```
ls .claude/workflows/workflow-sdlc-scout-pipeline.js
```

If missing → fall back to manual scout (same as original scout skill Steps 4-5).

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js", args: workflowArgs })
```

The workflow handles:
- Phase Scout: parallel Explore agents (multi-modal sweep) with structured schema output
- Phase Aggregate: dedup by file path (keep highest relevance), merge patterns, completeness critic
- Phase Report: write structured report to outputPath

#### Step 4.3: Process Results

**Success:**
```js
{
  mode: 'scout',
  status: 'completed',
  results: {
    topic: "authentication",
    filesFound: 42,
    highRelevance: 15,
    mediumRelevance: 20,
    lowRelevance: 7,
    agentsSpawned: 6,
    agentsCompleted: 5,
    agentsTimedOut: 1,
    patternsObserved: 8,
    technologiesDetected: 12,
    questions: 3,
    gaps: { missedDirectories: 1, uncoveredTopics: 2 },
    reportPath: ".work/scouts/scout-20260610-authentication--login-flow.md",
  }
}
```

**Empty (no matching files):**
```js
{ mode: 'scout', status: 'empty', results: { filesFound: 0, ... } }
```

### Step 5: Present Results

Output summary:
```
✓ Scout complete: 42 files found (15 high, 20 medium, 7 low)
  6 agents spawned, 5 completed, 1 timed out
  8 patterns observed, 12 technologies detected
  Gaps: 1 missed directory, 2 uncovered topics
  Report: .work/scouts/scout-20260610-authentication--login-flow.md
```

If gaps found → suggest re-scouting the missed areas. If agents timed out → note in output, the report includes their partial results.

## Output Format

```
✓ Step 1: Target identified — "authentication"
✓ Step 2: Scale: medium (120 source files)
✓ Step 3: 6 scopes divided
✓ Step 4: Workflow complete — 42 files, 8 patterns
✓ Step 5: Report written — .work/scouts/scout-YYYYMMDD-authentication--login-flow.md
```

## References

- `references/scout-workflow.md` — Workflow args structure, result processing, mode flags
- `references/error-handling.md` — Error recovery patterns: timeout, gaps, missing files, scale mismatch, retry strategy

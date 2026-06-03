---
name: scout
description: Fast codebase scouting using parallel agents. Use for file discovery, task context gathering, quick searches across directories
version: 1.0.0
user-invocable: true
when_to_use: "Invoke for fast file discovery and codebase orientation."
category: dev-tools
keywords: [codebase, scouting, file-discovery, search]
argument-hint: "[search-target]"
allowed-tools: Read, Bash, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, Write
---

# Scout

Fast, token-efficient codebase scouting using parallel Explore subagents to find files needed for tasks.

## When to Use

- Beginning work on feature spanning multiple directories
- User mentions needing to "find", "locate", or "search for" files
- Starting debugging session requiring file relationships understanding
- User asks about project structure or where functionality lives
- Before changes that might affect multiple codebase parts

## Quick Start

1. Analyze user prompt to identify search targets and key directories
2. Estimate scale — use Grep and Glob to gauge codebase size and locate relevant file patterns
3. Spawn parallel Explore subagents with divided directory scopes (see `references/scouting.md`)
4. Aggregate results into a scout report saved to `.work/scouts/`

## Workflow

### 1. Analyze Task
- Parse user prompt for search targets
- Identify key directories, patterns, file types
- Determine optimal number of subagents to spawn based on codebase size

### 2. Divide and Conquer
- Split codebase into logical segments per agent
- Assign each agent specific directories or patterns
- Ensure no overlap, maximize coverage

### 3. Register Scout Tasks
- **Skip if:** Agent count ≤ 2 (overhead exceeds benefit)
- **Skip if:** Task tools unavailable (VSCode extension) — skip task tracking entirely
- `TaskList` first — check for existing scout tasks in session
- If not found, `TaskCreate` per agent with scope metadata
- See `references/task-management-scouting.md` for task registration patterns, metadata schema, and lifecycle management

### 4. Spawn Parallel Agents

- `TaskUpdate` each task to `in_progress` before spawning its agent (skip if Task tools unavailable)
- Spawn all Explore subagents in a single `Agent` tool call for parallel execution
- Each subagent gets a distinct directory scope with no overlap
- See `references/scouting.md` for prompt templates, directory division strategies, and file reading with chunking

**Scale guidelines:**
- Small codebase (<50 files): 2-3 agents
- Medium codebase (50-200 files): 4-6 agents
- Large codebase (200+ files): 6-8 agents

### 5. Collect Results
- Aggregate findings from all agents into a single report
- Save report to: `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`
- `TaskUpdate` completed tasks; note timed-out agents in report (skip if Task tools unavailable)
- List unresolved questions at end of report

**Error handling:** If an agent times out (3 min), skip it and aggregate available results. If `TaskCreate` fails, log a warning and continue without task tracking — scout remains fully functional.

## Report Format

```markdown
# Scout Report: {topic}

## Summary
- Total files found: N
- Agents spawned: N
- Agents completed: N (N timed out)

## Relevant Files
- `path/to/file.ts` - Brief description of what it contains and why it's relevant
- ...

## Patterns Observed
- Key architectural patterns, conventions, or structures found

## Directory Map
```
src/
├── auth/       - Authentication logic
├── api/        - API route handlers
└── models/     - Data models
```

## Unresolved Questions
- Any gaps in findings or areas needing deeper investigation
```

## References

- `references/scouting.md` — Prompt templates, directory division strategies, parallel execution patterns, and chunked file reading
- `references/task-management-scouting.md` — TaskCreate/TaskUpdate patterns, metadata schema, agent lifecycle, and integration with cook/planning

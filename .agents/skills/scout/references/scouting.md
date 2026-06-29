# Internal Scouting with Explore Subagents

Use Explore subagents when you need parallel codebase search. Spawn via the `Agent` tool.

## How It Works

Spawn multiple `Explore` subagents via the `Agent` tool to search the codebase in parallel.

## Agent Configuration

```
subagent_type: "Explore"
```

## Prompt Template

```
Quickly scout {DIRECTORY} for files related to: {USER_PROMPT}

Instructions:
- Search for relevant files matching the task
- Use Glob/Grep for file discovery
- List files with brief descriptions
- Timeout: 3 minutes max
- Skip if timeout reached

Report format:
## Found Files
- `path/file.ext` - description

## Patterns
- Key patterns observed
```

## Spawning Strategy

### Directory Division
Split codebase logically:
- `src/` - Source code
- `lib/` - Libraries
- `tests/` - Test files
- `config/` - Configuration
- `api/` - API routes

### Parallel Execution
- Spawn all agents in a single `Agent` tool call
- Each agent gets distinct directory scope
- No overlap between agents

## Example

User prompt: "Find authentication-related files"

```
Agent 1: Scout src/auth/, src/middleware/ for auth files
Agent 2: Scout src/api/, src/routes/ for auth endpoints
Agent 3: Scout tests/ for auth tests
Agent 4: Scout lib/, utils/ for auth utilities
Agent 5: Scout config/ for auth configuration
Agent 6: Scout types/, interfaces/ for auth types
```

## Timeout Handling

- Set 3-minute timeout per agent
- Skip non-responding agents
- Don't restart timed-out agents
- Aggregate available results

## Reading File Content

When needing to read file content, use chunking to stay within context limits (<150K tokens safe zone).

### Step 1: Get Line Counts
```bash
wc -l path/to/file1.ts path/to/file2.ts path/to/file3.ts
```

### Step 2: Calculate Chunks
- **Target:** ~500 lines per chunk (safe for most files)
- **Max files per agent:** 3-5 small files OR 1 large file chunked

**Chunking formula:**
```
chunks = ceil(total_lines / 500)
lines_per_chunk = ceil(total_lines / chunks)
```

### Step 3: Read Files in Parallel

**Small files (<500 lines each) — use Read tool directly:**
Read each file with the `Read` tool. Batch independent reads in a single message for parallel execution.

**Large file (>500 lines) — use Read with offset/limit:**
```
Read file_path="large-file.ts" offset=1 limit=500
Read file_path="large-file.ts" offset=501 limit=500
Read file_path="large-file.ts" offset=1001 limit=500
```

### Chunking Decision Tree
```
File < 500 lines     → Read entire file
File 500-1500 lines  → Split into 2-3 Read calls with offset/limit
File > 1500 lines    → Split into ceil(lines/500) Read calls
```

Execute all reads in a single message for parallel execution.

## Result Aggregation

Combine results from all agents:
1. Deduplicate file paths
2. Merge descriptions
3. Note any gaps/timeouts
4. List unresolved questions

# Parallel Exploration

Patterns for launching multiple subagents in parallel to scout codebase, verify implementation, and coordinate via native Tasks.

## Parallel Exploration (Scouting)

Launch multiple `Explore` subagents simultaneously when needing to find:
- Related files across different areas
- Similar implementations/patterns
- Dependencies and usage

**Pattern:**
```
Agent(description="Scout area1", prompt="Find [X] in [area1]", subagent_type="Explore")
Agent(description="Scout area2", prompt="Find [Y] in [area2]", subagent_type="Explore")
Agent(description="Scout area3", prompt="Find [Z] in [area3]", subagent_type="Explore")
```

**Example - Multi-area scouting:**
```
// Launch in SINGLE message with multiple Agent calls:
Agent("Scout auth", "Find auth-related files in src/", "Explore")
Agent("Scout API", "Find API routes handling users", "Explore")
Agent("Scout tests", "Find test files for auth module", "Explore")
```

## Parallel Verification (Bash)

Launch multiple `Bash` commands to verify implementation from different angles.

**Pattern:**
```
Bash(command="Run typecheck: bun run typecheck", description="Verify types")
Bash(command="Run lint: bun run lint", description="Verify lint")
Bash(command="Run build: bun run build", description="Verify build")
```

**Example - Multi-verification:**
```
// Launch in SINGLE message:
Bash(command="bun run typecheck", description="Verify types")
Bash(command="bun run lint", description="Verify lint")
Bash(command="bun run build", description="Verify build")
```

## Task-Coordinated Parallel (Moderate+)

For multi-phase fixes, use native Tasks to coordinate parallel agents.
See `references/task-orchestration.md` for full patterns.

**Pattern - Parallel issue trees:**
```
// Create separate task trees per independent issue
T_A1 = TaskCreate(subject="[Issue A] Debug", activeForm="Debugging A")
T_A2 = TaskCreate(subject="[Issue A] Fix",   activeForm="Fixing A",   addBlockedBy=[T_A1])
T_B1 = TaskCreate(subject="[Issue B] Debug", activeForm="Debugging B")
T_B2 = TaskCreate(subject="[Issue B] Fix",   activeForm="Fixing B",   addBlockedBy=[T_B1])
T_final = TaskCreate(subject="Integration verify", addBlockedBy=[T_A2, T_B2])

// Spawn agents per issue tree
Agent("Fix A", "Fix Issue A. Claim tasks via TaskUpdate.", "fullstack-developer")
Agent("Fix B", "Fix Issue B. Claim tasks via TaskUpdate.", "fullstack-developer")
```

Agents claim work via `TaskUpdate(status="in_progress")` and complete via `TaskUpdate(status="completed")`. Blocked tasks auto-unblock when dependencies resolve.

## When to Use Parallel

| Scenario | Parallel Strategy |
|----------|-------------------|
| Root cause unclear, multiple suspects | 2-3 Explore agents on different areas |
| Multi-module fix | Explore each module in parallel |
| After implementation | Bash commands for typecheck + lint + build |
| Before commit | Bash commands for test + build + lint |
| 2+ independent issues | Task trees per issue + fullstack-developer agents |

## Combining Explore + Tasks + Bash

**Step 1:** Parallel Explore to scout
**Step 2:** Sequential implementation (update Tasks as phases complete)
**Step 3:** Parallel Bash to verify

```
// Scout phase - parallel
Agent("Scout payments", "Find payment handlers", "Explore")
Agent("Scout orders", "Find order processors", "Explore")

// Wait for results, implement fix, TaskUpdate each phase

// Verify phase - parallel
Bash(command="bun test", description="Run tests")
Bash(command="bun run typecheck", description="Check types")
Bash(command="bun run build", description="Verify build")
```

## Resource Limits

- Max 3 parallel agents recommended (system resources)
- Each subagent has 200K token context limit
- Keep prompts concise to avoid context bloat
- Use `TaskList()` to check for available unblocked work

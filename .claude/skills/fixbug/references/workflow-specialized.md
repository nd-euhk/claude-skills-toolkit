# Specialized Workflows

Domain-specific fix workflows for common issue categories. Each follows the core 6-step pattern (Scout → Diagnose → Implement → Verify+Prevent → Review → Finalize) with domain-specific tooling.

---

## Type Errors

For TypeScript/type errors. Quick resolution with typecheck loop.

### Commands
```bash
bun run typecheck
tsc --noEmit
npx tsc --noEmit
```

### Rules
- Fix ALL type errors, don't stop at first
- **NEVER use `any` just to pass** — find proper types
- Repeat until zero errors

### Common Fixes
- Missing type imports
- Incorrect property access
- Null/undefined handling
- Generic type parameters
- Union type narrowing

### Workflow
1. Run typecheck command
2. Fix errors one by one
3. Re-run typecheck
4. Repeat until clean

### Tips
- Group related errors (same root cause)
- Check `@types/*` packages for library types
- Use `unknown` + type guards instead of `any`

---

## Test Failures

For fixing failing tests and test suite issues. Uses native Claude Tasks for phase tracking.

### Task Setup
```
T1 = TaskCreate(subject="Compile & collect failures", activeForm="Collecting test failures")
T2 = TaskCreate(subject="Debug root causes",          activeForm="Debugging failures",     addBlockedBy=[T1])
T3 = TaskCreate(subject="Plan fixes",                 activeForm="Planning fixes",          addBlockedBy=[T2])
T4 = TaskCreate(subject="Implement fixes",             activeForm="Implementing fixes",      addBlockedBy=[T3])
T5 = TaskCreate(subject="Re-test",                     activeForm="Re-running tests",        addBlockedBy=[T4])
T6 = TaskCreate(subject="Code review",                 activeForm="Reviewing code",          addBlockedBy=[T5])
```

### Workflow

**Step 1: Compile & Collect Failures** — Run full test suite, collect all failures, group by module/area. Fix syntax errors before running tests.

**Step 2: Debug** — Use `debugger` agent for root cause analysis. Analyze each failure group, identify shared root causes.

**Step 3: Plan** — Use `Plan` agent for fix strategy. Prioritize fixes (shared root causes first), identify dependencies.

**Step 4: Implement** — Implement fixes step by step per plan.

**Step 5: Re-test** — If tests still fail, keep task `in_progress`, loop back to Step 2.

**Step 6: Review** — Use code review subagent.

### Common Commands
```bash
npm test
bun test
pytest
go test ./...
```

### Tips
- Run single failing test first for faster iteration
- Check test assertions vs actual behavior
- Verify test fixtures/mocks are correct
- Don't modify tests to pass unless test is wrong

---

## CI/CD Failures

For GitHub Actions failures and CI/CD pipeline issues.

### Prerequisites
- `gh` CLI installed and authorized
- GitHub Actions URL or run ID

### Workflow

1. **Fetch logs** with `debugger` agent:
   ```bash
   gh run view <run-id> --log-failed
   gh run view <run-id> --log
   ```
2. **Analyze** root cause from logs
3. **Implement fix** based on analysis
4. **Test locally** before pushing
5. **Iterate** if tests fail, repeat from step 3

### Notes
- If `gh` unavailable, instruct user to install: `gh auth login`
- Check both failed step and preceding steps for context
- Common issues: env vars, dependencies, permissions, timeouts

---

## Application Logs

For fixing issues from application logs. Uses native Claude Tasks for phase tracking.

### Prerequisites
- Log file at `./logs.txt` or similar

### Setup (if logs missing)
Add permanent log piping:
- **Bash/Unix**: `command 2>&1 | tee logs.txt`
- **PowerShell**: `command *>&1 | Tee-Object logs.txt`

### Task Setup
```
T1 = TaskCreate(subject="Read & analyze logs",  activeForm="Analyzing logs")
T2 = TaskCreate(subject="Scout codebase",        activeForm="Scouting codebase",    addBlockedBy=[T1])
T3 = TaskCreate(subject="Plan fix",              activeForm="Planning fix",          addBlockedBy=[T1, T2])
T4 = TaskCreate(subject="Implement fix",         activeForm="Implementing fix",      addBlockedBy=[T3])
T5 = TaskCreate(subject="Test fix",              activeForm="Testing fix",           addBlockedBy=[T4])
T6 = TaskCreate(subject="Code review",           activeForm="Reviewing code",        addBlockedBy=[T5])
```

### Workflow

**Step 1: Read & Analyze Logs** — Focus on last N lines first (most recent errors). Look for stack traces, error codes, timestamps, repeated patterns. Use `debugger` agent for root cause analysis.

**Step 2: Scout Codebase** — Use parallel `Explore` subagents to find issue locations.

**Step 3: Plan Fix** — Use `Plan` agent to write implementation plan.

**Step 4: Implement** — Implement the fix.

**Step 5: Test** — If issues remain, loop back to Step 2.

**Step 6: Review** — Use code review subagent.

### Tips
- Focus on last N lines first (most recent errors)
- Look for stack traces, error codes, timestamps
- Check for patterns/repeated errors

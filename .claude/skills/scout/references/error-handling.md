# Error Handling — sdlc:scout

Error recovery patterns specific to the scout workflow pipeline.

## Error Categories

| Category | Trigger | Severity | Default Action |
|----------|---------|----------|---------------|
| **No scopes provided** | `scopes.length === 0` | Low | Workflow writes empty report automatically |
| **All agents timed out** | All scout agents exceed 3 min | High | Return partial results, suggest re-scout with fewer scopes |
| **Partial timeout** | Some agents timed out | Medium | Include partial results, flag in report |
| **Completeness critic fails** | Gap analysis agent error | Medium | Fall back to null gaps, continue |
| **Report write fails** | Agent fails to write .work/scouts/ file | Medium | Retry once, then return error |
| **Workflow file missing** | `workflow-sdlc-scout-pipeline.js` not found | Medium | Fall back to manual scout (original scout skill) |
| **No files found** | `filesFound === 0` | Low | Write report with empty findings, suggest broader search |
| **Scale mismatch** | Agent count too high for codebase | Low | Agents return few/no files; note in report |
| **Large gaps found** | Completeness critic finds ≥3 gaps | Medium | Suggest re-scouting missed areas |

## Pattern 1: No Scopes Provided

```
Workflow returned: status: 'empty', results: { filesFound: 0, agentsSpawned: 0 }
```

**Decision:** This is automatic — the workflow writes an empty report header. The skill should:

```
Report: "No scopes provided — the search target may not match any directories."
Action: Suggest broader search or AskUserQuestion for clarification.
Do NOT: Re-run workflow without adjusting scopes.
```

## Pattern 2: All Agents Timed Out

```
Workflow returned: agentsSpawned = 6, agentsCompleted = 0, agentsTimedOut = 6
```

**Decision Tree:**

```
┌─ All timed out?
│  → Too many scopes for the codebase size
│  → OR network/resource issue
│  → Reduce scope count by 50% and re-run
│
└─ Most timed out (>50%)?
   → Consider splitting into 2 separate scout runs
   → Or switch to original scout skill (manual Agent calls)
```

**After fixing:** Re-invoke workflow with adjusted scopes (smaller count, fewer directories per scope).

## Pattern 3: Partial Timeout

```
Workflow returned: agentsSpawned = 6, agentsCompleted = 5, agentsTimedOut = 1
```

**Decision:**

```
Report: "1 agent timed out (scope: {name}). Results include partial findings."
Action: 
  - If the timed-out scope is HIGH priority → re-scout that scope separately
  - If LOW priority → proceed with available results, note in "Unresolved Questions"
  - If >2 scopes timed out → reduce scope count and re-run
```

**Important:** Partial results from timed-out agents are INCLUDED in the aggregate. They may have found files before timing out.

## Pattern 4: Completeness Critic Fails

```
Workflow returned: gaps = null or gaps.foundGaps = false with empty arrays
```

**Decision:**

```
Report: "Completeness critic could not complete. Manual review recommended."
Action: 
  - Review the report's "Directory Map" section manually
  - Check if any obvious directories were missed
  - If gaps suspected → re-run with explicit focus on missing areas
Do NOT: Trust the report as complete without human review.
```

## Pattern 5: Report Write Fails

```
Workflow agent "write-report" errors — no file at outputPath
```

**Decision:**

```
1. Check if .work/scouts/ directory exists → mkdir -p if missing
2. Re-run workflow with same args (cache hit on Scout + Aggregate phases)
3. If still fails → Agent writes report directly (bypass workflow)
4. If all fails → present aggregated data to user in conversation, skip file
```

## Pattern 6: Workflow Script Not Found

```
ls .claude/workflows/workflow-sdlc-scout-pipeline.js → file not found
```

**Decision:**

```
Report: "Workflow script missing. Falling back to manual scout."
Execute: Original scout skill Steps 4-5 manually.
  - Spawn Agent(Explore) per scope in parallel
  - Manually dedup and aggregate
  - Write report to .work/scouts/
No AskUserQuestion needed — fallback is automatic and equivalent.
```

## Pattern 7: No Files Found

```
Workflow returned: filesFound = 0, status = 'completed'
```

**Decision:**

```
Report: "No files found matching '{topic}' in the specified scopes."
Action:
  - Review the report for gaps (completeness critic may have flagged missed directories)
  - AskUserQuestion:
    Question: "No files found. How to proceed?"
    Header: "Empty Scout"
    Options:
      - "Broader search" — expand scopes to include more directories
      - "Different keywords" — refine search topic/patterns
      - "Accept empty report" — proceed with empty findings
```

## Pattern 8: Large Gaps Found (≥3)

```
Workflow returned: gaps = { missedDirectories: 3, uncoveredTopics: 2 }
```

**Decision:**

```
Report: "Completeness critic found {count} gaps."
AskUserQuestion:
  Question: "{N} gaps identified. How to handle?"
  Header: "Scout Gaps"
  Options:
    - "Re-scout missed areas" — add missed directories as new scopes, re-run
    - "Accept with gaps" — proceed, note gaps in downstream tasks
    - "Deep re-scout" — re-run with --deep --content flags on missed areas
```

## Retry Strategy Summary

| Scenario | Max Retries | Who Decides | Mechanism |
|----------|------------|-------------|-----------|
| No scopes | 1 (auto) | Automatic | Workflow writes empty report |
| All timed out | 2 | Automatic → Human | Reduce scopes, re-run |
| Partial timeout | 1 | Automatic | Note in report, re-scout critical scopes |
| Completeness critic fails | 1 | Automatic | Manual review, no re-run |
| Report write fails | 2 | Automatic | Retry, then bypass workflow |
| Workflow file missing | N/A | Automatic | Fallback to manual scout |
| No files found | 1 | Human | AskUserQuestion |
| Large gaps (≥3) | 1 | Human | AskUserQuestion |
| Total scout attempts | 3 max | Hard gate | Stop → question search strategy |

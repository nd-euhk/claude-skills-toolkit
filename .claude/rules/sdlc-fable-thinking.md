# SDLC Fable Thinking

Fable-thinking is a reasoning middleware for SDLC decision points — it does not
replace procedure, it verifies decisions before execution. Invoke via
`Skill("fable-thinking", "<context>")` at the high-stakes decision points listed
below. Output is a calibrated recommendation for the human to decide — **do not**
auto-execute.

## When To Invoke

| Decision Point | Skill | Trigger | Action |
|---|---|---|---|
| Flow Detection | `sdlc-orchestrator`, `sdlc-automation` | Keyword match conflict, leftover details contradict matched flow, or ambiguous routing | Invoke before `AskUserQuestion`, use recommendation as default suggestion |
| Escalation | `sdlc-orchestrator`, `sdlc-automation`, `sdlc-quick` | Any escalation trigger fires (trivial gate fail, workflow error, scope exceeds lane) | Invoke before proposing escalation to human |
| Pipeline Scope | `sdlc-orchestrator`, `sdlc-automation` | Scope decision to skip/run HLD, LLD, or CROSS-CUTTING | Invoke after grilling, before confirming scope |
| Foundation Gate Fail | `sdlc-orchestrator`, `sdlc-automation` | Preflight cannot create required files | Invoke before stopping pipeline |
| Grilling Exit | `sdlc-automation` | After grilling rounds, uncertain if enough info gathered | Invoke before dispatching workflow |
| Fail-Safe | `sdlc-automation` | Workflow dispatch failure or runtime error | Invoke before falling back to orchestrator |

## Ambiguity Detection

### Flow Detection

Flow detection is **ambiguous** when at least 1 of these conditions is true:

1. Input matches ≥2 flows with different priorities AND the winning flow has lower priority but a longer keyword match
2. Matched flow contains quick/trivial keywords BUT input has non-trivial signals ("API", "schema", "migration", "auth", "billing", "500")
3. Input is too short (<5 words) AND has no clear keyword from any flow

### Grilling Exit (Automation)

Grilling exit is **ambiguous** when:

1. ≥2 questions remain unanswered in the grilling checklist
2. Human responds "not sure"/"maybe"/"we'll see" to any load-bearing question
3. Implicit scope from human answers conflicts with the selected flow

## Invocation Protocol

Pass a concise context summary (not full conversation) in args:

```
Skill("fable-thinking", "<decision-type>: <key facts>.
Options: <list>. Goal: <end-state>.")
```

Context MUST include: decision type, observed facts (OBSERVED), options,
and goal end-state. Read the result, present the recommendation to the human,
**do not** auto-act.

## Integration Points

| Skill | Decision Points | Status |
|---|---|---|
| `sdlc-orchestrator` | Flow Detection, Escalation, Pipeline Scope, Foundation Gate | **Phase 1** |
| `sdlc-automation` | Flow Detection, Grilling Exit, Fail-Safe | **Phase 1** |
| `sdlc-quick` | Trivial Gate, Escalation | Future |
| `sdlc-codebase` | Scope Detection, Overwrite | Future |
| `sdlc-review` | Finding Severity | Future |

## Principles

- **Never** invoke for mechanical tasks (git check, file existence check, sprint update)
- **Never** replace human judgment — recommendation is input only
- **Never** auto-execute — human always makes the final decision
- **Always** pass sufficient context — decision type + facts + options + goal
- **Always** report recommendation with rationale and caveats
- **Once** per decision point — do not loop
- If fable-thinking is unavailable → fall back to existing procedure (do not block pipeline)

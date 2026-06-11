# Workflow Handoff — sdlc-explore ↔ workflow-sdlc-explore-pipeline

Handoff mechanism between `sdlc-explore` skill and `workflow-sdlc-explore-pipeline.js` workflow. Skill prepares all inputs, workflow runs the pipeline, skill processes results and continues Phase 5-6.

## Args Structure (Skill → Workflow)

```js
const workflowArgs = {
  projectName: "payment-system",        // string — project name
  runDate: "2026-06-10",               // string YYYY-MM-DD
  slug: "payment-api",                 // string — kebab-case identifier
  scoutReports: [                       // string[] — explicit file paths, NO globs
    ".work/scouts/scout-20260610-svc-auth--payment-api.md",
    ".work/scouts/scout-20260610-svc-payment--payment-api.md",
  ],
  language: "vi",                       // "vi" (default) | "en"
  mode: "full",                         // "full" | "architect"
}
```

### Preparing args from skill

1. **projectName**: From Phase 1 discovery — main repository name
2. **runDate**: `$(date +%Y%m%d)`
3. **slug**: Short kebab-case describing project purpose
4. **scoutReports**: Collect from `ls .work/scouts/scout-*-{slug}.md` — explicit paths, never globs
5. **language**: Extract from `--lang` flag. Default is `vi` unless `--lang en` or `--en` specified
6. **mode**: `full` for full pipeline, `architect` for architecture only

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

## Result Structure (Workflow → Skill)

### Full Mode — Success
```js
{
  mode: 'full',
  completed: ['SRS', 'HLD', 'LLD', 'LLD-merge', 'FR-Dist', 'IMP+TST'],
  services: 3,
  frDistribution: {
    totalFRs: 42,
    totalGroups: 12,
    groups: [
      "auth/FR-AUTH-001,FR-AUTH-002,FR-AUTH-003",
      "payment/FR-PAY-001,FR-PAY-002,FR-PAY-003,FR-PAY-004",
      // ...
    ]
  },
  results: {
    srs: { passed: true },
    hld: { passed: true },
    lld: 3,  // count of services passed
    merge: { passed: true },
    impTst: {
      total: 12,
      impPassed: 12, impFailed: [],
      tstPassed: 12, tstFailed: [],
    }
  }
}
```

### Architect Mode — Success
```js
{
  mode: 'architect',
  completed: ['SRS', 'HLD'],
  srsGate: { passed: true },
  hldGate: { passed: true }
}
```

### Error — Phase Failure
```js
// FR-Discovery partial failure
{
  phase: 'FR-Discovery',
  error: '2 area(s) failed',
  failed: ['auth-area', 'payment-area']
}

// SRS-Consolidate blocking failure
{
  phase: 'SRS',
  error: 'Gate failed after 3 retries',
  feedback: 'Missing non-functional requirements section...'
}

// LLD partial failure
{
  phase: 'LLD',
  error: '2 service(s) failed gate',
  failed: ['auth-service', 'payment-service']
}
```

## Error Handling Patterns

### Pattern 1: FR-Discovery Failure → Partial
```
Workflow returned: FR-Discovery gate failed for 1 area (auth-area).
→ Report: "FR-Discovery gate failed for auth-area. Other areas passed."
→ AskUserQuestion: "Retry failed area, skip it, or abort?"
  - "Retry" → re-invoke workflow with same args (completed areas auto-skipped)
  - "Skip" → continue with consolidated SRS from discovered FRs only
  - "Abort" → stop pipeline
```

### Pattern 2: SRS-Consolidate/HLD Failure → Blocking
```
Workflow returned SRS gate failure.
→ Report to human: "SRS phase failed gate after 3 retries. Feedback: {feedback}"
→ AskUserQuestion: "Retry, skip SRS and proceed, or abort?"
  - "Retry SRS" → call workflow again with mode=full
  - "Skip and proceed" → call workflow starting from HLD (not yet supported — manual fallback)
  - "Abort" → stop pipeline
```

### Pattern 3: LLD Service Failure → Partial
```
Workflow returned: 1 service failed (auth-service)
→ Report: "LLD gate failed for auth-service. Other 2 services passed."
→ AskUserQuestion: "Retry failed service, skip it, or abort?"
  - "Retry" → spawn Agent(lld-service) + Agent(gate-verifier) manually
  - "Skip" → continue with passed services
  - "Abort" → stop pipeline
```

### Pattern 4: IMP/TST Group Failure → Partial
```
Workflow returned: 2 IMP groups failed
→ Report: "IMP gate failed for auth/FR-AUTH-004,FR-AUTH-005 and payment/FR-PAY-007"
→ AskUserQuestion: "Retry failing IMP groups, skip them, or abort?"
  - "Retry" → spawn Agent(imp-reverse) or Agent(tst-reverse) + Agent(gate-verifier) manually for failed groups
  - "Skip" → continue with passed groups
  - "Abort" → stop pipeline
```

## Manual Override — When workflow is unavailable

Fallback when `Workflow` tool is not functional or manual control is needed:

1. Tell human: "Workflow tool unavailable. Falling back to manual Phase 4 orchestration (same as explore-codebase)."
2. Execute Phase 4 manually — reference `explore-codebase` SKILL.md Phase 4
3. Equivalent results — only the execution mechanism differs

## Token Efficiency Comparison

| Scenario | explore-codebase (manual) | sdlc-explore (workflow) |
|----------|--------------------------|---------------------------|
| 3 services, 15 FRs | ~50K tokens in context | ~8K tokens in context (results only) |
| 1 service, 5 FRs | ~20K tokens | ~5K tokens |
| 10 services, 50 FRs | ~120K tokens (risk overflow) | ~12K tokens |
| Gate retry ×3 | ×3 tokens per retry | Only final result in context |

**Mechanism:** Workflow agents still consume tokens, but intermediate results (prompts, outputs, tool calls) stay in script variables — they don't pollute Claude's context window. Claude receives only the final structured result.

## Comparison: explore-codebase vs sdlc-explore

| Aspect | explore-codebase | sdlc-explore |
|--------|-----------------|-----------------|
| Phase 1-3 (Scout/Plan) | Manual orchestration | Same (no difference) |
| Phase 4 (SDLC Pipeline) | Manual agent spawn + gate + retry + batching | Single `Workflow()` call |
| Gate retry | Manual loop in Claude's context | Automatic in script |
| Concurrency (≤15 rule) | Claude must batch manually | System handles automatically |
| Intermediate results | In Claude's context | In script variables |
| Resumability | Re-run from start on failure | Resume with cached results |
| FR Distribution | Claude reads files, groups manually | Agent in workflow reads + returns structured data |
| Token efficiency | All intermediate state in context | Only final structured result in context |
| Phase 5-6 (Sprint/Summary) | Manual | Same (no difference) |

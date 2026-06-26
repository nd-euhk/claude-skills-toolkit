# Workflow Handoff — sdlc-explore ↔ workflow-sdlc-explore-pipeline

Handoff mechanism between `sdlc-explore` skill and `workflow-sdlc-explore-pipeline.js` workflow. Skill prepares all inputs, workflow runs the pipeline for a SINGLE service, skill processes results and updates state.

## Args Structure (Skill → Workflow)

```js
const workflowArgs = {
  projectName: "my-platform",            // string — project name
  runDate: "2026-06-26",                // string YYYY-MM-DD
  slug: "my-platform",                  // string — kebab-case identifier
  scoutReports: [                        // string[] — explicit file paths (service + libs)
    ".work/scouts/scout-20260626-auth-service--my-platform.md",
    ".work/scouts/scout-20260626-shared-utils--my-platform.md",
    ".work/scouts/scout-20260626-http-kit--my-platform.md",
  ],
  language: "vi",                        // "vi" (default) | "en"
  mode: "full",                          // "full" | "architect"
  focusedService: "auth-service",        // NEW: service chính để explore (single-service model)
  fromPhase: null,                       // optional: force-skip to phase on retry
}
```

### field mới: `focusedService`

Xác định service chính đang được explore. Workflow dùng field này để:
- Chỉ tạo SRS/HLD/LLD/IMP/TST cho service này (không cho libs)
- Libs chỉ cung cấp context (scout reports) nhưng không được explore riêng
- Matching scout report → service: ưu tiên report có tên trùng `focusedService`

### Preparing args from skill

1. **projectName**: Từ state.json `projectName`
2. **runDate**: `$(date +%Y%m%d)`
3. **slug**: Từ state.json `slug`
4. **scoutReports**: Path từ service hiện tại + libs đã scout
5. **language**: Từ `--lang` flag, default `vi`
6. **mode**: `full` cho full pipeline, `architect` cho architecture only
7. **focusedService**: Tên service đang xử lý (từ Phase 1)
8. **fromPhase**: Chỉ set khi retry sau gate failure

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow handles: idempotent retry (completed phases auto-skipped), single-service SRS/HLD/LLD/IMP+TST, gate verification với max 3 retries, auto concurrency.

## Result Structure (Workflow → Skill)

### Full Mode — Success (single service)

```js
{
  mode: 'full',
  focusedService: 'auth-service',
  completed: ['SRS', 'HLD', 'LLD', 'LLD-merge', 'FR-Dist', 'IMP+TST'],
  services: 1,                           // single service model
  frDistribution: {
    totalFRs: 15,
    totalGroups: 4,
    groups: [
      "auth/FR-AUTH-001,FR-AUTH-002,FR-AUTH-003",
      "auth/FR-AUTH-004,FR-AUTH-005,FR-AUTH-006",
      // ...
    ]
  },
  results: {
    srs: { passed: true },
    hld: { passed: true },
    lld: 1,                              // 1 service
    merge: { passed: true },
    impTst: {
      total: 4,
      impPassed: 4, impFailed: [],
      tstPassed: 4, tstFailed: [],
    }
  }
}
```

### Architect Mode — Success

```js
{
  mode: 'architect',
  focusedService: 'auth-service',
  completed: ['SRS', 'HLD'],
  srsGate: { passed: true },
  hldGate: { passed: true }
}
```

### Error — Phase Failure

```js
// FR-Discovery partial failure (multiple scout report areas)
{
  phase: 'FR-Discovery',
  error: '1 area(s) failed',
  failed: ['shared-utils-area']
}

// SRS-Consolidate blocking failure
{
  phase: 'SRS',
  error: 'Gate failed after 3 retries',
  feedback: 'Missing non-functional requirements section...'
}

// LLD failure (single service — blocking vì chỉ có 1 service)
{
  phase: 'LLD',
  error: '1 service(s) failed gate',
  failed: ['auth-service']
}

// IMP/TST group failure (partial)
{
  phase: 'IMP+TST',
  error: '2 group(s) failed',
  impFailed: [{ group: 'auth/FR-AUTH-004', feedback: '...' }],
  tstFailed: [{ group: 'auth/FR-AUTH-007', feedback: '...' }]
}
```

## Error Handling Patterns

### Pattern 1: FR-Discovery Failure → Partial

```
Workflow returned: FR-Discovery gate failed for 1 area (shared-utils-area).
→ Report: "FR-Discovery gate failed for shared-utils. Other areas passed."
→ AskUserQuestion: "Retry failed area, skip it, or abort?"
  - "Retry" → re-invoke workflow with same args (completed areas auto-skipped)
  - "Skip" → continue with consolidated SRS from discovered FRs only
  - "Abort" → stop pipeline
```

### Pattern 2: SRS-Consolidate/HLD Failure → Blocking

```
Workflow returned SRS gate failure.
→ Report: "SRS phase failed gate after 3 retries. Feedback: {feedback}"
→ AskUserQuestion: "Retry, skip SRS and proceed, or abort?"
  - "Retry SRS" → call workflow again
  - "Skip and proceed" → call workflow with fromPhase='HLD'
  - "Abort" → stop pipeline
```

### Pattern 3: LLD Failure (single service) → Blocking

```
Workflow returned: LLD gate failed for auth-service.
→ Report: "LLD gate failed for auth-service."
→ AskUserQuestion: "Retry LLD, skip and proceed without LLD, or abort?"
  - "Retry" → re-invoke workflow with fromPhase='LLD'
  - "Skip" → continue without LLD (FR-Dist + IMP+TST unavailable)
  - "Abort" → stop pipeline
```

### Pattern 4: IMP/TST Group Failure → Partial

```
Workflow returned: 1 IMP group failed
→ Report: "IMP gate failed for auth/FR-AUTH-004"
→ AskUserQuestion: "Retry failing IMP group, skip it, or abort?"
  - "Retry" → spawn Agent(imp-reverse) + Agent(gate-verifier) manually
  - "Skip" → continue with passed groups
  - "Abort" → stop pipeline
```

## Manual Override — When workflow is unavailable

Fallback when `Workflow` tool is not functional:

1. Tell human: "Workflow tool unavailable. Falling back to manual Phase 4 orchestration."
2. Execute Phase 4 manually — spawn agents sequentially:
   - srs-fr-discovery (1 agent, 1 scout report)
   - nfr-inference (1 agent)
   - srs-consolidate (1 agent)
   - gate-verifier (1 agent per phase)
   - hld-reverse (1 agent)
   - lld-service (1 agent)
   - lld-merge (1 agent)
   - fr-distribution (1 agent)
   - imp-reverse + tst-reverse (parallel per FR group)
3. Equivalent results — only the execution mechanism differs

## Token Efficiency (single-service model)

| Scenario | Old (all services) | New (single service) |
|----------|-------------------|---------------------|
| 5 services, 15 FRs | ~50K tokens in context | ~10K tokens |
| 1 service, 5 FRs | ~8K tokens | ~5K tokens |
| 10 services, 50 FRs | ~120K tokens (risk overflow) | ~12K tokens per run |

Single-service model eliminates context overflow risk entirely — mỗi lần chạy chỉ cần context cho 1 service.

## Integration with state.json

Sau khi workflow hoàn thành, skill cập nhật state.json:

```js
// After explore success
state.projects[focusedService].status = 'explore-done'
state.projects[focusedService].explore.done = true
state.projects[focusedService].explore.lastExploreAt = new Date().toISOString()
state.projects[focusedService].explore.phases = {
  srs: result.results.srs.passed,
  hld: result.results.hld.passed,
  lld: result.results.lld,
  impTst: { total: result.results.impTst.total, passed: result.results.impTst.impPassed + result.results.impTst.tstPassed }
}
state.updatedAt = new Date().toISOString()
```

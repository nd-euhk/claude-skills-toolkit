# Workflow Handoff — sdlc-explore v3 ↔ workflow-sdlc-explore-pipeline

Cơ chế handoff giữa `sdlc-explore` skill và `workflow-sdlc-explore-pipeline.js` workflow. Skill chuẩn bị inputs, workflow chạy pipeline cho MỘT service, skill xử lý kết quả và cập nhật state.

## Args Structure (Skill → Workflow)

```js
const workflowArgs = {
  projectName: "my-platform",            // string — project name
  runDate: "2026-06-30",                // string YYYY-MM-DD
  slug: "my-platform",                  // string — kebab-case identifier
  scoutReports: [                        // string[] — explicit file paths (service + libs)
    "knowledge/scouts/scout-20260630-auth-service--my-platform.md",
    "knowledge/scouts/scout-20260630-shared-utils--my-platform.md",
  ],
  language: "vi",                        // "vi" (default) | "en"
  mode: "full",                          // "full" | "architect"
  focusedService: "auth-service",        // service chính để explore
  epicCodes: ["WAL", "PAY"],            // string[] — từ Phase 3 plan (human-confirmed)
  fromPhase: null,                       // optional: force-skip to phase on retry
}
```

### Key Fields

- **focusedService** — Service chính đang explore. Workflow output FR vào `knowledge/04-microservices/{focusedService}/`
- **epicCodes** — Mảng EPIC codes từ Phase 3 plan. Dùng cho `FR-{EPIC}-{NNN}--{slug}.md` naming. KHÔNG tự suy đoán.
- **mode** — `full`: full pipeline (FR → HLD → LLD → IMP → TST), `architect`: chỉ FR + HLD
- **scoutReports** — Path đến các scout report file

### Preparing args from skill

1. **projectName**: Từ knowledge/explore.json `projectName`
2. **runDate**: `$(date +%Y%m%d)`
3. **slug**: Từ knowledge/explore.json `slug`
4. **scoutReports**: Path từ service hiện tại + libs đã scout
5. **language**: Từ `--lang` flag, default `vi`
6. **mode**: `full` hoặc `architect`
7. **focusedService**: Tên service đang xử lý
8. **epicCodes**: Từ Phase 3 plan (human-confirmed)
9. **fromPhase**: Chỉ set khi retry sau gate failure

## Output Structure

Cấu trúc output khớp 100% chuẩn `sdlc` orchestrator. Xem `references/output-standard.md` để biết cấu trúc thư mục đầy đủ, quy ước đặt tên, danh sách file không tạo, và bảng so sánh v2→v3.

## Workflow Invocation

```
Workflow({ scriptPath: "workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow xử lý 5 phase cho 1 service: Preflight (idempotent skip) → FR Discovery per EPIC (pipeline, gate x3) → LLD (1 agent, gate x3) → IMP+TST per EPIC (pipeline, IMP∥TST trong mỗi group, gate x2) → Service Notes (1 agent tổng hợp).

## Result Structure (Workflow → Skill)

### Full Mode — Success (single service)

```js
{
  mode: 'full',
  completed: ['FR-SYS', 'LLD-auth-service', 'IMP-SYS', 'TST-SYS', 'Service-Notes'],
  skipped: [],
  ran: ['FR-SYS', 'LLD-auth-service', 'IMP-SYS', 'TST-SYS', 'Service-Notes'],
  service: 'auth-service',
  results: {
    frDiscovery: {
      totalFRs: 8,
      epics: 2,
      passed: true,
    },
    lld: { passed: true },
    impTst: {
      total: 2,
      impPassed: 2, impFailed: [],
      tstPassed: 2, tstFailed: [],
    },
    serviceNotes: { passed: true },
  }
}
```

### Architect Mode — Success

```js
{
  mode: 'architect',
  completed: ['FR-SYS', 'FR-WAL', 'LLD-auth-service'],
  skipped: [],
  ran: ['FR-SYS', 'FR-WAL', 'LLD-auth-service'],
  service: 'auth-service',
  results: {
    frDiscovery: { totalFRs: 8, epics: 2, passed: true },
    lld: { passed: true }
  }
}
```

### Error — Phase Failure

```js
// FR-Discovery partial failure (per EPIC)
{
  phase: 'FR-Discovery',
  error: '1 EPIC(s) failed',
  failed: ['WAL'],
  skipped: [],
  completed: ['FR-SYS']
}

// LLD blocking failure
{
  phase: 'LLD',
  error: 'Gate failed after 3 retries',
  feedback: 'Missing data layer section in tech-design...',
  skipped: ['FR-Discovery'],
  completed: ['FR-SYS', 'FR-WAL']
}

// IMP/TST partial failure (per EPIC group)
// (returned from full mode — impTst results contain failures)
```

## Error Handling Patterns

### Pattern 1: FR-Discovery Partial Failure (per EPIC)

```
Workflow returned: FR-Discovery gate failed for EPIC WAL.
→ Report: "FR-Discovery gate failed for EPIC WAL. Other EPICs passed."
→ AskUserQuestion: "Retry failed EPIC, skip it, or abort?"
  - "Retry failed EPIC" → re-invoke workflow with fromPhase='FR-Discovery' (completed EPICs auto-skipped)
  - "Skip" → continue with discovered FRs only (no WAL FRs)
  - "Abort" → stop pipeline
```

### Pattern 2: LLD Failure → Blocking

```
Workflow returned LLD gate failure for {service}.
→ Report: "LLD gate failed for {service} after 3 retries. Feedback: {feedback}"
→ AskUserQuestion: "Retry LLD, skip and proceed, or abort?"
  - "Retry LLD" → re-invoke workflow with fromPhase='LLD'
  - "Skip LLD" → continue without LLD (IMP+TST won't have tech-design context, Service Notes less detailed)
  - "Abort" → stop pipeline
```

### Pattern 3: IMP/TST Group Partial Failure (per EPIC)

```
Workflow returned (full mode): 1 IMP group failed, 0 TST groups failed.
→ Report: "IMP gate failed for EPIC WAL"
→ AskUserQuestion: "Retry failing IMP group, skip it, or abort?"
  - "Retry" → spawn agents manually cho group bị fail, hoặc re-invoke with fromPhase='IMP+TST'
  - "Skip" → continue with passed groups (WAL won't have impl specs)
  - "Abort" → stop pipeline
```

## Manual Override — When Workflow is Unavailable

Fallback khi `Workflow` tool không khả dụng:

1. Báo: "Workflow tool unavailable. Falling back to manual Phase 4 orchestration."
2. Thực thi Phase 4 thủ công — spawn agents tuần tự:
   - Preflight (1 Explore agent check existing outputs)
   - FR discovery per EPIC (1 agent per EPIC code, writes FR-{EPIC}-{NNN}--{slug}.md)
   - Gate verifier (1 agent per FR EPIC)
   - LLD (1 agent, writes tech-design.md)
   - Gate verifier (1 agent for LLD)
   - IMP + TST per EPIC (parallel per EPIC group, writes -impl.md và -test.md)
   - Gate verifier (1 agent per IMP/TST group)
   - Service Notes (1 agent, writes .work/system-wide-notes/{service}.md)
3. Kết quả tương đương — chỉ khác cơ chế thực thi.

## Integration with knowledge/explore.json

Sau khi workflow hoàn thành, skill cập nhật state:

```js
// After explore success
state.projects[focusedService].status = 'explore-done'
state.projects[focusedService].explore.done = true
state.projects[focusedService].explore.lastExploreAt = new Date().toISOString()
state.projects[focusedService].explore.epicCodes = workflowArgs.epicCodes
state.projects[focusedService].explore.planPath = `.work/plans/explore-${runDate}-${focusedService}--${slug}.md`
state.projects[focusedService].explore.phases = {
  frDiscovery: result.results.frDiscovery.passed,
  lld: result.results.lld.passed,
  impTst: {
    total: result.results.impTst.total,
    passed: result.results.impTst.impPassed + result.results.impTst.tstPassed
  },
  serviceNotes: result.results.serviceNotes.passed,
}
state.updatedAt = new Date().toISOString()
writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
```

---

# System-Wide Merge Handoff

Handoff giữa `sdlc-explore` skill Phase 7 và `workflow-sdlc-system-merge.js` workflow. Skill chuẩn bị inputs từ state, workflow chạy 6 phase merge tổng, skill xử lý kết quả và cập nhật state.

## Merge Args Structure (Skill → Workflow)

```js
const mergeArgs = {
  projectName: "my-platform",            // string — từ state.projectName
  slug: "my-platform",                  // string — từ state.slug
  language: "vi",                        // "vi" | "en"
  runDate: "2026-06-30",                // string YYYYMMDD
  services: [                            // string[] — danh sách service đã explore-done
    "auth-service",
    "payment-service",
  ],
  fromPhase: null,                       // string | null — optional force-start
}
```

Workflow tự đọc tất cả file từ `knowledge/` và `.work/system-wide-notes/` dựa trên `services`. Không cần truyền path cụ thể.

## Merge Workflow Invocation

```
Workflow({ scriptPath: "workflows/workflow-sdlc-system-merge.js", args: mergeArgs })
```

Workflow xử lý 6 phase system-wide: Collect → C4∥CodingConventions∥GlobalErrorCodes → HardBoundaries∥CrossCutting → Events∥APIs → ADRs → Final Gate.

## Merge Result Structure (Workflow → Skill)

### Success

```js
{
  completed: ['Collect', 'C4', 'Coding-Conventions', 'Global-Error-Codes',
              'Hard-Boundaries', 'Cross-Cutting', 'Events', 'APIs', 'ADRs', 'Gate'],
  results: {
    c4: { passed: true },
    codingConventions: { passed: true },
    globalErrorCodes: { passed: true, totalCodes: 42 },
    hardBoundaries: { passed: true },
    crossCutting: { passed: true },
    events: { total: 5, generated: 5 },
    apis: { total: 3, generated: 3 },
    adrs: { total: 2, generated: 2 },
    gate: { passed: true }
  }
}
```

### Partial Failure

```js
{
  phase: 'C4',
  error: 'Gate failed after 2 retries',
  feedback: 'Missing bounded context mapping for payment-service...',
  completed: ['Collect']
}
```

## Merge Error Handling

### C4 Gate Failure

```
Workflow returned C4 gate failure.
→ Report: "C4 gate failed after 2 retries. Feedback: {feedback}"
→ AskUserQuestion: "Retry C4, skip and proceed without C4, or abort?"
  - "Retry C4" → re-invoke merge workflow with fromPhase='C4+Coding+Errors'
  - "Skip C4" → call workflow with fromPhase='HardBoundaries+CrossCutting' (limited context)
  - "Abort" → stop merge
```

### Events/APIs Partial Failure

```
Workflow returned partial: Events generated 3/5, APIs generated 3/3.
→ Report: "2 events failed to generate."
→ AskUserQuestion: "Retry failed events, skip them, or abort?"
  - "Retry" → re-invoke with fromPhase='Events+APIs'
  - "Skip" → accept partial results
  - "Abort" → stop merge
```

## State Update sau Merge

```js
function updateAfterSystemMerge(state, mergeResult) {
  const now = new Date().toISOString()

  state.systemMerge = {
    done: true,
    lastMergeAt: now,
    services: mergeResult.services || mergeResult.args?.services,
    results: mergeResult.results,
  }
  state.updatedAt = now
  state.history.push({
    action: 'system-merge',
    projects: mergeResult.services || [],
    timestamp: now,
    status: mergeResult.phase ? 'failed' : 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

Xem `references/state-management.md` để biết schema `systemMerge` field đầy đủ.

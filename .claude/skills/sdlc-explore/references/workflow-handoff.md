# Workflow Handoff — sdlc-explore v3 ↔ workflow-sdlc-explore-pipeline

Cơ chế handoff giữa `sdlc-explore` skill và `workflow-sdlc-explore-pipeline.js` workflow. Skill chuẩn bị inputs, workflow chạy pipeline cho MỘT service, skill xử lý kết quả và cập nhật state.

## Args Structure (Skill → Workflow)

```js
const workflowArgs = {
  projectName: "my-platform",            // string — từ state.projectName
  runDate: "2026-06-30",                // string YYYY-MM-DD
  slug: "my-platform",                  // string — kebab-case identifier
  scoutReports: [                        // string[] — paths đến scout report files (service + libs)
    "knowledge/scouts/scout-20260630-auth-service--my-platform.md",
    "knowledge/scouts/scout-20260630-shared-utils--my-platform.md",
  ],
  language: "vi",                        // "vi" (default) | "en"
  mode: "full",                          // "full" | "architect"
  focusedService: "auth-service",        // service chính để explore — FR output vào knowledge/04-microservices/{focusedService}/
  epicCodes: ["WAL", "PAY"],            // string[] — từ Phase 3 plan (human-confirmed), dùng cho FR naming
  fromPhase: null,                       // string | null — force-skip đến phase khi retry sau gate failure
}
```

## Output Structure

Cấu trúc output khớp 100% chuẩn `sdlc` orchestrator. Xem `references/output-standard.md`.

## Workflow Invocation

```
Workflow({ scriptPath: "workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow xử lý 5 phase: **Preflight** (skip idempotent) → **FR Discovery per EPIC** (pipeline, gate x3 retry) → **LLD** (1 agent, gate x3) → **IMP+TST per EPIC** (pipeline, IMP∥TST, gate x2) → **Service Notes** (1 agent tổng hợp).

Mode `full` chạy tất cả 5, mode `architect` dừng sau LLD.

## Result Structure (Workflow → Skill)

### Full Mode — Success

```js
{
  mode: 'full',
  completed: ['FR-SYS', 'LLD-auth-service', 'IMP-SYS', 'TST-SYS', 'Service-Notes'],
  skipped: [],
  ran: ['FR-SYS', 'LLD-auth-service', 'IMP-SYS', 'TST-SYS', 'Service-Notes'],
  service: 'auth-service',
  results: {
    frDiscovery: { totalFRs: 8, epics: 2, passed: true },
    lld: { passed: true },
    impTst: { total: 2, impPassed: 2, impFailed: [], tstPassed: 2, tstFailed: [] },
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

## Error Handling

Xem `references/error-handling.md#explore-pipeline-patterns-phase-4` cho 3 pattern: FR partial fail, LLD blocking fail, IMP/TST partial fail.

## Manual Override — Khi Workflow Không Khả Dụng

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

## State Update Sau Explore

Sau khi workflow hoàn thành, skill cập nhật state:

```js
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

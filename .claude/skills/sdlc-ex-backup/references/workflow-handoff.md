# Workflow Handoff — sdlc-explore ↔ workflow-sdlc-explore-pipeline

Cơ chế handoff giữa `sdlc-explore` skill và `workflow-sdlc-explore-pipeline.js` workflow. Skill chuẩn bị tất cả inputs, workflow chạy pipeline cho MỘT service, skill xử lý kết quả và cập nhật state.

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
  focusedService: "auth-service",        // service chính để explore (single-service model)
  fromPhase: null,                       // optional: force-skip to phase on retry
}
```

### Key Fields

- **focusedService** — Xác định service chính đang được explore. Workflow dùng field này để:
  - Output FR files vào `knowledge/04-microservices/{focusedService}/`
  - Service này được explore đầy đủ (FR → HLD → LLD → IMP → TST)
  - Libs chỉ cung cấp context (scout reports) nhưng không được explore riêng
- **mode** — `full`: full pipeline (FR discovery → HLD → LLD → IMP → TST), `architect`: chỉ FR discovery + HLD
- **scoutReports** — Path đến các scout report file (service + libs)

### Preparing args from skill

1. **projectName**: Từ state.json `projectName`
2. **runDate**: `$(date +%Y%m%d)`
3. **slug**: Từ state.json `slug`
4. **scoutReports**: Path từ service hiện tại + libs đã scout
5. **language**: Từ `--lang` flag, default `vi`
6. **mode**: `full` cho full pipeline, `architect` cho architecture only
7. **focusedService**: Tên service đang xử lý (từ Phase 1)
8. **fromPhase**: Chỉ set khi retry sau gate failure

## Knowledge/ Output Structure

Tất cả output artifacts đều nằm trong `knowledge/`, theo cấu trúc của sdlc skill:

```
knowledge/
├── 01-global-standards/
│   ├── hard-boundaries.md              # Từ HLD — ranh giới service
│   ├── cross-cutting-patterns.md       # Từ LLD-Merge — shared infra, auth, tracing
│   └── nfr-thresholds.md               # Từ NFR-Inference — rate limits, timeouts, cache TTLs
├── 02-central-contracts/
│   ├── apis/
│   │   ├── api-conventions.md          # Từ HLD — API conventions chung
│   │   └── api-{svc}.yaml              # Từ LLD — per-service API spec
│   └── events/
│       └── events.md                   # Từ HLD — event taxonomy
├── 03-system-architecture/
│   ├── system-architecture.md          # Từ HLD — C4 diagrams, bounded contexts
│   ├── architecture.md                 # Từ HLD — agent context + mapping
│   ├── domain-service-mapping.yaml     # Từ HLD — service → domain mapping
│   ├── ADRs/*.md                       # Từ HLD — Architecture Decision Records
│   └── tech-design-index.md            # Từ LLD-Merge — dependency matrix
└── 04-microservices/
    └── {service}/
        ├── FR-{DOMAIN}-{NNN}--{slug}.md      # Từ FR-Discovery — functional requirements
        ├── FR-*-impl.md                      # Từ IMP — implementation specs
        ├── FR-*-test.md                      # Từ TST — test specifications
        ├── tech-design.md                    # Từ LLD — service internals (9 sections)
        └── traceability.md                  # Optional: FR-ID → source trace
```

**Lưu ý:** Không có SRS.md — output là agent-only, không cần human-readable summary.

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow xử lý: idempotent retry (phase đã hoàn thành auto-skipped), FR discovery + NFR inference + HLD/LLD/IMP+TST cho single service, gate verification với tối đa 3 lần retry, auto concurrency.

## Result Structure (Workflow → Skill)

### Full Mode — Success (single service)

```js
{
  mode: 'full',
  completed: ['FR-Discovery', 'NFR-Inference', 'HLD', 'LLD', 'LLD-merge', 'FR-Dist', 'IMP+TST'],
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
  completed: ['FR-Discovery', 'HLD'],
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

// HLD blocking failure
{
  phase: 'HLD',
  error: 'Gate failed after 3 retries',
  feedback: 'Missing bounded context mapping...'
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
  - "Skip" → continue with discovered FRs only (partial coverage)
  - "Abort" → stop pipeline
```

### Pattern 2: HLD Failure → Blocking

```
Workflow returned HLD gate failure.
→ Report: "HLD phase failed gate after 3 retries. Feedback: {feedback}"
→ AskUserQuestion: "Retry, skip HLD and proceed, or abort?"
  - "Retry HLD" → call workflow again
  - "Skip and proceed" → call workflow with fromPhase='LLD'
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

Fallback khi `Workflow` tool không khả dụng:

1. Báo cho người dùng: "Workflow tool unavailable. Falling back to manual Phase 4 orchestration."
2. Thực thi Phase 4 thủ công — spawn agents tuần tự:
   - srs-fr-discovery (1 agent per scout area, writes to knowledge/04-microservices/)
   - nfr-inference (1 agent, writes to knowledge/01-global-standards/)
   - hld-reverse (1 agent, writes to knowledge/03-system-architecture/)
   - gate-verifier (1 agent per phase)
   - lld-service (1 agent per service, writes to knowledge/04-microservices/)
   - lld-merge (1 agent, writes to knowledge/03-system-architecture/ + 01-global-standards/)
   - fr-distribution (1 agent, structured output)
   - imp-reverse + tst-reverse (parallel per FR group, writes to knowledge/04-microservices/)
3. Kết quả tương đương — chỉ khác cơ chế thực thi

## Token Efficiency (single-service model)

| Scenario | Old (all services) | New (single service) |
|----------|-------------------|---------------------|
| 5 services, 15 FRs | ~50K tokens in context | ~10K tokens |
| 1 service, 5 FRs | ~8K tokens | ~5K tokens |
| 10 services, 50 FRs | ~120K tokens (risk overflow) | ~12K tokens per run |

Single-service model loại bỏ hoàn toàn rủi ro context overflow — mỗi lần chạy chỉ cần context cho 1 service.

## Integration with state.json

Sau khi workflow hoàn thành, skill cập nhật state.json:

```js
// After explore success
state.projects[focusedService].status = 'explore-done'
state.projects[focusedService].explore.done = true
state.projects[focusedService].explore.lastExploreAt = new Date().toISOString()
state.projects[focusedService].explore.phases = {
  frDiscovery: true,
  hld: result.results.hld.passed,
  lld: result.results.lld,
  impTst: { total: result.results.impTst.total, passed: result.results.impTst.impPassed + result.results.impTst.tstPassed }
}
state.updatedAt = new Date().toISOString()
```

Note: State schema for phases đã thay đổi — `srs` field được thay bằng `frDiscovery`.

# Flow Reverse — Workflow Args Packaging Guide

Procedure chi tiết cho Bước 5 của sdlc-codebase: package args → invoke workflow →
reverse engineer codebase → agent_docs/ artifacts.

Pipeline: **Scout Report → HLD → LLD → SRS → CROSS-CUTTING → IMP ∥ TST**

Workflow script: `.claude/workflows/codebase/workflow-codebase-reverse.js`

---

## Shared Context Injection

Tất cả codebase-* agents nhận context từ args được package bởi skill.
Workflow script truyền context vào prompt của từng agent. Không cần shared context block —
mỗi agent type có prompt builder riêng trong workflow script.

---

## Phase 0: Plan & Package Args

Trước khi invoke workflow, skill thực hiện:

1. **EnterPlanMode** — plan tổng thể:
   - Danh sách services phát hiện từ scout report
   - Danh sách domains (từ HLD nếu có, hoặc từ scout grouping)
   - Artifacts sẽ sinh
   - Thứ tự phases
   - Expected outputs overview

2. **Human review → approve**

3. **Package args** — dùng template trong `procedures.md` → "Workflow Args Packaging"

4. **Invoke workflow**:
   ```
   Workflow({
     scriptPath: ".claude/workflows/codebase/workflow-codebase-reverse.js",
     args: { scope, scoutReportPath, services, domains, artifacts, focus, foundationPath, workDir, runDate: new Date().toISOString().split("T")[0] }
   })
   ```

---

## Phase 1: Reverse HLD (Extract Architecture từ Code)

### Mục tiêu

Từ code structure, extract: service topology, communication patterns, ADRs (inferred),
C4 container diagrams, bounded context mapping, event taxonomy.

### Workflow Execution

Workflow script spawns 1 agent:
```js
agent(hldPrompt(), {
  label: 'HLD: architecture',
  phase: 'HLD',
  agentType: 'codebase-hld',
})
```

### Args cần cho HLD

| Field | Value | Source |
|-------|-------|--------|
| `scope` | `.` hoặc path cụ thể | Từ `--scope` flag |
| `scoutReportPath` | Đường dẫn scout report | Từ Bước 4 |
| `services` | Danh sách service từ scout | Parse scout report |
| `foundationPath` | `"agent_docs/"` | Default |
| `focus` | Optional focus area | Từ `--focus` flag |

### Expected Outputs

| Output | Mô tả |
|--------|-------|
| `agent_docs/architecture.md` | C4 diagrams (Mermaid), service descriptions, architecture style |
| `agent_docs/adrs/ADR-{NNN}--{slug}.md` | Minimum 3 base ADRs (inferred from code) |
| `agent_docs/adrs/README.md` | ADR index with status tracking |
| `agent_docs/contracts/api-conventions.md` | Observed URL/HTTP patterns |
| `agent_docs/contracts/events.md` | Event types, taxonomy, transport |
| `agent_docs/hard-boundaries.md` | Data ownership, communication rules, security boundaries |

### Domain Detection từ HLD

Sau HLD hoàn tất, skill đọc `agent_docs/architecture.md` để extract domains[]:

```
Từ Service Descriptions → nhóm services theo bounded context → tạo domain list
Từ "Summary for Synthesis" → suggested domains
```

Nếu HLD không chạy (--artifacts không include hld), domains từ scout report grouping.

---

## Phase 2: Reverse LLD (Extract Per-Service Design)

### Mục tiêu

Từ code, extract: domain models, API contracts, database schemas, transaction boundaries,
error handling patterns, caching strategies, circuit breakers, degraded modes.

### Workflow Execution — Fan-Out Per Service

Workflow script spawns N agents song song + 1 synthesis agent:

```js
// Per-service LLD (parallel)
const lldResults = await parallel(
  services.map(svc => () =>
    agent(lldPrompt(svc), {
      label: `LLD: ${svc.name}`,
      phase: 'LLD',
      agentType: 'codebase-lld',
    })
  )
)

// Cross-service synthesis (if N > 1)
const lldSynthesisResult = await agent(lldSynthesisPrompt(lldResults), {
  label: 'LLD synthesis',
  phase: 'LLD',
  agentType: 'codebase-lld-synthesis',
})
```

### Args cần cho LLD

| Field | Value | Source |
|-------|-------|--------|
| `services` | Danh sách service (đã có từ scout) | Scout report |
| `scoutReportPath` | Đường dẫn scout report | Từ Bước 4 |
| `foundationPath` | `"agent_docs/"` | Default |

### Expected Outputs

**Per-service (N files):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/tech-design/{name}-service.md` | 9 sections per service |

**Synthesis (1 agent):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/contracts/api-{domain}.yaml` | API contracts grouped by domain |
| `agent_docs/contracts/error-codes.md` | Canonicalized error codes |
| FR candidates | For SRS phase domain grouping (trả về dạng text, không phải file) |

> **Ghi chú:** Cross-cutting (error-handling, caching-strategy, performance-test,
> frontend-architecture, frontend-test-strategy) KHÔNG phải output của LLD Synthesis —
> chúng do các `codebase-cross-cutting-*` agents tạo trong phase riêng sau SRS.

### Domain Refinement từ LLD Synthesis

Sau LLD Synthesis, skill đọc kết quả để refine domains[]:
- FR candidates → domain grouping suggestions
- API domains → cross-service boundaries
- Dùng refined domains cho SRS phase

---

## Phase 3: Reverse SRS (Infer Requirements từ Code)

### Mục tiêu

Từ code behavior + HLD + LLD context, infer: functional requirements, NFRs,
Gherkin Scenario Outlines, traceability matrix.

### Workflow Execution — Fan-Out Per Domain

Workflow script spawns M agents song song + 1 synthesis agent:

```js
// Per-domain SRS (parallel)
const srsResults = await parallel(
  domains.map(dom => () =>
    agent(srsPrompt(dom), {
      label: `SRS: ${dom.name}`,
      phase: 'SRS',
      agentType: 'codebase-srs',
    })
  )
)

// Cross-domain synthesis (if M > 1)
const srsSynthesisResult = await agent(srsSynthesisPrompt(srsResults), {
  label: 'SRS synthesis',
  phase: 'SRS',
  agentType: 'codebase-srs-synthesis',
})
```

### Args cần cho SRS

| Field | Value | Source |
|-------|-------|--------|
| `domains` | Danh sách domain với services + features | Từ HLD hoặc LLD synthesis |
| `scoutReportPath` | Đường dẫn scout report | Từ Bước 4 |
| `foundationPath` | `"agent_docs/"` | Default |

### Expected Outputs

**Per-domain (M agents):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/features/FR-{DOMAIN}-{NNN}.md` | Feature specs với Gherkin scenarios |
| `agent_docs/features/README.md` (per domain) | Domain feature index |

**Synthesis (1 agent):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/features/README.md` | Unified feature index (all domains) |
| `agent_docs/traceability/requirements-matrix.md` | FR → code module mapping with evidence quality |

---

## Phase 3.5: Cross-Cutting (Synthesize Cross-Cutting Standards from Code)

### Mục tiêu

Sau SRS (đã có NFRs), tổng hợp 5 cross-cutting documents từ reverse-engineered artifacts.
Dùng dedicated `codebase-cross-cutting-*` agents — OBSERVE patterns từ code, không DESIGN standards.

### Workflow Execution — Scope Detection → Stage 1 ∥ → Barrier → Stage 2

Workflow tự động detect scope và spawn agents theo 2 giai đoạn:

```js
// --- Scope Detection ---
// Xác định agents cần chạy dựa trên artifacts có sẵn:
//   error-handling: luôn nếu có ≥1 backend service
//   caching-strategy: nếu architecture.md §6 khai báo cache infrastructure
//   performance-test: nếu SRS có NFR-PERF-* quantified
//   frontend-architecture: nếu architecture.md §1 có frontend service
//   frontend-test-strategy: nếu frontend-architecture được chọn ở Stage 1

// --- Stage 1: 4 agents song song ---
const stage1Tasks = []
if (ccErrorHandling) stage1Tasks.push(agent(ccErrorHandlingPrompt(), { agentType: 'codebase-cross-cutting-error-handling' }))
if (ccCachingStrategy) stage1Tasks.push(agent(ccCachingStrategyPrompt(), { agentType: 'codebase-cross-cutting-caching-strategy' }))
if (ccPerformanceTest) stage1Tasks.push(agent(ccPerformanceTestPrompt(), { agentType: 'codebase-cross-cutting-performance-test' }))
if (ccFrontendArchitecture) stage1Tasks.push(agent(ccFrontendArchitecturePrompt(), { agentType: 'codebase-cross-cutting-frontend-architecture' }))
const stage1Results = await parallel(stage1Tasks)

// --- Barrier: đợi error-handling + frontend-architecture ---
// --- Stage 2: frontend-test-strategy (cần cả 2 input trên) ---
if (ccFrontendTestStrategy && ccResults['frontend-architecture']) {
  agent(ccFrontendTestStrategyPrompt(), { agentType: 'codebase-cross-cutting-frontend-test-strategy' })
}
```

### Mode: REVERSE (OBSERVE, not DESIGN)

Tất cả `codebase-cross-cutting-*` agents dùng mindset quan sát:
- **Forward**: "Hệ thống PHẢI dùng pattern X" (authoritative)
- **Reverse**: "Service A dùng pattern X tại file:line, Service B dùng pattern Y tại file:line → INCONSISTENT" (observational)
- Mỗi claim cần code evidence (file:line) từ reverse-engineered artifacts
- Sections không observe được → "⚠️ NOT OBSERVED — no pattern found in code artifacts"
- Dùng chung template với forward agents, nhưng cho phép NOT OBSERVED

### Expected Outputs

| Agent | Output | Khi nào chạy |
|-------|--------|-------------|
| `codebase-cross-cutting-error-handling` | `agent_docs/error-handling.md` | Luôn nếu có ≥1 backend service |
| `codebase-cross-cutting-caching-strategy` | `agent_docs/caching-strategy.md` | `architecture.md` §6 khai báo cache |
| `codebase-cross-cutting-performance-test` | `agent_docs/performance-test.md` | SRS có NFR-PERF-* quantified |
| `codebase-cross-cutting-frontend-architecture` | `agent_docs/frontend-architecture.md` | `architecture.md` §1 có frontend |
| `codebase-cross-cutting-frontend-test-strategy` | `agent_docs/frontend-test-strategy.md` | frontend-architecture ở Stage 1 |

### Cross-Cutting Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Mỗi agent output có mode indicator `observed_from: codebase_reverse` trong frontmatter | Verify frontmatter |
| 2 | Mỗi claim có code evidence (file:line) hoặc UNCERTAINTY flag | Spot-check 5 claims |
| 3 | Sections không observe được → NOT OBSERVED flag (không bịa) | Scan for NOT OBSERVED |
| 4 | Inconsistencies giữa các service được flag rõ ràng | Đếm INCONSISTENT flags |
| 5 | Template section structure được giữ nguyên (không thêm/bớt) | Compare vs template |
| 6 | Summary for Synthesis section có đủ key metrics | Verify section exists |

---

## Phase 4: Reverse IMP + TST (Song Song)

### Mục tiêu

IMP — Document implementation patterns từ code.
TST — Document test patterns từ code.

### Workflow Execution — Fan-Out Per Domain, IMP ∥ TST

Workflow script spawns 2M agents song song (M IMP + M TST), dùng functional typed-task pattern:

```js
// IMP per domain — functional map + typed tasks
const impTasks = runIMP
  ? domains.map(dom => () =>
      agent(impPrompt(dom), {
        label: `IMP: ${dom.name}`,
        phase: 'IMP+TST',
        agentType: 'codebase-imp',
      }).then(result => ({ type: 'imp', domain: dom.name, result }))
    )
  : []

// TST per domain — song song với IMP
const tstTasks = runTST
  ? domains.map(dom => () =>
      agent(tstPrompt(dom), {
        label: `TST: ${dom.name}`,
        phase: 'IMP+TST',
        agentType: 'codebase-tst',
      }).then(result => ({ type: 'tst', domain: dom.name, result }))
    )
  : []

// Tất cả IMP + TST chạy song song
const allTasks = [...impTasks, ...tstTasks]
if (allTasks.length > 0) {
  const allResults = await parallel(allTasks)
  impResults = allResults.filter(Boolean).filter(r => r.type === 'imp' && r.result)
  tstResults = allResults.filter(Boolean).filter(r => r.type === 'tst' && r.result)
}
```

**Pattern explanation:** Mỗi task trả về `{ type, domain, result }` qua `.then()` — không dùng mutable array side-effect. Filter theo `type` để tách IMP vs TST results. Đây là functional, declarative approach, tránh lỗi splitting như dùng `indexOf` trên object references.

### Args cần cho IMP+TST

| Field | Value | Source |
|-------|-------|--------|
| `domains` | CÙNG domains từ SRS phase | Đã có từ SRS |
| `scoutReportPath` | Đường dẫn scout report | Từ Bước 4 |
| `foundationPath` | `"agent_docs/"` | Default |

### Expected Outputs

**IMP (M files — 1 per domain, covering all features in domain):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/{backend|frontend}/{svc}/implementation/FR-{DOMAIN}-{NNN}-impl.md` | Execution flow, business rules, data impact, error mapping, security. Path prefix route theo service type: `backend|node|go|java` → `backend/`, `frontend|nextjs|react` → `frontend/` |

**TST (M files — 1 per domain, covering all features in domain):**
| Output | Mô tả |
|--------|-------|
| `agent_docs/{backend|frontend}/{svc}/test-specs/FR-{DOMAIN}-{NNN}-test.md` | Test architecture, test cases, fixtures, coverage gaps. Path prefix route theo service type như IMP |

---

## Phase 5: Report (Cross-Reference Validation + Completeness Critic)

Workflow script thực hiện 2 bước trong Report phase:

1. **Completeness Critic** — 1 agent kiểm tra toàn bộ pipeline:
   - Service nào KHÔNG được cover bởi LLD?
   - Domain nào KHÔNG được cover bởi SRS/IMP/TST?
   - Artifact type nào có ZERO outputs?
   - Cross-service domain nào thiếu API contracts?
   - Consistency: feature counts khớp nhau giữa SRS/IMP/TST không?
   - Coverage gap nào chưa được flag?

2. **Cross-reference validation** — tổng hợp tất cả results → structured output

Skill đọc workflow result:
1. Parse outputs[] — danh sách tất cả files đã sinh
2. Parse warnings[] — UNCERTAINTY flags, gaps, inconsistencies
3. Parse critic findings — gaps được completeness critic phát hiện
4. Gate check cho từng phase (dùng criteria trong procedures.md)
5. Báo cáo final summary

### Cross-Reference Check (Post-Workflow, trong Skill)

Sau workflow hoàn tất, skill chạy cross-reference validation:

1. **SRS ↔ HLD**: Mỗi feature trong SRS có service nào implement?
2. **SRS ↔ LLD**: Mỗi FR có API endpoint tương ứng trong LLD?
3. **LLD ↔ IMP**: Mỗi API contract trong LLD có execution flow trong IMP?
4. **IMP ↔ TST**: Mỗi execution flow trong IMP có test coverage trong TST?

Output:

```
🔍 Cross-Reference Validation:
   SRS ↔ HLD: {N}/{M} features có service mapping ({P}% coverage)
   SRS ↔ LLD: {N}/{M} FRs có API mapping
   LLD ↔ IMP: {N}/{M} APIs có execution flow
   IMP ↔ TST: {N}/{M} flows có test coverage
   ⚠️  Orphaned: [references không có backlink]
```

---

## Resume & Partial Runs

Workflow hỗ trợ resume tự động — completed phases dùng cached results:

- Nếu HLD đã có → skip HLD, bắt đầu từ LLD
- Nếu chỉ muốn update SRS → `--artifacts srs` (vẫn chạy scout trước)
- Nếu scout report đã tồn tại và code không thay đổi → dùng lại report

Kiểm tra trước khi package args:

```bash
# Trước HLD
test -f agent_docs/architecture.md && echo "EXISTS" || echo "MISSING"

# Trước LLD
ls agent_docs/tech-design/*.md 2>/dev/null && echo "EXISTS" || echo "MISSING"

# Trước SRS
ls agent_docs/features/FR-*.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

File đã tồn tại → hỏi human: "Update", "Skip (giữ nguyên)", hay "Regenerate từ đầu".

---

## Edge Cases

### Monolith Codebase

- services[] = [{ name: "main", path: "src/", type: "monolith" }]
- HLD: document internal module boundaries (package structure)
- LLD: 1 agent cho toàn bộ monolith
- SRS: domains từ internal module grouping

### Single Service, Single Domain

- HLD: 1 agent (bình thường)
- LLD: 1 agent, skip synthesis
- SRS: 1 agent, skip synthesis
- IMP+TST: 2 agents ∥ (1 IMP + 1 TST)

### Many Services, Unknown Domains

- HLD: 1 agent → extract architecture → detect bounded contexts
- Dùng HLD "Summary for Synthesis" để xác định domains
- Nếu HLD không chạy → group services theo naming convention

### No Test Code Found

- TST agents vẫn chạy, output: "⚠️ NO TESTS FOUND" cho mỗi feature
- Đây không phải error — là finding hợp lệ

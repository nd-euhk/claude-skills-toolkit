# Procedures — Shared Templates & Gate Criteria

Shared procedures dùng chung cho toàn bộ reverse engineering pipeline.
Templates cho Agent spawn, gate criteria, progress reporting, error handling.

---

## Agent Spawn Templates

### Cấu trúc chung cho Reverse Engineering Prompt

Mỗi prompt có 4 phần: **MODE** (xác nhận reverse), **CONTEXT** (scout report + artifacts đã có + scope), **TASK** (extract gì, format), **UNCERTAINTY PROTOCOL** (cách flag phần không xác định được).

### HLD Reverse Prompt Template

```
## MODE: REVERSE ENGINEERING — HLD
EXTRACT architecture từ codebase. KHÔNG thiết kế mới. Mọi claim cần evidence (file:line).

## CONTEXT
Scout: {scout_report_path} | Foundation: agent_docs/project-overview.md, user-context.md
Scope: {scope} | Output: agent_docs/architecture.md

## TASK
1. **C4 Container Diagram** (Mermaid) — containers từ build files/Dockerfiles, channels từ REST clients/message brokers, external systems từ connection strings. Evidence: `<!-- source: file:line -->`
2. **Service Descriptions** — mỗi service: name, responsibility (inferred), tech stack (từ build files), exposed/consumed APIs (từ route defs, HTTP clients)
3. **ADRs** (inferred) — pattern evidence → ADR. Flag: "⚠️ Inferred from code — cần human validation"
4. **Hard Boundaries** — service boundaries (từ build artifacts, DB schemas), API contracts (từ shared types), event taxonomy (từ event classes, topic names)
5. **Deployment View** (nếu có) — Dockerfiles, k8s manifests, infrastructure configs

## UNCERTAINTY PROTOCOL
- Không xác định được → "⚠️ UNCERTAIN: <what> — cần human input"
- Pattern thấy nhưng không rõ lý do → "⚠️ INFERRED: <pattern> — lý do chưa xác nhận"

## OUTPUT: agent_docs/architecture.md — mọi section có ≥1 evidence hoặc UNCERTAIN flag.
```

### LLD Reverse Prompt Template

```
## MODE: REVERSE ENGINEERING — LLD
EXTRACT per-service design từ codebase. KHÔNG thiết kế mới. Mọi claim cần evidence (file:line).

## CONTEXT
Scout: {scout_report_path} | HLD: agent_docs/architecture.md
Foundation: agent_docs/project-overview.md, conventions.md
Scope: {scope} | Services: {danh sách từ HLD}
Output: agent_docs/{backend|frontend}/{name}/tech-design/{name}-{service|app}.md

## TASK — 9 sections cho mỗi service:
1. **Domain Model** — entities, value objects, aggregates, relationships (từ model classes, ORM annotations)
2. **API Contracts** — REST/GraphQL/gRPC endpoints, request/response DTOs, auth requirements, rate limits (từ route defs, controllers)
3. **Data Storage** — DB type+version, schema overview, index/migration strategy (từ connection configs, migrations, ORM defs)
4. **Transaction Boundaries** — @Transactional blocks, saga patterns, unit of work (từ transaction annotations, saga implementations)
5. **Error Handling** — exception hierarchy, error response formats, retry policies, DLQs (từ exception classes, error handlers)
6. **Caching Strategy** — providers, cached entities/queries, TTL/invalidation (từ cache annotations, Redis configs)
7. **External Calls** — called services, circuit breakers, timeout configs, fallbacks (từ HTTP/gRPC clients, resilience configs)
8. **Degraded Modes** — graceful degradation, health checks, readiness probes (từ fallback logic, health endpoints)
9. **Security** — auth mechanism, input validation, CORS, rate limiting (từ auth middleware, validation annotations)

## UNCERTAINTY PROTOCOL
- Không tìm thấy → "⚠️ NOT FOUND: <section> — không detect được từ code"
- Pattern không đầy đủ → "⚠️ PARTIAL: <section> — thiếu <missing>"

## OUTPUT: 1 file/service. Mỗi section có ≥1 evidence hoặc UNCERTAINTY flag.
```

### SRS Reverse Prompt Template

```
## MODE: REVERSE ENGINEERING — SRS
INFER requirements từ code behavior. KHÔNG thiết kế requirements mới. Mọi FR cần evidence hoặc UNCERTAIN flag.

## CONTEXT
Scout: {scout_report_path} | HLD: agent_docs/architecture.md | LLD: agent_docs/{backend,frontend}/*/tech-design/
Foundation: agent_docs/project-overview.md, user-context.md
Scope: {scope} | Output: agent_docs/features/{FR-ID}.md, agent_docs/README.md

## TASK
1. **Feature Discovery** — quét API endpoints, UI routes, background jobs, event handlers → nhóm thành features
2. **Functional Requirements** (mỗi feature): FR-ID, description (suy từ endpoint semantics), actor/role (từ auth middleware), Gherkin Scenario Outlines (Given: validation rules, When: API call, Then: response format + side effects)
3. **NFRs** — performance (timeout/pool configs), security (auth/rate limiting), availability (health checks/retry), scalability (queues/caching)
4. **Traceability Matrix** — mỗi FR → code module(s), mỗi NFR → config evidence
5. **Feature Index** — agent_docs/README.md với danh sách features (ID, title, status, services)

## UNCERTAINTY PROTOCOL
- Business intent không rõ → "⚠️ UNCERTAIN: <FR> — lý do business chưa rõ"
- Actor không xác định → "⚠️ UNCERTAIN: actor for <FR> — không thấy auth check"
- Threshold thiếu → "⚠️ NOT FOUND: NFR threshold for <metric>"

## OUTPUT: feature specs + README.md. Mỗi FR có ≥1 evidence hoặc UNCERTAINTY flag.
```

### IMP Reverse Prompt Template

```
## MODE: REVERSE ENGINEERING — IMP
DOCUMENT implementation patterns từ code. KHÔNG viết specs cho code chưa tồn tại. Mọi claim cần evidence.

## CONTEXT
LLD: agent_docs/{backend,frontend}/*/tech-design/ | SRS: agent_docs/features/*.md
Scope: {scope} | Output: agent_docs/{backend,frontend}/{name}/implementation/{FR-ID}-{slug}.md

## TASK — mỗi feature từ SRS, document 5 phần:
1. **Execution Flow** — Controller→Service→Repository chain, middleware sequence, event flow (step-by-step từ code)
2. **Business Rules Mapping** — rule → implementation (file:line), validation → validator class, authZ → permission check
3. **Data Impact** — tables/collections modified, events published, cache invalidated
4. **Error Mapping** — exception types → HTTP status codes, error handling chain, fallback behaviors
5. **Security** — input validation, authZ check, data sanitization implementation

## OUTPUT: implementation spec với evidence (file:line) cho mỗi claim.
```

### TST Reverse Prompt Template

```
## MODE: REVERSE ENGINEERING — TST
DOCUMENT test patterns từ code. KHÔNG viết specs cho tests chưa tồn tại. Mọi pattern cần evidence (file:line).

## CONTEXT
IMP: agent_docs/{backend,frontend}/*/implementation/ | Scope: {scope}
Output: agent_docs/{backend,frontend}/{name}/test-specs/{FR-ID}-{slug}.md

## TASK — từ test files trong codebase, document 4 phần:
1. **Test Architecture** — frameworks (JUnit/Vitest/Playwright), test types (unit/integration/E2E), fixture/factory patterns, mock/stub strategy
2. **Per-Feature Test Cases** — unit tests (từ test files), integration tests (từ @SpringBootTest/Testcontainers), E2E (từ Playwright/Cypress), performance (từ k6/JMeter nếu có)
3. **Test Data & Fixtures** — factory classes, test data files (JSON/SQL seeds), mock server configs (WireMock/MSW)
4. **Coverage Patterns** — current coverage config, test organization, naming conventions

## OUTPUT: test spec với evidence (file:line). Flag gaps: "⚠️ NO TESTS FOUND: <scenario>"
```

---

## Gate Criteria

### HLD Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | C4 Container diagram tồn tại và dùng Mermaid syntax | Diagram parseable? |
| 2 | Mỗi service có: name, responsibility, tech stack | Đếm services → verify từng service |
| 3 | Communication pathways có evidence từ code | Grep file:line references |
| 4 | ADRs được flag INFERRED hoặc CONFIRMED | Không ADR nào thiếu flag |
| 5 | Hard boundaries giữa services được xác định | Kiểm tra boundary section |
| 6 | External systems được liệt kê | Đếm external systems → có connection details? |

### LLD Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | 9 sections đầy đủ cho mỗi service | Đếm sections |
| 2 | Domain model có entity classes evidence | file:line references |
| 3 | API contracts khớp route definitions | Spot-check 3 endpoints |
| 4 | Error handling flows có evidence | Exception class references |
| 5 | Degraded modes có implementation evidence | Fallback/health check references |

### SRS Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Mỗi feature có description + actor + Gherkin | Đếm features → verify |
| 2 | Mỗi FR có evidence hoặc UNCERTAINTY flag | Không FR nào thiếu flag |
| 3 | NFRs có quantified thresholds hoặc NOT FOUND flag | Đếm NFR categories |
| 4 | Traceability matrix tồn tại | Check bảng mapping |
| 5 | README.md feature index tồn tại | Check file |

### IMP Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Execution flow có step-by-step trace | Verify flow completeness |
| 2 | Business rules map tới FR | Cross-ref SRS |
| 3 | Error mapping khớp exception classes | file:line check |
| 4 | Security considerations có implementation evidence | AuthZ/validation references |

### TST Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Test architecture được document | Framework list |
| 2 | Per-feature test cases có evidence | file:line references |
| 3 | Test data/fixture patterns được document | Factory references |
| 4 | Gaps được flag NO TESTS FOUND | Scan for gaps |

---

## Progress Reporting

Sau mỗi phase, báo cáo theo template:

```
✅ [Phase] hoàn thành — Reverse từ codebase
   📄 Output:
      • agent_docs/architecture.md — HLD với {N} services
      • agent_docs/backend/{svc}/tech-design/{svc}-service.md — LLD
   🚦 Gate: [PASS/FAIL] ([N]/[M] criteria met)
   ⚠️  Failures: [danh sách criteria fail + lý do]
   ⏭️  Next: [phase tiếp theo]
   💡 UNCERTAIN flags: {N} — cần human review trước phase sau
```

Khi pipeline complete:

```
✅ SDLC Codebase — Pipeline Complete

   📄 Artifacts Generated:
      ✅ HLD — architecture.md
      ✅ LLD — {N} service design docs
      ✅ SRS — {M} feature specs
      ✅ IMP — {X} implementation specs
      ✅ TST — {Y} test specs

   📊 UNCERTAIN Flags: {Z} items cần human validation
   📊 Coverage: {P}% modules documented
   💡 Next: Review UNCERTAIN flags → validate với team → merge docs
```

---

## Error Handling

### Agent Timeout

- Mỗi agent có timeout 5 phút
- Timeout → ghi log, hỏi human: "Retry", "Skip phase", "Abort pipeline"
- **Không** tự retry nếu không có human confirm

### Agent Returns Empty/Invalid Output

1. Đọc output file (nếu agent đã write)
2. Kiểm tra: file rỗng? Sai format? Thiếu sections?
3. Báo cáo human: "⚠️ Agent {name} returned invalid output: {issue}"
4. Hỏi: "Retry với prompt điều chỉnh", "Skip phase", "Abort"

### Gate Failure

1. Dừng pipeline — không proceed đến phase tiếp theo
2. Báo cáo criteria fail kèm chi tiết
3. Hỏi human: "Retry phase", "Override gate (chấp nhận fail)", "Abort"

### Codebase Too Large

- Nếu scout report > 500 files → đề xuất `--focus` hoặc `--scope` để giới hạn
- Nếu > 20 services → đề xuất chia nhỏ: chạy từng service một
- Hỏi human trước khi scale up

### File Conflict (agent_docs/ đã có file)

- Trước mỗi phase → check file tồn tại
- Hỏi human: "Update" (ghi đè), "Skip" (giữ nguyên), "Merge" (giữ sections không conflict)
- **Không** tự động overwrite

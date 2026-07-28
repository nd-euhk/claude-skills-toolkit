# Procedures — Workflow Args, Gate Criteria & Error Handling

Shared procedures dùng chung cho toàn bộ reverse engineering pipeline qua Workflow.
Templates cho Workflow Args Packaging, Explore Gap Filling Protocol, gate criteria,
progress reporting, error handling.

---

## Workflow Args Packaging

Skill sdlc-codebase package args từ scout report + HLD output → truyền vào workflow script.
Workflow script nhận args làm input duy nhất, không đọc file từ skill context.

### Args Structure

```js
{
  scope: ".",                              // codebase scope path
  scoutReportPath: ".work/scouts/scout-20260708-*.md",
  services: [                              // từ scout report
    { name: "auth", path: "src/auth/", type: "node" },
    { name: "payment", path: "src/payment/", type: "go" },
  ],
  domains: [                               // từ HLD output hoặc scout report grouping
    { name: "identity", services: ["auth"], features: ["login", "registration", "profile"] },
    { name: "billing", services: ["payment"], features: ["checkout", "refund"] },
  ],
  artifacts: ["hld","lld","srs","imp","tst"],
  focus: "Authentication module",          // optional
  foundationPath: "agent_docs/",
  workDir: "/path/to/repo",
}
```

### Service Detection (từ Scout Report)

Sau khi scout hoàn tất, parse scout report để trích xuất service list:

```
Đọc scout report → xác định:
- Mỗi sub-project/build artifact → 1 service entry
- Tech stack từ build files (package.json, pom.xml, go.mod, etc.)
- Service path từ directory structure
- Service type: backend (API server), frontend (UI app), worker (background job), library (shared code)
```

Nếu scout không detect được service rõ ràng:
- Dùng directory structure: mỗi top-level dir = 1 service candidate
- Hỏi human xác nhận qua AskUserQuestion trước khi package args

### Domain Detection (từ HLD Output)

Sau HLD hoàn tất, đọc `agent_docs/architecture.md` để xác định domain grouping:

```
Đọc architecture.md → xác định:
- Bounded contexts từ service descriptions
- API groupings từ endpoint patterns
- Domain suggestions từ "Summary for Synthesis" section
```

Nếu HLD chưa chạy (--artifacts không include hld):
- Group services theo naming convention (auth*, payment*, user*, etc.)
- Hoặc hỏi human xác nhận domain grouping

### Domain → Feature Mapping

Mỗi domain entry cần danh sách features để SRS/IMP/TST agents biết scope:

```
Đọc LLD output → xác định:
- API endpoints trong domain
- Nhóm endpoints thành features
- Gán feature names

Nếu LLD chưa có:
- Đọc scout report → API route patterns
- Tạo feature list từ endpoint grouping
```

### Packaging Workflow

```
1. Parse scout report → extract services[]
2. Nếu runHLD:
   a. Package args với services (domains có thể rỗng)
   b. Workflow chạy HLD phase
   c. Đọc HLD output → extract domains[]
3. Nếu runLLD:
   a. Package args với services (đã có từ scout)
   b. Workflow chạy LLD phase (N agents ∥)
   c. Đọc LLD synthesis → extract domain suggestions
4. Nếu runSRS:
   a. Package args với domains (từ HLD hoặc LLD synthesis)
   b. Workflow chạy SRS phase (M agents ∥)
5. Nếu runIMP | runTST:
   a. Package args với domains (cùng domains từ SRS)
   b. Workflow chạy IMP+TST phase (2M agents ∥)
```

---

## Explore Gap Filling Protocol

Mỗi codebase-* agent có `Agent` tool để spawn Explore subagents khi scout report
không đủ thông tin. Đây là protocol chuẩn mà tất cả agents tuân theo.

### Decision Flow

```
Agent nhận nhiệm vụ → đọc scout report → đánh giá gaps:

1. Scout có đủ thông tin cho phạm vi của agent không?
   - ĐỦ → tiến hành extract + viết output
   - THIẾU → xác định gaps cụ thể → spawn Explore subagents

2. Sau khi Explore hoàn tất:
   - Dùng kết quả Explore + tự Read code → viết output
   - Flag phần vẫn không đủ: "⚠️ NOT FOUND: <detail> — even after code exploration"
```

### Explore Spawn Patterns

Mỗi agent type có pattern Explore khác nhau tùy theo loại thông tin cần đào sâu:

**codebase-hld:**
```
- "Find all Dockerfiles, docker-compose files, and k8s manifests"
- "Find all HTTP client configs, gRPC stubs, message broker consumers/producers"
- "Find all connection strings and external service URLs in config files"
- "Find all build files (package.json, pom.xml, go.mod) to identify services and tech stacks"
```

**codebase-lld (per service):**
```
- "Find all entity/domain/model classes in {service_path}/"
- "Find all controller/handler/route definitions in {service_path}/"
- "Find all database migration files and ORM configs in {service_path}/"
- "Find all exception/error classes and error handling middleware in {service_path}/"
- "Find all cache configs and annotations in {service_path}/"
```

**codebase-srs (per domain):**
```
- "Find all validation logic and business rules related to {domain} in {service_paths}"
- "Find all permission/role checks and authorization logic in {service_paths}"
- "Find all config files with thresholds, limits, timeouts related to {domain}"
- "Find all event handlers and background jobs related to {domain}"
```

**codebase-imp (per domain):**
```
- "Find all controller/action methods related to {features} in {service_paths}"
- "Find all service/business logic classes related to {features} in {service_paths}"
- "Find all repository/DAO classes related to {features} in {service_paths}"
- "Find all middleware/interceptors for auth, validation, logging in {service_paths}"
```

**codebase-tst (per domain):**
```
- "Find all test files (unit, integration, E2E) related to {domain} in {service_paths}"
- "Find all test config files (jest.config, pytest.ini, JUnit) in {service_paths}"
- "Find all test fixtures, factories, and seed data files in {service_paths}"
- "Find all mock/stub configs and WireMock/MSW setups in {service_paths}"
```

**codebase-cross-cutting-error-handling:**
```
- "Find all exception handler classes and @ControllerAdvice in {service_paths}"
- "Find all error response DTOs and builders in {service_paths}"
- "Find all logging configuration and patterns in {service_paths}"
- "Find all i18n/message bundle files for error messages in {service_paths}"
```

**codebase-cross-cutting-caching-strategy:**
```
- "Find all cache configuration files (Redis, Caffeine) in {service_paths}"
- "Find all @Cacheable/@CacheEvict annotations in {service_paths}"
- "Find all cache key patterns and TTL configs in {service_paths}"
- "Find all cache invalidation triggers (events, direct eviction) in {service_paths}"
```

**codebase-cross-cutting-performance-test:**
```
- "Find all performance config files (connection pools, thread pools) in {service_paths}"
- "Find all rate limiter configs and thresholds in {service_paths}"
- "Find all timeout configs (HTTP client, DB, circuit breaker) in {service_paths}"
- "Find all existing benchmark/k6/JMeter scripts in the codebase"
```

**codebase-cross-cutting-frontend-architecture:**
```
- "Find all Next.js page files with getStaticProps/getServerSideProps in {frontend_path}"
- "Find all middleware.ts files and their route matchers in {frontend_path}"
- "Find all state management imports (Zustand, Redux, TanStack Query) in package.json"
- "Find all security header configs (CSP, HSTS) in next.config.js or middleware"
```

**codebase-cross-cutting-frontend-test-strategy:**
```
- "Find all vitest.config.ts and playwright.config.ts files in {frontend_path}"
- "Find all MSW handler files and mock server setups in {frontend_path}"
- "Find all test files with error simulation patterns in {frontend_path}"
- "Find all Page Object Model / E2E helper files in {frontend_path}"
```

### Explore Constraints

- Mỗi agent spawn tối đa 4 Explore subagents cho 1 nhiệm vụ
- Explore subagents dùng subagent_type: "Explore" (read-only)
- Kết quả Explore được tổng hợp trước khi viết output
- Nếu Explore vẫn không đủ → flag UNCERTAIN, không spawn thêm

---

## Gate Criteria

Gate criteria được áp dụng sau khi workflow hoàn tất từng phase.
Skill đọc kết quả workflow và kiểm tra gate trước khi cho phép phase tiếp theo.

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

### LLD Synthesis Gate

| # | Criteria | Check |
|---|----------|-------|
| 1 | cross-cutting.md covers auth, errors, logging, data, deployment | Đếm patterns documented |
| 2 | api-{domain}.yaml cho mỗi cross-service domain | Đếm domain files |
| 3 | error-codes.md canonicalized từ tất cả services | Check deduplication |
| 4 | FR candidates list với domain grouping suggestions | Check suggestions |

### SRS Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Mỗi feature có description + actor + Gherkin | Đếm features → verify |
| 2 | Mỗi FR có evidence hoặc UNCERTAINTY flag | Không FR nào thiếu flag |
| 3 | NFRs có quantified thresholds hoặc NOT FOUND flag | Đếm NFR categories |
| 4 | Features grouped by domain (không per-service) | Check domain grouping |

### SRS Synthesis Gate

| # | Criteria | Check |
|---|----------|-------|
| 1 | features/README.md với complete domain+feature index | Check file |
| 2 | traceability/requirements-matrix.md maps mỗi FR→code module | Check matrix |
| 3 | Evidence quality rating cho mỗi FR | Check HIGH/MEDIUM/LOW/UNCERTAIN |
| 4 | Cross-domain dependencies documented | Check dependency section |

### IMP Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Execution flow có step-by-step trace | Verify flow completeness |
| 2 | Business rules map tới FR | Cross-ref SRS |
| 3 | Error mapping khớp exception classes | file:line check |
| 4 | Security considerations có implementation evidence | AuthZ/validation references |
| 5 | All features in domain documented (không per-feature gaps) | Count features vs IMP files |

### Cross-Cutting Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Mode indicator: `observed_from: codebase_reverse` trong YAML frontmatter của mỗi output | Verify frontmatter |
| 2 | Mỗi claim có code evidence (file:line) hoặc UNCERTAINTY flag — không claim nào trần trụi | Spot-check 5 claims/output |
| 3 | Sections không observe được → "⚠️ NOT OBSERVED" flag (không bịa ra standards) | Scan output files |
| 4 | Inconsistencies giữa các service được flag với `⚠️ INCONSISTENT` + file:line evidence | Đếm INCONSISTENT flags ≥ inconsistency count |
| 5 | Template section structure được giữ nguyên — không thêm hoặc bớt sections | Compare vs template |
| 6 | Security risks (token ở localStorage, stacktrace exposed in errors) được flag với `⚠️ SECURITY RISK` | Scan for SECURITY RISK flags |
| 7 | Summary for Synthesis section có mặt trong mỗi output | Verify section exists per output |

### TST Gate (Reverse Mode)

| # | Criteria | Check |
|---|----------|-------|
| 1 | Test architecture được document | Framework list |
| 2 | Per-feature test cases có evidence | file:line references |
| 3 | Test data/fixture patterns được document | Factory references |
| 4 | Gaps được flag NO TESTS FOUND | Scan for gaps |
| 5 | All features in domain covered | Count features vs TST files |

---

## Progress Reporting

### Per-Phase Report (từ Workflow Result)

Sau mỗi phase trong workflow, parse kết quả và báo cáo:

```
✅ [Phase] hoàn thành — Reverse từ codebase
   📄 Output:
      • agent_docs/architecture.md — HLD với {N} services
      • agent_docs/backend/{svc}/tech-design/{svc}-service.md — LLD ({M} services)
   🚦 Gate: [PASS/FAIL] ([N]/[M] criteria met)
   ⚠️  Failures: [danh sách criteria fail + lý do]
   ⏭️  Next: [phase tiếp theo]
   💡 UNCERTAIN flags: {N} — cần human review trước phase sau
```

### Pipeline Complete Report

```
✅ SDLC Codebase — Pipeline Complete

   📄 Artifacts Generated:
      ✅ HLD — architecture.md, {A} ADRs
      ✅ LLD — {N} service design docs
      ✅ LLD Synthesis — cross-cutting.md, {D} API domain contracts
      ✅ SRS — {M} feature specs across {D} domains
      ✅ SRS Synthesis — traceability matrix, feature index
      ✅ IMP — {X} implementation specs
      ✅ TST — {Y} test specs

   📊 UNCERTAIN Flags: {Z} items cần human validation
   📊 Coverage: {P}% modules documented
   💡 Next: Review UNCERTAIN flags → validate với team → merge docs
```

### Workflow Failure Report

```
❌ Workflow thất bại ở phase [{phase}]

   ✅ Completed phases: [danh sách]
   ❌ Failed phase: {phase} — {lý do}
   📄 Partial outputs đã tạo: [danh sách files từ các phase đã hoàn thành]
   💡 Options:
      1. Retry workflow (completed phases will use cached results)
      2. Skip phase và proceed với partial results
      3. Abort và review issues manually
```

---

## Error Handling

### Workflow-Level Errors

#### Workflow Script Syntax Error

1. Báo cáo: "❌ Workflow script có lỗi syntax: {error}"
2. Hiển thị line number và context
3. Hỏi human: "Fix script và retry", "Fallback về manual mode (spawn từng agent)"
4. **Không** tự sửa workflow script khi đang chạy pipeline

#### Workflow Timeout

1. Báo cáo phase đang chạy khi timeout
2. Hiển thị phases đã hoàn thành (cached results)
3. Hỏi human: "Resume workflow (chỉ re-run phase bị timeout)", "Retry toàn bộ", "Abort"

#### Partial Agent Failure (Some Agents Fail, Others Succeed)

Đây là tình huống phổ biến nhất trong fan-out:

1. Parse workflow result — xác định agent nào fail, agent nào success
2. Báo cáo:
   ```
   ⚠️ Partial failure in {phase}:
      ✅ {success_count}/{total} agents completed
      ❌ {failed_count} agents failed:
         - {agent_label}: {error_reason}
         - {agent_label}: {error_reason}
   ```
3. Hỏi human:
   - "Retry failed agents only" — re-run workflow, completed agents dùng cache
   - "Proceed with partial results" — tiếp tục phase sau với dữ liệu thiếu
   - "Skip phase" — bỏ qua toàn bộ phase, proceed không có outputs
   - "Abort"

#### All Agents in Phase Fail

1. Dừng pipeline — không proceed
2. Báo cáo tất cả errors
3. Hỏi human: "Retry phase", "Skip phase (chấp nhận gap)", "Abort pipeline"
4. **Không** tự retry nếu không có human confirm

### Agent-Level Errors (Handled by Workflow Script)

Workflow script tự xử lý các error này, skill chỉ nhận kết quả cuối cùng:

- **Agent returns null**: Workflow script ghi nhận agent fail, continue với agents khác
- **Agent timeout**: Workflow script retry 1 lần, nếu vẫn fail → null result
- **Agent schema mismatch**: Workflow script retry với schema validation

### Codebase Too Large

- Nếu scout report > 500 files → đề xuất `--focus` hoặc `--scope` để giới hạn
- Nếu > 20 services → vẫn chạy được với fan-out (mỗi service 1 agent)
- Nếu > 50 services → đề xuất chia thành nhiều lần chạy (theo domain)

### File Conflict (agent_docs/ đã có file)

- Trước mỗi phase → check file tồn tại từ phase trước
- Hỏi human: "Update" (ghi đè), "Skip" (giữ nguyên), "Merge" (giữ sections không conflict)
- **Không** tự động overwrite
- Workflow agents mặc định acceptEdits — nhưng skill orchestrator check conflict trước khi invoke workflow

---

## Workflow Invocation Template

### Bước 5 — Invoke Workflow

```js
// 1. EnterPlanMode — plan tổng thể (services, domains, artifacts)
// 2. Human review → approve
// 3. Package args từ scout report + plan
// 4. Invoke workflow

Workflow({
  scriptPath: ".claude/workflows/codebase/workflow-codebase-reverse.js",
  args: {
    scope: scope,
    scoutReportPath: scoutReportPath,
    services: services,        // từ scout report
    domains: domains,          // từ HLD hoặc scout grouping
    artifacts: artifacts,      // từ --artifacts flag
    focus: focus,              // optional
    foundationPath: "agent_docs/",
    workDir: "<đường dẫn tuyệt đối từ pwd>",
    runDate: new Date().toISOString().split("T")[0],  // ISO date cho deterministic resume (workflow-knowledge: cấm new Date() trong script)
  }
})
```

### Post-Workflow Actions

```
1. Đọc workflow result
2. Parse: status, outputs, warnings
3. Gate check cho từng phase (dùng criteria trên)
4. Báo cáo progress (dùng template trên)
5. Nếu gate fail → dừng, báo cáo human
6. Nếu gate pass → continue hoặc final summary
```

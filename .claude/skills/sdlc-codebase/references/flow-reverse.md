# Flow Reverse — Reverse Engineering Pipeline

Procedure chi tiết cho Bước 5 của sdlc-codebase: reverse engineer codebase → agent_docs/ artifacts.

Pipeline: **Scout Report → HLD → LLD → SRS → IMP ∥ TST**

---

## Shared Context Injection

Mỗi phase subagent nhận context block này trong prompt. Đây là thông tin codebase
đã thu thập được, dùng làm input thay vì output của phase trước (như forward SDLC).

```
## Codebase Context (từ sdlc-scout)

Scout report: {đường dẫn tới scout report}
Foundation: agent_docs/project-overview.md, agent_docs/user-context.md
Codebase scope: {scope path}

## Mode: REVERSE ENGINEERING

Bạn đang REVERSE ENGINEER từ code có sẵn, KHÔNG PHẢI thiết kế từ đầu.
- ĐỌC codebase để extract patterns, không DESIGN patterns mới
- Nếu code không đủ context để xác định intent → flag rõ "UNCERTAIN: <lý do>"
- Giữ nguyên cấu trúc output giống forward SDLC, nhưng nội dung đến từ code analysis
- Mọi claim phải có evidence: file:line từ codebase thực tế
```

---

## Phase 1: Reverse HLD (Extract Architecture từ Code)

### Mục tiêu

Từ code structure, extract: service topology, communication patterns, ADRs (inferred),
C4 container diagrams, bounded context mapping, event taxonomy.

### Procedure

1. **EnterPlanMode** — plan bao gồm:
   - Danh sách service phát hiện từ scout report
   - Communication patterns cần extract (REST, gRPC, message queue, event bus)
   - External systems phát hiện từ config files
   - Chiến lược xử lý service không rõ boundary

2. **Plan Agent prompt:**
   ```
   Lập kế hoạch reverse engineer HLD từ codebase.

   Scout report: {scout_report_path}
   Foundation: agent_docs/project-overview.md
   Codebase scope: {scope}

   Cần xác định:
   - Service boundaries (từ directory structure, build files, Dockerfiles)
   - Communication patterns (từ API clients, message broker configs, event handlers)
   - External integrations (từ connection strings, client libraries)
   - ADRs có thể infer từ code patterns (ví dụ: "dùng CQRS vì có separate read/write models")
   - Những phần KHÔNG THỂ xác định từ code → flag để grill human

   Output: plan chi tiết để spawn sdlc-hld agent với reverse engineering prompt.
   ```

3. **Human review → approve**

4. **Spawn sdlc-hld** — dùng template từ `procedures.md` → "HLD Reverse Prompt Template"

5. **Gate check** — HLD gate criteria:
   - [ ] C4 Container diagram tồn tại và khớp với service structure trong scout report
   - [ ] Mỗi service có: responsibility, tech stack, exposed APIs (từ code analysis)
   - [ ] Communication pathways có evidence (file:line) từ code
   - [ ] ADRs inferred từ code được flag rõ "Inferred from code — cần human validation"
   - [ ] Hard boundaries giữa các service được xác định (từ package structure, API contracts)
   - [ ] External systems được liệt kê kèm connection details từ config

6. **Report:**

   ```
   ✅ HLD hoàn thành — Reverse từ codebase
      📄 Services: {N} phát hiện
      📄 ADRs: {M} inferred (cần validation)
      📄 External Systems: {X}
      🚦 Gate: PASS (6/6)
      ⏭️  Next: LLD
   ```

### Edge Cases

- **Monolith phát hiện** → HLD vẫn được extract (internal module boundaries, package structure)
- **Không tìm thấy service boundaries** → grill human: "Codebase có vẻ là monolith. Xác nhận? Cần tách thành services ảo để document?"
- **Multiple repos trong scope** → mỗi repo = một service, trừ khi có evidence ngược lại
- **Thiếu docker-compose hoặc deployment configs** → flag "Deployment architecture not found in code"

---

## Phase 2: Reverse LLD (Extract Per-Service Design từ Code)

### Mục tiêu

Từ code, extract: domain models, API contracts, database schemas, transaction boundaries,
error handling patterns, caching strategies, circuit breakers, degraded modes.

### Procedure

1. **EnterPlanMode** — plan dựa trên HLD đã extract + scout report

2. **Plan Agent prompt:**
   ```
   Lập kế hoạch reverse engineer LLD từ codebase.

   HLD (đã extract): agent_docs/architecture.md
   Scout report: {scout_report_path}

   Cần xác định cho MỖI service:
   - Domain model (từ entities, models, aggregates trong code)
   - API contracts (từ route definitions, controllers, handlers)
   - Database schema (từ migrations, ORM models, SQL files)
   - Transaction boundaries (từ @Transactional, unit of work patterns)
   - Error handling (từ exception classes, error middleware)
   - Caching (từ cache annotations, Redis clients)
   - Circuit breakers / retry (từ resilience libraries)
   - Những phần KHÔNG THỂ xác định từ code → flag để grill

   Output: plan cho từng service, thứ tự xử lý, expected outputs.
   ```

3. **Human review → approve**

4. **Spawn sdlc-lld** — dùng template từ `procedures.md` → "LLD Reverse Prompt Template"

5. **Gate check** — LLD gate criteria:
   - [ ] Mỗi service có 9 section: Domain Model, API Contracts, Data Storage, Transaction Boundaries, Error Handling, Caching Strategy, External Calls, Degraded Modes, Security Considerations
   - [ ] Domain model khớp với entity/Model classes trong code (evidence: file:line)
   - [ ] API contracts khớp với route/controller definitions trong code
   - [ ] Error handling flows được extract từ code (không tự bịa)
   - [ ] Degraded modes có evidence từ circuit breaker configs, fallback implementations

6. **Report**

### Edge Cases

- **Service không có API** (background worker, cron job) → skip API contracts, focus on event handlers / scheduled tasks
- **Service dùng multiple databases** → document từng database connection + strategy (read/write split, CQRS)
- **Không tìm thấy error handling patterns** → flag "No structured error handling detected in code"

---

## Phase 3: Reverse SRS (Infer Requirements từ Code)

### Mục tiêu

Từ code behavior + HLD + LLD context, infer: functional requirements, NFRs,
Gherkin Scenario Outlines, traceability matrix.

**Đây là phase khó nhất** vì requirements là "WHY", code là "HOW".
Cần suy luận cẩn thận và flag rõ uncertainty.

### Procedure

1. **EnterPlanMode** — plan dựa trên HLD + LLD + scout report

2. **Plan Agent prompt:**
   ```
   Lập kế hoạch reverse engineer SRS từ codebase.

   HLD: agent_docs/architecture.md
   LLD: agent_docs/backend/*/tech-design/, agent_docs/frontend/*/tech-design/
   Scout report: {scout_report_path}

   Cần suy ra:
   - Functional Requirements từ: API endpoints, UI routes, validation logic, business rule implementations
   - Non-Functional Requirements từ: performance configs (timeouts, pool sizes), security implementations (auth middleware, rate limiting), scalability patterns (queue workers, caching)
   - Actor/Role identification từ: permission checks, role-based guards, auth middleware
   - Feature grouping: nhóm các endpoint/logic liên quan thành features

   Nguyên tắc:
   - Mỗi FR phải có evidence từ code (API endpoint, controller action, service method)
   - Gherkin scenarios được suy ra từ: request validation, response format, error handling paths
   - Flag UNCERTAIN cho những phần code không rõ business intent
   - Dùng project-overview.md và user-context.md để bổ sung context

   Output: plan với danh sách features sẽ extract, mapping code → FR, NFR detection strategy.
   ```

3. **Human review → approve**

4. **Spawn sdlc-srs** — dùng template từ `procedures.md` → "SRS Reverse Prompt Template"

5. **Gate check** — SRS gate criteria:
   - [ ] Mỗi feature có: description, actor/role, Gherkin Scenario Outlines
   - [ ] Mỗi FR có evidence từ code (file:line) hoặc được flag UNCERTAIN
   - [ ] NFRs có quantified thresholds (extracted từ configs) hoặc flag "threshold not found in code"
   - [ ] Traceability matrix mapping features → code modules
   - [ ] Các phần UNCERTAIN được tổng hợp để human review

6. **Report**

### Edge Cases

- **Code không thể hiện business rules** (rules nằm trong external service, DB stored procedures) → grill human
- **Validation logic phân tán** (FE + BE validate khác nhau) → document cả hai, flag inconsistency nếu có
- **Không có permission/role system** → flag "No authorization logic detected — system may be open or uses external auth"
- **Performance configs scattered** → tổng hợp tất cả timeout, pool size, rate limit configs; flag gaps

---

## Phase 4: Reverse IMP + TST (Song Song)

### IMP — Document Implementation Patterns

1. **EnterPlanMode** — plan bao phủ cả IMP và TST
2. **Spawn sdlc-imp** — dùng template từ `procedures.md` → "IMP Reverse Prompt Template"
3. **Gate check** — IMP gate criteria:
   - [ ] Mỗi feature có: execution flow, business rules mapping, data impact, error mapping, security considerations
   - [ ] Execution flow có evidence từ code (service methods, middleware chains)
   - [ ] Business rules map tới SRS FRs đã extract
   - [ ] Error mapping khớp với exception classes và error handlers trong code

### TST — Document Test Patterns

1. **Spawn sdlc-tst** (song song với IMP) — dùng template từ `procedures.md` → "TST Reverse Prompt Template"
2. **Gate check** — TST gate criteria:
   - [ ] Test architecture được document: test frameworks, test types, fixture strategy
   - [ ] Test coverage patterns được extract từ test files
   - [ ] Mỗi feature có: unit test cases, integration test cases, E2E scenarios (inferred từ code)
   - [ ] Test data/fixture patterns được document

### Đợi cả hai agent → verify gates độc lập → report

---

## Grilling Integration

Khi code không đủ context, gọi `Skill("grilling")` để hỏi human. Các tình huống phổ biến:

| Tình huống | Câu hỏi gợi ý |
|------------|---------------|
| Service boundary không rõ | "Code có N services trong thư mục X, Y, Z. Đây có phải là các service độc lập? Service nào gọi service nào?" |
| Business rule ẩn | "Logic X trong code kiểm tra điều kiện Y. Quy tắc business đằng sau điều kiện này là gì?" |
| ADR không rõ lý do | "Code dùng Kafka cho event X. Tại sao chọn Kafka thay vì RabbitMQ hoặc direct REST call?" |
| Thiếu context về actor | "API endpoint X yêu cầu role 'admin'. Có những loại user nào khác trong hệ thống?" |
| Performance requirement | "Code set timeout=30s cho external call X. Đây là requirement business hay technical decision?" |

**Quy tắc grilling:**
- Hỏi từng câu một — đợi human trả lời mới hỏi tiếp
- Luôn cung cấp context từ code trước khi hỏi
- Cho phép human skip nếu không biết / không quan trọng
- Tổng hợp cuối cùng — dump toàn bộ kết quả vào summary block

---

## Cross-Reference Validation (Post-Pipeline)

Sau khi tất cả artifacts được sinh, chạy cross-reference check:

1. **SRS ↔ HLD**: Mỗi feature trong SRS có service nào implement? Service trong HLD có cover tất cả features?
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

Pipeline hỗ trợ resume từ phase bất kỳ:

- Nếu HLD đã có → skip HLD, bắt đầu từ LLD
- Nếu chỉ muốn update SRS → `--artifacts srs` (vẫn chạy scout để có context mới nhất)
- Nếu scout report đã tồn tại và code không thay đổi → dùng lại report (cache)

Kiểm tra trước mỗi phase:

```bash
# Trước HLD
test -f agent_docs/architecture.md && echo "EXISTS" || echo "MISSING"

# Trước LLD
ls agent_docs/backend/*/tech-design/*.md 2>/dev/null && echo "EXISTS" || echo "MISSING"

# Trước SRS
ls agent_docs/features/*.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

File đã tồn tại → hỏi human: "Update", "Skip (giữ nguyên)", hay "Regenerate từ đầu".

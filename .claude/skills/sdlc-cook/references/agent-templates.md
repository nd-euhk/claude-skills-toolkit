# Agent Spawn Templates — sdlc-cook

Template chi tiết cho mỗi lần spawn TDD agent trong cook flow. Mỗi template có đầy đủ
biến (variable), context, và expected behavior. Controller dùng file này để construct
prompt chính xác trước khi spawn.

## Biến dùng chung

Các biến này được resolve trước khi spawn, dựa trên context hiện tại:

| Biến | Nguồn | Ví dụ |
|---|---|---|
| `{feature}` | Feature name từ board hoặc human input | "User Authentication" |
| `{FR_ID}` | FR-ID từ board | "FR-001" |
| `{service}` | Service name từ agent_docs/ | "user-service" |
| `{app}` | Frontend app name từ agent_docs/ | "admin-dashboard" |
| `{layer}` | BE hoặc FE dựa trên feature | "backend" hoặc "frontend" |
| `{N}` | TC number (1, 2, 3...) | "1" |
| `{tc_name}` | Test case name từ TST spec | "should hash password on user creation" |
| `{tc_layer}` | unit / integration / e2e | "unit" |
| `{risk}` | CRITICAL / HIGH / MEDIUM / LOW | "CRITICAL" |
| `{baseline_path}` | Path đến baseline file | ".work/baselines/20260730-FR-001-BE.json" |
| `{previous_tc_summary}` | Tóm tắt files changed từ TC trước | "TC-1 đã sửa: UserService.java, User.java" |
| `{agent_prefix}` | `sdlc-tdd-be` hoặc `sdlc-tdd-fe` | "sdlc-tdd-be" |
| `{spec_dir}` | `backend/{service}` hoặc `frontend/{app}` | "backend/user-service" |

---

## 1. Baseline Capture

Không spawn agent — dùng `.claude/scripts/baseline` harness script trực tiếp.

### 1a: Detect Framework + Run Tests

```bash
# BE frameworks:
# - Gradle:  ./gradlew :{service}:test
# - Maven:   ./mvnw test -pl {service}
# - Go:      go test ./... -v -json > /tmp/baseline-{FR_ID}.json
# - Rust:    cargo test 2>&1 | tee /tmp/baseline-{FR_ID}.txt
# - pytest:  python3 -m pytest --json-report --json-report-file=/tmp/baseline-{FR_ID}.json

# FE frameworks:
# - Jest:    npx jest --json --outputFile=/tmp/baseline-{FR_ID}.json
# - Vitest:  npx vitest run --reporter=json --outputFile=/tmp/baseline-{FR_ID}.json
```

### 1b: Parse Output

```bash
# JUnit XML (Gradle/Maven — test reports auto-generated):
.claude/scripts/baseline parse \
  --framework junit-xml \
  --test-output-dir {build/test-results/test/ hoặc target/surefire-reports/} \
  --fr-id {FR_ID} --layer {be|fe} --service {service} --app {app} \
  --test-command "{test_command}"

# JSON-based frameworks:
.claude/scripts/baseline parse \
  --framework {jest-json|vitest-json|pytest-json|go-json|rust-text} \
  --input /tmp/baseline-{FR_ID}.json \
  --fr-id {FR_ID} --layer {be|fe} --service {service} --app {app} \
  --test-command "{test_command}"
```

### 1c: Verify Baseline

```bash
.claude/scripts/baseline list-tcs --baseline {baseline_path}
```

Output hiển thị: summary (total/passed/failed/skipped), pre-existing failures, từng file + danh sách TC.

---

## 2. RED Agent (per-TC mini-orchestrator)

Spawn cho MỖI test case. Đây là mini-orchestrator — nó viết test, verify RED, spawn GREEN
và REFACTOR-light nội bộ.

```javascript
Agent({
  subagent_type: "{agent_prefix}-red",
  description: "RED TC-{N}: {tc_name}",
  permissionMode: "acceptEdits",
  prompt: `
Viết test và điều phối TDD cycle cho MỘT test case:

Feature: {feature}
TC: {N} — {tc_name}
FR-ID: {FR_ID}
Service: {service}
Layer: {tc_layer}
Risk: {risk}

Đọc test case từ: agent_docs/{spec_dir}/test-specs/{FR_ID}-test.md
Đọc IMP spec từ: agent_docs/{spec_dir}/implementation/{FR_ID}-impl.md
Đọc tech-design: agent_docs/tech-design/{service}-service.md
Đọc hard-boundaries: agent_docs/hard-boundaries.md
Đọc conventions: agent_docs/conventions.md

Baseline file: {baseline_path}
(tham chiếu nếu cần xác nhận test nào đã pass trước đó)

Kết quả từ các TC trước (nếu có):
{previous_tc_summary}

Thực hiện:
1. Viết test code cho test case này
2. Verify test FAILS (RED)
3. Nếu accidental green → detect qua sabotage (max 3 attempts):
   - Sanity check: test có trivially true không?
   - Explore: spawn Explore agent map source code path
   - Sabotage: minimal change để break implementation
   - Verify: confirm test now fails
   - Revert: git checkout để restore
   → Return SKIPPED
4a. Test RED → spawn {agent_prefix}-green để implement code tối thiểu
4b. INTERFERENCE-LIGHT: sau GREEN, chạy tất cả test trong file hiện tại
     → detect nếu TC này break test khác
4c. Accidental green confirmed → skip GREEN, INTERFERENCE, REFACTOR
5. Nếu interference-free → spawn {agent_prefix}-refactor --mode=light
6. Return kết quả (DONE|BLOCKED|STALE|INTERFERENCE)
  `
})
```

### RED Return Codes

| Code | Ý nghĩa | Hành động controller |
|---|---|---|
| DONE | Test đỏ → GREEN implemented → REFACTOR-light done | Tiếp tục TC tiếp theo |
| SKIPPED | Accidental green (đã có implementation) | Tiếp tục TC tiếp theo |
| INTERFERENCE | TC này break test khác trong cùng file | **Dừng**, báo human |
| BLOCKED | 3 sabotage attempts failed | **Dừng**, báo human kiểm tra thủ công |
| STALE | Ambiguous spec — không viết được test | Báo human, quyết định skip hay dừng |

---

## 3. GREEN Agent (spawn bởi RED)

GREEN agent được spawn NỘI BỘ bởi RED agent — controller không spawn trực tiếp.
Template này để tham khảo.

```javascript
Agent({
  subagent_type: "{agent_prefix}-green",
  description: "GREEN TC-{N}: implement {tc_name}",
  permissionMode: "acceptEdits",
  prompt: `
Implement code tối thiểu để pass test case:

TC: {N} — {tc_name}
FR-ID: {FR_ID}
Service: {service}
Test file: [path từ RED output]
Test vừa được viết và đang FAIL (RED). Viết code để test pass.

Skip protocol:
- Nếu RED báo accidental-green → skip implement, return SKIPPED ngay
- Nếu RED báo BLOCKED hoặc STALE → abort, return ngay

Implement theo layer (bottom-up):
{BE layers: Domain Model → Repository → DTOs/Mapper → REST Client → Service → Controller → Migration → Configuration}
{FE layers: Types/Zod → API Client → Custom Hooks → Presentational Components → Container Components → Page → Routing}

Quy tắc:
- Code TỐI THIỂU — chỉ đủ pass test, không hơn
- Không abstraction, không pattern mới
- Không refactor code hiện có
- Chạy test sau mỗi layer (max 5 iterations / layer)
- Return DONE | SKIPPED | STUCK
  `
})
```

---

## 4. REFACTOR Agent (light mode — spawn bởi RED)

```javascript
Agent({
  subagent_type: "{agent_prefix}-refactor",
  description: "REFACTOR-light TC-{N}",
  permissionMode: "acceptEdits",
  prompt: `
Mode: light
Feature: {feature}
TC: {N} — {tc_name}
FR-ID: {FR_ID}
Files changed by this TC: [từ GREEN output]

Chỉ thực hiện:
- Extract method/function/component (nếu dùng ≥3 lần)
- Rename cho rõ nghĩa
- Inline trivial helpers
- Xóa dead code / unused imports

Không:
- Cross-cutting categories (security, performance, resilience...)
- Thay đổi file ngoài scope TC này
- Thêm abstraction mới
- Format code không liên quan

Keep ALL tests GREEN qua mọi thay đổi. Undo nếu break test.
  `
})
```

---

## 5. GATE Light Agent (4 critical checks)

Spawn sau khi tất cả TCs hoàn thành.

```javascript
Agent({
  subagent_type: "{agent_prefix}-gate",
  description: "GATE light: {feature}",
  permissionMode: "acceptEdits",
  prompt: `
Mode: light
Feature: {feature}
Service: {service}
FR-ID: {FR_ID}

Tất cả per-TC cycles đã hoàn thành. Đây là tổng hợp:
{per_tc_summary}

Baseline file: {baseline_path}
(dùng để so sánh INTERFERENCE-FULL)

Tổng số files changed: {total_files_changed}
Tech stack hint: [detected từ RED agent reports]

Chạy 4 critical gates:

{BE gates:}
- L1: Test Suite + INTERFERENCE-FULL
      Dùng baseline.py compare để so sánh baseline → current
      Test nào pass trước đây mà giờ fail → interference
- L2: Hard Boundaries — không cross-service DB access, API-only inter-service
- L3: Query Safety — không raw SQL string concatenation
- L4: External Call Resilience — timeout + circuit breaker trên mọi external call

{FE gates:}
- L1: Unit Tests + INTERFERENCE-FULL (baseline compare)
- L2: Token Security — không auth token trong localStorage/sessionStorage
- L3: XSS Prevention — không dangerouslySetInnerHTML không có DOMPurify
- L4: State Coverage — mọi component handle loading/empty/error/success

Return PASS/FAIL với failures chi tiết.
  `
})
```

### GATE Light Results

| Kết quả | Hành động |
|---|---|
| ALL 4 PASS (bao gồm INTERFERENCE-FULL clean) | Tiếp tục REFACTOR full |
| INTERFERENCE DETECTED | **Dừng**, báo human với interference table |
| FAIL (khác interference) | Spawn fix agents → retry GATE light (max 2) |

---

## 6. REFACTOR Full Agent (6 categories + framework-specific)

Spawn sau GATE light PASS.

```javascript
Agent({
  subagent_type: "{agent_prefix}-refactor",
  description: "REFACTOR full: {feature}",
  permissionMode: "acceptEdits",
  prompt: `
Mode: full
Feature: {feature}
Service: {service}
FR-ID: {FR_ID}

GATE light: PASS (4/4, no interference)
Baseline: {baseline_path}
Files changed across all TCs: {all_files_changed}
Tech stack: {detected_tech_stack}

Chạy tất cả 6 categories + framework-specific check:

{BE categories:}
1. Security — input validation, injection prevention, auth, RBAC, sensitive data exposure
2. Data Integrity — transactions, idempotency, optimistic locking, cascading
3. Performance — N+1 queries, missing indexes, connection leaks, eager/lazy loading
4. Resilience — circuit breaker, timeouts, retry/backoff, graceful degradation
5. Observability — correlation IDs, structured logging, error responses, health indicators
6. Code Quality — lint, format, duplication, naming, dead code
7. Framework-Specific — Spring Boot / Node.js / Python / Go / Rust compliance

{FE categories:}
1. Accessibility — focus management, ARIA attributes, keyboard navigation, skip links, color contrast
2. UX Completeness — loading skeletons, empty states, error states, optimistic updates, confirmation dialogs, form validation
3. Performance — unnecessary re-renders, code splitting, image optimization, debounced inputs, bundle size
4. Security — token storage, XSS, input sanitization, CSRF protection
5. Resilience — network retry, timeouts, graceful degradation, error boundaries
6. Code Quality — lint, format, type check, duplication, naming, dead code

Đọc IMP spec: agent_docs/{spec_dir}/implementation/{FR_ID}-impl.md
Đọc tech-design: agent_docs/tech-design/{service}-service.md
Đọc hard-boundaries: agent_docs/hard-boundaries.md
Đọc conventions: agent_docs/conventions.md

CRITICAL: Keep ALL tests GREEN qua mọi thay đổi. Undo bất kỳ change nào break test.
  `
})
```

---

## 7. GATE Full Agent (10 gates)

Spawn sau REFACTOR full.

```javascript
Agent({
  subagent_type: "{agent_prefix}-gate",
  description: "GATE full: {feature}",
  permissionMode: "acceptEdits",
  prompt: `
Mode: full
Feature: {feature}
Service: {service}
FR-ID: {FR_ID}

REFACTOR full đã hoàn thành. Tổng hợp:
- Per-TC results: {per_tc_summary}
- GATE light: PASS (4/4, no interference)
- REFACTOR full findings: {N_fixed} fixed, {M_flagged} flagged
- Files changed: {all_files_changed_updated}

Chạy tất cả 10 gates:

{BE gates:}
- L1: Test Suite (verify tất cả tests pass — KHÔNG chạy INTERFERENCE-FULL)
- L2: Hard Boundaries
- L3: Query Safety
- L4: External Call Resilience
- F5: Integration & Regression
- F6: Lint & Formatting
- F7: Coverage
- F8: Input Validation
- F9: Error Handling
- F10: Framework-Specific Compliance

{FE gates:}
- L1: Unit Tests (verify tất cả tests pass — KHÔNG chạy INTERFERENCE-FULL)
- L2: Token Security
- L3: XSS Prevention
- L4: State Coverage
- F5: Type Check (tsc --noEmit)
- F6: Lint (eslint --max-warnings 0)
- F7: E2E Tests (Playwright)
- F8: Accessibility Audit (axe-core/Lighthouse)
- F9: API Resilience
- F10: Documentation

⚠️ INTERFERENCE-FULL bị skip trong GATE full — test có thể đã rename/reorg sau REFACTOR.
L1 chỉ verify: all tests pass (exit code 0), no skipped critical tests.

Return PASS/FAIL với failures chi tiết.
  `
})
```

### GATE Full Results

| Kết quả | Hành động |
|---|---|
| ALL 10 PASS | Code ready cho review và push |
| FAIL | Fix từng failure → retry GATE full (max 2) |

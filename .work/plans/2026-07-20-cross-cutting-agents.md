# Plan: Cross-Cutting Agents — Implementation

**Context**: Sau LLD phase, 5 file cross-cutting (`error-handling.md`, `caching-strategy.md`, `frontend-architecture.md`, `performance-test.md`, `frontend-test-strategy.md`) không có agent nào chịu trách nhiệm sinh ra. Template đã được copy từ starter-kit vào `templates/supporting/`. Giờ cần tạo agent + tích hợp vào pipeline.

**Dependency graph**:
```
Stage 1 (4∥): error-handling | caching-strategy | performance-test | frontend-architecture
Stage 2 (1):  frontend-test-strategy ← đợi error-handling + frontend-architecture
```

---

## Phase 1: Tạo 5 Subagent Cross-Cutting

**Pattern**: Mỗi agent theo pattern của `codebase-lld-synthesis` (synthesis agent: đọc nhiều input → tổng hợp → 1 file output), kết hợp conventions từ `sdlc-lld` (frontmatter, hooks, hard boundaries).

### 1.1 `sdlc-lld-error-handling` — `error-handling.md`

- **Input**: `architecture.md` §1 (service topology), §6 (cross-cutting concerns), `contracts/api-conventions.md`, `contracts/error-codes.md`, `tech-design/{name}-service.md` §9 (per-service error flows)
- **Output**: `agent_docs/error-handling.md` — chuẩn TOÀN HỆ THỐNG
- **Template**: `templates/supporting/error-handling-TEMPLATE.md`
- **Model**: opus, maxTurn: 15
- **9 sections**: Response format, error taxonomy (9 categories), HTTP mapping, security rules, logging matrix, i18n strategy, frontend contract, test expectations, anti-patterns

### 1.2 `sdlc-lld-caching-strategy` — `caching-strategy.md`

- **Input**: `architecture.md` §1 (services), §6 (cache infrastructure type), `tech-design/{name}-service.md` §7 (per-service cache plan)
- **Output**: `agent_docs/caching-strategy.md`
- **Template**: `templates/supporting/caching-strategy-TEMPLATE.md`
- **Model**: opus, maxTurn: 15
- **8 sections**: Cache architecture (L0-L3), cache patterns, cache inventory per service, invalidation, stampede prevention, Redis config, monitoring, anti-patterns

### 1.3 `sdlc-lld-performance-test` — `performance-test.md`

- **Input**: `architecture.md` §1, `features/FR-*.md` (NFRs from SRS), `tech-design/{name}-service.md` §8 (QPS targets)
- **Output**: `agent_docs/performance-test.md`
- **Template**: `templates/supporting/performance-test-TEMPLATE.md`
- **Model**: opus, maxTurn: 15
- **6 sections**: NFR targets, 5 test types, test environment, pass-fail assertions, bottleneck guide, report template

### 1.4 `sdlc-lld-frontend-architecture` — `frontend-architecture.md`

- **Input**: `architecture.md` §1 (frontend services), `frontend/{app}/api-routing.md`, `hard-boundaries.md`
- **Output**: `agent_docs/frontend-architecture.md`
- **Template**: `templates/supporting/frontend-architecture-TEMPLATE.md`
- **Model**: opus, maxTurn: 15
- **13 sections**: Rendering strategy, Next.js middleware, state management, data fetching, auth & security, error boundary, i18n, image optimization, SEO, web vitals, responsive design, design system, PWA

### 1.5 `sdlc-lld-frontend-test-strategy` — `frontend-test-strategy.md`

- **Input**: `frontend-architecture.md` (required — defines patterns test strategy validates), `error-handling.md` (error UX mappings), `frontend/{app}/api-routing.md`
- **Output**: `agent_docs/frontend-test-strategy.md`
- **Template**: `templates/supporting/frontend-test-strategy-TEMPLATE.md`
- **Model**: opus, maxTurn: 20
- **12 sections**: Test pyramid, project setup, MSW mocking, unit test patterns, integration test patterns, E2E patterns, what to test vs NOT, file conventions, coverage targets, npm scripts, anti-patterns, agent checklist

### Agent Frontmatter Convention (mỗi agent)

```yaml
---
name: sdlc-lld-{name}
description: >-
  {mô tả 1-2 câu về file được sinh}
model: opus
maxTurn: {15|20}
tools: Read, Write, Edit, Bash, Glob
permissionMode: acceptEdits
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./scripts/sdlc-validate-agent-output.sh sdlc-lld-{name}"
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/sdlc-validate-agent-output.sh sdlc-lld-{name}"
---
```

---

## Phase 2: Cập Nhật sdlc-orchestrator

Dùng **skill-composer** để cập nhật, sau đó **skill-refiner** để refine.

### 2.1 `flow-task.md` — Thêm Cross-Cutting Phase

- **Pipeline sequence**: SRS → (optional HLD) → (optional LLD) → **[optional CROSS-CUTTING]** → IMP ∥ TST
- **Scope detection table** (thêm dòng mới):
  | Cross-cutting files thay đổi | Phase cần chạy |
  |---|---|---|
  | Thêm/cập nhật cross-cutting standards | CROSS-CUTTING (sau LLD) |
- **Thêm subsection "4.X: Cross-Cutting Phase"** sau LLD section, áp dụng 8-step pattern:
  1. EnterPlanMode (đề xuất scope: những file nào cần sinh)
  2. Đọc context: architecture.md + SRS NFRs + tech-design/
  3. Spawn Plan agent
  4. Đợi human review
  5. ExitPlanMode
  6. Spawn agents (Stage 1 ∥ 4 agent + barrier + Stage 2)
  7. Verify gate (procedures.md §4.3b)
  8. Report progress
- **Scope detection logic** (tự động từ file thực tế):
  - `error-handling`: luôn nếu có ≥1 backend service trong architecture.md
  - `caching-strategy`: nếu architecture.md §6 khai báo Redis/Caffeine/CacheConfig
  - `performance-test`: nếu SRS có NFR p95/QPS targets
  - `frontend-architecture`: nếu architecture.md có frontend service
  - `frontend-test-strategy`: nếu frontend-architecture được chọn + sdlc-tst frontend được configured
- **Stage 2 trigger**: frontend-test-strategy chỉ chạy nếu cả frontend-architecture + error-handling được chọn ở Stage 1
- Thêm concrete example vào section "Concrete Example"

### 2.2 `procedures.md` — Thêm Gate Criteria + Spawn Templates

- **Section 1.1**: Thêm spawn template cho cross-cutting:
  - Stage 1: Spawn 4 agent song song (error-handling, caching-strategy, performance-test, frontend-architecture)
  - Barrier: đợi error-handling + frontend-architecture done nếu cần frontend-test-strategy
  - Stage 2: Spawn 1 agent (frontend-test-strategy)
- **Section 4**: Thêm `4.3b Cross-Cutting Gate`:
  ```
  ### 4.3b Cross-Cutting Gate
  - [ ] error-handling.md: error taxonomy ≥8 categories, HTTP status mapping, security rules
  - [ ] caching-strategy.md: cache architecture L0-L3, inventory per service (nếu applicable)
  - [ ] performance-test.md: NFR targets quantified, 5 test types (nếu applicable)
  - [ ] frontend-architecture.md: rendering strategy, state management, data fetching (nếu applicable)
  - [ ] frontend-test-strategy.md: test pyramid, MSW patterns, coverage targets (nếu applicable)
  - [ ] Tất cả file YAML frontmatter có depends_on + referenced_by
  - [ ] File được chọn = file được sinh (không thiếu, không thừa)
  ```
- **Section 6.1**: Thêm after-phase report template:
  ```
  ✅ Cross-Cutting hoàn thành
     📄 error-handling.md: [taxonomy count] categories, [N] services covered
     📄 caching-strategy.md: [architecture tier], [N] cache entries (nếu applicable)
     📄 frontend-architecture.md: [rendering strategy] (nếu applicable)
     📄 performance-test.md: [N] test types, [N] endpoints (nếu applicable)
     📄 frontend-test-strategy.md: [test pyramid ratio] (nếu applicable)
     🚦 Gate: PASS ([N]/[M] criteria met)
     ⚠️  Issues: [list hoặc "Không có"]
  ```
- **Section 2.2 README Routing Table**: Thêm cột "CROSS" vào Active Features table
- **Section 2.2 Pipeline Status**: Thêm "Last Cross-Cutting run: YYYY-MM-DD"

### 2.3 `SKILL.md` — Cập nhật Pipeline + Subagents

- Pipeline diagram: `SRS → (optional HLD) → (optional LLD) → [optional CROSS-CUTTING] → IMP ∥ TST`
- Subagents table: thêm 5 agent mới
- Phase description: thêm cross-cutting vào danh sách phase

---

## Phase 3: Cập Nhật sdlc-automation

Dùng **skill-composer** để cập nhật, sau đó **skill-refiner** để refine.

### 3.1 `SKILL.md` — Thêm Cross-Cutting Scope

- **Grilling Round 3** (Architecture & Integration): Thêm câu hỏi về frontend, caching, performance requirements
- **Pipeline scope table**: Thêm dòng mới cho cross-cutting
- **Dispatch args**: Thêm `crossCutting: { errorHandling: true, caching: true|false, ... }` vào workflow args
- **Monitor report template**: Thêm cross-cutting vào báo cáo hoàn thành

### 3.2 `references/grilling-templates.md` — Thêm Cross-Cutting Questions

- Round 3: "Dự án có frontend app không?", "Cần caching (Redis) không?", "Có NFR performance cụ thể (p95, QPS)?"
- Round 4: "Cần test strategy cho frontend không?"

---

## Phase 4: Cập Nhật Task List

- **Task #2** (Tạo subagent) → Tách thành 5 sub-tasks, mỗi sub-task cho 1 agent
- **Task #3** (Cập nhật orchestrator) → Giữ nguyên, cập nhật description
- **Task #4** (Cập nhật automation) → Giữ nguyên, cập nhật description
- Thêm Task #5: Cập nhật sdlc-lld agent (bỏ cross-cutting responsibilities nếu có overlap)

---

## Phase 5: Cập Nhật Plugin Version

- Mỗi agent mới: version `1.0.0` trong frontmatter
- Mỗi skill cập nhật: MINOR bump (thêm cross-cutting phase là new capability)
- Plugin: MINOR bump trong `.claude-plugin/plugin.json` (2.16.0 → 2.17.0)
- CHANGELOG entries trong root `CHANGELOG.md`:
  - `**sdlc-lld-error-handling 1.0.0:** New agent for system-wide error handling standards`
  - `**sdlc-lld-caching-strategy 1.0.0:** New agent for caching strategy`
  - `**sdlc-lld-performance-test 1.0.0:** New agent for performance test plans`
  - `**sdlc-lld-frontend-architecture 1.0.0:** New agent for frontend architecture`
  - `**sdlc-lld-frontend-test-strategy 1.0.0:** New agent for frontend test strategy`
  - `**sdlc-orchestrator X.Y.Z:** Add cross-cutting phase after LLD`
  - `**sdlc-automation X.Y.Z:** Add cross-cutting scope to grilling and pipeline`

---

## Verification

1. **Unit check từng agent**: Mỗi agent tự self-check gate — verify template được áp dụng đúng
2. **Pipeline integration test**: Chạy `flow-task.md` với 1 feature mới, verify cross-cutting agents được spawn đúng
3. **Automation integration test**: Chạy grilling → verify cross-cutting scope được phát hiện tự động
4. **Gate criteria**: Sau cross-cutting phase, tất cả gate criteria trong procedures.md §4.3b pass
5. **File consistency**: Tất cả 5 file output có YAML frontmatter, depends_on/referenced_by bidirectional

---

## Thứ Tự Thực Hiện

```
1. Tạo 5 agent files (.claude/agents/sdlc/sdlc-lld-*.md)
2. Cập nhật task list (tách + mô tả mới)
3. Skill(skill-composer) → cập nhật sdlc-orchestrator
4. Skill(skill-refiner) → refine sdlc-orchestrator
5. Skill(skill-composer) → cập nhật sdlc-automation
6. Skill(skill-refiner) → refine sdlc-automation
7. Bump version + CHANGELOG
```

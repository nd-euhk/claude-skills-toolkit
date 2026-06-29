# HLD Phase — High-Level Design (System Architecture)

Thực thi HLD phase: nhận consolidated context từ skill level → tạo/cập nhật HLD documents qua phase-hld-specialist → verify qua Agent(Explore) (trừ khi --no-gate).

## Architecture

Tuân theo [shared 3-actor pattern](shared-patterns.md#architecture-pattern-3-actor) và [phase procedure template](shared-patterns.md#phase-procedure-template-dùng-cho-mọi-phase-reference-file) với `{X}` = `hld`. Brainstorming + analyze + scout đã hoàn thành ở skill level — phase chỉ nhận và dùng consolidated context.

## Input Detection

Trước khi bắt đầu, verify các inputs này tồn tại:
1. `docs/product/SRS.md`
2. `docs/product/features/*/FR-*.md` (tất cả FR files)
3. `agent_docs/traceability/requirements-matrix.md`

Nếu thiếu bất kỳ required input nào, báo cáo cho calling skill và dừng. KHÔNG tiếp tục nếu không có verified SRS artifacts.

## Procedure

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions: architectural style, service candidates với responsibilities, communication patterns, infrastructure preferences, trade-offs
- Explore findings: existing service modules, API patterns, event infrastructure, ADR format conventions
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

```
Agent(phase-hld-specialist, prompt: "
  Tạo/cập nhật HLD documents với context sau:

  BRAINSTORMING SUMMARY:
  {dán brainstorming conclusions: architectural style, service candidates, communication patterns, trade-offs}

  SCOUT DISCOVERIES:
  {dán Explore findings: existing services, API patterns, event infrastructure}

  DECISIONS MADE:
  {sequential-thinking/problem-solving conclusions nếu có dùng}

  INPUTS:
  - Language: {vi|en}

  Viết tất cả output bằng {language}.

  Tạo: system-architecture.md, ADRs (min 3), agent docs, contracts, diagrams.
  KHÔNG verify — chỉ tạo.
")
```

Specialist xử lý:
- System Architecture document (C4 Level 1 + 2)
- ADR-001, ADR-002, ADR-003 (minimum) + additional ADRs
- Agent documentation (architecture.md, domain-service-mapping.yaml, hard-boundaries.md)
- API và event contracts
- Mermaid diagrams
- Phase 5 backfill (resolve "TBD" references)

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

Tuân theo [Step 3: Verify](shared-patterns.md#step-3-verify-via-agentexplore-trừ-khi---no-gate) với `{PHASE}` = `HLD`, `{X}` = `hld`.

Artifacts cần verify:
- `docs/architecture/system-architecture.md`
- `docs/architecture/ADRs/*`
- `agent_docs/architecture.md`
- `agent_docs/domain-service-mapping.yaml`
- `agent_docs/hard-boundaries.md`
- `agent_docs/contracts/api-conventions.md`
- `agent_docs/contracts/events.md`
- `docs/architecture/diagrams/*`

### Step 4: Report Results

Tuân theo [Step 4: Report](shared-patterns.md#step-4-report-results). Thêm phase-specific:
- Services defined (count và names)
- ADRs written (count và IDs)
- Bounded contexts mapped
- Hard boundaries defined

## Gate Criteria (verified by Agent(Explore) với gate-verifier-hld)

- [ ] System architecture doc covers all C4 Level 1 và Level 2
- [ ] ADR-001, ADR-002, ADR-003 (minimum) written với context/decision/rationale/consequences
- [ ] Mỗi FR có thể mapped to exactly one service via domain-service-mapping.yaml
- [ ] Hard boundaries explicitly list data ownership và forbidden shortcuts
- [ ] Phase 5 backfill complete (không có "TBD" references đến architecture)
- [ ] Không implementation details: không có class names, không có database schemas, không có code snippets

## Anti-Patterns

Tuân theo [shared anti-patterns](shared-patterns.md#shared-anti-patterns). Phase-specific additions:

- **Không design per-service internals** — việc đó belongs to LLD
- **Không write code hoặc pseudocode trong ADRs** — ADRs are architecturally focused
- **Không skip rationale section** — "why" là toàn bộ ý nghĩa của ADR
- **Không create services without clear data ownership** — mỗi service phải own its data
- **Không allow direct database access across service boundaries** — hard boundary violation

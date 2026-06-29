# LLD Phase — Low-Level Design (Service Internals)

Thực thi LLD phase: nhận consolidated context từ skill level → tạo/cập nhật LLD documents qua phase-lld-specialist → verify qua Agent(Explore) (trừ khi --no-gate).

## Architecture

Tuân theo [shared 3-actor pattern](shared-patterns.md#architecture-pattern-3-actor) và [phase procedure template](shared-patterns.md#phase-procedure-template-dùng-cho-mọi-phase-reference-file) với `{X}` = `lld`. Brainstorming + analyze + scout đã hoàn thành ở skill level — phase chỉ nhận và dùng consolidated context.

## Input Detection

Trước khi bắt đầu, verify các inputs này tồn tại:
1. `agent_docs/architecture.md`
2. `agent_docs/domain-service-mapping.yaml`
3. `agent_docs/hard-boundaries.md`
4. `agent_docs/contracts/api-conventions.md`
5. `agent_docs/contracts/events.md`
6. `docs/product/features/*/FR-*.md` (tất cả FR files)
7. `docs/product/SRS.md`

Nếu thiếu bất kỳ required input nào, báo cáo cho calling skill và dừng. LLD depends on complete HLD artifacts.

## Procedure

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions: domain model approaches per service, caching strategy, transaction patterns, error handling philosophy, cross-cutting concerns
- Explore findings: existing domain patterns, REST client configs, migration scripts, caching conventions
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

```
Agent(phase-lld-specialist, prompt: "
  Tạo/cập nhật LLD documents với context sau:

  BRAINSTORMING SUMMARY:
  {dán brainstorming conclusions: domain model approaches, caching strategy, transaction patterns, error handling}

  SCOUT DISCOVERIES:
  {dán Explore findings: existing domain patterns, REST client configs, caching conventions}

  DECISIONS MADE:
  {sequential-thinking/problem-solving conclusions nếu có dùng}

  INPUTS:
  - Language: {vi|en}

  Viết tất cả output bằng {language}.

  Tạo: per-service tech-design (9 sections), cross-cutting.md, API contracts, feature work packages.
  KHÔNG verify — chỉ tạo.
")
```

Specialist xử lý:
- Tech design index (README.md)
- Per-service technical design files (9 sections mỗi file)
- Cross-cutting design (cross-cutting.md)
- API contracts (OpenAPI 3.0)
- Feature work packages với routing overlays

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

Tuân theo [Step 3: Verify](shared-patterns.md#step-3-verify-via-agentexplore-trừ-khi---no-gate) với `{PHASE}` = `LLD`, `{X}` = `lld`.

Artifacts cần verify:
- `agent_docs/tech-design/README.md`
- `agent_docs/tech-design/{name}-service.md` (tất cả services)
- `agent_docs/tech-design/cross-cutting.md`
- `agent_docs/contracts/api-{domain}.yaml` (tất cả APIs)
- `docs/product/features/*/FR-*.md` (tất cả work packages)

### Step 4: Report Results

Tuân theo [Step 4: Report](shared-patterns.md#step-4-report-results). Thêm phase-specific:
- Services designed (count và names)
- Work packages created (count và FR IDs)
- API contracts written
- Cross-cutting concerns documented

## Gate Criteria (verified by Agent(Explore) với gate-verifier-lld)

- [ ] Mỗi service trong domain-service-mapping.yaml có tech-design file với all 9 sections
- [ ] Mỗi FR có work package với routing overlay (service, endpoint, impl path, test path)
- [ ] Tất cả REST clients có circuit breaker config (không có unbounded retries)
- [ ] Mỗi cross-service integration có fallback/degraded mode defined
- [ ] Domain models include invariants và state machines nếu applicable
- [ ] Không new architectural decisions (those belong in HLD ADRs)

## Anti-Patterns

Tuân theo [shared anti-patterns](shared-patterns.md#shared-anti-patterns). Phase-specific additions:

- **Không write actual code** — đây là design, không phải implementation
- **Không create new services** — service list comes from HLD
- **Không change architectural decisions** từ HLD ADRs
- **Không skip circuit breaker config** trên bất kỳ REST client nào
- **Không để error flows là "TBD"** — mỗi integration point cần fallback behavior

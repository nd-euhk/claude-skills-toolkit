# IMP Phase — Implementation Specification

Thực thi IMP phase: nhận consolidated context từ skill level → tạo/cập nhật IMP documents qua phase-imp-specialist → verify qua Agent(Explore) (trừ khi --no-gate).

## Architecture

Tuân theo [shared 3-actor pattern](shared-patterns.md#architecture-pattern-3-actor) và [phase procedure template](shared-patterns.md#phase-procedure-template-dùng-cho-mọi-phase-reference-file) với `{X}` = `imp`. Brainstorming + analyze + scout đã hoàn thành ở skill level — phase chỉ nhận và dùng consolidated context.

## Input Detection

Trước khi bắt đầu, verify các inputs này tồn tại:
1. `agent_docs/features/FR-*.md` — mỗi work package
2. `agent_docs/tech-design/{name}-service.md` — service internals
3. `agent_docs/contracts/api-{domain}.yaml` — API contracts
4. `docs/product/features/*/FR-*.md` — business context
5. `agent_docs/tech-design/cross-cutting.md`

Nếu thiếu bất kỳ required input nào, báo cáo cho calling skill và dừng. IMP specs depend on complete LLD artifacts.

## Procedure

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions: execution flow strategies, error handling patterns, security requirements per feature, cross-feature coordination needs, edge cases
- Explore findings: existing impl specs, error mapping conventions, security patterns (RBAC roles, @PreAuthorize)
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

```
Agent(phase-imp-specialist, prompt: "
  Tạo/cập nhật IMP documents với context sau:

  BRAINSTORMING SUMMARY:
  {dán brainstorming conclusions: execution flow strategies, error handling patterns, security requirements}

  SCOUT DISCOVERIES:
  {dán Explore findings: existing impl specs, error mapping conventions, security patterns}

  DECISIONS MADE:
  {sequential-thinking/problem-solving conclusions nếu có dùng}

  INPUTS:
  - Language: {vi|en}

  Viết tất cả output bằng {language}.

  Tạo: backend + frontend implementation specs (10 sections mỗi FR).
  KHÔNG verify — chỉ tạo.
")
```

Specialist xử lý:
- Backend implementation specs (10 sections per FR)
- Frontend implementation specs (10 sections per FR)
- Determining BE vs FE based on work package routing overlays

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

Tuân theo [Step 3: Verify](shared-patterns.md#step-3-verify-via-agentexplore-trừ-khi---no-gate) với `{PHASE}` = `IMP`, `{X}` = `imp`.

Artifacts cần verify:
- `agent_docs/backend/{service}/implementation/FR-*-impl.md` (tất cả backend impl specs)
- `agent_docs/frontend/{app}/implementation/FR-*-impl.md` (tất cả frontend impl specs)

### Step 4: Report Results

Tuân theo [Step 4: Report](shared-patterns.md#step-4-report-results). Thêm phase-specific:
- Implementation specs created (count: BE + FE)
- FR coverage (tất cả FRs có specs?)
- Error mappings per spec
- Security considerations documented

## Gate Criteria (verified by Agent(Explore) với gate-verifier-imp)

- [ ] Mỗi FR có implementation spec (backend, frontend, hoặc both)
- [ ] Mỗi spec có all 10 sections filled (không có "TBD")
- [ ] Execution flow specific (names layers/modules, không vague)
- [ ] Error mapping covers ít nhất: validation error, not-found, unauthorized, internal error
- [ ] Business rules dùng WHEN/THEN format và trace to Gherkin scenarios

## Anti-Patterns

Tuân theo [shared anti-patterns](shared-patterns.md#shared-anti-patterns). Phase-specific additions:

- **Không write code snippets** — describe what code must do, not how to write it
- **Không skip error mapping** — đây là thứ implementers cần nhất
- **Không để security & authorization blank** — mỗi spec cần concrete security requirements
- **Không describe execution flow vaguely** ("handle the request" — name the handler)
- **Không combine nhiều FRs vào một impl spec** — một FR = một spec file

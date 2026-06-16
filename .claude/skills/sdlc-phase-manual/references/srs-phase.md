# SRS Phase — Software Requirements Specification

Thực thi SRS phase: nhận consolidated context từ skill level → tạo/cập nhật SRS documents qua phase-srs-specialist → verify qua Agent(Explore) (trừ khi --no-gate).

## Architecture

Tuân theo [shared 3-actor pattern](shared-patterns.md#architecture-pattern-3-actor) và [phase procedure template](shared-patterns.md#phase-procedure-template-dùng-cho-mọi-phase-reference-file) với `{X}` = `srs`. Brainstorming + analyze + scout đã hoàn thành ở skill level — phase chỉ nhận và dùng consolidated context.

## Input Detection

Trước khi bắt đầu, verify các inputs này tồn tại. Nếu missing, báo cáo cho calling skill và dừng.

**Required:**
1. PRD file path — Product Requirements Document
2. URD file path — User Requirements Document

**Optional:**
3. UX/UI spec path — nếu có, ghi nhận UX constraints

Nếu calling skill không cung cấp paths, dùng context từ skill level để infer từ project structure (vd: `docs/product/PRD.md`, `docs/user/URD.md`), verify với `Read`. Nếu vẫn không tìm thấy, báo cáo và dừng.

## Procedure

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions: feature areas để decomposition, NFR categories với initial thresholds, key domain terminology, assumptions đã validated, open questions đã resolved
- Explore findings: existing FR documents, doc patterns, conventions, domain terminology
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

```
Agent(phase-srs-specialist, prompt: "
  Tạo/cập nhật SRS documents với context sau:

  BRAINSTORMING SUMMARY:
  {dán brainstorming conclusions: feature areas, NFR categories, terminology, assumptions}

  SCOUT DISCOVERIES:
  {dán Explore findings: existing FRs, doc patterns, conventions}

  DECISIONS MADE:
  {sequential-thinking/problem-solving conclusions nếu có dùng}

  INPUTS:
  - PRD: {prd-path}
  - URD: {urd-path}
  - UX Spec: {ux-path hoặc 'none'}
  - Language: {vi|en}

  Viết tất cả output bằng {language}.

  Tạo: FR files, SRS.md, requirements-matrix.md. KHÔNG verify — chỉ tạo.
")
```

Specialist xử lý:
- FR discovery và decomposition (một FR mỗi file)
- Gherkin Scenario Outlines với Examples tables
- SRS.md consolidation
- Requirements traceability matrix

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

Tuân theo [Step 3: Verify](shared-patterns.md#step-3-verify-via-agentexplore-trừ-khi---no-gate) với `{PHASE}` = `SRS`, `{X}` = `srs`.

Artifacts cần verify:
- `docs/product/SRS.md`
- `docs/product/features/*/FR-*.md`
- `agent_docs/traceability/requirements-matrix.md`

### Step 4: Report Results

Tuân theo [Step 4: Report](shared-patterns.md#step-4-report-results). Thêm phase-specific:
- FRs đã tạo (count và IDs)
- Gherkin scenarios mỗi FR
- NFRs defined với quantified thresholds
- Traceability matrix status

## Gate Criteria (verified by Agent(Explore) với gate-verifier-srs)

- [ ] Mỗi FR có >=1 Gherkin Scenario Outline với Examples
- [ ] Tất cả NFRs có quantified, measurable thresholds (numbers, không phải adjectives)
- [ ] Traceability matrix đầy đủ (FR → BRD → PRD → Gherkin → NFR)
- [ ] Không architecture decisions leaked: không có "service", "API path", "database schema", "microservice", "REST endpoint" trong SRS.md
- [ ] Không implementation details: không có language/framework names (trừ khi explicit business constraints từ URD)

## Anti-Patterns

Tuân theo [shared anti-patterns](shared-patterns.md#shared-anti-patterns). Phase-specific additions:

- **FR quá coarse:** "Authentication" → tách thành "User Login", "User Registration", "Password Reset"
- **Vague NFRs:** "fast" → "P95 < 200ms". Luôn quantified.
- **Architecture leak:** Không để "service", "API path", "database schema" xuất hiện trong SRS artifacts

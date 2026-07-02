---
title: "ALLOWED Inputs Cross-Reference: Subagent vs SLDC Source of Truth"
version: "2.0"
created: 2026-06-01
---

# Subagent ALLOWED Inputs — So khớp với SLDC Phase Inputs

Source of truth: `../ai-agentic-starter-kit/_framework/sdlc/phase-*.md`
Subagents: `.claude/agents/*.md`

---

## 1. srs-specifier (Phase 5)

| # | SLDC Phase 5 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `docs/product/PRD.md` | `docs/product/PRD.md` | ✅ |
| 2 | `docs/product/URD.md` | `docs/user/URD.md` | ⚠️ Path khác (`product/` vs `user/`) |
| 3 | `docs/ux/interactions/*.md` | `docs/ux/interactions/*.md` | ✅ |
| 4 | `docs/product/features/epic-*/FR-*.md` | `docs/product/features/epic-*/FR-*.md` | ✅ |
| 5 | _(không có)_ | `docs/business/BRD.md` | ⚠️ EXTRA |
| 6 | _(không có)_ | `docs/business/business-rules/*.md` | ⚠️ EXTRA |

**Lỗi:**
- `docs/product/URD.md` → subagent ghi `docs/user/URD.md` (sai path)
- Thêm BRD + business-rules không có trong SLDC input list

---

## 2. hld-architect (Phase 6)

| # | SLDC Phase 6 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `docs/product/SRS.md` | `docs/product/SRS.md` | ✅ |
| 2 | `docs/product/SRS-BACKEND.md` | `docs/product/SRS-BACKEND.md` | ✅ |
| 3 | `docs/product/SRS-FRONTEND.md` | `docs/product/SRS-FRONTEND.md` | ✅ |
| 4 | `docs/product/features/epic-*/FR-*.md` | `docs/product/features/epic-*/FR-*.md` | ✅ |
| 5 | `agent_docs/traceability/requirements-matrix.md` | `agent_docs/traceability/requirements-matrix.md` | ✅ |
| 6 | _(không có)_ | `docs/business/BRD.md` | ⚠️ EXTRA |
| 7 | _(không có)_ | `docs/business/business-rules/*.md` | ⚠️ EXTRA |

**Lỗi:** Thêm BRD + business-rules không có trong SLDC input list

---

## 3. lld-designer (Phase 7)

| # | SLDC Phase 7 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `docs/product/SRS.md` | `docs/product/SRS.md` | ✅ |
| 2 | `docs/product/features/epic-*/FR-*.md` | `docs/product/features/epic-*/FR-*.md` | ✅ |
| 3 | `agent_docs/architecture.md` | `agent_docs/architecture.md` | ✅ |
| 4 | `agent_docs/adrs/ADR-001-service-decomposition.md` | `docs/architecture/ADRs/ADR-001-*.md` | ❌ SLDC sai path `agent_docs/adrs/` |
| 5 | `agent_docs/adrs/ADR-002-api-convention.md` | `docs/architecture/ADRs/ADR-002-*.md` | ❌ SLDC sai path + sai tên |
| 6 | `agent_docs/adrs/ADR-003-event-taxonomy.md` | `docs/architecture/ADRs/ADR-003-*.md` | ❌ SLDC sai path |
| 7 | `agent_docs/domain-service-mapping.yaml` | `agent_docs/domain-service-mapping.yaml` | ✅ |
| 8 | _(không có)_ | `agent_docs/contracts/api-conventions.md` | ⚠️ EXTRA |
| 9 | _(không có)_ | `agent_docs/contracts/events.md` | ⚠️ EXTRA |
| 10 | _(không có)_ | `agent_docs/hard-boundaries.md` | ⚠️ EXTRA |

**Lỗi trong SLDC:** Phase 7 input ghi `agent_docs/adrs/` nhưng Phase 6 output ADRs ra `docs/architecture/ADRs/`. Artifact Authority Matrix xác nhận `docs/architecture/ADRs/` là SSOT. Subagent đọc đúng path.

**Lỗi trong subagent:** Thêm 3 path không có trong SLDC input list (dù là Phase 6 outputs hợp lệ)

---

## 4. imp-specifier (Phase 8)

| # | SLDC Phase 8 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | ✅ |
| 2 | `agent_docs/tech-design/{service}-service.md` | `agent_docs/tech-design/{service}-service.md` | ✅ |
| 3 | `agent_docs/contracts/api-*.yaml` | `agent_docs/contracts/api-*.yaml` | ✅ |
| 4 | `agent_docs/contracts/events.md` | `agent_docs/contracts/events.md` | ✅ |
| 5 | `agent_docs/architecture.md` | `agent_docs/architecture.md` | ✅ |
| 6 | `agent_docs/hard-boundaries.md` | `agent_docs/hard-boundaries.md` | ✅ |
| 7 | _(không có)_ | `agent_docs/backend/conventions.md` | ❌ CIRCULAR — Phase 8 tự output file này! |
| 8 | _(không có)_ | `agent_docs/frontend/conventions.md` | ❌ CIRCULAR — Phase 8 tự output file này! |

**Lỗi:** `conventions.md` là OUTPUT của Phase 8, không thể là INPUT. Circular dependency.

---

## 5. tst-specifier (Phase 9)

| # | SLDC Phase 9 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | ✅ |
| 2 | `agent_docs/backend/{service}/implementation/FR-*-impl.md` | _(FORBIDDEN)_ | ❌ THIẾU (cố ý — context isolation) |
| 3 | `agent_docs/frontend/{app}/implementation/FR-*-impl.md` | _(FORBIDDEN)_ | ❌ THIẾU (cố ý — context isolation) |
| 4 | `docs/product/SRS.md` | `docs/product/SRS.md` | ✅ |
| 5 | _(không có)_ | `agent_docs/contracts/api-*.yaml` | ⚠️ EXTRA |
| 6 | _(không có)_ | `agent_docs/contracts/events.md` | ⚠️ EXTRA |
| 7 | _(không có)_ | `agent_docs/contracts/error-codes.md` | ⚠️ EXTRA |
| 8 | _(không có)_ | `docs/product/features/epic-*/FR-*.md` | ⚠️ EXTRA |
| 9 | _(không có)_ | `agent_docs/hard-boundaries.md` | ⚠️ EXTRA |

**Khác biệt chính:** SLDC muốn tst-specifier đọc impl-specs, nhưng subagent tự cấm (context isolation — test spec phải độc lập với implementation). Subagent đọc thêm contracts, events, error-codes, source FRs, hard-boundaries để bù.

---

## 6. agt-configurator (Phase 10)

| # | SLDC Phase 10 Input | Subagent ALLOWED | Match |
|---|---|---|---|
| 1 | `agent_docs/features/FR-*.md` | `agent_docs/features/FR-*.md` | ✅ |
| 2 | `agent_docs/backend/**/implementation/*.md` | `agent_docs/backend/**/implementation/*.md` | ✅ |
| 3 | `agent_docs/backend/**/test-specs/*.md` | `agent_docs/backend/**/test-specs/*.md` | ✅ |
| 4 | `agent_docs/frontend/**/implementation/*.md` | `agent_docs/frontend/**/implementation/*.md` | ✅ |
| 5 | `agent_docs/frontend/**/test-specs/*.md` | `agent_docs/frontend/**/test-specs/*.md` | ✅ |
| 6 | `agent_docs/architecture.md` | `agent_docs/architecture.md` | ✅ |
| 7 | `agent_docs/hard-boundaries.md` | `agent_docs/hard-boundaries.md` | ✅ |
| 8 | `agent_docs/conventions.md` | `agent_docs/conventions.md` | ✅ |
| 9 | _(không có)_ | `agent_docs/tech-design/**/*.md` | ⚠️ EXTRA |
| 10 | _(không có)_ | `agent_docs/contracts/**/*.yaml` | ⚠️ EXTRA |

**Lỗi nhỏ:** Thêm tech-design và contracts không có trong SLDC input list (dù hợp lý)

---

## 7. REVERSE-ENGINEERING ALLOWED — `agent_docs/projects/{project}/` KHÔNG TỒN TẠI

**5/6 subagents** có reverse-engineering mode tham chiếu `agent_docs/projects/{project}/`:

| Subagent | Path tham chiếu | Tồn tại trong starter kit? |
|---|---|---|
| srs-specifier | `agent_docs/projects/{project}/architecture.md` | ❌ KHÔNG |
| srs-specifier | `agent_docs/projects/{project}/tech-design/*.md` | ❌ KHÔNG |
| srs-specifier | `agent_docs/projects/{project}/contracts/` | ❌ KHÔNG |
| hld-architect | `agent_docs/projects/{project}/**` | ❌ KHÔNG |
| lld-designer | `agent_docs/projects/{project}/architecture.md` | ❌ KHÔNG |
| imp-specifier | `agent_docs/projects/{project}/architecture.md` | ❌ KHÔNG |
| imp-specifier | `agent_docs/projects/{project}/tech-design/{svc}.md` | ❌ KHÔNG |
| imp-specifier | `agent_docs/projects/{project}/contracts/` | ❌ KHÔNG |
| tst-specifier | `agent_docs/projects/{project}/contracts/` | ❌ KHÔNG |

Starter kit chỉ có `projects/` ở root (không phải `agent_docs/projects/`).
Starter kit `agent_docs/` không có thư mục `projects/` nào.

Ngoài ra, `.work/reports/project_registry.yaml` cũng không tồn tại (dùng bởi 5/6 subagents).

---

## Tổng kết lỗi cần sửa

### Lỗi CRITICAL:
1. **`agent_docs/projects/{project}/`** — 5 subagents tham chiếu path này trong reverse-engineering mode, nhưng không tồn tại trong starter kit. Cần xác định path đúng hoặc loại bỏ.
2. **`.work/reports/project_registry.yaml`** — 5 subagents đọc file này nhưng không tồn tại.
3. **`docs/user/URD.md` vs `docs/product/URD.md`** — srs-specifier sai path (SLDC ghi `docs/product/URD.md`)

### Lỗi MEDIUM:
4. **imp-specifier**: Circular dependency — đọc `conventions.md` là output của chính Phase 8
5. **tst-specifier**: Thiếu impl-specs trong ALLOWED (cố ý context isolation nhưng lệch với SLDC)
6. **srs-specifier + hld-architect**: Thêm BRD + business-rules không có trong SLDC input

### Lỗi trong SLDC (không phải subagent):
7. **Phase 7 input**: `agent_docs/adrs/` → phải là `docs/architecture/ADRs/`
8. **Phase 7 input**: `ADR-002-api-convention.md` → phải là `ADR-002-api-gateway-and-versioning.md`

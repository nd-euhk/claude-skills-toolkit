---
title: "SLDC vs Subagent Output Cross-Reference"
version: "1.0"
created: 2026-06-01
---

# SLDC Output vs Subagent Output — Cross-Reference

Source of truth: `../ai-agentic-starter-kit/_framework/sdlc/phase-*.md`
Subagents: `.claude/agents/*.md`

---

## Phase 5 (SRS) — srs-specifier

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `docs/product/SRS.md` | `docs/product/SRS.md` | ✅ |
| 2 | `docs/product/SRS-BACKEND.md` | `docs/product/SRS-BACKEND.md` | ✅ |
| 3 | `docs/product/SRS-FRONTEND.md` | `docs/product/SRS-FRONTEND.md` | ✅ |
| 4 | `docs/product/features/epic-*/FR-*.md` | `docs/product/features/epic-{slug}/FR-{DOMAIN}-{NNN}--{slug}.md` | ✅ |
| 5 | `agent_docs/traceability/requirements-matrix.md` | `agent_docs/traceability/requirements-matrix.md` | ✅ |

**Verdict: ✅ 5/5 khớp**

---

## Phase 6 (HLD) — hld-architect

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `docs/architecture/system-architecture.md` | `docs/architecture/system-architecture.md` | ✅ |
| 2 | `docs/architecture/ADRs/ADR-001-service-decomposition.md` | `docs/architecture/ADRs/ADR-001-service-decomposition.md` | ✅ |
| 3 | `docs/architecture/ADRs/ADR-002-api-gateway-and-versioning.md` | `docs/architecture/ADRs/ADR-002-api-gateway-and-versioning.md` | ✅ |
| 4 | `docs/architecture/ADRs/ADR-003-event-taxonomy.md` | `docs/architecture/ADRs/ADR-003-event-taxonomy.md` | ✅ |
| 5 | `docs/architecture/ADRs/ADR-{NNN}-{decision}.md` | `docs/architecture/ADRs/ADR-{NNN}-{decision}.md` | ✅ |
| 6 | `docs/architecture/diagrams/{name}.mermaid` | `docs/architecture/diagrams/{name}.mermaid` | ✅ |
| 7 | `agent_docs/architecture.md` | `agent_docs/architecture.md` | ✅ |
| 8 | `agent_docs/domain-service-mapping.yaml` | `agent_docs/domain-service-mapping.yaml` | ✅ |
| 9 | `agent_docs/hard-boundaries.md` | `agent_docs/hard-boundaries.md` | ✅ |
| 10 | `agent_docs/contracts/events.md` | `agent_docs/contracts/events.md` | ✅ |
| 11 | `agent_docs/contracts/api-conventions.md` | `agent_docs/contracts/api-conventions.md` | ✅ |

**Verdict: ✅ 11/11 khớp**

---

## Phase 7 (LLD) — lld-designer

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `agent_docs/tech-design/{name}-service.md` | `agent_docs/tech-design/{service-name}.md` | ✅ |
| 2 | `agent_docs/tech-design/cross-cutting.md` | `agent_docs/tech-design/cross-cutting.md` | ✅ |
| 3 | _none_ | `agent_docs/tech-design/README.md` | ⚠️ EXTRA |
| 4 | `agent_docs/contracts/api-{domain}.yaml` | `agent_docs/contracts/api-{domain}.yaml` | ✅ |
| 5 | `agent_docs/contracts/error-codes.md` | `agent_docs/contracts/error-codes.md` | ✅ |
| 6 | _none_ | `agent_docs/contracts/api-internal-{domain}.yaml` | ⚠️ EXTRA |
| 7 | `agent_docs/features/FR-*.md` | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | ✅ |

**Verdict: ✅ 5/5 khớp, +2 extra (README.md có trong tree diagram của SLDC; api-internal được tham chiếu trong work package template)**

Chú ý: SLDC Phase 7 input section (line 14-16) tham chiếu `agent_docs/adrs/` — sai path. Subagent đọc đúng từ `docs/architecture/ADRs/`. Artifact Authority Matrix xác nhận `docs/architecture/ADRs/*.md` là SSOT.

---

## Phase 8 (IMP) — imp-specifier

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `agent_docs/backend/conventions.md` | `agent_docs/backend/conventions.md` | ✅ |
| 2 | `agent_docs/backend/{service-name}/README.md` | `agent_docs/backend/{service-name}/README.md` | ✅ |
| 3 | `agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | `agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | ✅ |
| 4 | `agent_docs/frontend/conventions.md` | `agent_docs/frontend/conventions.md` | ✅ |
| 5 | `agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | `agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | ✅ |
| 6 | `migration-spec (per feature thay đổi DB)` | `agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-migration.md` | ✅ |

**Verdict: ✅ 6/6 khớp**

---

## Phase 9 (TST) — tst-specifier

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | `agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | ✅ |
| 2 | `agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | `agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | ✅ |
| 3 | `agent_docs/performance/README.md` | `agent_docs/performance/README.md` | ✅ |
| 4 | `agent_docs/performance/nfr-mapping.md` | `agent_docs/performance/nfr-mapping.md` | ✅ |
| 5 | `agent_docs/performance/baseline.md` | `agent_docs/performance/baseline.md` | ✅ |

**Verdict: ✅ 5/5 khớp**

---

## Phase 10 (AGT) — agt-configurator

| # | SLDC Output | Subagent Output | Match |
|---|---|---|---|
| 1 | `AGENTS.md` | `AGENTS.md` | ✅ |
| 2 | `agent_docs/README.md` | `agent_docs/README.md` | ✅ |
| 3 | `agent_docs/roadmap.md` | `agent_docs/roadmap.md` | ✅ |
| 4 | `.work/board.md` | `.work/board.md` | ✅ |
| 5 | `.work/backlog.md` | `.work/backlog.md` | ✅ |
| 6 | `scripts/check-docs-sync.sh` | `scripts/check-docs-sync.sh` | ✅ |
| 7 | `scripts/check-traceability.sh` | `scripts/check-traceability.sh` | ✅ |
| 8 | `scripts/check-docs-drift.sh` | `scripts/check-docs-drift.sh` | ✅ |
| 9 | `Tool-specific config` | `.claude/skills/` + `.claude/settings.json` | ✅ |

**Verdict: ✅ 9/9 khớp**

---

## Phase 14 (REL) — release-coordinator

| SLDC Output | Subagent Output |
|---|---|
| Production deployment | `.work/reports/version-map-{date}.md` |
| Post-deploy smoke tests | `.work/reports/release-prep-{version}.md` |
| Release notes published | bump versions in SKILL.md, agents/*.md, plugin.json |
| roadmap.md updated | update CHANGELOG.md |

**Verdict: ❌ KHÁC DOMAIN — release-coordinator lo plugin versioning, không phải production release**

---

## Tổng kết

| Subagent | Phase | Khớp |
|---|---|---|
| srs-specifier | 05 | ✅ 5/5 |
| hld-architect | 06 | ✅ 11/11 |
| lld-designer | 07 | ✅ 5/5 (+2 extra) |
| imp-specifier | 08 | ✅ 6/6 |
| tst-specifier | 09 | ✅ 5/5 |
| agt-configurator | 10 | ✅ 9/9 |
| release-coordinator | 14 | ❌ Khác domain |

**Tất cả output của 6 subagent SDLC đều khớp chính xác với SLDC source of truth.**

## Bug trong SLDC (không phải subagent)

1. **Phase 7 input path sai**: `agent_docs/adrs/` không tồn tại. Phase 6 output + Artifact Authority Matrix đều xác nhận ADRs ở `docs/architecture/ADRs/`. Subagent `lld-designer` đọc đúng path (line 30-32).
2. **Phase 7 tên file sai**: Gọi `ADR-002-api-convention.md` nhưng Phase 6 output `ADR-002-api-gateway-and-versioning.md`.

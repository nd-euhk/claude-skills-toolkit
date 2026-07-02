---
date: 2026-07-02
status: pending
---

# Todo List — 2026-07-03

## Skill: human-docs

Skill mới giúp sync từ `agent_docs/` (agent-facing) → `docs/` (human-facing).
Agent là SSOT (Single Source of Truth), human-docs đọc agent outputs và tổng hợp
thành tài liệu cho người đọc.

### Kiến trúc sync

```
agent_docs/                          docs/
────────────────────────────         ──────────────────────────
features/FR-*.md              →      product/SRS.md
                                      product/SRS-BACKEND.md
                                      product/SRS-FRONTEND.md
features/FR-*.md (Gherkin)    →      product/features/epic-{slug}/FR-*.md (enrich)
architecture.md (C4)          →      architecture/system-architecture.md
adrs/ADR-*.md                 →      architecture/ADRs/ADR-*.md
operations/{monitoring,incident,sla} → operations/ (runbooks etc.)
```

### Tasks

#### 1. Tạo skill `human-docs`

- [ ] Tạo `skills/human-docs/SKILL.md` với frontmatter + procedure
  - `name: human-docs`
  - `description`: Sync agent_docs/ → docs/ cho human-readable output
  - `disable-model-invocation: true` (human-only invoke)
- [ ] Các lệnh chính:
  - `/human-docs sync:srs` — FR-*.md + traceability → SRS.md, SRS-BACKEND.md, SRS-FRONTEND.md
  - `/human-docs sync:architecture` — architecture.md + adrs/ → system-architecture.md + ADRs/
  - `/human-docs sync:operations` — operations/ → docs/operations/
  - `/human-docs sync:all` — chạy tất cả
  - `/human-docs review` — đánh giá consistency giữa docs/ và agent_docs/
  - `/human-docs update` — cập nhật docs/ sau khi agent_docs/ thay đổi

#### 2. Sync SRS (Cao nhất)

- [ ] Đọc `agent_docs/features/FR-*.md` + `agent_docs/traceability/requirements-matrix.md`
- [ ] Tổng hợp → `docs/product/SRS.md` (tổng quan toàn bộ FR + NFR)
- [ ] Tách BE/FE → `docs/product/SRS-BACKEND.md` + `docs/product/SRS-FRONTEND.md`
- [ ] Enrich `docs/product/features/epic-{slug}/FR-*.md` từ agent FR specs

#### 3. Sync Architecture

- [ ] Đọc `agent_docs/architecture.md` (C4 diagrams trong Mermaid)
- [ ] Tạo `docs/architecture/system-architecture.md` (bản human-readable)
- [ ] Đánh giá overlap C4 giữa agent_docs và docs/:
  - Nếu trùng hoàn toàn → `docs/architecture/system-architecture.md` thành index trỏ agent_docs
  - Nếu cần bản dài hơn cho người → viết thêm context, rationale, trade-off analysis
- [ ] Copy/sync `agent_docs/adrs/ADR-*.md` → `docs/architecture/ADRs/ADR-*.md`
  - Đổi tên `ADR-001--service-decomposition.md` → `ADR-001-service-decomposition.md` (single-dash cho human docs)

#### 4. Sync Operations

- [ ] Đọc `agent_docs/operations/` → `docs/operations/`
- [ ] `agent_docs/operations/monitoring-spec.md` → `docs/operations/`
- [ ] `agent_docs/operations/incident-response.md` → `docs/operations/`
- [ ] `agent_docs/operations/sla-targets.md` → `docs/operations/`
- [ ] `agent_docs/operations/runbooks/{service}-runbook.md` → `docs/operations/`

#### 5. Cross-reference & Index files

- [ ] `docs/architecture/ADRs/index.md` — nếu ADRs ở agent_docs, index trỏ sang
- [ ] `docs/operations/index.md` — tương tự
- [ ] `docs/product/SRS.md` thêm link tới `../../agent_docs/features/` cho chi tiết từng FR

#### 6. Review & Validate

- [ ] So sánh consistency giữa docs/ và agent_docs/
- [ ] Phát hiện stale content: docs/ có nhưng agent_docs/ không có → flag
- [ ] Phát hiện missing sync: agent_docs/ có nhưng docs/ chưa có → flag
- [ ] Báo cáo delta cho human quyết định

### Notes từ hôm nay (2026-07-02)

- `adrs/` đã sửa từ `adr/` trong sdlc-hld agent
- ADR naming đã chuẩn hóa double-dash `--` (`ADR-001--service-decomposition.md`)
- 12 file thiếu đã note vào `.work/backlog.md` (INFRA-001 đến INFRA-006)
- `docs/` cho human đọc, `agent_docs/` cho agent dùng — không xóa bên nào, dùng index + cross-ref
- Human có thể thay đổi kiến trúc qua `docs/architecture/` → human-docs detect change → trigger cập nhật ngược vào agent_docs/ (hoặc CR flow)

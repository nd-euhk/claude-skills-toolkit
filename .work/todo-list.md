---
date: 2026-07-03
status: in-progress
---

# Todo List — 2026-07-03

## Skill: human-docs

Skill mới giúp sync từ `agent_docs/` (agent-facing) → `docs/` (human-facing).
Agent là SSOT (Single Source of Truth), human-docs đọc agent outputs và tổng hợp
thành tài liệu cho người đọc.

### Kiến trúc sync (đã tinh gọn 2026-07-03)

```
agent_docs/                          docs/
────────────────────────────         ──────────────────────────
features/FR-*.md              →      product/SRS.md
                                     product/SRS-BACKEND.md
                                     product/SRS-FRONTEND.md
                                     product/features/README.md (index only)

architecture.md               →      architecture/system-architecture.md
                                     architecture/diagrams/*.mermaid

adrs/ADR-*.md                 →      architecture/ADRs/README.md (index only)
```

**Không sync (human-only, bỏ qua):** intake, business, user, ux, releases, operations, codebase.
**FR files riêng lẻ:** không copy sang docs/, chỉ index README trỏ về agent_docs/.

### Tasks

#### 1. Tạo skill `human-docs`

- [x] Tạo `skills/human-docs/SKILL.md` với frontmatter + procedure
  - `name: human-docs`
  - `description`: Sync agent_docs/ → docs/ cho human-readable output
  - `disable-model-invocation: true` (human-only invoke)
- [x] Các lệnh chính:
  - `/human-docs sync:product` — FR-*.md → SRS.md, SRS-BACKEND.md, SRS-FRONTEND.md, README.md
  - `/human-docs sync:architecture` — architecture.md + adrs/ → system-architecture.md + diagrams/ + ADRs/
  - `/human-docs sync:all` — chạy cả 2
  - `/human-docs review` — đánh giá consistency giữa docs/ và agent_docs/
  - `/human-docs update` — incremental sync, chỉ file thay đổi

#### 2. Sync Product

- [ ] Đọc `agent_docs/features/FR-*.md`
- [ ] Tổng hợp → `docs/product/SRS.md` (tổng quan toàn bộ FR + NFR)
- [ ] Tách BE/FE → `docs/product/SRS-BACKEND.md` + `docs/product/SRS-FRONTEND.md`
- [ ] Tạo `docs/product/features/README.md` (index trỏ về agent_docs, không copy FR)

#### 3. Sync Architecture

- [ ] Đọc `agent_docs/architecture.md` (C4 diagrams trong Mermaid)
- [ ] Extract diagrams → `docs/architecture/diagrams/*.mermaid`
- [ ] Tạo `docs/architecture/system-architecture.md` (narrative + diagrams)
- [ ] Tạo `docs/architecture/ADRs/README.md` (index trỏ về agent_docs/adrs/, không copy)

#### 4. Review & Validate

- [ ] So sánh consistency giữa docs/ và agent_docs/
- [ ] Phát hiện stale: agent source thay đổi nhưng docs chưa cập nhật
- [ ] Phát hiện missing: agent source có nhưng docs chưa có
- [ ] Phát hiện orphan: docs có nhưng không có agent source

### Notes từ 2026-07-03

- Scope tinh gọn: bỏ operations, bỏ FR files riêng lẻ, bỏ ADR files riêng lẻ, bỏ phase 0-4 (human-only)
- Human phases (intake, business, user, ux) do PO/BA/AM/UX phụ trách, dev không care
- FR chỉ index README, không copy — chi tiết luôn ở agent_docs/
- ADR chỉ index README, không copy — chi tiết luôn ở agent_docs/adrs/

### Notes từ 2026-07-02

- `adrs/` đã sửa từ `adr/` trong sdlc-hld agent
- ADR naming đã chuẩn hóa double-dash `--` (`ADR-001--service-decomposition.md`)
- 12 file thiếu đã note vào `.work/backlog.md` (INFRA-001 đến INFRA-006)

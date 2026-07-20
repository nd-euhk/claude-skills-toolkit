# Cross-Cutting Template Gap — Analysis & Action Plan

**Date**: 2026-07-20
**Context**: Tiếp nối report `2026-07-20-sprint-artifacts-deep-evaluation.md`. Phân tích khoảng trống template cho các file cross-cutting trong `agent_docs/`.

---

## I. Phát Hiện Chính

### 1. Không thiếu template được agent tham chiếu trực tiếp

Tất cả 21 template path mà SDLC agent/skill trỏ tới đều tồn tại trên đĩa. Không có template "mất tích" kiểu agent gọi mà file không có.

### 2. Nhưng thiếu template cho file agent phải tự tạo

`agent-routing-TEMPLATE.md` định nghĩa 17 priority files mà agent trong dự án output cần đọc. Trong đó 7 file cross-cutting **không có template** để agent SDLC dùng khi tạo ra chúng:

| Priority | File | Cross-reference từ template khác |
|----------|------|----------------------------------|
| #9 | `error-handling.md` | `architecture-TEMPLATE.md`, `error-codes-TEMPLATE.md` (depends_on) |
| #10 | `caching-strategy.md` | `architecture-TEMPLATE.md`, `lld-TEMPLATE.md` |
| #13 | `frontend-architecture.md` | `impl-spec-frontend-TEMPLATE.md`, `AGENTS-TEMPLATE.md` |
| #14 | `scale-strategy.md` | `lld-TEMPLATE.md`, `SRS-TEMPLATE.md` ("Phase 6 sẽ sinh") |
| #15 | `performance-test.md` | `test-spec-backend-TEMPLATE.md`, `lld-TEMPLATE.md`, `SRS-TEMPLATE.md` |
| #16 | `frontend-test-strategy.md` | `agent-routing-TEMPLATE.md` only |
| #17 | `db-operations.md` | `agent-routing-TEMPLATE.md` only |

### 3. Không agent nào chịu trách nhiệm tạo các file này

`sdlc-lld` hiện tạo 7 outputs nhưng không có output nào là 7 file trên:
- Step 1: `tech-design/{name}-service.md` (per-service, 9 sections)
- Step 2: `tech-design/cross-cutting.md` (shared concerns)
- Step 3: `contracts/api-{domain}.yaml` + `contracts/error-codes.md`
- Step 4: Enrich `FR-*.md`
- Step 5: `features/README.md`
- Step 6: `frontend/{app}/api-routing.md`

Đây là **orphan responsibility** — SRS-TEMPLATE hứa "Phase 6 sẽ sinh" nhưng sdlc-lld không làm.

### 4. Starter-kit có đầy đủ template

`/home/khuend/projects/AI/Kit/ai-agentic-starter-kit/_templates/agent_docs/` chứa toàn bộ 7 template với chất lượng cao (lean-spec style: decision + policy, không code). Đã được dùng làm nguồn tham khảo.

---

## II. Đã Thực Hiện

### Copy 5 template từ starter-kit → toolkit

| # | File | Dung lượng | Vị trí |
|---|------|-----------|--------|
| 1 | `error-handling-TEMPLATE.md` | 212 dòng | `templates/supporting/` |
| 2 | `caching-strategy-TEMPLATE.md` | 158 dòng | `templates/supporting/` |
| 3 | `frontend-architecture-TEMPLATE.md` | 300 dòng | `templates/supporting/` |
| 5 | `performance-test-TEMPLATE.md` | 308 dòng | `templates/supporting/` |
| 6 | `frontend-test-strategy-TEMPLATE.md` | 757 dòng | `templates/supporting/` |

**Không copy** (để sau):
- `scale-strategy-TEMPLATE.md` (#4) — quá nặng (478 dòng, code Java/YAML), nhiều phần overlap với per-service LLD
- `db-operations-TEMPLATE.md` (#7) — quá niche (PostgreSQL-specific)

### Đã xóa `templates/agt/roadmap-TEMPLATE.md` (session trước)

File 229 dòng, không agent nào tham chiếu, cấu trúc khác hoàn toàn sprint template.

---

## III. Cần Làm Tiếp (Tasks)

### Task 1: Tạo subagent xử lý cross-cutting files

**File mới**: `.claude/agents/sdlc/sdlc-lld-cross-cutting.md`

Hai hướng thiết kế:
- **A — Agent riêng**: `sdlc-lld-cross-cutting` chạy sau `sdlc-lld`, input từ `agent_docs/architecture.md` + `tech-design/*`, output 5 file
- **B — Mở rộng sdlc-lld**: Thêm Step 7-11 vào agent hiện có

Cần quyết định: agent riêng hay mở rộng? Arguments:
- Agent riêng: SRP tốt hơn, maxTurn riêng, có thể chạy song song với sdlc-lld (sau khi có per-service tech-design)
- Mở rộng: Đơn giản hơn, không cần agent mới, nhưng maxTurn đã 25

### Task 2: Cập nhật sdlc-orchestrator

Cần update:
- `flow-task.md`: Sau phase LLD → spawn cross-cutting agent → rồi mới IMP∥TST
- `flow-cook.md`: Đảm bảo cross-cutting files tồn tại trước khi cook
- `procedures.md`: Thêm gate check: 5 file cross-cutting tồn tại

### Task 3: Cập nhật sdlc-automation

Cần update:
- `SKILL.md`: Thêm step cross-cutting vào pipeline tự động
- Đảm bảo automation workflow gọi đúng agent sau LLD phase

---

## IV. Template Mồ Côi — Cần Dọn Dẹp Sau

Các template tồn tại trong `templates/` nhưng không agent nào tham chiếu:

| Template | Dung lượng | Đề xuất |
|----------|-----------|---------|
| `srs/SRS-TEMPLATE.md` | Có | Giữ — có thể dùng cho tổng hợp SRS output |
| `hld/HLD-TEMPLATE.md` | Có | Giữ — có thể dùng cho tổng hợp HLD output |
| `cr/CR-TEMPLATE.md` | Có | Cần check flow-cr có dùng không |
| `impl/migration-spec-TEMPLATE.md` | Có | Agent-routing #12 đọc `migration-spec.md` — cần agent tạo |
| `supporting/event-schema-TEMPLATE.md` | 418 dòng | Agent-routing #11 đọc `event-schema.md` — cần agent tạo, HOẶC merge vào `contracts/events.md` |

---

## V. Inconsistency Cần Sửa

| Vấn đề | File | Mô tả |
|--------|------|-------|
| `event-schema.md` vs `events.md` | `agent-routing-TEMPLATE.md` | Reading order #11 trỏ `event-schema.md`, file map trỏ `contracts/events.md` — 2 tên khác nhau |
| Cross-reference không bidirectional | Nhiều file | `depends_on`/`referenced_by` không khớp 2 chiều (xem report trước §VI) |
| SRS-TEMPLATE hứa "Phase 6 sẽ sinh" | `srs/SRS-TEMPLATE.md` | Hứa sinh `performance-test.md`, `scale-strategy.md`, `frontend-architecture.md` nhưng không agent nào làm |

---

## VI. Tổng Kết

| Trạng thái | Số lượng |
|-----------|---------|
| Template đã copy từ starter-kit | 5 |
| Task đã tạo | 3 |
| Template mồ côi cần dọn | 5 |
| Inconsistency cần sửa | 3 |

**File đã đọc trong session này:**
- `templates/sprint/backlog-TEMPLATE.md`
- `templates/sprint/board-TEMPLATE.md`
- `templates/sprint/roadmap-TEMPLATE.md`
- `agents/sdlc/sdlc-sprint-backlog.md`
- `agents/sdlc/sdlc-sprint-board.md`
- `agents/sdlc/sdlc-sprint-roadmap.md`
- `agents/sdlc/sdlc-lld.md`
- `templates/agt/agent-routing-TEMPLATE.md`
- `templates/supporting/` — toàn bộ thư mục
- `ai-agentic-starter-kit/_templates/agent_docs/` — 7 template cross-cutting
- `sdlc-plugins/_templates/` — toàn bộ thư mục

---

*Report này tổng hợp phân tích template gap trong session 2026-07-20 (tiếp nối). Dùng làm reference cho lần implement tiếp theo.*

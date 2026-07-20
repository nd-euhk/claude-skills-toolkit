---
name: human-docs
description: >-
  Đồng bộ agent_docs/ → docs/ cho human-readable output. Agent là SSOT (Single Source of Truth).
  Dùng khi cần xuất tài liệu cho người đọc từ agent artifacts: "/human-docs sync:srs",
  "/human-docs sync:architecture", "/human-docs sync:all", "/human-docs review".
allowed-tools: Read, Write, Glob, Bash(*), Workflow
version: 2.4.1
---

# human-docs — Agent → Human Documentation Sync

## Purpose

Agent docs (`agent_docs/`) được viết cho Claude/agent đọc — token-efficient, structured.
Human docs (`docs/`) được viết cho developer, PM, on-call engineer đọc — narrative, context-rich.

Agent là **SSOT** (Single Source of Truth). Skill này chỉ dispatch workflow scripts để transform — không tự thực thi logic.

## Sync Scope

```
agent_docs/                              docs/
────────────────────────────────         ────────────────────────────────
features/FR-*.md                  →      product/SRS.md
                                         product/features/README.md

architecture.md                   →      architecture/system-architecture.md
                                         architecture/diagrams/*.mermaid

adrs/ADR-*.md              ↘
error-handling.md           →      architecture/README.md (routing hub)
caching-strategy.md         →      ── Tất cả trỏ thẳng về agent_docs/
frontend-architecture.md    →      ── Không copy, không duplicate
frontend-test-strategy.md  ↗
performance-test.md        ↗
```

**Cơ chế routing:** ADR và 5 cross-cutting files KHÔNG được copy sang `docs/`. Thay vào đó, `architecture/README.md` đóng vai trò hub — thống kê + link trực tiếp về `agent_docs/`. System-architecture.md tổng hợp 1 đoạn summary cho mỗi cross-cutting concern.

**Không sync:** `intake/`, `business/`, `user/`, `ux/`, `releases/`, `operations/`, `codebase/` (human-only phases).

**Không tạo:** `SRS-BACKEND.md`, `SRS-FRONTEND.md` — BE/FE split thuộc về HLD/LLD, không ở tầng SRS (thay đổi từ v2.0.0).

## Core Principles

1. **Agent là SSOT** — mọi thay đổi bắt nguồn từ `agent_docs/`. Skill này chỉ transform.
2. **Không xóa file human** — file `docs/` không có nguồn từ agent được giữ nguyên, flag trong review.
3. **FR không copy riêng lẻ** — chỉ index README trỏ về agent_docs.
4. **ADR + Cross-cutting không copy** — README.md hub trỏ thẳng về `agent_docs/`. System-architecture.md tổng hợp summaries.
5. **Idempotent** — chạy sync nhiều lần không tạo duplicate.

## Commands

Tất cả command dispatch đến workflow scripts trong `.claude/workflows/`. Skill này không chứa procedure logic — workflow scripts + agent definitions (`agents/`) đảm nhiệm toàn bộ execution.

### `/human-docs sync:srs`

Tổng hợp `agent_docs/features/FR-*.md` → `docs/product/SRS.md` + `docs/product/features/README.md`.
Workflow dùng Explore fan-out theo domain: Discover → Gather (song song: foundation + traceability + contracts + per-domain FRs) → Generate (human-docs-sync-srs agent).

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs/human-docs-sync-srs.js" })
```

**Output (2 files):** SRS.md (8 sections: introduction, FR overview, feature details per domain, NFRs, traceability, external interfaces, constraints, user journeys) + features/README.md (index → agent_docs).
Agent definition: `human-docs-sync-srs` — nhận pre-gathered data từ Explore agents, synthesize SRS.md.

### `/human-docs sync:architecture`

Đồng bộ `agent_docs/architecture.md` + `agent_docs/adrs/` + 5 file cross-cutting → `docs/architecture/`.

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs/human-docs-sync-architecture.js" })
```

**Output (3 files):** README.md (hub routing ADRs + cross-cutting → agent_docs) + system-architecture.md (synthesis đầy đủ: C4 diagrams, service summary, cross-cutting summaries với link về agent_docs) + diagrams/*.mermaid (extract).
ADR và cross-cutting files được **routing** (trỏ thẳng về agent_docs), không copy.
Agent definition: `human-docs-sync-architecture` — đọc architecture.md + cross-cutting files, tổng hợp summaries, tạo README hub.

### `/human-docs sync:all`

Chạy song song `sync:srs` ∥ `sync:architecture`. Gọi đồng thời cả 2 workflow trong cùng một message:

```javascript
// Gọi song song — 2 workflow độc lập, không shared state, output khác thư mục
Workflow({ scriptPath: ".claude/workflows/human-docs/human-docs-sync-srs.js" })
Workflow({ scriptPath: ".claude/workflows/human-docs/human-docs-sync-architecture.js" })
```

Khi cả 2 hoàn tất (nhận đủ 2 task notification), báo cáo tổng kết: files written, warnings, status per phase.
Nếu 1 trong 2 fail → báo partial success, workflow còn lại vẫn tiếp tục.

### `/human-docs review`

So sánh 2 chiều `agent_docs/` ↔ `docs/`, phát hiện inconsistency. **Read-only.**

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs/human-docs-review.js" })
```

5 trạng thái: `synced` ✅ | `stale` ⚠️ | `missing` ❌ | `orphan` 👻 | `diverged` 🔀
Flag v1.0.0 artifacts (`SRS-BACKEND.md`, `SRS-FRONTEND.md`) là orphan.
Agent definition: `human-docs-review` — JSON schema validation.

**Review + sync workflow:** Chạy `review` để phát hiện stale/missing, sau đó chạy `sync:all` để cập nhật. Sync idempotent — chạy lại không tạo duplicate.

## Edge Cases

- **Không có agent_docs/**: Báo lỗi "Chưa có agent_docs/ — chạy SDLC flow trước để agent sinh artifact."
- **Không có FR nào**: SRS.md rỗng với ghi chú "Chưa có functional requirements."
- **Không có ADR nào**: README.md với ghi chú "Chưa có architectural decisions."
- **architecture.md không có Mermaid**: Warning, bỏ qua diagrams/.
- **File docs/ đã tồn tại**: Overwrite (sync = replace hoàn toàn). Human không nên edit trực tiếp synced files.
- **Concurrent edit**: Nếu human đã sửa file synced → review sẽ flag `diverged`. Sync sẽ overwrite.
- **Thư mục docs/ chưa có**: Workflow scripts tự tạo toàn bộ cây thư mục cần thiết.
- **Không có file cross-cutting**: Nếu `agent_docs/error-handling.md` (hoặc các file cross-cutting khác) không tồn tại → báo `cross_cutting_missing`, system-architecture.md hiển thị fallback "not yet defined".
- **Cross-cutting routing**: README.md trỏ thẳng về `agent_docs/` — không copy file, không tạo file rỗng. System-architecture.md tổng hợp 1 đoạn summary cho mỗi cross-cutting có sẵn.

## Transform Rules (summary)

Chi tiết trong từng agent definition (`agents/human-docs-*.md`). Tổng quan:

- **Deduplicate**: Nhiều FR cùng đề cập 1 API endpoint → merge thành 1 section.
- **Sort**: Theo priority (Must → Should → Could → Won't).
- **Group**: Theo domain (Auth, Payment, Notification...).
- **NFR extract**: Pattern `p95 < Xms`, `uptime`, `rate limit` → NFR section.
- **Layer field**: Giữ làm metadata hiển thị (BE/FE/BE+FE), không dùng để split file.
- **Cross-cutting summaries**: Mỗi file cross-cutting → 1 đoạn summary trong system-architecture.md + link về agent_docs. Không copy nguyên file.
- **Routing**: ADRs + cross-cutting files được README.md trỏ thẳng về `agent_docs/`, không duplicate.

## Templates

Output templates trong `templates/` — agent definitions đọc template và fill placeholder:

| Template | Dùng cho output | Nguồn gốc |
|----------|----------------|-----------|
| `SRS-TEMPLATE.md` | `docs/product/SRS.md` | Adapt từ starter-kit `SRS-TEMPLATE.md`, merged với human-docs consolidated approach — 8 sections đầy đủ |
| `system-architecture-TEMPLATE.md` | `docs/architecture/system-architecture.md` | Adapt từ starter-kit `HLD-TEMPLATE.md` — 14 sections với cross-cutting summaries + link |
| `architecture-README-TEMPLATE.md` | `docs/architecture/README.md` | Tạo mới — routing hub: ADR index + cross-cutting links → agent_docs |

Template dùng Mustache-style: `{{placeholder}}` cho single value, `{{#array}}` cho iteration, `{{^array}}` cho fallback khi empty.

## Migration from v1.0.0

- `docs/product/SRS-BACKEND.md` và `docs/product/SRS-FRONTEND.md` không còn được tạo tự động. Nếu đã tồn tại, review sẽ flag `orphan`.
- BE/FE split chuyển xuống HLD/LLD phase — xem agent definitions `sdlc-hld`, `sdlc-lld`.
- SRS.md giờ chứa toàn bộ FR detail thay vì chỉ overview.

---
name: human-docs
description: >-
  Đồng bộ agent_docs/ → docs/ cho human-readable output. Agent là SSOT (Single Source of Truth).
  Dùng khi cần xuất tài liệu cho người đọc từ agent artifacts: "/human-docs sync:product",
  "/human-docs sync:architecture", "/human-docs sync:all", "/human-docs review", "/human-docs update".
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Bash(*), Workflow
version: 2.0.0
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

adrs/ADR-*.md                     →      architecture/ADRs/README.md
```

**Không sync:** `intake/`, `business/`, `user/`, `ux/`, `releases/`, `operations/`, `codebase/` (human-only phases).

**Không tạo:** `SRS-BACKEND.md`, `SRS-FRONTEND.md` — BE/FE split thuộc về HLD/LLD, không ở tầng SRS (thay đổi từ v2.0.0).

## Core Principles

1. **Agent là SSOT** — mọi thay đổi bắt nguồn từ `agent_docs/`. Skill này chỉ transform.
2. **Không xóa file human** — file `docs/` không có nguồn từ agent được giữ nguyên, flag trong review.
3. **FR không copy riêng lẻ** — chỉ index README trỏ về agent_docs.
4. **ADR không copy riêng lẻ** — chỉ index README trỏ về agent_docs/adrs.
5. **Idempotent** — chạy sync nhiều lần không tạo duplicate.

## Commands

Tất cả command dispatch đến workflow scripts trong `.claude/workflows/`. Skill này không chứa procedure logic — workflow scripts + agent definitions (`agents/`) đảm nhiệm toàn bộ execution.

### `/human-docs sync:product`

Tổng hợp `agent_docs/features/FR-*.md` → `docs/product/SRS.md` + `docs/product/features/README.md`.

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs-sync-product.js" })
```

**Output (2 files):** SRS.md (tổng quan + toàn bộ FR detail, không BE/FE split) + features/README.md (index → agent_docs).
Agent definition: `human-docs-sync-product` — JSON schema validation chống hallucination.

### `/human-docs sync:architecture`

Đồng bộ `agent_docs/architecture.md` + `agent_docs/adrs/` → `docs/architecture/`.

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs-sync-architecture.js" })
```

**Output:** system-architecture.md + diagrams/*.mermaid + ADRs/README.md.
Agent definition: `human-docs-sync-architecture`.

### `/human-docs sync:all`

Chạy tuần tự `sync:product` → `sync:architecture`.

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs-sync-all.js" })
```

Báo cáo tổng kết: files written, warnings, status per phase.

### `/human-docs review`

So sánh 2 chiều `agent_docs/` ↔ `docs/`, phát hiện inconsistency. **Read-only.**

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs-review.js" })
```

5 trạng thái: `synced` ✅ | `stale` ⚠️ | `missing` ❌ | `orphan` 👻 | `diverged` 🔀
Flag v1.0.0 artifacts (`SRS-BACKEND.md`, `SRS-FRONTEND.md`) là orphan.
Agent definition: `human-docs-review` — JSON schema validation.

### `/human-docs update`

Incremental sync — chỉ cập nhật file có thay đổi dựa trên mtime comparison.

```javascript
Workflow({ scriptPath: ".claude/workflows/human-docs-update.js" })
```

Fallback: nếu không có timestamp → tự động đề xuất chạy `sync:all`.
Agent definition: `human-docs-update`.

## Edge Cases

- **Không có agent_docs/**: Báo lỗi "Chưa có agent_docs/ — chạy SDLC flow trước để agent sinh artifact."
- **Không có FR nào**: SRS.md rỗng với ghi chú "Chưa có functional requirements."
- **Không có ADR nào**: ADRs/README.md với ghi chú "Chưa có architectural decisions."
- **architecture.md không có Mermaid**: Warning, bỏ qua diagrams/.
- **File docs/ đã tồn tại**: Overwrite (sync = replace hoàn toàn). Human không nên edit trực tiếp synced files.
- **Concurrent edit**: Nếu human đã sửa file synced → review sẽ flag `diverged`. Sync sẽ overwrite.
- **Thư mục docs/ chưa có**: Workflow scripts tự tạo toàn bộ cây thư mục cần thiết.

## Transform Rules (summary)

Chi tiết trong từng agent definition (`agents/human-docs-*.md`). Tổng quan:

- **Deduplicate**: Nhiều FR cùng đề cập 1 API endpoint → merge thành 1 section.
- **Sort**: Theo priority (Must → Should → Could → Won't).
- **Group**: Theo domain (Auth, Payment, Notification...).
- **NFR extract**: Pattern `p95 < Xms`, `uptime`, `rate limit` → NFR section.
- **Layer field**: Giữ làm metadata hiển thị (BE/FE/BE+FE), không dùng để split file.

## Migration from v1.0.0

- `docs/product/SRS-BACKEND.md` và `docs/product/SRS-FRONTEND.md` không còn được tạo tự động. Nếu đã tồn tại, review sẽ flag `orphan`.
- BE/FE split chuyển xuống HLD/LLD phase — xem agent definitions `sdlc-hld`, `sdlc-lld`.
- SRS.md giờ chứa toàn bộ FR detail thay vì chỉ overview.

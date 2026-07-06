---
name: human-docs
description: >-
  Đồng bộ agent_docs/ → docs/ cho human-readable output. Agent là SSOT (Single Source of Truth).
  Dùng khi cần xuất tài liệu cho người đọc từ agent artifacts: "/human-docs sync:product",
  "/human-docs sync:architecture", "/human-docs sync:all", "/human-docs review", "/human-docs update".
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Bash(*)
version: 1.0.0
---

# human-docs — Agent → Human Documentation Sync

## Purpose

Agent docs (trong `agent_docs/`) được viết cho Claude/agent đọc — token-efficient, structured, tối thiểu.
Human docs (trong `docs/`) được viết cho developer, PM, on-call engineer đọc — narrative, context-rich, có rationale.

Agent là **SSOT** (Single Source of Truth). Skill này chỉ transform và enrich — không tự sinh nội dung mới.

## Sync Scope

Chỉ sync những artifact **agent tạo ra**. Các phase do human (PO, BA, AM, UX) phụ trách nằm ngoài scope:

```
agent_docs/                              docs/
────────────────────────────────         ────────────────────────────────
features/FR-*.md                  →      product/SRS.md
                                         product/SRS-BACKEND.md
                                         product/SRS-FRONTEND.md
                                         product/features/README.md

architecture.md                   →      architecture/system-architecture.md
                                         architecture/diagrams/*.mermaid

adrs/ADR-*.md                     →      architecture/ADRs/README.md
```

**Không sync (human-only, bỏ qua):** `intake/`, `business/`, `user/`, `ux/`, `releases/`, `operations/`, `codebase/`

## Core Principles

1. **Agent là SSOT** — mọi thay đổi bắt nguồn từ `agent_docs/`. Skill này chỉ transform.
2. **Không xóa file human** — nếu file trong `docs/` không có nguồn từ agent, giữ nguyên. Chỉ flag trong review.
3. **FR không copy riêng lẻ** — không tạo `docs/product/features/epic-{slug}/FR-*.md`. Chỉ index README trỏ về agent_docs.
4. **ADR không copy riêng lẻ** — không tạo `docs/architecture/ADRs/ADR-*.md`. Chỉ index README trỏ về agent_docs.
5. **Idempotent** — chạy sync nhiều lần không tạo duplicate content.

## Commands

### `/human-docs sync:product`

Tổng hợp `agent_docs/features/FR-*.md` → human-readable SRS docs.

**Procedure:**
1. Đọc tất cả `agent_docs/features/FR-*.md`
2. Parse mỗi FR: lấy FR ID, title, priority, Gherkin scenarios, business rules, edge cases
3. Xác định domain: BE (API contracts, data models, business rules) vs FE (UI flows, form validation, UX behavior)
4. Sinh 4 output file:

**`docs/product/SRS.md`** — Tổng quan master:
```markdown
# Software Requirements Specification — {Project}

> **Source**: agent_docs/features/ (N FRs)
> **Last synced**: {timestamp}

## Functional Requirements Overview

| FR ID | Feature | Priority | Sprint | Source |
|-------|---------|----------|--------|--------|
| FR-AUTH-001 | User Login | Must | Sprint 1 | [→](../../agent_docs/features/FR-AUTH-001.md) |
| ... | | | | |

## Non-Functional Requirements

[Extract NFR từ các FR có chứa performance/security constraints]

## Traceability Matrix (rút gọn)

| Requirement | FR | Test | Status |
|-------------|-----|------|--------|
| ... | ... | ... | ... |
```

**`docs/product/SRS-BACKEND.md`** — Backend concerns:
```markdown
# SRS Backend — {Project}

## API Contracts
[POST /api/v1/auth/login — từ FR-AUTH-001]
[Request/Response schema — từ Gherkin When/Then steps]
[Rate limiting, circuit breaker specs]

## Business Rules
| Rule ID | FR | Description |
|---------|-----|-------------|

## Data Models
[Entity schemas extracted từ FR business context]
```

**`docs/product/SRS-FRONTEND.md`** — Frontend concerns:
```markdown
# SRS Frontend — {Project}

## UI Flows
[Login flow — từ FR-AUTH-001 Gherkin]
[Form validation rules — từ edge cases]

## Component Requirements
| Component | FR | Behavior |
|-----------|-----|----------|

## Accessibility Requirements
[NFR về a11y nếu có]
```

**`docs/product/features/README.md`** — Index:
```markdown
# Feature Specifications

> Feature specs chi tiết nằm trong `agent_docs/features/`.
> File này chỉ là index để tra cứu nhanh.

| FR ID | Feature | Priority | Sprint | Full Spec |
|-------|---------|----------|--------|-----------|
| FR-AUTH-001 | User Login | Must | Sprint 1 | [→](../../agent_docs/features/FR-AUTH-001.md) |
| FR-AUTH-002 | User Registration | Must | Sprint 1 | [→](../../agent_docs/features/FR-AUTH-002.md) |
```

5. Tạo thư mục `docs/product/features/` nếu chưa có.
6. Tạo thư mục `docs/product/` nếu chưa có.

### `/human-docs sync:architecture`

Đồng bộ `agent_docs/architecture.md` → human-readable architecture docs.

**Procedure:**

1. Đọc `agent_docs/architecture.md`
2. Parse C4 diagrams (Mermaid code blocks): Context, Container, Component
3. Extract mỗi diagram → file riêng trong `docs/architecture/diagrams/`:
   - `c4-context.mermaid`
   - `c4-container.mermaid`
   - `c4-component-{service}.mermaid` (mỗi service 1 file nếu có)
4. Sinh `docs/architecture/system-architecture.md`:

````markdown
# System Architecture — {Project}

> **Source**: agent_docs/architecture.md
> **Last synced**: {timestamp}

## Architecture Overview

[Narrative mô tả tổng quan hệ thống — condensed từ C4 context]

## C4 — Context Diagram

```mermaid
[Nội dung từ diagrams/c4-context.mermaid]
```

## C4 — Container Diagram

```mermaid
[Nội dung từ diagrams/c4-container.mermaid]
```

## Service Details

### {service-name}
- **Stack**: [từ architecture.md]
- **Responsibilities**: [từ container diagram context]
- **Dependencies**: [từ diagram arrows]
- **ADR**: [link đến agent_docs/adrs/]

## Architectural Decisions

Chi tiết trong [agent_docs/adrs/](../../agent_docs/adrs/) — xem [ADR Index](./ADRs/README.md).
````

5. Sinh `docs/architecture/ADRs/README.md` — index trỏ về agent_docs:

```markdown
# Architectural Decision Records

> ADR chi tiết nằm trong `agent_docs/adrs/`.
> File này chỉ là index để tra cứu nhanh.

| ADR | Decision | Status | Date | Full Spec |
|-----|----------|--------|------|-----------|
| ADR-001 | Service Decomposition | Accepted | 2026-06-15 | [→](../../agent_docs/adrs/ADR-001--service-decomposition.md) |
| ADR-002 | API Gateway & Versioning | Proposed | 2026-06-20 | [→](../../agent_docs/adrs/ADR-002--api-gateway-and-versioning.md) |
```

6. Tạo thư mục `docs/architecture/diagrams/` và `docs/architecture/ADRs/` nếu chưa có.

### `/human-docs sync:all`

Chạy tuần tự `sync:product` → `sync:architecture`. Báo cáo tổng kết:

```
✅ sync:product      — 3 FRs → SRS.md, SRS-BACKEND.md, SRS-FRONTEND.md, README.md
✅ sync:architecture — architecture.md → system-architecture.md + 2 diagrams + ADRs/README.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done: 8 files written, 0 warnings
```

### `/human-docs review`

So sánh 2 chiều `agent_docs/` ↔ `docs/`, phát hiện inconsistency.

**Procedure:**
1. Liệt kê tất cả file trong `agent_docs/features/`, `agent_docs/adrs/`, `agent_docs/architecture.md`
2. So sánh với output tương ứng trong `docs/`
3. Phân loại:

| Status | Icon | Meaning |
|--------|------|---------|
| `synced` | ✅ | Docs up-to-date với agent source |
| `stale` | ⚠️ | Agent source thay đổi nhưng docs chưa cập nhật |
| `missing` | ❌ | Agent source có nhưng docs chưa có file tương ứng |
| `orphan` | 👻 | Docs có file nhưng không có agent source (human-only hoặc cũ) |
| `diverged` | 🔀 | Cả 2 có nhưng content khác nhau (cần human quyết định) |

4. Output report:

```
$ /human-docs review

docs/product/  ─────────────────────────────────────────
  ✅ SRS.md                           (synced 2026-07-03, 3 FRs)
  ✅ SRS-BACKEND.md                   (synced 2026-07-03)
  ⚠️  SRS-FRONTEND.md                  (stale — agent_docs added FR-AUTH-004)
  ✅ features/README.md               (synced)

docs/architecture/  ────────────────────────────────────
  ✅ system-architecture.md           (synced)
  ✅ diagrams/c4-context.mermaid      (synced)
  ✅ ADRs/README.md                   (synced, 3 ADRs indexed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 7 synced, 1 stale, 0 missing, 0 orphan
Action:  run "/human-docs update" to fix stale files
```

### `/human-docs update`

Incremental sync — chỉ cập nhật những file có thay đổi.

**Procedure:**
1. Đọc `docs/product/SRS.md`, parse trường `Last synced` để biết timestamp lần sync cuối.
2. So sánh mtime của `agent_docs/features/FR-*.md` với timestamp đó.
3. Chỉ re-sync các FR có thay đổi.
4. Tương tự cho `architecture.md` và `adrs/ADR-*.md`.
5. Fallback: nếu không có timestamp → chạy `sync:all`.

## Transform Rules

### FR → SRS Aggregation

Khi tổng hợp nhiều FR vào SRS.md:
- **Deduplicate**: Nhiều FR cùng đề cập 1 API endpoint → merge thành 1 section
- **Sort**: Theo priority (Must → Should → Could → Won't)
- **Group**: Theo domain (Auth, Payment, Notification...)
- **NFR extract**: Tìm pattern như `p95 < Xms`, `uptime`, `rate limit` → cho vào NFR section

### FR → BE/FE Split

Quy tắc phân loại:
- **Backend**: API contracts, data models, business rules, auth logic, rate limiting, error codes, database constraints
- **Frontend**: UI flows, form behavior, validation messages, accessibility, responsive breakpoints, loading states, error displays
- **Both**: Nếu 1 FR có cả 2 → xuất hiện trong cả 2 file, mỗi bên chỉ lấy phần liên quan

### Naming Convention

| Agent (`agent_docs/`) | Human (`docs/`) |
|------------------------|-----------------|
| `features/FR-AUTH-001.md` | (không copy, chỉ index README) |
| `adrs/ADR-001--service-decomposition.md` | (không copy, chỉ index README) |
| `architecture.md` (C4 Mermaid blocks) | `architecture/diagrams/c4-*.mermaid` |

## Edge Cases

- **Không có agent_docs/**: Báo lỗi "Chưa có agent_docs/ — chạy SDLC flow trước để agent sinh artifact."
- **Không có FR nào**: Tạo SRS.md rỗng với ghi chú "Chưa có functional requirements."
- **Không có ADR nào**: Tạo `docs/architecture/ADRs/README.md` với ghi chú "Chưa có architectural decisions trong agent_docs/adrs/."
- **architecture.md không có Mermaid**: Báo warning "Không tìm thấy C4 diagram trong architecture.md — bỏ qua diagrams/."
- **File docs/ đã tồn tại**: Overwrite (sync = replace hoàn toàn). Human không nên edit trực tiếp synced files.
- **Concurrent edit**: Nếu human đã sửa file synced → review sẽ flag `diverged`. Sync sẽ overwrite.
- **Thư mục docs/ chưa có**: Tự tạo toàn bộ cây thư mục cần thiết.

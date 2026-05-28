---
title: "Roadmap — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"

# --- Traceability ---
# Liệt kê các file mà roadmap này PHỤ THUỘC vào (upstream)
depends_on:
  - features/README.md                              # feature list + implementation order
  - architecture.md                                  # service catalog
  - ../docs/product/release-criteria.md              # gate criteria

# Liệt kê các file THAM CHIẾU NGƯỢC đến roadmap (downstream)
referenced_by:
  - ../.work/board.md                                # sprint view references roadmap
  - ../.work/backlog.md                              # backlog references roadmap

# --- Changelog ---
# Ghi log mỗi lần cập nhật để dễ audit
changelog:
  - "1.0 | {{date}} | Tạo mới — {{mô_tả_ngắn_nguồn_gốc}}"
---

# Roadmap — {{project_name}}

> **Context budget**: ~220 dòng. Load khi cần biết timeline, sprint tasks, hoặc phase dependencies.

> Single source of truth cho timeline, phases, tasks.
> `.work/board.md` → current sprint view (tham chiếu file này).
> `docs/product/release-criteria.md` → gate criteria chi tiết (PO/BA owns).

---

## Timeline

<!-- 
  📌 HƯỚNG DẪN: Vẽ ASCII timeline cho dự án.
  - Mỗi cột = 1 sprint (thường 1-2 tuần)
  - Đánh dấu Gate milestones bằng ▲
  - Giữ đơn giản, dễ scan bằng mắt
-->

```
                  {{Period 1}}       {{Period 2}}       {{Period 3}}       {{Period N}}
                  ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
                  │  Sprint 1       │  Sprint 2       │  Sprint 3       │  Sprint N       │
                  │  {{Theme}}        │  {{Theme}}        │  {{Theme}}        │  {{Theme}}        │
                  └─────────────────┴─────────────────┴─────────────────┴─────────────────┘
                                                                         ▲                ▲
                                                                  Gate 1: {{name}}    Gate 2: {{name}}
                                                                  {{DD/MM/YYYY}}      {{DD/MM/YYYY}}
```

## Milestones

<!--
  📌 HƯỚNG DẪN: Liệt kê các milestone quan trọng (gates).
  - Gate = điều kiện phải pass trước khi chuyển giai đoạn / go-live
  - Link đến file chi tiết gate criteria
-->

| Milestone | Target | Gate Criteria (tóm tắt) | Chi tiết |
|-----------|--------|------------------------|----------|
| **Gate 1: {{Tên}}** | {{DD/MM/YYYY}} | {{điều kiện tóm tắt}} | `{{path/to/criteria}}` § Gate 1 |
| **Gate 2: {{Tên}}** | {{DD/MM/YYYY}} | {{điều kiện tóm tắt}} | `{{path/to/criteria}}` § Gate 2 |
| **{{Event}}** | {{DD/MM/YYYY}} | {{mô tả}} | — |

---

## Phase Overview

<!--
  📌 HƯỚNG DẪN: Bảng tổng quan tất cả phases — bird's eye view.
  - Phase = nhóm logic (không nhất thiết = sprint)
  - Services = những service/component bị ảnh hưởng
  - Verify = cách kiểm tra nhanh phase đã hoàn thành
-->

| Phase | Sprint | Period | Services | Features | Verify |
|-------|--------|--------|----------|----------|--------|
| 1. {{Phase Name}} | Sprint 1 | {{Tuần X-Y}} | {{services}} | {{feature summary}} | {{verification command/action}} |
| 2. {{Phase Name}} | Sprint 2 | {{Tuần X-Y}} | {{services}} | {{feature IDs}} | {{E2E scenario}} |
| 3. {{Phase Name}} | Sprint 3 | {{Tuần X-Y}} | {{services}} | {{feature IDs}} | {{E2E scenario}} |
| N. {{Phase Name}} | Sprint N | {{Tuần X-Y}} | {{services}} | {{feature IDs}} | {{E2E scenario}} |

---

## Phase 1: {{Phase Name}} (Sprint 1 — {{Period}})

<!--
  📌 HƯỚNG DẪN: Mỗi phase có 1 section riêng với cấu trúc:
  - Goal: 1-2 câu mô tả outcome
  - Verify: acceptance criteria nhanh
  - Task table: mỗi dòng = 1 task nhỏ, trackable
  
  Status conventions:
    ✅ Done        — đã hoàn thành + verified
    🚧 WIP        — đang làm (ghi chú thêm nếu cần)
    🔲 Todo       — chưa bắt đầu
    ⛔ Blocked     — bị chặn (ghi lý do)
-->

> **Goal**: {{Mô tả outcome của phase này}}
> **Verify**: {{Cách verify nhanh — command hoặc scenario}}

| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| 1.1 | {{Task description}} | {{service}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |
| 1.2 | {{Task description}} | {{service}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |
| 1.3 | {{Task description}} | {{service}} | — | {{agent/member}} | 🔲 Todo |

---

## Phase 2: {{Phase Name}} (Sprint 2 — {{Period}})

> **Goal**: {{Mô tả outcome}}
> **Verify**: {{Cách verify nhanh}}

| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| 2.1 | {{Task description}} | {{service}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |
| 2.2 | {{Task description}} | {{service}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |

---

<!-- 
  📌 LẶP LẠI pattern trên cho mỗi phase. 
  Copy section "Phase N" và điền nội dung.
  Mỗi phase nên có 5-15 tasks.
-->

## Phase N: {{Phase Name}} (Sprint N — {{Period}})

> **Goal**: {{Mô tả outcome}}
> **Verify**: {{Cách verify nhanh}}

| # | Task | Service/Component | Spec | Assignee | Status |
|---|------|-------------------|------|----------|--------|
| N.1 | {{Task description}} | {{service}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |

---

## Totals

<!--
  📌 HƯỚNG DẪN: Bảng tóm tắt số lượng tasks mỗi phase.
  - Priority: Must / Should / Nice-to-have
  - Cập nhật khi thêm/xóa tasks
-->

| Phase | Tasks | Target | Priority |
|-------|-------|--------|----------|
| 1. {{Phase Name}} | {{N}} | {{Period}} | Must |
| 2. {{Phase Name}} | {{N}} | {{Period}} | Must |
| N. {{Phase Name}} | {{N}} | {{Period}} | Should |
| **Total** | **{{N}}** | **{{Duration}} → {{DD/MM/YYYY}}** | |

---

## Feature → Phase Mapping

<!--
  📌 HƯỚNG DẪN: Map mỗi Feature ID về Phase/Sprint chứa nó.
  - Giúp trace ngược từ feature → khi nào nó được implement
  - Feature ID format tuỳ dự án: FR-XXX-NNN, FEAT-NNN, US-NNN, etc.
-->

| Feature ID | Phase | Sprint |
|-----------|-------|--------|
| {{FR-XXX-001}} | Phase {{N}} | Sprint {{N}} |
| {{FR-XXX-002}}, {{FR-XXX-003}} | Phase {{N}} | Sprint {{N}} |

---

## Dependencies Between Phases

<!--
  📌 HƯỚNG DẪN: Vẽ dependency graph.
  - Dùng ASCII tree hoặc Mermaid diagram
  - Xác định critical path (chuỗi dài nhất không thể song song)
-->

```
Phase 1 ({{Name}})
  └──→ Phase 2 ({{Name}})
         ├──→ Phase 3 ({{Name}}) ← {{lý do phụ thuộc}}
         │      └──→ Phase 4 ({{Name}}) ← {{lý do phụ thuộc}}
         │             └──→ Phase N ({{Name}})
         └──→ Phase N ({{Name}}) ← {{lý do phụ thuộc}}
```

**Critical path**: {{Phase 1}} → {{Phase 2}} → {{...}} → {{Phase N}}

---

## Rollback Plan

<!--
  📌 HƯỚNG DẪN: Liệt kê các scenario rủi ro và action tương ứng.
  - Nghĩ về: bug ngày go-live, core logic sai, server quá tải, data loss
  - Mỗi scenario phải có action cụ thể + deadline xử lý
-->

| Scenario | Action |
|----------|--------|
| {{Mô tả scenario}} | {{Action + SLA}} |
| {{Mô tả scenario}} | {{Action + SLA}} |
| {{Mô tả scenario}} | {{Action + SLA}} |
| {{Mô tả scenario}} | {{Action + SLA}} |

→ Chi tiết: `{{path/to/detailed-rollback-plan}}`

---

## Project Operations

<!--
  📌 HƯỚNG DẪN: Tasks không thuộc feature nào nhưng cần track.
  - Ví dụ: CI/CD setup, agent bootstrap, documentation migration
  - Dùng prefix O.N để phân biệt với feature tasks
-->

| # | Task | Scope | Spec | Assignee | Status |
|---|------|-------|------|----------|--------|
| O.1 | {{Task description}} | {{scope}} | `{{path/to/spec}}` | {{agent/member}} | 🔲 Todo |
| O.2 | {{Task description}} | {{scope}} | — | {{agent/member}} | 🔲 Todo |

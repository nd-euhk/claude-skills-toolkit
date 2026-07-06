---
title: "human-docs v2.0.0 Refactor — Skill → Workflow → Agent Architecture"
status: approved
created: 2026-07-06
updated_by: khuend
---

# human-docs v2.0.0 Refactor

## 1. Motivation

### Vấn đề hiện tại (v1.0.0)

1. **Monolithic procedure trong SKILL.md** — ~290 dòng procedure inline, Claude tự thực thi từng bước parse/aggregate/split trong context → hallucination
2. **BE/FE split giả tạo ở tầng SRS** — SRS là tầng WHAT, BE/FE split tự nhiên xảy ra ở HLD/LLD. Việc tách SRS-BACKEND.md và SRS-FRONTEND.md từ FR files là không cần thiết
3. **Không có schema validation** — Claude có thể bịa ra content không có trong source
4. **4 file output cho sync:product** — quá nhiều, 2 trong số đó (SRS-BACKEND.md, SRS-FRONTEND.md) không có giá trị thực

## 2. Thiết kế mới: Skill → Workflow → Agent

### Nguyên lý

- **SKILL.md** = thin routing layer: purpose, scope, command → workflow mapping, edge cases (~60-80 dòng)
- **Workflow scripts** = orchestrators: parse input, spawn agent với schema, collect results
- **Agent definitions** = executors: single-purpose, Read → Process → Write, với JSON schema validation chặn hallucination

### Kiến trúc dispatch

```
/human-docs sync:product
  └─► Workflow: human-docs-sync-product
       └─► Agent: human-docs-sync-product (schema-validated)

/human-docs sync:architecture
  └─► Workflow: human-docs-sync-architecture
       └─► Agent: human-docs-sync-architecture (schema-validated)

/human-docs sync:all
  └─► Workflow: human-docs-sync-all
       └─► Pipeline: sync:product → sync:architecture (tuần tự)

/human-docs review
  └─► Workflow: human-docs-review (read-only)
       └─► Agent: human-docs-review (schema-validated)

/human-docs update
  └─► Workflow: human-docs-update
       └─► Agent: human-docs-update (incremental, schema-validated)
```

### 3. Thu gọn output sync:product

```
Trước (v1.0.0):                         Sau (v2.0.0):
  ├── SRS.md (tổng quan)                  ├── SRS.md (tổng quan + toàn bộ FR detail)
  ├── SRS-BACKEND.md (BE split) ❌         └── features/README.md (index → agent_docs)
  ├── SRS-FRONTEND.md (FE split) ❌
  └── features/README.md (index)
```

**Lý do:** Một FR thường là `layer: BE+FE` — feature không tách rời BE và FE ở tầng WHAT. BE/FE split là việc của HLD (architecture) và LLD (per-service design). Người đọc SRS.md (PO, BA) cần thấy toàn cảnh feature, không cần technical split.

### 4. File plan

| File | Mục đích | Ưu tiên |
|------|----------|---------|
| `skills/human-docs/SKILL.md` | Rewrite thin (~60-80 dòng) | P0 |
| `.claude/workflows/human-docs-sync-product.js` | Parse FR → SRS.md + README.md | P0 |
| `.claude/workflows/human-docs-sync-architecture.js` | Extract diagrams → system-arch + ADRs index | P0 |
| `.claude/workflows/human-docs-sync-all.js` | Pipeline tuần tự product + architecture | P0 |
| `.claude/workflows/human-docs-review.js` | Read-only consistency check | P0 |
| `.claude/workflows/human-docs-update.js` | Incremental sync | P0 |
| `.claude/agents/human-docs-sync-product.md` | Agent def + JSON schema | P0 |
| `.claude/agents/human-docs-sync-architecture.md` | Agent def + JSON schema | P0 |
| `.claude/agents/human-docs-review.md` | Agent def + JSON schema | P0 |
| `.claude/agents/human-docs-update.md` | Agent def + JSON schema | P0 |

### 5. Agent JSON Schemas (critical — hallucination gate)

#### human-docs-sync-product

```json
{
  "fr_count": "number",
  "features": [{
    "fr_id": "string",
    "title": "string",
    "priority": "string",
    "sprint": "string",
    "gherkin_scenarios": "number"
  }],
  "nfrs": [{ "id": "string", "metric": "string", "target": "string" }],
  "traceability": [{ "requirement": "string", "fr_id": "string", "test_id": "string" }]
}
```

#### human-docs-review

```json
{
  "entries": [{
    "path": "string",
    "status": "synced | stale | missing | orphan | diverged",
    "reason": "string"
  }],
  "summary": { "synced": "number", "stale": "number", "missing": "number", "orphan": "number" }
}
```

### 6. Transform rules (move từ SKILL.md → workflow scripts)

- **Deduplicate:** Nhiều FR cùng đề cập 1 API endpoint → merge thành 1 section trong SRS.md
- **Sort:** Theo priority (Must → Should → Could → Won't)
- **Group:** Theo domain (Auth, Payment, Notification...)
- **NFR extract:** Pattern `p95 < Xms`, `uptime`, `rate limit` → NFR section
- **Không copy FR riêng lẻ:** Chỉ index README trỏ về agent_docs
- **Không copy ADR riêng lẻ:** Chỉ index README trỏ về agent_docs/adrs

### 7. Edge cases (giữ nguyên từ v1.0.0)

- Không có `agent_docs/` → báo lỗi "Chưa có agent_docs"
- Không có FR nào → SRS.md rỗng với ghi chú
- Không có ADR nào → ADRs/README.md rỗng với ghi chú
- `architecture.md` không có Mermaid → warning, bỏ qua diagrams/
- File docs/ đã tồn tại → overwrite
- Thư mục docs/ chưa có → tự tạo

### 8. Không thay đổi

- `sync:architecture` output giữ nguyên: system-architecture.md + diagrams/*.mermaid + ADRs/README.md
- `review` 5 trạng thái giữ nguyên: synced, stale, missing, orphan, diverged
- `update` incremental logic giữ nguyên (so sánh mtime timestamp)
- `disable-model-invocation: true` — chỉ human invoke
- `allowed-tools: Read, Write, Glob, Bash(*)` — least privilege

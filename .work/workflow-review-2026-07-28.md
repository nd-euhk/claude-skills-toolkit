# Workflow Knowledge Review — 8 Workflows

**Ngày:** 2026-07-28
**Phạm vi:** `.claude/workflows/**/*.js`
**Dựa trên:** `.claude/skills/workflow-knowledge/SKILL.md` best practices

---

## Tổng quan

| # | Workflow | Dòng | Độ phức tạp | Trạng thái |
|---|----------|------|-------------|------------|
| 1 | `workflow-sdlc-scout-pipeline` | 479 | Trung bình | ⚠️ Có vấn đề |
| 2 | `workflow-sdlc-automation` | 862 | Cao | ⚠️ Có vấn đề |
| 3 | `workflow-sdlc-cook` | 773 | Cao | ⚠️ Có vấn đề |
| 4 | `workflow-sdlc-review-mr` | 831 | Cao | ✅ Tốt |
| 5 | `workflow-sdlc-review-code` | 791 | Cao | ✅ Tốt |
| 6 | `codebase-reverse` | 1634 | Rất cao | ✅ Đã sửa (new Date) |
| 7 | `human-docs-sync-architecture` | 199 | Thấp | ✅ Tốt |
| 8 | `human-docs-sync-srs` | 599 | Trung bình | ✅ Tốt |

---

## ❌ CRITICAL — Đã sửa

### 1. `codebase-reverse.js:406` — `new Date()` phá hủy resume ✅ FIXED

```js
// Trước (vi phạm):
verification_date: "${new Date().toISOString().split('T')[0]}"

// Sau (fix):
// Thêm runDate vào args destructure:
runDate,  // ISO date string for deterministic execution

// Sử dụng runDate:
verification_date: "${runDate || 'REQUIRED: pass runDate in args'}"
```

**Đã cập nhật skill `sdlc-codebase`** (SKILL.md + procedures.md + flow-reverse.md) để truyền `runDate` khi dispatch workflow.

---

## ⚠️ HIGH — Nên sửa sớm

### 2. `codebase-reverse.js` — Thiếu `isolation: 'worktree'` cho parallel write phases

LLD fan-out, SRS fan-out, và IMP+TST fan-out đều spawn parallel agents ghi vào `agent_docs/`. Nếu hai agent cùng ghi file cùng lúc → conflict.

**Đánh giá:** Các agent ghi theo service/domain — file ownership có vẻ disjoint. Synthesis agents đọc từ các file đó sau barrier. Hiện tại an toàn nhưng fragile nếu service/domain naming overlap.

### 3. Tất cả workflow — Không có `budget` awareness

Không workflow nào dùng `budget.total` hay `budget.remaining()`. Với các workflow nặng như `codebase-reverse` (có thể spawn 50+ agents), đây là risk:

```js
// Đề xuất thêm:
if (budget.total && budget.remaining() < 100_000) {
  log(`⚠️ Low budget: ${Math.round(budget.remaining()/1000)}k remaining — consider reducing scope`)
}
```

### 4. `review-mr.js` + `review-code.js` — Duplicate code đáng kể (~60%)

Hai workflow chia sẻ schema definitions, verify phase, synthesize phase, report phase. Chỉ khác ở prompt builders và context.

**Đề xuất:** Ghi chú trong comment ở đầu mỗi file rằng hai file cần được sync khi thay đổi shared logic. Không extract shared file — tôn trọng bounded scope principle.

---

## ⚠️ MEDIUM — Cân nhắc cải thiện

### 5. `automation.js` — Hardcoded model overrides

```js
model: 'fable',   // cho phase agents (dòng 444)
model: 'sonnet',  // cho gate agents (dòng 368)
```

**Vấn đề:** Workflow-knowledge khuyên "Default to omitting — the agent inherits the session model." Không có comment giải thích tại sao chọn model này.

**Đề xuất:** Thêm comment giải thích lý do, hoặc để phase agents inherit model, chỉ override gate nếu thực sự cần.

### 6. `cook.js` — Gate retry fix agents ghi file không an toàn

```js
// Dòng 564-571: parallel fix agents có thể cùng sửa một file
await parallel(fixPrompts.map(p => () =>
  agent(p, { label: 'fix-gate-light', phase: 'GATE Light', agentType: GREEN })
))
```

**Đề xuất:** Gom tất cả failures thành một prompt duy nhất cho MỘT fix agent, hoặc dùng `isolation: 'worktree'`.

---

## ✅ LOW — Điểm tốt cần ghi nhận

### Pipeline vs Parallel — dùng đúng trong hầu hết trường hợp

- **`review-mr.js` + `review-code.js`**: `pipeline()` cho per-finding verification (đúng — mỗi finding verify độc lập). `parallel()` cho review dimensions (đúng — cần tất cả results trước synthesis).
- **`codebase-reverse.js`**: `parallel()` cho fan-out per service/domain (đúng — cần tất cả trước synthesis). Barrier sau Stage 1 cross-cutting trước Stage 2 (đúng — frontend-test-strategy cần frontend-architecture).
- **`cook.js`**: Sequential TC processing (đúng — mỗi TC builds trên code của TC trước).
- **`scout-pipeline.js`**: `pipeline()` cho scout → report per sub-project (đúng — mỗi sub-project độc lập).

### Adversarial verification pattern — triển khai xuất sắc

Cả hai review workflows dùng pattern 3-skeptic majority vote đúng như workflow-knowledge:
- 3 independent skeptics (correctness, security, reproducibility)
- Majority vote (≥2/3 confirmed → survives)
- Default to refute nếu uncertain
- Perspective-diverse (không phải 3 identical refuter)

### Safe-parse args — 6/8 workflow tuân thủ

Tất cả workflow nhận args đều có `(typeof args === 'string') ? JSON.parse(args) : (args || {})` guard.

### Template literals — dùng rộng rãi

Hầu hết prompt builders dùng template literals thay vì string concatenation — đúng chuẩn workflow-knowledge.

---

## Bảng Anti-Patterns từ workflow-knowledge

| Anti-Pattern | Vi phạm ở đâu | Mức độ |
|---|---|---|
| `Date.now()`/`new Date()` | `codebase-reverse.js:406` | ✅ **Đã sửa** |
| No `budget.total` guard | Tất cả 8 workflows | High |
| Isolation worktree cho parallel writes | `codebase-reverse.js`, `cook.js` | Medium |
| Barrier khi pipeline đã đủ | Không vi phạm | — |
| Dedup against confirmed (không phải seen) | Không vi phạm | — |
| Stringified args | Không vi phạm (có safe-parse) | — |
| TypeScript annotations | Không vi phạm | — |
| Silent truncation | Không rõ ràng | — |

---

## Khuyến nghị hành động

| # | Hành động | Ưu tiên | Trạng thái |
|---|-----------|---------|------------|
| 1 | Sửa `new Date()` trong `codebase-reverse.js` + cập nhật skill `sdlc-codebase` | Critical | ✅ **Đã xong** |
| 2 | Thêm `budget` awareness cho `codebase-reverse.js`, `automation.js`, `cook.js` | High | ⏳ Chưa làm |
| 3 | Giải quyết duplication giữa `review-mr.js` và `review-code.js` | Medium | ⏳ Chưa làm |
| 4 | Thêm comment giải thích model override trong `automation.js` | Low | ⏳ Chưa làm |
| 5 | Gom GATE fix agents trong `cook.js` thành single agent | Medium | ⏳ Chưa làm |

---

*Report generated by workflow-knowledge review — 2026-07-28*

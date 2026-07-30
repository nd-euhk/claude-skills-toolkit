# Workflow Review Report — 2026-07-30

## Tổng Quan

Review 8 workflow scripts trong `.claude/workflows/` dựa trên tiêu chí từ `workflow-knowledge` skill.

| # | Workflow | Dòng | Chất Lượng | Vấn Đề |
|---|----------|------|-----------|--------|
| 1 | `workflow-sdlc-automation.js` | 862 | ⭐⭐⭐ | MEDIUM |
| 2 | `workflow-codebase-reverse.js` | 1635 | ⭐⭐⭐⭐ | LOW-MEDIUM |
| 3 | `workflow-sdlc-cook.js` | 784 | ⭐⭐⭐⭐ | LOW |
| 4 | `human-docs-sync-architecture.js` | 199 | ⭐⭐⭐⭐⭐ | VERY LOW |
| 5 | `human-docs-sync-srs.js` | 599 | ⭐⭐⭐⭐⭐ | VERY LOW |
| 6 | `workflow-sdlc-review-code.js` | 791 | ⭐⭐⭐⭐ | LOW |
| 7 | `workflow-sdlc-review-mr.js` | 831 | ⭐⭐⭐⭐ | LOW |
| 8 | `workflow-sdlc-scout-pipeline.js` | 479 | ⭐⭐⭐⭐ | LOW |

---

## Điểm Mạnh (Làm Tốt)

1. **Safe-parse args** — 8/8 workflows có guard `(typeof args === 'string') ? JSON.parse(args) : (args || {})` đúng chuẩn.
2. **Template literals** — Hầu hết workflows sử dụng template literals cho multiline strings, tuân thủ coding style.
3. **Schema usage** — 6/8 workflows dùng `schema` parameter cho `agent()` calls. 2 workflow tốt nhất (`human-docs-sync-*`) định nghĩa schema đầy đủ cho mọi agent output.
4. **Không dùng `Date.now()` / `Math.random()`** — Tất cả workflows đều pass timestamp qua `args.runDate`.
5. **Meta blocks** — Tất cả đều là pure literal, không computed values.
6. **Pipeline vs Parallel** — Nhìn chung đúng: `parallel()` cho work độc lập, `pipeline()` cho multi-stage per-item, `for` loop tuần tự cho TCs phụ thuộc.
7. **Không TypeScript annotations** — Tất cả là plain JavaScript.

---

## Các Vấn Đề Tìm Thấy

### Vấn Đề 1: `process.env.HOME` trong `automation` workflow (MEDIUM)

**File:** `workflow-sdlc-automation.js:28`
```js
repoPath = process.env.HOME + '/projects/AI/Kit/toolkit',
```

Workflow scripts **không có quyền truy cập Node.js API**. `process.env.HOME` sẽ throw `ReferenceError: process is not defined` nếu `repoPath` không được pass qua `args`. Hardcoded path `/projects/AI/Kit/toolkit` chỉ đúng trên máy của khuend.

**Fix:** Bỏ `process.env.HOME`, pass `repoPath` từ args với default `'.'` (workspace hiện tại).

### Vấn Đề 2: Thiếu `schema` cho phase agents trong `automation` (MEDIUM)

**File:** `workflow-sdlc-automation.js`

Các agent như `sdlc-srs`, `sdlc-hld`, `sdlc-lld`, `sdlc-imp`, `sdlc-tst` được gọi không có schema, rồi `extractOutputs()` và `extractFrIds()` dùng regex để parse unstructured text. Regex parsing fragile — nếu agent thay đổi output format, workflow sẽ miss outputs.

**Fix:** Thêm `schema: PHASE_RESULT` vào `agent()` calls trong `runPhase()` và dùng structured output thay vì regex.

### Vấn Đề 3: `verifySRSForDomains` dùng sequential loop thay vì parallel (LOW)

**File:** `workflow-codebase-reverse.js:278`

```js
for (let i = 0; i < domains.length; i++) {
  const verifyResult = await agent(verifySRSPrompt(domain, frGlob), {...})
}
```

Các domain verification là độc lập với nhau. Có thể dùng `parallel()` để tăng tốc.

**Fix:** Đổi `for` loop thành `parallel(domains.map(d => () => agent(...)))`.

### Vấn Đề 4: Code duplication giữa review-code và review-mr (LOW) — CHẤP NHẬN

**File:** `workflow-sdlc-review-code.js` + `workflow-sdlc-review-mr.js`

~600 dòng code gần như identical: schemas, verify phase, synthesis phase, report phase, dimension config. Duplication có chủ ý (bounded scope principle). Sẽ refactor khi workflow nesting được hỗ trợ tốt hơn.

### Vấn Đề 5: CC scope code lặp trong `automation` (LOW)

**File:** `workflow-sdlc-automation.js:638-684`

5 khối code gần như identical cho 5 CC agent types. Có thể DRY bằng một loop qua config array.

**Fix:** Extract thành loop qua `CC_AGENTS` config.

### Vấn Đề 6: `runGateWithRetry` truy cập biến ngoài scope (LOW)

**File:** `workflow-sdlc-cook.js:411-472`

Hàm `runGateWithRetry` dùng `techStackHint` và `allFiles` từ outer scope mà không được pass làm parameter. Vẫn hoạt động (closure) nhưng khó test và dễ gây bug nếu refactor.

**Fix:** Pass `techStackHint` và `allFiles` làm parameters.

---

## Bảng So Sánh Chất Lượng

| Tiêu chí | automation | codebase-reverse | cook | hd-arch | hd-srs | review-code | review-mr | scout |
|----------|-----------|-----------------|------|---------|--------|-------------|-----------|-------|
| Safe-parse args | ✅ | ✅ | ✅ | N/A | N/A | ✅ | ✅ | ✅ |
| Template literals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Schema cho agent | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| No process.env | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pipeline đúng | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Idempotent resume | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edge case handling | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DRY code | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |

---

## Feature Request: Idempotent Resume

Cook và scout workflows đã có idempotent resume. Nên thêm vào **automation** và **codebase-reverse** — đây là 2 workflow chạy lâu nhất, dễ bị fail ở phase cuối và phải chạy lại từ đầu.

Pattern tham khảo từ cook:
```js
resumeFrom = null,  // { completedPhases: ['SRS', 'HLD'], srsResult: {...}, hldResult: {...} }
```

---

## Khuyến Nghị Theo Thứ Tự Ưu Tiên

### Ưu tiên 1 (nên fix sớm)
1. Bỏ `process.env.HOME` khỏi `automation` workflow — lỗi runtime nếu `repoPath` không được pass.
2. Thêm `schema` cho phase agents trong `automation` — tăng độ tin cậy của output parsing.

### Ưu tiên 2 (cải thiện chất lượng)
3. Parallelize `verifySRSForDomains` trong `codebase-reverse` — giảm thời gian chạy.
4. DRY CC scope code trong `automation` — giảm ~40 dòng trùng lặp.

### Ưu tiên 3 (tính năng mới)
5. Thêm idempotent resume cho `automation` và `codebase-reverse`.
6. Pass parameters tường minh cho `runGateWithRetry` trong `cook`.

### Technical Debt (tương lai)
7. Extract shared code giữa `review-code` và `review-mr` khi workflow nesting khả dụng.
8. Giảm code duplication giữa `automation` và `codebase-reverse` (cùng pattern gate + retry).

---

## Điểm Nổi Bật

2 workflow **chất lượng cao nhất** là `human-docs-sync-architecture.js` và `human-docs-sync-srs.js` — ngắn gọn, có schema cho mọi agent, edge case handling tốt, cấu trúc phase rõ ràng. Đây là template tốt để tham chiếu khi viết workflow mới.

Workflow `cook` có implementation **idempotent resume** (qua `resumeFrom`) — pattern nên được áp dụng cho các workflow khác, đặc biệt là `automation` và `codebase-reverse` vốn chạy rất lâu.

---

*Report generated by Claude Code — workflow-knowledge review session*

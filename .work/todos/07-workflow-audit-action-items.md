# Workflow Audit — Action Items

**Nguồn:** `.work/workflow-review-2026-07-28.md`
**Ngày tạo:** 2026-07-28
**Trạng thái:** 1/5 done, 4 pending

---

## Tổng quan

Review 8 workflow trong `.claude/workflows/`, phát hiện 5 vấn đề cần xử lý.

---

## ✅ Done

### 1. [CRITICAL] `codebase-reverse.js:406` — `new Date()` phá hủy resume
- **Fix:** Thay `new Date().toISOString().split('T')[0]` bằng `runDate` parameter từ args
- **Đã cập nhật:** `sdlc-codebase` (SKILL.md + procedures.md + flow-reverse.md) + `workflow-codebase-reverse.js`
- **Tag:** `sdlc-skill-v4.4`

---

## ⏳ Pending (chưa làm, team đánh giá sau)

### 2. [HIGH] Thêm `budget` awareness cho 3 workflow nặng
- **Mục tiêu:** `codebase-reverse.js`, `automation.js`, `cook.js`
- **Lý do chưa làm:** Team member chưa đánh giá được — thêm vào sẽ gây rối
- **Pattern cần thêm:**
  ```js
  // Guard trước loop
  while (budget.total && budget.remaining() > 50_000) { ... }

  // Checkpoint ở đầu script
  if (budget.total && budget.remaining() < 100_000) {
    log(`⚠️ Low budget: ${Math.round(budget.remaining()/1000)}k remaining`)
  }
  ```
- **Ref:** workflow-knowledge SKILL.md, section "budget"

### 3. [MEDIUM] Giải quyết code duplication giữa `review-mr.js` và `review-code.js`
- **Mức độ:** ~60% duplicate (schema definitions, verify phase, synthesize phase, report phase)
- **Khác biệt:** Chỉ ở prompt builders và context
- **Hướng xử lý:** Thêm comment cross-reference ở đầu mỗi file. Không extract shared file — tôn trọng bounded scope principle
- **Files:** `.claude/workflows/review/workflow-sdlc-review-mr.js`, `.claude/workflows/review/workflow-sdlc-review-code.js`

### 4. [LOW] ~~Thêm comment giải thích model override~~ → **DROP** (2026-07-28)

- **Vị trí:** `automation.js:444` (model: 'fable' cho phase agents), `automation.js:368` (model: 'sonnet' cho gate agents)
- **Đánh giá lại:** Pattern đã rõ ràng từ context — gate agents = sonnet (read-only, cần nhanh, rẻ), phase agents = fable (produce spec artifacts, cần reasoning chất lượng cao). AgentType đã nói lên lý do (`sdlc-gate` → sonnet, `sdlc-srs/hld/lld` → fable). Thêm comment sẽ restate điều hiển nhiên.
- **Quyết định:** DROP. Nếu muốn document, thêm 1 dòng vào CLAUDE.md hoặc workflow-knowledge thay vì comment trong từng file.
- **File:** `.claude/workflows/automation/workflow-sdlc-automation.js`

### 5. [MEDIUM → LOW] Gom GATE fix agents trong `cook.js` — giữ nguyên, thêm caveat

- **Vị trí:** `cook.js:564-571` (GATE light retry), `cook.js:677-...` (GATE full retry)
- **Claim ban đầu:** Parallel fix agents có thể cùng sửa một file → conflict
- **Đánh giá lại (2026-07-28):**
  - GATE light chỉ có 4 checks, failures thường 1-2 items, hiếm khi nhiều
  - Cook chạy per-TC, scope rất hẹp — thường 1-2 files được thay đổi
  - GATE failures thường khác loại và ở các file khác nhau (test ≠ implementation ≠ config)
  - `MAX_GATE_RETRIES = 2` — tối đa 2 vòng retry
  - Gom thành single agent có nhược điểm: prompt quá dài (nhiều failures khác loại) → cognitive overload. Nếu một fix fail → re-run toàn bộ. Mất parallelism.
- **Kết luận:** Risk thấp trong thực tế. Giữ nguyên code hiện tại.
- **Hành động nếu muốn an toàn tuyệt đối:** Thêm `isolation: 'worktree'` (nhưng cost 200-500ms mỗi agent). Hoặc đơn giản nhất: thêm 1 dòng comment warning về conflict risk ở đầu parallel block.
- **File:** `.claude/workflows/automation/workflow-sdlc-cook.js`

---

## Không cần làm (LOW — điểm tốt)

- **Pipeline vs Parallel:** Dùng đúng trong hầu hết trường hợp
- **Adversarial verification:** Pattern 3-skeptic majority vote triển khai chuẩn
- **Safe-parse args:** 6/8 workflow tuân thủ
- **Template literals:** Dùng rộng rãi, không string concat

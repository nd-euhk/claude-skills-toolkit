# L2 — Verification Loops: Cải Thiện

**Ngày tạo:** 2026-07-08
**Độ ưu tiên:** High
**Trạng thái:** pending

## Mục Tiêu

Nâng cấp verification loops từ "rất tốt" (4/5) lên "xuất sắc" (5/5) qua 3 cải tiến.

## Todo

### 1. Cross-TC Interference Detection

**Vấn đề:** Khi implement TC_B, có thể vô tình break TC_A đã pass trước đó. Hiện tại GATE light chỉ check test suite tổng thể, không phát hiện interference pattern cụ thể.

**Giải pháp:**
- Thêm interference detection vào `sdlc-tdd-be-gate` và `sdlc-tdd-fe-gate` (light mode)
- Sau mỗi TC hoàn thành, chạy toàn bộ test suite và so sánh baseline
- Nếu có test mới fail → flag interference, báo cáo TC nào gây ra, test nào bị break
- Integration: thêm 1 check mới trong 4 critical checks của GATE light

**Tham khảo:** OpenSearch harness-first verification pattern

---

### 2. Adversarial Verification cho Bug Finding

**Vấn đề:** Khi `sdlc-review` hoặc `codebase-srs` tìm thấy issues, không có cơ chế xác minh độc lập. False positives có thể lọt qua.

**Giải pháp:**
- Thêm adversarial verification pattern: 3 independent skeptics per finding
- Mỗi skeptic được prompt với góc nhìn khác nhau (correctness, security, performance)
- Majority vote (≥2/3) → finding được confirm
- Tích hợp vào `sdlc-review` skill và codebase agents

**Tham khảo:** Anthropic's 3-role agent system (Planner → Generator → Evaluator)

---

### 3. Performance Regression Detection

**Vấn đề:** GATE full (10 checks) không bao gồm performance regression. Code refactor có thể vô tình degrade performance.

**Giải pháp:**
- Thêm benchmark baseline comparison vào GATE full mode
- Trước REFACTOR: capture baseline metrics (response time, memory, query count)
- Sau REFACTOR: so sánh với baseline, flag nếu degrade > threshold (vd: 10%)
- Tích hợp vào `sdlc-tdd-be-gate --mode=full` và `sdlc-tdd-fe-gate --mode=full`

**Tham khảo:** OpenSearch Nitro — autonomous performance optimizer with A/B testing

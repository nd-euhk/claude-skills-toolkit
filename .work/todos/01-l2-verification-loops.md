# L2 — Verification Loops: Cải Thiện

**Ngày tạo:** 2026-07-08
**Độ ưu tiên:** High
**Trạng thái:** 1/3 done (Cross-TC Interference Detection ✅)

## Mục Tiêu

Nâng cấp verification loops từ "rất tốt" (4/5) lên "xuất sắc" (5/5) qua 3 cải tiến.

## Todo

### 1. Cross-TC Interference Detection ✅ DONE (2026-07-08)

**Giải pháp đã triển khai:** Hybrid 2-tầng

**Tầng 1 — INTERFERENCE-LIGHT** (trong RED agent):
- Chạy toàn bộ test file sau mỗi TC GREEN
- Phát hiện 70-80% interference, cost ~2-5s
- RED agent return `INTERFERENCE` exit code — orchestrator dừng pipeline ngay
- File: `.claude/agents/sdlc/sdlc-tdd-be-red.md`, `.claude/agents/sdlc/sdlc-tdd-fe-red.md`

**Tầng 2 — INTERFERENCE-FULL** (trong GATE light L1):
- So sánh baseline (chụp trước TDD cycle) với test results hiện tại
- Map failed tests → files changed per TC → xác định culprit TC
- Phát hiện cross-file interference
- File: `.claude/agents/sdlc/sdlc-tdd-be-gate.md`, `.claude/agents/sdlc/sdlc-tdd-fe-gate.md`

**Baseline capture** (orchestrator spawn gate agent `--mode=baseline`):
- Chạy trước TDD cycle
- Lưu vào `.work/baselines/YYYYMMDD-FR-{ID}-{BE|FE}.json`
- File: `.claude/skills/sdlc-orchestrator/references/flow-cook.md`

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

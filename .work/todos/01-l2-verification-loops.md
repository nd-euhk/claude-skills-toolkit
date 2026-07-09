# L2 — Verification Loops: Cải Thiện

**Ngày tạo:** 2026-07-08
**Ngày cập nhật:** 2026-07-09
**Độ ưu tiên:** High
**Trạng thái:** 2/3 done (Cross-TC Interference Detection ✅, sdlc-review Adversarial Verification ✅, codebase-srs Adversarial Verification ✅ — now default, always-on)

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

**Giải pháp tổng thể:**
- Thêm adversarial verification pattern: 3 independent skeptics per finding
- Mỗi skeptic được prompt với góc nhìn khác nhau (phụ thuộc vào loại finding)
- Majority vote (≥2/3) → finding được confirm
- Tích hợp vào `sdlc-review` skill và codebase agents

**Tham khảo:** Anthropic's 3-role agent system (Planner → Generator → Evaluator)

#### 2a. sdlc-review Workflows ✅ DONE (2026-07-08)

Cả hai workflow review đã có adversarial verification:

- **workflow-sdlc-review-mr.js**: Phase "Verify" với 3 skeptics (correctness, security, reproducibility)
- **workflow-sdlc-review-code.js**: Phase "Verify" với 3 skeptics (correctness, security, reproducibility)
- Pattern: `pipeline()` — mỗi finding được verify ngay khi dimension review hoàn tất
- Majority vote ≥2/3 → finding survives; <2/3 → rejected (false positive)
- Stats tracking: `rawFindings`, `verifiedFindings`, `rejectedFindings`
- Gated sau flag `--adversarial` (opt-in qua CLI hoặc menu Q3)

#### 2b. codebase-srs Adversarial Verification ✅ DONE (2026-07-09)

**Khác biệt với sdlc-review:**
- sdlc-review findings: bugs, security holes, architectural violations → skeptics kiểm tra "lỗi có thực không?"
- codebase-srs inferences: FRs, Gherkin scenarios, actors, NFRs → skeptics kiểm tra "suy luận này có đủ code evidence không?"

**Giải pháp per-domain (không per-FR để kiểm soát cost):**
- Sau SRS fan-out, 3 skeptics per domain đọc tất cả FR files
- 3 lenses khác với review skeptics:
  - **Code Evidence**: FR có đủ file:line evidence không? Evidence có thực sự hỗ trợ kết luận?
  - **Behavioral Completeness**: Còn thiếu edge case/error path nào code có nhưng FR không cover?
  - **Business Coherence**: FR có hợp lý về mặt domain không? Actor/role có khớp auth pattern?
- Majority vote ≥2/3 → FR CONFIRMED; 1/3 → UNCERTAIN; 0/3 → REJECTED
- Kết quả verification cập nhật vào FR file frontmatter + truyền vào SRS synthesis

**Nơi tích hợp:**
- `workflow-codebase-reverse.js`: Phase mới giữa SRS fan-out và SRS synthesis (always-on, no flag needed)
- `sdlc-codebase` SKILL.md: Pipeline flow updated (SRS → Verify SRS → IMP∥TST)
- `codebase-srs` agent: Thêm `verification` field vào FR output format

---

### 3. Performance Regression Detection

**Vấn đề:** GATE full (10 checks) không bao gồm performance regression. Code refactor có thể vô tình degrade performance.

**Giải pháp:**
- Thêm benchmark baseline comparison vào GATE full mode
- Trước REFACTOR: capture baseline metrics (response time, memory, query count)
- Sau REFACTOR: so sánh với baseline, flag nếu degrade > threshold (vd: 10%)
- Tích hợp vào `sdlc-tdd-be-gate --mode=full` và `sdlc-tdd-fe-gate --mode=full`

**Tham khảo:** OpenSearch Nitro — autonomous performance optimizer with A/B testing

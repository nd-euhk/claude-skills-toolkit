# L5 — Observability: Cải Thiện

**Ngày tạo:** 2026-07-08
**Độ ưu tiên:** Medium
**Trạng thái:** pending

## Mục Tiêu

Nâng cấp observability từ "cơ bản" (2/5) lên "tốt" (4/5) qua 4 cải tiến.

## Todo

### 1. Execution Tracing & Decision Provenance

**Vấn đề:** Không biết agent nào chạy bao lâu, quyết định gì, tại sao chọn X thay vì Y. Debugging agent behavior hiện tại là black box.

**Giải pháp:**
- Thêm execution log per agent invocation vào `.work/traces/<agent>-<timestamp>.jsonl`
- Mỗi dòng log: `{timestamp, agent, phase, action, decision, reasoning, tokens_used, duration_ms}`
- Agent tự ghi decision provenance (tại sao chọn approach này?)
- Orchestrator aggregate traces → summary report sau mỗi pipeline completion

**Tham khảo:** Polar (arXiv 2605.24220) — token-level trajectory capture qua API proxy

---

### 2. Cost Attribution & Analytics

**Vấn đề:** Không biết feature nào đắt, phase nào tốn nhiều tokens nhất. Không có data để optimize pipeline efficiency.

**Giải pháp:**
- Track token usage per: phase, agent, feature (FR-ID), flow (task/cr/fixbug/cook)
- Tạo cost report: `.work/analytics/cost-<date>.md`
- Metrics: tokens/FR, tokens/phase, tokens/agent-type, cost/feature
- Dashboard: markdown table với top-5 expensive features, phase breakdown
- Tích hợp vào orchestrator's progress reporting

**Tham khảo:** Harness.io AI Engineering Insights — AI-committed code %, spend per dev

---

### 3. Pipeline Health Dashboard

**Vấn đề:** Không có cái nhìn tổng quan về pipeline health. Bao nhiêu phase pass/fail? Agent nào fail nhiều nhất? Bottleneck ở đâu?

**Giải pháp:**
- Tạo pipeline health report: `.work/analytics/health-<sprint>.md`
- Metrics:
  - Phase pass rate (% gate pass / total runs)
  - Agent fail rate (% agent invocations fail)
  - Avg duration per phase
  - Bottleneck detection (phase có duration cao nhất)
  - Flaky agent detection (agent fail > 30% → flag)
- Tự động cập nhật mỗi khi pipeline complete
- Tích hợp vào sprint review

**Tham khảo:** harness-engineering (dr-gareth-roberts) — telemetry module

---

### 4. Diff-Based Change Tracking

**Vấn đề:** Khi agent cập nhật specs, không có structured diff. Khó biết chính xác agent đã thay đổi gì trong file.

**Giải pháp:**
- Sau mỗi agent invocation có Write access: tự động generate diff summary
- Format: `.work/diffs/<agent>-<timestamp>.diff` (markdown table, không phải unified diff)
- Columns: file, section, change_type (added/modified/removed), summary
- Orchestrator include diff summary trong progress report
- Tích hợp vào git commit message (agent tự generate conventional commit)

**Tham khảo:** Harness.io Autonomous Workers — audit trails per pipeline step

---

## Ghi Chú

- L5 là layer yếu nhất hiện tại (2/5) — đây là trade-off có chủ đích vì ưu tiên reliability (L1, L2, L4) trước
- Khi số lượng feature và agent invocation tăng, L5 sẽ trở thành blocker cho velocity
- Khuyến nghị: triển khai execution tracing (todo 1) trước — đây là foundation cho mọi cải tiến L5 khác

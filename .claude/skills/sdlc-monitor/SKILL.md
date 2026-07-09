---
name: sdlc-monitor
description: >-
  Analyze telemetry trace data and generate pipeline execution reports.
  Use when checking agent token usage, detecting bottlenecks, reviewing
  pipeline performance, analyzing cost attribution, or auditing execution
  history. Invoke with /sdlc-monitor or when user asks "phân tích trace",
  "pipeline health", "báo cáo telemetry", "token usage report".
version: 1.0.0
allowed-tools: Read, Bash(node:*)
---

# SDLC Monitor — Pipeline Execution Analyzer

Phân tích trace data từ `.logs/` (OpenTelemetry spans, metrics, events) và
generate markdown report với token usage, timeline, bottleneck detection.

## Quick Start

```bash
# Generate report từ 7 ngày gần nhất
node .claude/skills/sdlc-monitor/scripts/analyze-traces.js

# Với tham số tùy chỉnh
node .claude/skills/sdlc-monitor/scripts/analyze-traces.js --days 30
node .claude/skills/sdlc-monitor/scripts/analyze-traces.js --output .logs/reports/sprint-5.md
node .claude/skills/sdlc-monitor/scripts/analyze-traces.js --session <session-id>
```

## Workflow

### 1. Kiểm tra dữ liệu

Trước khi analyze, xác nhận `.logs/` có dữ liệu:

```bash
ls -la .logs/spans/ .logs/metrics/ .logs/events/ 2>/dev/null
```

Nếu không có dữ liệu → báo user: "Chưa có telemetry data. Chạy Claude Code với
telemetry enabled trước: `./scripts/run-telemetry.sh`"

Nếu có dữ liệu → chạy analyze-traces.js.

### 2. Chạy analysis

```bash
node .claude/skills/sdlc-monitor/scripts/analyze-traces.js
```

Script tự động đọc tất cả `.jsonl` files trong `.logs/spans/`,
`.logs/metrics/`, `.logs/events/` và aggregate.

### 3. Đọc và trình bày report

Report được lưu vào `.logs/reports/<timestamp>.md`. Đọc file này và trình bày
cho user dưới dạng tóm tắt, highlight các điểm quan trọng:

- Agent nào tốn nhiều token nhất?
- Agent nào chậm nhất? Có bottleneck không?
- Có lỗi API hoặc refusal không?
- Pipeline health tổng thể (success rate, error rate)

Nếu user muốn chi tiết → mở full report.

### 4. Đề xuất hành động

Dựa trên findings trong report, đề xuất cụ thể:

| Finding | Đề xuất |
|---------|---------|
| Agent >50% total tokens | Tối ưu system prompt hoặc giảm reference material |
| Agent >3x avg duration | Kiểm tra redundant work hoặc context bloat |
| API errors > 0 | Review retry logic, xem xét model fallback |
| No cache hits | Bật prompt caching để giảm cost |
| Error rate > 10% | Investigate root cause, kiểm tra model availability |

## Report Sections

Report gồm 8 sections:

1. **Tổng Quan** — aggregate metrics (agents, tokens, cost, duration)
2. **Token Usage Per Agent** — bảng sorted by token usage, % share
3. **Execution Duration Per Agent** — ASCII bar chart timeline
4. **Bottleneck Analysis** — slowest agents, token/call efficiency
5. **Errors & Failures** — API errors, refusals, agent failures
6. **Model Usage** — model distribution per agent
7. **Pipeline Health Overview** — success rate, error rate, health indicators
8. **Recommendations** — actionable suggestions based on data

## Script Options

| Flag | Default | Mô tả |
|------|---------|-------|
| `--days N` | 7 | Chỉ phân tích N ngày gần nhất |
| `--output <path>` | `.logs/reports/<ts>.md` | Đường dẫn output report |
| `--session <id>` | *(all)* | Chỉ phân tích 1 session |

## Data Flow

```
Claude Code (OTEL enabled)
  → .logs/spans/<date>.jsonl     (flattened spans)
  → .logs/metrics/<date>.jsonl   (metric data points)
  → .logs/events/<date>.jsonl    (event records)
  → analyze-traces.js
    → Aggregate per agent
    → Compute metrics
    → Detect bottlenecks
  → .logs/reports/<ts>.md        (markdown report)
```

## Notes

- **Trace data phải được thu thập trước** — chạy `./scripts/run-telemetry.sh`
  thay vì `claude` để bật OTEL collector
- Report là snapshot tại thời điểm chạy — không auto-refresh
- Dữ liệu càng nhiều → report càng có ý nghĩa (khuyến nghị ít nhất 1 pipeline
  completion trước khi analyze)
- Script chỉ đọc (không modify gì) — an toàn để chạy bất kỳ lúc nào
- Không yêu cầu dependencies ngoài Node.js built-in

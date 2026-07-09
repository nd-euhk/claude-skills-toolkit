# L5 — Observability: Cải Thiện

**Ngày tạo:** 2026-07-08
**Ngày cập nhật:** 2026-07-09
**Độ ưu tiên:** Medium
**Trạng thái:** 4/4 done ✅

## Mục Tiêu

Nâng cấp observability từ "cơ bản" (2/5) lên "tốt" (4/5) qua 4 cải tiến.

## Todo

### 1. Execution Tracing & Decision Provenance ✅ DONE (2026-07-09)

**Giải pháp đã triển khai:** OTLP-based telemetry pipeline với 2 tầng:

**Tầng 1 — Telemetry Collection** (hooks + collector):
- `start-telemetry.sh`: SessionStart hook, tự động launch OTLP collector (port 4318) trong background
- `stop-telemetry.sh`: SessionEnd hook, graceful shutdown collector + dọn PID file
- `run-telemetry.sh`: Bootstrap script quản lý collector lifecycle (start/stop/status)
- `telemetry-collector.js`: Node.js OTLP server thu thập spans, metrics, events từ tất cả agent invocations. Log JSONL vào `.logs/` directory.
- `.gitignore`: Thêm `.logs/` để không commit telemetry data

**Tầng 2 — Trace Analysis** (sdlc-monitor skill):
- `sdlc-monitor/SKILL.md`: Skill định nghĩa cho agent trace monitoring và reporting
- `analyze-traces.js`: Parse OTLP traces → markdown report với:
  - Token usage per agent (input, output, cache read, % share)
  - Bottleneck detection (slowest agents, tokens/call efficiency)
  - Optimization advice (high token concentration, cache miss patterns)
  - Aggregate metrics (total tokens, cost estimate, session count)

**Kiến trúc:**
```
SessionStart → start-telemetry.sh → telemetry-collector.js (background)
  ↓
Agent invocations → OTLP spans/metrics → .logs/*.jsonl
  ↓
SessionEnd → stop-telemetry.sh → SIGTERM collector → cleanup
  ↓
/sdlc-monitor → analyze-traces.js → markdown report
```

**Files:** `.claude/hooks/{start,stop}-telemetry.sh`, `.claude/scripts/{run-telemetry.sh,telemetry-collector.js}`, `.claude/skills/sdlc-monitor/{SKILL.md,scripts/analyze-traces.js}`

**Còn thiếu:** Decision provenance field trong spans (agent tự ghi "tại sao chọn X") — sẽ bổ sung sau khi tích hợp với orchestrator.

---

### 2. Cost Attribution & Analytics ✅ DONE (2026-07-09)

**Giải pháp đã triển khai:** Token tracking + cost estimation trong analyze-traces.js

**Tầng hiện tại (agent-level):**
- Token usage per agent: input, output, cache read, cache write
- % share of total tokens → phát hiện agent monopolizing cost
- Cost estimate ($/1M tokens) với model-aware pricing
- Per-LLM-call breakdown (avg tokens/call, call count)
- Markdown report trong `.logs/reports/<ts>.md`

**Tầng tiếp theo (FR-level attribution) — chưa có:**
- Track tokens per FR-ID: cần orchestrator inject FR-ID vào span attributes
- Track tokens per phase (SRS/HLD/LLD/IMP/TST): cần phase tag trong spans
- Track tokens per flow type (task/cr/fixbug/cook): cần flow tag
- Cost report riêng: `.work/analytics/cost-<date>.md` (hiện tại dùng `.logs/reports/`)
- Top-5 expensive features bảng trong dashboard

**Files:** `.claude/skills/sdlc-monitor/scripts/analyze-traces.js` (sections 1-2 của report)

---

### 3. Pipeline Health Dashboard ✅ DONE (2026-07-09)

**Giải pháp đã triển khai:** Health overview + bottleneck detection trong analyze-traces.js

**Đã có:**
- LLM success rate (%)
- Error rate (%)
- Bottleneck detection (slowest agent, tokens/call efficiency)
- Model usage distribution per agent
- Recommendations engine (8 patterns: high token concentration, cache miss, errors, etc.)
- ASCII timeline visualization (per-agent duration bar chart)
- Markdown report với 8 sections chuẩn hóa

**Còn thiếu:**
- Phase-level metrics (pass rate per phase, avg duration per phase): cần phase tag trong spans
- Flaky agent detection (agent fail > 30% tự động flag): cần historical data đủ lớn
- Auto-update trigger (mỗi pipeline completion): cần orchestrator gọi analyze-traces.js
- Sprint review integration: cần định nghĩa sprint boundary trong spans
- Per-phase bottleneck (không chỉ per-agent): cần phase grouping

**Files:** `.claude/skills/sdlc-monitor/scripts/analyze-traces.js` (sections 3-8 của report)

---

### 4. Diff-Based Change Tracking ✅ DONE (2026-07-09)

**Giải pháp:** Không cần hệ thống mới — skill git (`/git cm` / `/git cp`) đã cover.

**Những gì git skill đã làm:**
- `git diff --cached --stat` + `--name-only` → xem chính xác file nào thay đổi
- Split logic: phân loại changes theo type/scope (feat/fix/perf, telemetry/sdlc-monitor/housekeeping)
- Conventional commit format: `type(scope): description` với body liệt kê từng file
- Security scan trước khi commit: phát hiện secrets, tokens, credentials
- Push + PR nếu cần (`/git cp`, `/git pr`)

**Tại sao không cần full structured diff system:**
- Git đã là structured diff system: `--stat`, `--name-only`, `--cached`, `git log`
- Commit message conventional format → changelog tự động → searchable audit trail
- Diff summary semantic không mang thêm giá trị so với commit message đã được split logic xử lý
- Tiết kiệm LLM calls: mỗi diff summary tốn 1 call, trong khi git đã làm miễn phí

**Files:** `.claude/skills/git/SKILL.md`, `.claude/skills/git/references/workflow-commit.md`, `.claude/skills/git/references/commit-standards.md`

---

## Ghi Chú

- ~~L5 là layer yếu nhất hiện tại (2/5)~~ → nay đã 4/4 ✅
- ✅ Mục 1 (Execution Tracing): OTLP pipeline 2 tầng — collector + sdlc-monitor analyzer
- ✅ Mục 2 (Cost Attribution): Agent-level token tracking + cost estimate. Còn thiếu FR-level attribution (cần phase tag trong spans) — nhưng đủ dùng cho hiện tại
- ✅ Mục 3 (Pipeline Health): 8-section report, success rate, error rate, bottleneck detection. Còn thiếu phase-level grouping (cần đủ historical data) — sẽ tự cải thiện khi data tích lũy
- ✅ Mục 4 (Diff-Based Change Tracking): Git skill đã cover — không cần thêm system mới
- **Kết luận:** L5 2/5 → 4/5 đã đạt. Không cần thêm cải tiến nào cho L5. Nếu muốn lên 5/5 trong tương lai: bổ sung FR-level attribution + phase-level health metrics

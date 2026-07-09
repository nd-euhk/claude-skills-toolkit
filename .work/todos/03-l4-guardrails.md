# L4 — Guardrails: Cải Thiện

**Ngày tạo:** 2026-07-08
**Ngày cập nhật:** 2026-07-09
**Độ ưu tiên:** Medium
**Trạng thái:** 2/4 done

## Mục Tiêu

Nâng cấp guardrails từ "rất tốt" (4/5) lên "xuất sắc" (5/5) qua 4 cải tiến.

## Todo

### 1. Token Budget & Cost Enforcement ✅ DONE (2026-07-09)

**Giải pháp:** Dùng 3 cơ chế native của Claude Code (không cần infrastructure mới):

**1. Model selection — rẻ cho task nhẹ, mạnh cho task nặng:**
- Specs agents (SRS, HLD, LLD, IMP, TST): `model: opus` — cần reasoning mạnh cho spec writing
- TDD agents (RED, GREEN, GATE, REFACTOR): `model: sonnet` — task cơ khí hơn, rẻ hơn

**2. maxTurn — giới hạn số lượt agentic:**

| Agent | maxTurn | Rationale |
|-------|---------|-----------|
| sdlc-srs | 40 | Multi-FR analysis, cần exploration |
| sdlc-hld | 30 | Architecture design, ít file hơn |
| sdlc-lld | 25 | Per-service, 9 sections scoped |
| sdlc-imp | 20 | Per-feature, format predictable |
| sdlc-tst | 20 | Per-feature, test cases only |
| sdlc-tdd-be-red | 30 | Mini-orchestrator + interference check |
| sdlc-tdd-fe-red | 30 | Mini-orchestrator + interference check |
| sdlc-tdd-be-green | 25 | Implement tối thiểu 1 TC |
| sdlc-tdd-fe-green | 25 | Implement tối thiểu 1 TC |
| sdlc-tdd-be-refactor | 25 | Cleanup + security checks |
| sdlc-tdd-fe-refactor | 25 | Cleanup + a11y/UX checks |
| sdlc-tdd-be-gate | 20 | Read-only verification |
| sdlc-tdd-fe-gate | 20 | Read-only verification |

**3. Tool restrictions — principle of least privilege:**
- GATE agents: `tools: Read, Bash, Glob` (read-only, không Write)
- GREEN agents: `tools: Read, Write, Edit, Bash, Glob` (cần Write code)
- RED agents: `tools: Read, Write, Edit, Bash, Glob, Agent` (cần spawn subagent)
- Specs agents: `tools: Read, Write, Edit, Bash, Glob` (cần Write specs + validate)

**So với đề xuất gốc (token budget abstract):**
- ❌ Hard token limit: Claude Code không hỗ trợ kill agent mid-run
- ❌ Post-hoc budget check: cần phase tag trong spans (chưa có)
- ✅ Model + maxTurn + tool restrict: native, enforceable, không cần code mới
- ✅ Đã áp dụng cho toàn bộ 13 subagents

**Files:** `.claude/agents/sdlc/sdlc-{srs,hld,lld,imp,tst}.md` (thêm maxTurn)

---

### 2. Agent Timeout & Stuck Detection ✅ DONE (2026-07-09)

**Giải pháp:** Dùng `maxTurn` làm cơ chế timeout chính — Claude Code không hỗ trợ wall-clock timeout cho subagent, nhưng `maxTurn` giới hạn số lượt agentic, ngăn loop vô hạn hiệu quả.

**1. maxTurn — hard limit trên tất cả 28 agents:**

| Category | Agent | maxTurn | Rationale |
|----------|-------|---------|-----------|
| **Specs (opus)** | sdlc-srs | 40 | Multi-FR analysis, exploration |
| | sdlc-hld | 30 | Architecture design, ADRs |
| | sdlc-lld | 25 | Per-service, 9 sections |
| | sdlc-imp | 20 | Per-feature, structured format |
| | sdlc-tst | 20 | Per-feature, test cases only |
| **TDD (sonnet)** | RED | 30 | Mini-orchestrator + interference |
| | GREEN | 25 | Implement tối thiểu 1 TC |
| | REFACTOR | 25 | Cleanup + security/a11y checks |
| | GATE | 20 | Read-only verification |
| **Codebase (opus)** | codebase-hld | 55 | Scan toàn bộ codebase + 4-8 Explore |
| | codebase-srs-verify | 50 | 3 lenses × mỗi FR + 5 Explore |
| | codebase-srs | 45 | Per-domain inference + 4 Explore |
| | codebase-lld | 35 | Per-service extraction + Explore |
| | codebase-imp | 35 | Per-domain analysis + Explore |
| | codebase-tst | 35 | Per-domain test analysis + Explore |
| | codebase-lld-synthesis | 30 | Synthesis only, no Agent tool |
| | codebase-srs-synthesis | 30 | Synthesis only, no Agent tool |
| | codebase-gate | 15 | sonnet, read-only, no Agent |
| **Sprint (sonnet)** | backlog, board, roadmap | 15 | Single-file operations |
| **Human Docs (sonnet)** | review | 15 | Read-only comparison |
| | sync-architecture, sync-srs | 20 | Transform + write docs/ |

**2. Orchestrator error handling — đã có sẵn:**
- `flow-cook.md` error table: "Subagent crash / timeout → báo cáo human. Option: retry (max 2), skip, hoặc abort."
- Retry pattern trong `procedures.md`: max 2 retries, human-mediated
- RED agent internal limits: 3 sabotage attempts (BLOCKED), 5 GREEN iterations (STUCK)
- GATE retry limit: max 2 lần, sau đó human quyết định

**3. Stuck detection qua model behavior:**
- `maxTurn` ngăn loop vô hạn ở tầng infrastructure (Claude Code native)
- Agent tự nhận biết stuck thông qua self-check gate (mỗi agent đều có)
- RED agent return code `STALE` khi spec ambiguous — orchestrator dừng pipeline
- GREEN agent return `STUCK` sau 5 iterations — orchestrator dừng TC đó

**So với đề xuất gốc (wall-clock timeout):**
- ❌ Wall-clock timeout: Claude Code không hỗ trợ kill agent mid-run theo thời gian
- ❌ Orchestrator monitor real-time: orchestrator là agent, không phải process monitor
- ✅ maxTurn: hard limit, enforceable, áp dụng toàn bộ 28 agents
- ✅ Orchestrator error handling: đã có pattern retry/skip/abort cho timeout
- ✅ Self-check gate: mỗi agent tự detect stuck qua internal limits

**Codebase agents được set cao hơn SDLC agents (35-55 vs 20-40) vì:**
- Scan toàn bộ codebase (hàng trăm file) thay vì 5-10 spec files
- Spawn 4-8 Explore subagents (gap filling) thay vì 1-2
- Reverse engineering cần nhiều evidence gathering hơn forward spec writing
- Rủi ro nếu maxTurn thấp: mất service/feature, sai kiến trúc

**Files:** `.claude/agents/{codebase,sdlc,human-docs}/*/` — 15 agents thêm maxTurn (9 codebase + 3 sprint + 3 human-docs), nâng tổng từ 13 → 28

---

### 3. Approval Routing

**Vấn đề:** Hiện tại human-in-the-loop là generic — bất kỳ human nào cũng approve mọi phase. Không phân biệt ai nên review gì.

**Giải pháp:**
- Định nghĩa approval roles trong `conventions.md`:
  - Product Owner → approve SRS
  - Architect → approve HLD
  - Tech Lead → approve LLD, IMP
  - QA Lead → approve TST
  - Developer → approve TDD implementation
- Orchestrator gợi ý role khi request approval
- Optional: nếu chỉ có 1 người (solo dev), tự động skip role check

**Tham khảo:** aharness — FSM với typed submissions và approval routing

---

### 4. Rollback Mechanism khi Gate Fail

**Vấn đề:** Khi gate fail, pipeline dừng nhưng không có cơ chế rollback tự động. Changes từ agent vẫn nằm trong working tree.

**Giải pháp:**
- Trước mỗi agent spawn: tự động tạo git checkpoint (lightweight tag)
- Khi gate fail: orchestrator hỏi human "rollback changes của agent này?"
- Nếu human đồng ý → `git reset --hard` về checkpoint trước đó
- Checkpoint naming: `_checkpoint/<FR-ID>/<phase>-<timestamp>`
- Integration vào orchestrator's spawn template

**Tham khảo:** harness-rs — DAG replanning on failure

# Đánh Giá Harness Engineering trong SDLC Toolkit

**Ngày:** 2026-07-08
**Tác giả:** Claude Fable 5 + khuend
**Phiên bản:** 1.0

---

## 1. Tổng Quan về Harness Engineering (từ Web Research)

### Định nghĩa

**Harness Engineering** là kỷ luật xây dựng môi trường runtime, vòng phản hồi, guardrails, và hệ thống xác minh bao quanh LLM — biến model thô thành agent đáng tin cậy. Công thức cốt lõi:

> **Agent = Model + Harness**

Harness là mọi thứ NGOÀI model: prompts, tools, state, sandboxing, governance, orchestration logic, verification loops.

### Mô Hình 5-Layer Harness (Chuẩn Công Nghiệp)

Theo [Faros](https://www.faros.ai/blog/harness-engineering), [Red Hat](https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development), và [LangChain](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness):

| Layer | Tên | Mô tả |
|---|---|---|
| **L1** | Tool Orchestration | Cách agent truy cập môi trường (filesystem, bash, API, sandbox) |
| **L2** | Verification Loops | QA tự động (tests, linters, self-critique, adversarial review) |
| **L3** | Context & Memory | Kiến thức persistent về codebase, state management, session memory |
| **L4** | Guardrails | Safety boundaries, cost limits, human-in-the-loop gates, permission control |
| **L5** | Observability | Audit trails, execution tracing, cost tracking, decision provenance |

### Mô Hình 8-Layer (Drata)

Từ [Drata's analysis](https://drata.com/blog/building-harness-engineering):
Input & Trigger → Context Engineering → Orchestration & Planning → Reasoning Core (Memory + LLM + Tools) → Policy & Guardrails → State & Session → Action & Output → Observability

### Mô Hình 3 Vòng Lặp (CodAgent)

1. **Outer loop**: Project-level intent capture (specs, architecture, governance)
2. **Orchestration loop**: Per-feature plan → design → task breakdown → implement
3. **Inner loop**: Per-task code → verify → error feedback → retry

---

## 2. Kiến Trúc Harness SDLC Hiện Tại

### 2.1. Tổng Quan

SDLC Toolkit hiện tại triển khai một harness **đa tầng, đa agent** với:

```
┌─────────────────────────────────────────────────────────┐
│                 SDLC ORCHESTRATOR                        │
│  (Điểm vào duy nhất, phát hiện intent, route flow)       │
├─────────────────────────────────────────────────────────┤
│  PREFLIGHT → FOUNDATION → FLOW ROUTING                   │
├─────────────────────────────────────────────────────────┤
│  4 FLOWS:                                                │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │  task    │   cr     │  fixbug  │  cook    │          │
│  │  (specs) │ (change) │ (debug)  │ (code)   │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
├─────────────────────────────────────────────────────────┤
│  SPECS PIPELINE (task/cr):                               │
│  SRS → HLD → LLD → IMP ∥ TST                            │
│  (mỗi phase: Plan → Review → Spawn → Gate)               │
├─────────────────────────────────────────────────────────┤
│  TDD CYCLE (cook/fixbug):                                │
│  Per-TC: RED → GREEN → REFACTOR-light                    │
│  All-TCs: GATE-light → REFACTOR-full → GATE-full         │
│  Post: Code Review → Git Push                            │
├─────────────────────────────────────────────────────────┤
│  SUPPORT:                                                │
│  Sprint (backlog/board/roadmap)                          │
│  Grilling (human interview)                              │
│  Debugging (root cause)                                  │
│  Codebase (reverse-engineering)                          │
│  Preflight (foundation init)                             │
│  Review (code review)                                    │
│  Scout (codebase exploration)                            │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Agent Catalog

**Specs Pipeline (5 agents):**
- `sdlc-srs` — Functional + non-functional requirements với Gherkin scenarios
- `sdlc-hld` — C4 diagrams, ADRs, service boundaries
- `sdlc-lld` — Per-service tech design với 9 fixed sections
- `sdlc-imp` — Implementation specs (execution flows, business rules, error mapping)
- `sdlc-tst` — Test specifications (unit, integration, E2E, performance)

**TDD Cycle (8 agents — 4 BE + 4 FE):**
- `sdlc-tdd-be-red` / `sdlc-tdd-fe-red` — Mini-orchestrator per-TC, viết test, accidental green detection
- `sdlc-tdd-be-green` / `sdlc-tdd-fe-green` — Implement tối thiểu, skip protocol
- `sdlc-tdd-be-refactor` / `sdlc-tdd-fe-refactor` — Light (per-TC) + Full (6 categories)
- `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate` — Light (4 checks) + Full (10 gates)

**Codebase Reverse-Engineering (8 agents):**
- `codebase-hld` → `codebase-lld` (per-service) → `codebase-lld-synthesis` → `codebase-srs` (per-domain) → `codebase-srs-synthesis` → `codebase-imp` (per-domain) → `codebase-tst` (per-domain) + `codebase-gate`

**Sprint Management (3 agents):**
- `sdlc-sprint-backlog` — Ưu tiên, dependency, MoSCoW
- `sdlc-sprint-board` — Status columns, WIP limits
- `sdlc-sprint-roadmap` — Timeline, milestones

**Human Docs (3 agents):**
- `human-docs-review` — Read-only consistency check
- `human-docs-sync-architecture` — Transform architecture docs
- `human-docs-sync-srs` — Transform SRS docs

**Support Skills (8 skills):**
- `grilling`, `debugging`, `problem-solving`, `sdlc-review`, `sprint`, `git`, `sdlc-scout`, `sdlc-preflight`

---

## 3. Mapping Harness SDLC → Mô Hình 5-Layer

### L1: Tool Orchestration — ⭐⭐⭐⭐⭐ (Xuất sắc)

| Thành phần | Đánh giá |
|---|---|
| **Agent specialization** | 27+ agents chuyên biệt, mỗi agent có tool access riêng (principle of least privilege) |
| **Pipeline orchestration** | SRS→HLD→LLD→IMP∥TST tuần tự với IMP/TST song song |
| **Workflow routing** | 4 flows (task/cr/fixbug/cook) với keyword matching + priority |
| **Subagent spawning** | Agent tool với `permissionMode: "acceptEdits"`, `isolation: "worktree"` |
| **Dual-direction** | Codebase agents (reverse-engineer) + SDLC agents (forward-engineer) |

**Điểm mạnh:**
- Phân tách rõ ràng giữa orchestrator (điều phối) và specialists (thực thi)
- IMP∥TST song song — đúng pattern "pipeline with barrier only when needed"
- Codebase agents cho phép reverse-engineer từ code → specs (bổ trợ cho greenfield)

**Gaps:**
- Chưa có **DAG-based orchestration** với retry/backoff/replanning như [harness-rs](https://github.com/liliang-cn/harness-rs)
- Chưa có **dynamic agent spawning** dựa trên context (số lượng agent cố định)
- Thiếu **tool registry** với standardized adapters (mỗi agent tự define tools)

### L2: Verification Loops — ⭐⭐⭐⭐ (Rất tốt)

| Thành phần | Đánh giá |
|---|---|
| **Specs gate checks** | Mỗi phase có gate criteria riêng (procedures.md), fail → dừng pipeline |
| **TDD per-TC verification** | RED viết test → verify fail → GREEN implement → verify pass → REFACTOR cleanup |
| **Accidental green detection** | Sanity → Explore → Sabotage → Verify → Revert (5-step protocol) |
| **Dual-mode gates** | Light (4 checks) sau GREEN, Full (10 gates) sau REFACTOR |
| **Code review** | `sdlc-review` skill với --code và --full mode |

**Điểm mạnh:**
- TDD cycle đầy đủ với accidental green detection — rất hiếm thấy trong open-source harnesses
- Gate 2 tầng (light/full) cho phép fast feedback + comprehensive check
- BE và FE có gate criteria riêng biệt

**Gaps:**
- Chưa có **adversarial verification** (multiple independent skeptics per finding)
- Chưa có **regression test suite verification** tự động sau mỗi TC
- Thiếu **performance regression detection** (benchmark comparison)
- Chưa có **cross-TC interference check** (TC A pass → TC B break)

### L3: Context & Memory — ⭐⭐⭐ (Khá)

| Thành phần | Đánh giá |
|---|---|
| **Foundation files** | `project-overview.md`, `user-context.md`, `conventions.md` |
| **Spec documents** | `agent_docs/features/`, `agent_docs/backend/`, `agent_docs/frontend/` |
| **Hard boundaries** | `agent_docs/hard-boundaries.md` |
| **Sprint artifacts** | `.work/backlog.md`, `.work/board.md`, `agent_docs/roadmap.md` |
| **Session memory** | Claude Code auto-memory trong `~/.claude/projects/.../memory/` |

**Điểm mạnh:**
- Phân tách rõ: project context (foundation) → feature context (specs) → implementation context (IMP/TST)
- Hard-boundaries document được verify trong gate checks
- Memory persistence qua sessions

**Gaps:**
- **Không có knowledge graph** như [sdlc-harness](https://github.com/madhavmadupu/sdlc-harness) (SQLite-backed structural nodes + reasoning traces)
- **Không có vector store** cho codebase semantic search
- Memory là file-based, không structured — thiếu cross-referencing giữa specs
- Không có **auto-updating knowledge base** như OpenSearch Atlas
- Context window management thủ công (load references on-demand) thay vì automated compaction

### L4: Guardrails — ⭐⭐⭐⭐ (Rất tốt)

| Thành phần | Đánh giá |
|---|---|
| **Human-in-the-loop** | Bắt buộc mỗi phase: EnterPlanMode → Review → Spawn |
| **Hard boundaries** | Quy tắc không thể negotiate: orchestrator không thực thi, không skip phase, không tự sửa files |
| **Gate enforcement** | Fail → dừng pipeline, báo cáo human |
| **Permission control** | `permissionMode: "acceptEdits"` cho subagents |
| **Worktree isolation** | `isolation: "worktree"` cho parallel agents |
| **Git state check** | Preflight check dirty state, yêu cầu human giải quyết |

**Điểm mạnh:**
- Hard boundaries được enforce ở orchestrator level, không phải suggestion
- Human-in-the-loop ở MỌI phase — không có automatic pipeline chạy ẩn
- Worktree isolation ngăn conflict khi parallel agents

**Gaps:**
- **Không có cost limits** / token budget enforcement ở orchestrator level
- **Không có timeouts** cho long-running agents
- Thiếu **OPA-style policy engine** như [Harness.io Autonomous Workers](https://www.harness.io/blog/introducing-autonomous-worker-agents)
- **Không có approval routing** (ai approve gì? Product Owner approve SRS, Architect approve HLD...)
- Chưa có **rollback mechanism** khi gate fail (tự động revert changes)

### L5: Observability — ⭐⭐ (Cơ bản)

| Thành phần | Đánh giá |
|---|---|
| **Progress reporting** | Template report sau mỗi phase (phase hoàn thành, output files, gate status, next step) |
| **Agent output files** | Agents write to `agent_docs/`, có thể track qua git |
| **Sprint board** | Visual status tracking qua `.work/board.md` |
| **README** | `agent_docs/README.md` là index của tất cả artifacts |

**Điểm mạnh:**
- Progress reporting có cấu trúc nhất quán
- Git history của `agent_docs/` là audit trail tự nhiên

**Gaps:**
- **Không có execution tracing** (không biết agent nào chạy bao lâu, token usage)
- **Không có decision provenance** (tại sao agent quyết định X thay vì Y?)
- **Không có telemetry pipeline** (metrics collection, dashboard)
- **Không có alerting** khi pipeline stuck/fail
- Thiếu **cost attribution** (feature X tốn bao nhiêu tokens?)
- Thiếu **diff-based change tracking** giữa các lần chạy agent

---

## 4. So Sánh với Hệ Thống Khác

| Tiêu chí | SDLC Toolkit | Harness.io | harness-rs | sdlc-harness (OSS) | OpenSearch |
|---|---|---|---|---|---|
| **Agent count** | 27+ | Dynamic | Configurable | 5 roles | 4 agents |
| **Pipeline pattern** | Sequential + Parallel | DAG | DAG + retry | Sequential | Sequential + Verify |
| **Verification** | TDD + 2-tier gates | OPA policies | L1/L2/L3 maturity | Quality gates | Harness-first verify |
| **Memory** | File-based | Knowledge Graph+MCP | Pluggable | SQLite KG | Auto-updating Atlas |
| **Guardrails** | Hard boundaries + HITL | RBAC + OPA + audit | Contracts (DFA) | Provider seam | Human approval gates |
| **Observability** | Progress reports | Full telemetry | Telemetry | Reasoning traces | Agent verification loops |
| **Sandbox** | Worktree isolation | Docker sandbox | Sandbox trait | None | Live local stack |
| **Meta-learning** | None | None | None | None | None |

---

## 5. Điểm Mạnh Nổi Bật

1. **TDD Cycle Hoàn Chỉnh:** Accidental green detection 5-step protocol + dual-mode gates (light/full) + per-TC RED là mini-orchestrator — đây là thiết kế tiên tiến nhất trong tất cả harnesses được khảo sát. Không harness open-source nào có accidental green detection.

2. **Hard Boundaries Rõ Ràng:** Orchestrator chỉ điều phối, không thực thi. Quy tắc được enforce ở architecture level, không phải suggestion trong prompt.

3. **Dual-Direction Coverage:** Codebase agents (reverse-engineer từ code → specs) + SDLC agents (forward-engineer từ specs → code) — cho phép làm việc với cả legacy và greenfield.

4. **Human-in-the-Loop Bắt Buộc:** Mỗi phase đều qua Plan → Review → Spawn, ngăn autonomous pipeline runaway.

5. **Separation of Concerns:** 27+ agents chuyên biệt, sprint management tách rời (backlog/board/roadmap độc lập), specs pipeline tách rời TDD cycle.

---

## 6. Gaps và Cơ Hội Cải Thiện

### Critical Gaps (nên làm sớm)

| # | Gap | Impact | Giải pháp tham khảo |
|---|---|---|---|
| 1 | **Không có cost tracking** | Không biết feature nào đắt, agent nào tốn tokens | Token attribution per agent/phase, budget enforcement |
| 2 | **Không có cross-TC interference check** | TC B có thể break khi implement TC A | Add interference detection vào GATE light |
| 3 | **Không có knowledge graph** | Specs isolated, không cross-referenced | SQLite KG như sdlc-harness, link specs → code → tests |

### High-Value Gaps (nên làm sau)

| # | Gap | Impact | Giải pháp tham khảo |
|---|---|---|---|
| 4 | **Không có adversarial verification** | False positives trong bug finding | 3 independent skeptics per finding, majority vote |
| 5 | **Không có execution tracing** | Không debug được agent decisions | Log decision provenance, token-level trajectories như Polar |
| 6 | **Không có DAG orchestration** | Không retry/replan khi agent fail | DAG + retry/backoff như harness-rs |
| 7 | **Không có performance regression detection** | Performance có thể degrade không bị phát hiện | Benchmark baseline comparison trong GATE full |

### Nice-to-Have (dài hạn)

| # | Gap | Giải pháp tham khảo |
|---|---|---|
| 8 | Không có meta-learning | Harness Evolution Loop (arXiv 2604.21003) — tối ưu harness params qua iterations |
| 9 | Không có auto-updating KB | OpenSearch Atlas pattern — KB tự update từ code changes |
| 10 | Không có approval routing | Phân biệt ai approve gì (PO → SRS, Architect → HLD, etc.) |

---

## 7. Kết Luận

SDLC Toolkit hiện tại là một harness **rất trưởng thành** so với mặt bằng chung. So với các hệ thống được khảo sát:

- **Tool Orchestration (L1):** ⭐⭐⭐⭐⭐ — Vượt trội. 27+ agents chuyên biệt, pipeline rõ ràng, dual-direction.
- **Verification Loops (L2):** ⭐⭐⭐⭐ — Rất tốt. TDD cycle đầy đủ với accidental green detection là điểm khác biệt. Thiếu adversarial verification và cross-TC interference check.
- **Context & Memory (L3):** ⭐⭐⭐ — Khá. Foundation files + specs docs đầy đủ nhưng thiếu structured knowledge graph và semantic search.
- **Guardrails (L4):** ⭐⭐⭐⭐ — Rất tốt. Hard boundaries + HITL bắt buộc. Thiếu cost limits, timeouts, và approval routing.
- **Observability (L5):** ⭐⭐ — Cơ bản. Có progress reports nhưng thiếu execution tracing, telemetry, và cost attribution.

**Tổng thể:** 3.6/5 — Một harness thiên về **safety và correctness** (mạnh ở L1, L2, L4) nhưng còn yếu ở **visibility và optimization** (L3, L5). Đây là trade-off hợp lý cho giai đoạn hiện tại — ưu tiên reliability over observability. Khi scale lên, L3 và L5 sẽ cần được đầu tư để duy trì velocity.

**Khuyến nghị ưu tiên:**
1. Cost tracking & budget enforcement (ngăn runaway agents)
2. Knowledge graph cho cross-referencing specs
3. Cross-TC interference detection trong GATE
4. Execution tracing cho decision provenance

---

## Sources

1. [Faros — Harness Engineering: Making AI Coding Agents Work in 2026](https://www.faros.ai/blog/harness-engineering)
2. [Red Hat — Harness Engineering: Structured Workflows for AI-Assisted Development](https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development)
3. [LangChain — The Anatomy of an Agent Harness](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness)
4. [Drata — From Prompt Engineering to Harness Engineering](https://drata.com/blog/building-harness-engineering)
5. [OpenSearch — Harness-First Agentic SDLC](https://opensearch.org/blog/harness-first-agentic-sdlc-how-opensearch-builds-software-using-its-own-search-engine/)
6. [GitHub — sdlc-harness (madhavmadupu)](https://github.com/madhavmadupu/sdlc-harness)
7. [GitHub — harness-rs (liliang-cn)](https://github.com/liliang-cn/harness-rs)
8. [GitHub — harness-engineering (dr-gareth-roberts)](https://github.com/dr-gareth-roberts/harness-engineering)
9. [arXiv 2604.21003 — The Last Harness You'll Ever Build](https://browse-export.arxiv.org/abs/2604.21003)
10. [arXiv 2508.11126 — AI Agentic Programming Survey](https://arxiv.org/pdf/2508.11126v1)
11. [Harness.io — Introducing Autonomous Worker Agents](https://www.harness.io/blog/introducing-autonomous-worker-agents)
12. [ByteDance DeerFlow 2.0](https://github.com/bytedance/deerflow)
13. [Anthropic — Effective Harnesses for Long-Running Agents](https://www.anthropic.com)
14. [OpenAI Codex CLI — Million-line agent-built codebase](https://openai.com)
15. [arXiv 2605.24220 — Polar: Agentic RL on Any Harness at Scale](https://ar5iv.labs.arxiv.org/html/2605.24220)

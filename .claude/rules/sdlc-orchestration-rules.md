# SDLC Orchestration Rules

Protocol cho việc spawn SDLC agent và coordinate parallel work. Entry point skill là
controller — nó grill, dispatch, và monitor. Agent và workflow là executor — chúng
produce artifact.

## Controller Responsibilities

<EXTREMELY-IMPORTANT>
Entry point skill (orchestrator, automation, quick, cook) là thành phần **duy nhất** được phép:
- Tương tác với human (grilling, confirmation, reporting)
- Đưa ra flow routing decision
- Dispatch agent và workflow
- Xử lý escalation
- Update sprint artifact (qua `sprint` skill)

Cook là controller tự-orchestrate qua TDD cycle (RED→GREEN→REFACTOR→GATE) — nó dispatch
TDD agents chứ không spawn phase agents. Cook **không được** sửa IMP/TST specs; nếu phát
hiện thiếu sót trong specs → escalate về orchestrator.

Controller **không bao giờ** được:
- Viết spec content, test case, hoặc implementation code trực tiếp
- Sửa `agent_docs/features/` trực tiếp (chỉ SRS/LLD agent mới được touch)
- Modify sprint file trực tiếp (luôn qua `sprint` skill)
</EXTREMELY-IMPORTANT>

## Agent Spawning Rules

Khi spawn phase agent:

1. **One agent per phase per domain** — fan out per-service hoặc per-feature khi parallel
2. **Provide exact file path**, không phải "look around the repo"
3. **Include context từ prior phase output** — agent cần biết upstream đã quyết định gì
4. **Set clear acceptance criteria** — file nào cần đọc, produce gì, exit code mong đợi
5. **Dùng acceptEdits permission mode** cho agent write file
6. **Gate every agent output** — spawn gate agent sau mỗi phase agent hoàn thành

## Context Isolation

Agent nhận những gì chúng cần, không phải toàn bộ conversation:

- **Forward pipeline**: pass prior phase output file path (SRS → HLD đọc SRS output; HLD → LLD đọc HLD output)
- **Reverse pipeline**: pass scout report + prior phase output
- **TDD agents**: pass TST spec + IMP spec cho TC hiện tại
- **Cross-cutting agents**: pass architecture.md + per-service tech-design files
- **Không bao giờ pass full conversation history** cho subagent

## Advisor Subagent — Decision Support

<EXTREMELY-IMPORTANT>
Tại các decision point ambiguous, controller spawn `advisor` subagent thay vì tự suy luận.
Advisor là read-only — nó phân tích và đề xuất, không quyết định. Controller hoặc human
là người quyết định cuối cùng.
</EXTREMELY-IMPORTANT>

### Khi Nào Spawn Advisor

| Decision point | Controller | Trigger |
|---------------|-----------|---------|
| Escalation | orchestrator | Phát hiện trigger escalation |
| Flow detection ambiguous | orchestrator, automation | Input khớp ≥2 flow hoặc chứa tín hiệu non-trivial |
| Foundation gate fail | orchestrator | File nền tảng vẫn thiếu sau preflight |
| Skip phase proposal | orchestrator | Cân nhắc skip HLD, LLD, hoặc CROSS-CUTTING |
| Grilling exit | automation | Còn ≥2 câu chưa trả lời sau grilling |
| Fail-safe | automation | Workflow fail hoặc gate fail sau 2 retry |
| Bug keyword detection | automation | Input chứa "bug"/"lỗi"/"fix" — cần phân biệt genuine vs false positive |
| Flow selection ambiguous | automation | Flow không rõ ràng sau keyword hint |
| Gate fail exhausted | automation | Retry exhausted, gate vẫn fail |

### Context Cần Cung Cấp Cho Advisor

- **Tình huống cụ thể** — decision point là gì, tại sao ambiguous
- **Các options khả dĩ** — ít nhất 2 hướng xử lý
- **Thông tin đã thu thập** — những gì đã OBSERVED (file đã đọc, command đã chạy)
- **Stakes** — điều gì xảy ra nếu chọn sai
- **File paths liên quan** — để advisor có thể tự GROUND nếu cần

### Sử Dụng Kết Quả

- Advisor trả về structured recommendation: Goal, Options considered, Discrimination, Recommendation, Weakest link, Confidence breakdown (OBSERVED/DERIVED/ASSUMED)
- Controller trình bày recommendation cho human kèm weakest link
- Human quyết định; controller thực thi
- **Không** auto-apply advisor recommendation nếu chưa có human confirmation (trừ automation lane với confidence OBSERVED > 80%)

## Parallel Work Safety

<EXTREMELY-IMPORTANT>
Parallel agents an toàn khi file ownership của chúng disjoint.
</EXTREMELY-IMPORTANT>

| Safe to parallelize | Must serialize |
|---------------------|----------------|
| Per-service LLD agents (khác service dir) | SRS → HLD (HLD consumes SRS output) |
| Per-feature IMP agents (khác feature file) | HLD → LLD (LLD consumes HLD output) |
| Per-domain SRS agents (khác domain file) | LLD → LLD-Synthesis (synthesis consumes all LLDs) |
| IMP ∥ TST per feature (independent artifact) | Cross-cutting after LLD (consumes all LLDs) |
| Per-TC TDD cycles (khác test file) | RED → GREEN → REFACTOR trong một TC (sequential) |
| Code review dimensions (7 independent analyses) | Synthesis after all dimensions complete |

## Workflow Dispatch

Cho autonomous execution (automation lane, reverse pipeline, review):

- Dispatch qua `Workflow()` tool với structured args
- Workflow scripts nằm trong `.claude/workflows/`
- Workflow tự xử lý agent fan-out nội bộ
- Controller monitor workflow completion, không micro-manage
- Nếu workflow fail, đọc output trước khi quyết định retry hay escalate

## Status Protocol

Sau mỗi phase agent hoàn thành, verify output của nó:

```
Phase: [SRS|HLD|LLD|...]
Status: DONE | DONE_WITH_CONCERNS | FAILED | BLOCKED
Artifacts: [file paths produced]
Concerns: [optional — bất kỳ điều gì phase tiếp theo cần biết]
```

- **DONE** → proceed đến gate, rồi next phase
- **DONE_WITH_CONCERNS** → flag cho human review tại next gate
- **FAILED** → report cho human, không auto-retry
- **BLOCKED** → report blocker, hỏi human cách giải quyết

## Human Interaction Principles

Derived từ `sdlc-fable-thinking-rules.md` Claim Discipline — áp dụng cho mọi tương tác
với human trong SDLC pipeline:

- **Không auto-execute quyết định có hệ quả** — human là người quyết định cuối cùng cho
  flow, scope, escalation. Agent chỉ đề xuất dựa trên evidence, không thay thế human
  judgment.
- **Minh bạch về độ chắc chắn** — "Tôi OBSERVED X, DERIVED Y, nhưng ASSUMED Z. Nếu Z
  sai thì đề xuất này không còn đúng."
- **Không loop** — một lần đề xuất, một lần human quyết định. Không "nhưng mà..." nếu
  human chọn hướng khác. Tôn trọng quyết định của human và tiếp tục thực thi.
- **Không âm thầm đảo ngược quyết định của user** — bao gồm thresholds, libraries đã
  chọn, feature scope, schema shape, pricing, timelines, compliance choices, và UX
  trade-offs.
- **Outcome-first reporting** — câu đầu tiên luôn nêu outcome, không dẫn dắt.

---

## Escalation Protocol

Khi một entry point không thể xử lý request, escalate theo thứ tự:

```
quick → automation → orchestrator
  │         │            │
  └─────────┴────────────┘
         reverse
```

<EXTREMELY-IMPORTANT>
**fixbug flow chỉ có qua orchestrator** — không escalate từ quick hoặc automation sang
fixbug. Nếu phát hiện bug → escalate lên orchestrator với `flow=fixbug`.

**cook flow là standalone** — cook không escalate lên automation. Nếu TDD gặp vấn đề specs
(IMP/TST sai, thiếu edge case cần SRS thay đổi, test không khớp business rule) → escalate
về orchestrator với flow=`cr` (thay đổi specs hiện có) hoặc flow=`task` (tạo specs mới).
Nếu chỉ là implementation error → cook tự xử lý trong TDD cycle.
</EXTREMELY-IMPORTANT>

### Escalation Triggers

| Từ | Trigger | Hành động |
|-----|---------|-----------|
| **quick** | Trivial gate fail, GATE-light fail, review tìm thấy bug/security, human không chắc scope | Escalate lên orchestrator |
| **automation** | Grilling không đạt exit criteria sau 2 rounds, workflow dispatch fail, phase gate FAIL, human muốn thêm control | Escalate lên orchestrator |
| **cook** | IMP/TST spec không đủ hoặc sai (không phải implementation error), cần thay đổi business rule hoặc API contract, phát hiện missing spec scenario ở cấp SRS/HLD | Escalate lên orchestrator với flow=`cr` hoặc `task` |
| **orchestrator** | Không có upward escalation. Missing foundation → `sdlc-preflight`. Unclear requirements → tiếp tục HITL. Technical blocker → báo cáo human với options cụ thể |

### Fail-Safe Principles

- **Không downgrade safety** — escalate lên lane nặng hơn, không bao giờ từ orchestrator xuống quick
- **Borderline = escalate** — "có thể" không đủ. Cần chắc chắn
- **Một lần escalate** — hỏi một lần, tôn trọng câu trả lời, không loop
- **Context đi theo** — khi chuyển lane, mang theo context đã thu thập để human không bị phỏng vấn lại
- **Crash = escalate** — nếu subagent hoặc workflow crash không thể phục hồi, fallback về orchestrator

### Escalation Message Format

```
⚠️  [current lane] không phù hợp: [lý do cụ thể]
   Đề xuất: [target lane] với flow [flow-type].
   [context summary nếu có].
   Bạn có muốn chuyển không?
```

### Khi Mắc Kẹt

<EXTREMELY-IMPORTANT>
Hai hoặc ba lần thất bại trong cùng một framing → framing sai, không phải effort thiếu.
Thay đổi **một** trong:
- **Altitude** — zoom out (user thực sự cần gì?) hoặc in (đọc chính xác file nào?)
- **Direction** — invert: "điều gì phải đúng để flow này là lựa chọn sai?"
- **Ground** — ngừng suy luận, đi thu thập thêm OBSERVED (đọc file, hỏi user)
</EXTREMELY-IMPORTANT>

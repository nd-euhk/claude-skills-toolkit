# SDLC Orchestration

Protocol để spawn SDLC agents và điều phối parallel work. Entry point skill
là controller — nó grill, dispatch, và monitor. Agents và workflows là
executors — chúng tạo ra artifacts.

## Controller Responsibilities

Entry point skill (orchestrator, automation, quick) là thành phần **duy nhất**
được phép:

- Tương tác với human (grilling, confirmation, reporting)
- Ra quyết định flow routing
- Dispatch agents và workflows
- Xử lý escalations
- Cập nhật sprint artifacts (qua `sprint` skill)

Controller **không bao giờ**:
- Viết nội dung specs, test cases, hoặc implementation code trực tiếp
- Sửa `agent_docs/features/` trực tiếp (chỉ SRS/LLD agents mới được)
- Sửa sprint files trực tiếp (luôn qua `sprint` skill)

## Agent Spawning Rules

Khi spawn phase agents:

1. **Một agent cho mỗi phase cho mỗi domain** — fan out per-service hoặc per-feature khi có thể parallel
2. **Cung cấp exact file paths**, không phải "look around the repo"
3. **Bao gồm context từ prior phase outputs** — agent cần biết những gì đã được quyết định ở upstream
4. **Đặt acceptance criteria rõ ràng** — đọc file nào, tạo ra gì, exit codes mong đợi
5. **Dùng acceptEdits permission mode** cho agents ghi file
6. **Gate mọi agent output** — spawn gate agent sau mỗi phase agent hoàn thành
7. **Agent viết code phải tuân theo** `sdlc-development-rules.md`
8. **Gate agent phải tuân theo** `sdlc-review-rules.md` cho verdict handling và severity classification

## Context Isolation

Agent nhận những gì nó cần, không phải toàn bộ conversation:

- **Forward pipeline**: truyền prior phase output file paths (SRS → HLD đọc SRS outputs; HLD → LLD đọc HLD outputs)
- **Reverse pipeline**: truyền scout report + prior phase outputs
- **TDD agents**: truyền TST spec + IMP spec cho TC hiện tại
- **Cross-cutting agents**: truyền architecture.md + per-service tech-design files
- **Không bao giờ truyền full conversation history** cho subagent

## Parallel Work Safety

Parallel agents an toàn khi file ownership của chúng disjoint:

| An toàn để parallelize | Phải serialize |
|---|---|
| Per-service LLD agents (khác service dirs) | SRS → HLD (HLD tiêu thụ SRS output) |
| Per-feature IMP agents (khác feature files) | HLD → LLD (LLD tiêu thụ HLD output) |
| Per-domain SRS agents (khác domain files) | LLD → LLD-Synthesis (synthesis tiêu thụ tất cả LLDs) |
| IMP ∥ TST cho mỗi feature (independent artifacts) | Cross-cutting sau LLD (tiêu thụ tất cả LLDs) |
| Per-TC TDD cycles (khác test files) | RED → GREEN → REFACTOR trong một TC (tuần tự) |
| Code review dimensions (7 independent analyses) | Synthesis sau khi tất cả dimensions hoàn thành |

## Workflow Dispatch

Cho autonomous execution (automation lane, reverse pipeline, review):

- Dispatch qua `Workflow()` tool với structured args
- Workflow scripts nằm trong `.claude/workflows/`
- Workflow tự xử lý agent fan-out nội bộ
- Controller monitor workflow completion, không micro-manage
- Nếu workflow fail, đọc output trước khi quyết định retry hay escalate. Khi workflow dispatch fail hoặc runtime error, dùng `Agent("sdlc-fable-thinking", {prompt: "Decision: Fail-Safe. Context: OBSERVED: workflow name + phase + error output. PRIOR: workflow fail có thể do transient error hoặc bug thật. ASSUMED: error output chứa đủ thông tin để phân loại. Options: A) Retry — transient error, B) Fallback orchestrator — human-in-the-loop xử lý, C) Skip phase — không critical, D) Abort — không thể tiếp tục. Goal: pipeline hoàn thành với chất lượng chấp nhận được. Verify: đọc workflow output file + error logs."})` để đánh giá fail-safe strategy trước khi hành động

## Status Protocol

Sau mỗi phase agent hoàn thành, verify output của nó:

```
Phase: [SRS|HLD|LLD|...]
Status: DONE | DONE_WITH_CONCERNS | AGENT_ERROR | BLOCKED
Artifacts: [danh sách file paths đã tạo]
Concerns: [tùy chọn — những gì phase tiếp theo nên biết]
```

- **DONE** → proceed sang gate, rồi phase tiếp theo
- **DONE_WITH_CONCERNS** → flag cho human review ở gate tiếp theo. Nếu
  concerns liên quan đến severity, dùng fable-thinking Skill để đánh giá
  (xem `sdlc-fable-thinking-rules.md`)
- **AGENT_ERROR** → agent crash hoặc không thể hoàn thành. Báo cáo human,
  không auto-retry
- **BLOCKED** → báo cáo blocker, hỏi human để giải quyết

**Lưu ý:** `AGENT_ERROR` (agent crash/lỗi runtime) khác với `GATE_FAIL`
(gate agent phát hiện criteria không đạt). Gate verdict handling với retry
được quy định trong `sdlc-review-rules.md`.

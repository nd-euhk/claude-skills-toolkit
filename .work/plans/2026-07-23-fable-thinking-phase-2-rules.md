# Plan: Fable-Thinking Phase 2 — Tích hợp vào 5 Rule Files

## Context

Phase 1 đã hoàn thành: fable-thinking protocol được tích hợp vào orchestrator và
automation skill (7 decision points). Rule file `sdlc-fable-thinking-rules.md` đã
được tạo với framing đúng: fable-thinking là **reasoning protocol**, không phải
utility skill; áp dụng qua 2 phương thức Skill() và Agent().

Phase 2 mở rộng tích hợp vào chính 5 rule files — nơi định nghĩa procedure cho
toàn bộ SDLC pipeline. Rule files là tầng thấp nhất, được load vào context của
mọi orchestrator/automation session. Thêm fable-thinking guards vào đây đảm bảo
mọi decision point đều được protocol verify, bất kể entry point nào.

## Deliverables

1. `.claude/rules/sdlc-routing.md` — thêm fable-thinking guards (3 điểm)
2. `.claude/rules/sdlc-entry-gate.md` — thêm fable-thinking guards (2 điểm)
3. `.claude/rules/sdlc-pipeline.md` — thêm fable-thinking guards (3 điểm)
4. `.claude/rules/sdlc-orchestration.md` — thêm fable-thinking guards (2 điểm)
5. `.claude/rules/sdlc-escalation.md` — thêm fable-thinking guard (1 điểm)

---

## Đánh giá từng rule file

### sdlc-routing.md — 3 decision points

Intent → flow resolution là decision point quan trọng nhất trong toàn bộ SDLC.
Sai flow = sai toàn bộ pipeline. Rule hiện tại dùng keyword matching theo priority
— structurally fragile với ambiguous input.

| # | Decision Point | Trigger | Phương thức | Ưu tiên |
|---|---|---|---|---|
| R1 | Flow Detection ambiguous | Input khớp ≥2 flow, hoặc flow thắng có priority thấp hơn nhưng keyword dài hơn | Skill (mặc định) | **Critical** |
| R2 | Bug vs False Positive | Input chứa "bug"/"lỗi"/"fix" nhưng có thể là false positive | Skill | High |
| R3 | Trivial Gate (từ chối quick) | Input khớp quick keywords nhưng có tín hiệu non-trivial | Skill | High |

### sdlc-entry-gate.md — 2 decision points

Entry gate là mandatory checkpoint cho mọi flow. Foundation gate fail và flow-scope
mismatch là 2 điểm mà quyết định sai dẫn đến pipeline chạy với thiếu context hoặc
sai flow.

| # | Decision Point | Trigger | Phương thức | Ưu tiên |
|---|---|---|---|---|
| E1 | Foundation Gate Fail | Preflight không tạo được required files | Agent (cần đọc agent_docs/) | **Critical** |
| E2 | Flow-Scope Mismatch | Scope thực tế từ file inventory vượt flow đã chọn | Agent (cần inventory files) | High |

### sdlc-pipeline.md — 3 decision points

Pipeline là xương sống của SDLC. Gate failure, CROSS-CUTTING scope, và TDD
interference là 3 điểm mà protocol discipline ngăn "skip để cho nhanh" hoặc
"chắc chỉ là false positive".

| # | Decision Point | Trigger | Phương thức | Ưu tiên |
|---|---|---|---|---|
| P1 | Gate Failure Strategy | Gate fail sau 3 retry — skip, continue manual, abort? | Agent (cần đọc gate report) | **Critical** |
| P2 | CROSS-CUTTING Scope | Auto-detect scope từ architecture.md + SRS NFRs | Agent (cần đọc nhiều file) | High |
| P3 | TDD Interference | TC mới làm vỡ TC cũ — real interference? | Agent (cần đọc test output) | High |

### sdlc-orchestration.md — 2 decision points

Orchestration rule định nghĩa cách spawn agent và xử lý kết quả. DONE_WITH_CONCERNS
và FAILED là 2 trạng thái mà "cứ proceed" hoặc "cứ escalate" đều có thể sai.

| # | Decision Point | Trigger | Phương thức | Ưu tiên |
|---|---|---|---|---|
| O1 | DONE_WITH_CONCERNS | Phase agent hoàn thành nhưng flag concerns | Skill | Medium |
| O2 | FAILED Phase | Phase agent fail — retry hay escalate? | Skill | Medium |

### sdlc-escalation.md — 1 decision point

Escalation chain đã có logic rõ ràng. Điểm cần thêm: verify escalation trigger
không phải false positive trước khi propose escalation.

| # | Decision Point | Trigger | Phương thức | Ưu tiên |
|---|---|---|---|---|
| S1 | Escalation Trigger Verification | Bất kỳ trigger nào bắn — verify không phải false positive | Skill | High |

---

## Phương pháp tích hợp

Mỗi rule file được thêm 1 section ngắn ở đầu (sau heading, trước nội dung chính):

```markdown
## Fable-Thinking Guards

Các decision points trong rule này được verify qua fable-thinking protocol
(`sdlc-fable-thinking-rules`). Nguyên tắc: Skill() cho quyết định không cần
tool verification; Agent() khi cần đọc file. **Không** auto-execute — human
luôn quyết định cuối cùng.

| Decision Point | Trigger | Method |
|---|---|---|
| ... | ... | Skill/Agent |
```

Và tại mỗi decision point trong body, thêm 1 dòng guard:
```
> **FT Guard:** [trigger] → `Skill("fable-thinking", "...")` / `Agent("sdlc-fable-thinking", ...)`
```

---

## Verification

### Manual test cases

| # | Rule | Input | Expected |
|---|---|---|---|
| 1 | routing | "sửa nhanh API login lỗi 500" | FT invoked → flow=fixbug, không phải quick |
| 2 | entry-gate | Foundation gate fail, flow=task, thiếu user-context.md | FT invoked → analyze impact → recommendation |
| 3 | pipeline | Gate fail SRS sau 3 retry | FT invoked → multi-hypothesis: skip/continue/abort |
| 4 | pipeline | TC-003 làm vỡ TC-001 | FT invoked → real interference hay test isolation issue? |
| 5 | orchestration | LLD agent DONE_WITH_CONCERNS về transaction boundary | FT invoked → severity: critical hay cosmetic? |

### Self-check
- [ ] Mỗi rule file có section "Fable-Thinking Guards" ở đầu
- [ ] Mỗi decision point có 1 dòng FT Guard inline
- [ ] Không phá vỡ procedure hiện tại (chỉ thêm guard)
- [ ] Method (Skill/Agent) phù hợp với tính chất quyết định
- [ ] Tất cả guard đều reference `sdlc-fable-thinking-rules`
- [ ] Fallback hoạt động nếu fable-thinking unavailable

---

## Phase 2.5 (2026-07-23) — 2 Rule Files Mới Từ Claudekit Reference

Sau khi tham khảo 7 rule files từ `/home/khuend/projects/AI/Kit/claudekit/.claude/rules/`,
phát hiện 2 khoảng trống trong toolkit cần tạo rule mới:

### Đã tạo

1. **`.claude/rules/sdlc-development-rules.md`** (2,337 bytes)
   - Dựa trên `development-rules.md` của claudekit
   - Áp dụng cho SDLC agents viết code: IMP, TDD-BE/FE, refactor
   - 5 sections: Baseline, Quality Gates, TDD Discipline, Spec Traceability, Tooling
   - Decision point: **Spec Deviation** — agent deviate từ spec là justified hay scope creep?

2. **`.claude/rules/sdlc-review-rules.md`** (2,791 bytes)
   - Dựa trên `review-audit-self-decision.md` của claudekit
   - Áp dụng cho gate agents + code review findings
   - 6 sections: Verified Decisions, Human Decisions, Threat Model, Gate Verdict Handling, Severity Classification, Scout-First, Stable Code Artifacts
   - Decision points: **Severity Classification** (phân loại đúng không?), **Audit vs Human Decision** (follow audit hay giữ human?)

### Đã sửa

3. **`.claude/rules/sdlc-orchestration.md`** — thêm section "Model Escalation"
   - Dựa trên `orchestration-protocol.md#model-escalation` của claudekit
   - Khi hard problem → spawn fable-thinking agent thay vì switch model

4. **`.claude/rules/sdlc-fable-thinking-rules.md`** — thêm 3 decision points + 2 rules vào cross-reference

5. **`CHANGELOG.md`** + **`.claude-plugin/plugin.json`** — version 2.24.0

### Không tạo (đã có coverage)

| Rule claudekit | Lý do |
|----------------|-------|
| `documentation-management.md` | Có `human-docs` skill + references |
| `skill-domain-routing.md` | Toolkit có skill catalog SDLC-specific riêng |
| `skill-workflow-routing.md` | `sdlc-routing.md` đã cover flow routing |
| `primary-workflow.md` | `sdlc-pipeline.md` + `sdlc-routing.md` đã cover SDLC workflow |

### FT Guards cho Phase 2.5

2 rule mới cần được thêm fable-thinking guards (3 decision points) — để dành cho
đợt tích hợp sau khi 5 rule files gốc đã có guards.

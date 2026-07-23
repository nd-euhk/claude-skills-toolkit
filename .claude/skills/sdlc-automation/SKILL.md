---
name: sdlc-automation
description: >-
  SDLC automation — điểm vào cho pipeline tự động hoàn toàn. Phỏng vấn human MỘT
  LẦN duy nhất, sau đó dispatch workflow script chạy autonomously toàn bộ pipeline
  SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST hoặc TDD cook cycle (baseline → per-TC
  RED→GREEN→ INTERFERENCE-LIGHT→REFACTOR-light → GATE-light+INTERFERENCE-FULL →
  REFACTOR-full → GATE-full). Dùng khi human muốn expedite SDLC không cần review từng
  phase: "tự động hoá task", "auto task", "chạy tự động", "automation pipeline",
  "autonomous SDLC", "tự động sinh specs", "auto pipeline", "tự động cook",
  "auto cook", "tự động code", "auto implement", "tự động triển khai code".
  Khác với sdlc-orchestrator (human-in-the-loop từng phase) và sdlc-quick
  (làn nhanh cho task nhỏ, không specs), skill này chỉ tương tác MỘT LẦN
  upfront rồi chạy autonomously.
version: 1.6.0
allowed-tools: Read, Write, Edit, Bash, Skill, Agent, AskUserQuestion, Workflow
---

# SDLC Automation

Điểm vào cho SDLC pipeline **tự động hoàn toàn**. Bạn phỏng vấn human **MỘT LẦN**
toàn diện, sau đó dispatch `workflow-sdlc-automation` chạy autonomously. Bạn
**không** tự thực thi specs/code — bạn grill, dispatch, và monitor.

| | sdlc-orchestrator | sdlc-automation | sdlc-quick |
|---|---|---|---|
| **Tương tác** | Từng phase (Plan → Review → Spawn) | Một lần upfront | **Triage grill (2-3 câu)** |
| **Pipeline** | Tuần tự với human gate | Autonomous qua workflow | **Không specs, chỉ guard test + GATE-light** |
| **TDD cycle** | Full (baseline → per-TC RED→GREEN→REFACTOR→GATE 2 lớp) | Full autonomous | **RED→GREEN (1 TC) + GATE-light** |
| **Phù hợp khi** | Cần review từng bước, domain mới | Đã rõ requirements, muốn expedite | **Task ≤1-2 file, không API/schema/security** |

---

## Hard Boundaries

- **Bạn grill, không thực thi** — không viết spec content, test cases, hoặc code
- **Grilling toàn diện bắt buộc** — không dispatch automation khi chưa đủ thông tin
- **Workflow script là executor** — pipeline chạy trong `.claude/workflows/automation/workflow-sdlc-automation.js`
- **Gate verification qua sdlc-gate** — mỗi phase agent viết spec xong, workflow spawn `sdlc-gate` (read-only, model: sonnet) để verify độc lập. Agent viết spec **không** tự chấm bài. Gate failure → retry với previousFailure context (max 2 attempts). Cross-cutting dùng một gate check tập trung sau khi tất cả agents hoàn thành.
- **Không skip pipeline phases** — SRS → HLD → LLD → [CROSS-CUTTING] → IMP∥TST. HLD, LLD, và CROSS-CUTTING có thể được skip với human confirmation
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--all")`. Chỉ được Write `agent_docs/README.md`
- **Không tự sửa feature specs** — chỉ sdlc-srs và sdlc-lld touch `agent_docs/features/`
- **Respect human decision** — nếu grilling kết luận automation không phù hợp, đề xuất `sdlc-orchestrator` hoặc `sdlc-quick` (nếu task nhỏ)
- **Fail-safe** — khi có lỗi không mong đợi, fallback về orchestrator. Xem `references/error-handling.md`
- **Fable-Thinking trước grilling exit** — sau các round grilling, nếu còn ≥2 câu chưa trả lời hoặc human trả lời không dứt khoát cho câu load-bearing, gọi `Skill("fable-thinking", "Automation grilling: đã thu thập <tóm tắt findings>. Còn thiếu: <danh sách gaps>. Options: grill thêm 1 round, dispatch workflow với context hiện có, hoặc fallback orchestrator. Goal: workflow có đủ input để chạy autonomously không lỗi.")`. **Không** dispatch nếu recommendation = insufficient
- **Fable-Thinking trước fail-safe** — khi workflow fail hoặc gate fail sau 2 retry, gọi `Skill("fable-thinking", "Automation fail-safe: <phase> thất bại sau <N> lần retry. Lỗi: <chi tiết>. Options: fallback orchestrator, skip phase này, hoặc abort. Goal: pipeline hoàn thành với chất lượng chấp nhận được.")` trước khi fallback

---

## Preflight (chạy mỗi lần invoke)

### Bước 1: Git State Check

```bash
git branch --show-current && git status --porcelain
```

Nếu dirty → `AskUserQuestion`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Working tree có uncommitted changes. Xử lý thế nào?",
    header: "Git",
    options: [
      { label: "Stash", description: "git stash — lưu tạm changes" },
      { label: "Commit", description: "Commit changes trước khi tiếp tục" },
      { label: "Tiếp tục", description: "Giữ nguyên dirty tree ⚠️ Có thể gây conflict" },
      { label: "Abort", description: "Dừng pipeline" }
    ],
    multiSelect: false
  }]
})
```

Nếu "Abort" → dừng, báo cáo git state. Xem `references/error-handling.md#e11`.

### Bước 2: Flow Detection

Dùng `AskUserQuestion` để xác định flow:

```javascript
AskUserQuestion({
  questions: [{
    question: "Flow SDLC nào phù hợp với yêu cầu này?",
    header: "Flow",
    options: [
      { label: "task", description: "Full spec pipeline: SRS → HLD → LLD → IMP∥TST. Cho feature mới hoặc thay đổi lớn." },
      { label: "cr", description: "Change request: impact analysis + re-spec có chọn lọc. Cho thay đổi nhỏ trên code hiện có." },
      { label: "cook", description: "TDD code execution: per-TC RED→GREEN→REFACTOR→GATE→review→push. Cho code từ ready specs." },
      { label: "Không phù hợp", description: "Chuyển sang sdlc-orchestrator (human-in-the-loop) hoặc sdlc-quick (task nhỏ)" }
    ],
    multiSelect: false
  }]
})
```

> **Keyword hint**: Nếu human input chứa "bug"/"lỗi"/"fix":
> 1. Gọi `Skill("fable-thinking", "Bug keyword detection: user said '<input>'. Câu hỏi: đây có thực sự là bug cần root cause analysis + fix + verify (flow=fixbug), hay false positive? Ví dụ false positive: 'fix config', 'sửa typo', 'sửa validation message'. Goal: phân loại đúng flow.")`
> 2. Nếu recommendation = genuine bug → escalate sang orchestrator với `flow=fixbug`, giải thích: fixbug yêu cầu human diagnosis judgment (stack trace analysis, root cause hypothesis, fix scope evaluation) — không thể autonomous
> 3. Nếu recommendation = false positive → route theo flow thực tế (dùng keyword hint bên dưới)
>
> **Các keyword hint khác:**
> "tự động"/"auto"/"spec" → mặc định task. "CR"/"change request"/"thay đổi" → cr.
> "cook"/"code"/"build"/"triển khai code"/"implement code" → cook.
> **"sửa nhanh"/"typo"/"config"/"minor"/"trivial"/"nhỏ" → gợi ý quick.**
> Nếu task rõ ràng ≤2 file và không API/schema/security → đề xuất quick thay vì automation.
>
> **Fable-Thinking Guard:** Khi flow selection không rõ ràng sau keyword hint (input khớp ≥2 flow, hoặc human chọn "Không phù hợp"), gọi `Skill("fable-thinking", "SDLC flow routing: user said '<input>'. Candidate flows: <danh sách flow khớp>. Conflict: <mâu thuẫn>. Goal: chọn flow phù hợp nhất.")` trước khi hiển thị `AskUserQuestion`. Dùng recommendation làm default suggestion.

### Bước 3: Foundation Gate

```bash
for f in project-overview.md user-context.md conventions.md; do
  test -f agent_docs/$f && echo "✅ $f" || echo "⚠️ MISSING: $f"
done
```

- **task flow**: `project-overview.md` + `user-context.md` PHẢI tồn tại
  - Thiếu → `Skill("sdlc-preflight")` → verify lại
  - Vẫn thiếu → **dừng pipeline** (xem `references/error-handling.md#e12`)
- **cr flow**: cảnh báo nếu thiếu, hỏi human trước khi invoke preflight
- **cook flow**: verify cook prerequisites — board status `ready`, feature specs, IMP + TST specs, hard-boundaries, tech-design. Thiếu specs → từ chối cook, đề xuất flow task.

Báo cáo: `🏗️ Foundation: [status từng file]`

---

## Task Automation Flow

Dành cho feature mới, greenfield work, hoặc major change. Full forward pipeline: SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST.

> **Chi tiết đầy đủ** (4 giai đoạn: grilling, scope, dispatch, monitor):
> → `references/task-flow.md`

**Tóm tắt quy trình:**

1. **Grilling Toàn Diện** — 4 rounds (Business → NFR → Architecture → Implementation), MỘT lần duy nhất
2. **Xác Nhận Scope** — chọn phase cần chạy dựa trên loại thay đổi, AskUserQuestion xác nhận
3. **Dispatch Workflow** — `workflow-sdlc-automation.js` với `flow: "task"`
4. **Monitor & Report** — workflow autonomously, báo cáo kết quả từng phase + gate status

Gate fail → workflow tự retry với previousFailure context (max 2 attempts). Nếu retry exhausted + gate vẫn fail: gọi `Skill("fable-thinking", "Automation fail-safe: <phase> gate fail sau 2 retry. Lỗi: <chi tiết>. Options: fallback orchestrator (human-in-the-loop review), skip phase (rủi ro chất lượng), hoặc abort (dừng pipeline). Goal: pipeline đạt chất lượng tối thiểu.")`. Trình bày recommendation cho human trước khi fallback. Xem `references/error-handling.md#e4`.

---

## CR Automation Flow

Dành cho change request trên code hiện có. Nhẹ hơn task flow — impact analysis + re-spec có chọn lọc.

> **Chi tiết đầy đủ** (5 giai đoạn, CR-specific patterns): → `references/cr-flow.md`

**Tóm tắt quy trình:**

1. **Xác định task bị ảnh hưởng** — đọc `.work/board.md`, route theo status
2. **Grilling CR** — tập trung vào delta (thay đổi gì, ảnh hưởng gì)
3. **Impact Analysis** — đọc `agent_docs/features/`, phân tích dependency
4. **Xác nhận scope** — AskUserQuestion, dispatch workflow với `flow: "cr"`
5. **Monitor** — như task flow

---

## Cook Automation Flow

Dành cho code execution từ ready specs. TDD cycle chạy autonomously qua workflow script với
baseline capture, INTERFERENCE-LIGHT (per-TC same-file), và INTERFERENCE-FULL (GATE light
cross-file baseline comparison).

> **Chi tiết đầy đủ** (baseline capture, per-TC orchestration, interference detection, gate strategy, error handling):
> → `references/cook-flow.md`

**Tóm tắt quy trình:**

1. **Readiness Check** — xác minh task status `ready`, specs đầy đủ (IMP + TST)
2. **Baseline Capture** — snapshot test suite pre-TDD qua `.claude/scripts/baseline` harness (cho INTERFERENCE detection)
3. **Grilling Cook** — xác nhận service, branch, dependencies, TC ordering
4. **Move to In Progress** — update board qua `Skill(sprint, "--board")`
5. **Dispatch TDD Workflow** — autonomous: baseline → per-TC RED→GREEN→INTERFERENCE-LIGHT→REFACTOR-light → GATE light+INTERFERENCE-FULL → REFACTOR full → GATE full
6. **Code Review** — `Skill(sdlc-review)` trên code mới
7. **Git Push** — `Skill(git)` commit + push
8. **Sprint Update** — move `in progress` → `in review` → `done`

### Dispatch Cook Workflow

> **Code block + args schema đầy đủ** (bao gồm baseline object) → `references/cook-flow.md#giai-đoạn-4-dispatch-tdd-workflow`.
> Dispatch fail → `references/error-handling.md#e3`.

### Monitor & Report

> **Chi tiết đầy đủ** (report template, interference handling, post-report actions):
> → `references/cook-flow.md#giai-đoạn-8-monitor--report`

**Tóm tắt:** Workflow chạy autonomously. Khi complete, báo cáo per-TC status (DONE/INTERFERENCE/SKIPPED), GATE light + GATE full results, code review findings, git status, sprint updates. INTERFERENCE → dừng pipeline, báo human. Gate fail → báo cáo phase + lý do.

---

## Error Handling

Mọi error scenario có structured fallback pattern. Nguyên tắc chung: **fail-safe — fallback về orchestrator, không tự retry mù quáng.**

| Category | Scenario | Handling |
|----------|----------|----------|
| Preflight | Git dirty → Abort | Dừng, báo cáo |
| Preflight | Foundation missing | Preflight → verify → dừng nếu vẫn thiếu |
| Grilling | Thiếu exit criteria | Hỏi thêm → fallback orchestrator sau 2 attempts |
| Dispatch | Script not found | Dừng, báo cáo missing dependency |
| Dispatch | Workflow timeout | AskUserQuestion: đợi/kill/fallback |
| Gates | ≥1 phase FAIL | Báo cáo + đề xuất orchestrator |
| Sprint | Update fails | Non-blocking — báo cáo, tiếp tục |

> **Danh sách đầy đủ** (5 categories, 12+ scenarios với response templates):
> → `references/error-handling.md`

---

## When NOT to Use Automation

Đề xuất `sdlc-orchestrator` hoặc `sdlc-quick` khi:

- **Requirements chưa rõ** — human không trả lời được câu hỏi grilling cốt lõi → orchestrator
- **Domain mới hoàn toàn** — chưa có project-overview, user-context → orchestrator
- **High-risk changes** — ảnh hưởng security, billing, data integrity → orchestrator
- **Team chưa quen SDLC** — cần human review để học quy trình → orchestrator
- **Human muốn review** — preference cá nhân → orchestrator
- **Task quá nhỏ (≤2 file, không API/schema/security)** — không cần full automation pipeline → **sdlc-quick**

Phát hiện tín hiệu trên trong grilling → dừng, đề xuất:

```
⚠️  Automation không được khuyến nghị: [lý do]
   Đề xuất: [/sdlc-orchestrator hoặc /sdlc-quick tùy theo scope].
   Bạn có muốn chuyển không?
```

---

## Reference Index

| File | Nội dung | Khi nào đọc |
|---|---|---|
| `references/grilling-templates.md` | 4 rounds câu hỏi, AskUserQuestion patterns, exit criteria | Trước và trong khi grilling |
| `references/task-flow.md` | Full task flow: 4 giai đoạn grilling, scope, dispatch, monitor | Khi flow = task |
| `references/cr-flow.md` | Full CR flow: 5 giai đoạn với impact analysis | Khi flow = cr |
| `references/cook-flow.md` | Full cook flow: readiness check, per-TC TDD orchestration, gate strategy, error handling | Khi flow = cook |
| `references/error-handling.md` | 5 categories error, 12+ scenarios với fallback patterns | Khi gặp lỗi, hoặc review error pattern |

**Workflow dependencies** (gọi qua `Workflow()` tool):

| Script | Dùng cho |
|---|---|
| `.claude/workflows/automation/workflow-sdlc-automation.js` | Pipeline executor cho task/CR flow |
| `.claude/workflows/automation/workflow-sdlc-cook.js` | TDD cycle executor cho cook flow |

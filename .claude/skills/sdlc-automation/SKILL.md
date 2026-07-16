---
name: sdlc-automation
description: >-
  SDLC automation — điểm vào cho pipeline tự động hoàn toàn. Phỏng vấn human MỘT
  LẦN duy nhất, sau đó dispatch workflow script chạy autonomously toàn bộ pipeline
  SRS → HLD → LLD → IMP∥TST hoặc TDD cook cycle (baseline → per-TC RED→GREEN→
  INTERFERENCE-LIGHT→REFACTOR-light → GATE-light+INTERFERENCE-FULL → REFACTOR-full
  → GATE-full). Dùng khi human muốn expedite SDLC không cần review từng phase:
  "tự động hoá task", "auto task", "chạy tự động", "automation pipeline",
  "autonomous SDLC", "tự động sinh specs", "auto pipeline", "tự động cook",
  "auto cook", "tự động code", "auto implement", "tự động triển khai code".
  Khác với sdlc-orchestrator (human-in-the-loop từng phase) và sdlc-quick
  (làn nhanh cho task nhỏ, không specs), skill này chỉ tương tác MỘT LẦN
  upfront rồi chạy autonomously.
version: 1.3.0
allowed-tools: Read, Write, Edit, Bash, Glob, Skill, Agent, AskUserQuestion, Workflow
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
- **Không skip pipeline phases** — SRS → HLD → LLD → IMP∥TST. HLD và LLD có thể được skip với human confirmation
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--all")`. Chỉ được Write `agent_docs/README.md`
- **Không tự sửa feature specs** — chỉ sdlc-srs và sdlc-lld touch `agent_docs/features/`
- **Respect human decision** — nếu grilling kết luận automation không phù hợp, đề xuất `sdlc-orchestrator` hoặc `sdlc-quick` (nếu task nhỏ)
- **Fail-safe** — khi có lỗi không mong đợi, fallback về orchestrator. Xem `references/error-handling.md`

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

> **Keyword hint**: Nếu human input chứa "bug"/"lỗi"/"fix" → gợi ý flow phù hợp trong câu hỏi.
> "tự động"/"auto"/"spec" → mặc định task. "CR"/"change request"/"thay đổi" → cr.
> "cook"/"code"/"build"/"triển khai code"/"implement code" → cook.
> **"sửa nhanh"/"typo"/"config"/"minor"/"trivial"/"nhỏ" → gợi ý quick.**
> Nếu task rõ ràng ≤2 file và không API/schema/security → đề xuất quick thay vì automation.

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

### 1. Grilling Toàn Diện (MỘT lần duy nhất)

Đây là **lần duy nhất** bạn tương tác với human. Phải cover đủ cho toàn bộ pipeline.

**4 rounds, hỏi tuần tự** — mỗi lần một câu, đợi trả lời rồi hỏi tiếp:

| Round | Nội dung | Cho phase |
|-------|----------|-----------|
| 1. Business Requirements | Tổng quan, users, user flows, AC, business rules, edge cases | SRS |
| 2. Non-Functional Reqs | Performance, availability, security, scale | SRS + HLD |
| 3. Architecture & Integration | Services, APIs, data, dependencies, deployment | HLD + LLD |
| 4. Implementation Context | Tech stack, tests, constraints, existing code | IMP + TST |

> **Chi tiết từng round** — câu hỏi mẫu, AskUserQuestion templates, exit criteria:
> → `references/grilling-templates.md`

> **Exit criteria đầy đủ** → `references/grilling-templates.md#grilling-exit-criteria-tổng-hợp`.
> Thiếu criteria → hỏi thêm. Không đủ sau 2 attempts → fallback (xem `references/error-handling.md#e21`).

### 2. Xác Nhận Automation Scope

Dựa trên grilling, xác định phase cần chạy:

| Thay đổi | Phase |
|---|---|
| Business requirements mới | SRS → HLD → LLD → IMP∥TST |
| Service/ADR/boundary mới | HLD → LLD → IMP∥TST |
| API contract hoặc domain model | LLD → IMP∥TST |
| Chỉ implementation detail | IMP∥TST |
| Chỉ test coverage | TST |

> **Không chạy phase không bị ảnh hưởng.**

Xác nhận với human:

```javascript
AskUserQuestion({
  questions: [{
    question: `Pipeline scope: [các phase]. Xác nhận chạy autonomously?`,
    header: "Scope",
    options: [
      { label: "Chạy automation", description: "Dispatch workflow, không cần review từng phase" },
      { label: "Chỉnh sửa scope", description: "Tôi muốn bỏ qua/thêm phase" },
      { label: "Chuyển orchestrator", description: "Dùng sdlc-orchestrator để review từng phase" }
    ],
    multiSelect: false
  }]
})
```

### 3. Dispatch Automation Workflow

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-automation.js",
  args: {
    flow: "task",
    featureName: "[từ grilling]",
    featureDescription: "[tóm tắt]",
    phases: ["SRS", "HLD", "LLD", "IMP", "TST"],  // chỉ phase được chọn
    requirements: {
      businessRequirements: "[từ Round 1]",
      nfrs: "[từ Round 2]",
      architecture: "[từ Round 3]",
      implementation: "[từ Round 4]"
    },
    repoPath: "[git root]",
    sprintUpdate: true
  }
})
```

Nếu dispatch fail → `references/error-handling.md#e3`

### 4. Monitor & Report

Workflow chạy autonomously. Khi complete, báo cáo:

```
🏁 Automation Pipeline hoàn thành — [feature name]
   ✅ SRS: [FR-IDs] — [file]
   ✅ HLD: [ADRs, diagrams] (nếu chạy)
   ✅ LLD: [work packages] (nếu chạy)
   ✅ IMP: [spec files]
   ✅ TST: [spec files]
   🚦 Gates: [PASS/FAIL] ([N]/[M] criteria met)
   ⚠️  Issues: [list hoặc "Không có"]
   📋 Sprint: [board/backlog updates]
   🔗 Next: flow cook để triển khai code
```

Gate fail → báo cáo phase nào fail + lý do + đề xuất orchestrator. Xem `references/error-handling.md#e4`.

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

Workflow chạy autonomously. Khi complete, báo cáo:

```
🏁 Cook Automation hoàn thành — [feature name]
   📊 Baseline: [N] tests captured (.work/baselines/YYYYMMDD-FR-{ID}-{BE|FE}.json)
   ✅ TC-1: DONE — [test name] (RED→GREEN→INTERFERENCE-LIGHT→REFACTOR-light)
   ⚠️ TC-2: INTERFERENCE — [broken test] (cùng file: TC broke another test)
   ⏭️ TC-3: SKIPPED — accidental green
   🚦 GATE light: PASS (4/4) + INTERFERENCE-FULL ✅ (no cross-file interference)
   🔧 REFACTOR full: [N] findings fixed, [M] flagged
   🚦 GATE full: PASS (10/10)
   👀 Code Review: [findings]
   📦 Git: [commit hash] (đã push / chưa push)
   📋 Sprint: [board updates]
   🔗 Next: [gợi ý]
```

INTERFERENCE-LIGHT phát hiện → dừng pipeline, báo human (revert culprit hoặc fix broken test).
GATE light L1i INTERFERENCE-FULL → dừng pipeline, báo cáo interference table.
Gate fail → workflow báo cáo phase nào fail + lý do. Xem `references/error-handling.md#e4`.

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
| `references/cr-flow.md` | Full CR flow: 5 giai đoạn với impact analysis | Khi flow = cr |
| `references/cook-flow.md` | Full cook flow: readiness check, per-TC TDD orchestration, gate strategy, error handling | Khi flow = cook |
| `references/error-handling.md` | 5 categories error, 12+ scenarios với fallback patterns | Khi gặp lỗi, hoặc review error pattern |

**Workflow dependencies** (gọi qua `Workflow()` tool):

| Script | Dùng cho |
|---|---|
| `.claude/workflows/automation/workflow-sdlc-automation.js` | Pipeline executor cho task/CR flow |
| `.claude/workflows/automation/workflow-sdlc-cook.js` | TDD cycle executor cho cook flow |

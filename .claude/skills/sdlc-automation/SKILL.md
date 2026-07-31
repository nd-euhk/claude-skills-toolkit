---
name: sdlc-automation
description: >-
  SDLC automation — điểm vào cho pipeline tự động hoàn toàn. Phỏng vấn human MỘT
  LẦN duy nhất, sau đó dispatch workflow script chạy autonomously toàn bộ pipeline
  SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST. Dùng khi human muốn expedite SDLC
  không cần review từng phase: "tự động hoá task", "auto task", "chạy tự động",
  "automation pipeline", "autonomous SDLC", "tự động sinh specs", "auto pipeline".
  Khác với sdlc-orchestrator (human-in-the-loop từng phase) và sdlc-quick
  (làn nhanh cho task nhỏ, không specs), skill này chỉ tương tác MỘT LẦN
  upfront rồi chạy autonomously.
version: 1.10.1
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
| **Phù hợp khi** | Cần review từng bước, domain mới | Đã rõ requirements, muốn expedite | **Task ≤1-2 file, không API/schema/security** |

---

## Hard Boundaries

- **Bạn grill, không thực thi** — không viết spec content, test cases, hoặc code
- **Grilling toàn diện bắt buộc** — không dispatch automation khi chưa đủ thông tin
- **Workflow script là executor** — pipeline chạy trong `.claude/workflows/automation/workflow-sdlc-automation.js`
- **Gate verification qua sdlc-gate** — mỗi phase agent viết spec xong, workflow spawn `sdlc-gate` (read-only, model: sonnet) để verify độc lập. Agent viết spec **không** tự chấm bài. Gate failure → retry với previousFailure context (max 3 attempts). Cross-cutting dùng một gate check tập trung sau khi tất cả agents hoàn thành.
- **Không skip pipeline phases** — SRS → HLD → LLD → [CROSS-CUTTING] → IMP∥TST. HLD, LLD, và CROSS-CUTTING có thể được skip với human confirmation
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--all")`. Chỉ được Write `agent_docs/README.md`
- **Không tự sửa feature specs** — chỉ sdlc-srs và sdlc-lld touch `agent_docs/features/`
- **Respect human decision** — nếu grilling kết luận automation không phù hợp, đề xuất `sdlc-orchestrator` hoặc `sdlc-quick` (nếu task nhỏ)
- **Fail-safe** — khi có lỗi không mong đợi, fallback về orchestrator. Xem `references/error-handling.md`
- **Advisor trước grilling exit** — sau các round grilling, nếu còn ≥2 câu chưa trả lời hoặc human trả lời không dứt khoát cho câu load-bearing, spawn `advisor` subagent với context: các câu chưa được trả lời, thông tin đã thu thập, options (grill thêm / dispatch ngay / fallback). Advisor đánh giá goal (workflow có đủ input để chạy autonomously), follow-through từng option, nêu rõ weakest link. **Không** dispatch nếu advisor kết luận insufficient
- **Advisor trước fail-safe** — khi workflow fail hoặc gate fail sau 2 retry, spawn `advisor` subagent với context: reason thất bại, retry history, options khả dĩ (fallback orchestrator / skip phase / abort). Advisor phân tích đa giả thuyết (tại sao fail? do spec yếu, do gate quá nghiêm ngặt, hay do lỗi thực sự?), follow-through từng option. Trình bày phân tích trước khi fallback

---

## Preflight (chạy mỗi lần invoke)

### Bước 1: Git State Check + Repo Root

```bash
git branch --show-current && git status --porcelain && git rev-parse --show-toplevel
```

Lưu output của `git rev-parse --show-toplevel` vào biến `repoRoot` — dùng để pass `repoPath` cho workflow dispatch.

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
      { label: "Không phù hợp", description: "Chuyển sang sdlc-orchestrator (human-in-the-loop) hoặc sdlc-quick (task nhỏ)" }
    ],
    multiSelect: false
  }]
})
```

> **Keyword hint**: Nếu human input chứa "bug"/"lỗi"/"fix":
> 1. Spawn `advisor` subagent với context: input chứa bug keyword, phân biệt genuine bug vs false positive ("fix config", "sửa typo", "sửa validation message"). Advisor kiểm tra goal (phân loại đúng flow), follow-through từng giả thuyết (genuine bug → cần root cause analysis; false positive → route theo flow thực tế)
> 2. Nếu advisor recommendation = genuine bug → escalate sang orchestrator với `flow=fixbug`, giải thích: fixbug yêu cầu human diagnosis judgment (stack trace analysis, root cause hypothesis, fix scope evaluation) — không thể autonomous
> 3. Nếu advisor recommendation = false positive → route theo flow thực tế (dùng keyword hint bên dưới)
>
> **Các keyword hint khác:**
> "tự động"/"auto"/"spec" → mặc định task. "CR"/"change request"/"thay đổi" → cr.
> **"sửa nhanh"/"typo"/"config"/"minor"/"trivial"/"nhỏ" → gợi ý quick.**
> Nếu task rõ ràng ≤2 file và không API/schema/security → đề xuất quick thay vì automation.
>
> **Advisor Guard:** Khi flow selection không rõ ràng sau keyword hint (input khớp ≥2 flow, hoặc human chọn "Không phù hợp"), spawn `advisor` subagent với context: input của human, keyword hint đã match, các flow đang khớp. Advisor giữ ≥2 flow khả dĩ, chọn observation để phân biệt, follow-through từng flow đến frame cuối (code hoạt động). Dùng kết quả recommendation làm default suggestion trong `AskUserQuestion`.

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

Gate fail → workflow tự retry với previousFailure context (max 3 attempts). Nếu retry exhausted + gate vẫn fail: spawn `advisor` subagent với context: reason thất bại sau retry, retry history, options (fallback orchestrator / skip phase / abort). Advisor phân tích đa giả thuyết, follow-through từng option, nêu weakest link. Trình bày phân tích cho human trước khi fallback. Xem `references/error-handling.md#e4`.

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

## Error Handling

Mọi error scenario có structured fallback pattern. Nguyên tắc chung: **fail-safe — fallback về orchestrator, không tự retry mù quáng.**

| Category | Scenario | Handling |
|----------|----------|----------|
| Preflight | Git dirty → Abort | Dừng, báo cáo |
| Preflight | Foundation missing | Preflight → verify → dừng nếu vẫn thiếu |
| Grilling | Thiếu exit criteria | Hỏi thêm → fallback orchestrator sau 2 attempts |
| Dispatch | Script not found | Dừng, báo cáo missing dependency |
| Dispatch | Workflow timeout | AskUserQuestion: đợi/kill-resume/fallback |
| Dispatch | Workflow crash | Resume qua `resumeFromRunId` / `resumeFrom` — xem error-handling.md |
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
| `references/error-handling.md` | 5 categories error, 12+ scenarios với fallback patterns | Khi gặp lỗi, hoặc review error pattern |

**Workflow dependencies** (gọi qua `Workflow()` tool):

| Script | Dùng cho |
|---|---|
| `.claude/workflows/automation/workflow-sdlc-automation.js` | Pipeline executor cho task/CR flow |

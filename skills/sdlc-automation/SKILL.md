---
name: sdlc-automation
description: >-
  SDLC automation — điểm vào cho pipeline tự động hoàn toàn sau khi thu thập
  đủ thông tin từ human qua grilling toàn diện. Khác với sdlc-orchestrator
  (human-in-the-loop ở từng phase), skill này phỏng vấn human MỘT LẦN duy nhất,
  sau đó dispatch workflow script chạy autonomously toàn bộ pipeline
  SRS → HLD → LLD → IMP∥TST. Dùng khi human muốn automation sau khi đã cung
  cấp đủ requirements: "tự động hoá task", "auto task", "chạy tự động",
  "automation pipeline", "autonomous SDLC", "full auto spec", "tự động sinh
  specs", "auto pipeline", hoặc khi human đã quen với quy trình SDLC và
  muốn expedite toàn bộ pipeline không cần review từng phase.
version: 1.0.0
allowed-tools: Read, Write, Edit, Bash, Glob, Skill, Agent, AskUserQuestion, Workflow
disable-model-invocation: false
---

# SDLC Automation

Bạn là điểm vào cho SDLC pipeline TỰ ĐỘNG HOÀN TOÀN. Khác với `sdlc-orchestrator`
(human-in-the-loop ở từng phase), bạn phỏng vấn human **MỘT LẦN** toàn diện,
sau đó dispatch workflow script chạy autonomously toàn bộ pipeline. Bạn **không**
tự thực thi specs/code — bạn grill, dispatch, và monitor.

Khi automation flow đã sẵn sàng, dispatch `workflow-sdlc-automation` tại
`.claude/workflows/workflow-sdlc-automation.js`.

So sánh với sdlc-orchestrator:

| Aspect | sdlc-orchestrator | sdlc-automation |
|---|---|---|
| Human interaction | Từng phase (Plan → Review → Spawn) | Một lần upfront (grilling toàn diện) |
| Pipeline execution | Tuần tự với human gate | Autonomous qua workflow script |
| Gate checks | Block sau mỗi phase | Collect + report cuối pipeline |
| Phù hợp khi | Human muốn review từng bước | Human muốn expedite, đã rõ requirements |

## Hard Boundaries

- **Bạn grill, không thực thi** — không viết spec content, test cases, hoặc code
- **Grilling toàn diện bắt buộc** — không dispatch automation khi chưa đủ thông tin
- **Workflow script là executor** — pipeline chạy trong `.claude/workflows/workflow-sdlc-automation.js`
- **Không skip pipeline phases** — SRS → HLD → LLD → IMP∥TST. HLD và LLD được optional với human confirmation trong grilling
- **Không tự sửa sprint files** — luôn qua `Skill(sprint)`. Chỉ được Write `agent_docs/README.md`
- **Không tự sửa feature specs** — chỉ sdlc-srs và sdlc-lld touch `agent_docs/features/`
- **Respect human decision** — nếu grilling kết luận automation không phù hợp, đề xuất chuyển sang `sdlc-orchestrator`

---

## Preflight (chạy mỗi lần invoke)

### Bước 1: Kiểm tra Git

1. `git branch --show-current` — xác nhận branch đang active
2. `git status --porcelain` — kiểm tra dirty state
3. Nếu dirty, dùng `AskUserQuestion`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Working tree đang có uncommitted changes. Bạn muốn xử lý thế nào?",
    header: "Git State",
    options: [
      { label: "Stash", description: "git stash — lưu tạm changes và tiếp tục" },
      { label: "Commit", description: "Commit changes trước khi tiếp tục pipeline" },
      { label: "Tiếp tục", description: "Giữ nguyên dirty working tree ⚠️ Cảnh báo: có thể gây conflict" },
      { label: "Abort", description: "Dừng pipeline — để tôi xử lý git state thủ công" }
    ],
    multiSelect: false
  }]
})
```

### Bước 2: Phát hiện Flow

Parse input của human. Match keywords theo thứ tự ưu tiên — **first match wins**:

| Keywords | Flow | Priority |
|---|---|---|
| "bug", "lỗi", "fix", "sửa lỗi", "debug", "exception", "crash" | **fixbug** | 1 (cao nhất) |
| "CR", "change request", "thay đổi", "sửa yêu cầu" | **cr** | 2 |
| "code", "cook", "build", "triển khai code" | **cook** | 3 |
| "task", "triển khai", "làm task", "implement", "spec", "tài liệu", "SRS", "HLD", "LLD", "tự động", "auto" | **task** | 4 (default) |

> **⚠️ Keyword Overlap Rule:** Match cụm dài nhất trước. "triển khai **code**" → cook. "**fix bug**" → fixbug (priority 1 thắng). "**tự động** hoá task" → task.

**Quyết định:**
- Intent rõ ràng → thông báo flow, xin xác nhận nhanh
- Ambiguous → `AskUserQuestion`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Flow SDLC nào sẽ xử lý yêu cầu này?",
    header: "Flow",
    options: [
      { label: "task (automation)", description: "Full spec pipeline tự động từ SRS đến IMP∥TST. Phỏng vấn upfront rồi chạy autonomously." },
      { label: "cr (automation)", description: "Change request tự động — impact analysis + optional re-spec autonomously." },
      { label: "Không phù hợp automation", description: "Chuyển sang sdlc-orchestrator để có human-in-the-loop từng phase." }
    ],
    multiSelect: false
  }]
})
```

### Bước 3: Foundation Gate

Kiểm tra file nền tảng trong `agent_docs/`:

```bash
for f in project-overview.md user-context.md conventions.md; do
  test -f agent_docs/$f && echo "  ✅ $f" || echo "  ⚠️ MISSING: $f"
done
```

**task flow** — `project-overview.md` và `user-context.md` PHẢI tồn tại:
1. Kiểm tra file thiếu → `Skill("sdlc-preflight", NEEDED)` nếu cần
2. Post-preflight verify — nếu file vẫn missing → **dừng pipeline**
3. Báo cáo: "🏗️ Foundation: project-overview.md ✅ | user-context.md ✅ | conventions.md ✅"

**cr flow** — cảnh báo nếu thiếu, hỏi human trước khi invoke preflight.

---

## Automation Flow: task

### Giai đoạn 1: Grilling Toàn Diện

Đây là **lần duy nhất** bạn tương tác với human. Phải cover MỌI thứ cần cho toàn bộ pipeline. Dùng `Skill(grilling)`.

#### Round 1: Business Requirements (cho SRS)

Hỏi tuần tự, mỗi lần một câu:

1. **Tổng quan**: "Tính năng này làm gì? Giải quyết vấn đề gì cho ai?"
2. **Users & Personas**: "Những ai sẽ dùng? Có những role nào? Mỗi role có quyền gì?"
3. **User Flows**: "Luồng chính xác thế nào? Có những happy path và alternative path nào?"
4. **Acceptance Criteria**: "Làm sao biết feature đã hoàn thành? Tiêu chí cụ thể?"
5. **Business Rules**: "Có những quy tắc nghiệp vụ nào? Validation rules? Constraints?"
6. **Edge Cases**: "Trường hợp đặc biệt? Input không hợp lệ? Timeout? Concurrent users?"

#### Round 2: Non-Functional Requirements (cho SRS + HLD)

1. **Performance**: "p95 latency target? Throughput (RPS)? Concurrent users tối đa?"
2. **Availability**: "Uptime yêu cầu (99.X%)? RTO/RPO nếu có disaster?"
3. **Security**: "AuthZ model? Data classification? Compliance requirements (GDPR, PCI)?"
4. **Scale**: "Data volume? Growth rate? Peak traffic patterns?"

#### Round 3: Architecture & Integration (cho HLD + LLD)

1. **Services**: "Có service mới không? Service nào bị ảnh hưởng? Giao tiếp giữa chúng?"
2. **APIs**: "API contracts mới? Thay đổi API hiện có? Versioning strategy?"
3. **Data**: "Schema mới/thay đổi? Migration cần thiết? Loại database?"
4. **External Dependencies**: "Third-party services? Message queues? Caches?"
5. **Deployment**: "Infrastructure thay đổi? Environment variables mới? Feature flags?"

#### Round 4: Implementation Context (cho IMP + TST)

1. **Tech Stack**: "Backend framework? Frontend framework? Đã có convention chưa?"
2. **Test Requirements**: "Coverage target? Loại tests cần (unit, integration, E2E)?"
3. **Constraints**: "Deadline? Team size? Dependency giữa các task khác?"
4. **Existing Code**: "Có code hiện có cần refactor không? File nào bị ảnh hưởng?"

#### Grilling Exit Criteria

Trước khi proceed, xác nhận đã có đủ:

- [ ] Ít nhất 3 business requirements rõ ràng
- [ ] Ít nhất 1 user flow với các bước cụ thể
- [ ] Performance targets định lượng (p95 < Xms)
- [ ] Service/API inventory (mới + affected)
- [ ] Data requirements (schema + migration)
- [ ] Test coverage expectations

Nếu thiếu bất kỳ criteria nào → hỏi thêm. **Không proceed khi chưa đủ.**

### Giai đoạn 2: Xác Nhận Automation Scope

Dựa trên grilling, xác định phase cần chạy:

| Thay đổi | Phase cần chạy |
|---|---|
| Business requirements mới | SRS → HLD → LLD → IMP∥TST |
| Service/ADR/boundary mới | HLD → LLD → IMP∥TST |
| API contract hoặc domain model thay đổi | LLD → IMP∥TST |
| Chỉ implementation detail | IMP∥TST |
| Chỉ test coverage | TST |

**Không chạy phase không bị ảnh hưởng.** Xác nhận scope với human:

```javascript
AskUserQuestion({
  questions: [{
    question: "Pipeline scope dựa trên phân tích yêu cầu. Xác nhận để chạy autonomously?",
    header: "Scope",
    options: [
      { label: "Chạy automation", description: `Dispatch workflow: [các phase đã chọn]. Không cần review từng phase.` },
      { label: "Chỉnh sửa scope", description: "Tôi muốn bỏ qua/thêm phase trước khi chạy" },
      { label: "Chuyển sang orchestrator", description: "Dùng sdlc-orchestrator để review từng phase" }
    ],
    multiSelect: false
  }]
})
```

### Giai đoạn 3: Dispatch Automation Workflow

Khi human xác nhận "Chạy automation", dispatch workflow script:

```javascript
Workflow({
  scriptPath: ".claude/workflows/workflow-sdlc-automation.js",
  args: {
    flow: "task",
    featureName: "[từ grilling]",
    featureDescription: "[tóm tắt từ grilling]",
    phases: ["SRS", "HLD", "LLD", "IMP", "TST"],  // chỉ phase được chọn
    requirements: {
      businessRequirements: "[từ grilling Round 1]",
      nfrs: "[từ grilling Round 2]",
      architecture: "[từ grilling Round 3]",
      implementation: "[từ grilling Round 4]"
    },
    repoPath: "[git root]",
    sprintUpdate: true
  }
})
```

Workflow chạy autonomously — mỗi phase spawn subagent, verify gate, proceed không cần human.

### Giai đoạn 4: Monitor & Report

Khi workflow đang chạy:

1. **Theo dõi progress** — workflow tự log milestones qua `log()`
2. **Không interrupt** — workflow không dừng giữa chừng để hỏi human
3. **Khi workflow complete** — đọc kết quả, báo cáo:

```
🏁 Automation Pipeline hoàn thành — [feature name]
   ✅ SRS: [FR-IDs] — [file]
   ✅ HLD: [ADRs, diagrams] (nếu chạy)
   ✅ LLD: [work packages] (nếu chạy)
   ✅ IMP: [spec files]
   ✅ TST: [spec files]
   🚦 Gates: [PASS/FAIL] ([N]/[M] criteria met tổng cộng)
   ⚠️  Issues: [list hoặc "Không có"]
   📋 Sprint: [board/backlog updates]
   🔗 Next step: flow cook để triển khai code
```

Nếu gate fail ở bất kỳ phase nào:
- Báo cáo phase nào fail, lý do
- Đề xuất: "Chuyển sang sdlc-orchestrator để xử lý phase [X] với human review?"
- **Không tự retry** nếu không có human approval

---

## Automation Flow: cr

### Giai đoạn 1: Xác Định Task Bị Ảnh Hưởng

1. Parse human input → xác định task(s)
2. Đọc `.work/board.md` → tìm task
3. Route theo status:

| Status | Hành động |
|---|---|
| **TODO / ready** | "Task chưa code → đây là cập nhật yêu cầu. Chạy automation task flow." |
| **in progress / review / done** | CR thực sự → tiếp tục grilling |

### Giai đoạn 2: Grilling Toàn Diện (rút gọn)

Invoke `Skill(grilling)`, tập trung vào:
- Thay đổi chính xác những gì? Tại sao?
- Phạm vi: services, APIs, features bị ảnh hưởng
- Architecture impact? (cần HLD?)
- Service internals impact? (cần LLD?)
- Downstream impacts: features khác, integrations
- Risk level và urgency

### Giai đoạn 3: Impact Analysis (Tự Động)

Dựa trên grilling + codebase analysis:

1. Đọc `agent_docs/features/README.md` — dependency graph
2. Đọc affected `agent_docs/features/FR-*.md`
3. Đọc `agent_docs/domain-service-mapping.yaml` nếu có
4. Báo cáo: "CR này ảnh hưởng: [FRs, services, APIs]. Phase cần chạy lại: [list]."

### Giai đoạn 4: Xác Nhận & Dispatch

Như task flow — xác nhận scope, dispatch `workflow-sdlc-automation` với `flow: "cr"`.

---

## Skill & Agent Reference

### Skills

| Skill | Mục đích |
|---|---|
| `grilling` | Phỏng vấn toàn diện upfront — MỘT lần duy nhất |
| `sdlc-preflight` | Khởi tạo foundation files |
| `sprint` | Cập nhật board, backlog, roadmap sau automation |

### Subagents (spawn bởi workflow script)

| Agent | Phase | Mục đích |
|---|---|---|
| `sdlc-srs` | SRS | Functional + non-functional requirements |
| `sdlc-hld` | HLD (opt) | Architecture, ADRs, service boundaries |
| `sdlc-lld` | LLD (opt) | Per-service tech design, API contracts |
| `sdlc-imp` | IMP | Backend + frontend implementation specs |
| `sdlc-tst` | TST | Backend + frontend test specifications |

### Workflow Script

| File | Mục đích |
|---|---|
| `.claude/workflows/workflow-sdlc-automation.js` | Pipeline executor autonomously |

---

## When NOT to Use Automation

Đề xuất chuyển sang `sdlc-orchestrator` khi:

- **Requirements chưa rõ ràng** — human chưa trả lời được các câu hỏi grilling cốt lõi
- **Domain mới hoàn toàn** — chưa có project-overview, user-context
- **High-risk changes** — ảnh hưởng đến security, billing, data integrity
- **Team chưa quen SDLC** — cần human review để học quy trình
- **Human muốn review** — preference cá nhân, không phải technical constraint

Nếu phát hiện các tín hiệu trên trong quá trình grilling → dừng, đề xuất:

```
⚠️  Automation không được khuyến nghị: [lý do cụ thể]
   Đề xuất: Chuyển sang /sdlc-orchestrator để có human-in-the-loop từng phase.
   Bạn có muốn chuyển không?
```

---

## References

Tất cả prompt templates, gate criteria, và error handling đều nằm inline trong
`.claude/workflows/workflow-sdlc-automation.js` — workflow script tự chứa mọi
thứ cần để chạy autonomously. Không cần load thêm file ngoài.

| File | Nội dung | Khi nào đọc |
|---|---|---|
| `.claude/workflows/workflow-sdlc-automation.js` | Toàn bộ pipeline executor: prompt builders, GATE_CRITERIA constants, phase runner với retry, gate parser, report builder | Khi cần debug workflow, cập nhật prompts, hoặc thay đổi gate criteria |

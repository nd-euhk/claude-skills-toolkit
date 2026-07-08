# Cook (TDD Code Execution) Automation Flow

Flow tự động hóa code execution từ ready specs qua TDD cycle. Nhẹ hơn orchestrator cook flow — grilling rút gọn, autonomous TDD execution qua workflow script.

---

## Giai đoạn 1: Readiness Check

### 1.1 Xác minh Board Status

1. Đọc `.work/board.md` và `.work/backlog.md`
2. Tìm task human muốn cook (match theo feature name, FR-ID, hoặc keyword)
3. Route theo status:

| Status | Hành động |
|---|---|
| **ready** | Tiếp tục Giai đoạn 2 |
| **TODO** | Từ chối: "Task chưa có specs đầy đủ. Chạy automation task flow trước." |
| **in progress** | Cảnh báo: "Task đang được triển khai. Tiếp tục cook hay spawn thêm?" |
| **review** | Cảnh báo: "Task đang review. Chạy cook lại từ đầu hay chỉ fix review findings?" |
| **done** | Cảnh báo: "Task đã done. Nếu là bug → dùng sdlc-orchestrator fixbug flow." |
| **Không tìm thấy** | Từ chối: "Task không tồn tại trên board." |

### 1.2 Verify Specs Tồn Tại

```bash
FR_ID="<FR-ID từ human input hoặc board>"

# Feature spec
test -f agent_docs/features/$FR_ID.md && echo "✅ $FR_ID feature spec" || echo "⚠️ MISSING: $FR_ID"

# IMP specs (backend và/hoặc frontend)
for spec in implementation test-specs; do
  for dir in agent_docs/backend/*/ agent_docs/frontend/*/; do
    test -f ${dir}${spec}/${FR_ID}-*.md 2>/dev/null && echo "✅ ${dir}${spec}/${FR_ID}" || true
  done
done

# Hard-boundaries và tech-design
test -f agent_docs/hard-boundaries.md && echo "✅ hard-boundaries.md" || echo "⚠️ MISSING"
ls agent_docs/tech-design/*-service.md 2>/dev/null && echo "✅ tech-design" || echo "⚠️ No tech-design"
```

**Thiếu IMP hoặc TST specs** → từ chối cook:

```
🛑 Không thể cook — thiếu specs:
   ⚠️  [danh sách file thiếu]
   Đề xuất: Chạy automation task flow để tạo specs trước, hoặc dùng
   sdlc-orchestrator task flow để có human review từng phase.
```

---

## Giai đoạn 2: Grilling Cook (rút gọn)

Chỉ tập trung vào **execution context** — không cần business requirements (đã có trong specs).

### 2.1 Service & Branch

> "Service nào cần build? Backend, frontend, hay cả hai? Branch để làm việc?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Xác nhận service(s) và branch để cook:",
    header: "Target",
    options: [
      { label: "Backend trước", description: "Build backend APIs trước, frontend sau" },
      { label: "Frontend trước", description: "Build frontend trước, mock APIs" },
      { label: "Cả hai song song", description: "Backend + Frontend đồng thời (độc lập)" },
      { label: "Custom", description: "Tự chọn service và branch cụ thể" }
    ],
    multiSelect: false
  }]
})
```

### 2.2 Dependencies

> "Tất cả dependent tasks đã done chưa? Có blocked bởi team khác không?"

### 2.3 TC Ordering

> "Các test cases có phụ thuộc lẫn nhau không? Có TC nào cần TC khác chạy trước không?"

**Automation luôn chạy tuần tự.** Mỗi TC build trên code của TC trước — đây là nguyên tắc TDD cốt lõi. Không hỏi human về parallel/hybrid vì:

- Automation không có human-in-the-loop để verify "TCs thực sự độc lập"
- Chạy song song per-TC → mỗi RED agent không thấy code changes từ TC trước → conflict, mất context
- Nếu human muốn song song (TCs độc lập đã xác nhận) → dùng `sdlc-orchestrator cook flow`

Hỏi để xác nhận dependency order:

```javascript
AskUserQuestion({
  questions: [{
    question: "Thứ tự ưu tiên cho các test cases?",
    header: "TC Order",
    options: [
      { label: "Theo risk (CRITICAL→HIGH→MEDIUM→LOW)", description: "TC nguy cơ cao chạy trước — an toàn nhất" },
      { label: "Theo layer (unit→integration→e2e)", description: "Test nhỏ chạy trước, build dần lên integration" },
      { label: "Custom order", description: "Tôi muốn chỉ định thứ tự cụ thể" }
    ],
    multiSelect: false
  }]
})
```

### 2.4 Auto-push Preference

> "Cho phép auto-push sau khi tất cả gates pass? Hay cần human review trước khi push?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Git push strategy sau khi code xong?",
    header: "Push",
    options: [
      { label: "Manual push", description: "Dừng trước push — tôi muốn review code trước khi push" },
      { label: "Auto push (khuyến nghị)", description: "Tự động commit + push sau khi tất cả gates + review pass" }
    ],
    multiSelect: false
  }]
})
```

### Cook Grilling Exit Criteria

Trước khi proceed, xác nhận đã có:
- [ ] Service(s) và branch đã xác nhận
- [ ] Dependencies đã resolved (không blocked)
- [ ] TC order đã xác nhận (mặc định risk-priority: CRITICAL → HIGH → MEDIUM → LOW)
- [ ] Push preference đã xác nhận

---

## Giai đoạn 3: Move Task sang In Progress

Update board + backlog qua `Skill(sprint, "--board --backlog")`:

```
Board: move [FR-ID] từ "ready" → "in progress"
Backlog: update [FR-ID] status → "in progress"
```

Báo cáo: `📋 Task [FR-ID] → in progress`

---

## Giai đoạn 4: Dispatch TDD Workflow

### 4.1 Trích xuất Test Cases

Đọc TST spec để trích xuất danh sách test cases cho workflow:

```bash
# Backend
cat agent_docs/backend/{service}/test-specs/{FR-ID}-test.md

# Frontend
cat agent_docs/frontend/{app}/test-specs/{FR-ID}-test.md
```

Parse để lấy: TC ID, tên, layer (unit/integration/e2e), risk (CRITICAL|HIGH|MEDIUM|LOW).

### 4.2 Dispatch Workflow Script

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-cook.js",
  args: {
    flow: "cook",
    featureName: "[từ grilling]",
    frId: "[FR-ID]",
    service: "[service name từ agent_docs/]",
    layer: "[backend|frontend|both]",
    testCases: [
      { id: "TC-1", name: "[test case name]", layer: "unit", risk: "CRITICAL" },
      { id: "TC-2", name: "[test case name]", layer: "integration", risk: "HIGH" },
      // ... tất cả TCs từ TST spec — chạy tuần tự theo thứ tự này
    ],
    agents: {                                // optional — nếu không có, workflow suy diễn từ layer
      red: "sdlc-tdd-be-red",               // hoặc sdlc-tdd-fe-red cho frontend
      green: "sdlc-tdd-be-green",           // hoặc sdlc-tdd-fe-green
      refactor: "sdlc-tdd-be-refactor",     // hoặc sdlc-tdd-fe-refactor
      gate: "sdlc-tdd-be-gate",             // hoặc sdlc-tdd-fe-gate
    },
    repoPath: "[git root]",
    sprintUpdate: true,
    autoReview: true,
    autoPush: false       // true nếu human chọn auto push
  }
})
```

Workflow script xử lý autonomously toàn bộ TDD cycle — orchestrator chỉ monitor.

### 4.3 Workflow Structure (bên trong script)

```
┌─ TC-1 (sdlc-tdd-be-red — mini-orchestrator) ────────────────┐
│  ├─ Write test → Verify RED → Accidental green?              │
│  ├─ Spawn sdlc-tdd-be-green (implement tối thiểu)            │
│  └─ Spawn sdlc-tdd-be-refactor --mode=light (cleanup)        │
└──────────────────────────────────────────────────────────────┘
┌─ TC-2 ... TC-N ─────────────────────────────────────────────┐
│  ...tương tự...                                              │
└──────────────────────────────────────────────────────────────┘
┌─ GATE Light ────────────────────────────────────────────────┐
│  sdlc-tdd-be-gate --mode=light (L1-L4: 4 critical checks)   │
└──────────────────────────────────────────────────────────────┘
┌─ REFACTOR Full ─────────────────────────────────────────────┐
│  sdlc-tdd-be-refactor --mode=full (6 categories + framework) │
└──────────────────────────────────────────────────────────────┘
┌─ GATE Full ─────────────────────────────────────────────────┐
│  sdlc-tdd-be-gate --mode=full (all 10 gates)                │
└──────────────────────────────────────────────────────────────┘
┌─ Code Review ───────────────────────────────────────────────┐
│  Skill(sdlc-review) --code + --full                         │
└──────────────────────────────────────────────────────────────┘
┌─ Git Push ──────────────────────────────────────────────────┐
│  Skill(git) commit + push                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Giai đoạn 5: Code Review

Sau khi workflow báo cáo tất cả gates pass:

1. Invoke `Skill(sdlc-review)` trên code mới
2. Dùng `--code` mode để review against IMP và TST specs
3. Nếu auto review pass → tiếp tục
4. Nếu tìm thấy issues → spawn fix agents, lặp đến khi pass

---

## Giai đoạn 6: Git Push

1. Invoke `Skill(git)` để commit và push
2. Commit message format: `feat({FR-ID}): {feature name}` với body liệt kê TCs
3. Nếu `autoPush: false` → dừng, báo cho human review manual

---

## Giai đoạn 7: Sprint Update

Qua `Skill(sprint, "--all")`:

```
Board: move [FR-ID] từ "in progress" → "in review" → "done"
Backlog: update [FR-ID] status → "done"
Roadmap: cập nhật feature progress
README: cập nhật agent_docs/README.md routing table
```

---

## Cook-specific Error Handling

| Tình huống | Hành động |
|---|---|
| RED returns BLOCKED (3 sabotage attempts) | Dừng TDD cycle. Báo cáo human: TC nào, lý do. Đề xuất manual check. |
| RED returns STALE (ambiguous spec) | Dừng TC đó. Báo cáo human. Option: skip TC, tiếp tục TCs khác. |
| GREEN returns STUCK (5 iterations) | Dừng TC đó. Báo cáo: test nào fail, hypothesis. |
| GATE light FAIL | Báo cáo failures. Workflow tự spawn fix → retry GATE (max 2 lần). Nếu vẫn fail → dừng, báo human. |
| GATE full FAIL | Tương tự GATE light: fix → retry (max 2). Fail → dừng. |
| REFACTOR gây test failure | Workflow script tự undo + báo cáo. Orchestrator verify tests pass. |
| Subagent crash / timeout | Báo cáo human. Option: retry (max 2), skip, hoặc abort pipeline. |
| Specs thiếu → không thể cook | Từ chối cook. Đề xuất chạy automation task flow. |
| Board status không phải ready | Route theo bảng readiness check (Giai đoạn 1). |

---

## When NOT to Automate Cook

Đề xuất `sdlc-orchestrator cook flow` khi:

- **Specs chưa rõ ràng** — IMP hoặc TST specs có ambiguity, thiếu test cases cụ thể
- **High-risk code** — ảnh hưởng security, billing, data integrity, cần human review từng TC
- **New tech stack** — chưa có conventions.md, chưa có code mẫu để tham chiếu
- **Complex dependencies** — TCs có dependency phức tạp, cần human quyết định ordering
- **Team mới** — developers chưa quen TDD cycle, cần human-in-the-loop để học
- **Human muốn review** — preference cá nhân, muốn xem từng bước

Phát hiện tín hiệu trên trong grilling → dừng, đề xuất:

```
⚠️  Cook automation không được khuyến nghị: [lý do]
   Đề xuất: Chuyển sang /sdlc-orchestrator cook flow.
   Bạn có muốn chuyển không?
```

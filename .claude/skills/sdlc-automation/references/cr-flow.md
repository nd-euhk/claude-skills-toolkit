# CR (Change Request) Automation Flow

Flow xử lý change request tự động. Nhẹ hơn task flow — tập trung vào impact analysis
và re-spec có chọn lọc thay vì full pipeline.

---

## Giai đoạn 1: Xác Định Task Bị Ảnh Hưởng

1. Parse human input → xác định task(s) liên quan
2. Đọc `.work/board.md` → tìm task trong sprint board
3. Route theo status:

| Status | Hành động |
|---|---|
| **TODO / ready** | "Task chưa code → đây là cập nhật yêu cầu. Chuyển sang automation task flow." |
| **in progress** | CR thực sự — code đang được viết, cần impact analysis |
| **review / done** | CR thực sự — code đã hoàn thành, cần careful impact analysis |

## Giai đoạn 2: Grilling CR (rút gọn)

Chỉ tập trung vào **delta** — cái gì thay đổi so với hiện tại. Invoke `Skill(grilling)`.

> Nếu CR phức tạp (ảnh hưởng ≥3 services hoặc có architecture change), tham khảo thêm
> `references/grilling-templates.md` để có AskUserQuestion templates chuẩn (Round 3
> cho architecture, Round 4 cho implementation context).

1. **Thay đổi chính xác**: "Thay đổi cái gì? Tại sao cần thay đổi? Urgency?"
2. **Phạm vi ảnh hưởng**: "Services, APIs, features nào bị ảnh hưởng?"
3. **Architecture impact**: "Có thay đổi architecture không? Service boundaries? Data flow?"
4. **Implementation impact**: "Code nào cần sửa? File nào bị ảnh hưởng?"
5. **Downstream impacts**: "Features khác có bị ảnh hưởng không? Integrations?"
6. **Risk level**: "Rủi ro cao nhất nếu CR này fail là gì?"

## Giai đoạn 3: Impact Analysis (Tự Động)

Dựa trên grilling + codebase analysis:

1. Đọc `agent_docs/features/README.md` → dependency graph giữa các features
2. Đọc affected `agent_docs/features/FR-*.md` → hiểu scope hiện tại
3. Đọc `agent_docs/domain-service-mapping.yaml` (nếu có) → service impact
4. Phân tích và báo cáo:

```
📊 CR Impact Analysis — [CR title]
   Affected FRs: [FR-001, FR-003]
   Affected Services: [user-service, notification-service]
   Affected APIs: [GET /users, POST /notifications]
   Data Impact: [schema change: users table + migration]
   Phase cần chạy lại: [list dựa trên impact]
   Risk: [low / medium / high]
```

## Giai đoạn 4: Xác Nhận Scope

```javascript
AskUserQuestion({
  questions: [{
    question: "Pipeline scope cho CR này. Xác nhận để chạy autonomously?",
    header: "CR Scope",
    options: [
      { label: "Chạy automation", description: `Dispatch workflow: [phases]. Chạy autonomously không cần review.` },
      { label: "Chỉnh sửa scope", description: "Tôi muốn bỏ qua hoặc thêm phase trước khi chạy" },
      { label: "Chuyển sang orchestrator", description: "Dùng sdlc-orchestrator để review từng phase" },
      { label: "Manual fix", description: "Tôi sẽ tự sửa — không cần automation" }
    ],
    multiSelect: false
  }]
})
```

## Giai đoạn 5: Dispatch

**Trước khi dispatch, resolve `repoPath`:**
```bash
git rev-parse --show-toplevel
```
Lưu output vào biến `repoRoot` và pass vào args bên dưới.

Dispatch workflow script với `flow: "cr"`:

```javascript
Workflow({
  scriptPath: ".claude/workflows/automation/workflow-sdlc-automation.js",
  args: {
    flow: "cr",
    crTitle: "[từ grilling]",
    affectedFRs: ["FR-001", "FR-003"],
    changeDescription: "[tóm tắt thay đổi]",
    phases: ["SRS", "CROSS-CUTTING", "IMP", "TST"],  // chỉ phase bị ảnh hưởng
    crossCutting: {
      errorHandling: true|false,        // CR thay đổi error flows?
      cachingStrategy: true|false,      // CR thay đổi cache behavior?
      performanceTest: true|false,      // CR ảnh hưởng NFR targets?
      frontendArchitecture: true|false, // CR thay đổi frontend patterns?
      frontendTestStrategy: true|false, // CR ảnh hưởng test strategy?
    },
    requirements: {
      delta: "[thay đổi chính xác từ grilling]",
      impact: "[impact analysis results]"
    },
    repoPath: repoRoot,   // output của git rev-parse --show-toplevel
    sprintUpdate: true
  }
})
```

## CR-specific Considerations

- **Không chạy phase không bị ảnh hưởng** — CR thường chỉ cần SRS delta + IMP delta
- **HLD/LLD chỉ chạy nếu architecture thay đổi** — new service, new API contract, schema migration
- **CROSS-CUTTING chạy nếu cross-cutting standards bị ảnh hưởng** — thay đổi error flows, cache strategy, frontend patterns, hoặc NFR targets
- **TST luôn chạy nếu IMP chạy** — test specs phải reflect CR changes
- **Impact report là critical artifact** — nó quyết định scope của toàn bộ pipeline

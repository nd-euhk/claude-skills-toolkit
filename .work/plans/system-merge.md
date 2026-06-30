# System-Wide Merge — Workflow + Skill Integration

## Context

`workflow-sdlc-explore-pipeline.js` xử lý **1 service mỗi lần**, chỉ ghi output per-service (`FR-*.md`, `tech-design.md`, `FR-*-impl.md`, `FR-*-test.md`) và notes vào `.work/system-wide-notes/{service}.md`. Các system-wide docs (C4, hard-boundaries, coding-conventions, global-error-codes, cross-cutting-patterns, ADRs, events, apis) **không được tạo** trong per-service workflow — chúng cần tổng hợp từ tất cả service.

**Mục tiêu:** Tạo workflow riêng `workflow-sdlc-system-merge.js` chạy **sau khi tất cả service đã explore xong**, đọc tất cả per-service outputs + notes → sinh toàn bộ system-wide docs. Tích hợp trigger vào `sdlc-explore` skill Phase 6.

## Thiết kế tổng thể

### 1. Tích hợp vào sdlc-explore Skill

**Phase 6 hiện tại:**
```
Rebuild nextActions → nếu rỗng → "Tất cả service đã được explore. Hoàn tất!"
                   → nếu không rỗng → AskUserQuestion chọn service tiếp theo
```

**Phase 6 mới:**
```
Rebuild nextActions →

  Nếu nextActions KHÔNG rỗng:
    AskUserQuestion: "Chọn service tiếp theo:" (header: "Next Service")
      Options: danh sách service todo + "Dừng ở đây"
      + "🔄 Chạy System-Wide Merge" (nếu ≥1 service đã explore-done)

  Nếu nextActions RỖNG:
    → "✅ Tất cả service đã được explore."
    AskUserQuestion: "Hoàn tất!" (header: "All Explored")
      - "Chạy System-Wide Merge (Recommended)"
      - "Sync service đã explore"
      - "Dừng ở đây"
```

**Khi human chọn System-Wide Merge → Phase 7:**
```
Phase 7: System-Wide Merge
  1. Thu thập services đã explore-done từ state.projects
  2. mkdir -p các thư mục system-wide
  3. Prepare mergeArgs → Workflow({ scriptPath: "workflows/workflow-sdlc-system-merge.js", args: mergeArgs })
  4. Process results → updateAfterSystemMerge(state, result)
  5. Hiển thị summary → quay lại AskUserQuestion chọn action tiếp
```

### 2. Workflow: `workflow-sdlc-system-merge.js`

#### Pipeline 6 Phase

```
Phase 0: Collect (1 Explore agent)
  Đọc TẤT CẢ notes + tech-design + FRs từ tất cả service
  → structured summary JSON: { globalPatterns, allErrorCodes, allEvents[],
    allADRCandidates[], allExternalDeps[], serviceTopology[] }
      │
Phase 1: C4 ∥ Coding Conventions ∥ Global Error Codes (barrier — 3 agents song song)
  ├── C4 (general-purpose) — topology + bounded contexts từ summary
  ├── Coding Conventions (general-purpose) — patterns từ tech-design + notes
  └── Global Error Codes (general-purpose) — merge + dedup error codes từ notes + FRs
      │  barrier: đợi C4 xong
Phase 2: Hard Boundaries ∥ Cross-cutting Patterns (barrier — 2 agents song song)
  ├── hard-boundaries (general-purpose) — cần C4 + summary
  └── cross-cutting-patterns (general-purpose) — cần C4 + summary + tech-design
      │  barrier
Phase 3: Events ∥ APIs (2 pipelines song song trong 1 parallel)
  ├── pipeline per event   → events/evt-{name}.yaml
  └── pipeline per service → apis/{service}-api.yaml
      │  barrier
Phase 4: ADRs (pipeline per ADR candidate, có thể skip nếu 0 candidates)
  pipeline per ADR candidate → ADRs/ADR-{NNN}--{slug}.md
      │  barrier
Phase 5: Final Gate (1 gate-verifier agent)
  Verify consistency: events match APIs, error codes nhất quán, C4 khớp tech-design
```

#### Phân tích song song hóa

| Phase | Parallelism | Lý do |
|-------|------------|-------|
| 0 | 1 agent | Cần tổng hợp trước khi rẽ nhánh |
| 1 | **∥ 3 agents** | C4, Coding, Error Codes **độc lập hoàn toàn** — không ai cần output của ai |
| 2 | **∥ 2 agents** | Hard Boundaries + Cross-cutting đều cần C4 (từ Phase 1) nhưng **độc lập với nhau** |
| 3 | **∥ 2 pipelines** | Events pipeline và APIs pipeline **khác loại output**, không liên quan. Bên trong mỗi pipeline: mỗi event/service độc lập → `pipeline()` cho per-item streaming |
| 4 | **pipeline** | Mỗi ADR độc lập, cần C4 context (từ Phase 1). Pipeline cho phép ADR-001 generate trong khi ADR-002 vẫn chạy |
| 5 | 1 agent | Final consistency check cần tất cả output |

#### Edge Cases

| Case | Xử lý |
|------|-------|
| Không có ADR candidates | Skip Phase 4, Phase 5 vẫn chạy |
| Không có events | Skip events pipeline trong Phase 3 |
| Chỉ 1 service | Bình thường — C4 vẽ 1 service, APIs 1 file |
| 0 FRs toàn hệ thống | Warning, dùng tech-design làm input chính |
| Notes file thiếu cho 1 service | Warning, dùng tech-design + FRs của service đó |
| C4 gate fail | Retry x2 → vẫn fail → return `{ phase: 'C4', error: '...' }` |
| File system-wide đã tồn tại | Preflight check → skip hoặc merge (không overwrite mù) |
| fromPhase='Events+APIs' | Phase 0-2 skip, bắt đầu từ Phase 3 |

#### Workflow Args

```js
{
  projectName,     // string — từ state.projectName
  slug,            // string — từ state.slug
  language,        // 'vi' | 'en'
  runDate,         // string YYYYMMDD
  services,        // string[] — danh sách service đã explore-done
  fromPhase,       // string | null — optional force-start
}
```

#### Workflow Return Structure

```js
// Success
{
  completed: ['Collect', 'C4', 'Coding-Conventions', 'Global-Error-Codes',
              'Hard-Boundaries', 'Cross-Cutting', 'Events', 'APIs', 'ADRs', 'Gate'],
  results: {
    c4: { passed: true },
    codingConventions: { passed: true },
    globalErrorCodes: { passed: true, totalCodes: 42 },
    hardBoundaries: { passed: true },
    crossCutting: { passed: true },
    events: { total: 5, generated: 5 },
    apis: { total: 3, generated: 3 },
    adrs: { total: 2, generated: 2 },
    gate: { passed: true }
  }
}

// Partial failure (gate fail sau retry)
{
  phase: 'C4',
  error: 'Gate failed after 2 retries',
  feedback: 'Missing bounded context mapping for payment-service...',
  completed: ['Collect']
}
```

#### State Update sau Merge

```js
function updateAfterSystemMerge(state, mergeResult) {
  const now = new Date().toISOString()

  state.systemMerge = {
    done: true,
    lastMergeAt: now,
    services: mergeResult.services,
    results: mergeResult.results
  }
  state.updatedAt = now
  state.history.push({
    action: 'system-merge',
    projects: mergeResult.services,
    timestamp: now,
    status: 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

State schema mở rộng thêm `systemMerge` field:
```json
{
  "systemMerge": {
    "done": false,
    "lastMergeAt": null,
    "services": [],
    "results": null
  }
}
```

### 3. Files cần tạo/sửa

#### Tạo mới

| File | Mô tả |
|------|-------|
| `workflows/workflow-sdlc-system-merge.js` | Workflow 6 phase |
| `.agents/workflows/workflow-sdlc-system-merge.js` | Mirror |

#### Sửa

| File | Thay đổi |
|------|---------|
| `skills/sdlc-explore/SKILL.md` | Phase 6: thêm option System-Wide Merge. Thêm Phase 7: System-Wide Merge execution |
| `skills/sdlc-explore/references/state-management.md` | Thêm `systemMerge` vào schema + `updateAfterSystemMerge()` |
| `skills/sdlc-explore/references/workflow-handoff.md` | Thêm section System-Wide Merge handoff |

### 4. Code Patterns (từ workflow-knowledge)

- **Safe-parse args**: `const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})`
- **Template literals**: Tất cả prompt string dùng backtick, không dùng `+ "\n" +`
- **Preflight check**: 1 Explore agent check tất cả output → skip phase đã có
- **Gate-gated**: Mỗi phase có gate check với retry (x2 cho C4, x1 cho còn lại)
- **Idempotent**: Chạy lại → phases đã có output auto-skip
- **fromPhase**: Hỗ trợ resume từ phase bất kỳ sau khi sửa lỗi

### 5. Verification

1. **Workflow chạy lần đầu** → tất cả system-wide files được tạo đúng vị trí
2. **Preflight idempotent** → chạy lần 2, tất cả phase skip
3. **Missing notes fallback** → xóa 1 notes file, workflow dùng tech-design + FRs
4. **Single service** → `services: ["auth-service"]`, C4 1 service, APIs 1 file
5. **No ADRs** → Phase 4 skip, Phase 5 vẫn chạy
6. **Gate failure** → C4 gate fail → retry x2 → return error phase='C4'
7. **fromPhase resume** → merge fail ở Phase 3 → sửa → chạy lại `fromPhase: 'Events+APIs'` → skip 0-2
8. **Skill integration** → explore service cuối cùng → AskUserQuestion hiện "System-Wide Merge (Recommended)" → chọn → workflow chạy → state cập nhật

# Sprint Artifacts Deep Evaluation — Roadmap, Backlog, Board

**Date**: 2026-07-20
**Scope**: Đánh giá toàn diện 3 sprint template + subagent + skill, trong bối cảnh agentic AI SDLC pipeline
**Context**: Phân tích dựa trên orchestrator flows (task, cook, fixbug), agent_docs/ structure, và cách các template được tiêu thụ thực tế

---

## I. Đặt Vấn Đề: Roadmap Trong Thời Đại Agentic AI

### Roadmap truyền thống phục vụ 3 nhóm:
| Người dùng | Nhu cầu | Tính chất |
|-----------|---------|-----------|
| Stakeholders / Leadership | Timeline cam kết, quản lý kỳ vọng | Chính trị + truyền thông |
| Team (dev, QA, design) | Biết làm gì trước/sau, dependency | Điều phối + alignment |
| PO/AM/BA | Công cụ đàm phán scope, trade-off | Ra quyết định |

### Agentic AI cần roadmap — nhưng khác hẳn:

**Agent KHÔNG cần:**
- Alignment meetings, stakeholder communication
- Kỳ vọng mềm ("aim to deliver by Q3")
- Motivation / vision inspiration

**Agent CẦN:**
- Decision-making framework — tự quyết trade-off không cần hỏi
- Hard constraints — cái gì là bất biến
- Sequencing logic — WHY thứ này trước thứ kia
- Context window cho autonomous decisions

**Kết luận**: Roadmap cho agent không phải presentation artifact — nó là **execution context artifact**. Gần với "Project Execution Context" hơn là roadmap truyền thống.

---

## II. Dòng Chảy Dữ Liệu Sprint Trong SDLC Pipeline

```
sdlc-orchestrator
├── flow-task:
│   ├── B1: Đọc board (verify task status: TODO/ready/in-progress/...)
│   ├── B2-B4: SRS→HLD→LLD→IMP∥TST pipeline
│   └── B5: Skill(sprint, "--all") → board: TODO→ready, backlog: update FR, roadmap: update milestone
│
├── flow-cook:
│   ├── B1: Đọc board + backlog (verify ready status)
│   ├── B3: Skill(sprint, "--board --backlog") → board: ready→in-progress
│   ├── B4: TDD cycle (RED→GREEN→REFACTOR-light → GATE-light → REFACTOR-full → GATE-full)
│   └── B7: Skill(sprint, "--board --backlog") → board: in-progress→review→done, backlog→done, roadmap: feature progress
│
├── flow-fixbug:
│   └── Đọc board (impact assessment)
│
└── flow-cr:
    └── Impact analysis → optional re-spec → sprint update
```

**Phát hiện**: Roadmap được update cuối mỗi flow, nhưng không có feedback loop ngược — nếu cook phát hiện epic mất nhiều thời gian hơn dự kiến, roadmap không tự điều chỉnh timeline.

---

## III. Đánh Giá Từng Template

### A. Roadmap (`sprint/roadmap-TEMPLATE.md`)

#### Điểm mạnh:
| Section | Lý do |
|---------|-------|
| Core Tech Stack & Global Constraints | Agent instructions dạng hard rules — phần quan trọng nhất |
| Feature → Phase Mapping | Traceability backbone, khớp orchestrator expectation |
| Epics với Success Metrics | Metrics định lượng — agent biết "done" là gì |
| Rollback Plan | Plan B cho agent |
| Dependencies Between Phases | Critical path visualization |

#### Khoảng trống:

1. **Thiếu Decision Principles** — Agent không biết ưu tiên cái gì khi trade-off
   - Cần thêm: Security > Performance, Data Integrity > Availability, Ship > Perfect, User-facing > Internal

2. **Thiếu Autonomous Decision Boundaries** — Agent không biết giới hạn quyền tự quyết
   - Cần matrix: Decision Type → Agent Authority → Requires Human

3. **Rollback Plan thiếu trigger conditions** — Agent cần biết KHI NÀO scenario xảy ra + LÀM SAO phát hiện
   - Hiện tại: Scenario → Impact → Action → SLA
   - Cần thêm: Trigger Condition → Detection Method

4. **Thiếu Agent Feedback Loop** — Không có kênh agent đề xuất thay đổi roadmap
   - Cần thêm: Proposed Changes section (agent → đề xuất → chờ human approve)

5. **Timeline dates (MM/YYYY) không tối ưu cho agent** — Agent cần sequencing logic + exit criteria hơn là calendar dates
   - Thay vì: `| Phase 1 | MVP | 08/2026 |`
   - Nên thêm: `| Depends On | Blocks | Exit Criteria |`

### B. Backlog (`sprint/backlog-TEMPLATE.md`)

#### Điểm mạnh:
| Section | Lý do |
|---------|-------|
| Priority Summary | MoSCoW counts cho agent biết bức tranh tổng |
| Feature Summary | Status counts cho progress tracking |
| Must/Should combined table | Tiết kiệm không gian, phân biệt qua cột Priority |
| Feature → Epic Mapping | Traceability ngược lên roadmap |
| CR Impact Tracking | Tách change request khỏi feature |

#### Khoảng trống:

6. **Ready-for-Dev gate có trong agent procedure nhưng KHÔNG có trong template**
   - Agent procedure Step 6 định nghĩa 5 điều kiện (SRS, HLD, LLD, IMP, TST + dependencies resolved)
   - Template chỉ có cột Status (Todo/In Progress/Done/Blocked) — không hiển thị gate progress
   - Cần: cột "Specs Ready" với 5 checkmarks hoặc visual indicator

7. **Không có dependency visualization** — Agent procedure Step 3 resolve dependencies, template không có chỗ hiển thị
   - Cần: cột `Depends On` trong Must/Should table

8. **Không có within-priority ordering** — 5 feature cùng là Must, agent không biết feature nào trước
   - Cần: cột Priority Order (#) hoặc implicit row order

9. **CR Impact Tracking quá đơn giản** — Thiếu severity, affected specs, tasks cần rework

### C. Board (`sprint/board-TEMPLATE.md`)

#### Điểm mạnh:
| Section | Lý do |
|---------|-------|
| Task ID format (FR-{DOM}-{NNN}-T{N}) | Unique identification, traceable về FR spec |
| WIP limits | Ngăn agent overload cột |
| Blocked Items Detail | Reason + unblock criteria cụ thể |
| Task Summary | Bird's-eye sprint health |

#### Khoảng trống:

10. **Không có velocity tracking** — Board là nơi tracking execution nhưng không compute velocity
    - Cần: Sprint Velocity Summary (SP committed/completed + trend)

11. **Không có Definition of Done** — Sprint Goal tồn tại nhưng không có DoD checklist
    - Cần: DoD section (code reviewed, tests pass, feature flag, IMP/TST updated)

12. **Active Backlog Features có thể stale** — Mirror data từ backlog, không có cơ chế verify sync

---

## IV. Vấn Đề Xuyên Suốt (Cross-Cutting)

### 13. Status Model Không Nhất Quán
```
Roadmap:  🔲 Todo → 🚧 In Progress → ✅ Done → ⛔ Blocked (+ 🟢 Ready ở Feature→Phase)
Backlog:  🔲 Todo → 🚧 In Progress → ✅ Done → ⛔ Blocked (KHÔNG có Ready)
Board:    🔲 Todo → 🟢 Ready → 🚧 In Progress → 👀 In Review → ✅ Done → ⛔ Blocked
```
Vấn đề: Backlog không có 🟢 Ready → agent không biết feature nào "sẵn sàng cho sprint" nếu không đọc agent procedure.

### 14. Orchestrator Không Verify Consistency Sau Sprint Update
Orchestrator gọi `Skill(sprint, "--all")` nhưng:
- Không verify 3 agent sync đúng với nhau
- Không check roadmap.feature→phase.status == backlog.feature.status
- README routing table là file thứ 4 orchestrator tự Write, không có template riêng

### 15. Thiếu Agent Decision Context
Khi agent đọc bất kỳ sprint file nào, không biết:
- "Tao được phép quyết định gì?"
- "Nếu phát hiện vấn đề X, escalation path là gì?"
- "Điều gì là bất biến và điều gì có thể thương lượng?"

Hard Boundaries chỉ nói về file ownership, không nói về decision authority.

### 16. `agt/roadmap-TEMPLATE.md` — Bản Sao Ma
File 229 dòng với cấu trúc hoàn toàn khác:
- Timeline ASCII art
- Per-phase task tables (gộp chức năng roadmap + board → vi phạm separation of concerns)
- Project Operations (O.N tasks)
- Không agent nào tham chiếu (đã sửa ở session trước)

**Cần xóa hoặc deprecated.**

---

## V. Cấu Trúc `agent_docs/` Toàn Cảnh

### Cây thư mục đầy đủ (từ agent-routing-TEMPLATE.md):

```
agent_docs/
├── README.md                         ← Orchestrator tự Write (inline template trong procedures.md)
├── hard-boundaries.md                ← Có template (hld/hard-boundaries-TEMPLATE.md)
├── conventions.md                    ← Có template (supporting/conventions-TEMPLATE.md)
├── project-overview.md               ← Có template (supporting/project-overview-TEMPLATE.md)
├── architecture.md                   ← Có template (hld/architecture-TEMPLATE.md)
├── user-context.md                   ← Có template (supporting/user-context-TEMPLATE.md)
├── roadmap.md                        ← Có template (sprint/roadmap-TEMPLATE.md) ⚠️ + bản ma agt/
├── service-feature-matrix.md         ← Có template (supporting/service-feature-matrix-TEMPLATE.md)
│
├── features/
│   ├── README.md                     ← Có template (agt/feature-index-TEMPLATE.md)
│   └── FR-{DOM}-{NNN}--{slug}.md    ← Có template (srs/FR-TEMPLATE.md)
│
├── adrs/
│   └── ADR-{NNN}--{slug}.md         ← Có template (hld/ADR-TEMPLATE.md)
│
├── contracts/
│   ├── api-{domain}.yaml            ← Không có template
│   ├── events.md                    ← Có template (contracts/events-TEMPLATE.md)
│   └── error-codes.md               ← Có template (contracts/error-codes-TEMPLATE.md)
│
├── tech-design/
│   └── {svc}-service.md             ← Có template (lld/lld-TEMPLATE.md)
│
├── backend/{svc}/
│   ├── implementation/FR-{ID}-impl.md ← Có template (impl/impl-spec-backend-TEMPLATE.md)
│   └── test-specs/FR-{ID}-test.md     ← Có template (tst/test-spec-backend-TEMPLATE.md)
│
├── frontend/{app}/
│   ├── implementation/FR-{ID}-impl.md ← Có template (impl/impl-spec-frontend-TEMPLATE.md)
│   └── test-specs/FR-{ID}-test.md     ← Có template (tst/test-spec-frontend-TEMPLATE.md)
│
├── traceability/
│   └── requirements-matrix.md       ← Có template (srs/requirements-matrix-TEMPLATE.md)
│
├── performance/                     ← KHÔNG có template
├── operations/                      ← KHÔNG có template
└── (cross-cutting files không có template)
    ├── error-handling.md
    ├── caching-strategy.md
    ├── frontend-architecture.md
    ├── scale-strategy.md
    ├── performance-test.md
    ├── frontend-test-strategy.md
    └── db-operations.md
```

### Khoảng trống template cho cross-cutting files:
Các file được reference trong agent-routing nhưng **không có template**:
- `error-handling.md` — Agent phải tự nghĩ cấu trúc
- `caching-strategy.md` — Agent phải tự nghĩ cấu trúc
- `frontend-architecture.md` — Agent phải tự nghĩ cấu trúc
- `db-operations.md` — Agent phải tự nghĩ cấu trúc
- `operations/monitoring-spec.md` — Agent phải tự nghĩ cấu trúc
- `README.md` (agent_docs/) — Orchestrator dùng inline template, không có file riêng

---

## VI. Cross-Reference Chain Hiện Tại

```
project-overview.md
  referenced_by: architecture.md
  ⚠️ architecture.md depends_on project-overview nhưng project-overview không declare

user-context.md
  referenced_by: agent-routing.md

conventions.md
  depends_on: hard-boundaries.md
  referenced_by: README.md
  ⚠️ hard-boundaries.md không declare conventions.md trong referenced_by

architecture.md
  depends_on: project-overview.md
  referenced_by: tech-design/*.md, hard-boundaries.md, contracts/api-*.yaml

hard-boundaries.md
  referenced_by: README.md, conventions.md

features/README.md
  referenced_by: ../roadmap.md

roadmap.md
  depends_on: architecture.md
  referenced_by: ../.work/backlog.md, ../.work/board.md

backlog.md
  depends_on: ../agent_docs/roadmap.md
  referenced_by: board.md

board.md
  depends_on: backlog.md, ../agent_docs/roadmap.md
  referenced_by: []
```

**Vấn đề**: Cross-reference không bidirectional. Khi human/agent update một file, không biết file nào cần update theo.

---

## VII. Đề Xuất Hành Động

### Nhóm 1: Trước mắt (low-effort, high-impact)

| # | Hành động | File ảnh hưởng |
|---|----------|---------------|
| 1 | **Xóa hoặc deprecated `agt/roadmap-TEMPLATE.md`** | `templates/agt/roadmap-TEMPLATE.md` |
| 2 | **Thêm cột `Depends On` vào backlog Must/Should table** | `templates/sprint/backlog-TEMPLATE.md` + `agents/sdlc/sdlc-sprint-backlog.md` |
| 3 | **Thêm cột `Ready Gate` vào backlog** (SRS/HLD/LLD/IMP/TST checkmarks) | `templates/sprint/backlog-TEMPLATE.md` + `agents/sdlc/sdlc-sprint-backlog.md` |
| 4 | **Thêm `Definition of Done` vào board** | `templates/sprint/board-TEMPLATE.md` + `agents/sdlc/sdlc-sprint-board.md` |
| 5 | **Thêm `Trigger Condition` + `Detection` vào Rollback Plan** | `templates/sprint/roadmap-TEMPLATE.md` + `agents/sdlc/sdlc-sprint-roadmap.md` |

### Nhóm 2: Trung hạn (cần thiết kế thêm)

| # | Hành động | File ảnh hưởng |
|---|----------|---------------|
| 6 | **Thêm `Decision Principles` vào roadmap** (4-6 nguyên tắc ưu tiên khi trade-off) | `templates/sprint/roadmap-TEMPLATE.md` + agent |
| 7 | **Thêm `Decision Authority` matrix vào roadmap** | `templates/sprint/roadmap-TEMPLATE.md` + agent |
| 8 | **Thêm `Agent Feedback` section vào roadmap** (kênh agent đề xuất thay đổi) | `templates/sprint/roadmap-TEMPLATE.md` + agent |
| 9 | **Thêm `Sprint Velocity` vào board** (SP committed/completed + trend) | `templates/sprint/board-TEMPLATE.md` + agent |
| 10 | **Thay thế MM/YYYY dates bằng sequencing logic** (depends_on/blocks/exit_criteria trong phase table) | `templates/sprint/roadmap-TEMPLATE.md` + agent |
| 11 | **Thêm within-priority ordering vào backlog** (cột # hoặc implicit row order) | `templates/sprint/backlog-TEMPLATE.md` + agent |
| 12 | **Mở rộng CR Impact Tracking** (severity, affected specs, rework tasks) | `templates/sprint/backlog-TEMPLATE.md` + agent |

### Nhóm 3: Dài hạn (tái cấu trúc)

| # | Hành động |
|---|----------|
| 13 | **Unify status model** — Roadmap + Backlog + Board dùng chung status lifecycle |
| 14 | **Roadmap → Project Execution Context** — Đổi tên + mở rộng (Decision Principles, Authority, Agent Feedback) |
| 15 | **Cross-artifact consistency check** — Orchestrator verify sau mỗi `Skill(sprint)` |
| 16 | **Bidirectional cross-reference** — Sửa tất cả frontmatter `depends_on`/`referenced_by` cho bidirectional |
| 17 | **Template cho cross-cutting files** — error-handling.md, caching-strategy.md, frontend-architecture.md, db-operations.md |
| 18 | **Template riêng cho `agent_docs/README.md`** — thay vì inline trong procedures.md |
| 19 | **Dọn thư mục `templates/agt/`** — Phân loại rõ: cái nào cho dự án output, cái nào cho toolkit, cái nào deprecated |

---

## VIII. Phụ Lục: File Đã Đọc

| File | Dòng | Vai trò |
|------|------|---------|
| `.claude/templates/sprint/roadmap-TEMPLATE.md` | 115 | Sprint roadmap template (đang dùng) |
| `.claude/templates/sprint/backlog-TEMPLATE.md` | 72 | Sprint backlog template |
| `.claude/templates/sprint/board-TEMPLATE.md` | 61 | Sprint board template |
| `.claude/templates/agt/roadmap-TEMPLATE.md` | 229 | Bản sao ma — không ai dùng |
| `.claude/agents/sdlc/sdlc-sprint-roadmap.md` | 133 | Roadmap agent procedure |
| `.claude/agents/sdlc/sdlc-sprint-backlog.md` | 128 | Backlog agent procedure |
| `.claude/agents/sdlc/sdlc-sprint-board.md` | 154 | Board agent procedure |
| `.claude/skills/sprint/SKILL.md` | 274 | Sprint routing skill |
| `.claude/skills/sdlc-orchestrator/SKILL.md` | 315 | Orchestrator main skill |
| `.claude/skills/sdlc-orchestrator/references/flow-task.md` | 196 | Task flow procedure |
| `.claude/skills/sdlc-orchestrator/references/flow-cook.md` | 441 | Cook/TDD flow procedure |
| `.claude/skills/sdlc-orchestrator/references/procedures.md` | 480 | Shared procedures + gate criteria |
| `.claude/skills/sdlc-preflight/SKILL.md` | 195 | Foundation files creation |
| `.claude/templates/supporting/project-overview-TEMPLATE.md` | 69 | Foundation template |
| `.claude/templates/supporting/user-context-TEMPLATE.md` | 54 | Foundation template |
| `.claude/templates/supporting/conventions-TEMPLATE.md` | 176 | Foundation template |
| `.claude/templates/supporting/service-feature-matrix-TEMPLATE.md` | 106 | LLD output template |
| `.claude/templates/agt/agent-routing-TEMPLATE.md` | 100 | Agent reading order + file map |
| `.claude/templates/agt/feature-index-TEMPLATE.md` | 74 | Features README template |
| `.claude/templates/agt/AGENTS-TEMPLATE.md` | 386 | Project AGENTS.md template |
| `.claude/templates/hld/architecture-TEMPLATE.md` | 199 | Architecture template |
| `.claude/templates/hld/hard-boundaries-TEMPLATE.md` | 144 | Hard boundaries template |
| `.claude/templates/srs/requirements-matrix-TEMPLATE.md` | 120 | Traceability matrix template |

---

*Report này tổng hợp toàn bộ phân tích trong session 2026-07-20. Dùng làm reference cho lần implement tiếp theo.*

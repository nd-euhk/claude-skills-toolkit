---
name: sdlc-explore
description: >-
  Reverse-engineer source code thành tài liệu SDLC đầy đủ, khớp 100% chuẩn output của sdlc orchestrator.
  Dùng khi: "explore codebase", "khám phá codebase", "reverse engineer", "reverse engineering",
  "phân tích mã nguồn", "phân tích dự án", "tạo tài liệu từ code", "generate SDLC artifacts from code",
  "explore service", "explore architecture", "sync documents", "cập nhật tài liệu".
  Mỗi lần xử lý 1 service. State lưu tại knowledge/explore.json. Có human-in-the-loop ở plan và sync.
  Output vào knowledge/ theo đúng chuẩn sdlc (FR-{EPIC}-{NNN}--{slug}.md, C4-context-diagram.md, v.v.).
argument-hint: "[full|architect|sync] [--lang vi|en] [--en]"
version: 3.1.0
allowed-tools: Read, Write, Bash(*), AskUserQuestion, Agent, Workflow, EnterPlanMode, ExitPlanMode, Skill, WebFetch, WebSearch
---

# SDLC Explore — Reverse-Engineer Code → SDLC Artifacts

Reverse-engineer codebase thành tài liệu SDLC khớp 100% chuẩn của `sdlc` orchestrator. Output là input hoàn chỉnh cho các flow forward-engineering tiếp theo (task, fixbug, cr, contract, compliance).

## Nguyên tắc cốt lõi

- **Mỗi lần 1 service.** State lưu tại `knowledge/explore.json` — single source of truth. Ghi ngay sau mỗi thay đổi.
- **Human-in-the-loop bắt buộc.** Plan (Phase 3) luôn cần human confirm. Sync mode luôn cần human chọn phases. Không có `--auto`.
- **Output khớp sdlc 100%.** Mọi file tạo ra theo đúng chuẩn `sdlc` orchestrator. Chi tiết: `references/output-standard.md`.
- **EPIC từ plan, không từ code.** EPIC code cho FR naming lấy từ Phase 3 plan (human-confirmed), không tự suy đoán.
- **Scout delegation.** Phase 2 delegate toàn bộ cho `Skill(sdlc-scout, ...)`.
- **Workflow delegation.** Phase 4 là single `Workflow()` call. KHÔNG tự spawn SDLC agents.
- **Language.** `--lang vi|en`, mặc định `vi`. `--en` = `--lang en`.

## Quick Start

### Parse Arguments

Trích xuất từ input:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (để trống) → AskUserQuestion
- **--lang vi|en**: ngôn ngữ đầu ra. Mặc định `vi`.
- **--en**: viết tắt của `--lang en`. Nếu cả hai có mặt, `--lang` ưu tiên.

### Route to Mode

| Mode | Flow | Dùng khi |
|------|------|---------|
| **Full** | Load state → Discover → Pick service → Scout → **Plan (human confirm)** → Pipeline (FR+LLD+IMP+TST) → Summary → Next service | Lần đầu khám phá |
| **Architect** | Load state → Discover → Pick service → Scout → **Plan (human confirm)** → Pipeline (FR+LLD) → Summary → Next service | Chỉ kiến trúc |
| **Sync** | Load state → Pick service → Git change detection → **Human chọn phases** → Execute → Summary → Next service | Cập nhật tài liệu |

Nếu không có mode: **AskUserQuestion** — "Chọn chế độ khám phá:" (header: "Explore Mode"), options: "Full Pipeline" | "Architecture Only" | "Sync Documents".

## Phase 0: Load State

**Ensure directories:**
```bash
mkdir -p knowledge/01-global-standards knowledge/02-central-contracts/apis knowledge/02-central-contracts/events knowledge/03-system-architecture/ADRs knowledge/04-microservices
```

**Load hoặc tạo `knowledge/explore.json`:** Nếu chưa tồn tại → tạo mới với default schema. Nếu đã tồn tại → load + validate JSON. Nếu corrupt → **AskUserQuestion**: "Xóa và tạo mới?" / "Abort".

Default schema: `{ version: "3.1.0", projectName, slug, createdAt, updatedAt, current: null, nextActions: [], projects: {}, history: [] }`.

**Universal Project Discovery** — merge + dedup các sub-projects từ: git submodules, nested git repos, monorepo directories (`packages/*/`, `apps/*/`, `services/*/`, `modules/*/`), fallback root project. Loại trừ git submodules khỏi các pattern sau.

**Classify service vs libs** — dùng build detection. Ưu tiên: Dockerfile → docker-compose reference → build system detection (Maven/Gradle/Node/Go/Rust/Python) → fallback libs. Chi tiết implementation: `references/state-management.md#classification`.

**Merge state** — project mới thêm với `status: "todo"`, commit hash thay đổi → reset về `"todo"`, project không còn tồn tại → xóa, rebuild `nextActions`.

## Phase 1: Pick Service + Gather Libs

**Display state** từ `knowledge/explore.json` — bảng: #, Service, Status, Last Scout, Last Explore, Last Sync.

- 1 service `todo` → tự động chọn
- Nhiều service `todo` → **AskUserQuestion** chọn service hoặc "Dừng ở đây"
- Không còn service `todo` → báo cáo hoàn tất

**Gather libs** dùng `getLibsForService()`. Nếu có libs đã scout trước đó → **AskUserQuestion**: "Dùng lại scout có sẵn hay scout lại?" (options: "Dùng lại (Recommended)" / "Scout lại tất cả" / "Scout lại các libs đã thay đổi").

Cập nhật `knowledge/explore.json`: `current.service`, `current.phase = "scouting"`.

## Phase 2: Scout

Delegate cho `sdlc-scout` skill:

```
Skill(sdlc-scout, "{service_path} {lib_paths...} --mode explore --lang {language}")
```

`sdlc-scout` tự xử lý: repomix packing, strategy routing, caching, audit. Kết quả: `reports[]` với `name`, `outputPath`, `filesFound`, `technologiesDetected`.

Cập nhật state: `updateAfterScout()` (xem `references/state-management.md#update-after-scout`).

## Phase 3: Plan — Human Confirmation 🔴

**LUÔN thực hiện** — human-in-the-loop gate bắt buộc.

1. Gọi `EnterPlanMode`
2. Spawn `Agent(Plan)` phân tích scout reports, đề xuất: EPIC codes, bounded contexts, dependencies, FR scope estimate, risk areas
3. Viết plan vào `.work/plans/explore-YYYYMMDD-{service}--{slug}.md`
4. Gọi `ExitPlanMode`
5. **AskUserQuestion**: "Plan đã được phê duyệt. Tiếp tục thực thi pipeline?" (header: "Proceed") — "Tiếp tục thực thi" / "Để tôi xem lại plan"

## Phase 4: Explore Pipeline

### Prepare + Invoke

```js
const workflowArgs = {
  projectName: state.projectName,
  runDate: YYYYMMDD,
  slug: state.slug,
  scoutReports: [serviceScoutPath, ...libScoutPaths],
  language: language,
  mode: mode,                           // "full" | "architect"
  focusedService: serviceName,
  epicCodes: planResult.epicCodes,      // từ Phase 3 plan
  fromPhase: null,                      // set khi retry sau gate failure
}
```

```
Workflow({ scriptPath: "workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow xử lý 5 phase: **Preflight** (skip idempotent) → **FR Discovery per EPIC** (pipeline, gate x3 retry) → **LLD** (1 agent, gate x3) → **IMP+TST per EPIC** (pipeline, IMP∥TST, gate x2) → **Service Notes** (1 agent tổng hợp).

Mode `full` chạy tất cả 5, mode `architect` dừng sau LLD, không chạy IMP+TST và Service Notes.

### Process Results

**Thành công:** `updateAfterExplore(state, serviceName, result)`.

**Có lỗi** (3 error handling patterns, chi tiết: `references/workflow-handoff.md#error-handling-patterns`):

| Pattern | Tình huống | Xử lý |
|---------|-----------|-------|
| **FR partial fail** | 1+ EPIC gate fail | Hiển thị EPIC bị fail → **AskUserQuestion**: Retry / Skip / Abort |
| **LLD blocking fail** | Gate fail sau 3 retries | Hiển thị feedback → **AskUserQuestion**: Retry / Skip LLD / Abort |
| **IMP/TST partial fail** | 1+ group gate fail | Hiển thị group bị fail → **AskUserQuestion**: Retry / Skip / Abort |

## Phase 5: Summary

Spawn `Agent(general-purpose)` ghi báo cáo vào `knowledge/04-microservices/{service}/explore-summary.md`:
- Executive Summary → Files Created/Modified (bảng) → Architecture Summary → FRs ({N} FRs, {M} EPICs) → Quality Gates → Next Steps

Cập nhật `knowledge/explore.json`: `updateAfterExplore()` (xem `references/state-management.md#update-after-explore`).

## Phase 6: Next Action

Rebuild `nextActions` từ state. Hiển thị state summary.

- **Còn service `todo`:** **AskUserQuestion** — danh sách service + "Dừng ở đây" + "🔄 Chạy System-Wide Merge" (nếu có ≥1 explore-done)
- **Đã explore hết:** "✅ Tất cả service đã được explore." → **AskUserQuestion** — "Chạy System-Wide Merge (Recommended)" / "Sync service đã explore" / "Dừng ở đây"

Route: chọn service → Phase 1 / "Dừng" → kết thúc / "Sync" → Sync Mode / "Merge" → Phase 7.

## Phase 7: System-Wide Merge

Trigger khi human chọn "System-Wide Merge".

**Collect services** đã `explore-done` (fallback: service hiện tại nếu vừa explore xong).

**Ensure directories** + **Prepare args:**
```js
const mergeArgs = {
  projectName: state.projectName,
  slug: state.slug,
  language: language,
  runDate: YYYYMMDD,
  services: services,                  // string[] — explore-done services
  fromPhase: null,                     // set khi retry
}
```

**Invoke:**
```
Workflow({ scriptPath: "workflows/workflow-sdlc-system-merge.js", args: mergeArgs })
```

Workflow xử lý 6 phase: Collect → C4∥Coding∥ErrorCodes → HardBoundaries∥CrossCutting → Events∥APIs → ADRs → Final Gate.

**Process results:** Thành công → `updateAfterSystemMerge()` + hiển thị summary tree. Có lỗi → gate fail hiển thị phase + feedback → **AskUserQuestion**: Retry / Skip & proceed / Abort. Xem `references/workflow-handoff.md#merge-error-handling`.

Sau merge, quay về Phase 6 AskUserQuestion.

## Sync Mode

Sync mode cập nhật tài liệu dựa trên git diff, có human-in-the-loop ở mọi bước quyết định.

```
Phase S0: Load knowledge/explore.json
    │
Phase S1: Display state → Human chọn service cần sync
    │
Phase S2: Git change detection cho service + libs
    │
Phase S3: Impact analysis (Tier 1 rule-based + Tier 2 AI)
    │
Phase S4: Hiển thị change summary → Human chọn phases 🔴
    │
Phase S5: Execute selected phases
    │
Phase S6: Update state + summary
    │
Phase S7: Human — sync service tiếp theo?
```

Chi tiết đầy đủ: `references/sync-mode.md`.

## Output Standard

Mọi file tạo ra phải tuân theo chuẩn `sdlc` orchestrator. Chi tiết: `references/output-standard.md`.

**Cấu trúc thư mục chính:**

| Thư mục | Nội dung chính |
|---------|---------------|
| `knowledge/01-global-standards/` | `hard-boundaries.md`, `coding-conventions.md`, `cross-cutting-patterns.md` |
| `knowledge/02-central-contracts/` | `apis/`, `events/`, `global-error-codes.md` |
| `knowledge/03-system-architecture/` | `C4-context-diagram.md`, `ADRs/` |
| `knowledge/04-microservices/{svc}/` | `FR-*.md`, `tech-design.md`, `explore-summary.md` |

**Quy ước đặt tên:** `FR-{EPIC}-{NNN}--{slug}.md` (spec), `FR-{EPIC}-{NNN}--{slug}-impl.md` (IMP), `FR-{EPIC}-{NNN}--{slug}-test.md` (TST), `ADR-{NNN}--{slug}.md`.

## Reference Files

- `references/state-management.md` — State schema, classification logic, state machine, merge/update functions, libs reuse, edge cases.
- `references/sync-mode.md` — Sync mode: change detection, impact analysis (Tier 1+2), human-in-the-loop phase selection.
- `references/workflow-handoff.md` — Workflow args structure, result structures, 3 error handling patterns, merge handoff, manual override fallback.
- `references/output-standard.md` — Cấu trúc knowledge/, quy ước đặt tên, files không tạo, v2→v3 migration, phase artifacts mapping.
- `references/testing.md` — Activation tests, mode selection tests, state management tests, human-in-the-loop gate tests, error handling tests, regression scenarios.

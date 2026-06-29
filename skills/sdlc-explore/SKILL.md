---
name: sdlc:explore
description: >-
  Explore and analyze codebases end-to-end with workflow-driven SDLC pipeline (SRS, HLD, LLD, IMP, TST).
  Processes ONE service at a time to avoid overload in multi-subproject workspaces. Libs are scouted together with their first service.
  State persisted in .explore/state.json for resumability across sessions.
  Use when analyzing new projects, exploring architecture, generating system documentation, or syncing sprint artifacts.
argument-hint: "[full][architect][sync] [--auto] [--lang vi|en] [--en]"
version: 2.0.2
allowed-tools: Read, Bash(*), AskUserQuestion, Agent, Skill, Workflow, EnterPlanMode, ExitPlanMode
---

# Explore Codebase — One Service At A Time

Khám phá codebase: phát hiện sub-projects → phân loại (service/lib) → chọn MỘT service → scout service+libs → explore pipeline → sprint → summary → hỏi người dùng chọn service tiếp theo.

**Nguyên tắc thiết kế cốt lõi:** Mỗi lần chỉ xử lý 1 service. Libs được scout chung với service đầu tiên. Trạng thái lưu trong `.explore/state.json` để resume giữa các phiên. Không còn tình trạng scout tất cả sub-projects cùng lúc gây quá tải.

## Quick Start

### Step 1: Parse Arguments

Trích xuất từ input của người dùng:
- **mode**: `full` → Full Pipeline | `architect` → Architect Only | `sync` → Sync Mode | (để trống) → dùng AskUserQuestion
- **--auto**: bỏ qua plan mode, thực thi trực tiếp
- **--lang vi|en**: ngôn ngữ đầu ra. Mặc định `vi`. Chỉ hỗ trợ `vi` và `en` — từ chối các giá trị khác.
- **--en**: viết tắt của `--lang en`. Nếu cả hai cùng có mặt, `--lang` được ưu tiên.

### Step 2: Route to Mode

| Mode | Flow | Trường hợp sử dụng |
|------|------|-------------------|
| **Full** | Load state → Pick service → Scout → Plan(tùy chọn) → Explore Pipeline → Sprint → Summary → Hỏi người dùng chọn tiếp | Lần đầu khám phá, cần đầy đủ tài liệu |
| **Architect** | Load state → Pick service → Scout → Plan(tùy chọn) → Explore Pipeline (chỉ SRS+HLD) → Summary → Hỏi người dùng chọn tiếp | Chỉ cần kiến trúc |
| **Sync** | Load state → Phát hiện thay đổi theo service → Hỏi chọn service+phases → Thực thi → Hỏi người dùng chọn tiếp | Cập nhật tài liệu hiện có |

Nếu không có mode được chỉ định, dùng AskUserQuestion:
- Question: "Chọn chế độ khám phá:" (header: "Explore Mode")
- Options: "Full Pipeline" | "Architecture Only" | "Sync Documents"

## Phase 0: Load State

Mục tiêu: tạo mới hoặc load `.explore/state.json`, merge với discovered projects.

### Step 0.1: Create directories

```bash
mkdir -p .explore .work/reports .work/repomix .work/scouts .work/plans
```

### Step 0.2: Universal Project Discovery

Phát hiện tất cả sub-project patterns cùng lúc. Merge kết quả, deduplicate overlap.

- **Pattern 1 — Git Submodules**: `git submodule status`. Ghi nhận commit hash, path, branch. Loại trừ khỏi Patterns 2-3.
- **Pattern 2 — Nested Git Repos**: Tìm các git repo độc lập nằm trong project (thường bị gitignored). Kiểm tra `git check-ignore` cho từng repo.
- **Pattern 3 — Monorepo Directories**: Tìm trong `packages/*/`, `apps/*/`, `services/*/`, `modules/*/` kèm build files (`package.json`, `Cargo.toml`, `go.mod`, `pom.xml`). Bỏ qua dirs từ Patterns 1-2.
- **Pattern 4 — Single Project (Fallback)**: Nếu không tìm thấy pattern nào khác → single project = repo hiện tại.

### Step 0.3: Classify Each Project

Dùng build detection logic trong `references/state-management.md` để phân loại từng project thành `service` hoặc `libs`.

**Tóm tắt nhanh (ưu tiên từ cao xuống thấp):**
1. Có `Dockerfile` ở root → **service**
2. `docker-compose.yml` reference đến project → **service**
3. Spring Boot: `pom.xml` có `spring-boot-maven-plugin` → **service** (không có → **libs**)
4. Node.js: `package.json` có `"start"` script HOẶC web framework dep → **service** (không → **libs**)
5. Go: `main.go` có `func main()` → **service** (không → **libs**)
6. Rust: `Cargo.toml` có web framework HOẶC có `src/main.rs` → **service** (không → **libs**)
7. Python: `pyproject.toml` có web framework HOẶC uvicorn/gunicorn → **service** (không → **libs**)
8. Fallback: có file entry point (`main.*`, `index.*`, `server.*`) → **service** (mặc định → **libs**)

### Step 0.4: Initialize or Merge State

**Nếu `.explore/state.json` chưa tồn tại:**
Tạo mới với tất cả projects đã discover (status = `todo`).

**Nếu đã tồn tại:**
- Load state hiện tại
- Merge: project mới → thêm vào với status `todo`
- Project cũ: nếu commit hash thay đổi → reset status về `todo`
- Project không còn tồn tại → xóa khỏi state
- Rebuild `nextActions`

Chi tiết merge logic: `references/state-management.md`.

**Run identifier**: `{slug}` = short kebab-case mô tả mục đích project (vd: `payment-api`). Kết hợp với prefix ngày `YYYYMMDD`.

## Phase 1: Pick Service + Gather Libs

### Step 1.1: Display state + pick service

**Hiển thị state summary** (định dạng bảng — xem `references/state-management.md`, section "Display State Summary"):

```
| # | Service | Type | Status | Last Scout | Last Explore | Last Sync |
| ...kèm dòng trạng thái libs hiển thị scout status và service đã scout cùng...
```

**Pick service từ state:** Lọc `state.projects` theo `type: 'service'`, nhóm theo `status`. Logic chi tiết trong `references/state-management.md`, section "State Operations".

**Nếu không còn service nào `todo`:**
- Báo cáo: "Tất cả service đã được xử lý."
- Nếu đang ở `sync` mode: hiển thị cả service đã `explore-done` để chọn sync
- Kết thúc.

**Nếu chỉ có 1 service `todo`:**
- Tự động chọn service đó (không cần hỏi).

**Nếu có nhiều service `todo`:**
```
AskUserQuestion:
- Question: "Chọn service để xử lý tiếp:" (header: "Next Service")
- Options: danh sách các service todo + "Dừng ở đây"
```

### Step 1.2: Gather libs

```js
const { freshLibs, reusedLibs } = getLibsForService(state, selectedService)
// Xem references/state-management.md, section "Libs Reuse Logic" cho logic đầy đủ
```

**Nếu có `reusedLibs.length > 0`:**
```
AskUserQuestion:
- Question: "{N} thư viện đã được scout trước đó (với {scoutedWith}). Dùng lại hay scout lại?"
  (header: "Libs Scout")
- Options:
  - "Dùng lại scout có sẵn (Recommended)"
  - "Scout lại tất cả"
  - "Scout lại libs đã thay đổi" (chỉ hiển thị nếu có libs có commit hash thay đổi)
```

Kết quả: `batchProjects = [selectedService, ...freshLibs, ...(reusedLibs nếu chọn scout lại)]`

### Step 1.3: Update state — bắt đầu scout

Cập nhật `state.json`: `current.service`, `current.phase = "scouting"`.
Xem `references/state-management.md`, section "State Operations" cho full state mutation pattern.

## Phase 2: Scout — Delegate to sdlc-scout

Mục tiêu: scout 1 service + các libs được chọn. **Delegate toàn bộ cho `Skill(sdlc-scout, ...)`** — skill này tự xử lý repomix packing, strategy routing (scout skill vs pipeline workflow), caching, và audit.

### Step 2.1: Pull Latest Source (bỏ qua trong Sync mode)

```bash
git submodule foreach 'git pull'  # nếu có submodules
git pull                          # root repo
```

### Step 2.2: Invoke sdlc-scout Skill

Truyền paths của service + libs cần scout, mode `explore` để dùng pipeline workflow:

```
Skill(sdlc-scout, "{service_path} {lib_paths...} --mode explore --lang {language}")
```

**Cách sdlc-scout xử lý:**
- **Repomix packing**: Tự động detect cần repomix không, tự gọi `Skill(repomix, ...)` nếu cần.
- **Strategy routing**: Nếu tổng số file > 200 → pipeline workflow (`workflow-sdlc-scout-pipeline.js`). Nếu ≤ 200 → scout skill trực tiếp.
- **Caching**: Kiểm tra existing reports trong `.work/scouts/`, skip nếu đã có.
- **Audit**: Tự chạy completeness check sau khi scout.

### Step 2.3-2.4: Process Results + Update State

sdlc-scout trả về object chứa `reports[]` — mỗi report có `name`, `outputPath`, `filesFound`, `highRelevance`, `patternsObserved`, `technologiesDetected`.

Gọi `updateAfterScout(state, serviceName, libNames, { reports })` rồi ghi `.explore/state.json`.
Xem `references/state-management.md`, section "Update after scout" cho full function signature.

## Phase 3: Plan — (Optional)

**Nếu có --auto**: bỏ qua Phase 3, tiến thẳng đến Phase 4.

**Nếu không có --auto**:
1. Gọi `EnterPlanMode`
2. Spawn `Agent(Plan)` để làm rõ phạm vi. Phạm vi: chỉ service đang xử lý.
3. Khi được phê duyệt, spawn `Agent(general-purpose)` để ghi `.work/plans/explore-YYYYMMDD-{service}--{slug}.md`
4. AskUserQuestion: "Plan đã được viết. Tiếp tục?" (header: "Proceed", options: "Tiếp tục thực thi" | "Để tôi xem lại")
5. Gọi `ExitPlanMode`

## Phase 4: Explore Pipeline — Single Service

Delegate SDLC pipeline cho **workflow-sdlc-explore-pipeline**. Chỉ chạy cho 1 service hiện tại.

### Step 4.1: Prepare Workflow Args

Xây dựng object `workflowArgs` với các field: `projectName`, `runDate`, `slug`, `scoutReports[]`, `language`, `mode`, `focusedService`. Schema đầy đủ và mô tả các field: `references/workflow-handoff.md`, section "Args Structure (Skill → Workflow)".

### Step 4.2: Invoke Workflow

```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-explore-pipeline.js", args: workflowArgs })
```

Workflow xử lý: idempotent retry, decomposed SRS, gate verification, single-service LLD, FR distribution, IMP+TST.

### Step 4.3: Process Results + Handle Failures

**Thành công:** `updateAfterExplore(state, serviceName, result)` — xem `references/state-management.md`, section "Update after explore".

**Có lỗi:** Xem `references/workflow-handoff.md`, section "Error Handling Patterns" cho 4 pattern:
- Pattern 1: FR-Discovery thất bại một phần → AskUserQuestion retry/skip/abort
- Pattern 2: SRS/HLD thất bại blocking → AskUserQuestion retry/skip/abort
- Pattern 3: LLD thất bại (blocking, chỉ 1 service) → AskUserQuestion retry/skip/abort
- Pattern 4: IMP/TST group thất bại (một phần) → AskUserQuestion retry failed groups/skip/abort

## Phase 5: Sprint Integration

Dùng `Skill(sprint)` cho mọi sprint operation. State routing:

- **Case A — Chưa có sprint artifacts**: Tạo mới từ templates. Sync bottom-up.
- **Case B — Đã có artifacts, cùng project**: Cập nhật với findings mới từ service này.
- **Case C — Đã có artifacts, khác project**: AskUserQuestion replace/create parallel.

## Phase 6: Summary (per service)

Spawn `Agent(general-purpose)` để ghi `.work/reports/explore-YYYYMMDD-{service}--{slug}.md`. Định dạng 9 section:
1. Executive Summary (cho service này)
2. Project Overview
3. Architecture Summary
4. Services Overview
5. Functional Requirements (từ workflow frDistribution)
6. Implementation Overview
7. Test Coverage Overview
8. Quality Gates (từ workflow results)
9. Recommendations

Inputs: scout reports của service + libs, SRS, HLD, LLD, IMP, TST outputs.

### Auto-Tag for Future Sync

```bash
git tag "explore-$(date +%Y%m%d)-{service}--{slug}" -m "explore: {service} ({mode} mode)"
git -C <submodule_path> tag "explore-$(date +%Y%m%d)-{service}--{slug}"
```

## Phase 7: Ask Human — Next Service

### Step 7.1: Update nextActions + Display + Ask

Rebuild `state.nextActions` từ services còn `todo` (logic trong `references/state-management.md`, section "State Operations").
Hiển thị state summary (cùng format như Phase 1.1).

**Nếu còn service `todo`:**
```
AskUserQuestion:
- Question: "Service tiếp theo để xử lý?" (header: "Next Service")
- Options: danh sách service todo + "Dừng ở đây"
```

Nếu chọn service → vòng lại Phase 1 với service đó.
Nếu "Dừng ở đây" → kết thúc, báo cáo tổng quan.

**Nếu không còn service nào:**
- "Tất cả service đã được explore. Hoàn tất!"

## Sync Mode

Sync mode xử lý từng service một: load state → pick service → git change detection → impact analysis (Tier 1 rule-based + Tier 2 AI) → người dùng chọn phases → thực thi → update state → service tiếp theo.

Toàn bộ flow (7 bước chi tiết, change detection patterns, impact mapping table, edge cases): `references/sync-mode.md`.

## Key Notes

- **One service at a time.** Không còn scout/explore tất cả services cùng lúc. Mỗi lần chạy chỉ xử lý 1 service.
- **State persistence.** `.explore/state.json` là single source of truth. Mọi thay đổi trạng thái phải ghi vào file này ngay lập tức.
- **Libs scouted once.** Libs được scout chung service đầu tiên. Các service sau hỏi người dùng: dùng lại hay scout lại.
- **Human decides order.** Thứ tự xử lý service do người dùng chọn (qua AskUserQuestion), không tự động.
- **Scout delegation.** Phase 2 delegates to `Skill(sdlc-scout, ...)` — skill xử lý repomix, strategy routing, caching, audit. Không tự gọi Workflow scout pipeline trực tiếp.
- **Workflow delegation.** Phase 4 là single `Workflow()` call. Do NOT manually spawn SDLC agents.
- **Idempotent.** Phases đã hoàn thành auto-skipped (output detection). Resume được giữa các phiên.
- **Tooling via Skill, not Bash.** Luôn gọi repomix qua `Skill(repomix, ...)` — không bao giờ dùng Bash trực tiếp. Hiện tại việc này do sdlc-scout xử lý nội bộ.
- **Explicit paths only.** Sau Phase 2, dùng exact file paths từ scout reports — không bao giờ dùng glob patterns.
- **Language (`--lang`, `--en`).** `--lang vi|en` đặt ngôn ngữ đầu ra (mặc định: `vi`). `--en` = `--lang en`. `--en --lang vi` → tiếng Việt được ưu tiên.

## Reference Files

- `references/state-management.md` — State schema, classification logic (service vs libs với build detection), state machine, merge/update operations, libs reuse logic, edge cases.
- `references/sync-mode.md` — Sync Mode: one service at a time, git change detection, impact analysis, người dùng phê duyệt, selective phase execution.
- `references/workflow-handoff.md` — Workflow args schema, result structures, error handling patterns, manual override fallback.

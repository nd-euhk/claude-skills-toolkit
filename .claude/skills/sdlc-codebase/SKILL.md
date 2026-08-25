---
name: sdlc-codebase
description: >-
  Reverse engineer agent_docs/ từ codebase có sẵn. Phân tích source code để
  sinh ra toàn bộ tài liệu SDLC: SRS, HLD, LLD, IMP, TST. Flow ngược với
  sdlc-orchestrator task flow — từ code suy ra architecture, design,
  requirements, và specs. Dùng khi cần "reverse engineer", "sinh tài liệu từ
  code", "tạo agent_docs từ codebase", "document codebase", "extract specs
  from code", "đồng bộ tài liệu với code", "generate SDLC docs from source".
argument-hint: "[--focus <description>] [--scope <path>] [--artifacts hld,lld,srs,imp,tst] [--dry-run]"
version: 1.6.0
user-invocable: true
category: sdlc
keywords: [reverse-engineer, codebase, agent-docs, documentation, sdlc, specs-from-code]
allowed-tools: Read, Bash, Skill, Workflow, Agent, Write, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

# SDLC Codebase

Bạn là điểm vào cho quy trình reverse engineering — từ codebase có sẵn sinh ra
toàn bộ tài liệu `agent_docs/`. Bạn điều phối pipeline ngược với
sdlc-orchestrator: thay vì specs → code, bạn làm **code → specs**.

Bạn **không bao giờ** tự phân tích code hay viết nội dung specs — bạn chỉ điều
phối subagents, skills, và workflows.

Khi flow đã được xác nhận, load file `references/flow-reverse.md` để có
procedure chi tiết. Shared procedures và gate criteria nằm trong
`references/procedures.md`.

## Hard Boundaries

Đây là các quy tắc KHÔNG THỂ NEGOTIATE:

- **Bạn điều phối, không thực thi** — không tự phân tích code, không tự viết spec content
- **Human-in-the-loop ở Plan level** — 1 EnterPlanMode tổng thể trước khi invoke workflow. Không plan từng phase riêng lẻ
- **Dùng Workflow, không spawn Agent trực tiếp** — reverse pipeline luôn qua `Workflow({scriptPath, args})`. Workflow script xử lý fan-out, skill chỉ nhận kết quả cuối cùng
- **Preflight trước, Reverse sau** — foundation files phải tồn tại trước khi reverse engineer
- **Scout trước khi phân tích** — luôn chạy sdlc-scout trước để có structured codebase map
- **Reverse order cố định** — Scout → HLD → LLD → SRS → IMP∥TST. Không đảo thứ tự
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--all")`
- **Gate tự động trong workflow với retry** — workflow script tự chạy `codebase-gate` giữa các phase với retry tối đa 3 lần. Gate fail ở attempt 3 → skip các phase còn lại, chuyển thẳng Report. Skill chỉ đọc kết quả cuối cùng, không can thiệp giữa chừng
- **Tôn trọng file đã tồn tại** — hỏi human trước khi overwrite bất kỳ file agent_docs/ nào

---

## Quick Start

```bash
# Reverse engineer toàn bộ codebase
/sdlc-codebase

# Reverse engineer với focus cụ thể
/sdlc-codebase --focus "Authentication module" --scope src/auth/

# Chỉ sinh artifact cụ thể
/sdlc-codebase --artifacts hld,lld
/sdlc-codebase --artifacts srs

# Dry run — chỉ scout, không sinh docs
/sdlc-codebase --dry-run
```

---

## Main Flow

### Bước 1: Git Check

1. `git branch --show-current` — xác nhận branch
2. `git status --porcelain` — kiểm tra dirty state
3. Nếu dirty, dùng `AskUserQuestion`:

```
Question: "Working tree đang có uncommitted changes. Xử lý thế nào?"
Options: "Stash" | "Commit" | "Tiếp tục (giữ dirty)" | "Abort"
```

4. **Không** tiếp tục cho đến khi human giải quyết.

### Bước 2: Parse Args & Xác Nhận Scope

Parse CLI args từ human input:

| Flag | Mô tả | Default |
|------|-------|---------|
| `--focus "<mô tả>"` | Focus area để scout và phân tích | Toàn bộ codebase |
| `--scope <path>` | Giới hạn phạm vi codebase | `.` (root) |
| `--artifacts <list>` | Artifact types cần sinh (hld,lld,srs,imp,tst) | Tất cả |
| `--dry-run` | Chỉ scout + plan, không sinh docs | `false` |

Xác nhận scope với human:

```
📋 SDLC Codebase — Reverse Engineer
   Scope:     {scope}
   Focus:     {focus hoặc "Toàn bộ codebase"}
   Artifacts: {danh sách artifacts}
   Verify:    Adversarial (codebase-srs-verify agent, 3-lens + Explore subagents)
   Mode:      {dry-run ? "Dry Run" : "Full Generation"}

	   Pipeline:  {renderPipeline(artifacts)}
```

Nếu ambiguous → `AskUserQuestion` để làm rõ scope và artifacts.

### Bước 2.5: Smart Detection — Trạng thái agent_docs/

Kiểm tra agent_docs/ hiện có để suggest incremental update vs full reverse:

```bash
echo "=== agent_docs/ Status ==="
test -f agent_docs/project-overview.md && echo "  project-overview" || true
test -f agent_docs/user-context.md && echo "  user-context" || true
test -f agent_docs/conventions.md && echo "  conventions" || true
test -f agent_docs/architecture.md && echo "  architecture (HLD)" || true
test -f agent_docs/README.md && echo "  README (feature index)" || true
	n=$(ls agent_docs/features/*.md 2>/dev/null | wc -l); [ "$n" -gt 0 ] && echo "  SRS features: $n"
	n=$(ls agent_docs/tech-design/*.md 2>/dev/null | wc -l); [ "$n" -gt 0 ] && echo "  LLD docs: $n"
	n=$(ls agent_docs/{backend,frontend}/*/implementation/*.md 2>/dev/null | wc -l); [ "$n" -gt 0 ] && echo "  IMP specs: $n"
	n=$(ls agent_docs/{backend,frontend}/*/test-specs/*.md 2>/dev/null | wc -l); [ "$n" -gt 0 ] && echo "  TST specs: $n"
test -f agent_docs/error-handling.md && echo "  error-handling (cross-cutting)" || true
test -f agent_docs/caching-strategy.md && echo "  caching-strategy (cross-cutting)" || true
test -f agent_docs/performance-test.md && echo "  performance-test (cross-cutting)" || true
test -f agent_docs/frontend-architecture.md && echo "  frontend-architecture (cross-cutting)" || true
test -f agent_docs/frontend-test-strategy.md && echo "  frontend-test-strategy (cross-cutting)" || true
```

**Route dựa trên trạng thái:**

| Trạng thái agent_docs/ | Suggest |
|---|---|
| Trống hoàn toàn (chưa có gì) | Full reverse — tất cả artifacts |
| Chỉ có foundation (preflight đã chạy) | Full reverse từ HLD |
| Có HLD, thiếu LLD/SRS | `--artifacts lld,srs,imp,tst` |
| Có đầy đủ artifacts | Incremental update — hỏi human artifacts cần refresh |
| Chỉ thiếu IMP+TST | `--artifacts imp,tst` |

Hiển thị suggest:

```
🔍 agent_docs/ Status:
   ✅ foundation files (3/3)
   ✅ architecture.md (HLD)
   ⚠️  LLD: 0 service design docs
   ⚠️  SRS: 0 feature specs
   ⚠️  IMP: 0 implementation specs
   ⚠️  TST: 0 test specs

   💡 Suggest: --artifacts lld,srs,imp,tst (HLD đã có, skip)
```

Nếu human không chỉ định `--artifacts`, dùng smart detection để suggest default.
Human có thể override suggestion.

### Bước 3: Foundation Gate (Preflight)

Kiểm tra và đảm bảo foundation files tồn tại:

```bash
NEEDED=""
test -f agent_docs/project-overview.md || NEEDED="$NEEDED --project-overview"
test -f agent_docs/user-context.md || NEEDED="$NEEDED --user-context"
test -f agent_docs/conventions.md || NEEDED="$NEEDED --conventions"
```

Nếu `NEEDED` không rỗng:
1. Báo cáo: "⚠️ Thiếu foundation files. Chạy sdlc-preflight để tạo..."
2. `Skill("sdlc-preflight", NEEDED)` → đợi complete
3. Post-preflight verify — nếu file vẫn missing → **dừng pipeline**, báo cáo human
4. Báo cáo: "🏗️ Foundation: project-overview.md ✅ | user-context.md ✅ | conventions.md ✅"

Nếu tất cả đã tồn tại → "🏗️ Foundation: all files present ✅"

### Bước 4: Codebase Scout

Chạy sdlc-scout để có structured codebase map trước khi reverse engineer:

```
Skill("sdlc-scout", "{scope} --mode explore --focus '{focus}'")
```

Scout report được lưu tại `.work/scouts/`. Đọc report summary để xác nhận:
- Số lượng sub-project phát hiện
- Technologies detected
- Module map
- Entry points

Báo cáo: "🔍 Scout hoàn tất — {N} sub-project, {M} modules, {T} technologies"

### Bước 5: Reverse Engineering Pipeline (qua Workflow)

Pipeline ngược với sdlc-orchestrator task flow. **Dùng Workflow để fan-out agent theo service/domain**, không spawn Agent trực tiếp trong skill.

```
Scout Report ──→ HLD ──→ 🚦Gate ──→ LLD ──→ 🚦Gate ──→ SRS ──→ 🚦Gate ──→ CROSS-CUTTING ──→ 🚦Gate ──→ IMP∥TST ──→ 🚦Gate ──→ Report
                 (1 agent)  (retry≤3)  (N∥ +S)  (retry≤3)  (M∥ +S)  (retry≤3)  (2-stage)      (retry≤3)  (2M∥)      (retry≤3)

                 Cross-Cutting: Stage 1 (4∥) → barrier → Stage 2 (1 agent)
                 Gate fail ở attempt 3 → skipRemaining = true → tất cả phase sau bị skip → Report
```

**Gate + Retry tự động trong workflow:**
- Sau mỗi phase, workflow tự gọi `codebase-gate` để validate outputs
- Gate fail → retry phase với targeted feedback (chỉ ra chính xác criteria nào fail)
- Retry tối đa 3 lần → fail ở lần 3 → `skipRemaining = true` → nhảy thẳng Report
- Gate pass → proceed phase tiếp theo như bình thường
- Skill **không can thiệp** giữa các phase — chỉ đọc kết quả cuối cùng từ workflow

**Vì sao thứ tự này?** Khi reverse engineering từ code:
- **HLD trước** — cấu trúc service, communication patterns thấy trực tiếp từ code (1 agent, cross-cutting)
- **LLD tiếp** — domain models, API contracts, data flow extracted per service (N agents ∥)
- **LLD Synthesis** — API contracts by domain, canonical error codes, FR candidates (1 agent). **Không** sinh cross-cutting.md — việc đó được giao cho dedicated agents sau SRS
- **SRS sau** — functional requirements được suy ra từ implementation + HLD/LLD context, grouped by domain (M agents ∥)
- **Cross-Cutting sau SRS** — 5 dedicated agents tổng hợp error-handling, caching-strategy, performance-test, frontend-architecture, frontend-test-strategy từ code artifacts. Dùng dedicated `codebase-cross-cutting-*` agents với mindset OBSERVE (không DESIGN). Có scope detection tự động + 2-stage execution
- **IMP∥TST cuối** — implementation + test specs per domain (2M agents ∥, song song IMP với TST)

#### Human-in-the-Loop (Plan Level)

Thay vì plan từng phase, skill làm 1 plan tổng thể trước khi invoke workflow:

1. **EnterPlanMode** — 1 lần duy nhất cho toàn bộ pipeline
2. **Plan Agent prompt:**
   ```
   Lập kế hoạch reverse engineer từ codebase.

   Scout report: {scout_report_path}
   Foundation: agent_docs/project-overview.md, user-context.md

   Cần xác định:
   - Services: danh sách service từ scout report (tên, path, tech stack)
   - Domains: nhóm services thành bounded contexts/domains
   - Artifacts cần sinh: {artifacts}
   - Phases sẽ chạy và expected outputs
   - Risk areas: services/domains có thể thiếu context

   Output: plan với services[], domains[], artifacts[], và expected coverage.
   ```
3. **Human review → approve**
4. **ExitPlanMode**
5. **Dry-run check:** Nếu `--dry-run` → dừng tại đây. Báo cáo plan cho human, không invoke workflow, không sinh bất kỳ artifact nào. Scout report (Bước 4) là output duy nhất.
6. **Workflow availability check:** Xác nhận `Workflow` tool có trong tool-set hiện tại. Nếu không có:
   - Fallback: spawn từng agent qua `Agent` tool với đúng `agentType` và prompt tái tạo từ `workflow-codebase-reverse.js` prompt-builder functions
   - Giữ nguyên gate+retry logic (≤3 lần retry, `skipRemaining` khi gate exhausted)
   - Ghi rõ "Running in manual fallback mode — Workflow tool not available"
7. **Package args** — dùng template trong `references/procedures.md` → "Workflow Args Packaging"
8. **Invoke workflow** — gọi Workflow tool (hoặc manual fallback) với script path và args đã package. Workflow/fallback tự chạy gate+retry giữa các phase, skill không can thiệp
9. **Đọc workflow result** — parse status, outputs, warnings, gate results
10. **Báo cáo kết quả** — dùng template progress reporting. Nếu `status: "partial (gate exhaustion)"`, báo cáo phase nào bị gate exhaustion

#### Workflow Invocation

```js
Workflow({
  scriptPath: ".claude/workflows/codebase/workflow-codebase-reverse.js",
  args: {
    scope: scope,
    scoutReportPath: scoutReportPath,
    services: services,        // từ scout report
    domains: domains,          // từ HLD hoặc scout grouping
    artifacts: artifacts,      // từ --artifacts flag
    focus: focus,              // optional
    foundationPath: "agent_docs/",
    workDir: "<đường dẫn tuyệt đối từ pwd>",
    runDate: new Date().toISOString().split("T")[0],  // ISO date cho deterministic resume (workflow-knowledge: cấm new Date() trong script)
  }
})
```

#### Sau khi Workflow Hoàn Tất

Đọc `result.status` để xác định pipeline outcome. Báo cáo cho human theo template:

**Normal completion:**
```
✅ Pipeline hoàn thành — Reverse từ codebase
   📄 Output:
      • HLD: architecture.md, {A} ADRs
      • LLD: {N} service design docs + synthesis
      • SRS: {M} feature specs + traceability matrix
      • IMP: {X} implementation specs
      • TST: {Y} test specs
   🚦 Gates: {passed}/{total} passed, {exhausted} exhausted
   ⚠️  UNCERTAIN flags: {Z} — cần human review
   💡 Next: Review UNCERTAIN flags → validate với team
```

**Gate exhaustion (một hoặc nhiều phase bị skip):**
```
⚠️ Pipeline partial — Gate exhaustion
   ✅ Completed phases: HLD, LLD (gate PASS)
   🛑 Failed phase: SRS — gate FAIL sau 3 retries
   ⏭️  Skipped phases: IMP, TST (do gate exhaustion)
   📄 Partial outputs: HLD + LLD (architecture + per-service design)
   🚦 Gate details:
      • HLD: PASS (attempt 1/3, 6/6 criteria)
      • LLD: PASS (attempt 1/3, 5/5 criteria)
      • SRS: FAIL (attempt 3/3, 2/4 criteria — S1, S3 failed)
   💡 Options:
      1. Review gate failures → fix root cause (prompt/scout report) → re-run
      2. Manually supplement the missing SRS outputs
      3. Accept partial output và proceed
```

Xem `references/flow-reverse.md` để có hướng dẫn chi tiết về từng phase trong workflow.
Xem `references/procedures.md` để có Workflow Args Packaging, Gate Criteria, và Error Handling.

### Bước 6: Validation & Summary

Sau khi workflow hoàn tất (hoặc partial completion do gate exhaustion):

1. **Đọc gate results** — kiểm tra `result.gates` để xác định phase nào pass, phase nào fail/exhausted
2. **Cross-reference check** — đọc từng file agent_docs/, kiểm tra internal consistency giữa SRS ↔ HLD ↔ LLD ↔ IMP
3. **Coverage report** — so sánh modules từ scout report với modules được document trong artifacts
4. **Gate exhaustion handling** — nếu `result.status === "partial (gate exhaustion)"`, báo cáo rõ phase nào bị skip, lý do, và options cho human
5. **Final summary**:

```
✅ SDLC Codebase — Pipeline Complete

   📄 agent_docs/ Status:
      ✅ project-overview.md  — foundation
      ✅ user-context.md      — foundation
      ✅ conventions.md       — foundation
      ✅ README.md            — feature index
      ✅ architecture.md      — HLD (extracted from code)
      ✅ features/*.md        — SRS ({N} features inferred)
      ✅ tech-design/          — LLD ({N} services)
      ✅ backend/*/           — IMP + TST
      ✅ frontend/*/          — IMP + TST

   📊 Coverage: {X}/{Y} modules documented ({Z}% coverage)
   ⚠️  Gaps: [modules không có docs, hoặc "Không có"]
   💡 Tip: Chạy /sdlc-codebase --focus "<module>" để bổ sung gaps
```

---

## Artifact Selection

Khi human chỉ định `--artifacts`, chỉ sinh những artifact được chọn. Pipeline tự động skip phase không cần thiết nhưng **giữ nguyên thứ tự** — ví dụ `--artifacts srs` vẫn cần scout trước, nhưng skip HLD và LLD.

| Flag | Artifacts Sinh | Phase Chạy |
|------|---------------|------------|
| (default) | Tất cả | Scout → HLD → LLD → SRS → IMP∥TST |
| `--artifacts hld,lld` | architecture.md + per-service design | Scout → HLD → LLD |
| `--artifacts srs` | features/*.md | Scout → SRS |
| `--artifacts imp,tst` | implementation + test specs | Scout → IMP∥TST |

---

## Skill & Agent Reference

### Skills (invoke qua Skill tool)

| Skill | Mục đích |
|-------|----------|
| `sdlc-preflight` | Khởi tạo foundation files (project-overview, user-context, conventions) |
| `sdlc-scout` | Khám phá codebase structure, module map, technologies |
| `grilling` | Phỏng vấn human làm rõ context khi code không đủ thông tin |
| `sprint` | Cập nhật board, backlog, roadmap. Flag: `--board`, `--backlog`, `--roadmap`, `--all`, `--init` |

### Subagents (dùng bởi workflow script, không spawn trực tiếp từ skill)

| Agent | Phase | Scope | Mục đích |
|-------|-------|-------|----------|
| `codebase-hld` | HLD (reverse) | Toàn bộ codebase | Extract architecture từ code: C4 diagrams, ADRs, service boundaries, event taxonomy |
| `codebase-lld` | LLD (reverse) | 1 service | Extract per-service design: 9 sections (domain model → security) |
| `codebase-lld-synthesis` | LLD synthesis | Cross-service | Merge per-service LLD: cross-cutting concerns, API contracts, error codes, FR candidates |
| `codebase-srs` | SRS (reverse) | 1 domain/epic | Infer requirements từ code: FR specs với Gherkin scenarios, NFRs |
| `codebase-srs-synthesis` | SRS synthesis | Cross-domain | Merge per-domain SRS: traceability matrix, unified feature index |
| `codebase-imp` | IMP (reverse) | 1 domain/epic | Document implementation: execution flows, business rules, error mapping, security |
| `codebase-tst` | TST (reverse) | 1 domain/epic | Document test patterns: test architecture, test cases, fixtures, coverage gaps |
| `codebase-gate` | Gate (inter-phase) | Per-phase outputs | Verify artifacts against phase-specific gate criteria. Read-only. Returns structured PASS/FAIL. Called by workflow script between phases with retry ≤ 3 |
| `codebase-cross-cutting-error-handling` | Cross-Cutting (reverse) | Toàn bộ backend services | Extract observed error handling patterns: taxonomy, HTTP mapping, security, logging. OBSERVE, not DESIGN. Writes `error-handling.md` |
| `codebase-cross-cutting-caching-strategy` | Cross-Cutting (reverse) | Toàn bộ backend services | Extract observed caching patterns: L0-L3 layers, inventory, invalidation, stampede prevention. Writes `caching-strategy.md` |
| `codebase-cross-cutting-performance-test` | Cross-Cutting (reverse) | Toàn bộ services | Create performance test plan from SRS NFRs + LLD §8 performance targets. Writes `performance-test.md` |
| `codebase-cross-cutting-frontend-architecture` | Cross-Cutting (reverse) | Frontend services | Extract observed frontend patterns: rendering, state, auth, error boundaries. Writes `frontend-architecture.md` |
| `codebase-cross-cutting-frontend-test-strategy` | Cross-Cutting (reverse) | Frontend services | Extract observed test strategy: pyramid, MSW, patterns, coverage. Runs in Stage 2 after error-handling + frontend-architecture. Writes `frontend-test-strategy.md` |

---

## References

Tất cả reference files — chỉ load khi cần:

| File | Nội dung | Khi nào đọc |
|------|----------|-------------|
| `references/flow-reverse.md` | Workflow Args Packaging cho từng phase: input args, agent type mapping, expected outputs, edge cases. Gate criteria đã được tự động hóa trong workflow qua `codebase-gate` | Khi bắt đầu Bước 5 (package args + invoke workflow) |
| `references/procedures.md` | Workflow Args Packaging templates, Explore Gap Filling Protocol, Gate Criteria (tham khảo — thực tế gate chạy tự động trong workflow qua `codebase-gate`), Progress Reporting templates, Error Handling patterns | Khi cần package args cho workflow, debug pipeline, hoặc hiểu gate criteria |

---

## Key Notes

- **Reverse ≠ Forward** — codebase-* agents được thiết kế để EXTRACT từ code, không phải DESIGN từ specs. Có UNCERTAINTY protocol built-in
- **Workflow, không Agent trực tiếp** — skill là thin orchestrator. Workflow script xử lý fan-out, skill chỉ nhận kết quả cuối cùng. Tránh context window overflow khi >3-5 services
- **Fan-out theo service/domain** — LLD fan-out per service (N agents ∥), SRS/IMP/TST fan-out per domain (M agents ∥). IMP và TST theo domain (không per-feature) để giảm số lượng agent
- **Synthesis agents** — sau LLD và SRS, synthesis agents merge kết quả cross-service/cross-domain
- **Scout là mandatory** — không reverse engineer khi chưa có structured codebase map. Scout report là input chính cho mọi phase
- **Explore Gap Filling** — mỗi codebase-* agent có `Agent` tool để spawn Explore subagents khi scout report không đủ thông tin
- **File đã tồn tại = hỏi human** — không tự động overwrite. Hỏi: update, skip, hay merge
- **Code có thể không đủ thông tin** — khi code không thể hiện rõ business context, agents flag UNCERTAIN thay vì guess
- **Coverage gaps là bình thường** — không phải mọi module đều cần document. Báo cáo gaps, để human quyết định
- **Preflight foundation được dùng lại** — preflight có thể đã được chạy bởi flow khác. Chỉ chạy lại nếu file thiếu
- **Idempotent** — an toàn khi chạy lại. Workflow resume từ phase đã fail. File đã có → hỏi trước khi overwrite
- **Resumable** — nếu workflow crash ở phase 3, chạy lại chỉ re-run phase 3+ (phase 1-2 dùng cached results)
- **Gate + Retry tự động** — `codebase-gate` chạy sau mỗi phase trong workflow với retry tối đa 3 lần. Fail ở lần 3 → skipRemaining → nhảy Report. Skill không can thiệp giữa các phase, chỉ đọc `result.gates` và `result.status` để báo cáo cho human

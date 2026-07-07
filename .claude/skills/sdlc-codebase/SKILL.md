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
version: 1.0.0
user-invocable: true
category: sdlc
keywords: [reverse-engineer, codebase, agent-docs, documentation, sdlc, specs-from-code]
allowed-tools: Read, Write, Edit, Bash, Glob, Skill, Agent, Workflow, AskUserQuestion, EnterPlanMode, ExitPlanMode
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
- **Human-in-the-loop bắt buộc** — mỗi phase: EnterPlanMode → Plan → Review → Spawn. Không skip
- **Preflight trước, Reverse sau** — foundation files phải tồn tại trước khi reverse engineer
- **Scout trước khi phân tích** — luôn chạy sdlc-scout trước để có structured codebase map
- **Reverse order cố định** — Scout → HLD → LLD → SRS → IMP∥TST. Không đảo thứ tự
- **Không tự sửa sprint files** — luôn qua `Skill(sprint)`
- **Gate check sau MỖI agent** — verify gate pass trước phase tiếp theo. Fail → dừng, báo cáo human
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
   Mode:      {dry-run ? "Dry Run" : "Full Generation"}

   Pipeline:  Scout → HLD → LLD → SRS → IMP ∥ TST
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
ls agent_docs/features/*.md 2>/dev/null | head -5 && echo "  ... (SRS features)" || true
ls agent_docs/backend/*/tech-design/*.md 2>/dev/null | head -3 && echo "  ... (LLD)" || true
ls agent_docs/backend/*/implementation/*.md 2>/dev/null | head -3 && echo "  ... (IMP)" || true
ls agent_docs/backend/*/test-specs/*.md 2>/dev/null | head -3 && echo "  ... (TST)" || true
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

### Bước 5: Reverse Engineering Pipeline

Pipeline ngược với sdlc-orchestrator task flow. Thứ tự cố định:

```
Scout Report ──→ HLD ──→ LLD ──→ SRS ──→ IMP ∥ TST
                 (kiến trúc   (thiết kế   (requirements  (song song)
                  từ code)     từ code)    từ code)
```

**Vì sao thứ tự này?** Khi reverse engineering từ code:
- **HLD trước** — cấu trúc service, communication patterns thấy trực tiếp từ code
- **LLD tiếp** — domain models, API contracts, data flow thấy từ code structure
- **SRS sau** — functional requirements được suy ra từ implementation + HLD/LLD context
- **IMP∥TST cuối** — implementation specs và test specs cần SRS + LLD làm nền

#### Human-in-the-Loop mỗi Phase

Cho MỖI phase (HLD, LLD, SRS, IMP, TST), thực hiện:

1. **EnterPlanMode**
2. **Đọc context** — scout report, các file agent_docs/ đã sinh từ phase trước, foundation files, codebase
3. **Spawn Plan agent** với prompt gồm: phase hiện tại, codebase context (scout report), các file đã tồn tại, expected outputs, mode reverse engineering
4. **Đợi human review** — human review và approve/revise plan
5. **ExitPlanMode**
6. **Spawn subagent** qua `Agent` tool. Dùng agent SDLC tương ứng với prompt reverse engineering:
   - HLD → `Agent("sdlc-hld", ...)` — prompt yêu cầu extract architecture từ code thay vì thiết kế từ SRS
   - LLD → `Agent("sdlc-lld", ...)` — prompt yêu cầu extract per-service design từ code
   - SRS → `Agent("sdlc-srs", ...)` — prompt yêu cầu infer requirements từ code behavior
   - IMP → `Agent("sdlc-imp", ...)` — prompt yêu cầu document implementation patterns từ code
   - TST → `Agent("sdlc-tst", ...)` — prompt yêu cầu document test patterns từ code
7. **Verify gate** — kiểm tra self-check pass. Fail → báo cáo human
8. **Report progress** — dùng template progress reporting

Xem `references/procedures.md` → "Agent Spawn Templates" để có prompt template cho từng phase.

#### IMP + TST Song Song

Sau SRS: một plan bao phủ cả IMP và TST → human approve → spawn `sdlc-imp` và `sdlc-tst` đồng thời → đợi cả hai → verify gates độc lập.

#### Sau mỗi Phase

Báo cáo cho human theo template:

```
✅ [Phase] hoàn thành — Reverse từ codebase
   📄 Output: [danh sách file đã tạo/cập nhật]
   🚦 Gate: [PASS/FAIL] ([N]/[M] criteria met)
   ⏭️  Next: [phase tiếp theo hoặc "Pipeline complete"]
   ⚠️  Issues: [list hoặc "Không có"]
```

### Bước 6: Validation & Summary

Sau khi tất cả artifacts được sinh:

1. **Cross-reference check** — đọc từng file agent_docs/, kiểm tra internal consistency giữa SRS ↔ HLD ↔ LLD ↔ IMP
2. **Coverage report** — so sánh modules từ scout report với modules được document trong artifacts
3. **Final summary**:

```
✅ SDLC Codebase — Pipeline Complete

   📄 agent_docs/ Status:
      ✅ project-overview.md  — foundation
      ✅ user-context.md      — foundation
      ✅ conventions.md       — foundation
      ✅ README.md            — feature index
      ✅ architecture.md      — HLD (extracted from code)
      ✅ features/*.md        — SRS ({N} features inferred)
      ✅ backend/*/           — LLD + IMP + TST
      ✅ frontend/*/          — LLD + IMP + TST

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
| `sprint` | Cập nhật board, backlog, roadmap |

### Subagents (spawn qua Agent tool)

| Agent | Phase | Mục đích |
|-------|-------|----------|
| `sdlc-hld` | HLD (reverse) | Extract architecture từ code: services, ADRs, C4 diagrams, boundaries |
| `sdlc-lld` | LLD (reverse) | Extract per-service design từ code: domain models, API contracts, data flow, error handling |
| `sdlc-srs` | SRS (reverse) | Infer functional + non-functional requirements từ code behavior |
| `sdlc-imp` | IMP (reverse) | Document implementation patterns, business rules, security considerations từ code |
| `sdlc-tst` | TST (reverse) | Document test patterns, coverage, fixtures, test architecture từ code |

---

## References

Tất cả reference files — chỉ load khi cần:

| File | Nội dung | Khi nào đọc |
|------|----------|-------------|
| `references/flow-reverse.md` | Procedure chi tiết cho reverse engineering pipeline: prompt templates cho từng phase, grilling integration, edge cases | Khi bắt đầu Bước 5 (Reverse Pipeline) |
| `references/procedures.md` | Shared procedures: Agent Spawn Templates (HLD/LLD/SRS/IMP/TST reverse mode), Gate Criteria, Progress Reporting templates, Error Handling, Cross-reference check procedure | Khi cần tạo prompt cho subagent, kiểm tra gate criteria, hoặc debug pipeline |

---

## Key Notes

- **Reverse ≠ Forward** — agent SDLC được prompt để EXTRACT từ code, không phải DESIGN từ specs. Cùng agent, khác prompt
- **Scout là mandatory** — không reverse engineer khi chưa có structured codebase map. Scout report là input chính cho mọi phase
- **File đã tồn tại = hỏi human** — không tự động overwrite. Hỏi: update, skip, hay merge
- **Code có thể không đủ thông tin** — khi code không thể hiện rõ business context (ví dụ: "tại sao chọn Kafka thay vì RabbitMQ?"), dùng `Skill("grilling")` để hỏi human
- **HLD và LLD được optional** — giống sdlc-orchestrator, hỏi human nếu không có service mới hoặc API mới
- **Coverage gaps là bình thường** — không phải mọi module đều cần document. Báo cáo gaps, để human quyết định
- **Preflight foundation được dùng lại** — preflight có thể đã được chạy bởi flow khác. Chỉ chạy lại nếu file thiếu
- **Idempotent** — an toàn khi chạy lại. File đã có → hỏi trước khi overwrite. Scout report được cache

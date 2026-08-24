---
name: architect
description: >-
  Trao đổi, hướng dẫn, và cấu trúc kiến trúc hệ thống — cùng human thảo luận để
  đạt được kiến trúc mà họ mong muốn. Dùng khi cần thiết kế kiến trúc hệ thống
  mới (project này hoặc hệ thống khác), nâng cấp kiến trúc hiện tại, đánh giá
  trade-off, viết C4/ADR, hoặc trao đổi thuần túy về architecture. Có thể đọc
  context (architecture.md, project-overview, user-context...) để có thêm thông
  tin — optional. KHÔNG liên quan đến sprint/sync. Coordinates architect-specialist
  (design/review/advisory/discuss) với plan-mode human validation. Tự trigger bởi
  Claude khi context cần — human không gõ /architect.
argument-hint: "[design][review][advisory][discuss] [description] [--auto]"
version: 1.1.0
user-invocable: false
allowed-tools: Read, Write, Bash(*), Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Agent, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Architect

Skill **tự trigger bởi Claude** trong context (architecture work cần thiết) — human không gõ
`/architect` (`user-invocable: false`). Đây là nơi **trao đổi, hướng dẫn, cấu trúc architect**:
cùng human thảo luận để đạt được kiến trúc mong muốn — hệ thống mới, nâng cấp hiện tại, hay
trao đổi thuần túy. KHÔNG làm sprint/sync.

## Quick Start

### Step 1: Parse Arguments

Extract from invocation args (caller là Claude qua `Skill()`, không phải human):
- **workflow type**: `design` → Design Workflow | `review` → Review Workflow | `advisory` → Advisory Workflow | `discuss` → Discussion Mode
- **description**: free-text describing what architecture work is needed
- **--auto flag**: if present, skip plan mode and execute directly

### Step 2: Route to Workflow

```
INPUT: [workflow-type] [description] [--auto]

MATCH workflow-type:
  design    → references/design-workflow.md
  review    → references/review-workflow.md
  advisory  → references/advisory-workflow.md
  discuss   → Discussion Mode (trao đổi thuần túy — mục bên dưới)
  NO MATCH  → AskUserQuestion to disambiguate
```

**If no match**, use AskUserQuestion:
- Question: "What architecture work do you need?" (header: "Workflow")
  Options: "Design new architecture" | "Review/upgrade existing architecture" | "Advisory/guidance" | "Discuss architecture thuần túy"
- Then ask: "Skip plan mode?" (header: "Auto Mode")
  Options: "Yes (--auto)" | "No (enter plan mode)"

## Common Phase: Input Context (Optional)

Đọc context để có thêm thông tin — **optional, không bắt buộc**:
- `agent_docs/architecture.md` — kiến trúc hiện tại (nếu có)
- `agent_docs/project-overview.md`, `agent_docs/user-context.md` — context dự án (nếu có)
- `agent_docs/features/*/FR-*.md`, `agent_docs/traceability/requirements-matrix.md` — SRS post-SRS (nếu có)
- `agent_docs/adrs/`, `domain-service-mapping.yaml`, `hard-boundaries.md`, `contracts/` — chi tiết kiến trúc (nếu có)

Thiếu context không phải blocker — nếu chưa có, thảo luận với human để thu thập yêu cầu/ý muốn
trực tiếp. Skill phục vụ **bất kỳ kiến trúc nào human mong muốn**: hệ thống mới (project này hoặc
hệ thống khác), nâng cấp kiến trúc hiện tại, hay trao đổi thuần túy.

## Common Phase: Create Workflow Tasks (MANDATORY — Always Execute First)

**CRITICAL: Always create tasks before spawning any agents.** After routing to a workflow, create the full task chain before entering Plan Mode or any phase.

Track workflow with Task tools. Each phase = one task with `blockedBy` chain. See `references/task-management.md` for all 3 complete workflow chains.

**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically.

## Common Phase: Plan Mode

Applies when `--auto` is NOT present.

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify requirements and draft the plan:
   - **Skill(sequential-thinking)** when: Design touches >=2 bounded contexts or >=3 architectural alternatives; Review finds >=3 Yellow/Red dimensions that interact; Advisory involves multi-option trade-off analysis
   - **Skill(problem-solving)** when: Requirements force trade-off between NFR categories; Review reveals conflicting architectural constraints; Advisory question has no clear best answer
3. On approval, spawn `Agent(general-purpose)` to write plan to:
   - Design: `.work/plans/arch-design-YYYYMMDD-{slug}.md`
   - Review: `.work/plans/arch-review-YYYYMMDD-{slug}.md`
   - Advisory: `.work/plans/arch-advisory-YYYYMMDD-{topic}-{slug}.md`
4. Confirm: "Plan written. Continue?" (header: "Proceed", options: "Continue to execution" | "Let me review")
5. Call `ExitPlanMode` to proceed.

## Workflow Overview

| Workflow | Pipeline | Reference |
|----------|----------|-----------|
| **Design** | Plan(opt) → architect-specialist(design) → Summary | `references/design-workflow.md` |
| **Review** | Plan(opt) → architect-specialist(review) → Summary | `references/review-workflow.md` |
| **Advisory** | Plan(opt) → architect-specialist(advisory) → Summary | `references/advisory-workflow.md` |
| **Discuss** | Trao đổi trực tiếp với human (không bắt buộc output) | Discussion Mode (inline) |

Each reference file contains: agent spawning order, brief templates, output expectations, report format, and next-step routing.

## Common Phase: Output Self-Check

No separate gate agent. architect-specialist **tự self-check** output theo Gate Criteria riêng của nó (xem `agent_docs/` design: architecture.md, adrs/, domain-service-mapping.yaml, hard-boundaries.md, contracts/) trước khi báo cáo. Kiểm tra tồn tại file cuối cùng thuộc caller (vd sdlc-architect Bước 3). Nếu output thiếu/không đạt → re-spawn architect-specialist với feedback cụ thể (max 3 retries). Human là validator qua plan mode.

## Không Sprint/Sync

Skill này chuyên về **trao đổi + cấu trúc architect** — KHÔNG update sprint, backlog, hay
roadmap. Sprint artifacts (nếu cần) do controller/orchestrator xử lý qua `Skill(sprint)` /
`sdlc-sprint-*`, ngoài phạm vi skill này.

## Discussion Mode (trao đổi thuần túy)

Khi human chỉ muốn trao đổi về architecture mà chưa cần output:

1. Đọc context có sẵn nếu helpful (optional — xem "Input Context" bên trên)
2. Thảo luận với human — đặt câu hỏi, trình bày options/trade-offs, giữ cuộc trao đổi tương tác
3. KHÔNG bắt buộc viết file. Chỉ ghi lại outcome (ADR/architecture doc) nếu human yêu cầu, và chỉ vào `agent_docs/` (agent SSOT)
4. Kết thúc bằng tóm tắt điều đã thống nhất + open questions

Không spawn architect-specialist trừ khi cần phân tích sâu (≥2 bounded contexts, nhiều options,
trade-off phức tạp) hoặc human muốn.

## Key Notes

**architect-specialist subagent** handles architecture execution khi cần phân tích/thiết kế sâu. This skill orchestrates — routes to the right mode, manages plan approval, verifies outputs. Never do deep architecture work inline; delegate to architect-specialist. Trao đổi nhẹ (discussion mode) có thể làm trực tiếp với human.

**Self-contained briefs.** Each agent brief includes: project context, mode-specific instructions, prior outputs (if re-spawning), deliverable expected. See `references/agent-brief-templates.md`.

**No separate gate.** architect-specialist tự self-check output theo Gate Criteria của nó trước khi báo cáo. Nếu output không đạt → re-spawn với feedback (max 3 retries). Human là validator qua plan mode; sdlc-architect (nếu là caller) verify file tồn tại.

**Plan mode is optional.** Use `--auto` to skip. Without `--auto`, always plan before executing. Architecture decisions are high-impact — plan mode is the default.

**Discussion-first.** Skill này là nơi trao đổi/hướng dẫn cấu trúc architect — cùng human thảo luận để đạt kiến trúc mong muốn. Không phải pipeline tự động: input **optional**, target có thể là bất kỳ hệ thống nào (mới, nâng cấp hiện tại, hay trao đổi thuần túy). **Không sprint/sync** — sprint artifacts thuộc controller.

**Error recovery.** Agent error (không phải output không đạt criteria): log, ask human retry/skip. Never auto-retry on errors.

**Report paths.** `mkdir -p .work/plans .work/reports` before writing.

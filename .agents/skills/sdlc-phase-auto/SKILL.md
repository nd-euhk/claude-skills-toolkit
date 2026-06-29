---
name: sdlc-phase-auto
description: >-
  Thực thi một hoặc nhiều pha SDLC (SRS, HLD, LLD, IMP, TST) ở chế độ tự động
  không tương tác, sử dụng workflow-sdlc-auto-pipeline cho deterministic agent
  chains và Agent(Explore) cho xác minh gate. Dùng khi một skill cần chạy pha
  SDLC cụ thể mà không cần sự tham gia của con người — không phải toàn bộ pipeline.
  Luôn chạy brainstorming trước khi thực thi để phân tích input.
user-invocable: false
version: 2.0.0
argument-hint: "[full][srs][hld][lld][imp][tst] [--no-gate]"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Workflow, TaskCreate, TaskUpdate, TaskGet, TaskList
---

# SDLC Phase Auto — Single-Phase Executor (Automated)

Thực thi pha SDLC ở chế độ tự động hoàn toàn. Bạn được gọi bởi các skill khác (vd: `sdlc-workflow`) cần chạy pha cụ thể mà không có sự tham gia của con người.

**Khác biệt chính với `sdlc-phase-manual`:**
| Khía cạnh | sdlc-phase-manual | sdlc-phase-auto |
|-----------|-------------------|-----------------|
| Brainstorming | Tương tác với con người | Tự động qua `Skill(brainstorming)` |
| Execution engine | Agent trực tiếp | `workflow-sdlc-auto-pipeline.js` |
| Gate verification | Agent(Explore) prompt thủ công | Agent(Explore) trong workflow script |
| Human interaction | Có thể | Không |
| Resumability | Không | Có (workflow resume) |
| Multi-phase | Một phase mỗi lần gọi | Hỗ trợ nhiều phase qua `phases[]` |

## Architecture

Toàn bộ quá trình thực thi được ủy thác cho **`workflow-sdlc-auto-pipeline.js`** — một workflow script duy nhất xử lý tất cả các phase. Pipeline nội bộ xử lý: preflight check → specialist execution → gate verification → retry loop → IMP+TST parallel.

```
CALLING SKILL
  ↓ context + quyết định phase
sdlc-phase-auto (bạn)
  ├── Step 0: phân tích input, xác định thông tin cần thiết
        ├── Skill(brainstorming) → thu thập yêu cầu, khám phá tùy chọn CÙNG với con người
        ├── Agent(Explore) → quét codebase tìm pattern hiện có
        ├── Skill(sequential-thinking) → phân tích quyết định phức tạp
        └── Skill(problem-solving) → giải quyết xung đột
  ├── Step 1: Xác định phases[] từ calling context + kết quả brainstorming
  └── Step 2: Workflow(workflow-sdlc-auto-pipeline.js, { phases, ...args })
        ├── Preflight → check phase outputs hiện có
        ├── SRS → Gate → (retry nếu fail)
        ├── HLD → Gate → (retry nếu fail)
        ├── LLD → Gate → (retry nếu fail)
        ├── IMP + TST (song song) → Gate → (retry nếu fail)
        └── Report → general-purpose tổng hợp báo cáo
```

**Tại sao dùng `workflow-sdlc-auto-pipeline`:** Một workflow duy nhất thay thế 5 workflow riêng lẻ (`workflow-auto-srs.js`, `workflow-auto-hld.js`, ...). Pipeline hỗ trợ:
- Chạy từng phase qua `phases: ['srs']` hoặc `phases: ['imp', 'tst']`
- IMP+TST luôn song song (tự động trong pipeline)
- Preflight check idempotent (skip phase đã hoàn thành)
- Retry loop (max 3 lần) cho mỗi phase
- Gate verification dùng Agent(Explore) — read-only
- Cờ `--no-gate` để bỏ qua toàn bộ verification
- Báo cáo tổng hợp tự động vào `.work/reports/`

## Quick Start

### Step 0: Brainstorming (BẮT BUỘC)

**Luôn chạy brainstorming trước khi thực thi bất kỳ phase nào.** Gọi `Skill(brainstorming)` với toàn bộ input context từ skill gọi để phân tích:

- Pha nào cần chạy? Có cần chạy nhiều pha không?
- Input artifacts đã có những gì? Thiếu gì?
- Có cần `--no-gate` không?
- Có ràng buộc đặc biệt nào từ context không?

```
Skill(brainstorming) với input:
- Task ID, title, description
- Plan file (nếu có)
- Phase được yêu cầu
- Context từ skill gọi
```

**Output brainstorming:** Xác nhận phase(s) cần chạy, flags, và context tổng hợp để truyền vào `brainstormingContext`.

### Step 1: Xác Định Phases

Dựa trên calling context + kết quả brainstorming, xác định `phases[]`:

| Trigger Keywords | Phase | phases[] |
|------------------|-------|----------|
| requirements, specification, SRS, FR, functional requirements, Gherkin, NFR | **SRS** | `['srs']` |
| architecture, HLD, design system, C4, ADR, service boundaries | **HLD** | `['hld']` |
| technical design, LLD, domain model, API contract, work packages | **LLD** | `['lld']` |
| implementation spec, IMP, execution flow, business rules mapping | **IMP** | `['imp']` |
| test spec, TST, test cases, unit test, integration test, E2E test | **TST** | `['tst']` |
| imp+tst cùng lúc, IMP and TST, cả IMP và TST | **IMP+TST** | `['imp', 'tst']` |
| full, all, complete pipeline, toàn bộ | **Full** | `['srs', 'hld', 'lld', 'imp', 'tst']` |

Nếu phase không rõ ràng, dùng `Skill(sequential-thinking)` để phân định. **KHÔNG hỏi con người.**

### Step 2: Parse Arguments

Trích xuất từ calling context:
- `--no-gate`: Bỏ qua gate verification. Truyền `noGate: true` vào workflow args.
- Các tham số: `taskId`, `taskTitle`, `taskDescription`, `planFile`, `slug` (từ skill gọi)
- `brainstormingContext`: Kết quả từ Step 0

### Step 3: Invoke Workflow

```js
Workflow({
  name: "workflow-sdlc-auto-pipeline",
  args: {
    taskId: "{task-id}",
    taskTitle: "{task-title}",
    taskDescription: "{task-description}",
    planFile: "{plan-file-path}",
    slug: "{task-slug}",
    phases: ["srs"],               // phase(s) cần chạy
    noGate: true/false,            // từ --no-gate flag
    brainstormingContext: "{...}"  // kết quả từ Step 0 brainstorming
  }
})
```

**Ví dụ — chạy IMP và TST song song:**
```js
Workflow({
  name: "workflow-sdlc-auto-pipeline",
  args: {
    taskId: "TASK-001",
    taskTitle: "Đăng nhập bằng email",
    taskDescription: "Cho phép người dùng đăng nhập bằng email và mật khẩu",
    planFile: ".work/plans/TASK-001-plan.md",
    slug: "email-login",
    phases: ["imp", "tst"],
    noGate: false,
    brainstormingContext: "IMP sẽ tạo đặc tả triển khai cho auth-service..."
  }
})
```

### Step 4: Process Result

Workflow trả về structured result:

**Success:**
```js
{
  mode: 'auto-pipeline',
  status: 'SUCCESS',
  runDate: '20260616',
  slug: 'email-login',
  phases: { srs: 'PASSED', hld: 'SKIPPED', lld: 'SKIPPED', imp: 'PASSED', tst: 'PASSED' },
  completed: ['IMP', 'TST'],
  skipped: ['SRS', 'HLD', 'LLD'],
  failed: [],
  noGate: false,
  requestedPhases: ['imp', 'tst'],
  reportFile: '.work/reports/workflow-sdlc-auto-pipeline/workflow-report-20260616--email-login.md'
}
```

**Partial Failure:**
```js
{
  mode: 'auto-pipeline',
  status: 'PARTIAL_FAILURE',
  phases: { srs: 'PASSED', hld: 'FAILED', lld: 'NOT_REQUESTED', imp: 'NOT_REQUESTED', tst: 'NOT_REQUESTED' },
  completed: ['SRS'],
  failed: ['HLD'],
  reportFile: '.work/reports/workflow-sdlc-auto-pipeline/workflow-report-20260616--email-login.md'
}
```

### Step 5: Return Results

Trả về structured summary cho skill gọi:
- Phase đã thực thi và trạng thái từng phase
- Workflow script đã dùng: `workflow-sdlc-auto-pipeline`
- Gate verification: pass/fail — hoặc `SKIPPED (--no-gate)`
- Report file được tạo tại `.work/reports/workflow-sdlc-auto-pipeline/`
- Số lần retry (nếu có)
- Bất kỳ blockers hoặc issues nào

## Specialist Agent Mapping

Mỗi phase dùng đúng specialist agent type (được workflow nội bộ xử lý):

| Phase | Specialist Agent | Gate Verification |
|-------|-----------------|-------------------|
| SRS | `phase-srs-specialist` | `Agent(Explore)` với gate-verifier-srs.md |
| HLD | `phase-hld-specialist` | `Agent(Explore)` với gate-verifier-hld.md |
| LLD | `phase-lld-specialist` | `Agent(Explore)` với gate-verifier-lld.md |
| IMP | `phase-imp-specialist` | `Agent(Explore)` với gate-verifier-imp.md |
| TST | `phase-tst-specialist` | `Agent(Explore)` với gate-verifier-tst.md |

Gate criteria files: `.claude/agents/_shared/gate-verifier/gate-verifier-{phase}.md`

## IMP + TST Song Song

Pipeline tự động chạy IMP và TST song song khi cả hai có trong `phases[]`. Không cần code riêng — `workflow-sdlc-auto-pipeline` dùng `parallel()` nội bộ:

```
IMP (phase-imp-specialist) ←→ TST (phase-tst-specialist)
      ↓ gate                         ↓ gate
   [retry nếu fail]              [retry nếu fail]
```

## Sequential Execution trong Pipeline

Pipeline xử lý tuần tự có kiểm soát:

```
SRS ──→ Gate ──→ HLD ──→ Gate ──→ LLD ──→ Gate ──→ IMP+TST (//)
  ↓ fail → dừng    ↓ fail → dừng    ↓ fail → dừng       ↓ gate riêng
```

- Nếu một phase fail gate sau 3 lần retry → các phase sau bị chặn
- Pipeline vẫn chạy đến cuối để tạo báo cáo tổng hợp
- `--no-gate` bỏ qua tất cả gate check và preflight check

## Common Reasoning Skills

### Skill(brainstorming)
Dùng TRƯỚC KHI bắt đầu creative work: khám phá requirements intent, đánh giá architectural approaches, tranh luận design alternatives. Cần phải bắt đầu với brainstorming trừ khi inputs đã crystal-clear và unambiguous.

**Khi nào skip:** Calling skill đã cung cấp detailed plan không có ambiguity; inputs straightforward với một obvious approach duy nhất.

### Skill(sequential-thinking)
Dùng khi đối mặt với decisions ảnh hưởng đến nhiều components hoặc cần step-by-step analysis:
- Multi-step reasoning có dependencies
- Hypothesis verification trước khi commit vào một direction
- Adaptive planning khi new information xuất hiện mid-phase
- LUÔN dùng trước khi đưa ra questions/solutions cho con người hoặc calling skill

**Anti-pattern:** Dùng sequential-thinking cho trivial single-step decisions (vd: "nên đọc file A hay file B").

### Skill(problem-solving)
Dùng khi stuck trên complex problems:
- Requirements ambiguous với nhiều valid interpretations
- Design constraints xung đột với nhau
- Implementation approach fundamentally unclear
- Cross-cutting concerns không fit clean patterns
- Kết hợp với sequential-thinking cho complex multi-variable problems

### Agent(Explore)
Dùng để codebase scanning khi phase cần discover existing patterns, files, hoặc conventions. Mỗi phase reference định nghĩa specific scouting triggers. Explore agent là read-only — dùng để discovery, không dùng để thay đổi.

## Key Notes

**Brainstorming bắt buộc.** Luôn chạy `Skill(brainstorming)` ở Step 0 trước khi thực thi. Không bao giờ bỏ qua.

**Single workflow script.** Tất cả phase dùng chung `workflow-sdlc-auto-pipeline.js`. Không còn các script `workflow-auto-{X}.js` riêng lẻ.

**No language check.** Prompt luôn bằng tiếng Việt — pipeline xử lý việc này nội bộ. Không cần truyền `language` arg.

**Creator ≠ Verifier.** Specialist tạo documents và Agent(Explore) verify documents LUÔN là các agents khác nhau.

**`--no-gate` bypass.** Dùng khi calling skill tự xử lý verification riêng. Luôn ghi chú `SKIPPED (--no-gate)` trong return summary.

**No sprint integration.** Bạn KHÔNG cập nhật sprint artifacts. Đó là trách nhiệm của calling skill.

**No plan mode.** Bạn không vào plan mode. Calling skill xử lý planning trước khi gọi bạn.

**Templates.** Mỗi specialist agent biết default templates của nó. Trừ khi calling skill override, dùng agent's defaults.

**Task management.** Dùng Task tools để track progress.

**Pipeline tự động.** `workflow-sdlc-auto-pipeline` xử lý: preflight check, idempotent skip, gate verification, retry loop, IMP+TST parallel, và báo cáo tổng hợp. Bạn chỉ cần truyền đúng args.

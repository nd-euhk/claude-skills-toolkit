---
name: sdlc-cook
description: >-
  TDD code execution từ ready specs, luôn hoạt động trên git worktree để cô lập
  hoàn toàn thay đổi khỏi workspace chính. Tự động phát hiện cấu trúc project
  (submodule, sub-project gitignored, hoặc workspace-as-project) và tạo worktree
  phù hợp. Dùng khi cần cook code, implement features từ specs đã có, chạy TDD
  cycle, build feature trong môi trường cô lập: "cook task", "code task",
  "implement feature", "build feature", "triển khai code", "cook FR-XXX".
  Khác với sdlc-orchestrator (HITL từng phase, không worktree) và sdlc-automation
  (autonomous pipeline, không worktree) — skill này luôn tạo worktree trước khi
  thực thi. Controller điều phối subagents, không tự viết code.
version: 1.1.0
user-invocable: true
allowed-tools: Read, Write, Edit, Bash(git:*,find:*,ls:*,mkdir:*,cd:*,wc:*), Glob, Skill, Agent, AskUserQuestion
---

# SDLC Cook

Điểm vào cho TDD code execution từ ready specs, **luôn hoạt động trên git worktree**.
Bạn phát hiện cấu trúc project, tạo worktree cô lập, sau đó điều phối toàn bộ TDD
cycle qua subagents. Bạn **không** tự viết code — bạn điều phối.

| | sdlc-orchestrator (cook flow) | sdlc-automation (cook flow) | **sdlc-cook** |
|---|---|---|---|
| **Cô lập** | Không — chạy trên workspace chính | Không — chạy trên workspace chính | **Worktree bắt buộc** |
| **Tương tác** | Từng phase (Plan→Review→Spawn) | Một lần upfront | **Grilling một lần, sau đó tự chạy** |
| **TDD cycle** | Full (baseline → per-TC → GATE 2 lớp) | Full autonomous | **Full — giống orchestrator** |
| **Phù hợp khi** | Cần review từng bước | Đã rõ, muốn autonomous | **Cần cô lập worktree, muốn an toàn** |

---

## Hard Boundaries

Đây là các quy tắc KHÔNG THỂ NEGOTIATE:

- **Worktree bắt buộc** — mọi cook execution phải chạy trên git worktree. Không worktree = không cook
- **Bạn điều phối, không thực thi** — không viết code, chỉ spawn subagents
- **Không check dirty** — worktree checkout từ branch, không cần kiểm tra dirty state của workspace
- **Không skip pipeline phases** — baseline → per-TC RED→GREEN→REFACTOR-light → GATE light → REFACTOR full → GATE full. Không skip
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--board --backlog")`
- **Không tự sửa feature specs** — chỉ sdlc-srs và sdlc-lld touch `agent_docs/features/`
- **Tuần tự mặc định** — backend trước, frontend sau. Song song chỉ khi xác nhận với human

---

## Preflight: Project Detection + Worktree

Chạy TRƯỚC mọi thứ khác. Phát hiện project type (3 cases, first match wins) → tạo
worktree tại `.claude/worktrees/cook-<project>-<timestamp>` → verify → chuyển vào
worktree.

**3 cases:** (1) Git Submodule → tạo worktree từ submodule repo. (2) Sub-project bị
gitignore → tạo worktree từ sub-project. (3) Fallback → workspace là project.

> **Chi tiết đầy đủ**: bash commands cho từng case, verification, cleanup — `references/preflight.md`

---

## Cook Flow

Sau khi worktree đã sẵn sàng, thực thi tuần tự các bước sau. Mọi thao tác diễn ra
**trong worktree** (absolute paths).

### Bước 1: Readiness Check

Đọc `.work/board.md` và `.work/backlog.md`. Tìm task → route theo status:

| Status | Hành động |
|---|---|
| **ready** | Tiếp tục Bước 2 |
| **TODO** | Từ chối: "Task chưa có specs. Chạy flow task trước." |
| **in progress** | Cảnh báo + hỏi: tiếp tục hay spawn thêm developer? |
| **review** | Cảnh báo + hỏi: cook lại từ đầu hay fix review findings? |
| **done** | Cảnh báo: "Đã done. Sửa gì? Nếu bug → flow fixbug." |
| **Không tìm thấy** | Từ chối: "Task không tồn tại." |

### Bước 2: Verify Prerequisites

Check feature spec (`agent_docs/features/{FR_ID}.md`), IMP + TST specs, hard-boundaries,
tech-design. Thiếu IMP/TST → từ chối: "Cần flow task để tạo specs."

### Bước 3: Grilling Interview

Dùng `AskUserQuestion` từng câu một:
1. **Service & Target**: Backend, frontend, hay cả hai?
2. **TC Ordering**: Mặc định CRITICAL → HIGH → MEDIUM → LOW
3. **Auto-push**: Cho phép auto-push sau khi tất cả gates pass?

### Bước 4: Move to In Progress

```bash
Skill("sprint", "--board --backlog")
```
Board: `ready` → `in progress`.

### Bước 5: TDD Orchestration

Đây là bước CỐT LÕI. Điều phối per-testcase TDD cycle qua subagents:

```
Cho mỗi TC (tuần tự):              Sau tất cả TCs:
  RED (mini-orchestrator)            GATE light (4 checks)
  ├─ Viết test                       ├─ PASS → REFACTOR full (6 categories)
  ├─ Verify RED                      └─ FAIL → fix → retry (max 2)
  ├─ Accidental green? → detect
  ├─ Spawn GREEN (implement)
  └─ Spawn REFACTOR-light (cleanup)
```

**5.1 Trích xuất TCs:** Đọc TST spec → trích xuất ID, tên, layer, risk. Sắp xếp CRITICAL→LOW.

**5.2 BE/FE routing:** Có `backend_service` → BE agents. Có `frontend_app` → FE agents.
Cả hai → BE trước, FE sau.

**5.3 Baseline:** Chạy `.claude/scripts/baseline parse` → ghi `.work/baselines/`.
Pre-existing failures không phải interference.

**5.4 Per-TC RED:** Spawn `sdlc-tdd-{be|fe}-red` cho từng TC. Return codes:
DONE → tiếp | SKIPPED → tiếp | INTERFERENCE → dừng | BLOCKED → dừng | STALE → hỏi human.

**5.5 Tổng hợp:** Liệt kê kết quả từng TC. Có INTERFERENCE → không proceed.

**5.6 GATE Light:** Spawn `sdlc-tdd-{be|fe}-gate --mode=light`. 4 checks → PASS/FAIL.

**5.7 REFACTOR Full:** Spawn `sdlc-tdd-{be|fe}-refactor --mode=full`. 6 categories.

**5.8 GATE Full:** Spawn `sdlc-tdd-{be|fe}-gate --mode=full`. 10 gates → code ready.

> **Chi tiết đầy đủ**: readiness routing table, bash commands cho prerequisites, TDD
> orchestration steps, GATE specs — `references/cook-flow.md`
>
> **Agent spawn templates**: prompt đầy đủ với biến, return codes, expected behavior cho
> baseline, RED, GREEN, REFACTOR, GATE — `references/agent-templates.md`

### Bước 6: Code Review

```bash
Skill("sdlc-review", "--code")
```

### Bước 7: Git Commit & Push

```bash
Skill("git")
```
Format: `feat({FR_ID}): {feature name}`. Xác nhận với human trước khi push.

### Bước 8: Sprint Update

```bash
Skill("sprint", "--all")
```
Board: `in progress` → `in review` → `done`.

### Bước 9: Exit Worktree

Dọn dẹp worktree sau cook. Policy: code đã push → xóa; chưa push → giữ; abort → hỏi human.

> **Cleanup policy đầy đủ** — `references/preflight.md`

---

## Cook Flow Summary

```
Preflight: Project Detection → Worktree Creation → Enter Worktree
                                                          │
Bước 1: Readiness Check → Bước 2: Prerequisites → Bước 3: Grilling
                                                          │
                                                          ▼
Bước 4: Move to In Progress → Bước 5: TDD Orchestration ──────────┐
│                                                                   │
│  ┌─ BASELINE Capture ──────────────────────────────────────────┐ │
│  │ .claude/scripts/baseline parse                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ TC-1 ──────────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-{be|fe}-red (mini-orchestrator)                     │ │
│  │   ├─ Write test → Verify RED → Accidental green?            │ │
│  │   ├─ Spawn GREEN (implement tối thiểu)                       │ │
│  │   ├─ INTERFERENCE-LIGHT (same-file test check)              │ │
│  │   └─ Spawn REFACTOR-light (cleanup per-TC)                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─ TC-2 ... TC-N ────────────────────────────────────────────┐ │
│  │  ...tuần tự, mỗi TC build trên code của TC trước...          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ GATE Light ────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-{be|fe}-gate --mode=light (4 critical checks)      │ │
│  │   L1: Test Suite + INTERFERENCE-FULL                         │ │
│  │   L2-L4: Hard Boundaries, Query/Token Safety, Resilience     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─ REFACTOR Full ─────────────────────────────────────────────┐ │
│  │ sdlc-tdd-{be|fe}-refactor --mode=full (6 categories)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─ GATE Full ─────────────────────────────────────────────────┐ │
│  │ sdlc-tdd-{be|fe}-gate --mode=full (10 gates)                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
Bước 6: Code Review → Bước 7: Git Push → Bước 8: Sprint Update
                                                          │
                                                          ▼
                                              Bước 9: Exit Worktree
```

---

## Error Handling

Controller xử lý lỗi theo error matrix. Nguyên tắc: dừng pipeline khi RED INTERFERENCE
hoặc BLOCKED; retry max 2 lần cho GATE fail; subagent crash → báo human.

> **Ma trận đầy đủ** (14 tình huống + cleanup policy) — `references/error-handling.md`

---

## When NOT to Use sdlc-cook

- **Chưa có ready specs** — IMP và TST specs phải tồn tại. Nếu chưa → flow task
- **Không muốn worktree** — nếu human không muốn cô lập → dùng orchestrator cook flow
- **High-risk changes cần human review từng TC** — dùng orchestrator HITL
- **Task quá nhỏ (≤2 file, không API/schema/security)** — dùng sdlc-quick

---

## Skill & Agent Reference

### Skills (invoke qua Skill tool)

| Skill | Mục đích |
|---|---|
| `sdlc-review` | Review code mới (--code, --full) |
| `sprint` | Cập nhật board, backlog, roadmap |
| `git` | Commit và push |

### Subagents (spawn qua Agent tool)

| Agent | Phase | Mục đích |
|---|---|---|
| `sdlc-tdd-be-red` | RED (per-TC) | Mini-orchestrator: viết test → verify RED → accidental green detect → spawn GREEN + REFACTOR-light |
| `sdlc-tdd-be-green` | GREEN (per-TC) | Implement code tối thiểu pass test hiện tại |
| `sdlc-tdd-be-refactor` | REFACTOR | Light: per-TC cleanup. Full: 6 categories |
| `sdlc-tdd-be-gate` | GATE | Light: 4 checks. Full: 10 gates |
| `sdlc-tdd-fe-red` | RED (per-TC) | Như BE — mini-orchestrator cho frontend |
| `sdlc-tdd-fe-green` | GREEN (per-TC) | Implement UI code tối thiểu |
| `sdlc-tdd-fe-refactor` | REFACTOR | Light: per-TC cleanup. Full: a11y, UX, perf, security, code quality |
| `sdlc-tdd-fe-gate` | GATE | Light: 4 checks. Full: 10 gates |

---

## Reference Index

| File | Nội dung | Khi nào đọc |
|---|---|---|
| `references/preflight.md` | Project detection (3 cases), worktree creation (3 cases), verification, exit + cleanup policy | Preflight phase — trước khi bắt đầu cook |
| `references/cook-flow.md` | Readiness routing, prerequisites bash commands, TDD orchestration steps, GATE specs, post-TDD steps | Bước 1-8 — trong suốt cook flow |
| `references/agent-templates.md` | Agent spawn templates đầy đủ: baseline capture, RED (mini-orchestrator), GREEN, REFACTOR light/full, GATE light/full. Mỗi template có tất cả biến, context, expected behavior, và return codes | Trước mỗi lần spawn TDD agent |
| `references/error-handling.md` | Error handling matrix (14 tình huống) + worktree cleanup policy | Khi gặp error trong bất kỳ phase nào |

Canonical TDD procedure (interference detection protocol, backend+frontend ordering)
được giữ trong `sdlc-orchestrator/references/flow-cook.md`.

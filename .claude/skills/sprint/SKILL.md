---
name: sprint
description: >-
  Quản lý sprint artifacts (board, backlog, roadmap) qua subagent chuyên biệt.
  Dùng khi cần cập nhật sprint board, backlog, roadmap, khởi tạo board/backlog,
  move task, hoặc đồng bộ sprint artifacts sau khi specs pipeline hoàn thành.
  Thin routing layer — spawn sdlc-sprint-* subagents, không tự sửa file.
version: 1.0.0
user-invocable: false
allowed-tools: Read, Bash, Agent
---

# Sprint — Sprint Artifacts Router

Skill định tuyến mỏng cho quản lý sprint. **KHÔNG tự sửa file** — chỉ spawn subagent `sdlc-sprint-*`. Mỗi subagent có hard boundary (chỉ ghi đúng file của nó), nên spawn song song là an toàn.

## Quick Start

```
Skill(sprint)                    # không flag → auto-detect intent
Skill(sprint, "--board")         # chỉ spawn sdlc-sprint-board
Skill(sprint, "--backlog")       # chỉ spawn sdlc-sprint-backlog
Skill(sprint, "--roadmap")       # chỉ spawn sdlc-sprint-roadmap
Skill(sprint, "--all")           # spawn cả 3 song song
Skill(sprint, "--init")          # first-time setup — cả 3 song song

# Kết hợp nhiều flag:
Skill(sprint, "--board --backlog")       # spawn 2 agent song song
Skill(sprint, "--board --roadmap")       # spawn 2 agent song song
```

## Flag Reference

| Flag | Agent spawn | File đích | Dùng khi |
|------|------------|-----------|----------|
| *(không flag)* | auto-detect | — | Không chắc cần update gì — skill tự quyết định |
| `--board` | `sdlc-sprint-board` | `.work/board.md` | Task đổi status, move cột, flag blocked |
| `--backlog` | `sdlc-sprint-backlog` | `.work/backlog.md` | Priority thay đổi, feature mới, grooming |
| `--roadmap` | `sdlc-sprint-roadmap` | `agent_docs/roadmap.md` | Timeline/milestone thay đổi |
| `--all` | cả 3 song song | cả 3 file trên | Sau specs pipeline, fixbug, reverse engineer |
| `--init` | cả 3 song song | cả 3 file trên | Lần đầu setup — chưa có file nào tồn tại |

### Tổ hợp flag & hành vi

| Tổ hợp | Số agent | Hành vi |
|--------|---------|---------|
| *(không flag)* | 1-3 (auto) | Auto-detect: so sánh timestamps, chọn agent cần update |
| `--board` | 1 | Chỉ spawn `sdlc-sprint-board` |
| `--backlog` | 1 | Chỉ spawn `sdlc-sprint-backlog` |
| `--roadmap` | 1 | Chỉ spawn `sdlc-sprint-roadmap` |
| `--board --backlog` | 2 | Board + Backlog song song |
| `--board --roadmap` | 2 | Board + Roadmap song song |
| `--backlog --roadmap` | 2 | Backlog + Roadmap song song |
| `--all` | 3 | Cả 3 song song |
| `--init` | 3 | Cả 3 song song (first-time) |
| `--init --board` | 3 | `--init` luôn spawn cả 3 — flag đơn bị bỏ qua |
| `--all --backlog` | 3 | `--all` luôn spawn cả 3 — flag đơn bị bỏ qua |

### Flag priority

```
--init  >  --all  >  --board / --backlog / --roadmap  >  auto-detect
 (3)        (3)              (tổ hợp được)              (1-3, tự quyết)

--init và --all luôn spawn cả 3 agent, bất kể có flag đơn đi kèm.
Các flag đơn còn lại cộng dồn — --board --backlog = 2 agent.
```

## Core Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    Skill(sprint, flags)                  │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Parse Flag  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐   ┌─────▼─────┐
    │  --init   │   │   --all     │   │ no flag   │
    │  spawn 3  │   │   spawn 3   │   │ auto-     │
    │  agents   │   │   agents    │   │ detect    │
    └───────────┘   └─────────────┘   └─────┬─────┘
                                            │
                                   ┌────────▼────────┐
                                   │  Đọc file state  │
                                   │  So sánh time    │
                                   └────────┬────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                   ┌─────▼─────┐     ┌──────▼──────┐    ┌─────▼─────┐
                   │ FR mới    │     │ Task stuck  │    │ Không có  │
                   │ hơn board │     │ >3 ngày     │    │ file nào  │
                   └─────┬─────┘     └──────┬──────┘    └─────┬─────┘
                         │                  │                  │
                   ┌─────▼─────┐     ┌──────▼──────┐    ┌─────▼─────┐
                   │ --backlog │     │  --board    │    │  --init   │
                   │ --board   │     │             │    │           │
                   └───────────┘     └─────────────┘    └───────────┘
```

### Bước 1: Parse Flag

Đọc args string, tách flag:

```
args = "--board --backlog"
→ flags = ["--board", "--backlog"]
→ spawn: [sdlc-sprint-board, sdlc-sprint-backlog]
```

```
args = "" hoặc không có
→ flags = []
→ route sang auto-detect
```

### Bước 2: Đọc Context (auto-detect)

```bash
ls -la .work/board.md .work/backlog.md agent_docs/roadmap.md 2>/dev/null
ls agent_docs/features/FR-*.md 2>/dev/null | head -5
```

**Decision table cho auto-detect:**

| Điều kiện | Kết luận | Agent spawn |
|-----------|---------|-------------|
| Không file nào tồn tại | First-time setup | `--init` → cả 3 |
| FR-*.md mới hơn `backlog.md` | Có feature mới cần import | `--backlog` + `--board` |
| FR-*.md mới hơn `board.md` | Specs vừa cập nhật | `--backlog` + `--board` |
| Task trong board stuck >3 ngày | Cần audit board | `--board` |
| `agent_docs/` có file mới hơn `roadmap.md` | Phase thay đổi | `--roadmap` |
| Sau specs pipeline hoàn thành | Sync tổng thể | `--all` |
| Không khớp điều kiện nào | Sync an toàn | `--all` |

### Bước 3: Spawn Subagent(s)

**Single agent:**
```
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update sprint board",
  prompt: "[prompt từ template bên dưới]"
})
```

**Nhiều agent — spawn trong cùng 1 message để chạy song song:**

```
// An toàn: mỗi agent chỉ ghi file riêng
//   sdlc-sprint-backlog  → .work/backlog.md
//   sdlc-sprint-board    → .work/board.md
//   sdlc-sprint-roadmap  → agent_docs/roadmap.md

Agent({ subagent_type: "sdlc-sprint-backlog", description: "Update backlog", prompt: "..." })
Agent({ subagent_type: "sdlc-sprint-board",    description: "Update board",    prompt: "..." })
Agent({ subagent_type: "sdlc-sprint-roadmap",  description: "Update roadmap",  prompt: "..." })
```

### Bước 4: Tổng Hợp Kết Quả

| Kết quả | Hành vi |
|---------|---------|
| Tất cả OK | Báo cáo thành công, hiển thị summary từ mỗi agent |
| 1 agent lỗi | Báo agent nào lỗi + reason. Agent khác vẫn OK — **không rollback** |
| Agent type không tồn tại | Báo: `Agent sdlc-sprint-{x} không tìm thấy trong .claude/agents/sdlc/.` |
| Tất cả lỗi | Báo toàn bộ failure + suggest kiểm tra file system |

## Prompt Templates Cho Subagent

### `--board` → `sdlc-sprint-board`

```
Cập nhật sprint board (.work/board.md).

Context từ skill gọi: {caller_context}
Trigger: {task_moved | status_changed | new_sprint | sync_from_backlog}

Yêu cầu:
- Đọc .work/board.md (tạo mới nếu chưa có, dùng template .claude/templates/sprint/board-TEMPLATE.md)
- Đọc .work/backlog.md để tham khảo priority (không sửa)
- {specific_action}
- Tự kiểm tra: WIP limits, task không stuck >3 ngày, mọi task có status
```

### `--backlog` → `sdlc-sprint-backlog`

```
Cập nhật sprint backlog (.work/backlog.md).

Context từ skill gọi: {caller_context}
Trigger: {new_features | priority_change | grooming | specs_completed}

Yêu cầu:
- Đọc .work/backlog.md (tạo mới nếu chưa có, dùng template .claude/templates/sprint/backlog-TEMPLATE.md)
- Đọc agent_docs/features/FR-*.md và agent_docs/features/README.md để biết dependency graph
- Đọc agent_docs/roadmap.md để tham khảo timeline (không sửa)
- {specific_action}
- Tự kiểm tra: MoSCoW đầy đủ, không circular dependency, ready-for-dev gate
```

### `--roadmap` → `sdlc-sprint-roadmap`

```
Cập nhật project roadmap (agent_docs/roadmap.md).

Context từ skill gọi: {caller_context}
Trigger: {new_milestone | sprint_planning | phase_change | timeline_adjustment}

Yêu cầu:
- Đọc agent_docs/roadmap.md (tạo mới nếu chưa có, dùng template .claude/templates/sprint/roadmap-TEMPLATE.md)
- Đọc agent_docs/features/FR-*.md và agent_docs/features/README.md để biết dependency graph
- Đọc .work/backlog.md và .work/board.md để tham khảo (không sửa)
- {specific_action}
- Tự kiểm tra: current + next sprint có scope, milestones có date, rollback plan tồn tại
```

### `--all` / `--init` → prompt cho từng agent

| Flag | Board action | Backlog action | Roadmap action |
|------|-------------|---------------|----------------|
| `--all` | Đồng bộ task status từ specs mới nhất | Cập nhật priority + ready-for-dev gate | Cập nhật feature-to-phase mapping |
| `--init` | Tạo board mới, populate từ backlog | Tạo backlog mới, import FR-*.md với MoSCoW | Tạo roadmap mới: timeline + milestones |

## Integration Patterns

### Gọi từ skill SDLC khác

| Caller | Cách gọi | Giải thích |
|--------|---------|------------|
| `sdlc-orchestrator` (sau specs pipeline) | `Skill(sprint, "--all")` | Sync cả 3 artifacts sau SRS→HLD→LLD→IMP→TST |
| `sdlc-orchestrator` (move task) | `Skill(sprint, "--board")` | Chỉ update board khi task đổi cột |
| `sdlc-orchestrator` (fixbug xong) | `Skill(sprint, "--board")` | Sync board sau khi fix |
| `sdlc-orchestrator` (first setup) | `Skill(sprint, "--init")` | Khởi tạo toàn bộ sprint artifacts |
| `sdlc-automation` (specs hoàn thành) | `Skill(sprint, "--all")` | Sync sau automation pipeline |
| `sdlc-codebase` (reverse engineer xong) | `Skill(sprint, "--all")` | Sync sau khi sinh agent_docs từ code |

### Không flag — auto-detect

```
Skill(sprint)    # skill tự đọc file state và quyết định flag nào
```

## Subagent Reference

| Subagent | File được phép ghi | File chỉ đọc |
|----------|-------------------|-------------|
| `sdlc-sprint-backlog` | `.work/backlog.md` | `board.md`, `roadmap.md`, `agent_docs/features/` |
| `sdlc-sprint-board` | `.work/board.md` | `backlog.md`, `roadmap.md` |
| `sdlc-sprint-roadmap` | `agent_docs/roadmap.md` | `board.md`, `backlog.md`, `agent_docs/features/` |

## Error Handling

| Tình huống | Cách xử lý |
|-----------|-----------|
| Agent type không tồn tại | Báo lỗi: `Agent sdlc-sprint-{x} không tìm thấy trong .claude/agents/sdlc/. Không thể tiếp tục.` |
| File đích không ghi được | Báo lỗi từ agent, không rollback agent khác |
| 1/3 agent lỗi | Báo cáo agent nào lỗi + reason. Các agent còn lại vẫn OK. |
| Không có FR-*.md nào | Backlog agent tạo backlog rỗng. Board agent tạo board rỗng. Roadmap agent tạo roadmap với placeholder. |
| Gọi khi agent đang chạy trùng | Không spawn trùng — báo `Agent sdlc-sprint-{x} đang chạy. Đợi hoàn thành hoặc dùng flag khác.` |
| Flag không hợp lệ | Báo: `Flag không được hỗ trợ: {flag}. Dùng --board, --backlog, --roadmap, --all, --init.` |

## Hard Boundaries

- **Skill này KHÔNG tự sửa file** — mọi Write/Edit là của subagent
- **Không spawn trùng lặp** — kiểm tra agent đang chạy trước khi spawn
- **Không merge logic** — mỗi agent giữ nguyên trách nhiệm. Skill này không tổng hợp, không biến đổi output
- **Template luôn có sẵn** — agent dùng template trong `.claude/templates/sprint/` (và `.claude/templates/agt/` cho agent config templates)

---
name: sdlc-architect
description: >-
  Gate + router cho kiến trúc hệ thống trong forward/greenfield. Tự self-check
  đã có kiến trúc (agent_docs/architecture.md) chưa — chưa có thì BẮT BUỘC phải
  tạo: invoke skill `architect` (workflow design) để thiết kế — architect skill
  orchestrate qua agent architect-specialist (opus), plan mode là human gate
  (human validator, không phải tác giả). Verify architecture.md tồn tại sau khi
  hoàn tất. Dùng khi cần kiến trúc hệ thống, "architecture", "kiến trúc hệ
  thống", "tạo architecture", "logical architecture", trước SRS trong luồng
  forward/greenfield. Không dùng cho luồng reverse (kiến trúc extract từ code qua
  codebase-* pipeline).
version: 1.1.0
allowed-tools: Read, Write, Bash, Skill, AskUserQuestion
---

# SDLC Architect

Gate + router cho kiến trúc hệ thống trong forward/greenfield. Bắt đầu bằng
**self-check**: đã có kiến trúc chưa? **Chưa có → bắt buộc phải làm** — invoke
skill `architect` (workflow `design`) để thiết kế. Đã có → bỏ qua.

## Mối Quan Hệ

| Thành phần | Vai trò |
|---|---|
| **sdlc-architect** (skill này) | **Gate** — self-check tồn tại, route khi thiếu, verify sau khi xong |
| **architect** (skill) | **Doer** — orchestrate design/review/advisory, delegate cho architect-specialist |
| **architect-specialist** (agent, opus) | **Executor** — thiết kế thực tế (C4, ADRs, service decomposition, contracts) |

> Skill này **KHÔNG tự thiết kế**. Thiết kế qua skill `architect`. Xem
> `.claude/rules/sdlc-architect-rules.md` cho trigger + boundary (khi nào gọi,
> khi nào KHÔNG gọi).

## Hard Boundaries

- **Self-check trước tiên** — luôn check `agent_docs/architecture.md` tồn tại trước khi làm bất cứ gì
- **Bắt buộc phải có** — chưa có thì KHÔNG có path "bỏ qua". Skill chỉ hoàn tất khi `agent_docs/architecture.md` tồn tại (hoặc báo **BLOCKED** đang chờ human)
- **Luôn qua skill `architect`** — không spawn `architect-specialist` trực tiếp, không tự thiết kế inline. Architect skill quản lý plan mode (human gate); architect-specialist tự self-check output (không có gate agent riêng)
- **Human là validator, không phải tác giả** — invoke architect **KHÔNG `--auto`** (giữ plan mode = human approve trước khi architect-specialist viết)
- **Không overwrite** — đã có → skip, báo "đã tồn tại"

---

## Quick Start

```
/sdlc-architect      # Self-check + route sang architect skill nếu chưa có
```

**Input**: đọc `agent_docs/project-overview.md` nếu có (context cho architect brief).
Chưa có project-overview → architect plan mode sẽ thu thập qua human.

**Output**: `agent_docs/architecture.md` (+ artifacts của architect skill trong
`agent_docs/`: `adrs/`, `domain-service-mapping.yaml`, `hard-boundaries.md`,
`contracts/`) — ghi khi human approve qua architect plan mode. **KHÔNG viết `docs/`**
— human docs xử lý riêng qua human-docs pipeline.

---

## Core Workflow

### Bước 1: Self-check — đã có kiến trúc hệ thống chưa?

```bash
test -f agent_docs/architecture.md && echo "EXISTS" || echo "MISSING"
```

- **EXISTS** → `✅ architecture.md đã có — bỏ qua`. Done
- **MISSING** → **bắt buộc phải tạo** → Bước 2

### Bước 2: Note status + Invoke skill `architect`

1. **Note trạng thái** (giữ context qua compaction):
   ```bash
   mkdir -p .work/architecture-discussion-recap
   ```
   Append vào `.work/architecture-discussion-recap/architecture-discussion.md`:
   ```
   # Architecture Status
   - <ngày>: self-check MISSING → routing sang skill `architect` (design). Chưa có architecture.md
   ```

2. **Invoke** `Skill("architect", ...)` — workflow `design`, brief gồm:

```
Skill("architect", "design <project> — greenfield, agent_docs/architecture.md chưa
tồn tại. Input (optional context): agent_docs/project-overview.md (+ user-context.md
nếu có) — thiếu thì thảo luận với human. CHƯA có SRS/FR docs — thiết kế từ
project-overview + plan decisions, KHÔNG chờ SRS.md. KHÔNG dùng --auto — giữ plan
mode, human là validator. Backfill FR docs là điều kiện (post-SRS only) — pre-SRS
bỏ qua vì chưa có FR docs. Map service theo features/domains trong project-overview
thay vì FR (chưa có FR). Output CHỈ vào agent_docs/: agent_docs/architecture.md
(C4 inline), agent_docs/adrs/ADR-*.md (>=3), agent_docs/domain-service-mapping.yaml,
agent_docs/hard-boundaries.md, agent_docs/contracts/. KHÔNG viết docs/ — human docs
xử lý riêng qua human-docs pipeline.")
```

3. **Chờ** architect skill hoàn tất (plan mode → architect-specialist → self-check output).
   Nếu architect skill dừng chờ human → skill này báo BLOCKED, không hoàn tất.

### Bước 3: Verify — bắt buộc có

```bash
test -f agent_docs/architecture.md && echo "EXISTS" || echo "MISSING"
```

- **EXISTS** → `✅ architecture.md đã tạo qua architect skill` → Done
- **MISSING** → architecture chưa được tạo (human chưa approve trong plan mode, hoặc
  architect dừng). Báo **BLOCKED**: "đang chờ human confirm trong architect plan mode".
  KHÔNG coi là hoàn tất — bắt buộc phải có.

---

## Key Notes

- **sdlc-architect = gate, architect skill = doer** — skill này chỉ check + route + verify. Không thiết kế inline
- **Bắt buộc phải có** — chưa có → phải tạo qua architect skill; không trả "không có gì để làm"
- **Plan mode = human gate** — không `--auto`; human approve trước khi architect-specialist viết
- **Trigger + boundary** — xem `.claude/rules/sdlc-architect-rules.md`
- **Agent_docs direction** — architect skill/architect-specialist đã align agent_docs/ (input từ project-overview, output CHỈ agent_docs/); không đưa `docs/` vào flow
- **Luồng reverse không dùng** — kiến trúc của reverse extract từ code (codebase-* pipeline)

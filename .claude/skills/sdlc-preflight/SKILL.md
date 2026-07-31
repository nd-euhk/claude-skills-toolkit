---
name: sdlc-preflight
description: >-
  Pre-flight check — đảm bảo các file nền tảng trong agent_docs/ tồn tại
  trước khi các agent SDLC khác chạy. Kiểm tra project-overview.md,
  user-context.md, và conventions.md (optional). Nếu thiếu, dùng grilling
  để phỏng vấn human → Plan agent lên kế hoạch → human-in-the-loop approve
  → tạo file. Dùng khi bắt đầu SDLC pipeline, trước SRS phase, hoặc khi
  cần đảm bảo agent_docs/ sẵn sàng. Hỗ trợ CLI args: --project-overview,
  --user-context, --conventions.
version: 1.0.2
user-invocable: false
allowed-tools: Read, Write, Bash, Skill, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

# SDLC Preflight

Đảm bảo các file nền tảng trong `agent_docs/` tồn tại trước khi SDLC agents
chạy. Nếu file thiếu, bạn phỏng vấn human qua grilling, lập kế hoạch qua Plan
agent, và chỉ tạo file sau khi human approve. **Không tự ý bịa nội dung.**

## Hard Boundaries

- **Không tự bịa nội dung** — mọi nội dung file đến từ human (qua grilling) hoặc context có sẵn
- **Human-in-the-loop bắt buộc** — mỗi file thiếu: grilling → EnterPlanMode → Plan agent → ExitPlanMode. Không skip
- **Không overwrite file đã tồn tại** — nếu file đã có, skip, báo "đã tồn tại"
- **Tuần tự, không song song** — xử lý từng file một theo thứ tự ưu tiên
- **Hỏi từng câu một** — grilling luôn 1 câu 1 lần. Không gộp nhiều câu

---

## Quick Start

```
/sdlc-preflight                          # Tuần tự cả 3 file
/sdlc-preflight --project-overview       # Chỉ project-overview.md
/sdlc-preflight --user-context           # Chỉ user-context.md
/sdlc-preflight --conventions            # Chỉ conventions.md
/sdlc-preflight --project-overview --conventions  # Kết hợp
```

| File | Template |
|------|----------|
| `agent_docs/project-overview.md` | `.claude/templates/supporting/project-overview-TEMPLATE.md` |
| `agent_docs/user-context.md` | `.claude/templates/supporting/user-context-TEMPLATE.md` |
| `agent_docs/conventions.md` | `.claude/templates/supporting/conventions-TEMPLATE.md` |

---

## Core Workflow

### Bước 1: Parse Args → Todo List

```
--project-overview  → ["project-overview"]
--user-context      → ["user-context"]
--conventions       → ["conventions"]
(không args)        → ["project-overview", "user-context", "conventions"]
```

Thứ tự luôn cố định: **project-overview → user-context → conventions**.
Báo cáo danh sách file sẽ check trước khi bắt đầu.

### Bước 2: Đảm bảo `agent_docs/` tồn tại

```bash
mkdir -p agent_docs
```

### Bước 3: Process từng file tuần tự

Với mỗi file trong todo list:

#### 3.1 Check tồn tại

```bash
test -f agent_docs/<file>.md && echo "EXISTS" || echo "MISSING"
```
- EXISTS → `✅ <file>.md đã có — skip`, next
- MISSING → tiếp tục 3.2

#### 3.2 Grilling — Phỏng vấn human

Invoke `Skill("grilling")`. Prompt cho grilling có 2 phần:
1. Context đã biết (từ conversation, các file agent_docs/ đã có, BRD/URD nếu available)
2. Template target — grilling dùng template làm khung để đặt câu hỏi

Chiến lược chung cho mọi file:
- **Luôn hỏi từng câu một** — đợi human trả lời mới hỏi tiếp
- **Kiểm tra context trước** — nếu thông tin đã có sẵn, skip câu hỏi đó
- **Cho phép human skip** — nếu human muốn bỏ qua section nào, flag rõ "sẽ thiếu trong file"
- **Tổng hợp cuối cùng** — sau khi hỏi xong, dump toàn bộ kết quả vào 1 summary block

**Project Overview** — 11 section: What, Why, For Whom, Scope & Boundaries,
NFRs, Glossary, Tech Stack, Architecture Style, Key Business Rules,
Stakeholders, Communication Channels.
→ Xem `references/grilling-project-overview.md` cho thứ tự câu hỏi và gợi ý từng section.

**User Context** — 4 section: User Personas, User Journeys (Critical Paths),
Communication & Tone, Accessibility & Support.
→ Xem `references/grilling-user-context.md` cho câu hỏi mẫu từng persona và journey.

**Conventions** — Đặc biệt: xác định số microservices → suggest gộp/tách →
phỏng vấn nội dung.
→ Xem `references/grilling-conventions.md` cho logic suggest và procedure.

#### 3.3 EnterPlanMode → Plan agent

1. **EnterPlanMode**
2. **Spawn Plan agent** qua `Agent(type: "Plan")`:

```
Tạo kế hoạch cho agent_docs/<file>.md.
Template: .claude/templates/supporting/<template>.md

Kết quả grilling:
<summary block từ bước 3.2>

Yêu cầu:
- Map từng section template → thông tin đã có
- Flag section thiếu/chưa rõ → đề xuất hỏi lại
- Plan đủ chi tiết để human review và approve trong ExitPlanMode
```

3. Plan agent trả về → embed vào plan file

#### 3.4 ExitPlanMode — Human approve

1. **ExitPlanMode** → raise plan cho human
2. Approved → 3.5 | Rejected → quay lại 3.2

#### 3.5 Tạo file

1. Đọc template gốc
2. Điền kết quả grilling vào `{{...}}` placeholders
3. `{{date}}` → hôm nay, `{{author}}` → "sdlc-preflight"
4. Write `agent_docs/<file>.md`
5. Báo: `✅ Đã tạo agent_docs/<file>.md`

### Bước 4: Summary

```
Preflight hoàn tất:
  ✅ project-overview.md — đã tồn tại
  ✅ user-context.md     — đã tạo mới
  ⏭️ conventions.md      — skipped (optional)
```

---

## Conventions: Logic Gộp / Tách

Áp dụng riêng cho `conventions.md`. Xác định cấu trúc file trước khi grilling nội dung.

### Bảng suggest

| Tình huống | Suggest |
|------------|---------|
| 1-2 services, cùng stack | **Gộp 1 file** — Testing (Given/When/Then) và Git convention dùng chung, tách gây trùng lặp |
| 3+ services, đồng nhất stack (đều Java/Spring) | **Gộp 1 file** — stack giống nhau, tách không cần thiết |
| 3+ services, khác stack (Java + Go + Python) | **Tách** — mỗi stack có package structure, naming, test convention riêng |
| Có FE team riêng, độc lập | **Tách FE riêng** — `conventions.md` cho BE+shared, `frontend/conventions.md` cho FE |
| 1 monolith | **Gộp 1 file** — đơn giản, không cần phức tạp hóa |

### Procedure

1. **Thu thập context:** `domain-service-mapping.yaml` → `architecture.md` → conversation history → `project-overview.md` section 8
2. **Nếu chưa có gì** → hỏi: "Dự án có bao nhiêu microservices? Mỗi service dùng stack gì?"
3. **Trình bày suggestion** kèm lý do từ bảng trên → human quyết định gộp hay tách
4. **Ghi nhớ lựa chọn** → dùng làm input cho Plan agent bước 3.3

Sau khi human chọn, grilling nội dung conventions theo procedure trong
`references/grilling-conventions.md`.

---

## File Dependency Map

```
project-overview.md ──→ SRS cần: scope, glossary, NFRs, business rules
         │
user-context.md ──→ SRS cần: personas, user journeys, a11y
         │
conventions.md ──→ IMP cần: package structure, naming, testing
```

---

## Key Notes

- **Preflight không thay thế SRS** — chỉ tạo file nền tảng. SRS vẫn phải chạy sau
- **Conventions là optional** — nếu human skip, không block pipeline; warn khi IMP sắp chạy mà chưa có
- **File đã tồn tại = không đụng** — muốn update phải xóa file cũ hoặc dùng tool khác
- **Plan agent là mandatory gate** — không tạo file khi chưa qua Plan → human approve
- **Tự tạo `agent_docs/` nếu chưa có** — `mkdir -p` ở Bước 2, không cần orchestrator làm trước

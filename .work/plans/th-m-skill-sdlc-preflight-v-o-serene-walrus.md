# Kế hoạch: Tích hợp sdlc-preflight vào sdlc-orchestrator + Cập nhật agent

## Bối cảnh

- `sdlc-preflight` là skill độc lập, chưa được orchestrator gọi
- Cả 3 file nền tảng đều **đang MISSING**: project-overview.md, user-context.md, conventions.md
- **Các agent sdlc-* không đọc các file này** — SRS không biết project-overview, IMP không biết conventions
- Cần tích hợp 2 chiều: orchestrator gọi preflight + agent biết đọc file preflight tạo ra

## Phạm vi thay đổi: 7 file

| # | File | Loại | Mục đích |
|---|------|------|----------|
| 1 | `SKILL.md` (orchestrator) | orchestrator | Thêm Bước 3 Foundation Gate vào Preflight |
| 2 | `references/procedures.md` | orchestrator | Cập nhật Missing Prerequisites |
| 3 | `agents/sdlc/sdlc-srs.md` | agent | Thêm project-overview.md, user-context.md làm REQUIRED input |
| 4 | `agents/sdlc/sdlc-hld.md` | agent | Cập nhật optional → nêu rõ cần extract gì |
| 5 | `agents/sdlc/sdlc-lld.md` | agent | Thêm project-overview.md làm OPTIONAL input |
| 6 | `agents/sdlc/sdlc-imp.md` | agent | Thêm conventions.md làm REQUIRED input |
| 7 | `agents/sdlc/sdlc-tst.md` | agent | Thêm conventions.md làm RECOMMENDED input |

---

## Phần A: Orchestrator (2 file)

### A1. `SKILL.md` — Thêm Foundation Gate vào Preflight

**Vị trí:** Chèn Bước 3 mới giữa Flow Detection (dòng ~112) và Route (dòng 114). Bước 3 cũ → Bước 4.

**Nội dung Bước 3:**

```markdown
### Bước 3: Foundation Gate

Kiểm tra file nền tảng trong `agent_docs/`:

```bash
for f in project-overview.md user-context.md conventions.md; do
  test -f agent_docs/$f && echo "  ✅ $f" || echo "  ⚠️ MISSING: $f"
done
```

**Route theo flow đã phát hiện ở Bước 2:**

**task flow** — `project-overview.md` và `user-context.md` PHẢI tồn tại trước SRS:

1. Kiểm tra file thiếu:
   ```bash
   NEEDED=""
   test -f agent_docs/project-overview.md || NEEDED="$NEEDED --project-overview"
   test -f agent_docs/user-context.md || NEEDED="$NEEDED --user-context"
   test -f agent_docs/conventions.md || NEEDED="$NEEDED --conventions"
   ```

2. Nếu `NEEDED` không rỗng → `Skill("sdlc-preflight", NEEDED)` → đợi complete
3. Post-preflight verify — nếu file vẫn missing → **dừng pipeline**, báo cáo human
4. Báo cáo: "🏗️ Foundation: project-overview.md ✅ | user-context.md ✅ | conventions.md ✅"

**cr flow** — cảnh báo, hỏi human trước khi invoke:

1. Nếu thiếu → báo cáo + `AskUserQuestion`: "CR có thể cần SRS. Chạy preflight để tạo foundation files?"
2. Nếu human đồng ý → `Skill("sdlc-preflight", "--project-overview --user-context --conventions")`

**fixbug flow** — chỉ hiển thị trạng thái. Không block, không invoke.

**cook flow** — hiển thị trạng thái. Warn nếu conventions.md thiếu.
```

**Cập nhật khác trong SKILL.md:**
- Bước 3 cũ "Route đến Flow" → **Bước 4**
- Skill Reference table: thêm dòng `sdlc-preflight`
- Description frontmatter: thêm mention "sdlc-preflight"
- Version: `1.4.0` → `1.5.0`

### A2. `procedures.md` — Cập nhật Missing Prerequisites (Section 5.2)

Thay dòng `agent_docs/` cũ bằng:
```
| `agent_docs/` | "Project mới? Foundation Gate trong Preflight (SKILL.md Bước 3) sẽ invoke sdlc-preflight." |
| `agent_docs/project-overview.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--project-overview')`" |
| `agent_docs/user-context.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--user-context')`" |
| `agent_docs/conventions.md` | "Missing → Preflight Bước 3 tự động gọi `Skill(sdlc-preflight, '--conventions')` (cho task flow)" |
```

---

## Phần B: Agent Updates (5 file)

### B1. `sdlc-srs.md` — Thêm foundation files làm REQUIRED input

**Hiện tại:** Input Detection chỉ đọc `FR-*.md` và `requirements-matrix.md` từ agent_docs/.
Không hề đọc project-overview.md hay user-context.md.

**Thay đổi:** Thêm vào Input Detection step (trước khi đọc FR-*.md):

```markdown
0. Read `agent_docs/project-overview.md` — scope, glossary, NFR baselines, business rules, tech stack (REQUIRED)
0. Read `agent_docs/user-context.md` — personas, user journeys, accessibility requirements (REQUIRED)
```

Và cập nhật error handling:
```markdown
If foundation files are missing, report to orchestrator: "sdlc-preflight must run first — missing project-overview.md and/or user-context.md"
```

**Lý do:** SRS cần:
- Từ project-overview.md: scope để xác định phạm vi features, glossary để dùng terminology nhất quán, NFR baselines để định lượng, business rules để viết Gherkin
- Từ user-context.md: personas để viết user stories, user journeys để xác định happy path, a11y requirements

### B2. `sdlc-hld.md` — Cập nhật optional references

**Hiện tại:** Đã có project-overview.md và user-context.md là optional (dòng 36-37).

**Thay đổi:** Thêm context về việc extract gì từ mỗi file:

```markdown
3. Read `agent_docs/project-overview.md` — architecture style preference, tech stack, stakeholder constraints (recommended)
4. Read `agent_docs/user-context.md` — user personas for bounded context mapping, user journeys for service boundaries (recommended)
```

**Lý do:** HLD cần:
- Từ project-overview.md: architecture style (đã chọn từ trước?), tech stack (constraint cho ADRs), stakeholder requirements
- Từ user-context.md: user journeys giúp xác định service boundaries đúng

### B3. `sdlc-lld.md` — Thêm project-overview.md làm OPTIONAL input

**Hiện tại:** Input Detection không có project-overview.md.

**Thay đổi:** Thêm vào Input Detection (sau dòng 38, trước "If HLD outputs are missing"):

```markdown
7. Read `agent_docs/project-overview.md` — tech stack, architecture style context (optional)
```

**Lý do:** LLD cần biết tech stack để thiết kế service internals phù hợp (ví dụ: Spring Boot vs Node.js → transaction boundary pattern khác nhau).

### B4. `sdlc-imp.md` — Thêm conventions.md làm REQUIRED input

**Hiện tại:** Input Detection không có conventions.md.

**Thay đổi:** Thêm vào Input Detection (sau dòng đọc hard-boundaries.md):

```markdown
6. Read `agent_docs/conventions.md` — package structure, naming conventions, testing patterns (Given/When/Then), git conventions, DB conventions (REQUIRED)
```

Và cập nhật error handling:
```markdown
If conventions.md is missing, report to orchestrator: "sdlc-preflight must run first — missing conventions.md"
```

**Lý do:** IMP specs cần reference:
- Package structure: `com.example.{domain}.{layer}` → implementation specs phải tuân theo
- Naming conventions: class names, method names, file names
- Testing conventions: Given/When/Then pattern, mock naming
- Git conventions: branch naming, commit message format
- DB conventions: table naming, migration file naming

### B5. `sdlc-tst.md` — Thêm conventions.md làm RECOMMENDED input

**Hiện tại:** Input Detection không có conventions.md.

**Thay đổi:** Thêm vào Input Detection:

```markdown
7. Read `agent_docs/conventions.md` — testing conventions (Given/When/Then format, mock naming, test file naming) (recommended)
```

**Lý do:** TST specs cần tuân theo testing conventions để nhất quán với IMP specs. Nếu thiếu → vẫn tiếp tục được (dùng default patterns), nhưng nên warn.

---

## File Dependency Map (tổng thể sau tích hợp)

```
sdlc-preflight tạo:
  project-overview.md ──→ SRS (REQUIRED), HLD (recommended), LLD (optional)
  user-context.md     ──→ SRS (REQUIRED), HLD (recommended)
  conventions.md      ──→ IMP (REQUIRED), TST (recommended)
```

## Không thay đổi

- `sdlc-preflight/` — giữ nguyên
- `flow-task.md`, `flow-cr.md`, `flow-fixbug.md`, `flow-cook.md` — giữ nguyên
- Hard Boundaries trong SKILL.md — giữ nguyên

## Thứ tự thực thi

1. `procedures.md` — cập nhật Section 5.2
2. `SKILL.md` (orchestrator) — thêm Bước 3 Foundation Gate + Skill Reference + bump version
3. `sdlc-srs.md` — thêm project-overview.md + user-context.md REQUIRED
4. `sdlc-hld.md` — cập nhật optional → recommended với context
5. `sdlc-lld.md` — thêm project-overview.md OPTIONAL
6. `sdlc-imp.md` — thêm conventions.md REQUIRED
7. `sdlc-tst.md` — thêm conventions.md RECOMMENDED

## Kiểm tra

1. **Orchestrator:** Preflight flow: Bước 1→2→3→4 mượt mà, Foundation Gate route đúng theo flow
2. **Agent input detection:** Mỗi agent có Input Detection step liệt kê đúng foundation files
3. **Error messages:** Agent báo đúng "sdlc-preflight must run first" khi thiếu file
4. **End-to-end:** Chạy task flow → orchestrator phát hiện thiếu → invoke preflight → preflight tạo files → SRS đọc được files

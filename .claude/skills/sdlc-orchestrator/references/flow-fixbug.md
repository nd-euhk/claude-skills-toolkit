# Flow: fixbug

**Trigger:** Bug report, error, crash, behavior không mong đợi.
**Precondition:** Incident tồn tại — có thể đã rõ hoặc chưa rõ thông tin bug.

## Entry Decision: Known hay Unknown?

Parse human input để xác định sub-flow:

| Sub-Flow | Signals | Hành động |
|---|---|---|
| **Known Bug** | Root cause + affected services + reproduction steps đã rõ; human cung cấp diagnosis đầy đủ; "đã biết nguyên nhân", "lỗi đã rõ" | Ghi nhận → document → update specs → fix → verify |
| **Unknown Bug** | Chỉ có symptoms/error reports; "chưa rõ", "cần debug", "điều tra"; stack trace không giải thích; "có bug" không chi tiết | Debug → discover → document → update specs → fix → verify |

**Rõ ràng** → thông báo sub-flow, xin xác nhận nhanh.
**Ambiguous** → invoke `Skill(grilling)`: "Đã biết nguyên nhân chưa? Có root cause + affected services + reproduction steps không?"

---

## Nếu Known Bug

### Bước 1: Grilling Interview

Invoke `Skill(grilling)` để thu thập thông tin bug có cấu trúc:
- Bug là gì? (title + tóm tắt 1 đoạn)
- Symptoms? (error messages, wrong behavior, performance issues)
- Root cause? (component nào, tại sao)
- Reproduction steps?
- Severity? (P0 critical, P1 high, P2 medium, P3 low)
- Môi trường? (production, staging, dev)
- Có workaround không?
- Proposed fix? (file nào thay đổi, approach gì)

### Bước 2: Document Bug

Tạo bug record: `agent_docs/{backend,frontend}/{service,app}/bugs/BUG-{NNN}--{slug}.md`

Template + cách xác định BUG-NNN: `references/procedures.md` → "Bug Document".

### Bước 3: Impact Assessment

`references/procedures.md` → "Impact Assessment".

### Bước 4: Update Specifications

`references/procedures.md` → "Spec Update".

### Bước 5 + 6: Fix + Verify

`references/procedures.md` → "Fix + Verify Pattern".

---

## Nếu Unknown Bug

### Bước 1: Triage & Debug

1. Invoke `Skill(debugging)` để phân tích:
   - Parse stack traces, error messages, logs
   - Xác định failing component (service, module, function)
   - Đưa ra root cause hypothesis
   - Nếu cần logs hoặc monitoring data → `Skill(sdlc-scout)` để khám phá service/component

2. Invoke `Skill(problem-solving)` để đánh giá:
   - Các possible fixes?
   - Trade-offs (risk, effort, side effects)?
   - Đề xuất approach tốt nhất

### Bước 2: Grilling Interview

Invoke `Skill(grilling)` để lấp gaps mà debugging không trả lời được:
- Bug được phát hiện như thế nào? (user report, monitoring, testing)
- Reproduction steps? (nếu chưa rõ từ logs)
- Severity? (P0 critical, P1 high, P2 medium, P3 low)
- Môi trường? (production, staging, dev)
- Có workaround không?
- Có recent changes liên quan có thể gây ra bug không?

### Bước 3: Document Bug

Tạo bug record (cùng cấu trúc như Known Bug Bước 2). Status bắt đầu là `in-progress`.

### Bước 4: Impact Assessment

`references/procedures.md` → "Impact Assessment".

### Bước 5: Update Specifications

`references/procedures.md` → "Spec Update".

### Bước 6 + 7: Fix + Verify

`references/procedures.md` → "Fix + Verify Pattern".

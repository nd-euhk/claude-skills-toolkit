# SDLC Routing Rules

<EXTREMELY-IMPORTANT>
Map user intent đến SDLC flow và entry point chính xác. Luôn resolve dựa trên live
installed-skill catalog của runtime — không hardcode skill name có thể khác giữa các
installation.
</EXTREMELY-IMPORTANT>

## Intent → Flow Resolution

Match primary intent của user đến flow, không phải keyword. Cùng intent diễn đạt bằng
những từ khác nhau phải resolve về cùng flow.

| User intent | Flow | Available via | What it triggers |
|-------------|------|--------------|-------------------|
| Build new feature, greenfield work, major change, tạo specs từ scratch | `task` | orchestrator, automation | Full forward pipeline: SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST |
| Change existing behavior, modify feature, update specs cho code hiện có | `cr` | orchestrator, automation | Impact analysis + selective re-spec: scout → analyze → re-spec affected phases |
| Fix defect, repair broken behavior, resolve bug | `fixbug` | **orchestrator only** | Root-cause diagnosis + targeted fix: scout → diagnose → fix → verify |
| Write code từ ready specs, implement từ agent_docs, execute TDD cycle | `cook` | orchestrator, automation | TDD execution: baseline → per-TC RED→GREEN→INTERFERENCE→REFACTOR→GATE |
| Reverse-engineer specs từ existing codebase, document what code does | `reverse` | orchestrator, sdlc-codebase skill | Reverse pipeline: scout → HLD → LLD → SRS → VERIFY → CROSS-CUTTING → IMP∥TST |

## Entry Point Selection

Sau khi flow được xác định, route đến entry point skill dựa trên mức độ human
involvement cần thiết.

| Situation | Entry point |
|-----------|-------------|
| Domain mới, requirement chưa rõ, high-risk change, hoặc human muốn review từng phase | **orchestrator** — human-in-the-loop tại mọi phase gate |
| Requirement đã rõ, human muốn một upfront interview rồi autonomous execution | **automation** — grill once, dispatch workflow, monitor |
| Change bounded ≤2 files, no API/schema/security/auth/billing impact, no new service boundary | **quick** — triage grill, guard test only, GATE-light |

## Priority Rules

Khi intent ambiguous hoặc overlap:

1. **Safety first** — nếu bất kỳ signal nào gợi ý task KHÔNG trivial, reject quick
2. **Evidence over assumption** — nếu không thể confirm scope từ context, default orchestrator
3. **Borderline always escalates** — "might be quick" = orchestrator; "might be cr" = task flow
4. **Explicit user request overrides inference** — nếu user nêu tên một entry point cụ thể, dùng nó

---

## Anti-Patterns — Chống Pattern-Match

<EXTREMELY-IMPORTANT>
Khi một flow "cảm thấy đúng" ngay lập tức → đó là pattern-match. Dừng lại, chạy The
Floor (từ `sdlc-fable-thinking-rules.md`), viết ít nhất 2 flow khả dĩ.
</EXTREMELY-IMPORTANT>

| Template nguy hiểm | Thực tế có thể là |
|-------------------|------------------|
| "Sửa lỗi" → fixbug | Scope nhỏ → quick; hoặc cần refactor → task |
| "Thêm tính năng" → task | Thêm field nhỏ → CR; hoặc chỉ implement từ spec có sẵn → cook |
| "Dự án nhỏ" → skip HLD/LLD | Có auth/billing/schema → cần ít nhất LLD |
| "Có vẻ đơn giản" → quick | Có API/schema/migration → tối thiểu automation |
| "Giống lần trước" → cùng flow | Context khác, team khác, codebase đã thay đổi |

## Resolution Procedure

1. Đọc request của user và xác định primary intent
2. Match intent đến flow dùng capability table ở trên, không dùng keyword grep
3. Giữ ≥2 viable flow hypothesis trước khi chốt — nếu chỉ có một, bạn đang pattern-matching
4. Đánh giá human-involvement needs: domain familiarity, risk level, scope clarity
5. Chọn entry point skill từ live installed-skill catalog
6. Load hoàn chỉnh skill instructions đó trước khi hành động
7. Nếu skill được chọn không installed, escalate lên entry point nặng hơn kế tiếp

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
| Write code từ ready specs, implement từ agent_docs, execute TDD cycle | `cook` | sdlc-cook skill | TDD execution: worktree isolation → baseline → per-TC RED→GREEN→INTERFERENCE→REFACTOR→GATE → PR → cleanup |
| Batch-cook nhiều feature TDD unattended / qua đêm ("cook hết tất cả task", "cook xuyên màn đêm", "cook all features", "batch cook", "overnight run") | `cook-overnight` | **human-invoked only** — `sdlc-cook-overnight` (`disable-model-invocation: true`) | Batch phased-batch TDD per feature → auto-PR (không merge) → morning report. Agent **KHÔNG tự invoke** — nhận diện intent rồi **raise cho human tự trigger** `/sdlc-cook-overnight` |
| Reverse-engineer specs từ existing codebase, document what code does | `reverse` | orchestrator, sdlc-codebase skill | Reverse pipeline: scout → HLD → LLD → SRS → VERIFY → CROSS-CUTTING → IMP∥TST |
| Tạo/thiết kế kiến trúc hệ thống trước SRS, logical architecture, "kiến trúc hệ thống" | `architect` | **sdlc-architect skill** | Self-check `agent_docs/architecture.md` → MISSING thì BẮT BUỘC tạo qua skill `architect` (workflow design, plan mode human gate). Đã có → skip. Post-SRS physical HLD do sdlc-hld |
| Quét/kiểm tra license OSS compliance cho một hoặc nhiều project, kiểm kê dependency trước release, cần quyết định license per project | `oss-scan` | **oss-scan skill** (standalone) | OSS compliance: nhận **target path** (folder nhiều project hoặc 1 project đơn lẻ) → phát hiện project → xác nhận → workflow scan → risk-research → gate → report + decisions cần LRB |

## Entry Point Selection

Sau khi flow được xác định, route đến entry point skill dựa trên mức độ human
involvement cần thiết.

| Situation | Entry point |
|-----------|-------------|
| Domain mới, requirement chưa rõ, high-risk change, hoặc human muốn review từng phase | **orchestrator** — human-in-the-loop tại mọi phase gate |
| Requirement đã rõ, human muốn một upfront interview rồi autonomous execution | **automation** — grill once, dispatch workflow, monitor |
| Change bounded ≤2 files, no API/schema/security/auth/billing impact, no new service boundary | **quick** — triage grill, guard test only, GATE-light |
| Đã có specs (SRS + IMP + TST hoặc ít nhất IMP + TST) và chỉ cần implement code theo specs có sẵn | **cook** — TDD execution: worktree isolation, RED→GREEN→REFACTOR→GATE per-TC |
| Forward/greenfield, chưa có `agent_docs/architecture.md`, cần logical architecture trước SRS | **sdlc-architect** — self-check + bắt buộc tạo qua skill `architect` (plan mode human gate) |

## Priority Rules

Khi intent ambiguous hoặc overlap:

1. **Safety first** — nếu bất kỳ signal nào gợi ý task KHÔNG trivial, reject quick
2. **Evidence over assumption** — nếu không thể confirm scope từ context, default orchestrator
3. **Borderline always escalates** — "might be quick" = orchestrator; "might be cr" = task flow
4. **Explicit user request overrides inference** — nếu user nêu tên một entry point cụ thể, dùng nó
5. **Push back on over-engineering** — nếu user request khớp một flow nặng nhưng tồn tại
   cách đơn giản hơn giải quyết cùng goal, surface nó. "Có thể làm qua quick flow chỉ
   với X và Y. Bạn muốn dùng cách đó hay vẫn đi đường đầy đủ?" Controller không được
   auto-chọn flow nặng hơn khi flow nhẹ hơn đáp ứng được goal của user.

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
8. **Cook escalation**: nếu TDD cycle phát hiện IMP/TST spec không đủ, sai, hoặc thiếu edge case → escalate về orchestrator với flow=`cr` (nếu là feature hiện có) hoặc flow=`task` (nếu cần tạo specs từ đầu). Cook không tự sửa specs.
9. **Model-disabled skill → raise-to-human**: nếu intent khớp skill có `disable-model-invocation: true` (vd `sdlc-cook-overnight`) → KHÔNG auto-invoke, KHÔNG load skill để thực thi. Raise cho human: nêu skill + lệnh trigger (`/sdlc-cook-overnight`) và optional args, chờ human tự chạy. Agent chỉ hỗ trợ context, không thay human trigger.

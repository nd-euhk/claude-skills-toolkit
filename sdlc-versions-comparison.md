# SDLC Rules — So sánh 6 phiên bản

> Dành cho team tự chọn phiên bản. Tags: `sdlc-skill-v4` → `sdlc-skill-v4.1` → `sdlc-skill-v4.2` → `sdlc-skill-v4.3` → `sdlc-skill-v4.4` → `sdlc-skill-v4.5`

---

## v4 — Baseline

**Làm được:**
- 4 flow SDLC: task (spec→code), cr (change request), cook (TDD code), reverse (code→spec)
- 3 làn entry point: orchestrator (human-in-the-loop), automation (tự động), quick (task nhỏ)
- Phase gate protocol: mọi phase output phải pass gate trước phase tiếp theo
- Agent spawning với context isolation (không pass full history)
- Sprint management: backlog, board, roadmap

**Chưa có:**
- Reasoning protocol — model tự suy luận không guardrail
- Escalation protocol — không có cơ chế chuyển làn khi scope vượt
- Entry gate — không check git state + foundation files trước khi chạy
- Code discipline rules cho cook/TDD

---

## v4.1 — Fable-Thinking Integration

**Làm được:** mọi thứ v4 + reasoning middleware tại decision points.

**Mới so với v4:**

| Năng lực | Mô tả |
|----------|-------|
| **Fable-Thinking rule** | Gọi reasoning middleware tại 6 decision points (flow detection ambiguous, escalation, pipeline scope, foundation gate fail, grilling exit, fail-safe). Model không tự quyết định — fable-thinking phân tích rồi human quyết. |
| **Bug keyword detection** | Khi user input chứa "bug"/"lỗi"/"fix", fable-thinking phân biệt genuine bug vs false positive trước khi escalate |
| **Foundation gate fail handling** | Khi preflight không tạo được file nền tảng, fable-thinking đánh giá impact của từng file thiếu + đề xuất stop/proceed |
| **Pipeline scope decision** | Trước khi skip HLD/LLD/CROSS-CUTTING, fable-thinking đánh giá risk nếu bỏ qua |

**Khác biệt chính với v4:** Model không còn auto-quyết tại decision point — luôn qua fable-thinking verify trước khi human chốt. Nhưng fable-thinking vẫn là **skill invoke** (gọi khi cần), không phải rule tự động.

---

## v4.2 — Protocol-First Architecture

**Làm được:** mọi thứ v4.1 + reasoning protocol luôn active + đầy đủ reference.

**Mới so với v4.1:**

| Năng lực | Mô tả |
|----------|-------|
| **The Floor** | 3 check chạy trước MỌI câu trả lời — Goal (end-state thực sự là gì), Follow-through (chạy movie đến frame cuối), Leftovers (detail nào chưa dùng). Không ngoại lệ, kể cả Direct mode. |
| **Claim Discipline** | Mọi statement được type: OBSERVED (đã thấy), DERIVED (suy ra), PRIOR (training knowledge, có thể cũ), ASSUMED (chưa verify). Grammar là dấu hiệu tố cáo hallucination. |
| **Self-Review Gate** | 8 checks binary trước khi gửi output. YES phải earned bằng hành động thực tế, không phải re-reading. |
| **Proportionality Gate** | Direct/Standard/Full mode tùy stakes × irreversibility × novelty. Không over-apply protocol cho task nhỏ. |
| **8 Known Defaults** | Nhận diện 8 cách model thất bại: pattern-match satisfaction, template hijack, fluent≠true, prior-as-fact, confirmation seeking, frame adoption, completion pressure, surface blindness. Mỗi cái có countermeasure. |
| **Routing anti-patterns** | Table 5 template nguy hiểm ("sửa lỗi"→fixbug nhưng thực tế scope nhỏ→quick, "thêm tính năng"→task nhưng thực tế CR nhỏ, etc.) |
| **4 Reference files** | protocol.md (Five Moves đầy đủ), worked-examples.md (4 trace), design-taste.md (UI/UX method), content-taste.md (writing method) |
| **Advisor cơ bản** | Orchestration rules có section về việc spawn advisor subagent tại decision points ambiguous |
| **Escalation protocol** | 3 làn + fail-safe principles + context-preserving escalation |
| **Entry gate** | Git state check + foundation gate + flow verification |
| **Tiếng Việt** | Toàn bộ rules viết bằng tiếng Việt |

**Khác biệt chính với v4.1:** Fable-thinking từ skill-invoke thành **rule luôn active**. The Floor chạy trước mọi câu trả lời. Protocol đầy đủ với 4 references. Architecture refactor: 6 file rời → 4 file gộp theo domain logic.

---

## v4.3 — Implementation Discipline

**Làm được:** mọi thứ v4.2 + code-level discipline + advisor agent chuyên dụng.

**Mới so với v4.2:**

| Năng lực | Mô tả |
|----------|-------|
| **Simplicity First** | GREEN phase implement ĐỦ pass test, không hơn. DRY chỉ áp dụng từ lần thứ 3. Pattern chỉ giới thiệu khi ≥2 implementation cần nó. "Sau này sẽ cần" = không làm. |
| **Surgical Changes** | Chỉ touch file trong scope. Không format file hàng xóm. Không tự xóa unused code. Không reorganize import. |
| **Read Before Write** | Trước GREEN phase phải đọc: file sẽ sửa + imports + test file + IMP spec. Grep function name trước khi viết. Check call sites trước khi sửa signature. |
| **Match Codebase Conventions** | Naming theo pattern có sẵn. File structure mirror file tương tự. Error handling theo style codebase. Conformance > taste. |
| **Implementation anti-patterns** | 6 instinct→rule mappings: "viết helper cho sạch", "format lại file cho đẹp", "import lát dùng", "pattern best practice", "chắc chỉ có 1 chỗ gọi", "code tệ sửa luôn" |
| **Advisor agent chuyên dụng** | 132 dòng agent definition với Five Moves protocol, model=sonnet, read-only. Spawn tự động tại 9 decision triggers trong orchestration rules. |
| **Conflict Averaging** | Default thứ 9 trong Known Defaults: instinct blend 2 pattern mâu thuẫn → kế thừa điểm yếu cả hai. Counter: pick one + giải thích + flag cái kia. |
| **Test Intent Principle** | Test phải verify business rule, không phải code path. Tên test nói WHY. Refactor chỉ fail test nếu business behavior đổi. |
| **Push-Back #5** | Controller phải surface flow nhẹ hơn khi nó đáp ứng được goal. Không auto-chọn flow nặng. |

**Khác biệt chính với v4.2:** Bổ sung tầng **implementation** — code discipline cho cook/TDD agents. Advisor từ section trong orchestration rules → agent definition riêng với model=sonnet. 3 amendment vào reasoning, pipeline, routing.

---

## v4.4 — Workflow Quality Assurance

**Làm được:** mọi thứ v4.3 + workflow determinism + anti-pattern review + version comparison docs.

**Mới so với v4.3:**

| Năng lực | Mô tả |
|----------|-------|
| **Workflow determinism** | `codebase-reverse.js` không còn dùng `new Date()` — thay bằng `runDate` parameter từ skill dispatch. Đảm bảo workflow resume hoạt động chính xác (cùng input → cached agent trả về kết quả cũ thay vì re-run). |
| **Workflow knowledge skill** | Skill `workflow-knowledge` dạy Claude toàn bộ Workflow tool API, quality patterns (adversarial verify, judge panel, loop-until-dry, multi-modal sweep, completeness critic, idempotent phase skip), anti-patterns (11 patterns với WRONG/RIGHT code pairs), pipeline vs parallel decision rules, budget awareness, canonical patterns, và coding style. |
| **Workflow audit report** | Review toàn bộ 8 workflow trong `.claude/workflows/` — phát hiện `new Date()` critical bug, thiếu `budget` awareness, code duplication (~60% giữa review-mr và review-code), hardcoded model override không comment, parallel write conflict risk. |
| **Version comparison docs** | File `sdlc-versions-comparison.md` so sánh 4 phiên bản SDLC rules, kèm bảng chọn theo nhu cầu và team profile. Hỗ trợ team quyết định dùng phiên bản nào. |

**Khác biệt chính với v4.3:** Thêm tầng **workflow quality** — fix critical resume bug, audit toàn bộ workflow, có comparison docs để team chọn version. `workflow-knowledge` skill là foundation cho các workflow tiếp theo (budget awareness, code review, automation). Chưa có budget awareness trong workflow — sẽ đến ở v4.5.

---

## v4.5 — Cook Independence & Production Hardening

**Làm được:** mọi thứ v4.4 + cook standalone architecture + workflow production hardening + fable-thinking rules executable rewrite.

**Mới so với v4.4:**

| Năng lực | Mô tả |
|----------|-------|
| **Cook standalone architecture** | Cook flow được tách hoàn toàn khỏi orchestrator và automation, trở thành skill độc lập. orchestrator/automation focus vào specs pipeline (task/CR/fixbug), cook là entry point chuyên biệt cho TDD code execution. Xóa flow-cook.md (441 dòng) khỏi orchestrator, xóa cook-flow.md (440 dòng) khỏi automation. |
| **Cook DRY retry** | `runGateWithRetry()` helper — loại bỏ ~60 dòng duplicate retry logic giữa GATE light và GATE full trong workflow script. Một hàm duy nhất với techStackHint + allFiles explicit params. |
| **Cook idempotent resume** | Workflow có thể resume từ crashed phase thay vì re-run toàn bộ TDD cycle. Dùng `resumeFromRunId` (tool-level) làm primary mechanism, COOK_REPORT làm fallback. |
| **Cook docs consolidation** | Gộp flow-multi.md (đã xóa, multi-feature dispatcher không còn cần), flow-single.md → flow.md, tdd-cycle.md → pipeline-status.md → tdd-orchestration.md. Tổ chức lại references rõ ràng: flow.md (single-feature execution), tdd-orchestration.md (TDD cycle + GATE), error-recovery.md (10 error scenarios), merge-manager.md (PR + conflict), project-detection.md. |
| **Pipeline status removal** | Xóa write-only `.pipeline/` JSON mechanism — 3 script implementations (sh/js/py, ~420 dòng) không có reader. Merge-manager và error-recovery chuyển sang đọc COOK_REPORT thay vì JSON file. |
| **Workflow audit fixes (7 fixes)** | (1) `repoPath` từ `process.env` → `git rev-parse` + skill dispatch. (2) `PHASE_RESULT` schema cho `agent()` structured output. (3) `verifySRSForDomains` parallel hóa (sequential → parallel). (4) DRY `CC_STAGE1_AGENTS` config array. (5) `runGateWithRetry` thêm `techStackHint` + `allFiles` params. (6) Idempotent resume cho automation workflow (5 phase skip logic). (7) Idempotent resume cho codebase-reverse workflow (5 phase skip logic). |
| **Fable-thinking rules executable rewrite** | Từ mô tả (descriptive) → thủ tục thực thi (mechanical executable). Portable Techniques và Five Moves được nhúng inline dưới dạng procedure cụ thể, không còn là concept để biết. Model PHẢI thực thi, không phải "biết và áp dụng". `protocol.md` vẫn tồn tại cho Full mode (Constraint Loop, design-taste, content-taste) nhưng hầu hết Standard mode tasks không cần load reference. |
| **sdlc-review integration** | Merge-manager tự động gợi ý chạy `sdlc-review --code --full` trước khi tạo PR. Non-blocking — human có thể skip. |
| **Sprint cook integration** | Sprint board và backlog cập nhật cook integration: board theo dõi TDD cycle status (baseline → RED → GREEN → REFACTOR → GATE), backlog hỗ trợ cook-ready features. |

**Khác biệt chính với v4.4:** Cook trở thành **skill độc lập hoàn toàn** — không còn ràng buộc với orchestrator hay automation. Workflow đạt **production hardening** qua 7 audit fixes (determinism, DRY, parallelize, idempotent resume). Fable-thinking rules chuyển từ mô tả sang **executable procedure** — model không còn "biết" protocol mà phải "thực thi" nó. ~1400 dòng code chết bị xóa (pipeline status scripts + multi-feature dispatcher + duplicated flow docs).

---

## Bảng chọn theo nhu cầu

| Nhu cầu | Chọn |
|---------|------|
| Pipeline SDLC cơ bản, không cần reasoning guardrail | **v4** |
| Cần reasoning middleware tại decision points, nhưng chưa muốn protocol luôn active | **v4.1** |
| Muốn reasoning protocol luôn active (The Floor), Claim Discipline, đầy đủ references | **v4.2** |
| Muốn tất cả v4.2 + code discipline cho implementation + advisor agent chuyên dụng | **v4.3** |
| Muốn tất cả v4.3 + workflow determinism + audit + comparison docs | **v4.4** |
| Muốn tất cả v4.4 + cook độc lập + production hardening + executable reasoning rules | **v4.5** |

## Bảng chọn theo team profile

| Team | Dùng | Vì |
|------|------|-----|
| Mới bắt đầu SDLC, muốn pipeline cơ bản | v4 | Nhẹ nhất, không protocol phức tạp |
| Đã quen SDLC, muốn model cẩn thận hơn ở decision points | v4.1 | Reasoning middleware không xâm lấn |
| Muốn model luôn reasoning grounded, có guardrail toàn diện | v4.2 | Protocol-first, The Floor, 8 defaults |
| Muốn model reasoning grounded + code chuẩn mực | v4.3 | Tất cả v4.2 + implementation discipline |
| Muốn model reasoning grounded + code chuẩn + workflow ổn định | v4.4 | Tất cả v4.3 + workflow quality assurance |
| Muốn production-grade pipeline: cook độc lập, workflow production-hardened, reasoning rules executable | v4.5 | Tất cả v4.4 + production hardening + standalone cook + ~1400 dòng code chết bị xóa |

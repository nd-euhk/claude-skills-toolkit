# Changelog

All notable changes to the skills-toolkit plugin are documented here.

## [2.33.0] - 2026-07-30

### Changed
- **sdlc-cook 2.2.0:** MINOR — refine skill với fable-thinking analysis:
  - **Merge flow.md → SKILL.md:** Core execution flow (10 bước) giờ nằm trong
    body chính (298 dòng, dưới limit 500). flow.md bị xóa — nội dung đã merge.
  - **Deduplicate board update:** Transition map canonicalized về
    tdd-orchestration.md, xóa bản copy ở SKILL.md và flow.md cũ.
  - **Rename pipeline-status.md → tdd-orchestration.md:** Tên mới phản ánh đúng
    nội dung (TDD cycle, baseline, GATE, board update).
  - **Trim merge-manager.md:** 342→335 dòng. Conflict handling trỏ về
    error-recovery.md cho decision tree, giữ PR-specific procedures.
  - **Cross-references:** merge-manager.md ↔ error-recovery.md có
    bidirectional links cho conflict handling.
  - **Validation pass:** 7/7 phases. Script tests 7/7 PASS. Không broken links,
    không orphaned references.

## [2.32.1] - 2026-07-30

### Changed
- **sdlc-automation 1.9.1:** PATCH — refine sau khi xóa cook flow:
  - **grilling-templates.md:** Rút gọn 304→263 dòng (-41). Gộp các section nhỏ:
    Round 1 (Tổng quan & Users, AC & Business Rules), Round 2 (Performance &
    Availability, Security & Scale), Round 3 (Services & APIs, Data & External
    Dependencies). Giảm verbosity trong AskUserQuestion template descriptions.
  - **cr-flow.md:** Thêm cross-reference đến grilling-templates.md cho CR phức tạp.

## [2.32.0] - 2026-07-30

### Changed
- **sdlc-cook 2.1.0:** MINOR — thêm gợi ý sdlc-review --code trước khi tạo PR:
  - **merge-manager.md:** Chèn section mới "sdlc-review Gợi Ý (--code)" giữa
    Pre-merge Check và PR Creation. AskUserQuestion non-blocking hỏi human có
    muốn chạy `sdlc-review --code --full` trên worktree trước khi tạo PR không.
    Nếu đồng ý → `Skill("sdlc-review", "--code --full " + worktree_path)`.
    Tất cả lỗi đều non-blocking — tạo PR luôn có thể tiếp tục.
  - **flow.md:** Cập nhật Bước 10 — thêm item 2 (gợi ý review) vào numbered list.
  - **SKILL.md:** Version bump + cập nhật flow diagram.
  - Tham khảo pattern AskUserQuestion từ sdlc-orchestrator Section 6.2b.

## [2.31.0] - 2026-07-30

### Changed
- **sdlc-orchestrator 1.14.0:** MINOR — xóa cook flow khỏi orchestrator:
  - **Xóa `references/flow-cook.md`** — toàn bộ 441 dòng TDD cook procedure.
    sdlc-cook skill (v2.0.0) là điểm vào chuyên biệt cho TDD code execution.
  - **SKILL.md:** Xóa cook khỏi description (3 flow thay vì 4), keyword table,
    keyword overlap rules, flow selection UI, foundation gate cook section,
    flow routing table. Đổi tên TDD agent tables từ "(cook flow)" thành
    generic — các agent này vẫn được fixbug flow sử dụng.
  - **procedures.md:** Xóa Section 1.3 (TDD Agent Templates) và Section 3.6
    (TDD Per-TC Cycle). Cập nhật tất cả cook references. Thêm post-completion
    prompt: sau task/CR xong, hỏi human có muốn implement qua sdlc-cook không.
  - **flow-cr.md:** Cập nhật cook reference, thêm post-completion prompt.
  - **flow-fixbug.md:** Đổi "Khác biệt với cook flow" → "Đặc điểm TDD fix cycle".

- **sdlc-automation 1.9.0:** MINOR — xóa cook flow khỏi automation:
  - **Xóa `references/cook-flow.md`** — toàn bộ 440 dòng cook automation flow.
    sdlc-cook skill đã có workflow dispatch riêng trong worktree isolation.
  - **SKILL.md:** Xóa cook khỏi description, flow selection UI, keyword hints,
    foundation gate, toàn bộ Cook Automation Flow section, cook-flow.md khỏi
    reference index, workflow-sdlc-cook.js khỏi dependency table.
  - **task-flow.md:** Xóa "Next: flow cook" line, thêm post-completion prompt.
  - **Trọng tâm hóa:** automation giờ chỉ focus vào specs pipeline (task/CR).

- **sdlc-routing-rules.md:** Cập nhật Intent→Flow table — cook "Available via"
  từ "orchestrator, automation" thành "sdlc-cook skill".

## [2.30.0] - 2026-07-30

### Changed
- **sdlc-cook 2.0.0:** MAJOR — loại bỏ multi-feature dispatcher, đơn giản hóa về single-feature:
  - **Xóa `references/flow-multi.md`** — toàn bộ dispatcher logic (scan board, topological sort,
    pool management, monitor, wave continuation) không còn cần thiết. Claude Code agents view
    đã cung cấp parallel execution visualization ở tầng platform.
  - **Xóa auto mode** — không còn `/sdlc-cook` (no args) scan board. User gọi riêng từng feature.
  - **Xóa `--pool <N>` flag** — không còn pool concept. Mỗi lần gọi = 1 worktree.
  - **Đổi tên `flow-single.md` → `flow.md`** — chỉ còn một flow duy nhất.
  - **Thêm dependency check** vào flow.md — cảnh báo nếu `depends_on` chưa Done, không chặn cứng.
  - **Đơn giản hóa merge-manager.md** — bỏ wave continuation và unblock-deps dispatch.
  - **Dọn `references/error-recovery.md`** — bỏ 3 references đến "dispatcher".
  - **SKILL.md:** Giảm từ 190 dòng còn 110 dòng, mô tả rõ cách chạy song song qua agents view.
  - **Tổng:** Xóa ~350 dòng dispatcher logic, skill giảm ~40% độ phức tạp. Single responsibility
    rõ ràng: cook MỘT feature trong worktree isolation. Parallelism = platform concern.
- **sdlc-cook:** Loại bỏ cơ chế pipeline status tracking:
  - **Xóa `scripts/update-pipeline-status.{sh,js,py}`** — 3 script (~370 dòng) atomic-write
    vào `.pipeline/{frId}-status.json`. Cơ chế này write-only: workflow không đọc file,
    agent không được enforce gọi script, resume dùng `resumeFromRunId` (tool-level) và
    `COOK_REPORT` return value thay vì đọc file JSON.
  - **Dọn `workflow-sdlc-cook.js`** — xóa `statusUpdateCmd()`, `statusInstruction()`,
    `STATUS_SCRIPT`, và tất cả embedded bash instructions trong RED/GATE/REFACTOR prompts.
  - **Dọn `pipeline-status.md`** — xóa "Canonical Pipeline Status Schema" section và
    "Pipeline Status Polling" section. Giữ TDD cycle, agent reference, baseline capture,
    GATE protocol, board update.
  - **Dọn `merge-manager.md`** — pre-merge check đọc từ `COOK_REPORT` thay vì JSON file.
  - **Dọn `error-recovery.md`** — workflow crash recovery ưu tiên `resumeFromRunId`,
    fallback `resumeFrom` từ COOK_REPORT/log output thay vì đọc file.
  - **Xóa `.pipeline/` từ `.gitignore`** — không còn runtime data được ghi.
  - **Tổng:** Xóa ~685 dòng code + documentation cho một cơ chế không được đọc bởi ai.

## [2.29.0] - 2026-07-29

### Changed
- **sdlc-cook 1.1.0:** Refine full flow kết hợp workflow-knowledge patterns:
  - **Token efficiency:** Chuyển Python pseudocode (52 dòng) từ SKILL.md → flow-multi.md
    thành mô tả ngắn 7 dòng — agent tự parse args không cần script mẫu
  - **DRY:** Extract `runGateWithRetry()` helper — loại bỏ ~60 dòng retry logic trùng lặp
    giữa GATE light và GATE full trong workflow script (820→825 dòng, thêm idempotent)
  - **Structure:** Consolidate `tdd-cycle.md` → `pipeline-status.md` — giảm 1 file
    reference, TDD orchestration + GATE protocol trong cùng 1 file
  - **Resilience:** Idempotent phase skip qua `resumeFrom` args — workflow có thể resume
    từ phase đã crash thay vì chạy lại từ đầu (skip completed TCs, GATE light, REFACTOR, GATE full)
  - **UX:** Thêm `references/error-recovery.md` — centralized decision tree cho 10 error
    scenarios (INTERFERENCE, GATE fail, merge conflict, PR closed, worktree crash...)
  - **Maintainability:** Cập nhật tất cả cross-reference links sau khi xóa tdd-cycle.md

## [2.28.1] - 2026-07-28

### Fixed
- **sdlc-codebase 1.15.1:** Sửa critical bug `new Date()` trong `workflow-codebase-reverse.js`
  phá hủy workflow resume. Thay bằng `runDate` parameter truyền từ skill dispatch qua args.
  Cập nhật SKILL.md, flow-reverse.md, procedures.md để truyền `runDate` khi gọi workflow.
- **workflow-codebase-reverse:** Thay `new Date().toISOString().split('T')[0]` bằng
  `runDate` từ args — đảm bảo deterministic execution và khả năng resume.

## [2.28.0] - 2026-07-23

### Changed
- **advisor 1.1.0:** Refine — thêm decision-specific failure modes (frame adoption,
  first-option lock, fluent recommendation ≠ correct, stakes inflation), chuyển
  protocol thành procedural 5-step (FRAME → GROUND → REASON → ATTACK → DELIVER) với
  decision-specific adaptation cho từng bước. Thêm Agent tool cho phép spawn Explore
  agent để exploring codebase khi cần GROUND facts rộng (search pattern across files,
  verify claim spanning multiple services).

## [2.27.0] - 2026-07-23

### Added
- **advisor 1.0.0:** Subagent mới — structured reasoning tại decision point. Spawn khi
  controller gặp tình huống ambiguous (escalation, flow detection, gate fail, scope
  negotiation, grilling exit, fail-safe, bug keyword). Áp dụng fable-thinking protocol
  (Five Moves: FRAME → GROUND → REASON → ATTACK → DELIVER), trả về structured
  recommendation với confidence breakdown (OBSERVED/DERIVED/ASSUMED). Read-only, model
  fable, max 8 turns. Dùng chung cho orchestrator và automation.
- **sdlc-orchestration-rules:** Thêm section "Advisor Subagent — Decision Support" với
  bảng 9 decision points, context cần cung cấp, và hướng dẫn sử dụng kết quả.

### Changed
- **sdlc-orchestrator 1.13.0:** Thay 4 inline fable-thinking blocks bằng spawn `advisor`
  subagent: escalation trigger, flow detection ambiguous, foundation gate fail, skip
  phase proposal. Controller giờ dispatch advisor thay vì tự suy luận — context
  isolation, DRY, nhất quán protocol.
- **sdlc-automation 1.8.0:** Thay 5 inline fable-thinking blocks bằng spawn `advisor`
  subagent: grilling exit, fail-safe, bug keyword detection, flow selection ambiguous,
  gate fail sau retry exhausted.
- **sdlc-fable-thinking-rules:** Dịch "tell" → "dấu hiệu" / "dấu hiệu tố cáo" (3 vị trí,
  sát nghĩa theo context sử dụng: dấu hiệu nhận biết ở diagnostic list, dấu hiệu tố
  cáo ở Claim Discipline — grammar là thứ vô tình tố cáo claim đang giả dạng OBSERVED).

## [2.26.0] - 2026-07-23

### Changed
- **fable-thinking rule:** Cập nhật từ skill fable-thinking 1.4.0. Thêm Know Your Own
  Defaults (8 default failure modes), hoàn chỉnh The Floor với trap-detection tells.
  Tất cả technical terms giữ nguyên tiếng Anh: The Floor, Goal, Follow-through,
  Leftovers, Claim Discipline, Proportionality Gate, Self-Review Gate, Constraint
  Loop, Five Moves, Altitude Control, When Stuck, Portable Techniques, Harness
  Leverage, Pattern-match satisfaction, Template hijack, Fluent ≠ true, Prior-as-fact,
  Confirmation seeking, Frame adoption, Completion pressure, Surface blindness.
- **Tất cả rules:** Chuẩn hóa tên file với prefix `sdlc-` và suffix `-rules`:
  `fable-thinking.md` → `sdlc-fable-thinking-rules.md`,
  `sdlc-routing.md` → `sdlc-routing-rules.md`,
  `sdlc-pipeline.md` → `sdlc-pipeline-rules.md`,
  `sdlc-orchestration.md` → `sdlc-orchestration-rules.md`.
- **Tất cả rules:** Chuẩn hóa ngôn ngữ — giải thích bằng tiếng Việt, technical terms
  bằng tiếng Anh. Các block quan trọng dùng XML tags: `<EXTREMELY-IMPORTANT>`.
- **sdlc-routing-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML blocks cho critical
  sections (Intent → Flow Resolution, Anti-Patterns).
- **sdlc-pipeline-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML block cho Gate Protocol
  mandatory rule. Sửa TDD cycle diagram.
- **sdlc-orchestration-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML blocks cho Controller
  Responsibilities, Parallel Work Safety, Escalation Protocol, fixbug constraint, và
  When Stuck guidance.
- **references/fable-thinking/protocol.md:** Cập nhật reference đến rule mới
  (`sdlc-fable-thinking-rules.md`).
- **sdlc-orchestrator 1.12.1:** Cập nhật reference từ `sdlc-escalation` →
  `sdlc-orchestration-rules.md` Escalation Protocol.

## [2.25.0] - 2026-07-23

### Changed
- **fable-thinking rule:** Cắt từ 400 → 165 dòng. Giữ The Floor, Claim Discipline,
  Proportionality Gate, Self-Review Gate, Execution Notes — phần luôn chạy. Chuyển 5
  Moves, Constraint Loop, Portable Techniques, Harness Leverage, Anti-Patterns, Altitude
  Control, When Stuck sang `.claude/references/fable-thinking/protocol.md` (load
  on-demand trong Standard/Full mode).
- **sdlc-routing rule:** Thêm bảng Anti-Patterns (5 template nguy hiểm khi pattern-match)
  từ `sdlc-fable-thinking.md`. Thêm bước "hold ≥2 viable flow hypotheses" vào
  Resolution Procedure.

### Removed
- **sdlc-fable-thinking rule:** Đã merge nội dung unique vào `sdlc-routing.md`
  (anti-patterns) và `sdlc-orchestration.md` (human interaction principles, when stuck).
  Phần restate fable-thinking protocol đã có trong `fable-thinking.md` rule.
- **sdlc-escalation rule:** Đã merge vào `sdlc-orchestration.md` (Escalation Protocol
  section với escalation chain, triggers table, fail-safe principles, message format).
- **sdlc-entry-gate rule:** Đã xóa — preflight logic do từng skill tự quản lý
  (orchestrator, automation, quick), không cần rule canonical.

### Summary
- Rules: 7 → 4 (fable-thinking, sdlc-routing, sdlc-pipeline, sdlc-orchestration)
- Tổng dòng: 919 → 448 (giảm 51%)
- Kiến trúc: rule = canonical reference (routing table, pipeline structure,
  orchestration protocol), skill = execution procedure. Không duplicate.

## [2.24.0] - 2026-07-23

### Changed
- **fable-thinking:** Chuyển từ skill thành rule — giao thức suy luận giờ luôn active trong context, không cần invoke thủ công. Rule tại `.claude/rules/fable-thinking.md`, references tại `.claude/references/fable-thinking/`. Skill gốc được giữ lại trong `.claude/skills/fable-thinking/`.
- **sdlc-orchestrator 1.12.0:** Thay thế mọi `Skill("fable-thinking")` bằng hướng dẫn áp dụng fable-thinking protocol nội tại. 4 decision points (escalation, flow detection, foundation gate, pipeline scope) giờ dùng protocol trực tiếp.
- **sdlc-automation 1.7.0:** Thay thế mọi `Skill("fable-thinking")` bằng hướng dẫn áp dụng fable-thinking protocol nội tại. 5 decision points (grilling exit, fail-safe, bug keyword, flow detection, gate fail) giờ dùng protocol trực tiếp.
- **sdlc-fable-thinking rule:** Cập nhật để reference rule fable-thinking chung, tập trung vào SDLC-specific application.

## [2.23.0] - 2026-07-23

### Added
- **sdlc-orchestrator 1.11.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries escalation, Flow Detection ambiguous, Foundation Gate fail, Pipeline Scope skip. Mỗi điểm gọi `Skill("fable-thinking")` với context cụ thể trước khi human quyết định.
- **sdlc-automation 1.6.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries (grilling exit + fail-safe), Flow Detection ambiguous, Bug keyword auto-escalation (thay thế auto-escalate bằng fable-thinking verify), Fail-safe sau 2 retry.
- **sdlc-fable-thinking rule:** Rule file `.claude/rules/sdlc-fable-thinking.md` định nghĩa when to invoke, invocation protocol, ambiguity detection criteria, và integration roadmap.

## [2.22.0] - 2026-07-21

### Changed
- **human-docs 2.5.0:** Bỏ workflow `human-docs-review.js` — chỉ spawn 1 agent duy nhất, không có orchestration logic. Chuyển logic spawn agent + format output vào thẳng SKILL.md body. Sync commands (sync:srs, sync:architecture) vẫn dùng workflow vì có parallel fan-out + data aggregation có ý nghĩa.

## [2.21.6] - 2026-07-21

### Changed
- **sdlc-preflight 1.0.1:** Thêm `user-invocable: false` — skill này được gọi tự động bởi orchestrator/automation trong SDLC entry gate, không phải user-facing command.
- **workflow-knowledge 1.3.1:** Thêm `user-invocable: false` — knowledge skill thuần túy dạy Claude về Workflow tool API, auto-activates khi Claude viết workflow scripts.

## [2.21.5] - 2026-07-21

### Changed
- **sdlc-automation 1.5.3:** Chuyển cook Monitor & Report template (20 dòng) từ SKILL.md vào `references/cook-flow.md#giai-đoạn-8-monitor--report`. SKILL.md giữ summary ngắn + link ref file. Cả 3 flows (task, cr, cook) giờ nhất quán dùng summary+link pattern.

## [2.21.4] - 2026-07-21

### Changed
- **sdlc-automation 1.5.2:** Trích xuất task flow procedure (105 dòng) ra `references/task-flow.md`. SKILL.md giữ summary 4 bước + link ref file, nhất quán với cr/cook flow pattern.
- **sdlc-pipeline:** Sửa 4 tên cross-cutting agent thiếu prefix `sdlc-lld-` trong forward pipeline table. Cả 5 tên giờ đều dùng full qualified name.

## [2.21.3] - 2026-07-21

### Added
- **sdlc-gate, codebase-gate, sdlc-tdd-be-gate, sdlc-tdd-fe-gate:** Added PreToolUse validation hooks for defense-in-depth. All 4 gate agents are read-only but now have hooks calling `sdlc-validate-agent-output.sh` to block any accidental Write/Edit/Bash output.
- **sdlc-validate-agent-output.sh:** Added `sdlc-tdd-be-gate` and `sdlc-tdd-fe-gate` to the read-only gate case (merged with `sdlc-gate|codebase-gate`).

## [2.21.2] - 2026-07-21

### Fixed
- **sdlc-validate-agent-output.sh:** Added `codebase-gate` case (merged with `sdlc-gate`) in phase validation. Previously `codebase-gate` fell through to the catch-all `*` case, printing "Unknown phase" to stderr. Gate agents are read-only — the case blocks Write/Edit/Bash as defense-in-depth, symmetric with `sdlc-gate`.

## [2.21.1] - 2026-07-21

### Changed
- **sdlc-automation 1.5.1:** Documented fixbug flow as orchestrator-only. Bug keywords ("bug"/"lỗi"/"fix") now trigger explicit escalation to orchestrator with `flow=fixbug` instead of ambiguous hints. Fixbug requires human diagnosis judgment — cannot be autonomous.
- **sdlc-routing:** Added "Available via" column to intent→flow table. `fixbug` explicitly marked as **orchestrator only**.
- **sdlc-escalation:** Added fixbug flow section documenting orchestrator-only constraint and escalation rules from quick/automation.
- **sdlc-entry-gate:** Added orchestrator-only annotation to fixbug row.

## [2.21.0] - 2026-07-21

### Changed
- **sdlc-automation 1.5.0:** Replaced agent self-check gate pattern with independent `sdlc-gate` verification. Writing agents no longer self-evaluate — workflow spawns dedicated `sdlc-gate` (model: sonnet, read-only) after each phase to verify outputs against structured criteria. Cross-cutting uses a single centralized gate check after all agents complete. Added retry context with `previousFailure` (max 2 attempts) and regression detection. Removed dead `GATE_CRITERIA` inline object and all `## Gate Self-Check` sections from agent prompts. Workflow meta now includes explicit Gate phase.
- **workflow-sdlc-automation.js:** `runPhase()` now two-step: spawn writing agent → spawn `sdlc-gate`. New `gateCheck()` function with `crossCuttingScope` support. `parseGateVerdict()` replaces `parseGateResult()` — parses `GATE_VERDICT: PASS|FAIL` structured output. Cross-cutting agents use `skipGate: true` — gate unified after all CC outputs.

## [2.20.0] - 2026-07-21

### Added
- **sdlc-gate 1.0.0:** New dedicated gate agent for the forward SDLC pipeline. Validates SRS, HLD, LLD, CROSS-CUTTING, IMP, and TST phase outputs against structured per-phase criteria with concrete grep-able verification instructions. Read-only (Read, Bash, Glob, Agent) — returns `GATE_VERDICT: PASS|FAIL` with per-criteria breakdown, per-entity reporting, and regression detection. Supports retry context (max 3 attempts) and conditional cross-cutting criteria via `crossCuttingScope`. Symmetric to `codebase-gate` in the reverse pipeline. Replaces the manual gate checklist previously in `procedures.md:356-404`.

### Changed
- **sdlc-orchestrator (procedures.md):** Section 4 replaced manual gate checklist with `sdlc-gate` agent spawn template (Section 4.0) and criteria summary tables with critical flag markers. Section 1.1 spawn templates updated to reference sdlc-gate. Cross-cutting templates updated.
- **sdlc-orchestrator (flow-task.md):** Step 4.1 sub-step 7 and step 4.3 sub-step 7 updated to spawn `sdlc-gate` instead of manual gate verification. Spawn templates simplified — removed gate self-check instructions (now handled by sdlc-gate).
- **sdlc-pipeline.md:** Gate Protocol section updated to document both `sdlc-gate` (forward) and `codebase-gate` (reverse) as phase gate agents.
- **sdlc-validate-agent-output.sh:** Added `sdlc-gate` case — defense-in-depth block for any accidental Write/Edit attempts on the read-only gate agent.

## [2.19.2] - 2026-07-20

### Fixed
- **human-docs-sync-srs 1.1.1:** Xóa tất cả references đến `agent_docs/` khỏi SRS-TEMPLATE.md. SRS là tài liệu cho người đọc — phải tự chứa đầy đủ nội dung, không bắt người đọc nhảy sang file khác. Bỏ cột "Source" (link về agent_docs) trong FR Overview, bỏ link error-handling.md trong Security section, bỏ link caching-strategy.md trong Scalability section, bỏ reference đến user-context.md trong fallback message. Agent definition cập nhật FR overview table header và hard boundary fallback message cho đồng bộ.

## [2.19.1] - 2026-07-20

### Fixed
- **human-docs 2.4.1:** Sửa 5 stale references từ đợt tái cấu trúc routing hub (2.19.0). SRS-TEMPLATE.md: link `docs/architecture/error-handling.md` → `agent_docs/error-handling.md`, link `docs/architecture/caching-strategy.md` → `agent_docs/caching-strategy.md`, bỏ tham chiếu `agent_docs/scale-strategy.md` (không tồn tại). SKILL.md edge case: `ADRs/README.md` → `README.md`. sync-architecture.js: log message `ADRs/README.md` → `README.md`.
- **human-docs-review 1.0.0:** Thêm `version` field vào frontmatter (bị thiếu từ khi tạo).

## [2.19.0] - 2026-07-20

### Changed
- **human-docs 2.4.0:** Tái cấu trúc hoàn toàn sync:architecture. **Bỏ copy as-is** cross-cutting files. Thay bằng routing hub: `docs/architecture/README.md` trỏ thẳng về `agent_docs/` cho ADRs + 5 cross-cutting files. `system-architecture.md` tổng hợp cross-cutting summaries (1 đoạn/file). Output giảm từ ~8 files xuống 3 files (README.md + system-architecture.md + diagrams/).
- **human-docs-sync-architecture 1.3.0:** Step 4 thay bằng đọc cross-cutting files để lấy summaries (không copy). Step 5 thay `ADRs/README.md` bằng `README.md` hub routing. Step 6 (cross-cutting copy) bị xóa. Output schema: `cross_cutting_synced`/`skipped` → `cross_cutting_summaries`/`missing` + `readme_generated`.
- **human-docs-sync-srs 1.1.0:** Step 6 dùng `SRS-TEMPLATE.md` (8 sections, có NFR sub-categories). Step 7 (features/README.md) revert về inline — index table không cần template riêng.
- **human-docs-review:** Cập nhật scan paths — cross-cutting files không còn check trong docs/ (chỉ check routing references trong README.md).
- **Templates:** 3 templates thay vì 4. `SRS-TEMPLATE.md` (đầy đủ 8 sections), `system-architecture-TEMPLATE.md` (14 sections với cross-cutting summaries), `architecture-README-TEMPLATE.md` (routing hub). Xóa `features-README-TEMPLATE.md` và `ADRs-README-TEMPLATE.md` (index đơn giản → inline).

## [2.18.0] - 2026-07-20

### Added
- **human-docs 2.3.0:** Thêm cross-cutting sync vào `sync:architecture`. 5 file (`error-handling.md`, `caching-strategy.md`, `frontend-architecture.md`, `frontend-test-strategy.md`, `performance-test.md`) được sync as-is từ `agent_docs/` → `docs/architecture/` với header nguồn. File cross-cutting không tồn tại → skip file đó, không block.
- **human-docs-sync-architecture 1.1.0:** Added Step: Sync cross-cutting files (5 files). Updated output schema with `cross_cutting_synced` and `cross_cutting_skipped`. Added hard boundary: never create empty placeholder files for missing cross-cutting sources.
- **human-docs-review:** Mở rộng review scope — quét 5 file cross-cutting source + output. Classify `missing` nếu source tồn tại nhưng chưa sync.

## [2.17.0] - 2026-07-20

### Added
- **codebase-cross-cutting-error-handling 1.0.0:** New dedicated agent for reverse pipeline — extracts observed error handling patterns from code artifacts. Uses OBSERVE mindset (not DESIGN): documents patterns, inconsistencies, and gaps rather than prescribing standards. Writes `agent_docs/error-handling.md`.
- **codebase-cross-cutting-caching-strategy 1.0.0:** New dedicated agent for reverse pipeline — extracts observed caching patterns from code artifacts (L0-L3 layers, cache inventory, invalidation strategies, stampede prevention). Writes `agent_docs/caching-strategy.md`.
- **codebase-cross-cutting-performance-test 1.0.0:** New dedicated agent for reverse pipeline — creates performance test plan from reverse-engineered SRS NFRs and per-service LLD performance characteristics. Writes `agent_docs/performance-test.md`.
- **codebase-cross-cutting-frontend-architecture 1.0.0:** New dedicated agent for reverse pipeline — extracts observed frontend architecture patterns (rendering strategy, state management, auth, error boundaries). Writes `agent_docs/frontend-architecture.md`.
- **codebase-cross-cutting-frontend-test-strategy 1.0.0:** New dedicated agent for reverse pipeline — extracts observed frontend test strategy (test pyramid, MSW patterns, coverage targets). Runs in Stage 2 after error-handling + frontend-architecture. Writes `agent_docs/frontend-test-strategy.md`.
- **sdlc-codebase 1.4.0:** Added Cross-Cutting phase to reverse pipeline (Phase 4, between SRS and IMP+TST). 5 dedicated agents with scope detection + 2-stage fan-out (Stage 1: 4 agents parallel, Stage 2: 1 agent after barrier). Updated pipeline diagram, subagent table, smart detection, and flow documentation.
- **workflow-codebase-reverse.js:** Added Cross-Cutting phase with scope detection, Stage 1 (4 agents parallel), barrier, Stage 2 (frontend-test-strategy), gate check with retry, and report integration.

### Changed
- **codebase-lld-synthesis 1.1.0:** Slimmed — removed `cross-cutting.md` generation (deferred to dedicated `codebase-cross-cutting-*` agents in post-SRS phase). Now focuses on API contract synthesis, error code canonicalization, FR candidates, and service interaction mapping.

### Documentation
- **flow-reverse.md:** Added Phase 3.5 Cross-Cutting section with scope detection rules, mode explanation (OBSERVE vs DESIGN), expected outputs table, and gate criteria.
- **procedures.md:** Added Cross-Cutting Gate criteria (7 checks) and Explore patterns for all 5 cross-cutting agents.
- **SKILL.md:** Updated pipeline diagram, phase explanation, subagent table with 5 new agents, and smart detection with cross-cutting artifacts.

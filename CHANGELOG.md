# Changelog

All notable changes to the skills-toolkit plugin are documented here.

## [2.25.0] - 2026-07-23

### Added
- **sdlc-routing rule:** 4 fable-thinking guards — Flow Detection (Resolution Procedure), Trivial Gate (Priority Rules), Bug vs False Positive (fixbug Flow), Escalation (Escalation Protocol)
- **sdlc-pipeline rule:** 3 fable-thinking guards — CROSS-CUTTING Scope (Forward Pipeline), TDD Interference (TDD Cycle), Gate Failure Strategy (Gate Protocol)
- **sdlc-entry-gate rule:** 2 fable-thinking guards — Foundation Gate Fail (Bước 2), Flow-Scope Mismatch (Bước 3)
- **sdlc-orchestration rule:** 1 fable-thinking guard — Fail-Safe (Workflow Dispatch)
- **sdlc-development-rules rule:** 1 fable-thinking guard — Spec Deviation (Spec Traceability)
- **sdlc-review-rules rule:** 2 fable-thinking guards — Audit vs Human Decision (Human Decisions), Severity Classification (Severity Classification)

## [2.24.0] - 2026-07-23

### Changed
- **sdlc rules cleanup:** Loại bỏ 148 dòng (-21%) nội dung không cần thiết trên 7 rule files: duplication, procedural HOW-TO, meta-tracking, generic content, output templates. Sửa reference sai path `skills/fable-thinking/SKILL.md` → `fable-thinking` skill name.

### Added
- **sdlc-development-rules rule:** Rule file `.claude/rules/sdlc-development-rules.md` thiết lập coding standards dùng chung cho mọi SDLC agent viết code (IMP, TDD-BE/FE, refactor). Dựa trên `development-rules.md` của claudekit, điều chỉnh cho context SDLC: baseline (YAGNI/KISS/DRY), quality gates (test first, không giấu errors, conventional commits), TDD discipline (RED→GREEN→REFACTOR), spec traceability, và tooling rules.
- **sdlc-review-rules rule:** Rule file `.claude/rules/sdlc-review-rules.md` thiết lập framework xử lý review/audit findings cho gate agents và code review agents. Dựa trên `review-audit-self-decision.md` của claudekit, điều chỉnh cho context SDLC: verified decisions, human decisions (không âm thầm đảo ngược), threat model, gate verdict handling (PASS/FAIL critical/FAIL non-critical/FAIL regression), severity classification (Critical/High/Medium/Low), scout-first principle, và stable code artifacts.

### Changed
- **sdlc-orchestration rule:** Thêm section "Model Escalation" — khi orchestrator hoặc phase agent gặp hard problem (repeated failed attempts, high-stakes design fork, fuzzy requirements), spawn `Agent("sdlc-fable-thinking", ...)` để được counsel thay vì switch session model. Protocol hoạt động trên mọi model tier, không cần `model: fable`.
- **sdlc-fable-thinking-rules rule:** Thêm 3 decision points mới (Spec Deviation, Severity Classification, Audit vs Human Decision) và 2 rule files mới vào cross-reference table. Integration roadmap thêm Phase 2.5 cho 2 rule mới.

## [2.23.0] - 2026-07-23

### Added
- **sdlc-orchestrator 1.11.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries escalation, Flow Detection ambiguous, Foundation Gate fail, Pipeline Scope skip. Mỗi điểm gọi `Skill("fable-thinking")` với context cụ thể trước khi human quyết định.
- **sdlc-automation 1.6.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries (grilling exit + fail-safe), Flow Detection ambiguous, Bug keyword auto-escalation (thay thế auto-escalate bằng fable-thinking verify), Fail-safe sau 2 retry.
- **sdlc-fable-thinking-rules rule:** Rule file `.claude/rules/sdlc-fable-thinking-rules.md` định nghĩa fable-thinking như reasoning protocol (không phải utility skill), 2 phương thức áp dụng (Skill + Agent), decision points mở rộng qua tất cả 5 rule files, và integration roadmap 3 giai đoạn.

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

# Changelog

All notable changes to the skills-toolkit plugin are documented here.

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

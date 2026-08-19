# Scout Report: sdlc-scout-skill

**Ngày:** 2026-08-03T13:20:00+07:00
**Loại:** claude-skill
**Đường dẫn:** .claude/skills/sdlc-scout/
**Focus:** Cấu trúc của skill sdlc-scout, các file của nó, và cách nó được tổ chức

## Tổng quan
sdlc-scout là skill Claude Code dùng để khám phá codebase có cấu trúc, phục vụ toàn bộ hệ sinh thái SDLC (review, explore, fixbug, task, cr, contract, compliance, phase execution, brainstorming, standalone). Thư mục được tổ chức theo mô hình progressive disclosure: `SKILL.md` là entry point self-contained chứa toàn bộ quy trình 5 giai đoạn, còn 7 reference files trong `references/` cung cấp chi tiết triển khai được load on-demand khi cần.

## Tóm tắt
- Tổng số file: 8 (3 high, 4 medium, 1 low)
- Patterns: 9
- Technologies: 3
- Modules: 8
- Entry Points: 4

## Các File Liên Quan
### Mức Độ Cao (3)
- `.claude/skills/sdlc-scout/SKILL.md` — File core, entry point duy nhất Claude đọc khi skill được gọi. Chứa frontmatter (name, description, version 2.2.0, allowed-tools, argument-hint) + toàn bộ quy trình 5 giai đoạn + nguyên tắc chính + danh sách references (exports: quy-trình-5-giai-đoạn, bảng-chiến-lược, allowed-tools)
- `.claude/skills/sdlc-scout/references/report-format.md` — Định nghĩa template report 10 section và return data schema (`reports[]` + `gaps`), là cấu trúc output cốt lõi mà mọi skill hạ nguồn tiêu thụ
- `.claude/skills/sdlc-scout/references/scout-execution.md` — Chi tiết tổ chức Explore agents: prompt template, chiến lược chia thư mục, quy mô agent, xử lý timeout 3 phút, chunked file reading `ceil(lines/500)`

### Mức Độ Trung Bình (4)
- `.claude/skills/sdlc-scout/references/integration-guide.md` — Pattern tích hợp sdlc-scout vào các skill SDLC khác (sdlc-review, sdlc-explore, sdlc-fixbug, sdlc-flow-task, sdlc-flow-cr, sdlc-flow-contract) kèm diff ví dụ và checklist verify
- `.claude/skills/sdlc-scout/references/pipeline-handoff.md` — Args schema (subProjects array), result structures, error handling, retry strategy cho `workflow-sdlc-scout-pipeline.js` (chỉ dùng khi mode=explore hoặc codebase >200 file)
- `.claude/skills/sdlc-scout/references/quality-gates.md` — 5 quality gates (Report Completeness, Coverage Audit, Schema Compliance, Performance, Relevance), self-test mode, integration test patterns
- `.claude/skills/sdlc-scout/references/sdlc-enhancement.md` — Quy trình dùng 1 Explore agent bổ sung SDLC-specific sections (Modules, Entry Points, Dependencies, Architectural Patterns) sau khi có report cơ bản

### Mức Độ Thấp (1)
- `.claude/skills/sdlc-scout/references/task-management.md` — TaskCreate/TaskUpdate patterns qua Claude Native Tasks. Chỉ áp dụng khi ≥3 Explore agent; không liên quan đến scouting codebase nhỏ

## Công Nghệ Sử Dụng
| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Markup | Markdown | — | Toàn bộ nội dung skill (SKILL.md + 7 references) |
| Metadata | YAML frontmatter | — | Invocation metadata: name, description, version, allowed-tools, argument-hint |
| Skill runtime | Claude Code Agent Skill | — | Cơ chế phân phối và auto-discovery (category: sdlc) |

## Cấu Trúc Thư Mục
```
.claude/skills/sdlc-scout/
├── SKILL.md                          - Entry point: frontmatter + quy trình 5 giai đoạn + nguyên tắc
└── references/
    ├── integration-guide.md          - Hướng dẫn tích hợp cho skill SDLC khác
    ├── pipeline-handoff.md           - Args schema cho workflow pipeline (>200 file / explore)
    ├── quality-gates.md              - 5 quality gates + self-test mode
    ├── report-format.md              - Template report + return data schema
    ├── scout-execution.md            - Prompt template + chia thư mục + chunked reading
    ├── sdlc-enhancement.md           - Bổ sung SDLC sections sau scout
    └── task-management.md            - Task registration (chỉ khi ≥3 agent)
```

## Modules và Trách Nhiệm
- **core (SKILL.md)** — Điều phối toàn bộ quy trình: phát hiện sub-project, quyết định chiến lược, thực thi, audit, output (depends on: tất cả references, load on-demand)
  - Public API: `Skill(sdlc-scout, "<path> --mode <review|explore> --focus <desc>")`, `/sdlc-scout`, argument-hint `<target-path> [--focus] [--patterns] [--mode]`
- **execution-engine (scout-execution.md)** — Chiến lược chia thư mục, prompt template Explore agent, chunked reading, timeout handling (depends on: task-management khi ≥3 agent)
- **report-format (report-format.md)** — Template report 10 section, return data schema, các trường bắt buộc (depends on: none)
- **pipeline-handoff (pipeline-handoff.md)** — Args schema + result structures cho workflow pipeline (depends on: workflow-sdlc-scout-pipeline.js external)
- **quality-gates (quality-gates.md)** — 5 gates verify chất lượng report, self-test mode (depends on: report-format)
- **integration-guide (integration-guide.md)** — Pattern tích hợp + diff ví dụ cho downstream skills (depends on: report-format)
- **sdlc-enhancement (sdlc-enhancement.md)** — Bổ sung SDLC sections sau scout (depends on: scout-execution)
- **task-management (task-management.md)** — TaskCreate/TaskUpdate patterns, metadata schema, vòng đời agent (depends on: none)

## Entry Points
| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| SKILL.md | Skill entry | .claude/skills/sdlc-scout/SKILL.md | File duy nhất Claude đọc khi skill được trigger |
| `/sdlc-scout` command | CLI | — | User invocation: `sdlc-scout <path> [--focus] [--patterns] [--mode review\|explore\|self-test]` |
| Skill() invocation | API | — | Downstream SDLC skills gọi programmatically, nhận `scoutResult.reports[]` |
| workflow-sdlc-scout-pipeline.js | Workflow script | .claude/workflows/scout/workflow-sdlc-scout-pipeline.js | Chiến lược B: mode=explore hoặc sub-project >200 file |

## Dependencies
### Internal
| Module | Depends On | Relationship |
|--------|-----------|--------------|
| SKILL.md (core) | scout-execution, task-management, sdlc-enhancement, report-format | Load-on-demand trong quy trình 5 giai đoạn (3A.1 → scout-execution, 3A.2 → task-management, 3A.5 → sdlc-enhancement, GĐ5 → report-format) |
| scout-execution | task-management | Đăng ký task khi ≥3 agent |
| sdlc-enhancement | scout-execution | Spawn thêm Explore agent sau tổng hợp kết quả |
| pipeline-handoff | quality-gates | Pipeline strategy tự động bao gồm giai đoạn audit |

### External
| Package | Version | Purpose |
|---------|---------|---------|
| workflow-sdlc-scout-pipeline.js | file (20,966 bytes) | Pipeline strategy: nhận subProjects args, fan-out, caching, audit |
| repomix | installed (Node v24.16.0) | Đóng gói codebase lớn → XML snapshot (tùy chọn, pipeline strategy) |

## Architectural Patterns
- **Scale-based routing** — Chọn chiến lược theo mode + số file: review+<50 → 1 agent, review+50-200 → 2-4 agent, review+>200 hoặc explore → pipeline workflow (evidence: SKILL.md:125-131)
- **Progressive disclosure** — SKILL.md self-contained; references chỉ load khi cần (evidence: SKILL.md:255-263 "Hướng Dẫn Tham Chiếu")
- **Frontmatter-driven invocation** — Metadata (description, keywords, when_to_use) quyết định auto-activation và routing (evidence: SKILL.md:2-20)
- **Bash để phát hiện, Agent để scout** — Giai đoạn 1 chạy cấp skill bằng Bash (không tốn agent context); Giai đoạn 3 spawn Explore agent trực tiếp (evidence: SKILL.md:89-91, 139-189)
- **Idempotent caching** — Kiểm tra report tồn tại trước khi scout; bỏ qua sub-project đã có report hợp lệ (evidence: SKILL.md:209-214)
- **Fixed timeout 3 phút** — Agent timeout bị bỏ qua, không restart, tổng hợp kết quả có sẵn (evidence: SKILL.md:189)
- **Structured output schema** — Report theo 10 section cố định; return data schema `reports[]` + `gaps` (evidence: references/report-format.md:11-111)
- **Fallback guard** — Workflow script thiếu → fallback về direct Explore agent kèm cảnh báo (evidence: SKILL.md:221)
- **Task management conditional** — Chỉ đăng ký TaskCreate/TaskUpdate khi ≥3 agent; tránh overhead cho scout nhỏ (evidence: SKILL.md:250, references/task-management.md)

## Câu Hỏi Chưa Giải Quyết
- Target là thư mục skill (markdown documentation), không phải codebase phần mềm — các phần "Entry Points" và "Công Nghệ Sử Dụng" áp dụng theo nghĩa cấu trúc skill (invocation surface, file format), không phải runtime service.
- `references/task-management.md` chỉ áp dụng khi ≥3 Explore agent; không kích hoạt trong lần scout này vì codebase nhỏ (<50 file → 1 agent).
- Chiến lược B (pipeline + repomix) đã verify tồn tại (workflow script có mặt, repomix installed) nhưng không được thực thi trong lần scout này (review mode, <50 file). Chưa kiểm tra hành vi runtime của pipeline script.
- Nội dung chi tiết của `SKILL.md` frontmatter đã được đọc; các reference files chỉ đọc phần cần cho quy trình này (report-format, scout-execution) — các reference còn lại mô tả theo phần tóm tắt từ Explore agent, chưa đọc toàn văn.

---

*Report generated by sdlc-scout*

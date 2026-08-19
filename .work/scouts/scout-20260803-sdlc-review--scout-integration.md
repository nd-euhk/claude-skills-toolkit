# Scout Report: sdlc-review

**Ngày:** 2026-08-03
**Loại:** claude-code-skill (markdown)
**Đường dẫn:** .claude/skills/sdlc-review/
**Focus:** sdlc-scout integration points — cách sdlc-review gọi và tích hợp sdlc-scout

## Tổng quan

sdlc-review là skill review code/MR/PR workflow-driven trên 7 dimension. Trong mode `--code`, skill gọi `Skill(sdlc-scout, ...)` (Phase 5a) trước khi dispatch workflow review để lấy structured codebase report. Workflow tiêu thụ kết quả qua `codeArgs.scoutReports` và inject scout summary vào context của 7 dimension agents; khi `scoutReports` rỗng, dimension agents tự explore codebase (graceful degradation). MR/PR mode không gọi sdlc-scout — chỉ mode `--code`.

## Tóm tắt

- Tổng số file: 2 (2 high, 0 medium, 0 low)
- Patterns: 5
- Technologies: 4
- Modules: 2
- Entry Points: 1 (mode `--code` — integration point duy nhất)

## Các File Liên Quan

### Mức Độ Cao (2)

- `.claude/skills/sdlc-review/SKILL.md` — Chứa integration call duy nhất: `Skill(sdlc-scout, ...)` tại Phase 5a (dòng 284); truyền `scoutReports` vào `codeArgs` (dòng 292); dispatch `workflow-sdlc-review-code.js` (dòng 297-300). (exports: frontmatter `name`/`allowed-tools`; core workflow Phase 1-6)
- `.claude/skills/sdlc-review/references/workflow-handoff.md` — Document contract: `codeArgs.scoutReports[]` schema từ sdlc-scout (dòng 144-147); mô tả workflow tiêu thụ scout output và fallback self-explore khi rỗng (dòng 177-184). (exports: document-only)

### Mức Độ Trung Bình (0)

### Mức Độ Thấp (0)

## Công Nghệ Sử Dụng

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Skill format | Markdown + YAML frontmatter | — | SKILL.md instructions và metadata |
| Claude Code API | `Skill()` tool | — | Gọi sdlc-scout từ sdlc-review (mode `--code`) |
| Claude Code API | `Workflow()` tool | — | Dispatch `workflow-sdlc-review-code.js` với `scoutReports` |
| Script (external) | JavaScript | — | `workflow-sdlc-review-code.js` tiêu thụ `scoutReports[]` |

## Cấu Trúc Thư Mục

```
.claude/skills/sdlc-review/
├── SKILL.md                    - Controller: parse input, route, dispatch workflow, gọi sdlc-scout
└── references/
    └── workflow-handoff.md     - Args/result contract giữa skill và workflow
```

## Modules và Trách Nhiệm

- **sdlc-review (SKILL.md)** — Controller chính: parse flags, menu routing, platform detection, CLI gate, dispatch workflow. Tích hợp sdlc-scout tại Phase 5a — chỉ mode `--code`.
  - Public API: `/sdlc-review --mr|--pr|--code <path> [--full|--arch|--security|--bugs|--conventions|--impact|--ops|--tests] [--adversarial]`
  - Integration với sdlc-scout: `Skill(sdlc-scout, "${targetPath} --mode review --focus '${focus}'")` → `scoutResult?.reports || []` → `codeArgs.scoutReports`
- **workflow-handoff (references/)** — Reference contract: args schema (`mrArgs`/`codeArgs`), result schema, error handling patterns, adversarial flow.
  - Public API: document-only; khai báo `scoutReports` là array structured scout output từ sdlc-scout

## Entry Points

| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| `/sdlc-review --code <path>` | Skill command (code mode) | SKILL.md Phase 5 | Invokes sdlc-scout (mode review) → dispatch code review workflow với `scoutReports` |

## Dependencies

### Internal

| Module | Depends On | Relationship |
|--------|-----------|--------------|
| sdlc-review (SKILL.md) | sdlc-scout skill | Gọi `Skill(sdlc-scout, ...)` — structured codebase report thay vì tự explore |
| sdlc-review (SKILL.md) | workflow-sdlc-review-code.js | Dispatch qua `Workflow()` với `codeArgs.scoutReports` |
| workflow-sdlc-review-code.js | sdlc-scout report | Tiêu thụ `scoutReports[]` fields: name, outputPath, filesFound, highRelevance, modulesFound, entryPointsFound |

### External

| Package | Version | Purpose |
|---------|---------|---------|
| gh CLI | — | Fetch PR diff/metadata (chỉ MR/PR mode) |
| glab CLI | — | Fetch MR diff/metadata (chỉ MR/PR mode) |

## Architectural Patterns

- **Skill-to-skill delegation (`Skill()` tool)** — SKILL.md:284 — sdlc-review gọi sdlc-scout thay vì tự implement scout logic; nhận structured `reports[]` thay vì tự Grep/Glob/Read toàn bộ codebase.
- **Workflow args handoff (structured, không phải string)** — SKILL.md:292, workflow-handoff.md:144 — `scoutReports` là object array truyền vào workflow args; workflow destructure `scoutReports` từ `_args` (workflow-sdlc-review-code.js:14).
- **Context injection / progressive disclosure** — workflow-sdlc-review-code.js:422-444 — `codeContext(scoutSummary)` inject scout summary vào context mỗi dimension agent; agents được hướng dẫn "Read the scout report(s)... prioritize High-relevance files" thay vì tự explore.
- **Graceful degradation** — SKILL.md:292 (`scoutResult?.reports || []`), workflow-sdlc-review-code.js:429-431, 471-475 — khi `scoutReports` rỗng, dimension agents tự explore codebase bằng Bash(find, ls), Glob, Grep, Read.
- **Phase-gated dispatch** — SKILL.md:280-301 — Phase 5a scout trước khi dispatch workflow; guard `ls .claude/workflows/review/workflow-sdlc-review-code.js` chặn dispatch nếu thiếu script.

## Câu Hỏi Chưa Giải Quyết

- **`allowed-tools` thiếu `Skill`** — frontmatter `allowed-tools` (SKILL.md:14-27) không liệt kê `Skill`, nhưng body yêu cầu `Skill(sdlc-scout, ...)` (dòng 284). Cần verify runtime có cho phép gọi `Skill` tool từ skill này hay không (so với sdlc-scout's own allowed-tools có liệt kê `Skill`).
- **`focus` variable không được định nghĩa trong parse flow** — SKILL.md Phase 1 parse mode/dimensions/adversarial/path nhưng không extract `focus`; tại dòng 284 dùng `${focus || ''}` → luôn là `--focus ""` (empty) trong thực tế. sdlc-scout nhận empty focus. Không phải bug, nhưng focus không bao giờ được populate từ user args.
- **Workflow script nằm ngoài target** — `.claude/workflows/review/workflow-sdlc-review-code.js` (790 dòng) là dependency ngoài phạm vi scout này; chỉ grep và đọc phần tiêu thụ `scoutReports` (dòng 14, 422-481, 732-733, 779), chưa đọc toàn bộ script.
- **Chỉ mode `--code` gọi sdlc-scout** — MR/PR mode không gọi scout (phù hợp vì review diff không cần scout; sdlc-scout SKILL.md cũng ghi "Review MR/PR diff → dùng sdlc-review --mr (không cần scout)").

---

*Report generated by sdlc-scout*

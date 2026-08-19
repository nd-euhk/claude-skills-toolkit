# Scout Report: sdlc-review skill

**Ngày**: 2026-08-01
**Target**: `.claude/skills/sdlc-review/`
**Mode**: review
**Focus**: sdlc-review skill structure

## Tổng Quan

`sdlc-review` là skill code review workflow-driven: phân tích song song MR/PR hoặc source code qua 7 dimension (architecture, security, bugs, CLAUDE.md conventions, impact, ops, tests). Hỗ trợ adversarial verification (3 skeptics/finding, quorum 2/3) để giảm false positive. Toàn bộ pipeline deterministic nằm trong 2 workflow script (`workflow-sdlc-review-mr.js`, `workflow-sdlc-review-code.js`), skill lo phần interactive (menu, CLI check, dispatch, post comment).

## Tóm Tắt

| File | Dung lượng | Vai trò |
|---|---|---|
| `SKILL.md` | 389 dòng | Orchestration surface: parse flags, menu 3 câu, workspace discovery, platform detection, CLI gate, dispatch, post comments |
| `references/workflow-handoff.md` | 266 dòng | Contract giữa skill và 2 workflow scripts (args/result schema, error patterns, phases) |

## Các File Liên Quan (theo relevance)

1. **`SKILL.md`** — quan trọng nhất: toàn bộ routing và quyết định invoke.
2. **`references/workflow-handoff.md`** — contract arg/result schema; ai sửa skill phải đọc.
3. **`workflow-sdlc-review-mr.js`** (nằm ngoài target) — engine MR/PR review.
4. **`workflow-sdlc-review-code.js`** (nằm ngoài target) — engine code review, tiêu thụ `scoutReports` từ `sdlc-scout`.

## Modules và Trách Nhiệm

| Module | Trách nhiệm | Vị trí |
|---|---|---|
| Args parsing | Parse flags `--mr/--pr/--code`, dimension flags, adversarial; detect conflict | SKILL.md Phase 1 |
| Menu routing | 3 câu hỏi interactive (mode, scope, verification) | SKILL.md Phase 1b |
| Workspace discovery | Tìm repo (git, submodule, projects/) | SKILL.md Phase 2 |
| Platform + CLI gate | Detect GitHub/GitLab, verify gh/glab cài + login | SKILL.md Phase 3 |
| Fetch MR content | `gh pr diff` / `glab mr diff` + metadata | SKILL.md Phase 4 |
| Dispatch workflow | Code mode gọi `sdlc-scout` trước, truyền `scoutReports`; guard `ls` | SKILL.md Phase 5 |
| Post comments | AskUserQuestion: post all / critical only / skip | SKILL.md Phase 6 |
| Workflow pipeline | 4 phase nội bộ: Review (7 dim song song) → Verify (adversarial) → Synthesize → Report | 2 workflow scripts |

## Entry Points

- `/sdlc-review` — interactive (menu 3 câu)
- `/sdlc-review --mr <id|url>` / `--pr <id|url>` — review MR/PR
- `/sdlc-review --code <path>` — review source code (gọi sdlc-scout trước)
- Flags: `--full`, `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`, `--tests`, `--adversarial`
- Workflow script trực tiếp: `Workflow({ scriptPath: ... })` với `resumeFromRunId`

## Dependencies

**Internal:**
- `sdlc-scout` skill — Phase 5a gọi trước khi dispatch code workflow; output `scoutReports` truyền vào codeArgs
- `workflow-sdlc-review-mr.js`, `workflow-sdlc-review-code.js` — deterministic pipeline
- `references/workflow-handoff.md` — contract schema
- Tools: `Workflow`, `AskUserQuestion`, `Agent`

**External:**
- `gh` CLI (GitHub, --pr mode), `glab` CLI (GitLab, --mr mode), `git`

## Architectural Patterns

1. **Workflow-driven separation** — skill lo interactive, workflow lo deterministic (token-efficient, resumable).
2. **Parallel 7 dimensions** với inline prompts (không external agent definition).
3. **Adversarial quorum** — 3 skeptics, 2/3 confirm, mặc định refute.
4. **Severity-wins verdict** — bất kỳ URGENT/CRITICAL/BLOCKER → overall URGENT.
5. **Mode conflict detection** — ≥2 mode flags → fallback menu.
6. **CLI gate stop-and-retry** — thiếu gh/glab → hướng dẫn cài + dừng.
7. **Resumable** — `resumeFromRunId` khi subagent fail.

## Câu Hỏi Chưa Giải Quyết

- Không có. Target nhỏ, cấu trúc rõ ràng.

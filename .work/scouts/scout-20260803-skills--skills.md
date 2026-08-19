# Scout Report: skills

**Ngày:** 2026-08-03
**Loại:** skills (Claude Code plugin Agent Skills)
**Đường dẫn:** /home/khuend/projects/AI/Kit/toolkit/.claude/skills
**Focus:** Module map — skills tồn tại, cấu trúc (SKILL.md + references/), technologies & patterns (markdown, YAML frontmatter)

## Tổng quan

Thư mục `.claude/skills/` là kho chứa 27 Agent Skills của Claude Code plugin toolkit. Mỗi skill là một thư mục con có `SKILL.md` (YAML frontmatter + body markdown) làm entry point, tùy chọn kèm `references/` (tài liệu load-on-demand), `scripts/` (code thực thi), và `templates/` (mẫu output). Skills phân thành 4 nhóm chức năng: SDLC pipeline/orchestration (10 skills), reasoning & problem-solving (6), creator/refiner (6), tooling & domain knowledge (5). Kiến trúc nhất quán xuyên suốt: body SKILL.md giữ lộ trình thực thi (<500 dòng), chi tiết được đẩy xuống `references/` theo progressive disclosure, activation được điều khiển qua YAML frontmatter (`description`, `user-invocable`, `disable-model-invocation`, `allowed-tools`).

## Tóm tắt

- Tổng số file: 187 (178 markdown, 4 shell, 3 JavaScript, 1 Ruby, 1 Python bytecode)
- Skills: 27 thư mục (26 có SKILL.md; `chrome-profile` không có SKILL.md — chỉ chứa 1 file `.pyc`)
- Patterns: 11 architectural patterns
- Technologies: 6 (Markdown, YAML, Bash, JavaScript/Node, Ruby, Python)
- Modules: 27
- Entry Points: 27 skill invocations + 8 executable scripts

## Các File Liên Quan

### Mức Độ Cao (26) — file định nghĩa skill (`SKILL.md`)

- `.claude/skills/sdlc-orchestrator/SKILL.md` — SDLC entry point chính, human-in-the-loop, routing task/cr/fixbug (v1.14.2)
- `.claude/skills/sdlc-automation/SKILL.md` — autonomous pipeline, grill-once + dispatch workflow (v1.10.1)
- `.claude/skills/sdlc-cook/SKILL.md` — TDD execution từ ready specs trong worktree isolation (v2.2.0)
- `.claude/skills/sdlc-scout/SKILL.md` — codebase scouting có cấu trúc, report idempotent (v2.2.0)
- `.claude/skills/sdlc-review/SKILL.md` — deep code review 7 chiều, workflow-driven (v1.3.1)
- `.claude/skills/sdlc-quick/SKILL.md` — lane nhẹ cho task đơn giản, GATE-light (v1.0.0)
- `.claude/skills/sdlc-codebase/SKILL.md` — reverse engineer specs từ codebase (v1.4.0)
- `.claude/skills/sdlc-preflight/SKILL.md` — đảm bảo foundation files tồn tại (v1.0.2)
- `.claude/skills/sdlc-monitor/SKILL.md` — phân tích telemetry traces từ `.logs/` (v1.0.0)
- `.claude/skills/sprint/SKILL.md` — thin router tới sdlc-sprint-* subagents (v1.0.0)
- `.claude/skills/fable-thinking/SKILL.md` — reasoning protocol, The Floor + Claim Discipline (v1.4.0 trong metadata)
- `.claude/skills/problem-solving/SKILL.md` — dispatcher tới 6 sub-skills references/ (không version)
- `.claude/skills/sequential-thinking/SKILL.md` — step-by-step analysis, revision markers (không version)
- `.claude/skills/debugging/SKILL.md` — systematic debugging, root-cause-first (không version)
- `.claude/skills/grilling/SKILL.md` — interview stress-test kế hoạch, 12-dòng tối giản (không version)
- `.claude/skills/ask-user-question/SKILL.md` — dạy dùng AskUserQuestion tool (v1.1.0)
- `.claude/skills/plugin-creator/SKILL.md` — tạo/convert/validate/publish plugin (v1.7.0)
- `.claude/skills/skill-composer/SKILL.md` — tạo skill mới từ scratch (v2.8.0)
- `.claude/skills/skill-refiner/SKILL.md` — refine/validate skill hiện có (v1.4.0)
- `.claude/skills/skill-tester/SKILL.md` — test/benchmark skill, evals pipeline (v1.1.0)
- `.claude/skills/subagent-creator/SKILL.md` — tạo/validate/refine subagent (v1.4.0)
- `.claude/skills/hook-creator/SKILL.md` — tạo/validate/refine plugin hooks (v2.4.1)
- `.claude/skills/git/SKILL.md` — git ops + conventional commits, secret scan (không version)
- `.claude/skills/spring-boot-4/SKILL.md` — Spring Boot 4.x conventions 3-tier risk model (v1.1.0)
- `.claude/skills/workflow-knowledge/SKILL.md` — dạy Workflow tool API, orchestration patterns (v1.3.1)
- `.claude/skills/human-docs/SKILL.md` — sync agent_docs/ → docs/ cho human-readable (v2.5.0)

### Mức Độ Trung Bình (146) — `references/` (load-on-demand context)

References/ là pattern chiếm ưu thế — 20/27 skills dùng. Số lượng file references theo skill:

| Skill | refs | Skill | refs |
|-------|------|-------|------|
| plugin-creator | 21 | skill-composer | 13 |
| hook-creator | 11 | skill-refiner | 11 |
| subagent-creator | 10 | debugging | 10 |
| git | 9 | spring-boot-4 | 8 |
| sdlc-scout | 7 | problem-solving* | 6 |
| sequential-thinking | 6 | ask-user-question | 5 |
| sdlc-automation | 4 | sdlc-cook | 4 |
| sdlc-orchestrator | 4 | fable-thinking | 3 |
| sdlc-preflight | 3 | sdlc-quick | 3 |
| workflow-knowledge | 3 | sdlc-codebase | 2 |
| skill-tester | 2 | sdlc-review | 1 |

\* `problem-solving/references/` chứa 6 sub-skill directory, mỗi cái có SKILL.md riêng (collision-zone-thinking, inversion-exercise, meta-pattern-recognition, scale-game, simplification-cascades, when-stuck).

Nhóm nội dung references điển hình: workflow detail (`flow-task.md`, `flow-cr.md`, `refinement-workflow.md`), grilling/templates (`grilling-project-overview.md`, `triage-grill.md`), conventions/domain (`spring-data-conventions.md`, `commit-standards.md`), patterns (`advanced-patterns.md`, `delegation-patterns.md`), validation (`validation-checklist.md`, `validation-workflow.md`).

### Mức Độ Thấp (12) — scripts, templates, file phụ trợ

- `.claude/skills/plugin-creator/scripts/scan-plugin.sh` — bash scanner, output JSON
- `.claude/skills/sdlc-cook/scripts/detect-project.sh` — detect project type
- `.claude/skills/sdlc-cook/scripts/test-project-detection.sh` — test harness
- `.claude/skills/debugging/scripts/find-polluter.sh` — bisect test pollution
- `.claude/skills/debugging/scripts/find-polluter.test.md` — test spec
- `.claude/skills/sdlc-monitor/scripts/analyze-traces.js` — Node.js, aggregate `.jsonl` traces
- `.claude/skills/sequential-thinking/scripts/process-thought.js` — Node.js thought processor
- `.claude/skills/sequential-thinking/scripts/format-thought.js` — Node.js thought formatter
- `.claude/skills/skill-tester/scripts/aggregate_benchmark.rb` — Ruby, evals aggregator
- `.claude/skills/human-docs/templates/SRS-TEMPLATE.md` — Mustache-style output template
- `.claude/skills/human-docs/templates/system-architecture-TEMPLATE.md` — Mustache-style output template
- `.claude/skills/human-docs/templates/architecture-README-TEMPLATE.md` — Mustache-style routing template
- `.claude/skills/problem-solving/ABOUT.md` — tài liệu bổ sung (thuộc nhóm trung bình)
- `.claude/skills/sequential-thinking/README.md` — tài liệu bổ sung (thuộc nhóm trung bình)
- `.claude/skills/chrome-profile/scripts/__pycache__/chrome_profile_cli.cpython-314.pyc` — binary compiled, không đọc được

## Công Nghệ Sử Dụng

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Documentation | Markdown | — | 178 file: SKILL.md body, references, templates |
| Metadata | YAML frontmatter | — | Activation & metadata: name, description, version, user-invocable, allowed-tools, model, keywords, when_to_use |
| Scripting | Bash | — | 4 shell scripts: scan-plugin, detect-project, find-polluter, test harness |
| Scripting | JavaScript (Node.js) | — | 3 scripts: analyze-traces, process-thought, format-thought |
| Scripting | Ruby | — | 1 script: aggregate_benchmark.rb |
| Scripting | Python (bytecode) | 3.14 | 1 compiled CLI: chrome_profile_cli |
| Templates | Mustache-style | — | `{{placeholder}}` trong human-docs templates |

## Cấu Trúc Thư Mục

```
.claude/skills/
├── sdlc-automation/      - SDLC pipeline autonomous (grill once, dispatch workflow)
├── sdlc-codebase/        - Reverse engineer specs từ codebase
├── sdlc-cook/            - TDD execution từ ready specs (worktree isolation)
├── sdlc-monitor/         - Telemetry trace analysis
├── sdlc-orchestrator/    - SDLC entry point human-in-the-loop (task/cr/fixbug)
├── sdlc-preflight/       - Foundation files check + grilling
├── sdlc-quick/           - Lane nhẹ cho task đơn giản
├── sdlc-review/          - Deep code review 7 chiều
├── sdlc-scout/           - Codebase scouting structured report
├── sprint/               - Thin router tới sprint subagents
├── fable-thinking/       - Reasoning protocol (The Floor, Claim Discipline)
├── problem-solving/      - Dispatcher tới 6 sub-skills
├── sequential-thinking/  - Step-by-step analysis
├── debugging/            - Systematic debugging
├── grilling/             - Interview stress-test
├── ask-user-question/    - Dạy AskUserQuestion tool
├── plugin-creator/       - Plugin lifecycle (create/convert/validate/publish)
├── skill-composer/       - Tạo skill mới
├── skill-refiner/        - Refine skill hiện có
├── skill-tester/         - Test/benchmark skill (evals)
├── subagent-creator/     - Tạo/validate subagent
├── hook-creator/         - Tạo/validate plugin hooks
├── git/                  - Git ops + conventional commits
├── spring-boot-4/        - Spring Boot 4.x conventions
├── workflow-knowledge/   - Workflow tool API knowledge
├── human-docs/           - Sync agent_docs → docs
└── chrome-profile/       - Mở URL trong Chrome profile (không SKILL.md)
```

## Modules và Trách Nhiệm

### Nhóm 1 — SDLC Pipeline & Orchestration (10)

- **sdlc-orchestrator** — entry point SDLC chính, human-in-the-loop mọi phase gate (depends on: sdlc-preflight, advisor subagent)
  - Public API: flow=task | cr | fixbug; keyword-first-match routing
- **sdlc-automation** — pipeline autonomous: interview một lần, dispatch workflow (depends on: sdlc-gate, advisor subagent)
  - Public API: `--mode`, grilling-templates; dispatch `.claude/workflows/sdlc-automation.js`
- **sdlc-cook** — TDD cycle RED→GREEN→REFACTOR→GATE cho một feature từ specs sẵn (depends on: sdlc-tdd-* agents, merge manager)
  - Public API: `FEAT-{NNN}`; scripts/detect-project.sh
- **sdlc-scout** — scout structured, spawn Explore agents / pipeline workflow (depends on: repomix optional, Explore agents)
  - Public API: `--focus --patterns --mode review|explore|self-test`; reports[] schema
- **sdlc-review** — review 7 chiều parallel + adversarial (depends on: workflow scripts)
  - Public API: `--mr | --pr | --code`, `--adversarial`, dimension flags
- **sdlc-quick** — lane nhẹ: trivial gate, triage grill, GATE-light (depends on: sdlc-tdd-*, sdlc-review)
  - Public API: triage → implement → GATE-light
- **sdlc-codebase** — reverse pipeline code→specs (depends on: sdlc-scout, codebase-* agents)
  - Public API: `--focus --scope --artifacts --dry-run`
- **sdlc-preflight** — foundation files (project-overview, user-context, conventions) (depends on: grilling templates)
  - Public API: `--project-overview --user-context --conventions`; user-invocable: false
- **sdlc-monitor** — đọc `.logs/`, analyze-traces.js, report (depends on: scripts/analyze-traces.js)
  - Public API: `--days --output --session`; read-only skill
- **sprint** — thin router tới sdlc-sprint-board/backlog/roadmap (depends on: sdlc-sprint-* agents)
  - Public API: `--board --backlog --roadmap --all --init`; user-invocable: false

### Nhóm 2 — Reasoning & Problem-Solving (6)

- **fable-thinking** — reasoning protocol: The Floor, Claim Discipline, Five Moves, Self-Review Gate (depends on: references/design-taste.md, content-taste.md, worked-examples.md)
  - Public API: argument-hint mô tả task cần reasoning
- **problem-solving** — dispatcher tới 6 techniques (collision-zone, inversion, meta-pattern, scale-game, simplification-cascades, when-stuck)
  - Public API: routing table "How You're Stuck" → technique; model: sonnet
- **sequential-thinking** — multi-step analysis với revision/branch/hypothesis markers (depends on: process-thought.js, format-thought.js)
  - Public API: markers expand/contract/revise/branch
- **debugging** — systematic debugging root-cause-first, 9+ techniques (depends on: 10 references, find-polluter.sh)
  - Public API: technique → reference file mapping
- **grilling** — interview stress-test, hỏi từng câu một (minimal, 12 dòng)
- **ask-user-question** — dạy AskUserQuestion mechanics, constraints, wiring (depends on: 5 references)
  - Public API: allowed-tools: Read, AskUserQuestion

### Nhóm 3 — Creator/Refiner Skills (6)

- **plugin-creator** — plugin lifecycle; delegate component work (depends on: hook-creator, subagent-creator, skill-composer; scan-plugin.sh)
  - Public API: AskUserQuestion routing create/convert/validate/publish
- **skill-composer** — tạo skill mới, self-containment + 80% rule (depends on: 13 references)
  - Public API: two-phase AskUserQuestion (action + scope)
- **skill-refiner** — refine/validate skill, movement-pattern body→references (depends on: 11 references)
  - Public API: batch interviews, refinement/validation workflows
- **skill-tester** — evals pipeline 7-phase, with_skill vs baseline (depends on: aggregate_benchmark.rb, `./evals/` dir)
  - Public API: Quick Workflow | Full Pipeline
- **subagent-creator** — tạo/validate/refine subagent (depends on: 10 references)
  - Public API: create/validate/refine routing
- **hook-creator** — plugin hooks, event matching, decision schemas (depends on: 11 references)
  - Public API: create/validate/refine routing; user-invocable: false

### Nhóm 4 — Tooling & Domain Knowledge (5)

- **git** — git ops conventional commits, secret scan (depends on: git-manager subagent, 9 references, gh/glab CLIs)
  - Public API: `cm | cp | pr | merge`
- **spring-boot-4** — Spring Boot 4.x conventions, 3-tier risk model (depends on: 8 references)
  - Public API: route-to-reference table; user-invocable: false
- **workflow-knowledge** — Workflow tool API, orchestration patterns (depends on: 3 references)
  - Public API: agent()/parallel()/pipeline()/phase(); user-invocable: false
- **human-docs** — sync agent_docs→docs, agent-as-SSOT (depends on: 3 Mustache templates, workflow scripts)
  - Public API: `sync:srs | sync:architecture | sync:all | review`
- **chrome-profile** — mở URL trong Chrome profile qua CDP (không SKILL.md; chỉ .pyc compiled)
  - Deviant: cấu trúc không chuẩn, không đọc được

## Entry Points

| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| sdlc-orchestrator | Skill (Skill()/auto) | `.claude/skills/sdlc-orchestrator/SKILL.md` | task/cr/fixbug flows |
| sdlc-automation | Skill | `.claude/skills/sdlc-automation/SKILL.md` | autonomous pipeline |
| sdlc-cook | Skill | `.claude/skills/sdlc-cook/SKILL.md` | TDD execution |
| sdlc-quick | Skill | `.claude/skills/sdlc-quick/SKILL.md` | lightweight lane |
| sdlc-review | Skill | `.claude/skills/sdlc-review/SKILL.md` | deep review |
| sdlc-scout | Skill | `.claude/skills/sdlc-scout/SKILL.md` | codebase scouting |
| sdlc-codebase | Skill | `.claude/skills/sdlc-codebase/SKILL.md` | reverse engineering |
| sdlc-preflight | Skill (auto, user-invocable:false) | `.claude/skills/sdlc-preflight/SKILL.md` | foundation check |
| sdlc-monitor | Skill (read-only) | `.claude/skills/sdlc-monitor/SKILL.md` | trace analysis |
| sprint | Skill (user-invocable:false) | `.claude/skills/sprint/SKILL.md` | sprint artifact router |
| fable-thinking | Skill | `.claude/skills/fable-thinking/SKILL.md` | reasoning protocol |
| problem-solving | Skill | `.claude/skills/problem-solving/SKILL.md` | stuck techniques |
| sequential-thinking | Skill | `.claude/skills/sequential-thinking/SKILL.md` | step-by-step analysis |
| debugging | Skill | `.claude/skills/debugging/SKILL.md` | debugging |
| grilling | Skill | `.claude/skills/grilling/SKILL.md` | plan stress-test |
| ask-user-question | Skill | `.claude/skills/ask-user-question/SKILL.md` | AskUserQuestion patterns |
| plugin-creator | Skill | `.claude/skills/plugin-creator/SKILL.md` | plugin lifecycle |
| skill-composer | Skill | `.claude/skills/skill-composer/SKILL.md` | create skill |
| skill-refiner | Skill | `.claude/skills/skill-refiner/SKILL.md` | refine skill |
| skill-tester | Skill | `.claude/skills/skill-tester/SKILL.md` | test skill |
| subagent-creator | Skill | `.claude/skills/subagent-creator/SKILL.md` | subagent lifecycle |
| hook-creator | Skill | `.claude/skills/hook-creator/SKILL.md` | hook lifecycle |
| git | Skill | `.claude/skills/git/SKILL.md` | git ops |
| spring-boot-4 | Skill (auto) | `.claude/skills/spring-boot-4/SKILL.md` | Spring Boot 4 knowledge |
| workflow-knowledge | Skill (auto) | `.claude/skills/workflow-knowledge/SKILL.md` | workflow API knowledge |
| human-docs | Skill | `.claude/skills/human-docs/SKILL.md` | docs sync |
| chrome-profile | Script (compiled) | `.claude/skills/chrome-profile/scripts/__pycache__/chrome_profile_cli.cpython-314.pyc` | CDP profile opener |
| scan-plugin.sh | Bash script | `.claude/skills/plugin-creator/scripts/scan-plugin.sh` | plugin structure scanner |
| detect-project.sh | Bash script | `.claude/skills/sdlc-cook/scripts/detect-project.sh` | project type detection |
| find-polluter.sh | Bash script | `.claude/skills/debugging/scripts/find-polluter.sh` | test pollution bisect |
| analyze-traces.js | Node script | `.claude/skills/sdlc-monitor/scripts/analyze-traces.js` | trace aggregation |
| process-thought.js | Node script | `.claude/skills/sequential-thinking/scripts/process-thought.js` | thought processing |
| format-thought.js | Node script | `.claude/skills/sequential-thinking/scripts/format-thought.js` | thought formatting |
| aggregate_benchmark.rb | Ruby script | `.claude/skills/skill-tester/scripts/aggregate_benchmark.rb` | eval aggregation |

## Dependencies

### Internal

| Module | Depends On | Relationship |
|--------|-----------|--------------|
| sdlc-orchestrator | sdlc-preflight, advisor subagent, sdlc-gate | orchestration → verify |
| sdlc-automation | sdlc-gate, advisor subagent, workflow script | dispatch → gate |
| sdlc-codebase | sdlc-scout, codebase-* agents | scout → reverse pipeline |
| sdlc-cook | sdlc-tdd-* agents, detect-project.sh | TDD orchestration |
| sdlc-review | workflow scripts, 7 dimension agents | dispatch → analyze |
| sdlc-scout | Explore agents, repomix (optional) | discovery → scout |
| sdlc-quick | sdlc-tdd-*, sdlc-review | implement → verify |
| sprint | sdlc-sprint-board/backlog/roadmap | router → specialist |
| plugin-creator | skill-composer, subagent-creator, hook-creator | delegator → specialist |
| sdlc-preflight | grilling templates (references) | interview → create |

### External

| Package / Tool | Version | Purpose |
|----------------|---------|---------|
| Claude Code Skill tool | — | Skill() invocation & `/` commands |
| AskUserQuestion tool | — | Interactive routing/interview (creator skills, git, sdlc) |
| Workflow tool | — | Multi-agent pipeline scripts (automation, review, codebase, human-docs, scout) |
| Agent tool (subagents) | — | Explore, advisor, git-manager, sdlc-tdd-*, sdlc-sprint-* |
| repomix | — | Snapshot codebase (scout pipeline, large projects) |
| gh (GitHub CLI) | — | PR/issue/release ops (git skill reference) |
| glab (GitLab CLI) | — | MR/CI ops (git skill reference) |
| Ruby | — | aggregate_benchmark.rb (skill-tester) |
| Node.js | — | analyze-traces.js, thought scripts |
| Chrome DevTools Protocol | — | chrome-profile CDP port 9222 |

## Architectural Patterns

- **Progressive Disclosure** — body SKILL.md <500 dòng, chi tiết đẩy xuống `references/` load-on-demand (evidence: skill-composer, sdlc-scout, plugin-creator; pattern được dạy tường minh trong `.claude/skills/skill-composer/SKILL.md` body)
- **YAML Frontmatter Activation** — `description` (trigger), `user-invocable` (true/false), `disable-model-invocation`, `allowed-tools`, `model`, `keywords` điều khiển discovery & invocation (evidence: mọi SKILL.md frontmatter)
- **Skill-as-Router** — skill giữ logic điều phối, spawn specialist/subagent hoặc workflow (evidence: sprint → sdlc-sprint-*, plugin-creator → creator skills, sdlc-review → workflow scripts)
- **Workflow-Driven Dispatch** — heavy lifting trong `.claude/workflows/*.js`, SKILL.md chỉ phối hợp (evidence: sdlc-automation, sdlc-codebase, sdlc-review, human-docs)
- **Interview-Based Routing** — AskUserQuestion với predefined options để chọn workflow (evidence: plugin-creator, skill-composer, subagent-creator, hook-creator, git)
- **Routing-Table Lookup** — bảng map task → reference file để giảm token (evidence: spring-boot-4, git, problem-solving, debugging)
- **Hard Boundaries Section** — non-negotiable constraints đặt sớm trong body (evidence: sdlc-orchestrator, sdlc-automation, sdlc-preflight, sdlc-quick)
- **Advisor Subagent** — spawn read-only advisor trước quyết định quan trọng (evidence: sdlc-orchestrator, sdlc-automation grilling-exit/fail-safe)
- **Nested Sub-Skills** — sub-skill riêng trong `references/` (evidence: problem-solving/references/*/SKILL.md — 6 techniques)
- **Mustache Templates** — placeholder-based output generation (evidence: human-docs/templates/*-TEMPLATE.md)
- **Comparision/Differential Tables** — so sánh entry points trong body (evidence: sdlc-orchestrator, sdlc-automation, sdlc-quick)

## Câu Hỏi Chưa Giải Quyết

- `chrome-profile` không có SKILL.md — chỉ có file `.pyc` compiled (Python 3.14). Không thể đọc nội dung; purpose/spec chỉ được suy ra từ docstring của binary và tên file. Trạng thái này có chủ đích hay là lỗi packaging?
- 6/27 skills không khai báo `version` trong frontmatter (debugging, git, grilling, problem-solving, sequential-thinking). fable-thinking đặt version trong `metadata.version` thay vì top-level `version`. Không nhất quán version schema giữa các skills.
- `fable-thinking` có 3 references (design-taste.md, content-taste.md, worked-examples.md) — CLAUDE.md còn nhắc `.claude/references/fable-thinking/protocol.md` nhưng file đó nằm ở `.claude/references/` (ngoài scope `.claude/skills/`), không trong skill directory. Cross-referencing giữa rules và skill references cần verify.
- `sdlc-cook` có 2 bash scripts nhưng không thấy test cho `detect-project.sh` ở cấp references (chỉ `test-project-detection.sh` tự test); coverage test scripts không đầy đủ khắp 27 skills.
- `sdlc-review` có references/1 file (workflow-handoff) dù SKILL.md body 388 dòng — phần lớn logic nằm trong workflow scripts, không phải references.

---

*Report generated by sdlc-scout*

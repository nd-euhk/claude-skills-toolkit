---
name: sdlc-scout
description: >-
  General-purpose SDLC codebase scouting with project discovery, structured
  output, parallel Explore agent execution, caching, audit, and quality gates.
  Handles all scouting needs from quick single-directory searches to large
  multi-project codebase exploration. Use when any SDLC flow needs structured
  codebase understanding — review, explore, fixbug, task, cr, contract,
  compliance, phase execution, brainstorming, or standalone exploration.
  Produces idempotent reports with module maps, entry points, dependencies,
  technologies, and architectural patterns consumable by all downstream SDLC
  skills. Supports --focus, --patterns, --mode (review|explore|self-test).
argument-hint: "<target-path> [--focus <description>] [--patterns <keywords>] [--mode review|explore|self-test]"
version: 2.1.0
user-invocable: true
when_to_use: "Invoke for any codebase scouting need across the SDLC ecosystem — review, explore, fixbug, task, cr, contract, compliance, phase execution, brainstorming, or standalone exploration."
category: sdlc
keywords: [codebase, scouting, file-discovery, sdlc, exploration, project-discovery]
allowed-tools: Read, Write, Bash(git:*,find:*,ls:*,mkdir:*,wc:*), Grep, Agent, Workflow, Skill, AskUserQuestion, TaskCreate, TaskUpdate, TaskList
---
# SDLC Scout

Skill scout toàn diện cho toàn bộ hệ sinh thái SDLC. Tự động phát hiện sub-project, quyết định chiến lược dựa trên quy mô codebase, spawn Explore agent song song để khám phá hoặc dùng `workflow-sdlc-scout-pipeline` cho codebase lớn, thêm caching và audit chéo giữa các project. Sinh báo cáo có cấu trúc tiêu thụ được bởi mọi skill SDLC hạ nguồn.

**Khả năng:** Phát hiện project (git submodules, monorepo, nested repos), output schema có cấu trúc, tích hợp repomix cho codebase lớn, caching idempotent, audit tính đầy đủ, và các phần báo cáo chuyên biệt cho SDLC (modules, entry points, dependencies, technologies, architectural patterns). Dùng cho cả tìm kiếm nhanh lẫn khám phá chiến lược toàn diện.

## Khi Nào Sử Dụng

**Được gọi bởi skill SDLC khác:**
- `sdlc-review --code` — khám phá codebase trước khi review 7 chiều
- `sdlc-explore` — phát hiện sub-project + scout trước SDLC pipeline
- `sdlc-fixbug` — scout khu vực liên quan đến bug
- `sdlc-flow-task` — scout trước khi triển khai tính năng mới
- `sdlc-flow-cr` — scout trước khi xử lý change request
- `sdlc-flow-contract` — scout các service bị ảnh hưởng bởi contract change
- `sdlc-flow-compliance` — scout codebase để phát hiện vi phạm chuẩn
- `sdlc-phase-manual` / `sdlc-phase-auto` — scout trước khi vào bất kỳ pha SDLC nào
- Brainstorming session — cần context codebase trước khi thảo luận

**Dùng độc lập:**
- Tìm file nhanh trong một hoặc nhiều thư mục
- Khám phá cấu trúc codebase, module map, entry points
- Phân tích pattern kiến trúc và dependency graph
- Định vị code trước khi bắt đầu bất kỳ tác vụ SDLC nào

**Không dùng cho:**
- Review MR/PR diff → dùng `sdlc-review --mr` (không cần scout)

## Khởi Động Nhanh

```bash
# Từ skill SDLC bất kỳ — gọi qua Skill()
Skill(sdlc-scout, "src/auth/ --focus 'Authentication module' --patterns 'JWT,OAuth,token' --mode review")
Skill(sdlc-scout, ". --mode explore")

# Độc lập — tìm nhanh theo chủ đề
/sdlc-scout src/api/ --focus "REST API handlers" --patterns "route,controller,middleware"

# Độc lập — khám phá toàn bộ codebase
/sdlc-scout . --mode explore

# Trước khi fixbug — scout khu vực nghi ngờ
/sdlc-scout src/payment/ --focus "Payment processing flow" --patterns "transaction,refund,webhook"

# Trước khi implement tính năng mới — scout khu vực sẽ bị ảnh hưởng
/sdlc-scout src/users/ src/notifications/ --focus "User notification system"

# Self-test — kiểm tra chất lượng scout
/sdlc-scout . --mode self-test
```

## Cách Skill SDLC Khác Tích Hợp

Mọi skill SDLC có thể gọi `sdlc-scout` để lấy structured report thay vì tự khám phá codebase:

```
// Pattern chung: skill SDLC gọi sdlc-scout, nhận reports[], dùng reports thay vì tự explore
const scoutResult = await Skill(sdlc-scout, "{path} --mode {review|explore} --focus '{mô tả}'")
// scoutResult.reports[].outputPath → path tới file report markdown
// scoutResult.reports[].filesFound → tổng quan nhanh
// scoutResult.reports[].modulesFound → danh sách module
// Downstream agents đọc report thay vì tự Grep/Glob/Read toàn bộ codebase
```

Xem `references/integration-guide.md` để biết ví dụ cụ thể cho từng skill (sdlc-review, sdlc-explore, sdlc-fixbug, sdlc-flow-task, sdlc-flow-cr) kèm diff chi tiết và checklist verify.

## Quy Trình Chính

### Giai Đoạn 1: Phát Hiện Sub-Project

Mục tiêu: tìm tất cả sub-project trong đường dẫn đích. Đây là **thao tác cấp skill** (chỉ Bash, không cần agent context).

**Bước 1.1: Phát Hiện Project Toàn Diện**

Phát hiện đồng thời tất cả pattern sub-project:

- **Pattern 1 — Git Submodules**: `git submodule status`. Ghi nhận: name, path, commit, branch. Loại khỏi Patterns 2-3.
- **Pattern 2 — Git Repo Lồng Nhau**: `find {targetPath} -name ".git" -type d`. Kiểm tra `git check-ignore` cho mỗi repo. Ghi nhận: name, path, remote.
- **Pattern 3 — Thư Mục Monorepo**: Tìm `packages/*/`, `apps/*/`, `services/*/`, `modules/*/` có build file (`package.json`, `Cargo.toml`, `go.mod`, `pom.xml`). Bỏ qua thư mục từ Patterns 1-2.
- **Pattern 4 — Project Đơn (Fallback)**: Nếu không có pattern nào khớp → một sub-project = chính đường dẫn đích.

**Bước 1.2: Phân Loại**

Đếm tổng số file trong mỗi sub-project đã phát hiện:
```bash
find {path} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/dist/*' -not -path '*/build/*' | wc -l
```

Phân loại từng project:
- **Nhỏ** (<50 file) → 1 Explore agent, không cần repomix
- **Vừa** (50-200 file) → 2-4 Explore agent, repomix tùy chọn
- **Lớn** (>200 file) → repomix snapshot + scout pipeline workflow

**Bước 1.3: Kéo Mã Nguồn Mới Nhất** (chỉ explore mode, bỏ qua trong review mode)

```bash
git submodule foreach 'git pull'  # nếu có submodules
git pull                          # root repo
```

### Giai Đoạn 2: Quyết Định Chiến Lược

Phân tuyến dựa trên mode và quy mô:

| Mode | Quy Mô | Chiến Lược |
|------|--------|------------|
| `review` | Nhỏ (<50 file) | Explore agent trực tiếp — 1 agent |
| `review` | Vừa (50-200 file) | Explore agent trực tiếp — 2-4 agent |
| `review` | Lớn (200+ file) | `workflow-sdlc-scout-pipeline` với repomix |
| `explore` | Mọi quy mô | `workflow-sdlc-scout-pipeline` với repomix (đầy đủ) |

**Nguyên tắc:** `mode=explore` hoặc bất kỳ sub-project nào >200 file → pipeline. Còn lại → direct.

**Quyết định repomix** (chỉ khi dùng pipeline):
- Nếu repomix có sẵn → đóng gói mỗi sub-project: `Skill(repomix, "{path} --style xml --remove-comments -o .work/repomix/{name}--{slug}.xml")`
- Nếu repomix chưa cài → AskUserQuestion: "Repomix chưa được cài. Cài để tăng tốc?" (header: "Repomix")
  - Tùy chọn: "Cài repomix" | "Tiếp tục không repomix"

### Giai Đoạn 3: Thực Thi Scout

#### Chiến Lược A: Explore Agent Trực Tiếp (review mode, ≤200 file)

**Bước 3A.1: Ước lượng quy mô và chia thư mục**

Dùng `find` và `wc -l` để đếm file trong từng thư mục con. Chia codebase thành các phạm vi logic không chồng lấn. Xem `references/scout-execution.md` để biết chiến lược chia thư mục chi tiết.

Số lượng agent:
- Nhỏ (<50 file): 1-2 agent
- Vừa (50-200 file): 2-4 agent

**Bước 3A.2: Đăng ký tác vụ (nếu ≥3 agent)**

```
TaskList() → nếu trống → TaskCreate cho mỗi agent với metadata scope
→ TaskUpdate từng agent sang in_progress trước khi spawn
```

Xem `references/task-management.md` để biết schema metadata và vòng đời agent.

**Bước 3A.3: Spawn Explore agent song song**

Spawn tất cả Explore agent trong một lần gọi `Agent` duy nhất. Mỗi agent nhận prompt template từ `references/scout-execution.md`:

```
Agent 1: subagent_type="Explore" — Scout {thư-mục-1} tìm file liên quan đến {focus}
Agent 2: subagent_type="Explore" — Scout {thư-mục-2} tìm file liên quan đến {focus}
...
```

Mỗi agent tìm kiếm trong phạm vi được chỉ định, liệt kê file với mô tả ngắn, timeout 3 phút.

**Bước 3A.4: Tổng hợp kết quả**

1. Loại bỏ trùng lặp đường dẫn file
2. Hợp nhất mô tả từ nhiều agent
3. Ghi chú agent timeout / khoảng trống
4. Viết report vào `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`

**Bước 3A.5: Bổ sung SDLC**

Sau khi có report cơ bản, dùng 1 Explore agent để đọc report và source code, bổ sung các phần SDLC:
- Modules và Trách Nhiệm (responsibility, dependencies, public API)
- Bảng Entry Points (HTTP Handler, CLI Command, Event Handler...)
- Dependency Mapping (internal + external)
- Architectural Patterns (kèm evidence: file:line)

Xem `references/sdlc-enhancement.md` để biết prompt template và quy trình chi tiết.

**Timeout handling:** Mỗi agent có timeout 3 phút. Bỏ qua agent không phản hồi. Không khởi động lại. Ghi chú agent timeout trong phần "Câu Hỏi Chưa Giải Quyết".

#### Chiến Lược B: Scout Pipeline Workflow (explore mode hoặc >200 file)

Chuẩn bị args cho mỗi sub-project:
```js
const subProjects = discoveredProjects.map(p => ({
  name: p.name,
  paths: [p.path],
  projectType: p.type,              // node | python | go | rust | ...
  outputPath: `.work/scouts/scout-YYYYMMDD-${p.name}--${slug}.md`,
  repomixSnapshot: p.repomixFile || null,
  patterns: p.suggestedPatterns || null,
  focus: p.focus || null,
}))

const args = { subProjects, language: 'vi' }
```

**Kiểm tra report đã tồn tại** (caching):
```bash
# Với mỗi sub-project, kiểm tra file output đã có và có nội dung
ls -la {outputPath} 2>/dev/null && wc -l {outputPath}
```

Bỏ qua sub-project có report hợp lệ đã tồn tại (idempotent).

Gọi pipeline:
```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js", args })
```

**Guard**: `ls .claude/workflows/workflow-sdlc-scout-pipeline.js` → nếu thiếu, fallback về Chiến Lược A (Explore agent trực tiếp) kèm cảnh báo.

### Giai Đoạn 4: Audit (chỉ pipeline strategy)

Pipeline workflow đã bao gồm giai đoạn Audit. Với chiến lược trực tiếp, chạy kiểm tra tính đầy đủ nhẹ:

1. Liệt kê tất cả thư mục trong targetPath: `find {targetPath} -type d | head -50`
2. So sánh với file đã scout trong report
3. Đánh dấu thư mục không có file trong report là khoảng trống tiềm năng
4. Thêm phần `## Câu Hỏi Chưa Giải Quyết` nếu tìm thấy khoảng trống

### Giai Đoạn 5: Đầu Ra

**Vị trí report**: `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`

**Các phần trong report**: Tổng quan, Tóm tắt, Các File Liên Quan (theo relevance), Công Nghệ Sử Dụng, Cấu Trúc Thư Mục, Modules và Trách Nhiệm, Entry Points, Dependencies (internal + external), Architectural Patterns, Câu Hỏi Chưa Giải Quyết. Xem `references/report-format.md` để biết template đầy đủ và return data schema.

**Dữ liệu trả về** — object với `reports[]` (mỗi report: name, outputPath, filesFound, highRelevance, patternsObserved, technologiesDetected, modulesFound, entryPointsFound) và `gaps` (missedDirectories, uncoveredTopics, recommendations). Xem `references/report-format.md` để biết schema đầy đủ.

## Nguyên Tắc Chính

- **Tự chủ** — Tự spawn Explore agent trực tiếp, không phụ thuộc vào skill trung gian. Toàn bộ logic scout nằm trong skill này.
- **Dùng chung toàn SDLC** — Skill scout duy nhất cho mọi flow: review, explore, fixbug, task, cr, contract, compliance, phase, brainstorming.
- **Output có cấu trúc** — Report tuân theo schema cố định để mọi skill SDLC hạ nguồn tiêu thụ. Không bao giờ là văn bản tự do.
- **Phân tuyến theo quy mô** — Tự động chọn chiến lược dựa trên số lượng file và mode. Người dùng không cần biết chi tiết triển khai.
- **Idempotent** — Kiểm tra report đã tồn tại trước khi scout. An toàn khi gọi nhiều lần.
- **Tôn trọng .gitignore** — Loại trừ `node_modules/`, `vendor/`, `dist/`, `build/`, `.git/` khi đếm file.
- **Bash để phát hiện, Agent để scout** — Giai đoạn 1 chạy ở cấp skill với Bash (không tốn context). Giai đoạn 3 spawn agent trực tiếp.
- **Có thể tiếp tục** — Pipeline strategy hỗ trợ `Workflow({ resumeFromRunId })`. Chiến lược trực tiếp đọc lại report đã tồn tại.
- **Task management** — Đăng ký TaskCreate/TaskUpdate cho scout agents khi ≥ 3 agent (xem `references/task-management.md`).
- **Chunked reading** — Khi cần đọc file lớn, dùng chunking với công thức `ceil(lines/500)` chunk (xem `references/scout-execution.md`).
- **Timeout cố định** — 3 phút mỗi agent. Bỏ qua agent timeout, không khởi động lại. Tổng hợp kết quả có sẵn.

## Hướng Dẫn Tham Chiếu

- `references/integration-guide.md` — Pattern tích hợp chung cho mọi skill SDLC, diff chi tiết, checklist verify
- `references/report-format.md` — Template đầy đủ cho scout report, return data schema, các trường bắt buộc
- `references/sdlc-enhancement.md` — Prompt template và quy trình bổ sung SDLC-specific sections sau khi scout
- `references/pipeline-handoff.md` — Args schema, result structures, error handling cho workflow-sdlc-scout-pipeline.js
- `references/scout-execution.md` — Prompt template, chiến lược chia thư mục, chunked file reading, xử lý timeout, tổng hợp kết quả
- `references/task-management.md` — TaskCreate/TaskUpdate patterns, metadata schema, vòng đời agent, xử lý lỗi
- `references/quality-gates.md` — 5 quality gates (completeness, coverage, schema, performance, relevance), self-test mode, integration test patterns cho downstream skills

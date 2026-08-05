---
name: sdlc-review
description: >-
  Review merge requests, pull requests, and source code with workflow-driven
  parallel analysis across 7 dimensions: architecture, security, bugs, CLAUDE.md
  conventions, feature impact, operational risk, and test quality. Supports optional
  adversarial verification to reduce false positives. Use when reviewing MR/PR,
  code reviewing, reviewing source code, auditing code quality, checking architecture,
  detecting bugs in code, evaluating security, or running pre-merge review.
  Supports --mr, --pr, --code mode flags and --arch, --security, --bugs, --conventions,
  --impact, --ops, --tests, --full, --adversarial flags.
argument-hint: "[--mr <id>] [--pr <id>] [--code <path>] [--full] [--arch] [--security] [--bugs] [--conventions] [--impact] [--ops] [--tests] [--adversarial] [--focus \"<description>\"]"
version: 1.3.1
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(git:*,gh:*,glab:*,ls:*,find:*,cat:*,which:*,npm:*,apt:*,brew:*)
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
  - Workflow
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - TaskList
---

# SDLC Review (Workflow-Driven)

Deep review mã nguồn trên 7 dimension độc lập, được điều phối qua Workflow tool để đảm bảo khả năng resume và tiết kiệm token. Hỗ trợ hai chế độ review: **MR/PR review** (GitHub/GitLab merge requests) và **Source code review** (khám phá codebase cục bộ). Adversarial verification tùy chọn giúp giảm false positive bằng cách yêu cầu mỗi finding phải vượt qua 3 skeptical review độc lập.

**Khác biệt chính so với `/sdlc-review-mr`:** Skill này hợp nhất MR/PR review và source code review vào một skill duy nhất với lựa chọn chế độ qua flag `--mr`/`--pr`/`--code`. Tất cả subagent prompt được inline vào workflow script (không phụ thuộc file agent bên ngoài).

## When to use this skill

**Sử dụng skill này khi:**
- Review merge request hoặc pull request trên GitHub/GitLab
- Review source code cục bộ về chất lượng, kiến trúc, bảo mật, hoặc bug
- Kiểm tra MR/PR về architectural impact hoặc vi phạm kiến trúc
- Audit mã nguồn tìm lỗ hổng bảo mật
- Phát hiện bug, edge case, hoặc race condition
- Xác minh tuân thủ CLAUDE.md conventions của dự án
- Đánh giá cross-feature impact và interface/implementation consistency
- Đánh giá operational safety (DB migration, performance, deploy risk, rollback)
- Bạn muốn ít false positive hơn (dùng `--adversarial`)
- Bạn muốn review có khả năng resume (workflow pause/resume khi gặp lỗi)

**Các dimension review chính:**
- **Architecture** (URGENT): C4 model impact, ADR compliance, SOLID, coupling, breaking changes
- **Security** (CRITICAL): OWASP Top 10, secret detection, auth/authz, data exposure, dependencies
- **Bugs** (BUG_FOUND): Logic errors, race conditions, edge cases, error handling, type safety
- **Conventions** (VIOLATION): CLAUDE.md compliance, naming, patterns, structure, testing standards
- **Feature Impact** (BLOCKER): Cross-feature impact, interface/impl consistency, shared code consumers, regression risk
- **Operational** (BLOCKER): Database migration safety, performance impact, deployment risk, rollback complexity
- **Test Quality** (URGENT): Cheating patterns, test-to-impl mapping, assertion quality, coverage gaps

**Không khuyến nghị cho:**
- Local uncommitted changes (dùng `sdlc-review --code` hoặc `code-reviewer` agent)
- Code style hoặc formatting review (dùng linter/prettier)
- General architecture consulting (dùng `/architect`)

## Quick Start

```bash
# Full MR review (tất cả 7 dimension)
/sdlc-review --mr --full https://github.com/owner/repo/pull/123

# Full PR review với adversarial verification (ít false positive hơn)
/sdlc-review --pr --full --adversarial https://github.com/owner/repo/pull/123

# Source code review
/sdlc-review --code --full src/auth/

# Source code review với dimension cụ thể + adversarial
/sdlc-review --code --security --bugs --adversarial src/api/

# Single dimension trên MR
/sdlc-review --mr --security gl-456          # GitLab MR #456, chỉ security

# Single dimension trên PR
/sdlc-review --pr --arch gh-789              # GitHub PR #789, chỉ architecture

# Multiple dimensions với adversarial
/sdlc-review --mr --security --bugs --adversarial gh-789

# Interactive (không args) — menu routing + workspace discovery
/sdlc-review
```

## Core Workflow

### Phase 1: Parse Input

Trích xuất từ user args:

**Mode flags** (chính xác MỘT, conflict nếu ≥2):
- `--mr` — Review GitLab merge request
- `--pr` — Review GitHub pull request
- `--code` — Review source code cục bộ (không liên quan MR/PR)

**Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`, `--ops`, `--tests`, `--full`

**Verification flag**: `--adversarial` — bật adversarial verification (mặc định: tắt)

**Identifier** (chỉ MR/PR mode): URL hoặc platform prefix + number (`gh-123`, `gl-456`) hoặc bare number

**Path** (chỉ code mode): Đường dẫn thư mục hoặc file cần review (mặc định: thư mục hiện tại)

```
Thứ tự parse:
1. Trích xuất --mr/--pr/--code → mode
   - Nếu ≥2 trong số này tồn tại → CONFLICT → chuyển sang Phase 1b (Q1 giải quyết mode)
   - Nếu 1 tồn tại → dùng mode đó
   - Nếu 0 tồn tại → chuyển sang Phase 1b (full menu)
2. Trích xuất dimension flags
   - --full → tất cả 7 dimension
   - Không có dimension flag → chuyển sang Phase 1b (menu routing)
3. Trích xuất --adversarial → adversarial=true
4. Trích xuất identifier (MR/PR mode) hoặc path (code mode)
5. Trích xuất --focus "<description>" → focus (tùy chọn, chỉ code mode)
   - Nếu có → dùng giá trị này, bỏ qua auto-derive ở Phase 1c
   - Nếu không có → auto-derive từ dimensions trong Phase 1c
```

**Mode routing:**
- `--mr` hoặc `--pr` mode → tiếp tục Phase 3 (platform check) → Phase 4 (fetch MR) → Phase 5 (dispatch MR workflow)
- `--code` mode → bỏ qua Phase 3-4 → Phase 5 (dispatch code workflow)

### Phase 1b: Menu Routing (tương tác, không flag hoặc conflict)

Sử dụng **`AskUserQuestion` tuần tự** (3 câu hỏi, hỏi từng câu một):

**Q1 — Mode** (header: "Chế độ Review", multiSelect: false):
Câu hỏi này được hỏi khi: không có mode flag, HOẶC ≥2 trong số `--mr`/`--pr`/`--code` conflict.
1. "Review Merge Request / Pull Request" — GitLab MR hoặc GitHub PR
2. "Review Source Code" — Review source code hiện tại trong workspace

**Q2 — Scope** (header: "Phạm vi", multiSelect: false):
1. "Full Review (tất cả 7 dimension)" (Khuyến nghị)
2. "Code Quality: Architecture + Bugs + Conventions + Tests"
3. "Safety & Impact: Security + Feature Impact + Operational"
4. "Specific dimensions" — hiển thị 2 multi-select tiếp theo (chia nhỏ: tối đa 4 options mỗi lần theo giới hạn AskUserQuestion)

**Nếu chọn "Specific dimensions" — hỏi Q2a rồi Q2b tuần tự:**

Q2a (header: "Dimensions (1/2)", multiSelect: true):
1. "Architecture" — C4 model, ADR, SOLID, coupling
2. "Security" — OWASP, secrets, auth, data exposure
3. "Bugs" — Logic errors, race conditions, edge cases
4. "CLAUDE.md Conventions" — naming, patterns, structure

Q2b (header: "Dimensions (2/2)", multiSelect: true):
1. "Feature Impact" — Cross-feature, interface consistency, regression
2. "Operational" — DB migration, performance, deploy risk
3. "Test Quality" — Cheating patterns, coverage, assertions

Kết hợp lựa chọn Q2a + Q2b vào dimensions[].

**Q3 — Verification** (header: "Xác minh", multiSelect: false):
1. "Standard (nhanh hơn)" (Khuyến nghị)
2. "Adversarial (chậm hơn, ít false positive — mỗi finding được 3 skeptic xác minh)"

Ánh xạ lựa chọn menu:

| Q1 Choice | Mode | dimensions[] | adversarial |
|---|---|---|---|
| MR/PR | mr or pr (phát hiện sau) | từ Q2 | từ Q3 |
| Source Code | code | từ Q2 | từ Q3 |

| Q2 Choice | dimensions[] |
|---|---|
| Full Review | `['arch','security','bugs','conventions','impact','ops','tests']` |
| Code Quality | `['arch','bugs','conventions','tests']` |
| Safety & Impact | `['security','impact','ops']` |
| Specific dimensions | tập con do người dùng chọn (từ Q2a+Q2b) |

**Q3 → adversarial**: Standard → `false`, Adversarial → `true`

**Khi người dùng CÓ cung cấp CLI flags:** Bỏ qua menu hoàn toàn. `adversarial` được đặt từ sự hiện diện của flag `--adversarial`.

### Phase 1c: Derive Scout Focus (chỉ code mode)

Sau khi `dimensions[]` được resolve (từ flags hoặc menu), derive `focus` string cho sdlc-scout. Focus giúp scout agent ưu tiên file và pattern liên quan thay vì quét toàn bộ codebase không định hướng.

**Luật ưu tiên:**
1. Nếu user đã truyền `--focus` tường minh ở Phase 1 step 5 → dùng giá trị đó, bỏ qua auto-derive
2. Nếu không có → auto-derive từ `dimensions[]`

**Bảng map dimension → focus string:**

| Dimension | Focus string |
|-----------|-------------|
| `arch` | "architecture patterns, C4 model, ADR compliance, SOLID principles, service boundaries, coupling points, breaking changes, dependency direction, layer violations" |
| `security` | "authentication, authorization, input validation, secrets management, data exposure, OWASP Top 10, dependency vulnerabilities, CSP/CORS, rate limiting, audit logging" |
| `bugs` | "logic errors, race conditions, edge cases, null/undefined handling, error handling gaps, type safety violations, exception handling, resource leaks, off-by-one, concurrency issues" |
| `conventions` | "CLAUDE.md compliance, naming conventions, code organization, project structure, import patterns, testing standards, file naming, directory layout" |
| `impact` | "cross-feature dependencies, interface implementations, shared code consumers, regression risks, API contract changes, data model changes, breaking change surface area" |
| `ops` | "database migrations, performance bottlenecks, N+1 queries, deployment configuration, rollback paths, monitoring, logging, alerting thresholds, connection pooling, timeouts" |
| `tests` | "test quality, test-to-implementation mapping, assertion strength, coverage gaps, mocking patterns, test fixtures, test cheating detection, flaky tests, test isolation" |

**Luật join:**
- 1 dimension → dùng thẳng focus string của dimension đó
- N dimensions → join bằng `"; "` (dấu chấm phẩy + space giữa các focus string)
- `--full` (tất cả 7 dimension) → join tất cả 7

**Ví dụ:**

| Input | dimensions[] | focus (auto-derived) |
|-------|-------------|---------------------|
| `--code --security src/api/` | `['security']` | `"authentication, authorization, input validation, secrets management, ..."` |
| `--code --security --bugs src/api/` | `['security','bugs']` | `"authentication, authorization, ... ; logic errors, race conditions, ..."` |
| `--code --full src/` | tất cả 7 | join tất cả 7 focus strings |
| `--code --security --focus "JWT token handling" src/api/` | `['security']` | `"JWT token handling"` (tường minh, không derive) |

**Kết quả:** `focus` được resolve và truyền vào Phase 5a:

```js
const scoutResult = await Skill(sdlc-scout, `${targetPath} --mode review --focus "${focus || ''}"`)
```

Nếu `focus` vẫn rỗng sau Phase 1c (không có dimension, không có --focus tường minh) → `--focus ""` → sdlc-scout chạy không định hướng (fallback an toàn).

### Phase 2: Workspace Discovery (chỉ MR/PR mode)

Khi không có MR identifier, khám phá các repo có sẵn:

1. **Repo hiện tại**: `git rev-parse --show-toplevel` → nếu là git repo → ứng viên
2. **Submodules**: `git submodule status` → mỗi submodule → ứng viên
3. **Thư mục projects/** (gitignored): kiểm tra các repo bổ sung
4. **Deduplicate**: Loại bỏ trùng lặp giữa submodules và projects/
5. **Hiển thị cho người dùng**:
   - 0 repo → "Không tìm thấy repo. Vui lòng cung cấp MR/PR URL."
   - 1 repo → tự động chọn
   - 2-4 repo → `AskUserQuestion`
   - 5+ repo → bảng đánh số, chờ người dùng nhập số

### Phase 3: Platform Detection & CLI Check (chỉ MR/PR mode)

**Bước 3a: Phát hiện platform**

Phát hiện từ (theo thứ tự ưu tiên):
1. **Flag**: `--mr` → GitLab, `--pr` → GitHub
2. **URL** (nếu được cung cấp): `github.com` → GitHub, `gitlab.com`/`gitlab.*` → GitLab
3. **Prefix** (nếu cung cấp số): `gh-123` → GitHub, `gl-456` → GitLab
4. **Git remote** (fallback): `git remote get-url origin`

**Bước 3b: Xác minh CLI tool đã cài đặt**

Kiểm tra CLI theo platform:

```bash
# GitHub
which gh && gh auth status

# GitLab
which glab && glab auth status
```

**Nếu CLI chưa cài đặt → `AskUserQuestion`:**

```
"gh CLI chưa được cài đặt. Cần cài để review GitHub PR."
Options:
  1. "Cài đặt gh CLI" — cài đặt + hướng dẫn login + DỪNG (người dùng phải chạy lại skill)
  2. "Không cài, hủy review"
```

Hướng dẫn cài đặt theo platform:
- **GitHub**: `gh` — https://cli.github.com/manual/installation
  - Linux: `apt install gh` hoặc `brew install gh`
  - Sau khi cài: `gh auth login`
- **GitLab**: `glab` — https://gitlab.com/gitlab-org/cli
  - Linux: `apt install glab` hoặc `brew install glab`
  - Sau khi cài: `glab auth login`

**Sau khi cài đặt + hướng dẫn login thành công → DỪNG.** Thông báo: "CLI đã sẵn sàng. Vui lòng chạy lại skill để review."

**Nếu CLI đã cài nhưng chưa xác thực:**
```
"gh CLI đã cài nhưng chưa đăng nhập."
Options:
  1. "Đăng nhập ngay" — chạy `gh auth login` + DỪNG
  2. "Hủy review"
```

### Phase 4: Fetch MR Content (chỉ MR/PR mode)

Khi MR mục tiêu đã được xác định:

1. **Fetch open MRs** (nếu không có identifier): `gh pr list` hoặc `glab mr list`
2. **Hiển thị MRs cho người dùng** (nếu nhiều): ≤4 → `AskUserQuestion`, 5+ → bảng đánh số
3. **Fetch diff**: `gh pr diff <id>` hoặc `glab mr diff <id>` → full unified diff
4. **Fetch metadata**: `gh pr view <id> --json title,author,baseRefName,headRefName,files,additions,deletions,url` hoặc `glab mr view <id> --output json`
5. **Phân tích cấu trúc diff**: files changed, LOC, change types (code/config/docs/test/dependency)

### Phase 5: Dispatch Workflow

**Định tuyến đến workflow phù hợp dựa trên mode:**

```js
// Mode: mr hoặc pr → dùng MR workflow
if (mode === 'mr' || mode === 'pr') {
  const mrArgs = {
    diff,           // string — full unified diff
    metadata: { id, title, author, branch, files, loc, url },
    repoPath,       // đường dẫn tuyệt đối đến repo
    platform,       // 'github' | 'gitlab' (từ Phase 3)
    dimensions,     // string[] từ Phase 1/1b
    adversarial,    // boolean từ Phase 1/1b
    runDate,        // $(date +%Y%m%d-%H%M%S)
  }

  // Guard: kiểm tra workflow script tồn tại
  // ls .claude/workflows/review/workflow-sdlc-review-mr.js
  // Nếu thiếu → "Không tìm thấy workflow script. Vui lòng đảm bảo plugin đã được cài đặt đúng cách."

  const result = await Workflow({
    scriptPath: ".claude/workflows/review/workflow-sdlc-review-mr.js",
    args: mrArgs
  })
}

// Mode: code → scout trước qua sdlc-scout, sau đó review workflow
if (mode === 'code') {
  // Phase 5a: Scout qua sdlc-scout (structured output, scale-aware routing)
  // sdlc-scout xử lý project discovery, strategy selection, caching, và audit
  const scoutResult = await Skill(sdlc-scout, `${targetPath} --mode review --focus "${focus || ''}"`)

  const codeArgs = {
    repoPath,       // đường dẫn tuyệt đối đến repo
    targetPath,     // thư mục/file cần review (từ user input hoặc cwd)
    dimensions,     // string[]
    adversarial,    // boolean
    runDate,        // $(date +%Y%m%d-%H%M%S)
    scoutReports: scoutResult?.reports || [],  // structured scout output, được workflow tiêu thụ
  }

  // Guard: ls .claude/workflows/review/workflow-sdlc-review-code.js

  const result = await Workflow({
    scriptPath: ".claude/workflows/review/workflow-sdlc-review-code.js",
    args: codeArgs
  })
}
```

Cả hai workflow đều chạy các phase nội bộ (hiển thị trong `/workflows`):
1. **Review** — 7 subagent song song (với inline prompt)
2. **Verify** — adversarial verification (chỉ khi `adversarial: true`)
3. **Synthesize** — merge, deduplicate, tính toán overall verdict
4. **Report** — tạo markdown report

Để biết đầy đủ args schema, result schema, và error handling patterns, xem `references/workflow-handoff.md`.

### Phase 6: Post Comments (chỉ MR/PR mode)

Sau khi workflow hoàn tất, dùng `AskUserQuestion`:
- **Câu hỏi**: "Post findings lên MR/PR?"
- **Options**:
  1. "Post tất cả findings" — mỗi finding là một comment riêng
  2. "Chỉ post CRITICAL + URGENT + BLOCKER" — chỉ severity cao nhất
  3. "Không post, chỉ lưu report"

Post bằng `gh pr comment <id> --body "<markdown>"` hoặc `glab mr note <id> --message "<markdown>"`. Mỗi finding = một comment.

Định dạng comment:
```markdown
**[{severity}] [{dimension}]** {description}

**Recommendation**: {recommendation}

**File**: `{file_path}:{line}`

🤖 Generated by sdlc-review skill
```

## Error Handling

### Partial subagent failure
Nếu workflow trả về `failedDimensions: ['security']`, report vẫn bao gồm kết quả từ 6 dimension còn lại. Thông báo cho người dùng và đề nghị retry thủ công (các) dimension bị lỗi.

### Workflow unavailable
Nếu `.claude/workflows/review/workflow-sdlc-review-{mr,code}.js` không tồn tại:
```
"Không tìm thấy workflow script. Vui lòng đảm bảo plugin đã được cài đặt đúng cách."
```
Hủy bỏ — không fallback sang chế độ thủ công.

### Workflow complete failure
Nếu workflow trả về `verdict: 'ERROR'`:
- Hiển thị những gì có sẵn (partial findings, failed dimensions)
- Đề nghị retry với `Workflow({ resumeFromRunId })`

### CLI not installed (Phase 3)
Đã được xử lý trong Phase 3b — AskUserQuestion → cài đặt → hướng dẫn login → DỪNG.

## Flag Handling Reference

| Input | mode | dimensions | adversarial | focus | Routing |
|---|---|---|---|---|---|---|
| `--mr`/`--pr <flags> <url\|id>` | mr/pr | từ flags | `--adversarial` flag | N/A (MR/PR không dùng scout) | Platform từ URL/prefix/remote. Nếu không có ID → workspace discovery |
| `--code <flags> <path>` | code | từ flags | `--adversarial` flag | auto-derive từ dimensions (Phase 1c) | targetPath=<path>, bỏ qua Phase 3-4 |
| `--code --focus "<desc>" <flags> <path>` | code | từ flags | `--adversarial` flag | dùng giá trị tường minh, không derive | targetPath=<path>, bỏ qua Phase 3-4 |
| ≥2 trong số `--mr`/`--pr`/`--code` | CONFLICT | — | — | — | Phase 1b Q1 giải quyết mode |
| (không args) | menu | menu | menu | auto-derive từ dimensions chọn trong menu | Q1(mode) → Q2(scope) → Q3(verify) → discovery → dispatch |

`--full` → tất cả 7 dimension. Không có dimension flag + không có `--full` → Phase 1b Q2.

## Report Output Location

Tất cả report được lưu vào: `.work/review/`

- **MR/PR**: `REVIEW-MR-YYYYMMDD-HHMMSS--{platform}-{number}-{sanitized-title}.md`
- **Code**: `REVIEW-CODE-YYYYMMDD-HHMMSS--{sanitized-path}.md`

## Key Principles

- **Main agent điều phối, workflow thực thi** — SKILL.md xử lý các interactive phase (input, discovery, selection, posting, CLI check). Workflow xử lý deterministic pipeline (review, verify, synthesize, report).
- **Tất cả subagent chạy song song** — không bao giờ tuần tự. Workflow dispatch chúng trong một lần gọi `parallel()`.
- **Mode flag xác định ngữ cảnh** — `--mr`/`--pr` cho merge requests, `--code` cho source code. Conflict detection đảm bảo chính xác một mode.
- **CLI verification gate** — Phase 3 chặn tiến trình cho đến khi `gh`/`glab` được cài đặt và xác thực.
- **Adversarial verification là opt-in** — mặc định là standard mode. Người dùng chọn qua menu Q3 hoặc flag `--adversarial`.
- **Deduplicate trước khi report** — synthesis phase merge các cross-dimension findings.
- **URGENT ưu tiên cao nhất** — nếu bất kỳ dimension nào cho kết quả URGENT, CRITICAL, hoặc BLOCKER, overall verdict là URGENT.
- **Mỗi finding = một comment** — khi post lên MR/PR, mỗi finding có comment riêng.
- **Resumable khi lỗi** — nếu subagent thất bại giữa workflow, resume với `Workflow({ resumeFromRunId })`.
- **Token efficient** — intermediate agent outputs nằm trong workflow script variables, không nằm trong Claude's context.
- **Self-contained** — tất cả subagent prompt được inline vào workflow script. Không phụ thuộc file agent bên ngoài.

## Reference Guide

- `references/workflow-handoff.md` — Workflow args schemas, result schemas, error handling patterns, retry strategy cho cả MR và code workflows

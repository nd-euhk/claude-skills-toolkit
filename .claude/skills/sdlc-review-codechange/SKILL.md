---
name: sdlc-review-codechange
description: >-
  Review source code changes / worktrees / local code with workflow-driven parallel
  analysis across 8 dimensions: architecture, security, bugs, CLAUDE.md conventions,
  feature impact, operational risk, test quality, and spec compliance (does the code
  implement the feature's SRS/IMP specs?). Supports optional adversarial
  verification and an UNATTENDED mode (--unattended) that runs with zero prompts for
  night/CI automation. Use when reviewing code produced by cook or a change, reviewing
  a worktree before PR, auditing source code quality/security/bugs, checking CLAUDE.md
  compliance, or auto-reviewing code at night without a human present. Supports --full,
  --arch, --security, --bugs, --conventions, --impact, --ops, --tests, --adversarial,
  --unattended, --focus, --base <branch>, --specs <path>, --full-tree flags. Detects
  the current branch and its merge target (explicit --base from the caller, or auto via
  origin/HEAD) and scopes the review to the DIFF between them — only changed code is
  reviewed, not the whole tree. When given the feature specs (--specs <path>), adds a
  Spec Compliance dimension that traces each SRS/IMP/TST requirement to code, catching
  gaps (unimplemented), partial, and divergent implementations. For remote MR/PR
  review, use sdlc-review-mr instead.
argument-hint: "[--full] [--arch] [--security] [--bugs] [--conventions] [--impact] [--ops] [--tests] [--spec] [--adversarial] [--unattended] [--focus \"<description>\"] [--base <branch>] [--specs \"<path>\"] [--full-tree] <path>"
version: 1.2.0
allowed-tools:
  - Read
  - Write
  - Bash(git:*,ls:*,find:*,cat:*,which:*,npm:*,apt:*,brew:*)
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
  - Workflow
  - Skill
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - TaskList
---

# SDLC Review — Code Change / Source Code

Deep review mã nguồn cục bộ trên 7 dimension độc lập, được điều phối qua
`workflow-sdlc-review-code.js`. Hỗ trợ **hai contract**:

- **Interactive** (mặc định, khi không có đủ flags): menu routing qua `AskUserQuestion`,
  error recovery hỏi human. Dùng khi human có mặt review một worktree / thư mục.
- **Unattended** (`--unattended`): chạy với zero prompt, error handling deterministic,
  trả verdict machine-readable. Dùng khi controller tự chạy ban đêm / CI — đây là entry
  point review đêm cho cook-overnight.

**Tách khỏi `/sdlc-review-mr`:** Skill này CHỈ review code cục bộ (thư mục / worktree /
file), không liên quan MR/PR trên nền tảng từ xa. Muốn review MR/PR trên GitHub/GitLab
(luôn có human + có side-effect post comment) → dùng `/sdlc-review-mr`.

## When to use this skill

- Review code mới / code thay đổi trong worktree trước khi tạo PR (fixbug, cook pre-merge)
- Audit mã nguồn cục bộ: chất lượng, kiến trúc, bảo mật, bug, convention
- Kiểm tra tuân thủ CLAUDE.md conventions
- **Chạy tự động ban đêm**: sau khi cook hoàn tất code, review và đánh giá code đó
  không cần human (dùng `--unattended`)

**Không dùng cho:**
- Review MR/PR trên GitHub/GitLab (dùng `/sdlc-review-mr`)
- Code style / formatting (dùng linter/prettier)

## Quick Start

```bash
# Full review thư mục (interactive)
/sdlc-review-codechange --full src/auth/

# Review worktree trước PR (interactive, từ cook pre-merge)
/sdlc-review-codechange --full /path/to/worktree

# UNATTENDED — chạy đêm / CI, zero prompt, trả verdict machine-readable.
# Mặc định đêm = lean gating trio (security + bugs + spec) — code đúng + an toàn + đáp ứng tài liệu.
# --base <target>: PR target branch → review scope = diff feature...target (tự động).
# --specs <path>: spec feature → Spec Compliance (auto khi có specs).
/sdlc-review-codechange --unattended --base origin/main --specs agent_docs/features/FEAT-001/ /path/to/worktree

# Đêm muốn full 8 dimension vẫn được (opt-in):
/sdlc-review-codechange --full --unattended --base origin/main /path/to/worktree

# Dimension cụ thể + adversarial
/sdlc-review-codechange --security --bugs --adversarial src/api/

# Full-tree review (bỏ qua diff scope — audit module / working copy, không merge-in-progress)
/sdlc-review-codechange --full --full-tree src/auth/

# Review kèm spec-compliance (code có đáp ứng tài liệu không) — truyền spec path feature
/sdlc-review-codechange --full --specs agent_docs/features/FEAT-001/ src/auth/

# Interactive (không args) — menu routing
/sdlc-review-codechange
```

## Core Workflow

### Phase 1: Parse Input

Trích xuất từ user args:

- **Target path** (positional): đường dẫn thư mục hoặc file cần review (mặc định: cwd).
- **Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`,
  `--ops`, `--tests`, `--spec`, `--full`. Không có → Phase 1b Q1.
- **Verification flag**: `--adversarial` (mặc định: tắt).
- **Unattended flag**: `--unattended` → bật unattended contract (xem mục
  "Unattended Contract" bên dưới).
- **Focus flag**: `--focus "<description>"` → bỏ qua auto-derive ở Phase 1c.
- **Base flag**: `--base <branch>` → merge target tường minh (cook/cook-overnight truyền
  PR target; nếu thiếu → auto-detect ở Phase 1d). Scope review = diff `<base>...HEAD`.
- **Full-tree flag**: `--full-tree` → bỏ qua diff scope, review toàn bộ `targetPath`.
- **Specs flag**: `--specs <path>` → thư mục/file spec (SRS + IMP + TST) cho feature; thiếu
  → auto-detect từ headBranch (Phase 1e); không resolve → SKIP spec dimension (deterministic).
- **Spec dimension flag**: `--spec` → chỉ thêm dimension Spec Compliance.

**Resolve `repoPath`**: `git rev-parse --show-toplevel` trên target path. Nếu target
tương đối → resolve theo repoPath. Nếu tuyệt đối → xác minh nằm trong repoPath.

### Phase 1b: Menu Routing (không flag hoặc thiếu dimensions)

Dùng `AskUserQuestion` tuần tự — **KHÔNG chạy phase này khi `--unattended`**.
Khi `--unattended` + không dimension flag → `dimensions = ["security", "bugs", "spec"]`
(lean gating trio — mặc định đêm: code đúng + an toàn + đáp ứng tài liệu; `--full` vẫn opt-in = 8):

**Q1 — Scope** (header: "Phạm vi", multiSelect: false):
1. "Full Review (tất cả 8 dimension — bao gồm Spec Compliance)" (Khuyến nghị)
2. "Code Quality: Architecture + Bugs + Conventions + Tests"
3. "Safety & Impact: Security + Feature Impact + Operational"
4. "Specific dimensions" — hiển thị 2 multi-select tiếp theo (tối đa 4 options mỗi lần)

Q1a (header: "Dimensions (1/2)", multiSelect: true):
1. "Architecture" — C4 model, ADR, SOLID, coupling
2. "Security" — OWASP, secrets, auth, data exposure
3. "Bugs" — Logic errors, race conditions, edge cases
4. "CLAUDE.md Conventions" — naming, patterns, structure

Q1b (header: "Dimensions (2/2)", multiSelect: true):
1. "Feature Impact" — Cross-feature, interface consistency, regression
2. "Operational" — DB migration, performance, deploy risk
3. "Test Quality" — Cheating patterns, coverage, assertions
4. "Spec Compliance" — code có đáp ứng SRS/IMP không (GAP/PARTIAL/DIVERGENT)

**Q2 — Verification** (header: "Xác minh", multiSelect: false):
1. "Standard (nhanh hơn)" (Khuyến nghị)
2. "Adversarial (chậm hơn, ít false positive — mỗi finding được 3 skeptic xác minh)"

### Phase 1c: Derive Scout Focus

Sau khi `dimensions[]` được resolve (từ flags hoặc menu), derive `focus` string cho
sdlc-scout để scout ưu tiên file/pattern liên quan.

**Luật ưu tiên:**
1. User truyền `--focus` tường minh → dùng giá trị đó, bỏ qua auto-derive.
2. Không → auto-derive từ `dimensions[]`.

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
| `spec` | "business rule implementation, requirements traceability, error code mapping, Gherkin scenario coverage, spec-to-code alignment, execution flow completeness, SRS/IMP conformance" |

**Luật join:** 1 dimension → dùng thẳng; N dimensions → join bằng `"; "`; `--full` →
join tất cả 7.

### Phase 1d: Derive Review Scope (Branch + Diff)

<EXTREMELY-IMPORTANT>
Scope review = **diff giữa feature branch và merge target** — review CHỈ code thay đổi,
không review toàn bộ tree. Lý do (đánh giá v1.1.0):
1. **Tự động hoàn toàn**: cook/cook-overnight biết PR target → truyền `--base`; skill
   detect branch hiện tại → không cần human input gì.
2. **Sensible hơn**: review đúng cái sẽ merge; dimension agents focus vào changed files
   + interactions thay vì bị nhiễu bởi baseline code không liên quan.
3. **Nhanh hơn**: không explore toàn tree.
Fallback: không resolve được base → full-tree review (hành vi cũ), note vào report.
</EXTREMELY-IMPORTANT>

**Bước 1 — Current branch** (luôn chạy):
```bash
head=$(git -C <repoPath> rev-parse --abbrev-ref HEAD 2>/dev/null)
# detached HEAD → in ra "HEAD" → base không resolve được → full-tree
```

**Bước 2 — Base branch (merge target)**:
- `--base <ref>` tường minh → dùng thẳng (caller biết PR target chính xác nhất).
- Không có `--base` → auto-detect (best-effort):
  ```bash
  ohead=$(git -C <repoPath> symbolic-ref refs/remotes/origin/HEAD 2>/dev/null)
  # → refs/remotes/origin/main → base="origin/main"
  # thất bại → thử lần lượt ref đầu tiên resolve được: origin/main, origin/master, main, master
  ```
- **KHÔNG dùng `@{upstream}` làm base** — feature branch đã push `-u` thì `@{upstream}` =
  `origin/feature/X` (chính nó), không phải integration target. Cạm bẫy đã verify bằng git thật.
- `base == head` (đang review chính default branch) → không có merge pending → full-tree.
- Không resolve được base → full-tree + note vào report.

**Bước 3 — Diff scope** (khi có base):
```bash
diffFiles=$(git -C <repoPath> diff --name-status <base>...HEAD 2>/dev/null)  # M a.txt / A b.txt
diffStat=$(git -C <repoPath> diff --stat <base>...HEAD 2>/dev/null)
```
- Diff rỗng (head chưa có commit so với base) → full-tree + note.
- Uncommitted changes (`git status --porcelain`) KHÔNG nằm trong `base...HEAD` diff — note
  vào report nhưng KHÔNG mở rộng scope (deterministic; cook luôn commit trước khi review).

**`--full-tree`** → bỏ qua toàn bộ detection, review toàn bộ `targetPath` (audit module /
working copy không phải merge-in-progress).

**Kết quả truyền vào workflow:**
- `headBranch`: current branch name (hoặc null)
- `baseBranch`: merge target (hoặc null = full-tree)
- `diffFiles`: `[{ status, file }]` từ `--name-status` (hoặc null)
- `diffStat`: output `git diff --stat` (hoặc null)

### Phase 1e: Resolve Spec Path (Spec Compliance)

<EXTREMELY-IMPORTANT>
Dimension Spec Compliance trả lời câu hỏi: **code có đáp ứng tài liệu (SRS/IMP/TST) không?** —
trace từng business rule / Gherkin scenario / execution-flow step đến code, đánh dấu
`GAP` (thiếu — không có code), `PARTIAL` (chỉ 1 phần), `DIVERGENT` (làm khác spec),
`IMPLEMENTED`. Khi resolve được spec path → `spec` dimension TỰ ĐỘNG được thêm vào
`dimensions` (không cần flag) — đây là "rất cần" cho review đêm: không dimension nào
trong 7 dimension cũ trả lời "code có đáp ứng spec không".
</EXTREMELY-IMPORTANT>

**Bước 1 — Spec path** (ưu tiên theo thứ tự):
- `--specs <path>` tường minh → dùng thẳng. Caller (cook/cook-overnight) biết chính xác:
  `<workspace_root>/agent_docs/features/<FEAT_ID>/` (SRS + IMP + TST của feature).
- Không có `--specs` → auto-detect từ `headBranch` (Phase 1d Bước 1):
  ```bash
  feat_id=$(echo "$head" | grep -oE 'FEAT-[A-Z0-9]+' | head -1)
  # có feat_id → thử <repoPath>/agent_docs/features/$feat_id/
  ```
  (workspace-member: agent_docs committed trong worktree → detect được. sub-repo Type 1:
  agent_docs nằm ở workspace root, không phải sub-repo → KHÔNG detect — caller nên truyền `--specs`.)
- Không resolve được → **SKIP spec dimension** (deterministic, không hỏi kể cả interactive):
  không thêm `spec` vào `dimensions`, ghi note "Spec compliance skipped: no spec path
  (dùng --specs <path>)" vào report + return summary.

**Bước 2 — Thêm dimension:**
- Nếu `specsPath` resolve được VÀ `"spec"` chưa có trong `dimensions` → `dimensions.push("spec")`.
- `--full` giờ = 8 dimension (bao gồm spec).

**Kết quả truyền vào workflow:**
- `specsPath`: thư mục/file spec (hoặc null → spec dimension không chạy)

### Phase 5a: Scout

```js
const scoutResult = await Skill(sdlc-scout, `${targetPath} --mode review --focus "${focus || ''}"`)
```

Nếu `focus` rỗng → `--focus ""` → sdlc-scout chạy không định hướng (fallback an toàn).

> Lưu ý unattended: nếu sdlc-scout hỏi về repomix install (AskUserQuestion), trong
> unattended mode KHÔNG hỏi — nếu repomix chưa cài, bỏ qua acceleration, chạy
> file-scan thường, ghi warning "repomix chưa cài" vào report.

### Phase 5: Dispatch Workflow

```js
const codeArgs = {
  repoPath,        // đường dẫn tuyệt đối đến repo
  targetPath,      // thư mục/file cần review
  dimensions,      // string[]
  adversarial,     // boolean
  runDate,         // $(date +%Y%m%d-%H%M%S)
  scoutReports: scoutResult?.reports || [],  // structured scout output
  headBranch,      // string | null — branch hiện tại (Phase 1d)
  baseBranch,      // string | null — merge target (Phase 1d); null = full-tree review
  diffFiles,       // [{status,file}] | null — changed files vs base (Phase 1d)
  diffStat,        // string | null — output `git diff --stat` (Phase 1d)
  specsPath,       // string | null — spec files (Phase 1e); null = spec dimension SKIPPED
}

// Guard: ls .claude/workflows/review/workflow-sdlc-review-code.js
// Nếu thiếu → "Không tìm thấy workflow script. Vui lòng đảm bảo plugin đã được cài đặt đúng cách."

const result = await Workflow({
  scriptPath: ".claude/workflows/review/workflow-sdlc-review-code.js",
  args: codeArgs
})
```

Workflow chạy các phase nội bộ (hiển thị trong `/workflows`):
1. **Review** — 7 subagent song song (inline prompt, khám phá codebase)
2. **Verify** — adversarial verification (chỉ khi `adversarial: true`)
3. **Synthesize** — merge, deduplicate, tính overall verdict
4. **Report** — tạo markdown tại `.work/review/REVIEW-CODE-{runDate}--{slug}.md`

Để biết đầy đủ args schema, result schema, và error handling patterns, xem
`references/workflow-handoff.md`.

## Unattended Contract (--unattended)

<EXTREMELY-IMPORTANT>
Khi `--unattended` được set (hoặc skill được gọi từ controller với full flags):
KHÔNG BAO GIỜ dùng `AskUserQuestion`. Zero prompt. Mọi quyết định dùng default.
</EXTREMELY-IMPORTANT>

| Điểm HITL (interactive) | Auto-decision khi `--unattended` |
|-------------------------|----------------------------------|
| Q1 Scope (Phase 1b) | `dimensions` mặc định = **lean gating trio** `["security", "bugs", "spec"]` (không flag). `--full` vẫn = 8 dimension (opt-in) |
| Base detection (Phase 1d) | Không hỏi — `--base` từ caller, thiếu → auto-detect `origin/HEAD`; không resolve → full-tree + note vào report |
| Spec resolution (Phase 1e) | Không hỏi — `--specs` từ caller, thiếu → auto-detect từ headBranch; không resolve → SKIP spec dimension, note vào report + return summary |
| Q2 Verification (Phase 1b) | `adversarial` mặc định = giá trị flag `--adversarial` (thường false cho đêm) |
| Scout repomix prompt | Bỏ qua acceleration, file-scan thường, warning vào report |
| Partial subagent failure | KHÔNG hỏi retry — trả partial verdict kèm `failedDimensions`, log vào report |
| Workflow total failure | KHÔNG hỏi retry — trả `verdict: 'ERROR'`, `reportPath: null`, log lý do |
| Post comments | KHÔNG có (code mode không post comments) |

**Result contract cho controller:** sau khi workflow hoàn tất, skill trả về
`result.verdict` (`APPROVED` | `NEEDS_ATTENTION` | `URGENT` | `ERROR`) + `result.stats`
làm đầu vào cho morning report / gate của pipeline đêm. Report tại
`.work/review/REVIEW-CODE-{runDate}--{slug}.md` là record cho human review sáng.

**Điều kiện kích hoạt:** `--unattended` flag tường minh, HOẶC skill được gọi qua
`Skill("sdlc-review-codechange", "...")` từ một controller (cook, cook-overnight,
orchestrator) với đủ flags (target path + dimensions). Khi có flags nhưng KHÔNG có
`--unattended`, skill vẫn có thể hỏi error-recovery — controller muốn đảm bảo zero
prompt phải truyền `--unattended`.

## Các Dimension Review

| Dimension | Severity default | Trọng tâm |
|-----------|------------------|-----------|
| **Architecture** | URGENT | C4 model impact, ADR compliance, SOLID, coupling, breaking changes |
| **Security** | CRITICAL | OWASP Top 10, secret detection, auth/authz, data exposure, dependencies |
| **Bugs** | BUG_FOUND | Logic errors, race conditions, edge cases, error handling, type safety |
| **Conventions** | VIOLATION | CLAUDE.md compliance, naming, patterns, structure, testing standards |
| **Feature Impact** | BLOCKER | Cross-feature impact, interface/impl consistency, shared code consumers, regression risk |
| **Operational** | BLOCKER | DB migration safety, performance impact, deploy risk, rollback complexity |
| **Test Quality** | URGENT | Cheating patterns, test-to-impl mapping, assertion quality, coverage gaps |
| **Spec Compliance** | GAP | SRS/IMP/TST requirements → code. Traceability matrix: GAP (unimplemented), PARTIAL, DIVERGENT, IMPLEMENTED |

Overall verdict: `APPROVED` | `NEEDS_ATTENTION` | `URGENT`. Nếu bất kỳ dimension nào cho
URGENT/CRITICAL/BLOCKER → overall verdict là URGENT.

## Error Handling

### Partial subagent failure
- **Interactive**: thông báo `failedDimensions`, `AskUserQuestion` retry / skip.
- **Unattended**: trả partial verdict + `failedDimensions`, log vào report, KHÔNG hỏi.

### Workflow unavailable
`.claude/workflows/review/workflow-sdlc-review-code.js` không tồn tại → trả
`verdict: 'ERROR'` với thông báo "Plugin cần cài đặt lại." Không fallback.

### Workflow complete failure
- **Interactive**: hiển thị những gì có sẵn, đề nghị retry `Workflow({ resumeFromRunId })`.
- **Unattended**: trả `verdict: 'ERROR'`, log lý do, không retry prompt.

## Key Principles

- **Main agent điều phối, workflow thực thi** — SKILL.md xử lý interactive phases (menu,
  scout); workflow xử lý deterministic pipeline.
- **Scout trước, review sau** — sdlc-scout định hướng file/pattern cho dimension agents.
- **Diff scope khi có base** — review focus vào changed files (diff `base...HEAD`), không
  review toàn tree; full-tree là fallback (không resolve được base) hoặc opt-out (`--full-tree`).
- **Spec conformance là dimension riêng** — review trả lời "code có đáp ứng tài liệu không":
  trace SRS/IMP/TST requirement → code (GAP/PARTIAL/DIVERGENT). Không nằm trong Bugs (bug =
  code sai ở chỗ CÓ; GAP = requirement THIẾU) hay Tests (test có thể pass mà code không đúng spec).
- **Tất cả subagent chạy song song** — workflow dispatch trong một lần gọi `parallel()`.
- **Adversarial verification là opt-in**.
- **Unattended = zero prompt** — mặc định mọi quyết định, error deterministic.
- **Deduplicate trước khi report** — synthesis phase merge cross-dimension findings.
- **URGENT ưu tiên cao nhất**.
- **Resumable khi lỗi** — `Workflow({ resumeFromRunId })` (interactive).

## Report Output Location

`.work/review/REVIEW-CODE-{runDate}--{sanitized-path}.md`

## Reference Guide

- `references/workflow-handoff.md` — Workflow args schema, result schema, error handling patterns, retry strategy cho code workflow.

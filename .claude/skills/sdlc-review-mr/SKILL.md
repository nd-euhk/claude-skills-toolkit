---
name: sdlc-review-mr
description: >-
  Review merge requests and pull requests on GitHub/GitLab with workflow-driven
  parallel analysis across 7 dimensions: architecture, security, bugs, CLAUDE.md
  conventions, feature impact, operational risk, and test quality. Supports optional
  adversarial verification to reduce false positives. Use when reviewing MR/PR,
  pre-merge review, reviewing a pull request diff, detecting bugs or security issues
  in a merge request, checking architectural impact of a PR, or posting review
  comments to GitHub/GitLab. Supports --mr/--pr flags and --arch, --security,
  --bugs, --conventions, --impact, --ops, --tests, --full, --adversarial flags.
  Interactive — requires human present. For unattended review of local code
  changes, use sdlc-review-codechange instead.
argument-hint: "[--mr <id>] [--pr <id>] [<url>] [--full] [--arch] [--security] [--bugs] [--conventions] [--impact] [--ops] [--tests] [--adversarial]"
version: 2.0.0
allowed-tools:
  - Read
  - Write
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

# SDLC Review — Merge Request / Pull Request

Deep review một MR/PR trên GitHub/GitLab trên 7 dimension độc lập, được điều phối
qua `workflow-sdlc-review-mr.js`. Skill xử lý các phase interactive (parse, discovery,
platform check, fetch diff, post comments); workflow xử lý deterministic pipeline
(review → verify → synthesize → report).

**Tách khỏi `/sdlc-review-codechange`:** Skill này CHỈ review MR/PR trên nền tảng từ xa
(GitHub/GitLab), luôn có human trong loop. Muốn review source code / worktree cục bộ
hoặc chạy unattended vào ban đêm → dùng `/sdlc-review-codechange`.

## When to use this skill

- Review merge request / pull request trên GitHub/GitLab
- Pre-merge review trước khi merge
- Kiểm tra architectural impact, security, bug, convention, feature impact, operational
  risk, hoặc test quality của một MR/PR
- Post review comments lên MR/PR

**Không dùng cho:**
- Local source code / worktree review (dùng `/sdlc-review-codechange`)
- Unattended / ban đêm (dùng `/sdlc-review-codechange --unattended`)
- Code style / formatting (dùng linter/prettier)

## Quick Start

```bash
# Full MR review (tất cả 7 dimension)
/sdlc-review-mr --mr --full gl-456

# Full PR review với adversarial verification (ít false positive hơn)
/sdlc-review-mr --pr --full --adversarial https://github.com/owner/repo/pull/123

# Single dimension trên PR
/sdlc-review-mr --pr --arch gh-789

# Interactive (không args) — menu routing + workspace discovery
/sdlc-review-mr
```

## Core Workflow

### Phase 1: Parse Input

Trích xuất từ user args:

- **Platform flag** (tối đa MỘT): `--mr` (GitLab), `--pr` (GitHub). Nếu ≥2 → CONFLICT
  → Phase 1b Q1. Nếu không có → phát hiện từ URL/prefix/remote (Phase 3a).
- **Dimension flags**: `--arch`, `--security`, `--bugs`, `--conventions`, `--impact`,
  `--ops`, `--tests`, `--full`. Nếu không có → Phase 1b Q2.
- **Verification flag**: `--adversarial` (mặc định: tắt).
- **Identifier**: URL hoặc platform prefix + number (`gh-123`, `gl-456`) hoặc bare number.

Nếu có đủ flags (identifier + dimensions) → bỏ qua menu hoàn toàn.

### Phase 1b: Menu Routing (không flag hoặc conflict)

Dùng `AskUserQuestion` tuần tự:

**Q1 — Platform** (header: "Nền tảng", multiSelect: false) — chỉ hỏi khi ≥2 platform flag
conflict, hoặc không thể phát hiện từ URL/remote:
1. "GitHub (PR)" — `gh` CLI
2. "GitLab (MR)" — `glab` CLI

**Q2 — Scope** (header: "Phạm vi", multiSelect: false):
1. "Full Review (tất cả 7 dimension)" (Khuyến nghị)
2. "Code Quality: Architecture + Bugs + Conventions + Tests"
3. "Safety & Impact: Security + Feature Impact + Operational"
4. "Specific dimensions" — hiển thị 2 multi-select tiếp theo (tối đa 4 options mỗi lần)

Q2a (header: "Dimensions (1/2)", multiSelect: true):
1. "Architecture" — C4 model, ADR, SOLID, coupling
2. "Security" — OWASP, secrets, auth, data exposure
3. "Bugs" — Logic errors, race conditions, edge cases
4. "CLAUDE.md Conventions" — naming, patterns, structure

Q2b (header: "Dimensions (2/2)", multiSelect: true):
1. "Feature Impact" — Cross-feature, interface consistency, regression
2. "Operational" — DB migration, performance, deploy risk
3. "Test Quality" — Cheating patterns, coverage, assertions

**Q3 — Verification** (header: "Xác minh", multiSelect: false):
1. "Standard (nhanh hơn)" (Khuyến nghị)
2. "Adversarial (chậm hơn, ít false positive — mỗi finding được 3 skeptic xác minh)"

### Phase 2: Workspace Discovery (khi không có MR identifier)

1. **Repo hiện tại**: `git rev-parse --show-toplevel` → nếu là git repo → ứng viên
2. **Submodules**: `git submodule status` → mỗi submodule → ứng viên
3. **Thư mục projects/** (gitignored): kiểm tra các repo bổ sung
4. **Deduplicate**: loại bỏ trùng lặp giữa submodules và projects/
5. **Hiển thị cho người dùng**:
   - 0 repo → "Không tìm thấy repo. Vui lòng cung cấp MR/PR URL."
   - 1 repo → tự động chọn
   - 2-4 repo → `AskUserQuestion`
   - 5+ repo → bảng đánh số, chờ nhập số

### Phase 3: Platform Detection & CLI Check

**Bước 3a: Phát hiện platform** (theo thứ tự ưu tiên):
1. **Flag**: `--mr` → GitLab, `--pr` → GitHub
2. **URL**: `github.com` → GitHub, `gitlab.com`/`gitlab.*` → GitLab
3. **Prefix**: `gh-123` → GitHub, `gl-456` → GitLab
4. **Git remote** (fallback): `git remote get-url origin`

**Bước 3b: Xác minh CLI tool đã cài đặt**:

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
  1. "Cài đặt gh CLI" — cài đặt + hướng dẫn login + DỪNG (chạy lại skill)
  2. "Không cài, hủy review"
```

**Nếu CLI đã cài nhưng chưa xác thực:**
```
"gh CLI đã cài nhưng chưa đăng nhập."
Options:
  1. "Đăng nhập ngay" — chạy `gh auth login` + DỪNG
  2. "Hủy review"
```

### Phase 4: Fetch MR Content

1. **Fetch open MRs** (nếu không có identifier): `gh pr list` hoặc `glab mr list`
2. **Hiển thị MRs** (nếu nhiều): ≤4 → `AskUserQuestion`, 5+ → bảng đánh số
3. **Fetch diff**: `gh pr diff <id>` hoặc `glab mr diff <id>` → full unified diff
4. **Fetch metadata**: `gh pr view <id> --json title,author,baseRefName,headRefName,files,additions,deletions,url` hoặc `glab mr view <id> --output json`
5. **Phân tích cấu trúc diff**: files changed, LOC, change types (code/config/docs/test/dependency)

### Phase 5: Dispatch Workflow

```js
const mrArgs = {
  diff,            // string — full unified diff
  metadata: { id, title, author, branch, files, loc, url },
  repoPath,        // đường dẫn tuyệt đối đến repo
  platform,        // 'github' | 'gitlab'
  dimensions,      // string[] từ Phase 1/1b
  adversarial,     // boolean
  runDate,         // $(date +%Y%m%d-%H%M%S)
}

// Guard: ls .claude/workflows/review/workflow-sdlc-review-mr.js
// Nếu thiếu → "Không tìm thấy workflow script. Vui lòng đảm bảo plugin đã được cài đặt đúng cách."

const result = await Workflow({
  scriptPath: ".claude/workflows/review/workflow-sdlc-review-mr.js",
  args: mrArgs
})
```

Workflow chạy các phase nội bộ (hiển thị trong `/workflows`):
1. **Review** — 7 subagent song song (inline prompt, diff analysis)
2. **Verify** — adversarial verification (chỉ khi `adversarial: true`)
3. **Synthesize** — merge, deduplicate, tính overall verdict
4. **Report** — tạo markdown tại `.work/review/REVIEW-MR-{runDate}--{slug}.md`

Để biết đầy đủ args schema, result schema, và error handling patterns, xem
`references/workflow-handoff.md`.

### Phase 6: Post Comments

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

🤖 Generated by sdlc-review-mr skill
```

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

Overall verdict: `APPROVED` | `NEEDS_ATTENTION` | `URGENT`. Nếu bất kỳ dimension nào cho
URGENT/CRITICAL/BLOCKER → overall verdict là URGENT.

## Error Handling

### Partial subagent failure
Workflow trả về `failedDimensions: ['security']` → report vẫn bao gồm kết quả từ các
dimension còn lại. Thông báo cho người dùng, đề nghị retry thủ công dimension bị lỗi.

### Workflow unavailable
`.claude/workflows/review/workflow-sdlc-review-mr.js` không tồn tại → hủy bỏ với thông
báo "Plugin cần cài đặt lại." Không fallback sang chế độ thủ công.

### Workflow complete failure
Workflow trả về `verdict: 'ERROR'` → hiển thị những gì có sẵn, đề nghị retry với
`Workflow({ resumeFromRunId })`.

### CLI not installed (Phase 3)
AskUserQuestion → cài đặt → hướng dẫn login → DỪNG.

## Key Principles

- **Main agent điều phối, workflow thực thi** — SKILL.md xử lý interactive phases; workflow xử lý deterministic pipeline.
- **Tất cả subagent chạy song song** — workflow dispatch trong một lần gọi `parallel()`.
- **CLI verification gate** — Phase 3 chặn tiến trình cho đến khi `gh`/`glab` cài đặt và xác thực.
- **Adversarial verification là opt-in** — mặc định standard mode.
- **Deduplicate trước khi report** — synthesis phase merge cross-dimension findings.
- **URGENT ưu tiên cao nhất** — bất kỳ URGENT/CRITICAL/BLOCKER nào → overall URGENT.
- **Mỗi finding = một comment** — khi post lên MR/PR.
- **Resumable khi lỗi** — `Workflow({ resumeFromRunId })`.
- **Token efficient** — intermediate agent outputs nằm trong workflow script variables.

## Report Output Location

`.work/review/REVIEW-MR-{runDate}--{platform}-{number}-{sanitized-title}.md`

## Reference Guide

- `references/workflow-handoff.md` — Workflow args schema, result schema, error handling patterns, retry strategy cho MR workflow.

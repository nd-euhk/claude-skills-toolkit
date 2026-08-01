# Workflow Handoff — sdlc-review ↔ Workflows

Cơ chế handoff giữa `sdlc-review` skill và hai workflow script của nó. Skill chuẩn bị tất cả inputs, chọn workflow phù hợp, xử lý kết quả.

## Which workflow to use

| Mode Flag | Workflow Script | Mục đích |
|---|---|---|
| `--mr` hoặc `--pr` | `workflow-sdlc-review-mr.js` | Review merge/pull request diff |
| `--code` | `workflow-sdlc-review-code.js` | Review source code cục bộ qua exploration |

## MR/PR Workflow: workflow-sdlc-review-mr.js

### Args Structure (Skill → Workflow)

```js
const mrArgs = {
  diff: "diff --git a/src/...\n...",    // string — full unified diff từ gh/glab
  metadata: {                             // object — MR metadata
    id: 123,                              // number — MR/PR number
    title: "Add user authentication",     // string
    author: "username",                   // string
    branch: "feature/auth",               // string — source branch
    files: ["src/auth/login.ts", ...],    // string[] — changed file paths
    loc: 245,                             // number — tổng lines changed
    url: "https://github.com/o/r/pull/123", // string — MR/PR URL
  },
  repoPath: "/absolute/path/to/repo",    // string — đường dẫn tuyệt đối
  platform: "github",                    // "github" | "gitlab"
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"], // string[]
  adversarial: true,                     // boolean — bật Verify phase
  runDate: "20260626",                   // string YYYYMMDD
}
```

### Chuẩn bị args từ skill

1. **diff**: Từ `gh pr diff <id>` hoặc `glab mr diff <id>` — full unified diff, không bao giờ cắt ngắn
2. **metadata**: Từ `gh pr view <id> --json ...` hoặc `glab mr view <id> --output json`
   - `files`: danh sách changed file paths
   - `loc`: tổng additions + deletions
3. **repoPath**: Đường dẫn tuyệt đối từ `git rev-parse --show-toplevel`
4. **platform**: Từ Phase 3 — `--mr` → `gitlab`, `--pr` → `github`, hoặc phát hiện từ URL/remote
5. **dimensions**: Từ Phase 1 flag parsing hoặc Phase 1b menu Q2
6. **adversarial**: Từ flag `--adversarial` hoặc menu Q3
7. **runDate**: `$(date +%Y%m%d)`

### Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/review/workflow-sdlc-review-mr.js", args: mrArgs })
```

**Guard**: `ls .claude/workflows/review/workflow-sdlc-review-mr.js` → nếu thiếu, hủy bỏ với thông báo lỗi.

### Result Structure (Workflow → Skill)

#### Success — Standard Mode
```js
{
  reportPath: ".work/review/REVIEW-MR-20260626--github-123-add-user-authentication.md",
  verdict: "NEEDS_ATTENTION",
  findings: [
    {
      severity: "BUG_FOUND",
      categories: ["bugs"],
      description: "Missing null check on user object before accessing .email",
      recommendation: "Add null guard before accessing nested properties",
      affected_files: ["src/auth/login.ts:42"],
    },
  ],
  dimensions: {
    arch: { label: "Architecture", verdict: "APPROVED", findings: [] },
    security: { label: "Security", verdict: "CRITICAL", findings: [...] },
    // ...
  },
  stats: {
    totalFindings: 5,
    rawFindings: 7,
    dimensionsRun: 7,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

#### Success — Adversarial Mode
```js
{
  // ... giống standard +
  stats: {
    totalFindings: 3,        // sau verification (đã lọc từ 7 raw)
    rawFindings: 7,
    verifiedFindings: 3,     // vượt qua adversarial review
    rejectedFindings: 4,     // bị đánh dấu false positive
    dimensionsRun: 7,
    dimensionsFailed: 0,
    duration: "completed",
  }
}
```

#### Error — Partial Subagent Failure
```js
{
  reportPath: ".work/review/REVIEW-MR-20260626--github-123-feature.md",
  verdict: "URGENT",
  findings: [...],
  dimensions: { ... },
  stats: {
    totalFindings: 3,
    rawFindings: 3,
    dimensionsRun: 7,
    dimensionsFailed: 1,
    duration: "completed",
  },
  failedDimensions: ["security"]
}
```

#### Error — All Subagents Failed
```js
{
  reportPath: null,
  verdict: "ERROR",
  findings: [],
  dimensions: {},
  stats: { totalFindings: 0, duration: "N/A" },
  failedDimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"]
}
```

## Code Review Workflow: workflow-sdlc-review-code.js

### Args Structure (Skill → Workflow)

```js
const codeArgs = {
  repoPath: "/absolute/path/to/repo",    // string — đường dẫn tuyệt đối
  targetPath: "src/auth/",               // string — đường dẫn tương đối trong repo cần review
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"], // string[]
  adversarial: true,                     // boolean
  runDate: "20260626",                   // string YYYYMMDD
  scoutReports: [                        // array — structured scout output từ sdlc-scout (SKILL.md gọi sdlc-scout trước khi dispatch)
    { name: "auth-service", outputPath: ".work/scouts/scout-20260626-auth--myproject.md", filesFound: 42, highRelevance: 15, modulesFound: 6, entryPointsFound: 3 },
  ],
}
```

### Chuẩn bị args từ skill

1. **repoPath**: Đường dẫn tuyệt đối từ `git rev-parse --show-toplevel`
2. **targetPath**: Từ user input (sau flag `--code`) hoặc mặc định `"."` (thư mục hiện tại)
   - Nếu tương đối → resolve theo repoPath
   - Nếu tuyệt đối → xác minh nằm trong repoPath
3. **dimensions**: Từ Phase 1 flag parsing hoặc Phase 1b menu Q2
4. **adversarial**: Từ flag `--adversarial` hoặc menu Q3
5. **runDate**: `$(date +%Y%m%d)`

### Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/review/workflow-sdlc-review-code.js", args: codeArgs })
```

**Guard**: `ls .claude/workflows/review/workflow-sdlc-review-code.js` → nếu thiếu, hủy bỏ.

### Result Structure (Workflow → Skill)

Giống MR workflow result, với `reportPath` dùng prefix `REVIEW-CODE-`:
```
.work/review/REVIEW-CODE-YYYYMMDD--{sanitized-path}.md
```

### Code Review Workflow Phases

Khác với MR workflow nhận diff, code workflow nhận `scoutReports` (structured scout
output — do SKILL.md gọi `sdlc-scout` trước khi dispatch; nếu rỗng, mỗi dimension
agent tự khám phá codebase trong review):

```
Phase: Review
  parallel(tất cả 7 dimension, mỗi dimension khám phá + review)
  → mỗi agent dùng Bash(git:*,ls:*,find:*,cat:*) + Grep + Glob + Agent(Explore)
  → inline prompt được điều chỉnh cho source code exploration (không phải diff analysis)

Phase: Verify (chỉ adversarial)
  pipeline(mỗi finding → 3 skeptics) — pattern giống MR workflow

Phase: Synthesize
  merge + deduplicate + tính toán overall verdict

Phase: Report
  tạo markdown → .work/review/REVIEW-CODE-YYYYMMDD--{slug}.md
```

## Error Handling Patterns

### Pattern 1: Partial Subagent Failure (1-2 dimensions)
```
Workflow trả về: failedDimensions: ["security"]
→ Report: "Security review thất bại. Các dimension khác đã hoàn tất."
→ AskUserQuestion: "Retry security review?"
  - "Retry" → chạy lại Workflow với resumeFromRunId
  - "Skip" → report đã được tạo với các dimension còn lại
```

### Pattern 2: Workflow Total Failure
```
Workflow trả về: verdict: 'ERROR', reportPath: null
→ Thông báo: "Workflow không tạo được kết quả."
→ AskUserQuestion: "Retry workflow?"
  - "Retry" → Workflow({ resumeFromRunId: "<previous-id>" })
  - "Abort" → dừng
```

### Pattern 3: Workflow File Not Found
```
ls .claude/workflows/workflow-sdlc-review-{mr,code}.js → không có file
→ Thông báo: "Workflow script bị thiếu. Plugin có thể cần cài đặt lại."
→ Hủy bỏ
```

## Adversarial Verification Flow

Khi `adversarial: true`, workflow thêm một Verify phase trước Synthesis:

```
Phase: Review
  parallel(7 dimension agents) → raw findings

Phase: Verify (chỉ adversarial)
  pipeline(mỗi finding):
    parallel([
      skeptic: correctness lens
      skeptic: security lens
      skeptic: reproducibility lens
    ])
    → finding tồn tại nếu ≥2/3 skeptics xác nhận
  → filtered findings

Phase: Synthesize
  merge + deduplicate (chỉ dùng verified findings)

Phase: Report
  tạo markdown (ghi chú chế độ adversarial + thống kê rejection)
```

**Hướng dẫn cho skeptic (inline trong workflow):**
- **Correctness skeptic**: Tìm mitigating controls upstream. Mặc định "refute" nếu không chắc chắn.
- **Security skeptic**: Kiểm tra code có reachable từ user input không, compensating controls có tồn tại không. Mặc định "refute" nếu không chắc chắn.
- **Reproducibility skeptic**: Kiểm tra affected code path có thực sự trong scope không, test hiện có có bắt được không. Mặc định "refute" nếu không chắc chắn.

Một finding được **xác nhận** chỉ khi ≥2/3 skeptics bỏ phiếu `confirmed: true`.

## Token Efficiency

| Kịch bản | Old /sdlc-review-mr (Workflow + agent files) | New /sdlc-review (Workflow + inline prompts) |
|---|---|---|
| 7 dimensions, 10 findings | ~15K tokens trong context | ~15K tokens trong context |
| 7 dimensions + adversarial | ~25K tokens | ~25K tokens |
| 2 dimensions, 3 findings | ~8K tokens | ~8K tokens |
| Subagent failure + retry | Resume: chỉ failed agents chạy lại | Resume: chỉ failed agents chạy lại |

**Cơ chế:** Cả hai cách tiếp cận đều dùng Workflow tool — intermediate results nằm trong script variables. Cách inline loại bỏ nhu cầu load 7 file agent definition riêng biệt nhưng không thay đổi đáng kể context usage cho skill-level agent.

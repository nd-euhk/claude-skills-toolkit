# Workflow Handoff — sdlc-review-codechange ↔ workflow-sdlc-review-code.js

Cơ chế handoff giữa `sdlc-review-codechange` skill và workflow script của nó. Skill
chuẩn bị inputs, dispatch workflow, xử lý kết quả. Đây là entry point review đêm
(unattended) cho cook-overnight.

## Workflow Script

| Skill | Workflow Script | Mục đích |
|---|---|---|
| `sdlc-review-codechange` | `workflow-sdlc-review-code.js` | Review source code / worktree cục bộ |

## Args Structure (Skill → Workflow)

```js
const codeArgs = {
  repoPath: "/absolute/path/to/repo",    // string — đường dẫn tuyệt đối
  targetPath: "src/auth/",               // string — đường dẫn tương đối trong repo cần review
  dimensions: ["arch", "security", "bugs", "conventions", "impact", "ops", "tests"], // string[]
  adversarial: true,                     // boolean — bật Verify phase
  runDate: "20260820",                   // string YYYYMMDD
  scoutReports: [                        // array — structured scout output từ sdlc-scout
    { name: "auth-service", outputPath: ".work/scouts/scout-20260820-auth--myproject.md", filesFound: 42, highRelevance: 15, modulesFound: 6, entryPointsFound: 3 },
  ],
  headBranch: "feature/FEAT-001-svc",   // string|null — branch hiện tại (Phase 1d)
  baseBranch: "origin/main",             // string|null — merge target (Phase 1d); null = full-tree
  diffFiles: [                           // [{status,file}]|null — changed files vs base
    { status: "M", file: "src/auth/login.ts" },
    { status: "A", file: "src/auth/session.ts" },
  ],
  diffStat: " a.txt | 1 +\n b.txt | 1 +\n 2 files changed",  // string|null — git diff --stat
  specsPath: "agent_docs/features/FEAT-001",  // string|null — spec files (Phase 1e); null = spec dimension skipped
}
```

### Chuẩn bị args từ skill

1. **repoPath**: Từ `git rev-parse --show-toplevel`
2. **targetPath**: Từ user input (positional) hoặc mặc định `"."` (thư mục hiện tại)
   - Nếu tương đối → resolve theo repoPath
   - Nếu tuyệt đối → xác minh nằm trong repoPath
3. **dimensions**: Từ Phase 1 flag parsing hoặc Phase 1b menu Q1; unattended + không flag →
   **lean gating trio** `["security", "bugs", "spec"]`; `--full` = 8; khi `specsPath` resolve →
   `spec` auto-thêm (Phase 1e)
4. **adversarial**: Từ flag `--adversarial` hoặc menu Q2
5. **runDate**: `$(date +%Y%m%d)`
6. **scoutReports**: Từ `Skill(sdlc-scout, ...)` ở Phase 5a; nếu rỗng → mỗi dimension agent tự khám phá codebase trong review
7. **headBranch / baseBranch / diffFiles / diffStat**: Từ Phase 1d (Branch + Diff). Khi
   `baseBranch` + `diffFiles` hợp lệ → review scope = diff `base...HEAD` (dimension agents
   focus vào changed files + interactions). Khi `baseBranch = null` → full-tree review (hành vi cũ).
   `--base` từ caller (cook/cook-overnight truyền PR target); thiếu → skill auto-detect
   `origin/HEAD` → fallback `origin/main|origin/master|main|master`; không resolve → full-tree.
8. **specsPath**: Từ Phase 1e (Spec Path). `--specs` từ caller (cook/cook-overnight truyền
   `<workspace>/agent_docs/features/<FEAT_ID>/`); thiếu → auto-detect từ headBranch
   (`FEAT-[A-Z0-9]+` → `agent_docs/features/<FEAT_ID>/`); không resolve → `null`, spec dimension
   SKIPPED (deterministic, note vào report). Khi `specsPath` set → `spec` dimension auto-thêm
   vào `dimensions` → workflow chạy SPEC_PROMPT: trace SRS/IMP/TST requirement → code
   (traceability matrix GAP / PARTIAL / DIVERGENT / IMPLEMENTED).

## Workflow Invocation

```
Workflow({ scriptPath: ".claude/workflows/review/workflow-sdlc-review-code.js", args: codeArgs })
```

**Guard**: `ls .claude/workflows/review/workflow-sdlc-review-code.js` → nếu thiếu, trả
`verdict: 'ERROR'` với thông báo "Plugin cần cài đặt lại."

## Result Structure (Workflow → Skill)

#### Success — Standard Mode
```js
{
  reportPath: ".work/review/REVIEW-CODE-20260820--auth.md",
  verdict: "NEEDS_ATTENTION",      // "APPROVED" | "NEEDS_ATTENTION" | "URGENT"
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
  scoutSummary: [
    { name: "auth-service", outputPath: "...", filesFound: 42 },
  ],
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
  reportPath: ".work/review/REVIEW-CODE-20260820--auth.md",
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

## Workflow Phases

Khác với MR workflow nhận diff, code workflow nhận `scoutReports` (structured scout
output — do SKILL.md gọi `sdlc-scout` trước khi dispatch; nếu rỗng, mỗi dimension
agent tự khám phá codebase trong review):

```
Phase: Review
  parallel(tất cả dimension)
  → NẾU diff scope (baseBranch + diffFiles): agent nhận "Review Scope" section
    (changed files + diff stat) → focus vào diff, chạy `git diff <base>...HEAD -- <file>`
    cho từng file thay đổi + đọc context interactions với unchanged code
  → NẾU full-tree (baseBranch = null): mỗi dimension khám phá + review toàn bộ (hành vi cũ)
  → NẾU specsPath set: thêm spec agent (SPEC_PROMPT) — đọc spec tại specsPath, trace từng
    requirement (SRS business rule / Gherkin scenario, IMP execution flow / error mapping) đến
    code trong diff, emit traceability matrix (GAP/PARTIAL/DIVERGENT/IMPLEMENTED) + findings
  → mỗi agent dùng Bash(git:*,ls:*,find:*,cat:*) + Grep + Glob + Agent(Explore)

Phase: Verify (chỉ adversarial)
  pipeline(mỗi finding → 3 skeptics) — pattern giống MR workflow
  → skeptic context kèm review scope (diff vs <base> hoặc full-tree) để đánh giá
    "affected code path có thực sự trong scope không"

Phase: Synthesize
  merge + deduplicate + tính overall verdict

Phase: Report
  tạo markdown → .work/review/REVIEW-CODE-{runDate}--{slug}.md
```

## Error Handling Patterns

### Pattern 1: Partial Subagent Failure (1-2 dimensions)
```
Workflow trả về: failedDimensions: ["security"]
→ Interactive: Thông báo + AskUserQuestion "Retry security review?"
  - "Retry" → chạy lại Workflow với resumeFromRunId
  - "Skip" → report đã được tạo với các dimension còn lại
→ Unattended: trả partial verdict + failedDimensions, log vào report, KHÔNG hỏi.
```

### Pattern 2: Workflow Total Failure
```
Workflow trả về: verdict: 'ERROR', reportPath: null
→ Interactive: Thông báo + AskUserQuestion "Retry workflow?"
  - "Retry" → Workflow({ resumeFromRunId: "<previous-id>" })
  - "Abort" → dừng
→ Unattended: trả verdict: 'ERROR', log lý do, KHÔNG retry prompt.
```

### Pattern 3: Workflow File Not Found
```
ls .claude/workflows/review/workflow-sdlc-review-code.js → không có file
→ Trả verdict: 'ERROR', thông báo "Plugin cần cài đặt lại."
```

## Adversarial Verification Flow

Khi `adversarial: true`, workflow thêm Verify phase trước Synthesis:

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
- **Correctness skeptic**: Kiểm tra mitigating controls upstream. Mặc định "refute" nếu không chắc chắn.
- **Security skeptic**: Kiểm tra code có reachable từ user input không, compensating controls có tồn tại không. Mặc định "refute" nếu không chắc chắn.
- **Reproducibility skeptic**: Kiểm tra affected code path có thực sự trong scope không, test hiện có có bắt được không. Mặc định "refute" nếu không chắc chắn.

Một finding được **xác nhận** chỉ khi ≥2/3 skeptics bỏ phiếu `confirmed: true`.

## Unattended Consumption (cook-overnight)

Khi cook-overnight gọi `Skill("sdlc-review-codechange", "--security --bugs --spec --unattended --base <target> --specs <specDir> <worktree>")` (lean gating trio — night default):

1. Skill resolve path, scout, dispatch workflow, trả `result`.
2. Cook-overnight ghi `result.verdict` + `result.stats.dimensionsFailed` vào morning report.
3. `result.reportPath` (.work/review/REVIEW-CODE-*.md) là record cho human review sáng.
4. Verdict `URGENT`/`ERROR` → feature đánh dấu "cần human review" trong morning report,
   nhưng KHÔNG chặn PR creation (consistent với unattended-policy: không auto-merge).

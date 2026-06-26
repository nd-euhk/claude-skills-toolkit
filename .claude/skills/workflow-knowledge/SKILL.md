---
name: workflow-knowledge
description: >-
  Knowledge skill teaching Claude the Workflow tool API, orchestration patterns,
  and best practices for multi-agent scripts. Auto-activates when Claude writes
  or edits workflow scripts, encounters the Workflow tool, or needs to decide
  between pipeline/parallel/agent orchestration strategies.
version: 1.3.0
allowed-tools: Read
---

# Workflow Knowledge — Multi-Agent Orchestration at Scale

**Purpose:** Teach Claude the full Workflow tool API, quality patterns, and decision rules so it writes correct, efficient workflow scripts.

## Mindset

A workflow script IS the plan. With subagents/skills/teams, Claude holds the plan turn-by-turn. With workflows, the script holds the loop, branching, and intermediate results. Claude's context gets only the final answer.

## Decision: Workflow vs Subagent vs Skill vs Team

| | Subagents | Skills | Agent Teams | **Workflows** |
|---|---|---|---|---|
| Who decides next step | Claude, turn by turn | Claude, following prompt | Lead agent, turn by turn | **The script** |
| Intermediate results | Claude's context | Claude's context | Shared task list | **Script variables** |
| What's repeatable | Worker definition | Instructions | Team definition | **The orchestration** |
| Scale | Few per turn | Same as subagents | Handful of peers | **Dozens to hundreds** |
| Interruption | Restarts turn | Restarts turn | Teammates keep running | **Resumable in session** |

**Reach for a workflow when:** (a) the task needs more agents than one conversation can coordinate, (b) you want the orchestration codified as a repeatable script, (c) you need adversarial verification or multi-angle synthesis for trustworthy results.

## Script Structure

Every workflow script begins with a `meta` export (PURE LITERAL — no variables, function calls, spreads, or template interpolation), followed immediately by a **safe-parse guard on `args`** (MANDATORY — handles the case where the caller passes args as a JSON string):

```js
export const meta = {
  name: 'find-flaky-tests',           // required
  description: 'Find flaky tests',    // required, one-line
  phases: [                           // optional, must match phase() calls
    { title: 'Scan', detail: 'grep test logs for retries' },
    { title: 'Fix', detail: 'one agent per flaky test' },
  ],
}

// MANDATORY: safe-parse args before destructuring (handles object and JSON-string)
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { topic, items } = _args
```

## Coding Style

**CRITICAL: Use template literals for multiline strings — never concatenate with `+ "\n\n" +`.**

When building prompt strings for `agent()` calls, helper functions, or any multiline text, use backtick template literals. They are more readable, more compact, and avoid escaping issues.

```js
// ✅ RIGHT — template literals
const PROMPT = `You are a SECURITY reviewer. Analyze this code for vulnerabilities.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Affected files**: ${(finding.affected_files || []).join(", ")}

**Instructions**: Look at actual code behavior. Could this be handled elsewhere?`

// ✅ RIGHT — helper function with template literal
function reviewContext(fileList) {
  return `## Review Context
- Repo: ${repoPath}
- Target: ${normalizedPath}
- Files: ${fileList.length}

## Instructions
Review the code above. Be specific.`
}

// ❌ WRONG — string concatenation is noisy and error-prone
const PROMPT = "You are a SECURITY reviewer. Analyze this code for vulnerabilities.\n\n" +
  "**Finding**: " + finding.description + "\n" +
  "**Category**: " + finding.category + "\n" +
  "**Affected files**: " + (finding.affected_files || []).join(", ") + "\n\n" +
  "**Instructions**: Look at actual code behavior. Could this be handled elsewhere?"
```

**Benefits of template literals:**
- **Readability**: No `\n` escape sequences, no `+` operators breaking natural flow
- **Compact**: Fewer lines (template literals reduce line count ~30-40%)
- **Safety**: No forgotten `+` at line ends, no missing `\n` between sections
- **Performance**: Single string allocation instead of N intermediate concatenations

**Exception:** `log()` and simple one-liner strings that fit on one line may use whichever style is clearest. Template literals are mandatory for any string spanning 2+ lines or containing interpolated variables.

## API Reference

### agent(prompt, opts?) → Promise<string | object | null>

Spawn a subagent. Returns its final text as a string, or a validated object if `schema` is provided. Returns `null` if user skips the agent.

```js
// Text result
const result = await agent('Find all SQL injection vulnerabilities in src/')

// Structured result (validated against JSON Schema)
const bugs = await agent('Find bugs in auth code', {
  schema: { type: 'array', items: { type: 'object', properties: {
    file: { type: 'string' },
    severity: { enum: ['low', 'medium', 'high', 'critical'] }
  }}}
})

// With options
const findings = await agent('Review for XSS in templates', {
  label: 'xss-review',           // display label (optional)
  phase: 'Review',              // assign to phase group
  model: 'haiku',               // model override (omit unless confident)
  isolation: 'worktree',        // EXPENSIVE: only when parallel agents mutate files
  agentType: 'Explore',         // custom agent type from registry
})
```

**When to use schema:** Always for structured data you'll process in the script. The validation happens at tool-call layer so the model retries on mismatch — no manual parsing needed.

**isolation: 'worktree':** ~200-500ms setup + disk per agent. Use ONLY when agents mutate files in parallel and would conflict. Default to omitting it.

**model:** Default to omitting — the agent inherits the session model. Only set when highly confident a different tier fits.

### parallel(thunks) → Promise<any[]>

BARRIER — awaits ALL thunks before returning. A thunk that throws resolves to `null`.

```js
const results = await parallel([
  () => agent('Audit auth module', { schema: FINDINGS }),
  () => agent('Audit payment module', { schema: FINDINGS }),
  () => agent('Audit user module', { schema: FINDINGS }),
])
const allFindings = results.filter(Boolean).flat()
```

**USE parallel ONLY when you genuinely need ALL results together before proceeding.** Common legitimate cases:
- Dedup/merge across the full result set before expensive downstream work
- Early-exit if total count is zero ("0 bugs → skip verification")
- Stage N's prompt references "the other findings" for comparison

### pipeline(items, stage1, stage2, ...) → Promise<any[]>

Each item flows through all stages INDEPENDENTLY. NO barrier between stages. Item A can be in stage 3 while item B is still in stage 1. Wall-clock = slowest single-item chain.

```js
const results = await pipeline(
  DIMENSIONS,
  // Stage 1: review
  d => agent(d.prompt, { phase: 'Review', schema: FINDINGS }),
  // Stage 2: verify each finding (runs as soon as stage 1 finishes per item)
  review => parallel(review.findings.map(f => () =>
    agent(`Verify: ${f.title}`, { phase: 'Verify', schema: VERDICT })
      .then(v => ({ ...f, verdict: v }))
  ))
)
```

**DEFAULT TO pipeline().** Only use parallel() when you genuinely need cross-item context.

**Stage callback signature:** `(prevResult, originalItem, index) => ...` — use `originalItem`/`index` to label work without threading context through prior stages.

### phase(title)

Start a new phase group. Subsequent `agent()` calls appear under this title in the progress display.

```js
phase('Audit')
const findings = await parallel(AUDITORS.map(a => () => agent(a.prompt)))
phase('Verify')
const verified = await parallel(findings.map(f => () => agent(verifyPrompt(f))))
```

### log(message)

Emit a progress message visible in the progress tree.

```js
log(`Found ${bugs.length} bugs, starting verification...`)
```

### args

The value passed as Workflow's `args` input, verbatim. `undefined` if not provided. Pass arrays/objects as actual JSON values, NOT as JSON-encoded strings — a stringified list breaks `.filter`/`.map`.

**⚠️ MANDATORY: Always use safe-parse at the top of every workflow script.** Claude (or another skill) may pass `args` as a JSON string instead of an object. Destructuring a string will crash the script with a TypeError. The one-liner guard handles both cases:

```js
// ALWAYS put this before destructuring args — never destructure `args` directly
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { topic, scopes, language } = _args
```

Without this guard, `const { topic } = '{"topic":"auth"}'` throws `TypeError: Cannot destructure property 'topic' of string`.

```js
// Invocation: workflow with args: ["src/auth", "src/payment"]
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const targets = _args  // ["src/auth", "src/payment"] — real array
targets.map(t => agent(`Audit ${t}`))
```

### budget

Token target from the user's "+500k"-style directive. Use to scale dynamically.

```js
budget.total       // number | null — null if no target set
budget.spent()     // output tokens spent this turn (shared across main loop + workflows)
budget.remaining() // max(0, total - spent()), or Infinity if no target
```

```js
// Loop-until-budget: scale depth to user's token directive
const bugs = []
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find bugs', { schema: BUGS })
  bugs.push(...result.bugs)
  log(`${bugs.length} found, ${Math.round(budget.remaining()/1000)}k remaining`)
}
```

**Guard on budget.total:** without a target, `remaining()` is `Infinity` and a `while(budget.remaining())` loop runs to the 1000-agent cap.

### workflow(nameOrRef, args?) → Promise<any>

Run another workflow inline as a sub-step. One level of nesting only.

```js
// By name (saved workflow from .claude/workflows/ or ~/.claude/workflows/)
const result = await workflow('triage-issues', [1024, 1025])

// By script path
const result = await workflow({ scriptPath: '.claude/workflows/audit.js' })
```

The child shares the parent's concurrency cap, abort signal, and token budget. Its agents appear under a "▸ name" group in `/workflows`.

## Pipeline vs Parallel: The Critical Distinction

**Default to pipeline().** It's almost always the right choice.

**A barrier (parallel) is correct ONLY when stage N needs cross-item context from ALL of stage N-1:**

| Legitimate barrier | Not a legitimate barrier |
|---|---|
| Dedup across full result set before expensive work | "I need to flatten/map/filter first" |
| Early-exit if total count is zero | "The stages are conceptually separate" |
| Stage N references "the other findings" | "It's cleaner code" |

**Smell test:** If you wrote:
```js
const a = await parallel(...)
const b = transform(a)        // flatten, map, filter — no cross-item dependency
const c = await parallel(b.map(...))
```
That middle `transform` doesn't need the barrier. Rewrite as pipeline with the transform inside a stage.

## Constraints and Limits

| Constraint | Detail |
|---|---|
| Concurrent agents | ≤16 (fewer on limited-CPU machines) |
| Total agents per run | ≤1,000 (runaway-loop backstop) |
| No filesystem access | Scripts can't use Node.js APIs, fs, or shell |
| No Date.now() / Math.random() | Would break resume; pass timestamps via `args`, vary agent prompt/label by index |
| No mid-run user input | Only agent permission prompts can pause. For sign-off between stages, run separate workflows |
| Standard JS only | No TypeScript annotations. `await`, `JSON`, `Math` (except random), `Array` available |

## Agent Capabilities: Skills & MCP

Các agent được spawn trong workflow có thể sử dụng skills và MCP tools — nhưng cơ chế khác với phiên chính.

### Skills trong Workflow Agents

Có **hai cơ chế độc lập** để agent trong workflow sử dụng skill:

**1. `skills` trong frontmatter của agent definition — Preload tĩnh:**

Khi bạn dùng `agentType: 'phase-hld-specialist'`, agent đó chạy với định nghĩa trong `.claude/agents/phase-hld-specialist.md`. Nếu file đó khai báo:

```yaml
skills: sequential-thinking, problem-solving
```

Thì toàn bộ nội dung `SKILL.md` của các skill đó được **inject thẳng vào system prompt** của agent khi khởi tạo. Agent có thể tham chiếu trực tiếp đến skill content. **Không cần `Skill` tool, không cần gọi invoke.**

**2. `Skill` tool — Gọi động tại runtime:**

Nếu agent definition có `Skill` trong `tools` list:
```yaml
tools: Read, Write, Edit, Bash, Skill, Agent
```

Thì agent có thể gọi `Skill(sequential-thinking)` như một function call để load và thực thi skill đó — giống hệt cách phiên chính gọi `/sequential-thinking`.

**3. Workflow agent KHÔNG kế thừa skill từ phiên chính:**

Skills đã load trong main session không tự động có trong workflow agent. Mỗi agent cần được cấu hình riêng qua `skills` field hoặc `Skill` tool.

**Quyết định nhanh:**

| Tình huống | Dùng |
|-----------|------|
| Skill nền tảng, luôn cần | `skills: skill-name` trong frontmatter |
| Skill tùy chọn, dùng có điều kiện | `Skill` trong `tools` + gọi `Skill(name)` |
| Tiết kiệm token | `Skill` tool (chỉ tốn token khi invoke) |
| Hiệu năng (tránh round-trip) | `skills` field (có sẵn ngay) |

### MCP Tools trong Workflow Agents

Tất cả MCP servers đã kết nối trong phiên đều **tự động khả dụng** cho workflow agents. Schema được load on-demand qua ToolSearch — không tốn context window cho đến khi cần.

**Lưu ý:** MCP servers yêu cầu xác thực tương tác (ví dụ: `claude.ai`) có thể không khả dụng trong headless/cron runs.

### Nested Subagents (Agent Tool)

Workflow agent có `Agent` trong `tools` có thể spawn nested subagents. Xem `Agent Tool` trong subagent-creator's configuration-reference.md để biết depth limits (foreground: không giới hạn, background: tối đa độ sâu 4).

## Quality Patterns Quick Reference

Quick decision guide. Full code examples for all 7 patterns in `references/quality-patterns.md` — adversarial verify, perspective-diverse verify, judge panel, loop-until-dry, multi-modal sweep, completeness critic, idempotent phase skip, plus parallel-step and sequential-chain patterns.

| Pattern | When | How |
|---|---|---|
| **Adversarial verify** | Findings must survive skepticism | 3 independent agents try to REFUTE each finding. Kill if ≥majority refute |
| **Perspective-diverse verify** | Finding can fail in multiple ways | Each verifier gets a distinct lens: correctness, security, perf, repro |
| **Judge panel** | Wide solution space | N independent attempts from different angles, scored by judges, synthesize best |
| **Loop-until-dry** | Unknown-size discovery | Keep spawning finders until K consecutive rounds return nothing new |
| **Multi-modal sweep** | One search angle won't find everything | Parallel agents search by-container, by-content, by-entity, by-time |
| **Completeness critic** | Ensure nothing missed | Final agent asks "what's missing?" — its findings become next round |
| **Idempotent phase skip** | Re-run workflow after partial failure | One agent checks all phase outputs upfront; skip phases with valid output, re-run only failed ones |

## Canonical Patterns

### review-changes: Pipeline with inline verification

```js
export const meta = {
  name: 'review-changes',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}
const DIMENSIONS = [
  { key: 'bugs', prompt: 'Find logic bugs, race conditions, edge cases' },
  { key: 'perf', prompt: 'Find performance issues and bottlenecks' },
]
const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { phase: 'Review', schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`Adversarially verify: ${f.title}`, { phase: 'Verify', schema: VERDICT })
      .then(v => ({ ...f, verdict: v }))
  ))
)
const confirmed = results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
```

### loop-until-count: Accumulate to target

```js
const bugs = []
while (bugs.length < 10) {
  const result = await agent('Find bugs in this codebase.', { schema: BUGS })
  bugs.push(...result.bugs)
  log(`${bugs.length}/10 found`)
}
```

### idempotent-phase-skip: Retry only failed phases

When a multi-phase workflow fails at phase N, re-running with the same args skips phases 1..N-1 (already complete) and re-runs only N onwards. One upfront Explore agent checks all phase output files. Key: one agent checks ALL phases (~1 agent overhead total), binary skip per phase, per-item granularity for service-level phases, special rules for code-generating and revision phases. Includes `--from-phase` variant for targeted force-skip.

Full code with `checkPhaseStatus()`, `runWithGate()`, per-phase skip logic, `--from-phase` integration, and all 7 design decisions in `references/quality-patterns.md#idempotent-phase-skip`.

### exhaustive-review: Find → Dedup → Diverse-lens → Loop-until-dry

Full code in `references/quality-patterns.md#loop-until-dry`. Pattern: track ALL evaluated findings in a `seen` set (NOT just confirmed), run diverse-lens verification per finding, stop after K consecutive dry rounds. **Critical:** dedup against `seen`, not `confirmed` — otherwise rejected findings reappear every round and the loop never converges.

## Anti-Patterns

See `references/anti-patterns.md` for 11 anti-patterns with WRONG/RIGHT code pairs and severity labels (critical → advisory). Quick check before writing any script.

Top offenders: barrier-when-pipeline-would-do, no budget.total guard on while loops, dedup against confirmed instead of seen, stringified args, isolation worktree for read-only agents, re-running entire workflow when only one phase failed, silent truncation, Date.now/Math.random usage, TypeScript annotations, computed meta values, nested workflow deeper than 1 level.

## Prompt Patterns

See `references/prompt-patterns.md` for how users describe workflow structures in natural language, and how Claude translates those into scripts. Covers: explicit step-by-step with parallel agents, sequential dependencies, mixed parallel+sequential, short-form inference, current-branch vs worktree configuration, prompt crafting templates, and save/iterate workflow.

## Saving and Reusing

After a successful run, press `s` in `/workflows` to save:
- `.claude/workflows/` — project-shared (committed to repo)
- `~/.claude/workflows/` — personal, available in all projects

Saved workflows become slash commands (`/<name>`) with autocomplete.

**Passing input:** `args` global receives structured data from the invocation prompt.

```text
> Run /triage-issues on issues 1024, 1025, and 1030
```
→ `args` = `[1024, 1025, 1030]` in the script.

## Approve the Plan Before It Runs

Before a workflow launches, the user sees planned phases and approves. How this works depends on permission mode:

| Permission mode | Prompt behavior |
|---|---|
| Default, Accept Edits | Prompted every run. Option: "don't ask again for this workflow in this project" |
| Auto | Prompted on first launch only. Later launches skip prompt. Skipped entirely when ultracode is on |
| Bypass, `claude -p`, Agent SDK | Never prompted — starts immediately |

The approval prompt only controls launch. Subagents spawned by the workflow always run in `acceptEdits` mode with the user's tool allowlist. Shell commands, web fetches, or MCP tools not in the allowlist can still prompt mid-run — pre-allow needed commands before starting a long run.

## Manage Runs

Run `/workflows` to list, drill into, and control runs.

| Key | Action |
|---|---|
| `↑`/`↓` | Select phase or agent |
| `Enter` / `→` | Drill into selected phase/agent to read prompt, tool calls, result |
| `Esc` | Back out one level |
| `j`/`k` | Scroll within agent detail |
| `p` | Pause or resume the run |
| `x` | Stop selected agent, or stop whole workflow when focus is on the run |
| `r` | Restart the selected running agent |
| `s` | Save the run's script as a command |

**Resume:** Within same session, paused runs resume: completed agents return cached results instantly, rest run live. Exiting Claude Code during a run → next session starts fresh.

**Cost:** Each agent uses the session model. Check `/model` before large runs. Gauge spend on a small slice first (one directory, narrow question). The `/workflows` view shows per-agent token usage as the run progresses.

## Bundled Workflows

Claude Code ships with `/deep-research`: fans out web searches on a question across several angles, fetches and cross-checks sources, votes on each claim, returns cited report with unverified claims filtered out.

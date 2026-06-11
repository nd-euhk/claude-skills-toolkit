# Workflow Anti-Patterns — Common Mistakes and Fixes

Severity: 🔴 Critical (breaks correctness) | 🟠 High (wastes tokens/slowness) | 🟡 Advisory (best practice)

## 1. Barrier when pipeline would do 🟠 High

**WRONG:**
```js
const a = await parallel([
  () => agent('Review auth', { schema: FINDINGS }),
  () => agent('Review api', { schema: FINDINGS }),
])
const flat = a.filter(Boolean).flatMap(r => r.findings)  // no cross-item dependency
const verified = await parallel(flat.map(f => () => agent(`Verify: ${f.title}`)))
```

**RIGHT:** Use pipeline — auth findings start verifying while api is still reviewing:
```js
const results = await pipeline(
  ['auth', 'api'],
  module => agent(`Review ${module}`, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () => agent(`Verify: ${f.title}`)))
)
```

## 2. No budget.total guard on while loops 🔴 Critical

**WRONG:** Without a target set, remaining() is Infinity — runs to 1000-agent cap:
```js
while (budget.remaining() > 50_000) {
  const result = await agent('Find bugs')
  bugs.push(...result.bugs)
}
```

**RIGHT:** Guard on budget.total:
```js
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find bugs')
  bugs.push(...result.bugs)
}
```

## 3. Dedup against confirmed instead of seen 🔴 Critical

**WRONG:** Judge-rejected findings reappear every round, never converging:
```js
const confirmed = []
while (dry < 2) {
  const fresh = found.filter(b => !confirmed.some(c => key(c) === key(b)))
  // ...
}
```

**RIGHT:** Track all evaluated findings in a separate `seen` set:
```js
const seen = new Set()
const confirmed = []
while (dry < 2) {
  const fresh = found.filter(b => !seen.has(key(b)))
  // ...
  fresh.forEach(b => seen.add(key(b)))
  // Only confirmed go to confirmed[]
}
```

## 4. Destructuring args without safe-parse guard 🔴 Critical

**WRONG:** Claude (or the calling skill) may pass `args` as a JSON string instead of an object. Destructuring a string crashes the script:
```js
// If args = '{"topic":"auth","scopes":[...]}' (JSON string from skill invocation)
const { topic, scopes } = args
// TypeError: Cannot destructure property 'topic' of string
```

**RIGHT:** ALWAYS safe-parse args before destructuring. One-liner at the top of every workflow script:
```js
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { topic, scopes } = _args
```

**Why this happens:** Skills invoke workflows via `Workflow({ args: workflowArgs })`. Claude may serialize `workflowArgs` as a JSON string when passing it to the Workflow tool, especially when coming from a Skill() call chain (skill → Claude → Workflow tool). The workflow script receives `args` verbatim — if it's a string, destructuring fails. The guard handles both `object` and `string` forms transparently.

**This applies to ALL forms of args, not just arrays:**
```js
// WRONG — all of these crash if args is a JSON string:
const targets = args.map(t => ...)           // args is string → .map crashes
const { topic } = args                        // args is string → destructure crashes
const { scopes } = args                       // same

// RIGHT — safe-parse first:
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { topic, scopes } = _args
const targets = _args.targets || []
```

## 5. isolation: 'worktree' for read-only agents 🟠 High

**WRONG:** ~200-500ms setup + disk wasted on agents that only read:
```js
const findings = await agent('Find bugs in src/', { isolation: 'worktree' })
```

**RIGHT:** Only use worktree when agents mutate files in parallel:
```js
// Read-only — no isolation needed
const findings = await agent('Find bugs in src/')

// Mutating files in parallel — isolation prevents conflicts
await parallel(FIXES.map(f => () =>
  agent(`Apply fix: ${f.description}`, { isolation: 'worktree' })
))
```

## 6. Silent truncation 🟡 Advisory

**WRONG:** Bounding coverage without telling the user what was dropped:
```js
const top10 = findings.slice(0, 10)
// ... user thinks everything was covered
```

**RIGHT:** Log what was excluded:
```js
const topN = findings.slice(0, 10)
if (findings.length > 10) {
  log(`⚠️ Only verifying top 10 of ${findings.length} findings. Skipped: ${findings.slice(10).map(f => f.file).join(', ')}`)
}
```

## 7. Using Date.now() or Math.random() 🔴 Critical

**WRONG:** Would break resume (deterministic replay requirement):
```js
const id = Date.now()
const shuffle = Math.random() > 0.5
```

**RIGHT:** Pass timestamps via `args`, vary by agent label/index:
```js
// Pass timestamp as args
const runId = args?.timestamp || 'unknown'

// Vary by index instead of random
const shuffled = items.map((item, i) => ({ item, order: i % 3 }))
```

## 8. TypeScript annotations in script 🔴 Critical

**WRONG:** Scripts are plain JavaScript — type annotations fail to parse:
```js
const results: Finding[] = await agent('Find bugs', { schema: FINDINGS })
interface Finding { file: string }
```

**RIGHT:** Use plain JavaScript only:
```js
const results = await agent('Find bugs', { schema: FINDINGS })
// Schema validation handles the shape, not TypeScript
```

## 9. Computed values in meta object 🟠 High

**WRONG:** meta must be a PURE LITERAL — no variables, function calls, spreads:
```js
const name = 'my-workflow'
export const meta = {
  name,                          // variable reference
  phases: buildPhaseList(),      // function call
}
```

**RIGHT:** Write meta as a literal:
```js
export const meta = {
  name: 'my-workflow',
  description: 'Does the thing',
  phases: [
    { title: 'Scan', detail: 'Find issues' },
  ],
}
```

## 11. Re-running entire workflow when only one phase failed 🟠 High

**WRONG:** After a gate failure at phase 3, re-run from phase 1 — wastes tokens on already-complete work:
```js
// Gate rejected HLD. Instead of targeted retry, restart everything:
const result = await workflow('sdlc-task-pipeline', {
  taskId: 'TASK-001',
  taskTitle: 'User Auth',
  // ... same args, but SRS re-runs needlessly
})
// SRS ran again (wasted ~5k tokens), now HLD runs, may fail again
```

**RIGHT:** Use idempotent phase skip — re-invoke with same args, workflow auto-detects completed phases:
```js
// Same args, but workflow's checkPhaseStatus() detects SRS output exists → skips
const result = await workflow('sdlc-task-pipeline', {
  taskId: 'TASK-001',
  taskTitle: 'User Auth',
  // ... same args — SRS auto-skipped, HLD runs fresh
})
// result.skipped = ['SRS'], result.ran = ['HLD', 'LLD', 'IMP', 'TST']
// SRS: 0 tokens. Only HLD onwards consumes tokens.
```

**Even faster — --from-phase for targeted retry:**
```js
const result = await workflow('sdlc-task-pipeline', {
  taskId: 'TASK-001',
  taskTitle: 'User Auth',
  fromPhase: 'HLD',  // force-skip SRS, force-run HLD
  // ... other args
})
// No checkPhaseStatus() agent overhead for skipped phases
```

**Why it matters:** Multi-phase SDLC pipelines (SRS→HLD→LLD→IMP→TST) can cost 20-50k tokens per phase. Re-running all 5 phases when only phase 3 failed wastes 40-100k tokens. Idempotent skip drops that to ~0 tokens for already-complete phases.

## 10. Nested workflow() calls deeper than 1 level 🟡 Advisory

**WRONG:** workflow() inside a child workflow throws:
```js
// In parent workflow
const result = await workflow('child-workflow')
// In child-workflow script:
const grandchild = await workflow('grandchild')  // throws!
```

**RIGHT:** Nesting is one level only. Flatten or run sequentially:
```js
// Run sequentially in parent
const child1 = await workflow('step-1')
const child2 = await workflow('step-2')  // OK — same level, not nested
```

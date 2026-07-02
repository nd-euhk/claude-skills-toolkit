# Workflow Prompt Patterns & Configuration

## How Users Describe Workflows to Claude

When a user asks for a workflow, they describe the structure in natural language. Claude translates this into the workflow script. Recognize these patterns in user prompts:

### Pattern 1: Explicit Step-by-Step with Parallel Agents

User prompt:
```
ultracode: compare Select, Input, Table, Form, Dialog components between project A and B
- Step 1: Analyze both projects in parallel
- Step 2: Compare each component in parallel (5 agents)
- Step 3: Generate report with patterns and recommendations
```

Claude writes:
```js
export const meta = {
  name: 'compare-components',
  description: 'Compare component usage between two projects',
  phases: [
    { title: 'Analyze', detail: 'Analyze both projects' },
    { title: 'Compare', detail: 'Compare each component' },
    { title: 'Report', detail: 'Generate report' },
  ],
}
phase('Analyze')
const [projA, projB] = await parallel([
  () => agent('Analyze Select, Input, Table, Form, Dialog in project A'),
  () => agent('Analyze Select, Input, Table, Form, Dialog in project B'),
])
phase('Compare')
const comparisons = await parallel([
  () => agent(`Compare Select: ${projA} vs ${projB}`),
  () => agent(`Compare Input: ${projA} vs ${projB}`),
  () => agent(`Compare Table: ${projA} vs ${projB}`),
  () => agent(`Compare Form: ${projA} vs ${projB}`),
  () => agent(`Compare Dialog: ${projA} vs ${projB}`),
])
phase('Report')
return agent(`Synthesize report: ${comparisons.filter(Boolean).join('\n---\n')}`)
```

### Pattern 2: Sequential Dependencies

User prompt:
```
ultracode: analyze then compare then recommend
- First analyze the codebase
- Then compare findings against best practices
- Finally generate recommendations
```

Claude writes sequential agents:
```js
const analysis = await agent('Analyze codebase patterns')
const comparison = await agent(`Compare against best practices: ${analysis}`)
return agent(`Generate recommendations: ${comparison}`)
```

### Pattern 3: Mixed Parallel + Sequential

User prompt:
```
ultracode: audit security with parallel scanners then synthesize
- Run SQL injection, XSS, and auth scanners in parallel
- Synthesize into single report with prioritized fixes
```

Claude writes:
```js
const [sqlInjection, xss, auth] = await parallel([
  () => agent('Scan for SQL injection vulnerabilities', { schema: FINDINGS }),
  () => agent('Scan for XSS vulnerabilities', { schema: FINDINGS }),
  () => agent('Scan for auth/authz issues', { schema: FINDINGS }),
])
return agent(`Synthesize findings and prioritize fixes:
SQL Injection: ${JSON.stringify(sqlInjection)}
XSS: ${JSON.stringify(xss)}
Auth: ${JSON.stringify(auth)}`)
```

### Pattern 4: Short Form (Claude Infers Structure)

User prompt:
```
ultracode: audit every API endpoint under src/routes/ for missing auth checks
```

Claude infers the structure — no explicit step breakdown needed. Claude decides: parallel scan by route file → verify findings → report.

## Working on Current Branch vs Worktree

By default, workflow agents may use isolated worktrees. To work on the current branch:

**In the prompt:**
```
ultracode: create workflow on current branch (no new worktree)
```

**In the script:** (not a real option — isolation is per-agent, controlled by the `isolation` param)
```js
// isolation: 'worktree' creates a temp worktree — omit for current branch
const result = await agent('Fix lint errors in src/')  // works on current branch
```

**Global config:** User can disable worktree creation in `/config` → Workflows → "Create worktrees for workflows".

**Trade-off:** Current branch = direct file changes, possible conflicts if parallel agents touch same files. Worktree = isolated, safe, but ~200-500ms overhead per agent.

## Prompt Crafting Tips for Users

When helping users craft workflow prompts, guide them toward:

1. **Be explicit about parallelism:** "Run N agents in parallel" / "Process all files simultaneously"
2. **Name the phases:** "Step 1: X, Step 2: Y, Step 3: Z"
3. **Specify agent count for fan-out:** "5 agents, one per component"
4. **Describe dependencies:** "After step 1 completes, step 2 uses those results"
5. **Mention output format:** "Return a markdown report" / "Return structured JSON"

### Prompt Template (Short)

```
ultracode: <task description>
- Step 1: <parallel/serial> — <what agents do>
- Step 2: <parallel/serial> — <what agents do>
- Step 3: <synthesis/report>
```

### Prompt Template (Detailed)

```
ultracode: create workflow to <task>

Step 1: <name> (parallel/serial)
- Agent 1: <specific instruction>
- Agent 2: <specific instruction>

Step 2: <name> (parallel/serial)
- Agent 1: <specific instruction using step 1 results>
- Agent 2: <specific instruction using step 1 results>

Step 3: <name>
- Agent 1: <synthesis instruction>
```

## Saving and Iterating

After a workflow runs successfully:
- Press `s` in `/workflows` to save as a command
- The script file is at the path Claude receives when the run starts
- Edit the `.js` file to tweak prompts, add phases, or adjust parallelism
- Re-run with `/<workflow-name>` or by re-invoking the edited script

```text
/workflows          # list runs
s                   # save selected run
# Choose: .claude/workflows/ (project) or ~/.claude/workflows/ (personal)
```

Saved workflows appear in `/` autocomplete alongside built-in commands.

## More Workflow Samples

### Sample 1: Codebase-Wide Migration

User prompt:
```
ultracode: migrate all import paths from relative to alias (@/foo) across src/
- Scan all files with relative imports
- Apply migration to each file in parallel
- Verify no broken imports remain
```

```js
export const meta = {
  name: 'migrate-imports',
  description: 'Migrate relative imports to alias paths',
  phases: [
    { title: 'Scan', detail: 'Find all files with relative imports' },
    { title: 'Migrate', detail: 'Apply migration per file' },
    { title: 'Verify', detail: 'Check for broken imports' },
  ],
}
phase('Scan')
const files = await agent(
  'List every TypeScript file under src/ that has relative imports (starting with ./ or ../)',
  { schema: { type: 'array', items: { type: 'object', properties: {
    file: { type: 'string' },
    imports: { type: 'array', items: { type: 'string' } }
  }}}}
)
log(`Found ${files.length} files with relative imports`)

phase('Migrate')
const results = await pipeline(
  files,
  f => agent(
    `In file ${f.file}, rewrite these relative imports to @/ alias paths.
    Current imports: ${f.imports.join(', ')}
    Use the project's tsconfig paths to resolve aliases.`,
    { isolation: 'worktree' }
  )
)
const changed = results.filter(Boolean)
log(`Migrated ${changed.length}/${results.length} files`)

phase('Verify')
const broken = await agent(
  `Check these migrated files for broken imports or missing aliases:
  ${changed.map(c => c.file).join('\n')}`,
  { schema: { type: 'array', items: { type: 'string' } } }
)
if (broken.length) {
  log(`⚠️ ${broken.length} files may have broken imports: ${broken.join(', ')}`)
} else {
  log('✅ All imports verified')
}
```

### Sample 2: Multi-Dimension PR Review

User prompt:
```
ultracode: review this PR across bugs, security, performance, and conventions
- Run all 4 dimension reviewers in parallel
- Each finding is adversarially verified
- Synthesize final review with confirmed issues only
```

```js
export const meta = {
  name: 'pr-review',
  description: 'Multi-dimension PR review with adversarial verification',
  phases: [
    { title: 'Review', detail: '4-dimension parallel review' },
    { title: 'Verify', detail: 'Adversarial verification per finding' },
    { title: 'Report', detail: 'Synthesize confirmed findings' },
  ],
}
const DIMENSIONS = [
  { key: 'bugs', prompt: 'Find logic bugs, race conditions, null derefs, edge cases' },
  { key: 'security', prompt: 'Find OWASP Top 10 issues, injection, auth bypass, data exposure' },
  { key: 'performance', prompt: 'Find N+1 queries, missing indexes, unbounded loops, memory leaks' },
  { key: 'conventions', prompt: 'Find naming violations, missing error handling, pattern deviations' },
]
const results = await pipeline(
  DIMENSIONS,
  d => agent(`Review the PR diff for ${d.prompt}`, {
    label: `review-${d.key}`,
    phase: 'Review',
    schema: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' },
      file: { type: 'string' },
      severity: { enum: ['low', 'medium', 'high', 'critical'] },
      evidence: { type: 'string' },
    }}}
  }),
  review => parallel((review || []).map(f => () =>
    agent(`Adversarially verify this finding. Try to prove it's NOT a real issue.
      Title: ${f.title}
      File: ${f.file}
      Evidence: ${f.evidence}
      Default to isReal=false if uncertain.`, {
      label: `verify-${f.title.slice(0, 30)}`,
      phase: 'Verify',
      schema: { type: 'object', properties: {
        isReal: { type: 'boolean' },
        reasoning: { type: 'string' },
      }}
    }).then(v => ({ ...f, verified: v?.isReal, reasoning: v?.reasoning }))
  ))
)
const confirmed = results.flat().filter(Boolean).filter(f => f.verified)
log(`Found ${confirmed.length} confirmed issues across ${DIMENSIONS.length} dimensions`)

phase('Report')
return agent(`Synthesize PR review report from confirmed findings:
${JSON.stringify(confirmed)}
Group by severity (critical → low), include file paths and fix suggestions.`)
```

### Sample 3: Test Gap Analysis

User prompt:
```
ultracode: find untested code paths in src/
- Map all source files to their test files
- Find functions without test coverage
- Generate prioritized list of gaps
```

```js
export const meta = {
  name: 'test-gaps',
  description: 'Find untested code paths',
  phases: [
    { title: 'Map', detail: 'Map source to test files' },
    { title: 'Analyze', detail: 'Find untested functions' },
    { title: 'Prioritize', detail: 'Rank gaps by risk' },
  ],
}
phase('Map')
const mapping = await agent(
  'Map every source file under src/ to its corresponding test file(s). Return pairs.',
  { schema: { type: 'array', items: { type: 'object', properties: {
    source: { type: 'string' },
    tests: { type: 'array', items: { type: 'string' } },
  }}}}
)
const untested = mapping.filter(m => !m.tests.length)
const partial = mapping.filter(m => m.tests.length > 0)

phase('Analyze')
const gaps = await parallel([
  () => agent(
    `For these files with NO tests, list every exported function/class:
    ${untested.map(m => m.source).join('\n')}`,
    { label: 'no-tests', schema: GAPS_SCHEMA }
  ),
  () => agent(
    `For these files with tests, find functions missing coverage:
    ${JSON.stringify(partial)}`,
    { label: 'partial-coverage', schema: GAPS_SCHEMA }
  ),
])
const allGaps = gaps.filter(Boolean).flatMap(g => g.items)

phase('Prioritize')
return agent(
  `Rank these test gaps by risk (critical business logic, auth, data mutation = highest):
  ${JSON.stringify(allGaps)}
  Return prioritized list with recommended test types (unit/integration/e2e).`,
  { schema: PRIORITY_SCHEMA }
)
```

### Sample 4: Config Drift Detection (Multi-Project)

User prompt:
```
ultracode: compare ESLint, TSConfig, and package.json across 5 microservices
- Scan all configs in parallel
- Compare each config type across services
- Flag inconsistencies with recommendations
```

```js
export const meta = {
  name: 'config-drift',
  description: 'Detect configuration drift across microservices',
  phases: [
    { title: 'Scan', detail: 'Collect configs from all services' },
    { title: 'Compare', detail: 'Find inconsistencies per config type' },
    { title: 'Report', detail: 'Flag drifts with recommendations' },
  ],
}
const SERVICES = ['svc-auth', 'svc-payment', 'svc-user', 'svc-notify', 'svc-gateway']

phase('Scan')
const configs = await parallel(
  SERVICES.map(svc => () => agent(
    `Read these configs from ${svc}/:
    - package.json (dependencies, scripts, engines)
    - tsconfig.json (compilerOptions, paths, strict)
    - .eslintrc or eslint.config (rules, plugins, extends)
    Return structured config data.`,
    { label: `scan-${svc}`, schema: CONFIG_SCHEMA }
  ))
)

phase('Compare')
const drifts = await parallel([
  () => agent(
    `Compare ESLint rules across all services. Flag any service that differs from the majority.
    Configs: ${JSON.stringify(configs.filter(Boolean))}`,
    { label: 'eslint-drift', schema: DRIFT_SCHEMA }
  ),
  () => agent(
    `Compare TypeScript compilerOptions across all services. Flag inconsistencies in strictness, target, paths.
    Configs: ${JSON.stringify(configs.filter(Boolean))}`,
    { label: 'tsconfig-drift', schema: DRIFT_SCHEMA }
  ),
  () => agent(
    `Compare package.json across all services. Flag version mismatches in shared dependencies.
    Configs: ${JSON.stringify(configs.filter(Boolean))}`,
    { label: 'deps-drift', schema: DRIFT_SCHEMA }
  ),
])
const allDrifts = drifts.filter(Boolean).flatMap(d => d.items)
log(`Found ${allDrifts.length} configuration drifts across ${SERVICES.length} services`)

phase('Report')
return agent(
  `Generate config drift report. Group by config type, then by severity (critical version mismatch → minor rule difference).
  Drifts: ${JSON.stringify(allDrifts)}
  For each drift, recommend: align to majority, or if the outlier is intentionally different, document why.`
)
```

### Sample 5: Multi-Angle Design (Judge Panel Variant)

User prompt:
```
ultracode: design an API rate limiter from 3 angles (simplicity, performance, flexibility), judge each, pick best
```

```js
export const meta = {
  name: 'design-rate-limiter',
  description: 'Multi-angle API rate limiter design with judge panel',
  phases: [
    { title: 'Design', detail: '3 independent designs from different angles' },
    { title: 'Judge', detail: 'Score each design' },
    { title: 'Synthesize', detail: 'Pick winner, graft runner-up ideas' },
  ],
}
const ANGLES = [
  { name: 'simplicity', prompt: 'Design the SIMPLEST possible rate limiter. Fewest components, easiest to debug, minimal dependencies. Prefer token bucket over sliding window if simpler.' },
  { name: 'performance', prompt: 'Design the FASTEST rate limiter. Optimize for throughput (100k+ req/s), minimal latency overhead. Consider Redis Lua scripts, local counters with async sync.' },
  { name: 'flexibility', prompt: 'Design the most FLEXIBLE rate limiter. Support per-user, per-IP, per-endpoint limits. Tiered limits, burst allowance, custom quota plugins.' },
]
phase('Design')
const designs = await parallel(
  ANGLES.map(a => () => agent(a.prompt, {
    label: `design-${a.name}`,
    schema: { type: 'object', properties: {
      approach: { type: 'string' },
      architecture: { type: 'string' },
      dataModel: { type: 'string' },
      tradeoffs: { type: 'string' },
      pseudocode: { type: 'string' },
    }}
  }))
)

phase('Judge')
const scored = await parallel(
  designs.filter(Boolean).map((d, i) => () =>
    agent(`Score this rate limiter design on 3 axes (1-10 each):
    - Correctness: Does it correctly enforce limits without race conditions?
    - Feasibility: Can it be built with standard tools (Redis, in-memory)?
    - Simplicity: Is it understandable and maintainable?

    Design: ${JSON.stringify(d)}
    Angle: ${ANGLES[i].name}`, {
      label: `judge-${ANGLES[i].name}`,
      schema: { type: 'object', properties: {
        correctness: { type: 'number' },
        feasibility: { type: 'number' },
        simplicity: { type: 'number' },
        total: { type: 'number' },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
      }}
    }).then(s => ({ design: d, angle: ANGLES[i].name, score: s }))
  )
)

phase('Synthesize')
const best = scored.filter(Boolean).sort((a, b) => b.score.total - a.score.total)[0]
const runners = scored.filter(Boolean).filter(s => s !== best)
return agent(
  `Winner (${best.angle}): ${JSON.stringify(best.design)}
  Runner-up strengths to graft: ${JSON.stringify(runners.map(r => ({ angle: r.angle, strengths: r.score.strengths })))}
  Produce final design incorporating the best ideas from all angles.`
)
```

### Sample 6: Simple Fan-Out / Fan-In

User prompt:
```
ultracode: check all 12 microservices for outdated dependencies
- Fan out: check each service in parallel
- Fan in: merge results into single report
```

```js
export const meta = {
  name: 'dep-check',
  description: 'Check all microservices for outdated dependencies',
  phases: [
    { title: 'Check', detail: 'Check each service in parallel' },
    { title: 'Merge', detail: 'Merge into single report' },
  ],
}
const services = ['auth', 'payment', 'user', 'notify', 'gateway', 'admin',
  'search', 'analytics', 'billing', 'audit', 'scheduler', 'webhook']

phase('Check')
const results = await parallel(
  services.map(svc => () => agent(
    `Check ${svc}/package.json for outdated or deprecated dependencies.
    Flag: major version behind, deprecated packages, security advisories.`,
    { label: `check-${svc}`, schema: { type: 'object', properties: {
      service: { type: 'string' },
      outdated: { type: 'array', items: { type: 'object', properties: {
        package: { type: 'string' },
        current: { type: 'string' },
        latest: { type: 'string' },
        severity: { enum: ['patch', 'minor', 'major', 'security'] },
      }}}
    }}}
  ))
)

phase('Merge')
const allOutdated = results.filter(Boolean).flatMap(r => r.outdated)
const critical = allOutdated.filter(d => d.severity === 'security' || d.severity === 'major')
log(`${allOutdated.length} outdated deps (${critical.length} critical) across ${services.length} services`)
return agent(
  `Generate dependency health report:
  Critical (security/major): ${JSON.stringify(critical)}
  All outdated: ${JSON.stringify(allOutdated)}
  Group by severity, then by package (show which services are affected).`
)
```


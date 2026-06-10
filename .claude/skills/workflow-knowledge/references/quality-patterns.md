# Quality Patterns — Detailed Examples

## Adversarial Verify

Spawn N independent skeptics per finding, each prompted to REFUTE. Kill if ≥majority refute. Prevents plausible-but-wrong findings.

```js
const votes = await parallel(
  Array.from({ length: 3 }, (_, i) => () =>
    agent(
      `Try to refute this claim. Default to refuted=true if uncertain.
      Claim: ${claim.title}
      File: ${claim.file}:${claim.line}
      Evidence: ${claim.evidence}`,
      { label: `refute-${i + 1}`, phase: 'Verify', schema: {
        type: 'object',
        properties: {
          refuted: { type: 'boolean', description: 'true if claim is false or unsupported' },
          reasoning: { type: 'string' }
        },
        required: ['refuted', 'reasoning']
      }}
    )
  )
)
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```

## Perspective-Diverse Verify

When a finding can fail in more than one way, give each verifier a distinct lens. Diversity catches failure modes redundancy can't.

```js
const LENSES = ['correctness', 'security', 'performance', 'does-it-reproduce']
const votes = await parallel(
  LENSES.map(lens => () =>
    agent(
      `Judge this finding through the ${lens} lens. Is it a real issue?
      Finding: ${finding.description}
      File: ${finding.file}:${finding.line}`,
      { label: `verify-${lens}`, phase: 'Verify', schema: VERDICT }
    )
  )
)
const isReal = votes.filter(Boolean).filter(v => v.real).length >= Math.ceil(LENSES.length / 2)
```

## Judge Panel

Generate N independent attempts from different angles, score with parallel judges, synthesize from winner while grafting best ideas from runners-up.

```js
const ANGLES = [
  { name: 'mvp-first', prompt: 'Design with MVP scope, minimal dependencies' },
  { name: 'risk-first', prompt: 'Design tackling highest risks first' },
  { name: 'user-first', prompt: 'Design optimizing for user experience above all' },
]
// Generate
const designs = await parallel(ANGLES.map(a => () =>
  agent(a.prompt, { label: `design-${a.name}`, schema: DESIGN_SCHEMA })
))
// Score
const scored = await parallel(
  designs.filter(Boolean).map((d, i) => () =>
    agent(`Score this design on correctness, feasibility, simplicity (1-10 each).
      Design: ${JSON.stringify(d)}`,
      { label: `judge-${i}`, schema: SCORE_SCHEMA }
    ).then(s => ({ design: d, score: s }))
  )
)
// Synthesize
const best = scored.filter(Boolean).sort((a, b) => b.score.total - a.score.total)[0]
const others = scored.filter(Boolean).filter(s => s !== best)
const synthesis = await agent(
  `Base design: ${JSON.stringify(best.design)}
  Good ideas from others to graft in: ${JSON.stringify(others.map(o => o.score.strengths))}
  Produce the final synthesized design.`,
  { schema: DESIGN_SCHEMA }
)
```

## Loop-Until-Dry

For unknown-size discovery (bugs, issues, edge cases), keep spawning finders until K consecutive rounds return nothing new.

```js
const seen = new Set()
const confirmed = []
let dry = 0
const DRY_TARGET = 2  // stop after 2 consecutive rounds with nothing new

while (dry < DRY_TARGET) {
  const found = (await parallel(
    FINDERS.map(f => () => agent(f.prompt, { phase: 'Find', schema: BUGS }))
  )).filter(Boolean).flatMap(r => r.bugs)

  const fresh = found.filter(b => !seen.has(key(b)))
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach(b => seen.add(key(b)))

  const judged = await parallel(fresh.map(b => () =>
    parallel(['correctness', 'security', 'repro'].map(lens => () =>
      agent(`Judge "${b.desc}" via ${lens} lens — real?`, { phase: 'Verify', schema: VERDICT })
    )).then(vs => ({ b, real: vs.filter(Boolean).filter(v => v.real).length >= 2 }))
  ))
  confirmed.push(...judged.filter(v => v.real).map(v => v.b))
}
```

Key: dedup against `seen`, NOT `confirmed` — else rejected findings reappear every round and loop never converges.

## Multi-Modal Sweep

Parallel agents each search differently — by-container, by-content, by-entity, by-time. Each is blind to what others surface.

```js
const MODALITIES = [
  { key: 'by-container', prompt: 'Search by service/module: find issues per top-level directory' },
  { key: 'by-content', prompt: 'Search by content type: find issues in SQL queries, HTTP calls, auth logic' },
  { key: 'by-entity', prompt: 'Search by entity: find issues per domain model (User, Order, Payment)' },
  { key: 'by-time', prompt: 'Search by recency: find issues in files changed in last 30 days' },
]
const results = await parallel(
  MODALITIES.map(m => () => agent(m.prompt, { label: m.key, schema: FINDINGS }))
)
// Merge and deduplicate across modalities
const allFindings = results.filter(Boolean).flatMap(r => r.findings)
const unique = dedupeByFileAndLine(allFindings)
```

## Completeness Critic

A final agent asks "what's missing?" — modality not run, claim unverified, source unread. Its findings become next round of work.

```js
const critic = await agent(
  `Review the completed analysis and identify what's missing:
  - Any modality NOT run? (by-container, by-content, by-entity, by-time)
  - Any claim NOT adversarially verified?
  - Any source file NOT read?
  - Any edge case NOT covered?

  Completed work: ${JSON.stringify(summary)}

  Return a list of gaps with recommended next actions.`,
  { schema: GAPS_SCHEMA }
)
```

## Parallel Agent Steps (User-Guided Structure)

When the user describes a workflow with explicit parallel steps at each stage, model it with `parallel()` for each step, chaining with `await`:

```js
export const meta = {
  name: 'compare-components',
  description: 'Compare component usage patterns across two projects',
  phases: [
    { title: 'Analyze', detail: 'Analyze both projects in parallel' },
    { title: 'Compare', detail: 'Compare each component in parallel' },
    { title: 'Report', detail: 'Generate synthesis report' },
  ],
}

// Step 1: Analyze both projects in parallel
phase('Analyze')
const [projA, projB] = await parallel([
  () => agent('Analyze Select, Input, Table, Form, Dialog usage patterns in project A'),
  () => agent('Analyze Select, Input, Table, Form, Dialog usage patterns in project B'),
])

// Step 2: Compare each component in parallel
phase('Compare')
const comparisons = await parallel([
  () => agent(`Compare Select usage patterns between: ${projA} vs ${projB}`),
  () => agent(`Compare Input usage patterns between: ${projA} vs ${projB}`),
  () => agent(`Compare Table usage patterns between: ${projA} vs ${projB}`),
  () => agent(`Compare Form usage patterns between: ${projA} vs ${projB}`),
  () => agent(`Compare Dialog usage patterns between: ${projA} vs ${projB}`),
])

// Step 3: Synthesize report
phase('Report')
return agent(`Synthesize all comparisons into comprehensive report with recommendations:
${comparisons.filter(Boolean).join('\n---\n')}`)
```

## Sequential Dependency Chain

When later agents depend on earlier agent output, chain with `await`:

```js
const patterns = await agent('Analyze component usage patterns in project A')
const gaps = await agent(`Identify gaps and inconsistencies in: ${patterns}`)
const recommendations = await agent(`Generate recommendations from gaps: ${gaps}`)
```

## Mixed: Parallel + Sequential

```js
// Step 1: Parallel analysis
const [selectA, inputA, tableA] = await parallel([
  () => agent('Analyze Select usage in project A'),
  () => agent('Analyze Input usage in project A'),
  () => agent('Analyze Table usage in project A'),
])

// Step 2: Sequential — each comparison uses the specific analysis
const comparison = await agent(
  `Compare patterns across components:
  Select: ${selectA}
  Input: ${inputA}
  Table: ${tableA}`
)

// Step 3: Parallel — generate outputs from comparison
const [report, recommendations] = await parallel([
  () => agent(`Generate detailed report: ${comparison}`),
  () => agent(`Generate actionable recommendations: ${comparison}`),
])
```

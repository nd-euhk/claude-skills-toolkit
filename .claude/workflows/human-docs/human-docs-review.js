export const meta = {
  name: 'human-docs-review',
  description: 'Read-only consistency check between agent_docs/ and docs/',
  phases: [
    { title: 'Review', detail: 'Compare agent_docs/ ↔ docs/ and classify each file' },
  ],
}

// JSON schema for review output (from spec §5)
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          status: { type: 'string', enum: ['synced', 'stale', 'missing', 'orphan', 'diverged'] },
          reason: { type: 'string' },
        },
        required: ['path', 'status', 'reason'],
      },
    },
    summary: {
      type: 'object',
      properties: {
        synced: { type: 'number' },
        stale: { type: 'number' },
        missing: { type: 'number' },
        orphan: { type: 'number' },
        diverged: { type: 'number' },
      },
      required: ['synced', 'stale', 'missing', 'orphan'],
    },
  },
  required: ['entries', 'summary'],
}

phase('Review')

log('Spawning human-docs-review agent (READ-ONLY)...')

const result = await agent(
  `Review consistency between agent_docs/ and docs/. Compare all files, classify each.

Follow your procedure:
	1. Scan agent_docs/: features/FR-*.md, architecture.md, adrs/ADR-*.md, error-handling.md, caching-strategy.md, frontend-architecture.md, frontend-test-strategy.md, performance-test.md
	2. Scan docs/: product/SRS.md, product/features/README.md, architecture/README.md, architecture/system-architecture.md, architecture/diagrams/
	3. Classify each file: synced, stale, missing, orphan, diverged
	4. Cross-cutting files are ROUTED (not copied) — check README.md references instead of individual files
	5. Flag v1.0.0 artifacts (SRS-BACKEND.md, SRS-FRONTEND.md) as orphan
	6. Report structured output

DO NOT write any files.`,
  {
    label: 'review',
    phase: 'Review',
    agentType: 'human-docs-review',
    schema: REVIEW_SCHEMA,
  }
)

if (!result) {
  log('❌ review failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

const { entries, summary } = result
const { synced, stale, missing, orphan, diverged } = summary

log(`docs/product/  ─────────────────────────────────`)
entries.filter(e => e.path.startsWith('docs/product/')).forEach(e => {
  const icons = { synced: '✅', stale: '⚠️', missing: '❌', orphan: '👻', diverged: '🔀' }
  log(`  ${icons[e.status] || '❓'} ${e.path} (${e.status} — ${e.reason})`)
})

log(`docs/architecture/  ────────────────────────────`)
entries.filter(e => e.path.startsWith('docs/architecture/')).forEach(e => {
  const icons = { synced: '✅', stale: '⚠️', missing: '❌', orphan: '👻', diverged: '🔀' }
  log(`  ${icons[e.status] || '❓'} ${e.path} (${e.status} — ${e.reason})`)
})

log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
log(`Summary: ${synced} synced, ${stale} stale, ${missing} missing, ${orphan} orphan${diverged ? `, ${diverged} diverged` : ''}`)

const action = stale > 0 || missing > 0
  ? `run "/human-docs sync:all" to fix ${stale + missing} out-of-date files`
  : 'All docs up-to-date ✅'

log(`Action: ${action}`)

return { status: 'completed', entries, summary, action }

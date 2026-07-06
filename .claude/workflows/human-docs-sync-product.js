export const meta = {
  name: 'human-docs-sync-product',
  description: 'Sync agent_docs/features/FR-*.md → docs/product/SRS.md + features/README.md',
  phases: [
    { title: 'Parse', detail: 'Read FR files and validate inputs' },
    { title: 'Generate', detail: 'Spawn sync-product agent to generate human docs' },
  ],
}

// JSON schema for agent output validation (from spec §5)
const SYNC_PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    fr_count: { type: 'number' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fr_id: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          sprint: { type: 'string' },
          gherkin_scenarios: { type: 'number' },
        },
        required: ['fr_id', 'title', 'priority', 'gherkin_scenarios'],
      },
    },
    nfrs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          metric: { type: 'string' },
          target: { type: 'string' },
        },
        required: ['id', 'metric', 'target'],
      },
    },
    traceability: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          fr_id: { type: 'string' },
          test_id: { type: 'string' },
        },
        required: ['requirement', 'fr_id'],
      },
    },
    files_written: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['fr_count', 'features'],
}

phase('Parse')

// Edge case: Check agent_docs/ exists
const agentDocsDir = 'agent_docs'
try {
  const check = await agent(
    `Check if ${agentDocsDir}/ directory exists and contains features/FR-*.md files.
     List all FR files found. If no files, report "No FR files found".`,
    { label: 'check-inputs', phase: 'Parse' }
  )
  if (!check || check.includes('No FR files')) {
    log('⚠️ No FR files found in agent_docs/features/ — SRS will be empty with note')
  }
  log(`Input check: ${check ? check.substring(0, 200) : 'no output'}`)
} catch (e) {
  log(`ERROR checking inputs: ${e.message || e}`)
}

phase('Generate')

log('Spawning human-docs-sync-product agent...')

const result = await agent(
  `Sync agent_docs/features/FR-*.md → docs/product/SRS.md + docs/product/features/README.md.

Follow your standard procedure:
1. Read all FR files
2. Parse: FR ID, title, priority, Gherkin scenarios
3. Extract NFRs with quantified thresholds
4. Build traceability from requirements-matrix.md
5. Generate SRS.md (NO BE/FE split — layer field is metadata only)
6. Generate features/README.md index
7. Create directories if needed
8. Report structured output`,
  {
    label: 'sync-product',
    phase: 'Generate',
    agentType: 'human-docs-sync-product',
    schema: SYNC_PRODUCT_SCHEMA,
  }
)

if (!result) {
  log('❌ sync:product failed — agent returned null')
  return {
    status: 'failed',
    error: 'Agent returned null — possible hallucination or tool error',
    fr_count: 0,
    features: [],
    nfrs: [],
    files_written: [],
  }
}

const { fr_count, features, nfrs, traceability, files_written } = result

log(`✅ sync:product — ${fr_count} FRs → ${(files_written || []).join(', ')}`)
if (nfrs && nfrs.length > 0) {
  log(`   NFRs extracted: ${nfrs.map(n => n.id).join(', ')}`)
}

return { status: 'completed', fr_count, features, nfrs, traceability, files_written }

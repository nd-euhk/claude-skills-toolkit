export const meta = {
  name: 'human-docs-sync-architecture',
  description: 'Sync agent_docs/architecture.md + adrs/ → docs/architecture/',
  phases: [
    { title: 'Parse', detail: 'Read architecture.md and ADR files' },
    { title: 'Generate', detail: 'Spawn sync-architecture agent to generate human docs' },
  ],
}

phase('Parse')

// Edge case: Check architecture.md exists
const archCheck = await agent(
  `Check if agent_docs/architecture.md exists and whether it contains Mermaid C4 diagrams.
   Also check agent_docs/adrs/ for ADR files.
   Report: "architecture.md: [found/not found], Mermaid blocks: [count], ADRs: [count]"`,
  { label: 'check-arch-inputs', phase: 'Parse' }
)

const hasArchitecture = archCheck && archCheck.includes('architecture.md: found')
const hasMermaid = archCheck && !archCheck.includes('Mermaid blocks: 0')
const hasADRs = archCheck && !archCheck.includes('ADRs: 0')

if (!hasArchitecture) {
  log('⚠️ No architecture.md found')
  return { status: 'skipped', reason: 'No architecture.md in agent_docs/' }
}

if (!hasMermaid) {
  log('⚠️ No Mermaid diagrams in architecture.md — will skip diagrams/')
}

log(`Architecture inputs: Mermaid=${hasMermaid}, ADRs=${hasADRs ? 'yes' : 'none'}`)

phase('Generate')

log('Spawning human-docs-sync-architecture agent...')

const result = await agent(
  `Sync agent_docs/architecture.md + agent_docs/adrs/ADR-*.md → docs/architecture/.

Follow your standard procedure:
1. Read architecture.md
2. Extract C4 Mermaid diagrams → docs/architecture/diagrams/*.mermaid
3. Generate system-architecture.md with narrative + embedded diagrams
4. Generate ADRs/README.md index (no individual ADR copy)
5. Create directories if needed
6. Report structured output`,
  {
    label: 'sync-architecture',
    phase: 'Generate',
    agentType: 'human-docs-sync-architecture',
  }
)

if (!result) {
  log('❌ sync:architecture failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

log(`✅ sync:architecture — ${result.diagrams_extracted || 0} diagrams + ${result.adrs_indexed || 0} ADRs indexed`)

return { status: 'completed', ...result }

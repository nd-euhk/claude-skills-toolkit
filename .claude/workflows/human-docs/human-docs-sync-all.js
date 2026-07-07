export const meta = {
  name: 'human-docs-sync-all',
  description: 'Run sync:srs → sync:architecture sequentially',
  phases: [
    { title: 'SRS', detail: 'sync:srs — FRs → SRS.md + README.md (Explore fan-out per domain)' },
    { title: 'Architecture', detail: 'sync:architecture — architecture.md → diagrams + ADRs' },
    { title: 'Report', detail: 'Summary of all sync operations' },
  ],
}

phase('SRS')
log('▶️ Phase 1/2: sync:srs')

const productResult = await agent(
  `Run the human-docs-sync-srs workflow. Discover FR domains, spawn parallel Explore agents to gather foundation/traceability/contracts/per-domain FRs, then synthesize SRS.md + features/README.md. No BE/FE split. Report structured output.`,
  {
    label: 'sync-srs',
    phase: 'SRS',
    agentType: 'human-docs-sync-srs',
  }
)

if (!productResult) {
  log('❌ sync:srs failed')
  return { status: 'failed', phase: 'srs' }
}

const frCount = productResult.fr_count || 0
log(`✅ sync:srs — ${frCount} FRs processed`)

phase('Architecture')
log('▶️ Phase 2/2: sync:architecture')

const archResult = await agent(
  `Run the human-docs-sync-architecture workflow. Read agent_docs/architecture.md and generate docs/architecture/system-architecture.md + diagrams/ + ADRs/README.md. Report structured output.`,
  {
    label: 'sync-architecture',
    phase: 'Architecture',
    agentType: 'human-docs-sync-architecture',
  }
)

if (!archResult) {
  log('⚠️ sync:architecture returned null — may have no architecture.md')
}

phase('Report')

const totalFiles = [...(productResult.files_written || []), ...(archResult?.files_written || [])]
const totalWarnings = [
  ...(productResult.warnings || []),
  ...(archResult?.warnings || []),
]

log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
log(`Done: ${totalFiles.length} files written, ${totalWarnings.length} warnings`)
totalFiles.forEach(f => log(`  ✅ ${f}`))
totalWarnings.forEach(w => log(`  ⚠️ ${w}`))

return {
  status: 'completed',
  srs: { fr_count: frCount, files: productResult.files_written || [] },
  architecture: archResult || { status: 'skipped' },
  total_files: totalFiles.length,
  total_warnings: totalWarnings.length,
}

export const meta = {
  name: 'human-docs-sync-all',
  description: 'Run sync:product → sync:architecture sequentially',
  phases: [
    { title: 'Product', detail: 'sync:product — FRs → SRS.md + README.md' },
    { title: 'Architecture', detail: 'sync:architecture — architecture.md → diagrams + ADRs' },
    { title: 'Report', detail: 'Summary of all sync operations' },
  ],
}

phase('Product')
log('▶️ Phase 1/2: sync:product')

const productResult = await agent(
  `Run the human-docs-sync-product workflow. Read agent_docs/features/FR-*.md and generate docs/product/SRS.md + docs/product/features/README.md. No BE/FE split. Report structured output.`,
  {
    label: 'sync-product',
    phase: 'Product',
    agentType: 'human-docs-sync-product',
  }
)

if (!productResult) {
  log('❌ sync:product failed')
  return { status: 'failed', phase: 'product' }
}

const frCount = productResult.fr_count || 0
log(`✅ sync:product — ${frCount} FRs processed`)

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
  product: { fr_count: frCount, files: productResult.files_written || [] },
  architecture: archResult || { status: 'skipped' },
  total_files: totalFiles.length,
  total_warnings: totalWarnings.length,
}

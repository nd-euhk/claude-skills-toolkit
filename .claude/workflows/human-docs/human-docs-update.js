export const meta = {
  name: 'human-docs-update',
  description: 'Incremental sync — only update changed files based on mtime comparison',
  phases: [
    { title: 'Detect', detail: 'Compare mtime timestamps to find changes' },
    { title: 'Update', detail: 'Spawn update agent for incremental sync' },
  ],
}

phase('Detect')

// Check if synced docs exist and have timestamps
const detectionResult = await agent(
  `Check docs/ for existing synced files and their Last synced timestamps:
1. Read docs/product/SRS.md — parse "Last synced: <timestamp>" from header (if exists)
2. Read docs/architecture/system-architecture.md — parse timestamp (if exists)
3. Compare with current mtime of agent_docs/features/FR-*.md, agent_docs/architecture.md, agent_docs/adrs/ADR-*.md
4. Report: which sources are newer than their corresponding output timestamps

If docs/ files don't exist → report "No synced docs — need full sync"
If no timestamp in headers → report "No timestamp — falling back to full sync"
If all sources older than timestamps → report "Already up-to-date"`,
  { label: 'detect-changes', phase: 'Detect' }
)

if (!detectionResult) {
  log('⚠️ Detection failed — recommending full sync')
  return { status: 'fallback', recommendation: 'Run /human-docs sync:all' }
}

const fallbackNeeded =
  detectionResult.includes('No synced docs') ||
  detectionResult.includes('No timestamp') ||
  detectionResult.includes('need full sync')

if (fallbackNeeded) {
  log('⚠️ Cannot incremental sync — falling back to sync:all')
  log('Recommendation: Run /human-docs sync:all')

  return {
    status: 'fallback',
    reason: detectionResult,
    recommendation: 'Run /human-docs sync:all for full re-sync',
  }
}

if (detectionResult.includes('Already up-to-date')) {
  log('✅ All docs already up-to-date — nothing to sync')
  return { status: 'completed', changes: 'none', files_written: [] }
}

phase('Update')

log('Changes detected — spawning human-docs-update agent for incremental sync...')

const result = await agent(
  `Perform incremental sync. Only update docs/ files whose agent_docs/ sources have changed.

Detection result: ${detectionResult}

Follow your procedure:
1. For each changed FR → update its section in SRS.md
2. If architecture.md changed → re-extract diagrams, update system-architecture.md
3. If ADRs added/removed → update ADRs/README.md index
4. Update Last synced timestamps
5. Report structured output

DO NOT re-sync unchanged files. Preserve human-managed sections.`,
  {
    label: 'incremental-update',
    phase: 'Update',
    agentType: 'human-docs-update',
  }
)

if (!result) {
  log('❌ update failed — agent returned null')
  return { status: 'failed', error: 'Agent returned null' }
}

const filesWritten = result.files_written || []
log(`✅ update complete — ${filesWritten.length} files updated`)
filesWritten.forEach(f => log(`  📝 ${f}`))

return { status: 'completed', ...result }

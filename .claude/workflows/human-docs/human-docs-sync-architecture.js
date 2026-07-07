export const meta = {
  name: 'human-docs-sync-architecture',
  description: 'Sync agent_docs/architecture.md + adrs/ → docs/architecture/',
  phases: [
    { title: 'Parse', detail: 'Read architecture.md and ADR files with structured extraction' },
    { title: 'Generate', detail: 'Spawn sync-architecture agent to generate human docs' },
  ],
}

// ── Schemas ──────────────────────────────────────────────────────────────

const ARCH_PARSE_SCHEMA = {
  type: 'object',
  properties: {
    has_architecture: { type: 'boolean' },
    architecture_style: { type: 'string' },
    has_mermaid: { type: 'boolean' },
    mermaid_count: { type: 'integer' },
    diagram_names: {
      type: 'array',
      items: { type: 'string' },
    },
    adr_count: { type: 'integer' },
    adrs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['id', 'title', 'status'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['has_architecture', 'has_mermaid', 'mermaid_count', 'adr_count'],
}

const ARCH_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    architecture_status: { enum: ['ok', 'degraded'] },
    diagrams_extracted: { type: 'integer' },
    diagram_names: {
      type: 'array',
      items: { type: 'string' },
    },
    adrs_indexed: { type: 'integer' },
    adr_list: {
      type: 'array',
      items: { type: 'string' },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    files_written: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['architecture_status', 'files_written'],
}

// ── Phase 1: Parse ───────────────────────────────────────────────────────

phase('Parse')

const parseResult = await agent(
  `Read agent_docs/architecture.md and agent_docs/adrs/ADR-*.md. Extract structured metadata.

**What to extract:**

1. From architecture.md:
   - Does the file exist? → has_architecture (boolean)
   - Architecture style declaration (e.g., "microservices", "modular monolith", "event-driven")
   - All Mermaid code blocks — count them, name each one by its type:
     - "c4-context" for C4 System Context diagram
     - "c4-container" for C4 Container diagram
     - "c4-component-{name}" for per-service component diagrams

2. From agent_docs/adrs/ADR-*.md:
   - Count of ADR files
   - For each ADR: extract id, title, status, date from frontmatter or first heading

3. Warnings:
   - No architecture.md → warning
   - No Mermaid blocks → warning
   - No ADR files → warning

Report EVERYTHING as structured JSON — use the schema provided.`,
  { label: 'parse-architecture', phase: 'Parse', schema: ARCH_PARSE_SCHEMA }
)

if (!parseResult) {
  log('❌ Parse phase failed — agent returned null')
  return { status: 'failed', error: 'Parse agent returned null' }
}

// ── Edge case handling ────────────────────────────────────────────────────

if (!parseResult.has_architecture) {
  log('⚠️ No architecture.md found in agent_docs/')
  return { status: 'skipped', reason: 'No architecture.md in agent_docs/' }
}

if (!parseResult.has_mermaid) {
  log('⚠️ No Mermaid diagrams in architecture.md — diagrams/ will be skipped')
  parseResult.warnings = parseResult.warnings || []
  parseResult.warnings.push('No Mermaid diagrams found')
}

if (parseResult.adr_count === 0) {
  log('ℹ️ No ADR files — ADRs/README.md will note "No architectural decisions yet"')
}

log(`Architecture inputs: style="${parseResult.architecture_style || 'unknown'}", Mermaid=${parseResult.mermaid_count}, ADRs=${parseResult.adr_count}`)

// ── Phase 2: Generate ────────────────────────────────────────────────────

phase('Generate')

log('Spawning human-docs-sync-architecture agent...')

const generateResult = await agent(
  `Sync agent_docs/architecture.md + agent_docs/adrs/ADR-*.md → docs/architecture/.

**Pre-parsed metadata** (from Parse phase — use for cross-validation, do NOT re-invent):
- Architecture style: ${parseResult.architecture_style || 'not specified'}
- Mermaid diagrams: ${parseResult.mermaid_count} blocks → ${(parseResult.diagram_names || []).join(', ') || '(none)'}
- ADRs: ${parseResult.adr_count} files → ${(parseResult.adrs || []).map(a => `${a.id}: ${a.title} [${a.status}]`).join('; ') || '(none)'}
- Parse warnings: ${(parseResult.warnings || []).join('; ') || '(none)'}

**Execution context:**
${!parseResult.has_mermaid ? '- ⚠️ No Mermaid diagrams → skip diagrams/ extraction, still generate system-architecture.md with narrative only' : ''}
${parseResult.adr_count === 0 ? '- ℹ️ No ADRs → ADRs/README.md with note "No architectural decisions yet"' : ''}

Follow your standard procedure:
1. Read agent_docs/architecture.md (the full file, for narrative content)
2. Extract C4 Mermaid diagrams → docs/architecture/diagrams/*.mermaid
3. Generate docs/architecture/system-architecture.md with narrative + embedded diagrams
4. Generate docs/architecture/ADRs/README.md index (point back to agent_docs/adrs/, no copy)
5. Create directories if needed

IMPORTANT: Report structured output matching the schema. Cross-validate with parse metadata — if parse found 2 diagrams but you extract 0, flag as warning.`,
  {
    label: 'sync-architecture',
    phase: 'Generate',
    agentType: 'human-docs-sync-architecture',
    schema: ARCH_OUTPUT_SCHEMA,
  }
)

if (!generateResult) {
  log('❌ sync:architecture failed — agent returned null')
  return { status: 'failed', error: 'Generate agent returned null' }
}

// ── Report ────────────────────────────────────────────────────────────────

const diagCount = generateResult.diagrams_extracted || 0
const adrCount = generateResult.adrs_indexed || 0
const warnings = [...(parseResult.warnings || []), ...(generateResult.warnings || [])]

log(`✅ sync:architecture complete — ${diagCount} diagrams + ${adrCount} ADRs indexed`)
if (warnings.length) {
  warnings.forEach(w => log(`  ⚠️ ${w}`))
}

return {
  status: 'completed',
  parse: {
    architecture_style: parseResult.architecture_style,
    mermaid_count: parseResult.mermaid_count,
    adr_count: parseResult.adr_count,
  },
  ...generateResult,
  warnings,
}

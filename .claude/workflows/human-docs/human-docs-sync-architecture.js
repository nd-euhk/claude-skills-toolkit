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
    cross_cutting_summaries: { type: 'integer' },
    cross_cutting_missing: {
      type: 'array',
      items: { type: 'string' },
    },
    readme_generated: { type: 'boolean' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    files_written: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['architecture_status', 'files_written', 'readme_generated'],
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
  log('ℹ️ No ADR files — README.md will note "No architectural decisions yet"')
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
${parseResult.adr_count === 0 ? '- ℹ️ No ADRs → README.md will note "No architectural decisions yet"' : ''}

Follow your standard procedure:
1. Read agent_docs/architecture.md (full file)
2. Extract C4 Mermaid diagrams → docs/architecture/diagrams/*.mermaid
3. Read cross-cutting files from agent_docs/ (each may or may not exist): error-handling.md, caching-strategy.md, frontend-architecture.md, frontend-test-strategy.md, performance-test.md
4. For each cross-cutting file that exists → extract 1-paragraph summary + link to agent_docs
5. Generate docs/architecture/system-architecture.md — fill template with architecture narrative + C4 diagrams + service summary + cross-cutting summaries
6. Generate docs/architecture/README.md — routing hub with ADR index + cross-cutting links (all point to agent_docs/)
7. Create directories if needed

IMPORTANT: Cross-cutting files are summarized inline in system-architecture.md and routed via README.md links to agent_docs/. They are NEVER copied to docs/architecture/. ADRs are routed via README.md links to agent_docs/adrs/, never copied. Report structured output matching the schema.`,
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
const ccSummaryCount = generateResult.cross_cutting_summaries || 0
const ccMissing = generateResult.cross_cutting_missing || []
const warnings = [...(parseResult.warnings || []), ...(generateResult.warnings || [])]

log(`✅ sync:architecture complete — README.md hub + ${diagCount} diagrams + ${adrCount} ADRs indexed + ${ccSummaryCount} cross-cutting summaries`)
if (ccMissing.length) {
  log(`   Cross-cutting not found: ${ccMissing.join(', ')} (summaries skipped)`)
}
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

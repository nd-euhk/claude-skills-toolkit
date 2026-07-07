export const meta = {
  name: 'human-docs-sync-srs',
  description: 'Sync agent_docs/ → docs/product/SRS.md + features/README.md with domain-based Explore fan-out',
  phases: [
    { title: 'Discover', detail: 'Discover FR domains + check foundation files exist' },
    { title: 'Gather', detail: 'Parallel Explore agents: foundation, traceability, contracts, per-domain FRs' },
    { title: 'Generate', detail: 'Synthesize SRS.md + features/README.md from gathered data' },
  ],
}

// ── JSON Schemas for Explore agent outputs ──────────────────────────

const DOMAINS_SCHEMA = {
  type: 'object',
  properties: {
    domains: { type: 'array', items: { type: 'string' } },
    total_frs: { type: 'number' },
    fr_index: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fr_id: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          sprint: { type: 'string' },
          layer: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['fr_id', 'title', 'priority', 'layer'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['domains', 'total_frs', 'fr_index'],
}

const FOUNDATION_SCHEMA = {
  type: 'object',
  properties: {
    project_name: { type: 'string' },
    system_purpose: { type: 'string' },
    scope: {
      type: 'object',
      properties: {
        in_scope: { type: 'array', items: { type: 'string' } },
        out_of_scope: { type: 'array', items: { type: 'string' } },
      },
    },
    personas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          goals: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'role'],
      },
    },
    user_journeys: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'steps'],
      },
    },
    glossary: { type: 'object' },
    nfr_baselines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string' },
          metric: { type: 'string' },
          target: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['id', 'category', 'metric', 'target'],
      },
    },
    constraints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['type', 'description'],
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    missing_files: { type: 'array', items: { type: 'string' } },
  },
  required: ['project_name', 'system_purpose'],
}

const TRACEABILITY_SCHEMA = {
  type: 'object',
  properties: {
    matrix: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fr_id: { type: 'string' },
          brd_objective: { type: 'string' },
          prd_feature: { type: 'string' },
          test_id: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['fr_id'],
      },
    },
    nfr_verification: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nfr_id: { type: 'string' },
          category: { type: 'string' },
          constraint: { type: 'string' },
          verified_where: { type: 'string' },
          owner: { type: 'string' },
        },
        required: ['nfr_id', 'category', 'constraint'],
      },
    },
  },
  required: ['matrix'],
}

const CONTRACTS_SCHEMA = {
  type: 'object',
  properties: {
    api_conventions: {
      type: 'object',
      properties: {
        style: { type: 'string' },
        auth: { type: 'string' },
        versioning: { type: 'string' },
        format: { type: 'string' },
        pagination: { type: 'string' },
      },
    },
    error_code_catalog: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          http_status: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['code'],
      },
    },
    event_catalog: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          trigger: { type: 'string' },
          payload_summary: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
}

const FR_DETAIL_SCHEMA = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fr_id: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          sprint: { type: 'string' },
          layer: { type: 'string' },
          gherkin_scenarios: { type: 'number' },
          description: { type: 'string' },
          preconditions: { type: 'array', items: { type: 'string' } },
          input_fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'string' },
                validation: { type: 'string' },
              },
              required: ['field'],
            },
          },
          process_steps: { type: 'array', items: { type: 'string' } },
          success_output: { type: 'string' },
          error_codes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                http_status: { type: 'string' },
                condition: { type: 'string' },
              },
              required: ['code'],
            },
          },
          nfrs_referenced: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                metric: { type: 'string' },
                target: { type: 'string' },
              },
              required: ['id'],
            },
          },
          constraints: { type: 'array', items: { type: 'string' } },
        },
        required: ['fr_id', 'title', 'priority', 'description'],
      },
    },
    fr_count: { type: 'number' },
  },
  required: ['domain', 'features', 'fr_count'],
}

// SRS output schema (same validation as before)
const SRS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    fr_count: { type: 'number' },
    domains: { type: 'array', items: { type: 'string' } },
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
    files_written: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['fr_count', 'features', 'files_written'],
}

// ── Phase 1: Discover ──────────────────────────────────────────────

phase('Discover')

// Check agent_docs/ exists
const dirCheck = await agent(
  `Check if these directories and files exist:
1. agent_docs/features/README.md — the FR index
2. agent_docs/features/FR-*.md — individual FR files
3. agent_docs/project-overview.md — project context
4. agent_docs/user-context.md — user personas and journeys
5. agent_docs/hard-boundaries.md — system constraints
6. agent_docs/traceability/requirements-matrix.md — traceability matrix
7. agent_docs/contracts/api-conventions.md — API conventions
8. agent_docs/contracts/error-codes.md — error code catalog
9. agent_docs/contracts/events.md — event catalog

Report which files EXIST and which are MISSING.
If agent_docs/features/ does not exist → report "NO_FEATURES_DIR"
If agent_docs/features/ has no FR-*.md files → report "NO_FR_FILES"`,
  { label: 'check-inputs', phase: 'Discover' }
)

if (!dirCheck) {
  log('❌ Cannot read agent_docs/ — nothing to sync')
  return { status: 'failed', error: 'Cannot read agent_docs/' }
}

if (dirCheck.includes('NO_FEATURES_DIR') || dirCheck.includes('NO_FR_FILES')) {
  log('⚠️ No FR files found — SRS will be empty with note')
  // Continue anyway — generate empty SRS with note
}

log(`Input check complete`)

// Discover domains from features/README.md
const domainsResult = await agent(
  `Read agent_docs/features/README.md. Extract:
1. All unique domains from FR IDs (e.g., FR-AUTH-001 → domain "AUTH", FR-PAY-002 → domain "PAY")
2. Total FR count
3. For each FR: fr_id, title, priority, sprint, layer, status

Also list all FR-*.md files via: ls agent_docs/features/FR-*.md
Count them and cross-check with README index.

Return the complete FR index with domains.`,
  {
    label: 'discover-domains',
    phase: 'Discover',
    agentType: 'Explore',
    schema: DOMAINS_SCHEMA,
  }
)

if (!domainsResult) {
  log('❌ Failed to discover domains')
  return { status: 'failed', error: 'Domain discovery failed' }
}

const { domains, total_frs, fr_index, warnings: discoverWarnings } = domainsResult

log(`Discovered: ${domains.length} domains, ${total_frs} FRs`)
domains.forEach(d => log(`  📂 ${d}`))
if (discoverWarnings && discoverWarnings.length > 0) {
  discoverWarnings.forEach(w => log(`  ⚠️ ${w}`))
}

// ── Phase 2: Gather — Parallel Explore agents ─────────────────────

phase('Gather')

log(`Spawning ${3 + domains.length} Explore agents in parallel...`)

const gatherTasks = [
  // Foundation agent: project-overview + user-context + hard-boundaries
  () => agent(
    `READ-ONLY. Extract structured data from foundation files for SRS synthesis.

Read these files (each may or may not exist — report missing in output):
1. agent_docs/project-overview.md — system purpose, scope, glossary, tech stack, NFR baselines
2. agent_docs/user-context.md — user personas, user journeys, accessibility requirements
3. agent_docs/hard-boundaries.md — system constraints, compliance requirements

Extract:
- project_name: from project-overview.md title or first heading
- system_purpose: 1-2 paragraphs summarizing what the system does
- scope: { in_scope: [...], out_of_scope: [...] }
- personas: [{name, role, goals}] from user-context.md
- user_journeys: [{name, steps}] from user-context.md
- glossary: {term: definition} key domain terms from project-overview.md
- nfr_baselines: [{id, category, metric, target, source}] quantified NFRs from project-overview.md
- constraints: [{type, description, source}] from hard-boundaries.md and project-overview.md
- assumptions: [string] from project-overview.md
- missing_files: [list of files that were checked but don't exist]

IMPORTANT: If a file doesn't exist, report it in missing_files and extract what you can from remaining files.
NEVER fabricate data — if a section cannot be populated, leave it empty or mark "Not specified".`,

    { label: 'gather-foundation', phase: 'Gather', agentType: 'Explore', schema: FOUNDATION_SCHEMA }
  ),

  // Traceability agent: requirements-matrix.md
  () => agent(
    `READ-ONLY. Extract structured traceability data for SRS synthesis.

Read agent_docs/traceability/requirements-matrix.md (if it exists).

Extract:
- matrix: [{fr_id, brd_objective, prd_feature, test_id, status}]
  — from the "Functional Requirements — Spec Layer" table
  — if brd_objective or test_id not in the row, omit those fields
- nfr_verification: [{nfr_id, category, constraint, verified_where, owner}]
  — from the "Non-Functional Requirements" table

If the file does not exist → return empty matrix and nfr_verification arrays.
NEVER fabricate traceability links.`,

    { label: 'gather-traceability', phase: 'Gather', agentType: 'Explore', schema: TRACEABILITY_SCHEMA }
  ),

  // Contracts agent: api-conventions + error-codes + events
  () => agent(
    `READ-ONLY. Extract structured contracts data for SRS synthesis.

Read these files (each may or may not exist):
1. agent_docs/contracts/api-conventions.md
2. agent_docs/contracts/error-codes.md
3. agent_docs/contracts/events.md

Extract:
- api_conventions: {style, auth, versioning, format, pagination}
  — from api-conventions.md; use "Not specified" for missing fields
- error_code_catalog: [{code, http_status, description}]
  — from error-codes.md; extract ALL defined error codes
- event_catalog: [{name, trigger, payload_summary}]
  — from events.md; extract ALL defined events

If a file does not exist → return empty/partial structure for that section.
If ALL files are missing → return empty structures with a note.`,

    { label: 'gather-contracts', phase: 'Gather', agentType: 'Explore', schema: CONTRACTS_SCHEMA }
  ),
]

// Add per-domain FR agents
domains.forEach(domain => {
  gatherTasks.push(() =>
    agent(
      `READ-ONLY. Extract structured feature details for domain "${domain}" from FR files.

Read ALL files matching: agent_docs/features/FR-${domain}-*.md

For EACH FR file, extract:
- fr_id: from frontmatter or filename (e.g., "FR-${domain}-001")
- title: from frontmatter "title" field or first heading
- priority: from frontmatter (Must, Should, Could, Won't). If not specified → "Should"
- sprint: from frontmatter (if present, otherwise "Unassigned")
- layer: from frontmatter (BE, FE, BE+FE — for display only)
- gherkin_scenarios: count of "Scenario:" and "Scenario Outline:" blocks
- description: the 1-2 sentence business description from "## Mô tả" or "## Feature Description" section
- preconditions: bullet list from "## Preconditions" section
- input_fields: [{field, type, required, validation}] from "## Input" table
- process_steps: numbered list from "## Process" section
- success_output: JSON/description from "## Output → Success" section
- error_codes: [{code, http_status, condition}] from "## Output → Errors" table
- nfrs_referenced: [{id, metric, target}] — extract NFR references from "## Constraints" section (patterns: "NFR-XXX-NNN → metric < target")
- constraints: [string] — business rules from "## Constraints" section (excluding NFR references)

Return: { domain: "${domain}", features: [...], fr_count: N }

IMPORTANT:
- If no FR-${domain}-*.md files exist → return { domain: "${domain}", features: [], fr_count: 0 }
- NEVER fabricate feature details — if a section is missing from source, omit the field
- Preserve the exact FR ID format from the filename`,

      { label: `gather-fr-${domain}`, phase: 'Gather', agentType: 'Explore', schema: FR_DETAIL_SCHEMA }
    )
  )
})

const allGatherResults = await parallel(gatherTasks)

// Parse results: first 3 are foundation, traceability, contracts; rest are per-domain
const foundation = allGatherResults[0]
const traceability = allGatherResults[1]
const contracts = allGatherResults[2]
const domainFeatures = allGatherResults.slice(3).filter(Boolean)

// Log gather results
if (foundation) {
  log(`✅ Foundation: ${foundation.project_name || 'unnamed'} — ${(foundation.personas || []).length} personas, ${(foundation.nfr_baselines || []).length} NFR baselines`)
  if (foundation.missing_files && foundation.missing_files.length > 0) {
    log(`   Missing: ${foundation.missing_files.join(', ')}`)
  }
} else {
  log('⚠️ Foundation gather failed — SRS will have limited intro sections')
}

if (traceability) {
  log(`✅ Traceability: ${(traceability.matrix || []).length} FR links`)
} else {
  log('⚠️ Traceability gather failed — skipping traceability matrix')
}

if (contracts) {
  const hasApi = contracts.api_conventions && contracts.api_conventions.style
  const hasErrors = contracts.error_code_catalog && contracts.error_code_catalog.length > 0
  const hasEvents = contracts.event_catalog && contracts.event_catalog.length > 0
  log(`✅ Contracts: API=${hasApi ? 'yes' : 'no'}, Errors=${hasErrors ? contracts.error_code_catalog.length : 0}, Events=${hasEvents ? contracts.event_catalog.length : 0}`)
} else {
  log('⚠️ Contracts gather failed')
}

domainFeatures.forEach(df => {
  if (df) {
    log(`✅ Domain ${df.domain}: ${df.fr_count} FRs gathered`)
  }
})

// ── Phase 3: Generate — Synthesize SRS.md ─────────────────────────

phase('Generate')

// Build the context payload for the synthesize agent
// Convert structured data to inline JSON blocks in the prompt
const contextPayload = JSON.stringify({
  foundation: foundation || { project_name: 'Unknown', system_purpose: 'Not specified', missing_files: ['all'] },
  traceability: traceability || { matrix: [], nfr_verification: [] },
  contracts: contracts || {},
  domainFeatures: domainFeatures.filter(Boolean),
  fr_index: fr_index || [],
}, null, 2)

log('Spawning human-docs-sync-srs agent to synthesize SRS.md...')

const result = await agent(
  `Synthesize the SRS from the pre-gathered data below. DO NOT re-read any files — use ONLY the data provided.

## Gathered Data

\`\`\`json
${contextPayload}
\`\`\`

## Instructions

1. Verify data completeness — report if critical fields are missing
2. Build FR overview table from fr_index (sort: Must → Should → Could → Won't, then by domain)
3. Build feature details per domain from domainFeatures
4. Consolidate NFRs from foundation.nfr_baselines + per-feature nfrs_referenced (deduplicate by ID)
5. Build traceability matrix from traceability.matrix
6. Write docs/product/SRS.md following the SRS template (8 sections)
7. Write docs/product/features/README.md — index table pointing back to agent_docs/features/
8. Create directories if needed (docs/product/, docs/product/features/)
9. Report structured output as JSON

Follow your agent procedure exactly. Hard boundaries apply.`,

  {
    label: 'synthesize-srs',
    phase: 'Generate',
    agentType: 'human-docs-sync-srs',
    schema: SRS_OUTPUT_SCHEMA,
  }
)

if (!result) {
  log('❌ SRS synthesis failed — agent returned null')
  return {
    status: 'failed',
    error: 'human-docs-sync-srs agent returned null',
    fr_count: total_frs,
    domains,
    features: [],
    nfrs: [],
    files_written: [],
  }
}

// ── Report ─────────────────────────────────────────────────────────

const { fr_count, features: outFeatures, nfrs, traceability: outTrace, files_written, warnings } = result

log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
log(`✅ sync:srs complete — ${fr_count} FRs in ${domains.length} domains`)
files_written.forEach(f => log(`  📄 ${f}`))
if (nfrs && nfrs.length > 0) {
  log(`  📊 NFRs: ${nfrs.map(n => n.id).join(', ')}`)
}
const allWarnings = [...(discoverWarnings || []), ...(warnings || [])]
allWarnings.forEach(w => log(`  ⚠️ ${w}`))

return {
  status: 'completed',
  fr_count,
  domains,
  features: outFeatures,
  nfrs,
  traceability: outTrace,
  files_written,
  warnings: allWarnings,
}

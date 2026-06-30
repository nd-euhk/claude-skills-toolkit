export const meta = {
  name: 'workflow-sdlc-explore-pipeline',
  description: 'SDLC per-service explore pipeline: Preflight → FR-Discovery (per EPIC) → LLD → IMP+TST (per EPIC) → Service Notes. Xử lý 1 service mỗi lần, output knowledge/ chuẩn SDLC.',
  phases: [
    { title: 'Preflight', detail: 'Check existing phase outputs for this service, skip completed phases' },
    { title: 'FR-Discovery', detail: 'Discover functional requirements per EPIC → FR-{EPIC}-{NNN}--{slug}.md' },
    { title: 'LLD', detail: 'Low-level design → tech-design.md' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications per EPIC group' },
    { title: 'Service-Notes', detail: 'Summarize exploration → .work/system-wide-notes/{service}.md' },
  ],
}

// ── Args (safe parse: handles both object and JSON-string) ──
// { projectName, runDate, slug, scoutReports: string[], language?: 'vi'|'en', mode?: 'full'|'architect', focusedService: string, epicCodes?: string[], fromPhase?: string }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { projectName, runDate, slug, scoutReports, language, mode, focusedService, epicCodes, fromPhase } = _args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : `Viết tất cả output bằng tiếng Việt. Phải viết có dấu đầy đủ (full diacritics — không được viết không dấu). Ví dụ: "được" chứ không phải "duoc", "không" chứ không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.`
const isArchitect = mode === 'architect'
const svcDir = focusedService || projectName
const scoutList = (scoutReports || []).map(f => `- ${f}`).join('\n')
const epicList = (epicCodes && epicCodes.length > 0) ? epicCodes : ['SYS']

// ── Phase ordering (for fromPhase skip logic) ──
const PHASE_ORDER = { 'FR-Discovery': 0, 'LLD': 1, 'IMP+TST': 2, 'Service-Notes': 3 }

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

const PREFLIGHT = {
  type: 'object',
  properties: {
    frDiscovery: {
      type: 'object',
      properties: { done: { type: 'boolean' }, count: { type: 'number' }, epics: { type: 'array', items: { type: 'string' } } },
      required: ['done', 'count', 'epics']
    },
    lld: { type: 'boolean' },
    impGroups: { type: 'array', items: { type: 'string' } },
    tstGroups: { type: 'array', items: { type: 'string' } },
    serviceNotes: { type: 'boolean' },
  },
  required: ['frDiscovery', 'lld', 'impGroups', 'tstGroups', 'serviceNotes']
}

const FR_RESULT = {
  type: 'object',
  properties: {
    epic: { type: 'string' },
    frIds: { type: 'array', items: { type: 'string' } },
    count: { type: 'number' },
    filesWritten: { type: 'array', items: { type: 'string' } },
  },
  required: ['epic', 'frIds', 'count']
}

const FR_GROUPS = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: { epic: { type: 'string' }, frIds: { type: 'array', items: { type: 'string' } }, service: { type: 'string' } },
        required: ['epic', 'frIds', 'service']
      }
    },
    totalFRs: { type: 'number' },
    totalGroups: { type: 'number' }
  },
  required: ['groups', 'totalFRs', 'totalGroups']
}

// ── Helpers ──

/** Check which phases for THIS SERVICE have already produced valid output. */
async function checkPhaseStatus() {
  const result = await agent(
    `Check which SDLC exploration phases have already produced valid output for service "${focusedService}" in project "${projectName}".

Check each phase for THIS SERVICE ONLY (not system-wide):

1. FR Discovery: Glob knowledge/04-microservices/${svcDir}/FR-*.md
   - Return count of FR files found and list of EPIC codes detected from the filenames (e.g., "FR-WAL-001--...md" → EPIC "WAL")

2. LLD: knowledge/04-microservices/${svcDir}/tech-design.md exists with real content (>500 bytes, not just headers)

3. IMP: Glob knowledge/04-microservices/${svcDir}/FR-*-impl.md
   - Return list of FR group labels (e.g., "WAL", "PAY") that have impl files

4. TST: Glob knowledge/04-microservices/${svcDir}/FR-*-test.md
   - Return list of FR group labels that have test files

5. Service Notes: .work/system-wide-notes/${svcDir}.md exists with real content

Read files to verify they contain real content (not just headers/templates).
Return structured output.`,
    { label: 'preflight-check', agentType: 'Explore', schema: PREFLIGHT }
  )
  return result || { frDiscovery: { done: false, count: 0, epics: [] }, lld: false, impGroups: [], tstGroups: [], serviceNotes: false }
}

/** Spawn gate-verifier agent, return { passed, feedback } */
async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for service "${focusedService}" in project "${projectName}". Check against gate criteria for this phase type. Read-only — do not modify any files. Report pass/fail with specific evidence.`,
    { label: `gate-${phaseName.replace(/\s+/g, '-').toLowerCase()}`, phase: 'Gate', agentType: 'gate-verifier', schema: GATE }
  )
}

/** Run a single phase with gate retry loop. Returns { passed, feedback } */
async function runWithGate(label, agentType, promptFn, gateLabel, maxRetries, phase) {
  maxRetries = maxRetries || 3
  gateLabel = gateLabel || label
  const agentOpts = { label, agentType }
  if (phase) agentOpts.phase = phase

  let prompt = typeof promptFn === 'function' ? promptFn() : promptFn
  await agent(prompt, agentOpts)

  let gate = await gateCheck(gateLabel)

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`${label}: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    let retryPrompt = typeof promptFn === 'function' ? promptFn(gate.feedback, retry + 1) : promptFn
    const retryOpts = { label: `${label}-r${retry + 1}`, agentType }
    if (phase) retryOpts.phase = phase
    await agent(retryPrompt, retryOpts)
    gate = await gateCheck(gateLabel)
  }

  if (!gate.passed) {
    log(`✗ ${label}: FAILED after ${maxRetries} retries`)
    return { passed: false, feedback: gate.feedback }
  }

  log(`✓ ${label}: PASSED`)
  return { passed: true }
}

// ── Prompt builders ──

function frDiscoveryPrompt(epic, index, total, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous FR discovery for EPIC ${epic} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring service "${focusedService}" in project "${projectName}". EPIC "${epic}" (${index} of ${total}). ${total - 1} other EPICs handled by parallel sibling agents.

Input — read these exact files:
${scoutList}

Task: Discover and extract ALL functional requirements for EPIC "${epic}" from this service's codebase. Read the scout reports first as your map. Then explore the actual source code at the paths they reference to verify and enrich your findings. For each feature discovered, write a COMPLETE FR file.

Output: knowledge/04-microservices/${svcDir}/FR-${epic}-{NNN}--${slug}.md (one per FR, COMPLETE — not drafts)
NNN is a 3-digit sequential number starting from 001.

Each FR file must have:
- Description (2-3 sentences explaining what this feature does, from a business perspective)
- Preconditions (what must be true before this feature executes)
- Input table (fields, types, validation rules)
- Process steps (numbered list of execution steps)
- Output schema (success and error response structures)
- Error codes (specific error codes this feature can produce)
- Gherkin Scenario Outline with Examples table (at least 2 scenarios)
- Data model references (entities/tables this FR touches)
- Source code trace (list of source files that implement this feature)

Constraints:
- Reverse-engineering mode — extract from actual code behavior, not imagination
- Every FR must trace to a specific source file path
- Every Gherkin scenario must reflect actual code paths found in the source
- Discover FR-IDs from scratch — do NOT rely on pre-existing FR files
- Only features belonging to EPIC "${epic}" — other EPICs are handled by sibling agents
- Use your default templates for structure reference`
}

function lldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD for ${focusedService} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Designing service "${focusedService}" internals for project "${projectName}". FR Discovery complete with EPICs: ${epicList.join(', ')}.

Inputs — read these exact files:
${scoutList}
- All FR files: knowledge/04-microservices/${svcDir}/FR-*.md (read ALL of them)

Task: Design ${focusedService} internals. Write exactly 1 file:
knowledge/04-microservices/${svcDir}/tech-design.md

Structure (9 sections):
1. Service Overview — purpose, domain, bounded context
2. Domain Model — entities, value objects, aggregates, relationships
3. API Design — REST/GraphQL/gRPC endpoints, request/response schemas, error responses
4. Data Layer — database schema, queries, transactions, migrations
5. Integration Points — external services called, events published/consumed
6. Caching Strategy — what to cache, TTLs, invalidation
7. Error Handling — error categories, degraded modes, fallback chains
8. Configuration — env vars, feature flags, runtime configs
9. Work Packages — one section per EPIC group, listing all FR-IDs and their implementation approach

Constraints:
- Reverse-engineering mode — design from actual code, not speculation
- Service internals only — no system-wide architecture decisions
- Reference FR files by their exact FR-IDs
- Every API endpoint must trace to a source code path
- Use your default templates for structure reference`
}

function frGroupingPrompt() {
  return `${langInstr}
Context: Grouping FRs for IMP+TST phase. Service "${focusedService}" in project "${projectName}".

Inputs — read these exact files:
- All FR files: knowledge/04-microservices/${svcDir}/FR-*.md
- Tech design: knowledge/04-microservices/${svcDir}/tech-design.md

Task: Read all FR files and group them by EPIC code (extracted from the FR filename: FR-{EPIC}-{NNN}--...).

Grouping rules:
1. Group FRs by their EPIC code (first segment of the FR filename)
2. Each group = one EPIC → all FRs belonging to that EPIC
3. service field = "${focusedService}" for all groups

Return structured output with: groups array (epic, frIds, service), totalFRs count, totalGroups count.`
}

function impPrompt(group, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous IMP for EPIC ${group.epic} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const frIdList = group.frIds.join(', ')
  return `${prefix}${langInstr}
Context: Writing implementation specifications for EPIC "${group.epic}" in service "${focusedService}" (${index} of ${total} IMP agents). Project: "${projectName}".

FRs in this group: ${frIdList}

Inputs — read these exact files:
- FR files: ${group.frIds.map(id => `knowledge/04-microservices/${svcDir}/${id}--${slug}.md`).join(', ')}
- Tech design: knowledge/04-microservices/${svcDir}/tech-design.md

Task: Write implementation specifications for each FR in this group. Other EPIC groups handled by parallel agents. Cover for each FR:
- Execution flow (step-by-step logic, branching conditions)
- Business rules (validation, constraints, invariants)
- Data impact (tables/collections modified, queries executed)
- Error mapping (error codes → HTTP status → user message)
- Security considerations (authz checks, input sanitization, rate limits)

Output: knowledge/04-microservices/${svcDir}/FR-{EPIC}-{NNN}--${slug}-impl.md (one per FR in your group)

Constraints:
- Reverse-engineering mode — specifications only, no actual code
- Reference actual source code paths for every execution step
- Every FR gets its own impl file
- Use your default templates for structure reference`
}

function tstPrompt(group, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous TST for EPIC ${group.epic} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const frIdList = group.frIds.join(', ')
  return `${prefix}${langInstr}
Context: Writing test specifications for EPIC "${group.epic}" in service "${focusedService}" (${index} of ${total} TST agents). Project: "${projectName}".

FRs in this group: ${frIdList}

Inputs — read these exact files:
- FR files: ${group.frIds.map(id => `knowledge/04-microservices/${svcDir}/${id}--${slug}.md`).join(', ')}
- IMP specs (as they become available): ${group.frIds.map(id => `knowledge/04-microservices/${svcDir}/${id}--${slug}-impl.md`).join(', ')}
- Tech design: knowledge/04-microservices/${svcDir}/tech-design.md

Task: Write test specifications for each FR in this group. Other EPIC groups handled by parallel agents. Cover for each FR:
- Unit tests (test cases with input → expected output, mock definitions)
- Integration tests (service interactions, database integration, event testing)
- E2E tests (user journey scenarios, API endpoint testing)
- Performance tests (load thresholds, latency budgets, concurrency limits)

Output: knowledge/04-microservices/${svcDir}/FR-{EPIC}-{NNN}--${slug}-test.md (one per FR in your group)

Constraints:
- Reverse-engineering mode — test specifications only, no implementation code
- Reference actual test files if they exist in the codebase
- Every FR gets its own test file
- Use your default templates for structure reference`
}

function serviceNotesPrompt() {
  return `${langInstr}
Context: Summarizing exploration of service "${focusedService}" in project "${projectName}". All pipeline phases complete.

Inputs — read these exact files:
- All FR files: knowledge/04-microservices/${svcDir}/FR-*.md
- Tech design: knowledge/04-microservices/${svcDir}/tech-design.md
- All IMP specs: knowledge/04-microservices/${svcDir}/FR-*-impl.md
- All TST specs: knowledge/04-microservices/${svcDir}/FR-*-test.md

Task: Write a structured summary for this service that will be used by the system-wide merge workflow. This is NOT an explore-summary (that's done by the skill). This is a merge-ready notes file.

Write exactly 1 file: .work/system-wide-notes/${svcDir}.md

Structure:
1. Service Identity — name, type, build system, path, bounded context
2. EPIC Summary — per EPIC: list of FR-IDs, key business capabilities
3. Error Codes — ALL error codes found (code, description, HTTP status, FR source)
4. Events — events this service publishes and consumes (name, payload summary, schema ref)
5. External Dependencies — other services called, external APIs, infrastructure services
6. Architecture Patterns — patterns observed (CQRS, event sourcing, saga, etc.)
7. Coding Patterns — naming conventions, error handling style, project structure patterns
8. ADR Candidates — architecture decisions worth recording (title, context, options considered)
9. Integration Notes — anything the merge workflow needs to know about this service

Constraints:
- Machine-readable structure — this file is consumed by the system-merge workflow
- Be exhaustive with error codes and events — the merge workflow deduplicates
- Include source file paths as evidence
- Use structured sections with consistent headers for easy parsing`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// Phase 0: Preflight — check what's already complete for this service
phase('Preflight')
const done = await checkPhaseStatus()
const skipped = []
const completed = []

log(`Preflight: FR=${done.frDiscovery.done}(${done.frDiscovery.count}), LLD=${done.lld}, IMP=${done.impGroups.length}, TST=${done.tstGroups.length}, Notes=${done.serviceNotes}`)

// Determine which phases to run based on preflight state and fromPhase skip
const startOrder = fromPhase ? (PHASE_ORDER[fromPhase] ?? 0) : 0
const phasesToRun = {
  frDiscovery: !done.frDiscovery.done && startOrder <= 0,
  lld:          !done.lld && startOrder <= 1,
  impTst:       (done.impGroups.length < epicList.length || done.tstGroups.length < epicList.length) && startOrder <= 2,
  serviceNotes: !done.serviceNotes && startOrder <= 3,
}

// ── Phase 1: FR Discovery per EPIC ──
let allFRs = []
if (phasesToRun.frDiscovery) {
  phase('FR-Discovery')
  log(`FR-Discovery: ${epicList.length} EPIC(s) — ${epicList.join(', ')}`)

  const frResults = await pipeline(
    epicList,
    async (epic, _, idx) => {
      const index = idx + 1
      const total = epicList.length
      log(`FR-Discovery: EPIC ${epic} (${index}/${total})`)
      const gate = await runWithGate(
        `FR-${epic}`,
        'srs',
        (fb, rn) => frDiscoveryPrompt(epic, index, total, fb, rn),
        `FR-Discovery: EPIC ${epic}`,
        3,  // maxRetries x3
        'FR-Discovery'
      )
      // After gate passes, discover FR IDs for this EPIC
      if (gate.passed) {
        completed.push(`FR-${epic}`)
        // Globbing FR files for this EPIC to get the FR IDs
        const frInfo = await agent(
          `Glob knowledge/04-microservices/${svcDir}/FR-${epic}-*--${slug}.md (exclude -impl.md and -test.md). Read each file to extract the FR ID from its title. Return the list of FR-IDs found for EPIC ${epic}.`,
          { label: `fr-list-${epic}`, agentType: 'Explore', schema: FR_RESULT }
        )
        return frInfo || { epic, frIds: [], count: 0 }
      }
      return { epic, frIds: [], count: 0, gate }
    }
  )

  const frFailed = frResults.filter(r => r && r.gate && !r.gate.passed)
  if (frFailed.length > 0) {
    return {
      phase: 'FR-Discovery',
      error: `${frFailed.length} EPIC(s) failed`,
      failed: frFailed.map(f => f.epic),
      skipped,
      completed
    }
  }

  allFRs = frResults.filter(Boolean).filter(r => !r.gate)
  const totalFRCount = allFRs.reduce((sum, r) => sum + (r.count || 0), 0)
  log(`FR-Discovery complete: ${totalFRCount} FRs across ${allFRs.length} EPICs`)
} else {
  log('✓ FR-Discovery: already complete — skipping')
  skipped.push('FR-Discovery')
}

// ── Phase 2: LLD ──
if (phasesToRun.lld) {
  phase('LLD')
  log(`LLD: designing ${focusedService} internals`)
  const lldResult = await runWithGate(
    `LLD-${focusedService}`,
    'lld',
    lldPrompt,
    `LLD: ${focusedService}`,
    3  // maxRetries x3
  )
  if (!lldResult.passed) {
    return {
      phase: 'LLD',
      error: 'Gate failed after 3 retries',
      feedback: lldResult.feedback,
      skipped,
      completed
    }
  }
  completed.push(`LLD-${focusedService}`)
} else {
  log('✓ LLD: already complete — skipping')
  skipped.push('LLD')
}

// Architect mode — stop after LLD
if (isArchitect) {
  return {
    mode: 'architect',
    completed: [...skipped, ...completed],
    skipped,
    ran: completed,
    results: {
      frDiscovery: { totalFRs: allFRs.reduce((s, r) => s + (r.count || 0), 0), epics: epicList.length },
      lld: { passed: true }
    }
  }
}

// ── Phase 3: IMP+TST per EPIC group ──
let impTstSummary = null
if (phasesToRun.impTst) {
  // Step 3a: Group FRs by EPIC
  phase('IMP+TST')
  const frGroupsData = await agent(frGroupingPrompt(), {
    label: 'fr-grouping',
    phase: 'IMP+TST',
    agentType: 'Explore',
    schema: FR_GROUPS
  })

  if (!frGroupsData || !frGroupsData.groups || frGroupsData.groups.length === 0) {
    log('WARNING: No FR groups found. Skipping IMP+TST.')
  } else {
    const groups = frGroupsData.groups
    log(`FR Groups: ${frGroupsData.totalFRs} FRs → ${frGroupsData.totalGroups} EPIC groups`)

    // Step 3b: Pipeline per EPIC group — IMP∥TST inside each
    const impTstResults = await pipeline(
      groups,
      async (group, _, idx) => {
        const index = idx + 1
        const total = groups.length
        const impDone = done.impGroups && done.impGroups.includes(group.epic)
        const tstDone = done.tstGroups && done.tstGroups.includes(group.epic)

        if (impDone && tstDone) {
          log(`IMP+TST-${group.epic}: output already exists — skipping`)
          skipped.push(`IMP-${group.epic}`, `TST-${group.epic}`)
          return {
            epic: group.epic, service: group.service, frIds: group.frIds,
            impGate: { passed: true }, tstGate: { passed: true }, skipped: true,
          }
        }

        log(`IMP+TST: EPIC ${group.epic} (${index}/${total}) — ${group.frIds.length} FRs`)

        // IMP ∥ TST for this EPIC group
        const [impOk, tstOk] = await parallel([
          async () => {
            if (impDone) {
              log(`IMP-${group.epic}: output already exists — skipping`)
              skipped.push(`IMP-${group.epic}`)
              return { passed: true }
            }
            const r = await runWithGate(
              `IMP-${group.epic}`,
              'imp',
              (fb, rn) => impPrompt(group, total, index, fb, rn),
              `IMP: EPIC ${group.epic}`,
              2  // maxRetries x2
            )
            if (r.passed) completed.push(`IMP-${group.epic}`)
            return r
          },
          async () => {
            if (tstDone) {
              log(`TST-${group.epic}: output already exists — skipping`)
              skipped.push(`TST-${group.epic}`)
              return { passed: true }
            }
            const r = await runWithGate(
              `TST-${group.epic}`,
              'tst',
              (fb, rn) => tstPrompt(group, total, index, fb, rn),
              `TST: EPIC ${group.epic}`,
              2  // maxRetries x2
            )
            if (r.passed) completed.push(`TST-${group.epic}`)
            return r
          },
        ])

        return {
          epic: group.epic, service: group.service, frIds: group.frIds,
          impGate: impOk || { passed: false, feedback: 'agent error' },
          tstGate: tstOk || { passed: false, feedback: 'agent error' },
        }
      }
    )

    const valid = impTstResults.filter(Boolean)
    const impFailed = valid.filter(r => !r.impGate.passed)
    const tstFailed = valid.filter(r => !r.tstGate.passed)

    if (impFailed.length > 0 || tstFailed.length > 0) {
      log(`IMP+TST partial: ${impFailed.length} IMP failed, ${tstFailed.length} TST failed`)
      // Don't return error — partial is OK, continue to service notes
    }

    impTstSummary = {
      total: valid.length,
      impPassed: valid.length - impFailed.length,
      impFailed: impFailed.map(r => ({ epic: r.epic, feedback: r.impGate.feedback })),
      tstPassed: valid.length - tstFailed.length,
      tstFailed: tstFailed.map(r => ({ epic: r.epic, feedback: r.tstGate.feedback })),
    }
  }
} else {
  log('✓ IMP+TST: already complete — skipping')
  skipped.push('IMP+TST')
}

// ── Phase 4: Service Notes ──
if (phasesToRun.serviceNotes) {
  phase('Service-Notes')
  log(`Service-Notes: summarizing ${focusedService} exploration for system-wide merge`)
  await agent(serviceNotesPrompt(), {
    label: `notes-${focusedService}`,
    phase: 'Service-Notes',
    agentType: 'general-purpose',
  })
  completed.push('Service-Notes')
  log(`✓ Service-Notes: .work/system-wide-notes/${svcDir}.md`)
} else {
  log('✓ Service-Notes: already exists — skipping')
  skipped.push('Service-Notes')
}

// ── Return ──
return {
  mode: 'full',
  completed: [...skipped, ...completed],
  skipped,
  ran: completed,
  service: focusedService,
  results: {
    frDiscovery: {
      totalFRs: allFRs.reduce((s, r) => s + (r.count || 0), 0),
      epics: epicList.length,
      passed: !phasesToRun.frDiscovery || completed.includes('FR-' + epicList[0]) || skipped.includes('FR-Discovery'),
    },
    lld: { passed: !phasesToRun.lld || completed.includes(`LLD-${focusedService}`) || skipped.includes('LLD') },
    impTst: impTstSummary || { total: 0, impPassed: 0, tstPassed: 0, impFailed: [], tstFailed: [] },
    serviceNotes: { passed: completed.includes('Service-Notes') || skipped.includes('Service-Notes') },
  }
}

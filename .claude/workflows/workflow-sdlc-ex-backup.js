export const meta = {
  name: 'workflow-sdlc-explore-pipeline',
  description: 'SDLC Pipeline for codebase exploration: Preflight → FR-Discovery+NFR-Inference → HLD → LLD → LLD-Merge → FR-Dist → IMP+TST. Output khớp 100% chuẩn sdlc (knowledge/ structure, FR-{EPIC}-{NNN} naming, C4-context-diagram.md, v.v.).',
  phases: [
    { title: 'Preflight', detail: 'Check existing phase outputs, skip completed phases' },
    { title: 'FR-Discovery', detail: 'Discover functional requirements from code (per scout area) → FR-{EPIC}-{NNN}--{slug}.md' },
    { title: 'NFR-Inference', detail: 'Infer non-functional requirements from configs → hard-boundaries.md (merged)' },
    { title: 'HLD', detail: 'High-level architecture → C4-context-diagram.md + ADRs + coding-conventions.md + global-error-codes.md' },
    { title: 'LLD', detail: 'Per-service low-level design → tech-design.md' },
    { title: 'LLD-Merge', detail: 'Cross-cutting patterns' },
    { title: 'FR-Dist', detail: 'Group functional requirements for IMP+TST agents' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications in parallel' },
  ],
}

// ── Args (safe parse: handles both object and JSON-string) ──
// { projectName, runDate, slug, scoutReports: string[], language?: 'vi'|'en', mode?: 'full'|'architect', focusedService: string, epicCodes?: string[], fromPhase?: string }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { projectName, runDate, slug, scoutReports, language, mode, focusedService, epicCodes, fromPhase } = _args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt. Phải viết có dấu đầy đủ (full diacritics — không được viết không dấu). Ví dụ: "được" chứ không phải "duoc", "không" chứ không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'
const isArchitect = mode === 'architect'
const scoutList = scoutReports.map(f => `- ${f}`).join('\n')
const svcDir = focusedService || projectName  // fallback to projectName if no focusedService
const epicPrefix = (epicCodes && epicCodes.length > 0) ? epicCodes[0] : 'SYS'  // dùng EPIC code đầu tiên từ plan, fallback SYS

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

const SERVICE_LIST = {
  type: 'object',
  properties: {
    services: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name'] }
    }
  },
  required: ['services']
}

const FR_GROUPS = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, service: { type: 'string' }, frIds: { type: 'array', items: { type: 'string' } }, topic: { type: 'string' } },
        required: ['label', 'service', 'frIds']
      }
    },
    totalFRs: { type: 'number' },
    totalGroups: { type: 'number' }
  },
  required: ['groups', 'totalFRs', 'totalGroups']
}

const NFR_SCHEMA = {
  type: 'object',
  properties: {
    performance: { type: 'object', properties: { p95Latency: { type: 'string' }, throughput: { type: 'string' }, description: { type: 'string' } } },
    availability: { type: 'object', properties: { uptime: { type: 'string' }, rto: { type: 'string' }, rpo: { type: 'string' }, description: { type: 'string' } } },
    security: { type: 'object', properties: { authMethod: { type: 'string' }, rateLimit: { type: 'string' }, description: { type: 'string' } } },
    reliability: { type: 'object', properties: { retryStrategy: { type: 'string' }, circuitBreaker: { type: 'string' }, description: { type: 'string' } } },
    maintainability: { type: 'object', properties: { patterns: { type: 'string' }, description: { type: 'string' } } },
    usability: { type: 'object', properties: { observations: { type: 'string' }, description: { type: 'string' } } },
    rawConfigs: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' }, category: { type: 'string' } }, required: ['file', 'key', 'value'] } }
  },
  required: ['rawConfigs']
}

// ── Helpers ──

/** Check which phases have already produced valid output. One agent checks all. */
async function checkPhaseStatus() {
  const result = await agent(
    `Check which SDLC exploration phases have already produced valid output for project ${projectName}.

Check each phase:
- FR Discovery: Glob knowledge/04-microservices/**/FR-*.md — return count and list of FR-IDs found
- HLD: knowledge/03-system-architecture/C4-context-diagram.md AND knowledge/01-global-standards/coding-conventions.md exist with content
- LLD services: For each service directory under knowledge/04-microservices/, check if tech-design.md exists with content. Return list of service names that are complete.
- LLD merge: knowledge/01-global-standards/cross-cutting-patterns.md exists
- IMP: List all files matching knowledge/04-microservices/*/FR-*-impl.md — return the group labels (directory names) that have impl files
- TST: List all files matching knowledge/04-microservices/*/FR-*-test.md — return the group labels that have test files

Read files to verify they contain real content (not just headers/templates).
Return {
  frDiscovery: { done: boolean, count: number, frIds: string[] },
  hld: boolean,
  lldServices: string[],   // names of services with complete LLD
  lldMerge: boolean,
  impGroups: string[],     // FR group labels with complete IMP
  tstGroups: string[],     // FR group labels with complete TST
}`,
    { label: 'phase-status-check', agentType: 'Explore', schema: {
      type: 'object',
      properties: {
        frDiscovery: {
          type: 'object',
          properties: { done: { type: 'boolean' }, count: { type: 'number' }, frIds: { type: 'array', items: { type: 'string' } } },
          required: ['done', 'count', 'frIds']
        },
        hld: { type: 'boolean' },
        lldServices: { type: 'array', items: { type: 'string' } },
        lldMerge: { type: 'boolean' },
        impGroups: { type: 'array', items: { type: 'string' } },
        tstGroups: { type: 'array', items: { type: 'string' } },
      },
      required: ['frDiscovery', 'hld', 'lldServices', 'lldMerge', 'impGroups', 'tstGroups']
    }}
  )
  return result || { frDiscovery: { done: false, count: 0, frIds: [] }, hld: false, lldServices: [], lldMerge: false, impGroups: [], tstGroups: [] }
}

/** Spawn gate-verifier agent, return { passed, feedback } */
async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for codebase exploration of ${projectName}. Check against gate criteria for this phase type. Read-only — do not modify any files. Report pass/fail with specific evidence.`,
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

function frDiscoveryPrompt(scoutReport, areaName, areaIndex, totalAreas, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous FR discovery for ${areaName} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. Area ${areaName} (${areaIndex} of ${totalAreas}). ${totalAreas - 1} other areas handled by parallel sibling agents.

Input — read this exact file:
- Scout report: ${scoutReport}

Task: Discover and extract ALL functional requirements from this code area. Read the scout report first as your map. Then explore the actual source code at the paths it references to verify and enrich your findings. For each feature discovered, write a COMPLETE FR file.

Output: knowledge/04-microservices/${svcDir}/FR-{EPIC}-{NNN}--${slug}.md (EPIC codes from plan: ${epicCodes.join(", ")}) (one per FR, COMPLETE — not drafts)

Each FR file must have: description, preconditions, input table, process steps, output schema, error codes, Gherkin Scenario Outline with Examples table, data model references, source code trace.

Constraints: Reverse-engineering mode — extract from actual code behavior, not imagination. Every FR must trace to a specific source file. Every Gherkin scenario must reflect actual code paths. Discover FR-IDs from scratch — do NOT rely on pre-existing FR files. Use your default templates.`
}

function nfrInferencePrompt() {
  return `${langInstr}
Context: Exploring codebase ${projectName}. ${scoutReports.length} scout report(s) from run (${runDate}, slug: ${slug}).

Task: Infer non-functional requirements from existing configuration files. Search for and read: application configs (application*.yml, application*.properties, .env*), infrastructure configs (docker-compose*, Dockerfile*, k8s/*.yaml, terraform/*), build configs (package.json, pom.xml, Cargo.toml, go.mod), and any other config files you find.

For each config value found, record: file path, config key, raw value, and category (performance/availability/security/reliability/maintainability/usability).

Extract quantified thresholds: rate limits (req/s), timeouts (ms), cache TTLs (s), connection pool sizes, thread pool sizes, retry max attempts, circuit breaker thresholds. Never invent numbers — use only values found in configs.

After collecting all NFR data, merge it into knowledge/01-global-standards/hard-boundaries.md (append/replace NFR section) in a structured, agent-readable format. Include all raw configs and thresholds. This file is for agent consumption — no fluffy narrative, just structured data.

Return structured output (same data). Do NOT write any files yourself — use your standard Write tool.`
}

function hldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous HLD rejected by gate. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. FR discovery complete. ${scoutReports.length} scout report(s) from run (${runDate}, slug: ${slug}).

Inputs — read these exact files:
${scoutList}
- knowledge/01-global-standards/hard-boundaries.md (if exists, contains NFR thresholds)

Task: Design system architecture with C4 diagrams, ADRs (min 3: service decomposition, API conventions, event taxonomy), bounded context mapping, and service decomposition. Read scout reports and explore codebase directly if needed.

Output:
- knowledge/03-system-architecture/C4-context-diagram.md (C4 context + container diagrams, bounded context mapping, service→domain mapping)
- knowledge/03-system-architecture/ADRs/*.md (min 3 ADRs)
- knowledge/01-global-standards/coding-conventions.md
- knowledge/02-central-contracts/global-error-codes.md
- knowledge/01-global-standards/hard-boundaries.md
- knowledge/02-central-contracts/events/ (individual evt-{name}.yaml files)

Constraints: Reverse-engineering mode. Architecture only — no implementation details, no code, no per-service internals. Use your default templates.`
}

function lldServicePrompt(svc, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD for ${svc.name} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. HLD complete and gate-verified. Designing service ${svc.name} (${index} of ${total}). Other ${total - 1} services handled by parallel sibling agents. System-wide merge runs after all services complete.

Inputs — read these exact files:
- knowledge/03-system-architecture/C4-context-diagram.md
- knowledge/01-global-standards/hard-boundaries.md
- knowledge/02-central-contracts/global-error-codes.md
- knowledge/02-central-contracts/events/ (for event references)
${svc.scoutReport ? `- Scout report: ${svc.scoutReport}` : ''}

Task: Design ${svc.name} internals only. Write:
(1) knowledge/04-microservices/${svc.name}/tech-design.md (9 sections)
(2) Feature work packages per FR — one section per FR, grouped by topic/domain. Each work package references its FR-ID. List ${svc.name}'s FR-IDs explicitly at top of work packages.
Do NOT write tech-design-index.md or cross-cutting-patterns.md — these are lld-merge scope.

Constraints: Reverse-engineering mode. Service internals only — no new architectural decisions. Follow HLD boundaries. Stay strictly within ${svc.name} scope. Use your default templates.`
}

function lldMergePrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD merge rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. All per-service lld-service agents completed and gate-verified. Your job is system-wide merge.

Inputs:
- All per-service tech-design files: knowledge/04-microservices/*/tech-design.md
- knowledge/03-system-architecture/C4-context-diagram.md
- knowledge/01-global-standards/hard-boundaries.md
- knowledge/02-central-contracts/global-error-codes.md
- knowledge/02-central-contracts/events/ (for event references)

Task: Write exactly 1 file:
- knowledge/01-global-standards/cross-cutting-patterns.md — shared infra, auth flow, distributed tracing, config management, consistency violations
Do NOT modify any per-service files.

Constraints: Reverse-engineering mode. Read-only for per-service files. Flag consistency violations with specific service + rule reference. Use your default templates.`
}

function frDistPrompt() {
  return `${langInstr}
Context: Exploring codebase ${projectName}. HLD and LLD phases complete and gate-verified.

Inputs — read these exact files:
- knowledge/03-system-architecture/C4-context-diagram.md
- knowledge/04-microservices/*/tech-design.md
- All files under knowledge/04-microservices/*/tech-design.md

Task: Extract all FR-IDs from tech-design work packages and group them for IMP+TST agent assignment.

Grouping rules (MANDATORY):
1. Group by topic/domain — FRs sharing the same entity, flow, or domain belong together
2. Each topic group ≤ 5 FRs → 1 agent handles the whole group
3. Topic group > 5 FRs → split evenly: ceil(groupSize / 5) agents, distribute FRs evenly
4. No clear topic → split all FRs of that service evenly with same formula
5. Each group gets a label: "{service}/{FR-IDs-abbreviated}"

Return structured output with: groups array (label, service, frIds, topic), totalFRs count, totalGroups count.`
}

function impPrompt(group, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous IMP for ${group.label} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. HLD, LLD complete and gate-verified. Writing impl specs for FRs: ${group.frIds.join(', ')} (${index} of ${total} IMP agents, service ${group.service}).

Inputs:
- LLD work packages covering: ${group.frIds.join(', ')}
- knowledge/04-microservices/${group.service}/tech-design.md
- knowledge/01-global-standards/cross-cutting-patterns.md

Task: Write implementation specifications for ${group.frIds.join(', ')}. Other FR groups handled by parallel agents. Cover for each FR: execution flow, business rules, data impact, error mapping, security considerations.

Output: knowledge/04-microservices/${group.service}/FR-*-impl.md (one per FR in your group)
Constraints: Reverse-engineering mode. Specifications only — no actual code. References LLD work packages. Stay within your FR scope. Use your default templates.`
}

function tstPrompt(group, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous TST for ${group.label} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. IMP phase running in parallel. Writing test specs for FRs: ${group.frIds.join(', ')} (${index} of ${total} TST agents, service ${group.service}).

Inputs:
- IMP specs for ${group.frIds.join(', ')} (as they become available)
- knowledge/04-microservices/${group.service}/tech-design.md
- knowledge/01-global-standards/hard-boundaries.md (if exists, contains NFR thresholds)

Task: Write test specifications for ${group.frIds.join(', ')}. Other FR groups handled by parallel agents. Cover for each FR: unit, integration, E2E, and performance tests. Extract test coverage from existing test code.

Output: knowledge/04-microservices/${group.service}/FR-*-test.md (one per FR in your group)
Constraints: Reverse-engineering mode. Test specifications only — no implementation code. Stay within your FR scope. Use your default templates.`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// Check which phases are already complete (for idempotent re-runs)
phase('Preflight')
const done = await checkPhaseStatus()
const skipped = []
const completed = []

let hldResult

// ── Phase 1: FR-Discovery + NFR-Inference (no SRS — agent-only output) ──
if (done.frDiscovery && done.frDiscovery.done) {
  log(`✓ FR-Discovery: ${done.frDiscovery.count} FR files already exist — skipping`)
  skipped.push('FR-Discovery')
} else {
  // Prepare areas from scout reports for FR discovery
  const areas = scoutReports.map((sr, i) => ({
    scoutReport: sr,
    name: sr.replace(/.*scout-\d{8}-/, '').replace(/--.*\.md$/, '').replace(/^scout-\d{8}-/, ''),
    index: i + 1,
    total: scoutReports.length,
  }))
  log(`FR-Discovery: ${areas.length} area(s) for FR discovery`)

  // Run FR-Discovery and NFR-Inference in parallel
  phase('FR-Discovery')
  const [frDiscResults] = await parallel([
    async () => {
      const results = await pipeline(
        areas,
        async (area) => {
          log(`FR-Discovery: ${area.name} (${area.index}/${area.total})`)
          const frResult = await runWithGate(
            `FR-${area.name}`,
            'srs-fr-discovery',
            (fb, rn) => frDiscoveryPrompt(area.scoutReport, area.name, area.index, area.total, fb, rn),
            `FR-Discovery: ${area.name}`,
            undefined,
            'FR-Discovery'
          )
          if (frResult && frResult.passed) completed.push(`FR-${area.name}`)
          return { area: area.name, ...frResult }
        }
      )
      return results
    },
    async () => {
      // NFR-Inference: runs in parallel, writes nfr-thresholds.md
      phase('NFR-Inference')
      log('NFR-Inference: reading configs for NFR thresholds')
      const nfr = await agent(nfrInferencePrompt(), {
        label: 'nfr-inference',
        phase: 'NFR-Inference',
        agentType: 'general-purpose',
        schema: NFR_SCHEMA,
      })
      if (nfr) {
        log(`✓ NFR-Inference: ${nfr.rawConfigs.length} config values found`)
        completed.push('NFR-Inference')
      }
      return nfr
    },
  ])

  // Check FR discovery results
  const frFailed = (frDiscResults || []).filter(r => r && !r.passed)
  if (frFailed.length > 0) {
    return { phase: 'FR-Discovery', error: `${frFailed.length} area(s) failed`, failed: frFailed.map(f => f.area), skipped, completed }
  }
}

// ── Phase 2: HLD ──
if (done.hld) {
  log('✓ HLD: output already exists — skipping')
  skipped.push('HLD')
  hldResult = { passed: true }
} else {
  phase('HLD')
  hldResult = await runWithGate('HLD', 'hld-reverse', hldPrompt, 'HLD')
  if (!hldResult.passed) {
    return { phase: 'HLD', error: 'Gate failed after 3 retries', feedback: hldResult.feedback, skipped, completed }
  }
  completed.push('HLD')
}

// Architect mode — stop after HLD
if (isArchitect) {
  return { mode: 'architect', completed: [...skipped, ...completed], skipped, ran: completed, hldGate: hldResult }
}

// ── Phase 3: Extract service list (always run — depends on HLD output) ──
phase('LLD')
const svcData = await agent(
  `${langInstr}
Read knowledge/03-system-architecture/C4-context-diagram.md and extract the list of services. For each service, provide its name and a brief description.
Additionally, read the HLD output to determine which scout report covers each service.`,
  { label: 'extract-services', phase: 'LLD', agentType: 'general-purpose', schema: SERVICE_LIST }
)

if (!svcData || !svcData.services || svcData.services.length === 0) {
  log('WARNING: No services found in C4-context-diagram.md. Falling back to single-service mode.')
  svcData.services = [{ name: projectName }]
}

const services = svcData.services
log(`${services.length} services: ${services.map(s => s.name).join(', ')}`)

// Match scout reports to services
const enrichedServices = services.map((svc, i) => {
  let scoutReport = null
  if (scoutReports.length === 1) {
    scoutReport = scoutReports[0]
  } else if (scoutReports.length === services.length) {
    scoutReport = scoutReports[i]
  } else {
    for (const sr of scoutReports) {
      if (sr.toLowerCase().includes(svc.name.toLowerCase())) {
        scoutReport = sr
        break
      }
    }
  }
  return { ...svc, scoutReport, index: i + 1, total: services.length }
})

// ── Phase 3: LLD per service (pipeline with skip detection) ──
const lldResults = await pipeline(
  enrichedServices,
  async (svc) => {
    if (done.lldServices && done.lldServices.includes(svc.name)) {
      log(`LLD-${svc.name}: output already exists — skipping`)
      skipped.push(`LLD-${svc.name}`)
      return { service: svc.name, gate: { passed: true }, skipped: true }
    }
    log(`LLD: ${svc.name} (${svc.index}/${svc.total})`)
    const gate = await runWithGate(
      `LLD-${svc.name}`,
      'lld-service',
      (fb, rn) => lldServicePrompt(svc, svc.total, svc.index, fb, rn),
      `LLD-service: ${svc.name}`
    )
    if (gate.passed) completed.push(`LLD-${svc.name}`)
    return { service: svc.name, gate }
  }
)

const lldFailed = lldResults.filter(r => r && !r.gate.passed)
if (lldFailed.length > 0) {
  return { phase: 'LLD', error: `${lldFailed.length} service(s) failed gate`, failed: lldFailed.map(f => f.service), skipped, completed }
}

// ── Phase 4: LLD Merge ──
if (done.lldMerge) {
  log('✓ LLD-merge: output already exists — skipping')
  skipped.push('LLD-merge')
} else {
  phase('LLD-Merge')
  const mergeResult = await runWithGate('LLD-merge', 'lld-merge', lldMergePrompt, 'LLD-merge')
  if (!mergeResult.passed) {
    return { phase: 'LLD-merge', error: 'Gate failed after 3 retries', feedback: mergeResult.feedback, skipped, completed }
  }
  completed.push('LLD-merge')
}

// ── Phase 5: FR Distribution (always run — depends on LLD, fast read-only) ──
phase('FR-Dist')
const frDist = await agent(frDistPrompt(), {
  label: 'fr-distribution',
  phase: 'FR-Dist',
  agentType: 'general-purpose',
  schema: FR_GROUPS
})

if (!frDist || !frDist.groups || frDist.groups.length === 0) {
  return { phase: 'FR-Dist', error: 'FR distribution failed — no groups returned', skipped, completed }
}

log(`FR Distribution: ${frDist.totalFRs} FRs → ${frDist.totalGroups} groups across ${new Set(frDist.groups.map(g => g.service)).size} services`)
for (const g of frDist.groups) {
  log(`  ${g.label}: ${g.frIds.length} FRs [${g.topic || 'no topic'}]`)
}

// ── Phase 6: IMP + TST (pipeline with skip detection per group) ──
phase('IMP+TST')
const impTstResults = await pipeline(
  frDist.groups,
  async (group, _, idx) => {
    const index = idx + 1
    const total = frDist.totalGroups
    const impDone = done.impGroups && done.impGroups.includes(group.label)
    const tstDone = done.tstGroups && done.tstGroups.includes(group.label)

    if (impDone && tstDone) {
      log(`IMP+TST-${group.label}: output already exists — skipping`)
      skipped.push(`IMP-${group.label}`, `TST-${group.label}`)
      return {
        group: group.label, service: group.service, frIds: group.frIds,
        impGate: { passed: true }, tstGate: { passed: true }, skipped: true,
      }
    }

    // Spawn IMP + TST in parallel (skip individually if one is done)
    const [impOk, tstOk] = await parallel([
      async () => {
        if (impDone) {
          log(`IMP-${group.label}: output already exists — skipping`)
          skipped.push(`IMP-${group.label}`)
          return { passed: true }
        }
        const r = await runWithGate(
          `IMP-${group.label}`, 'imp-reverse',
          (fb, rn) => impPrompt(group, total, index, fb, rn),
          `IMP: ${group.label}`
        )
        if (r.passed) completed.push(`IMP-${group.label}`)
        return r
      },
      async () => {
        if (tstDone) {
          log(`TST-${group.label}: output already exists — skipping`)
          skipped.push(`TST-${group.label}`)
          return { passed: true }
        }
        const r = await runWithGate(
          `TST-${group.label}`, 'tst-reverse',
          (fb, rn) => tstPrompt(group, total, index, fb, rn),
          `TST: ${group.label}`
        )
        if (r.passed) completed.push(`TST-${group.label}`)
        return r
      },
    ])

    return {
      group: group.label, service: group.service, frIds: group.frIds,
      impGate: impOk || { passed: false, feedback: 'agent error' },
      tstGate: tstOk || { passed: false, feedback: 'agent error' },
    }
  }
)

const valid = impTstResults.filter(Boolean)
const impFailed = valid.filter(r => !r.impGate.passed)
const tstFailed = valid.filter(r => !r.tstGate.passed)

// ── Return ──
return {
  mode: 'full',
  completed: [...skipped, ...completed],
  skipped,
  ran: completed,
  services: services.length,
  frDistribution: { totalFRs: frDist.totalFRs, totalGroups: frDist.totalGroups, groups: frDist.groups.map(g => g.label) },
  results: {
    hld: hldResult,
    lld: lldResults.filter(Boolean).length,
    merge: { passed: done.lldMerge || completed.includes('LLD-merge') },
    impTst: {
      total: valid.length,
      impPassed: valid.length - impFailed.length,
      impFailed: impFailed.map(r => ({ group: r.group, feedback: r.impGate.feedback })),
      tstPassed: valid.length - tstFailed.length,
      tstFailed: tstFailed.map(r => ({ group: r.group, feedback: r.tstGate.feedback })),
    }
  }
}

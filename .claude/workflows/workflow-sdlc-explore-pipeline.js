export const meta = {
  name: 'workflow-sdlc-explore-pipeline',
  description: 'SDLC Pipeline for codebase exploration: SRS→HLD→LLD→IMP+TST with gate verification. Supports full and architect modes.',
  phases: [
    { title: 'SRS', detail: 'Software requirements specification' },
    { title: 'Gate SRS', detail: 'Verify SRS quality gates' },
    { title: 'HLD', detail: 'High-level architecture design' },
    { title: 'Gate HLD', detail: 'Verify HLD quality gates' },
    { title: 'LLD', detail: 'Per-service low-level design' },
    { title: 'Gate LLD', detail: 'Verify per-service LLD gates' },
    { title: 'LLD Merge', detail: 'Cross-cutting concerns + service index' },
    { title: 'Gate Merge', detail: 'Verify merge quality gates' },
    { title: 'FR Dist', detail: 'Group functional requirements for IMP+TST' },
    { title: 'IMP+TST', detail: 'Implementation + test specifications' },
    { title: 'Gate IMP+TST', detail: 'Verify IMP+TST quality gates' },
  ],
}

// ── Args ──
// { projectName, runDate, slug, scoutReports: string[], language?: 'vi'|'en', mode?: 'full'|'architect' }
const { projectName, runDate, slug, scoutReports, language, mode } = args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : 'Viết tất cả output bằng tiếng Việt. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'
const isArchitect = mode === 'architect'
const scoutList = scoutReports.map(f => `- ${f}`).join('\n')

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

// ── Helpers ──

/** Spawn gate-verifier agent, return { passed, feedback } */
async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for codebase exploration of ${projectName}. Check against gate criteria for this phase type. Read-only — do not modify any files. Report pass/fail with specific evidence.`,
    { label: `gate-${phaseName.replace(/\s+/g, '-').toLowerCase()}`, phase: 'Gate', agentType: 'gate-verifier', schema: GATE }
  )
}

/** Run a single phase with gate retry loop. Returns { passed, feedback } */
async function runWithGate(label, agentType, promptFn, gateLabel, maxRetries) {
  maxRetries = maxRetries || 3
  gateLabel = gateLabel || label

  let prompt = typeof promptFn === 'function' ? promptFn() : promptFn
  await agent(prompt, { label, agentType })

  let gate = await gateCheck(gateLabel)

  for (let retry = 0; !gate.passed && retry < maxRetries; retry++) {
    log(`${label}: gate rejected (${retry + 1}/${maxRetries}) — ${gate.feedback}`)
    let retryPrompt = typeof promptFn === 'function' ? promptFn(gate.feedback, retry + 1) : promptFn
    await agent(retryPrompt, { label: `${label}-r${retry + 1}`, agentType })
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

function srsPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous SRS rejected by gate. Feedback: ${feedback}\nFix these specific issues in your re-generated output.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. ${scoutReports.length} scout report(s) from exploration run (${runDate}, slug: ${slug}). Reports cover sub-projects that may interact but have independent codebases and technologies.

Inputs — read these exact files:
${scoutList}

Task: Extract requirements from the codebase. Read all scout reports first. Treat each as a source of functional and non-functional requirements. If any area lacks detail, explore the codebase directly.

Output: docs/product/SRS.md and agent_docs/traceability/requirements-matrix.md
Constraints: Reverse-engineering mode — extract from code, not imagination. Use your default templates.`
}

function hldPrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous HLD rejected by gate. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. SRS phase complete and gate-verified. ${scoutReports.length} scout report(s) from run (${runDate}, slug: ${slug}).

Inputs — read these exact files:
${scoutList}
- docs/product/SRS.md
- agent_docs/traceability/requirements-matrix.md

Task: Design system architecture with C4 diagrams, ADRs (min 3: service decomposition, API conventions, event taxonomy), bounded context mapping, and service decomposition. Read prior phase output and scout reports. Explore codebase directly if needed.

Output: docs/architecture/system-architecture.md, docs/architecture/ADRs/*.md, agent_docs/architecture.md, agent_docs/domain-service-mapping.yaml, agent_docs/hard-boundaries.md, agent_docs/contracts/api-conventions.md, agent_docs/contracts/events.md
Constraints: Reverse-engineering mode. Architecture only — no implementation details, no code, no per-service internals. Use your default templates.`
}

function lldServicePrompt(svc, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD for ${svc.name} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. SRS and HLD complete and gate-verified. Designing service ${svc.name} (${index} of ${total}). Other ${total - 1} services handled by parallel sibling agents. System-wide merge runs after all services complete.

Inputs — read these exact files:
- docs/product/SRS.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md
${svc.scoutReport ? `- Scout report: ${svc.scoutReport}` : ''}

Task: Design ${svc.name} internals only. Write: (1) agent_docs/tech-design/${svc.name}-service.md (9 sections), (2) agent_docs/contracts/api-${svc.name}.yaml, (3) feature work packages per FR — one section per FR, grouped by topic/domain. Each work package references its FR-ID from SRS. List ${svc.name}'s FR-IDs explicitly at top of work packages. Do NOT write README.md or cross-cutting.md — lld-merge scope.

Constraints: Reverse-engineering mode. Service internals only — no new architectural decisions. Follow HLD boundaries. Stay strictly within ${svc.name} scope. Use your default templates.`
}

function lldMergePrompt(feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous LLD merge rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Exploring codebase ${projectName}. All per-service lld-service agents completed and gate-verified. Your job is system-wide merge.

Inputs:
- All per-service tech-design files: agent_docs/tech-design/*-service.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md

Task: Write exactly 2 files: (1) agent_docs/tech-design/README.md — index of all services with dependency matrix, (2) agent_docs/tech-design/cross-cutting.md — shared infra, auth flow, distributed tracing, config management, consistency violations. Do NOT modify any per-service files.

Constraints: Reverse-engineering mode. Read-only for per-service files. Flag consistency violations with specific service + rule reference. Use your default templates.`
}

function frDistPrompt() {
  return `${langInstr}
Context: Exploring codebase ${projectName}. SRS, HLD, and LLD phases complete and gate-verified.

Inputs — read these exact files:
- docs/product/SRS.md
- agent_docs/traceability/requirements-matrix.md
- agent_docs/tech-design/README.md
- All files under agent_docs/tech-design/*-service.md

Task: Extract all FR-IDs from SRS output and group them for IMP+TST agent assignment.

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
Context: Exploring codebase ${projectName}. SRS, HLD, LLD complete and gate-verified. Writing impl specs for FRs: ${group.frIds.join(', ')} (${index} of ${total} IMP agents, service ${group.service}).

Inputs:
- LLD work packages covering: ${group.frIds.join(', ')}
- agent_docs/tech-design/${group.service}-service.md
- agent_docs/tech-design/cross-cutting.md

Task: Write implementation specifications for ${group.frIds.join(', ')}. Other FR groups handled by parallel agents. Cover for each FR: execution flow, business rules, data impact, error mapping, security considerations.

Output: agent_docs/backend/${group.service}/implementation/FR-*-impl.md (one per FR in your group)
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
- agent_docs/tech-design/${group.service}-service.md
- SRS NFR thresholds from docs/product/SRS.md

Task: Write test specifications for ${group.frIds.join(', ')}. Other FR groups handled by parallel agents. Cover for each FR: unit, integration, E2E, and performance tests. Extract test coverage from existing test code.

Output: agent_docs/backend/${group.service}/test-specs/FR-*-test.md (one per FR in your group)
Constraints: Reverse-engineering mode. Test specifications only — no implementation code. Stay within your FR scope. Use your default templates.`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// ── Phase 1: SRS ──
phase('SRS')
const srsResult = await runWithGate('SRS', 'srs', srsPrompt, 'SRS')
if (!srsResult.passed) {
  return { phase: 'SRS', error: 'Gate failed after 3 retries', feedback: srsResult.feedback }
}

// ── Phase 2: HLD ──
phase('HLD')
const hldResult = await runWithGate('HLD', 'hld', hldPrompt, 'HLD')
if (!hldResult.passed) {
  return { phase: 'HLD', error: 'Gate failed after 3 retries', feedback: hldResult.feedback }
}

// Architect mode — stop after HLD
if (isArchitect) {
  return { mode: 'architect', completed: ['SRS', 'HLD'], srsGate: srsResult, hldGate: hldResult }
}

// ── Phase 3: Extract service list ──
phase('LLD')
const svcData = await agent(
  `${langInstr}
Read agent_docs/domain-service-mapping.yaml and extract the list of services. For each service, provide its name and a brief description.
Additionally, read the HLD output to determine which scout report covers each service.`,
  { label: 'extract-services', phase: 'LLD', agentType: 'general-purpose', schema: SERVICE_LIST }
)

if (!svcData || !svcData.services || svcData.services.length === 0) {
  log('WARNING: No services found in domain-service-mapping.yaml. Falling back to single-service mode.')
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

// ── Phase 3: LLD per service (pipeline — each service flows through design → gate independently) ──
const lldResults = await pipeline(
  enrichedServices,
  async (svc) => {
    log(`LLD: ${svc.name} (${svc.index}/${svc.total})`)
    const gate = await runWithGate(
      `LLD-${svc.name}`,
      'lld-service',
      (fb, rn) => lldServicePrompt(svc, svc.total, svc.index, fb, rn),
      `LLD-service: ${svc.name}`
    )
    return { service: svc.name, gate }
  }
)

const lldFailed = lldResults.filter(r => r && !r.gate.passed)
if (lldFailed.length > 0) {
  return { phase: 'LLD', error: `${lldFailed.length} service(s) failed gate`, failed: lldFailed.map(f => f.service) }
}

// ── Phase 4: LLD Merge ──
phase('LLD Merge')
const mergeResult = await runWithGate('LLD-merge', 'lld-merge', lldMergePrompt, 'LLD-merge')
if (!mergeResult.passed) {
  return { phase: 'LLD-merge', error: 'Gate failed after 3 retries', feedback: mergeResult.feedback }
}

// ── Phase 5: FR Distribution ──
phase('FR Dist')
const frDist = await agent(frDistPrompt(), {
  label: 'fr-distribution',
  phase: 'FR Dist',
  agentType: 'general-purpose',
  schema: FR_GROUPS
})

if (!frDist || !frDist.groups || frDist.groups.length === 0) {
  return { phase: 'FR-Dist', error: 'FR distribution failed — no groups returned' }
}

log(`FR Distribution: ${frDist.totalFRs} FRs → ${frDist.totalGroups} groups across ${new Set(frDist.groups.map(g => g.service)).size} services`)
for (const g of frDist.groups) {
  log(`  ${g.label}: ${g.frIds.length} FRs [${g.topic || 'no topic'}]`)
}

// ── Phase 6: IMP + TST (pipeline — each group flows independently) ──
phase('IMP+TST')
const impTstResults = await pipeline(
  frDist.groups,
  async (group, _, idx) => {
    const index = idx + 1
    const total = frDist.totalGroups

    // Spawn IMP + TST in parallel
    const [impOk, tstOk] = await parallel([
      () => runWithGate(
        `IMP-${group.label}`,
        'imp',
        (fb, rn) => impPrompt(group, total, index, fb, rn),
        `IMP: ${group.label}`
      ),
      () => runWithGate(
        `TST-${group.label}`,
        'tst',
        (fb, rn) => tstPrompt(group, total, index, fb, rn),
        `TST: ${group.label}`
      ),
    ])

    return {
      group: group.label,
      service: group.service,
      frIds: group.frIds,
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
  completed: ['SRS', 'HLD', 'LLD', 'LLD-merge', 'FR-Dist', 'IMP+TST'],
  services: services.length,
  frDistribution: { totalFRs: frDist.totalFRs, totalGroups: frDist.totalGroups, groups: frDist.groups.map(g => g.label) },
  results: {
    srs: srsResult,
    hld: hldResult,
    lld: lldResults.filter(Boolean).length,
    merge: mergeResult,
    impTst: {
      total: valid.length,
      impPassed: valid.length - impFailed.length,
      impFailed: impFailed.map(r => ({ group: r.group, feedback: r.impGate.feedback })),
      tstPassed: valid.length - tstFailed.length,
      tstFailed: tstFailed.map(r => ({ group: r.group, feedback: r.tstGate.feedback })),
    }
  }
}

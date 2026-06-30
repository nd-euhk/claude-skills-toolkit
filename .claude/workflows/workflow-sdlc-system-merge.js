export const meta = {
  name: 'workflow-sdlc-system-merge',
  description: 'System-wide SDLC merge: Collect per-service outputs → C4∥Coding∥ErrorCodes → HardBoundaries∥CrossCutting → Events∥APIs → ADRs → Final Gate. Chạy sau khi tất cả service đã explore xong.',
  phases: [
    { title: 'Collect', detail: 'Read all per-service outputs, build structured summary' },
    { title: 'C4+Coding+Errors', detail: 'C4 Context Diagram ∥ Coding Conventions ∥ Global Error Codes (parallel)' },
    { title: 'Boundaries+CrossCutting', detail: 'Hard Boundaries ∥ Cross-cutting Patterns (parallel, needs C4)' },
    { title: 'Events+APIs', detail: 'Event specs ∥ API specs (2 parallel pipelines)' },
    { title: 'ADRs', detail: 'Architecture Decision Records (pipeline per candidate)' },
    { title: 'Final-Gate', detail: 'Cross-artifact consistency verification' },
  ],
}

// ── Args (safe parse: handles both object and JSON-string) ──
// { projectName, slug, language?: 'vi'|'en', runDate, services: string[], fromPhase?: string }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { projectName, slug, language, runDate, services, fromPhase } = _args
const useEnglish = language === 'en'
const langInstr = useEnglish
  ? ''
  : `Viết tất cả output bằng tiếng Việt. Phải viết có dấu đầy đủ (full diacritics — không được viết không dấu). Ví dụ: "được" chứ không phải "duoc", "không" chứ không phải "khong". Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.`
const svcList = (services && services.length > 0) ? services : []
const svcListStr = svcList.join(', ')
const svcCount = svcList.length

// ── Phase ordering (for fromPhase skip logic) ──
const PHASE_ORDER = { 'Collect': 0, 'C4+Coding+Errors': 1, 'HardBoundaries+CrossCutting': 2, 'Events+APIs': 3, 'ADRs': 4 }
const startOrder = fromPhase ? (PHASE_ORDER[fromPhase] ?? 0) : 0

// ── Schemas ──
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['passed', 'feedback']
}

const COLLECT_SUMMARY = {
  type: 'object',
  properties: {
    serviceTopology: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          buildSystem: { type: 'string' },
          dependencies: { type: 'array', items: { type: 'string' } },
          externalDeps: { type: 'array', items: { type: 'string' } },
          boundedContext: { type: 'string' },
          frCount: { type: 'number' },
          keyPatterns: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'description', 'type', 'dependencies', 'externalDeps']
      }
    },
    globalPatterns: {
      type: 'object',
      properties: {
        naming: { type: 'array', items: { type: 'string' } },
        structure: { type: 'array', items: { type: 'string' } },
        errorHandling: { type: 'array', items: { type: 'string' } },
        frameworks: { type: 'array', items: { type: 'string' } },
      }
    },
    allErrorCodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { code: { type: 'string' }, description: { type: 'string' }, httpStatus: { type: 'number' }, service: { type: 'string' }, frSource: { type: 'string' } },
        required: ['code', 'description', 'service']
      }
    },
    allEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, type: { type: 'string' }, service: { type: 'string' }, payloadSummary: { type: 'string' }, schemaRef: { type: 'string' } },
        required: ['name', 'type', 'service']
      }
    },
    allADRCandidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, context: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } },
        required: ['title', 'context']
      }
    },
    allExternalDeps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, type: { type: 'string' }, services: { type: 'array', items: { type: 'string' } } },
        required: ['name', 'type', 'services']
      }
    },
    globalErrorCategories: { type: 'array', items: { type: 'string' } },
    crossCuttingConcerns: { type: 'array', items: { type: 'string' } },
  },
  required: ['serviceTopology', 'allErrorCodes', 'allEvents', 'allADRCandidates', 'allExternalDeps']
}

// ── Helpers ──

/** Spawn gate-verifier agent, return { passed, feedback } */
async function gateCheck(phaseName) {
  return agent(
    `Verify ${phaseName} output for system-wide merge of project "${projectName}". Check against gate criteria for this artifact type. Read-only — do not modify any files. Report pass/fail with specific evidence.`,
    { label: `gate-${phaseName.replace(/\s+/g, '-').toLowerCase()}`, phase: 'Gate', agentType: 'gate-verifier', schema: GATE }
  )
}

/** Run a single phase with gate retry loop. Returns { passed, feedback } */
async function runWithGate(label, agentType, promptFn, gateLabel, maxRetries, phase) {
  maxRetries = maxRetries || 1
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

/** Build a file path reference for an artifact */
function artifactPath(path) {
  return `knowledge/${path}`
}

// ── Prompt builders ──

function collectPrompt() {
  return `${langInstr}
Context: System-wide merge phase for project "${projectName}" (slug: ${slug}). Collecting all per-service exploration outputs.

Services to collect: ${svcListStr}

For each service, read these files (if they exist):
1. .work/system-wide-notes/{service}.md — service notes with structured summary
2. knowledge/04-microservices/{service}/tech-design.md — service internal design
3. knowledge/04-microservices/{service}/FR-*.md (only the base FR files, not -impl or -test) — functional requirements

Also check for any existing system-wide files:
- knowledge/03-system-architecture/C4-context-diagram.md
- knowledge/01-global-standards/coding-conventions.md
- knowledge/02-central-contracts/global-error-codes.md
- knowledge/01-global-standards/hard-boundaries.md
- knowledge/01-global-standards/cross-cutting-patterns.md
- knowledge/02-central-contracts/events/evt-*.yaml
- knowledge/02-central-contracts/apis/*-api.yaml
- knowledge/03-system-architecture/ADRs/ADR-*.md

Task: Read all available files and build a comprehensive structured summary.

For serviceTopology: extract name, description, type (service/libs), buildSystem, dependencies (other services called), externalDeps (external APIs/DBs/MQs), boundedContext, frCount (count of FR files), keyPatterns (architectural patterns observed).

For allErrorCodes: collect EVERY error code from ALL sources (notes, FRs, tech-design). Each entry: code (string identifier), description, httpStatus, service (source), frSource (FR ID if from an FR file).

For allEvents: collect EVERY event from ALL services. Each: name, type (published/consumed), service (source), payloadSummary (1-2 sentences), schemaRef (if any).

For allADRCandidates: find architecture decisions worth recording. Each: title, context (why it matters), options (alternatives considered), recommendation.

For allExternalDeps: collect EVERY external dependency across all services. Each: name, type (rest/grpc/message-queue/db/cache/cloud-service), services (which services use it).

Be exhaustive — the merge agents depend on complete data. Return structured output.`
}

function c4Prompt(summary, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous C4 diagram rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const topologyStr = (summary.serviceTopology || []).map(s =>
    `- ${s.name}: ${s.description} (${s.type}, ${s.buildSystem || 'unknown'})\n  Dependencies: ${(s.dependencies || []).join(', ') || 'none'}\n  External: ${(s.externalDeps || []).join(', ') || 'none'}\n  Bounded context: ${s.boundedContext || 'not specified'}`
  ).join('\n')
  const extDepsStr = (summary.allExternalDeps || []).map(d =>
    `- ${d.name} (${d.type}): used by ${(d.services || []).join(', ')}`
  ).join('\n')
  return `${prefix}${langInstr}
Context: System-wide merge for project "${projectName}". Generate the C4 Context Diagram. ${svcCount} services in scope: ${svcListStr}.

Service Topology (from Collect phase):
${topologyStr}

External Dependencies:
${extDepsStr}

Inputs — read for verification:
- All service notes: .work/system-wide-notes/{service}.md (${svcListStr})
- All tech-design files: knowledge/04-microservices/*/tech-design.md

Task: Write exactly 1 file:
${artifactPath('03-system-architecture/C4-context-diagram.md')}

Structure:
1. System Context Diagram (C4 Level 1) — system + users + external systems
2. Container Diagram (C4 Level 2) — services, databases, message brokers, external APIs
3. Bounded Context Mapping — each service's bounded context, relationships (Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer, Open Host Service)
4. Service Inventory — table: Service | Type | Build | Dependencies | External Deps | Bounded Context
5. Integration View — how services communicate (REST, gRPC, messaging, events)
6. Key Architecture Decisions (cross-reference to ADRs if they exist)

Constraints:
- Reverse-engineering mode — architecture from actual code, not imagination
- Every service must appear in the diagram
- Every external dependency must be shown
- Use Mermaid diagrams for C4 levels (render as code blocks)
- Reference actual source evidence where possible
- Use your default templates for structure reference`
}

function codingConventionsPrompt(summary, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous Coding Conventions rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const patterns = summary.globalPatterns || {}
  const namingStr = (patterns.naming || []).map(p => `- ${p}`).join('\n') || '(not collected)'
  const structStr = (patterns.structure || []).map(p => `- ${p}`).join('\n') || '(not collected)'
  const errStr = (patterns.errorHandling || []).map(p => `- ${p}`).join('\n') || '(not collected)'
  const fwStr = (patterns.frameworks || []).map(p => `- ${p}`).join('\n') || '(not collected)'
  return `${prefix}${langInstr}
Context: System-wide merge for project "${projectName}". Generate Coding Conventions. ${svcCount} services: ${svcListStr}.

Patterns detected (from Collect phase):
Naming patterns:
${namingStr}

Structure patterns:
${structStr}

Error handling patterns:
${errStr}

Frameworks in use:
${fwStr}

Inputs — read for detailed analysis:
- All tech-design files: knowledge/04-microservices/*/tech-design.md
- All service notes: .work/system-wide-notes/{service}.md
- Any existing coding-conventions.md

Task: Write exactly 1 file:
${artifactPath('01-global-standards/coding-conventions.md')}

Structure:
1. Naming Conventions — packages, classes, methods, variables, config keys, env vars
2. Project Structure — monorepo layout, module conventions, resource organization
3. Error Handling — try/catch patterns, error propagation, error wrapping, logging levels
4. API Conventions — REST path patterns, request/response formats, pagination, versioning
5. Database Conventions — table naming, migration strategy, query patterns, transaction boundaries
6. Testing Conventions — test file naming, test structure, mock/stub conventions, coverage expectations
7. Configuration Management — env vars vs config files, feature flags, secrets handling
8. Dependency Management — version pinning, transitive dependency rules, allowed libraries

Constraints:
- Reverse-engineering mode — extract conventions from actual code patterns
- Be specific: "services use com.example.{service}.{layer} package structure" not "follows standard conventions"
- Include examples from the actual codebase
- Flag inconsistencies between services (e.g., "auth-service uses snake_case but payment-service uses camelCase")
- Use your default templates for structure reference`
}

function globalErrorCodesPrompt(summary, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous Global Error Codes rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const errorCount = (summary.allErrorCodes || []).length
  const categories = (summary.globalErrorCategories || []).join(', ') || '(not categorized)'
  const topErrors = (summary.allErrorCodes || []).slice(0, 30).map(e =>
    `- ${e.code}: ${e.description} [${e.service}] HTTP ${e.httpStatus || 'N/A'} (source: ${e.frSource || 'unknown'})`
  ).join('\n')
  return `${prefix}${langInstr}
Context: System-wide merge for project "${projectName}". Generate Global Error Codes. ${errorCount} error codes collected across ${svcCount} services: ${svcListStr}.

Error Categories detected: ${categories}

Error Codes (first 30 shown, read all from sources):
${topErrors}

Inputs — read ALL of these for complete error code list:
- All service notes: .work/system-wide-notes/{service}.md (error codes section)
- All FR files: knowledge/04-microservices/*/FR-*.md (error codes section in each FR)
- All tech-design files: knowledge/04-microservices/*/tech-design.md (error handling section)

Task: Write exactly 1 file:
${artifactPath('02-central-contracts/global-error-codes.md')}

Structure:
1. Error Code Format — how error codes are structured (e.g., CATEGORY-NNNN)
2. Error Categories — list of categories with descriptions and HTTP status ranges
3. Global Error Codes Table — complete table: Code | Description | HTTP Status | Source Service | FR Reference
4. Category Details — per category: common causes, resolution guidance, affected services
5. Cross-Service Errors — errors that can occur across service boundaries, circuit breaker triggers
6. Error Code Allocation Rules — how to create new error codes without conflicts

Constraints:
- Reverse-engineering mode — deduplicate by error code, merge descriptions from multiple sources
- Every error code must be listed exactly once (dedup across services)
- Prefer the most detailed description when merging duplicates
- Flag inconsistencies: same error code with different semantics across services
- Use your default templates for structure reference`
}

function hardBoundariesPrompt(summary, c4Summary, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous Hard Boundaries rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const topologyStr = (summary.serviceTopology || []).map(s =>
    `- ${s.name}: ${s.boundedContext || 'unspecified'} (deps: ${(s.dependencies || []).join(', ') || 'none'})`
  ).join('\n')
  return `${prefix}${langInstr}
Context: System-wide merge for project "${projectName}". Define Hard Boundaries. ${svcCount} services: ${svcListStr}.

Service Boundaries (from Collect):
${topologyStr}

Inputs — read these exact files:
- C4 Context Diagram: ${artifactPath('03-system-architecture/C4-context-diagram.md')}
- All service notes: .work/system-wide-notes/{service}.md
- All tech-design files: knowledge/04-microservices/*/tech-design.md

Task: Write exactly 1 file:
${artifactPath('01-global-standards/hard-boundaries.md')}

Structure:
1. Service Criticality Tiers — classify each service (Tier 0: critical path, Tier 1: important, Tier 2: supporting)
2. Data Consistency Boundaries — which services own which data, consistency models (strong, eventual, CQRS)
3. NFR Thresholds per Service — table: Service | p95 Latency | Throughput | Availability | RTO | RPO
4. Security Boundaries — auth domains, token propagation, service-to-service authn/authz
5. Deployment Boundaries — which services deploy together, deploy order, rollback groups
6. Ownership Boundaries — team ownership, code ownership rules, cross-team contracts
7. Anti-Corruption Boundaries — where ACLs are needed, translation layers, legacy integration points

Constraints:
- Reverse-engineering mode — extract boundaries from actual architecture, not ideal state
- Every service must be classified with a criticality tier with justification
- NFR thresholds from actual configs (not invented) — read config files referenced in tech-design
- Flag services with unclear or missing boundaries
- Use your default templates for structure reference`
}

function crossCuttingPrompt(summary, c4Summary, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous Cross-cutting Patterns rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const concerns = (summary.crossCuttingConcerns || []).map(c => `- ${c}`).join('\n') || '(not collected)'
  const eventsStr = (summary.allEvents || []).map(e =>
    `- ${e.name} (${e.type}) from ${e.service}: ${e.payloadSummary || 'no summary'}`
  ).join('\n') || '(no events)'
  return `${prefix}${langInstr}
Context: System-wide merge for project "${projectName}". Define Cross-cutting Patterns. ${svcCount} services: ${svcListStr}.

Cross-cutting concerns detected:
${concerns}

Events detected:
${eventsStr}

Inputs — read these exact files:
- C4 Context Diagram: ${artifactPath('03-system-architecture/C4-context-diagram.md')}
- Hard Boundaries: ${artifactPath('01-global-standards/hard-boundaries.md')}
- All tech-design files: knowledge/04-microservices/*/tech-design.md
- All service notes: .work/system-wide-notes/{service}.md

Task: Write exactly 1 file:
${artifactPath('01-global-standards/cross-cutting-patterns.md')}

Structure:
1. Shared Infrastructure — logging, metrics, tracing (which libraries, how configured, correlation IDs)
2. Authentication & Authorization — auth flow across services, token types, token propagation, RBAC model
3. Distributed Tracing — trace context propagation, span naming conventions, sampling rates
4. Configuration Management — config sources, feature flags, runtime config update patterns
5. Event-Driven Patterns — event taxonomy, event schema conventions, event versioning strategy
6. Resilience Patterns — circuit breakers (thresholds), retries (backoff strategy), bulkheads, timeouts
7. Data Consistency Patterns — saga orchestration, outbox pattern, idempotency keys, compensating transactions
8. API Gateway / Service Mesh — routing rules, rate limiting, TLS termination

Constraints:
- Reverse-engineering mode — extract patterns from actual implementations
- Every pattern must reference at least one service as evidence
- Flag services that deviate from the dominant pattern
- Use your default templates for structure reference`
}

function eventSpecPrompt(event, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous event spec for ${event.name} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Writing event specification for event "${event.name}" (${index} of ${total}) in project "${projectName}". Source service: ${event.service}. Event type: ${event.type}.

Inputs — read these exact files:
- ${event.service} notes: .work/system-wide-notes/${event.service}.md
- ${event.service} tech-design: knowledge/04-microservices/${event.service}/tech-design.md
- Cross-cutting patterns: ${artifactPath('01-global-standards/cross-cutting-patterns.md')}
- Existing event specs: knowledge/02-central-contracts/events/evt-*.yaml (for reference, to ensure consistency)

Task: Write exactly 1 file:
${artifactPath(`02-central-contracts/events/evt-${event.name}.yaml`)}

YAML structure:
\`\`\`yaml
name: ${event.name}
type: ${event.type}  # published | consumed
source: ${event.service}
description: |
  Detailed description of when and why this event is emitted/consumed.
schema:
  # Full event payload schema with types and descriptions
  properties:
    eventId: { type: string, description: "Unique event identifier (UUID v4)" }
    timestamp: { type: string, format: date-time }
    # ... actual payload fields from the codebase
consumers:
  - service: consuming-service-name
    handler: path/to/handler
    processing: sync | async | batch
publishers:
  - service: publishing-service-name
    trigger: what causes this event to fire
    location: path/to/publisher/code
versioning:
  current: "1.0.0"
  strategy: "backward-compatible additions only"
\`\`\`

Constraints:
- Reverse-engineering mode — extract event schema from actual code (annotations, serialization, message classes)
- Every field must have a source code trace
- Cross-reference consumers from other service notes
- Follow the same YAML structure as other event specs in the directory
- Use your default templates for structure reference`
}

function apiSpecPrompt(svc, total, index, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous API spec for ${svc} rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  return `${prefix}${langInstr}
Context: Writing OpenAPI specification for service "${svc}" (${index} of ${total}) in project "${projectName}".

Inputs — read these exact files:
- ${svc} notes: .work/system-wide-notes/${svc}.md
- ${svc} tech-design: knowledge/04-microservices/${svc}/tech-design.md
- ${svc} FR files: knowledge/04-microservices/${svc}/FR-*.md
- C4 Context Diagram: ${artifactPath('03-system-architecture/C4-context-diagram.md')}

Task: Write exactly 1 file:
${artifactPath(`02-central-contracts/apis/${svc}-api.yaml`)}

This is an OpenAPI 3.0 specification covering ALL endpoints in ${svc}. Structure:
- info section (title, version, description)
- servers (base URL, environment variants)
- paths (EVERY endpoint from FR files and tech-design)
- components/schemas (request/response models)
- components/securitySchemes (auth method)
- tags (group endpoints by domain/EPIC)

Constraints:
- Reverse-engineering mode — extract API contracts from actual code (controllers, routes, annotations, OpenAPI annotations)
- Every endpoint must trace to an FR-ID or source code path
- Include error responses for every endpoint
- Follow OpenAPI 3.0 standards
- Use your default templates for structure reference`
}

function adrPrompt(adr, total, index, nnn, feedback, retryNum) {
  let prefix = feedback
    ? `RETRY #${retryNum}: Previous ADR for "${adr.title}" rejected. Feedback: ${feedback}\nFix these specific issues.\n\n`
    : ''
  const optionsStr = (adr.options || []).map((o, i) => `${i + 1}. ${o}`).join('\n')
  return `${prefix}${langInstr}
Context: Writing Architecture Decision Record ADR-${nnn} for "${adr.title}" (${index} of ${total}) in project "${projectName}".

Decision context: ${adr.context}

Options considered:
${optionsStr || '(read source files to identify options)'}

Recommendation from Collect phase: ${adr.recommendation || 'TBD'}

Inputs — read these exact files:
- C4 Context Diagram: ${artifactPath('03-system-architecture/C4-context-diagram.md')}
- Hard Boundaries: ${artifactPath('01-global-standards/hard-boundaries.md')}
- Cross-cutting Patterns: ${artifactPath('01-global-standards/cross-cutting-patterns.md')}
- Relevant tech-design files: knowledge/04-microservices/*/tech-design.md
- Any existing ADRs: knowledge/03-system-architecture/ADRs/ADR-*.md

Task: Write exactly 1 file:
${artifactPath(`03-system-architecture/ADRs/ADR-${nnn}--${slug}.md`)}

ADR structure (follow standard MADR format):
1. Title — short noun phrase
2. Status — "Proposed" (reverse-engineered, needs human confirmation)
3. Context — what problem does this decision solve? what constraints exist?
4. Decision — what was decided? be specific.
5. Consequences — what becomes easier? harder? what are the trade-offs?
6. Options Considered — each option with pros/cons and why rejected
7. References — source files, existing ADRs, tech-design sections

Constraints:
- Reverse-engineering mode — extract the decision that was ACTUALLY made in the code, not ideal
- Reference actual code patterns as evidence for the decision
- Flag where the codebase is inconsistent with the stated decision
- Use existing ADR files as template for consistency
- Use your default templates for structure reference`
}

function finalGatePrompt() {
  return `${langInstr}
Context: Final consistency verification for system-wide merge of project "${projectName}". ${svcCount} services: ${svcListStr}.

Task: Verify cross-artifact consistency across ALL system-wide documents. Read-only — do not modify any files.

Check these consistency rules:
1. Every event in events/*.yaml is referenced by at least one service's tech-design or FR
2. Every API endpoint in apis/*-api.yaml matches the endpoints described in tech-design
3. All error codes in global-error-codes.md are referenced by at least one FR file
4. Service dependencies in C4-context-diagram.md match dependencies in each service's tech-design.md
5. Hard boundaries are consistent with C4 bounded contexts
6. Cross-cutting patterns match actual implementations in tech-design files
7. ADRs reference the correct services and patterns
8. No orphaned artifacts (files with no cross-references)

Report: pass/fail with specific inconsistencies found. For each inconsistency: artifact path, what's wrong, suggested fix.

This is the FINAL gate before the merge is complete. Be thorough.`
}

// ═══════════════════════════════════════════
// SYSTEM-WIDE MERGE PIPELINE
// ═══════════════════════════════════════════

const skipped = []
const completed = []
let summary = null

// ── Phase 0: Collect ──
if (startOrder <= 0) {
  phase('Collect')
  log(`Collect: reading outputs from ${svcCount} services: ${svcListStr}`)
  summary = await agent(collectPrompt(), {
    label: 'collect-all',
    phase: 'Collect',
    agentType: 'Explore',
    schema: COLLECT_SUMMARY,
  })

  if (!summary || !summary.serviceTopology || summary.serviceTopology.length === 0) {
    log('WARNING: Collect phase returned incomplete summary. Proceeding with available data.')
    summary = summary || { serviceTopology: [], allErrorCodes: [], allEvents: [], allADRCandidates: [], allExternalDeps: [] }
  }

  log(`Collect: ${summary.serviceTopology.length} services, ${summary.allErrorCodes.length} error codes, ${summary.allEvents.length} events, ${summary.allADRCandidates.length} ADR candidates, ${summary.allExternalDeps.length} external deps`)
  completed.push('Collect')
} else {
  log(`✓ Collect: skipped (fromPhase: ${fromPhase})`)
  skipped.push('Collect')
  // Need minimal summary from existing files for downstream phases
  summary = await agent(
    `Read these files to build a minimal summary for downstream merge phases:
- knowledge/03-system-architecture/C4-context-diagram.md (if exists)
- knowledge/02-central-contracts/events/evt-*.yaml (if any)
- .work/system-wide-notes/*.md (if any)

Return the same structured summary schema.`,
    { label: 'collect-minimal', agentType: 'Explore', schema: COLLECT_SUMMARY }
  ) || { serviceTopology: [], allErrorCodes: [], allEvents: [], allADRCandidates: [], allExternalDeps: [] }
}

// ── Phase 1: C4 ∥ Coding Conventions ∥ Global Error Codes ──
let c4Result = { passed: true }
if (startOrder <= 1) {
  phase('C4+Coding+Errors')
  log('Phase 1: C4 ∥ Coding Conventions ∥ Global Error Codes (3 agents parallel)')

  const [c4Gate, codingGate, errorCodesGate] = await parallel([
    async () => {
      log('C4: generating context diagram')
      return await runWithGate(
        'C4',
        'hld',
        (fb, rn) => c4Prompt(summary, fb, rn),
        'C4 Context Diagram',
        2,  // maxRetries x2
        'C4+Coding+Errors'
      )
    },
    async () => {
      log('Coding-Conventions: generating coding standards')
      return await runWithGate(
        'Coding-Conventions',
        'general-purpose',
        (fb, rn) => codingConventionsPrompt(summary, fb, rn),
        'Coding Conventions',
        1,  // maxRetries x1
        'C4+Coding+Errors'
      )
    },
    async () => {
      log('Global-Error-Codes: deduplicating and organizing error codes')
      return await runWithGate(
        'Global-Error-Codes',
        'general-purpose',
        (fb, rn) => globalErrorCodesPrompt(summary, fb, rn),
        'Global Error Codes',
        1,  // maxRetries x1
        'C4+Coding+Errors'
      )
    },
  ])

  c4Result = c4Gate || { passed: false, feedback: 'agent error' }
  if (!c4Result.passed) {
    return {
      phase: 'C4',
      error: 'Gate failed after 2 retries',
      feedback: c4Result.feedback,
      completed
    }
  }
  completed.push('C4')

  if (codingGate && codingGate.passed) completed.push('Coding-Conventions')
  else log('⚠ Coding-Conventions gate did not pass — continuing')

  if (errorCodesGate && errorCodesGate.passed) completed.push('Global-Error-Codes')
  else log('⚠ Global-Error-Codes gate did not pass — continuing')
} else {
  log('✓ Phase 1 (C4+Coding+Errors): skipped')
  skipped.push('C4+Coding+Errors')
}

// ── Phase 2: Hard Boundaries ∥ Cross-cutting Patterns ──
if (startOrder <= 2) {
  phase('Boundaries+CrossCutting')
  log('Phase 2: Hard Boundaries ∥ Cross-cutting Patterns (2 agents parallel, needs C4)')

  const c4Status = c4Result.passed ? 'C4 diagram available at knowledge/03-system-architecture/C4-context-diagram.md' : 'C4 not available — use summary topology'

  const [boundariesGate, crossCuttingGate] = await parallel([
    async () => {
      log('Hard-Boundaries: defining service boundaries')
      return await runWithGate(
        'Hard-Boundaries',
        'general-purpose',
        (fb, rn) => hardBoundariesPrompt(summary, c4Status, fb, rn),
        'Hard Boundaries',
        1,
        'Boundaries+CrossCutting'
      )
    },
    async () => {
      log('Cross-Cutting: identifying shared patterns')
      return await runWithGate(
        'Cross-Cutting',
        'general-purpose',
        (fb, rn) => crossCuttingPrompt(summary, c4Status, fb, rn),
        'Cross-cutting Patterns',
        1,
        'Boundaries+CrossCutting'
      )
    },
  ])

  if (boundariesGate && boundariesGate.passed) completed.push('Hard-Boundaries')
  else log('⚠ Hard-Boundaries gate did not pass — continuing')

  if (crossCuttingGate && crossCuttingGate.passed) completed.push('Cross-Cutting')
  else log('⚠ Cross-Cutting gate did not pass — continuing')
} else {
  log('✓ Phase 2 (Boundaries+CrossCutting): skipped')
  skipped.push('Boundaries+CrossCutting')
}

// ── Phase 3: Events ∥ APIs (2 parallel pipelines) ──
let eventsResult = { total: 0, generated: 0 }
let apisResult = { total: 0, generated: 0 }

if (startOrder <= 3) {
  phase('Events+APIs')
  log('Phase 3: Events ∥ APIs (2 parallel pipelines)')

  const events = summary.allEvents || []
  const svcsForApis = summary.serviceTopology ? summary.serviceTopology.filter(s => s.type === 'service').map(s => s.name) : svcList

  const [evtResults, apiResults] = await parallel([
    async () => {
      if (events.length === 0) {
        log('Events: no events to generate — skipping')
        return []
      }
      log(`Events pipeline: ${events.length} event(s)`)
      return await pipeline(
        events,
        async (event, _, idx) => {
          const index = idx + 1
          const total = events.length
          log(`Events: evt-${event.name} (${index}/${total})`)
          const gate = await runWithGate(
            `Evt-${event.name}`,
            'general-purpose',
            (fb, rn) => eventSpecPrompt(event, total, index, fb, rn),
            `Event: ${event.name}`,
            1,
            'Events+APIs'
          )
          return {
            name: event.name,
            file: `knowledge/02-central-contracts/events/evt-${event.name}.yaml`,
            passed: gate.passed,
          }
        }
      )
    },
    async () => {
      if (svcsForApis.length === 0) {
        log('APIs: no services to generate APIs for — skipping')
        return []
      }
      log(`APIs pipeline: ${svcsForApis.length} service(s)`)
      return await pipeline(
        svcsForApis,
        async (svc, _, idx) => {
          const index = idx + 1
          const total = svcsForApis.length
          log(`APIs: ${svc}-api.yaml (${index}/${total})`)
          const gate = await runWithGate(
            `API-${svc}`,
            'lld',
            (fb, rn) => apiSpecPrompt(svc, total, index, fb, rn),
            `API: ${svc}`,
            1,
            'Events+APIs'
          )
          return {
            service: svc,
            file: `knowledge/02-central-contracts/apis/${svc}-api.yaml`,
            passed: gate.passed,
          }
        }
      )
    },
  ])

  const validEvents = (evtResults || []).filter(Boolean)
  const validApis = (apiResults || []).filter(Boolean)
  eventsResult = {
    total: events.length,
    generated: validEvents.filter(e => e.passed).length,
    failed: validEvents.filter(e => !e.passed).map(e => e.name),
  }
  apisResult = {
    total: svcsForApis.length,
    generated: validApis.filter(a => a.passed).length,
    failed: validApis.filter(a => !a.passed).map(a => a.service),
  }

  if (eventsResult.generated > 0) completed.push('Events')
  if (apisResult.generated > 0) completed.push('APIs')
  log(`Events: ${eventsResult.generated}/${eventsResult.total} generated`)
  log(`APIs: ${apisResult.generated}/${apisResult.total} generated`)
} else {
  log('✓ Phase 3 (Events+APIs): skipped')
  skipped.push('Events+APIs')
}

// ── Phase 4: ADRs (pipeline per candidate) ──
let adrsResult = { total: 0, generated: 0 }

if (startOrder <= 4) {
  phase('ADRs')
  const adrCandidates = summary.allADRCandidates || []

  if (adrCandidates.length === 0) {
    log('ADRs: no ADR candidates — skipping Phase 4')
    skipped.push('ADRs')
  } else {
    log(`ADRs pipeline: ${adrCandidates.length} candidate(s)`)

    const adrResults = await pipeline(
      adrCandidates,
      async (adr, _, idx) => {
        const index = idx + 1
        const total = adrCandidates.length
        const nnn = String(idx + 1).padStart(3, '0')
        log(`ADRs: ADR-${nnn} "${adr.title}" (${index}/${total})`)
        const gate = await runWithGate(
          `ADR-${nnn}`,
          'hld',
          (fb, rn) => adrPrompt(adr, total, index, nnn, fb, rn),
          `ADR-${nnn}: ${adr.title}`,
          1,
          'ADRs'
        )
        return {
          number: nnn,
          title: adr.title,
          file: `knowledge/03-system-architecture/ADRs/ADR-${nnn}--${slug}.md`,
          passed: gate.passed,
        }
      }
    )

    const validAdrs = (adrResults || []).filter(Boolean)
    adrsResult = {
      total: adrCandidates.length,
      generated: validAdrs.filter(a => a.passed).length,
      failed: validAdrs.filter(a => !a.passed).map(a => a.number),
    }

    if (adrsResult.generated > 0) completed.push('ADRs')
    log(`ADRs: ${adrsResult.generated}/${adrsResult.total} generated`)
  }
} else {
  log('✓ Phase 4 (ADRs): skipped')
  skipped.push('ADRs')
}

// ── Phase 5: Final Gate ──
let gateResult = { passed: true }
phase('Final-Gate')
log('Final Gate: cross-artifact consistency verification')

const finalGate = await gateCheck('System-Wide Merge')
if (!finalGate.passed) {
  log(`⚠ Final Gate: consistency issues found — ${finalGate.feedback}`)
  // Final gate failure is non-blocking — report but don't crash
  gateResult = { passed: false, feedback: finalGate.feedback }
} else {
  log('✓ Final Gate: all artifacts consistent')
  completed.push('Gate')
}

// ── Return ──
return {
  completed: [...skipped, ...completed],
  skipped,
  ran: completed,
  services: svcList,
  results: {
    collect: { servicesFound: (summary && summary.serviceTopology) ? summary.serviceTopology.length : 0 },
    c4: c4Result,
    codingConventions: { passed: completed.includes('Coding-Conventions') },
    globalErrorCodes: {
      passed: completed.includes('Global-Error-Codes'),
      totalCodes: (summary && summary.allErrorCodes) ? summary.allErrorCodes.length : 0,
    },
    hardBoundaries: { passed: completed.includes('Hard-Boundaries') },
    crossCutting: { passed: completed.includes('Cross-Cutting') },
    events: eventsResult,
    apis: apisResult,
    adrs: adrsResult,
    gate: gateResult,
  }
}

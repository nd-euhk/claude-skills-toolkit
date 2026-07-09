export const meta = {
  name: 'codebase-reverse',
  description: 'Reverse engineer codebase → agent_docs/ with per-service and per-domain fan-out, inter-phase gates with retry (max 3), adversarial SRS verification (codebase-srs-verify agent with 3-lens analysis per domain), and skip-to-report on gate exhaustion.',
  phases: [
    { title: 'HLD', detail: 'Extract architecture from code (single agent — cross-cutting)' },
    { title: 'Gate:HLD', detail: 'Validate HLD outputs against 6 criteria' },
    { title: 'LLD', detail: 'Fan-out per service + cross-service synthesis' },
    { title: 'Gate:LLD', detail: 'Validate LLD outputs against 5 criteria per service' },
    { title: 'SRS', detail: 'Fan-out per domain + cross-domain synthesis' },
    { title: 'SRS-Verify', detail: 'Adversarially verify inferred FRs with codebase-srs-verify agent (3-lens analysis + Explore subagents) per domain' },
    { title: 'Gate:SRS', detail: 'Validate SRS outputs against 4 criteria per domain' },
    { title: 'IMP+TST', detail: 'Fan-out per domain (IMP ∥ TST per domain concurrently)' },
    { title: 'Gate:IMP+TST', detail: 'Validate IMP (5 criteria) and TST (5 criteria) per domain' },
    { title: 'Report', detail: 'Cross-reference validation + completeness critic + gate failure summary' },
  ],
}

// === SAFE-PARSE ARGS (MANDATORY) ===

const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const {
  scope = '.',
  scoutReportPath,
  services = [],
  domains = [],
  artifacts = ['hld', 'lld', 'srs', 'imp', 'tst'],
  focus,
  foundationPath = 'agent_docs/',
  workDir,
  adversarial = true,
} = _args

// -- Phase Selection --
const runHLD = artifacts.includes('hld')
const runLLD = artifacts.includes('lld')
const runSRS = artifacts.includes('srs')
const runIMP = artifacts.includes('imp')
const runTST = artifacts.includes('tst')

// Derived counts
const serviceCount = services.length
const domainCount = domains.length

// === GATE + RETRY CONFIG ===

const MAX_RETRIES = 3
const MAX_VERIFY_RETRIES = 2
let skipRemaining = false
const gateResults = []  // accumulated gate results for final report


// === HELPER FUNCTIONS ===

const SUMMARY_MAX_CHARS = 600

function extractSummary(agentResult, label) {
  if (!agentResult) return '(no result)'
  const text = typeof agentResult === 'string' ? agentResult : JSON.stringify(agentResult)
  const idx = text.lastIndexOf('Summary for Synthesis')
  if (idx === -1) {
    const truncated = text.substring(0, SUMMARY_MAX_CHARS)
    if (text.length > SUMMARY_MAX_CHARS) {
      log(`⚠️ ${label}: No "Summary for Synthesis" found — using first ${SUMMARY_MAX_CHARS} chars (of ${text.length})`)
    }
    return truncated
  }
  const summary = text.substring(idx, idx + SUMMARY_MAX_CHARS)
  if (idx + SUMMARY_MAX_CHARS < text.length) {
    log(`⚠️ ${label}: Summary for Synthesis truncated at ${SUMMARY_MAX_CHARS} chars`)
  }
  return summary
}

function countIssues(agentResult) {
  if (!agentResult) return 0
  const text = typeof agentResult === 'string' ? agentResult : JSON.stringify(agentResult)
  return (text.match(/⚠️/g) || []).length
}

function extractOutputs(agentResult) {
  if (!agentResult) return []
  const text = typeof agentResult === 'string' ? agentResult : JSON.stringify(agentResult)
  const matches = text.matchAll(/agent_docs\/[^\s,\)]+\.(?:md|yaml|yml)/g)
  return [...new Set([...matches].map(m => m[0]))]
}

function parseGateResult(gateResult) {
  // Parse GATE_VERDICT from the first line
  if (!gateResult) return { passed: false, verdict: 'ERROR', details: 'No gate result returned' }
  const text = typeof gateResult === 'string' ? gateResult : JSON.stringify(gateResult)
  const passed = /GATE_VERDICT:\s*PASS/i.test(text)
  // Extract summary line: "Summary: PASS|FAIL — N/M criteria met"
  const summaryMatch = text.match(/Summary:\s*(PASS|FAIL)\s*[—\-]\s*(\d+)\/(\d+)/i)
  return {
    passed,
    verdict: passed ? 'PASS' : 'FAIL',
    summary: summaryMatch ? summaryMatch[0] : (passed ? 'PASS' : 'FAIL'),
    passedCount: summaryMatch ? parseInt(summaryMatch[2]) : (passed ? '?' : 0),
    totalCount: summaryMatch ? parseInt(summaryMatch[3]) : '?',
    details: text.substring(0, 2000),  // truncated for log context
  }
}

// === GATE + RETRY ENGINE ===

/**
 * Run a gate check against phase outputs with retry.
 * On FAIL with retries remaining: calls rerunFn(failureFeedback) then re-gates.
 * On FAIL after MAX_RETRIES: sets skipRemaining = true.
 * Returns { passed, attempt, parsed }.
 */
async function gateCheck(phase, context, rerunFn, expectedOutputs) {
  let previousFailure = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log('')
    log(attempt === 1
      ? `🚦 Gate ${phase}: checking...`
      : `🚦 Gate ${phase}: retry check (attempt ${attempt}/${MAX_RETRIES})...`)

    const result = await agent(gatePrompt(phase, attempt, previousFailure, context, expectedOutputs), {
      label: `Gate: ${phase} (${attempt}/${MAX_RETRIES})`,
      phase: `Gate:${phase.toUpperCase()}`,
      agentType: 'codebase-gate',
    })

    const parsed = parseGateResult(result)
    gateResults.push({ phase, attempt, ...parsed })

    if (parsed.passed) {
      log(`✅ Gate ${phase}: PASS (${parsed.passedCount}/${parsed.totalCount} criteria met, attempt ${attempt}/${MAX_RETRIES})`)
      return { passed: true, attempt, parsed }
    }

    log(`❌ Gate ${phase}: FAIL (${parsed.passedCount}/${parsed.totalCount} criteria met, attempt ${attempt}/${MAX_RETRIES})`)

    if (attempt < MAX_RETRIES) {
      log(`🔄 Retrying ${phase} phase with failure feedback...`)
      previousFailure = parsed.details
      // Re-run the phase agent(s) with feedback about what failed
      await rerunFn(parsed.details)
    }
  }

  // All retries exhausted
  log(`🛑 Gate ${phase}: FAILED after ${MAX_RETRIES} attempts — skipping all remaining phases`)
  skipRemaining = true
  return { passed: false, attempt: MAX_RETRIES, parsed: { passed: false, verdict: 'FAIL', summary: `Failed after ${MAX_RETRIES} attempts` } }
}

function gatePrompt(phase, attempt, previousFailure, context, expectedOutputs) {
  const { services, domains } = context
  let prompt = `## GATE: Validate ${phase.toUpperCase()} Phase Outputs

## Context
- **Phase**: ${phase}
- **Attempt**: ${attempt}/${MAX_RETRIES}
- **Services**: ${services.map(s => s.name).join(', ') || 'none'}
- **Domains**: ${domains.map(d => d.name).join(', ') || 'none'}
- **Expected outputs**: ${(expectedOutputs || []).join(', ') || 'auto-detect from agent_docs/'}
- **Foundation path**: ${foundationPath}

## Instructions
1. Read the actual files from agent_docs/ — verify independently
2. Run ALL gate criteria for phase "${phase}" (see your system prompt for criteria)
3. Report per-entity breakdown (per service for LLD, per domain for SRS/IMP/TST)
4. Be specific — name exact files and criteria #s that fail
`

  if (attempt > 1 && previousFailure) {
    prompt += `
## Previous Attempt Failed (Attempt ${attempt - 1})
The following criteria failed on the previous attempt. FOCUS on verifying these were addressed:
${previousFailure.substring(0, 1500)}

## IMPORTANT
- Check whether previously-failed criteria are now FIXED
- Flag any REGRESSION (criteria that passed before but now fail)
`
  }

  prompt += `
## CRITICAL
- First line of your response MUST be exactly "GATE_VERDICT: PASS" or "GATE_VERDICT: FAIL"
- Do NOT write any files — return results directly
- Be strict — a criterion is either met or not met (no partial credit)
`
  return prompt
}

function failureFeedbackForAgent(phase, failureDetails, entityName) {
  // Extract failed criteria from gate output to give targeted feedback
  const failedCriteria = []
  const lines = failureDetails.split('\n')
  for (const line of lines) {
    // Match lines like "| H1 | C4 diagram | ❌ | ..."
    const m = line.match(/\|\s*([A-Z]+\d+)\s*\|\s*([^|]+)\s*\|\s*❌/i)
    if (m) {
      failedCriteria.push(`${m[1]}: ${m[2].trim()}`)
    }
  }

  if (failedCriteria.length === 0) {
    return `\n\n## ⚠️ PREVIOUS ATTEMPT FAILED GATE CHECK\nThe previous output did not pass the ${phase} gate. Please review and ensure:\n- All required sections are present and complete\n- Every claim has code evidence (file:line)\n- UNCERTAINTY flags are used where evidence is insufficient\n- Summary for Synthesis section is included\n`
  }

  const criteriaList = failedCriteria.map(c => `  - ${c}`).join('\n')
  return `\n\n## ⚠️ PREVIOUS ATTEMPT FAILED GATE CHECK — FIX THESE SPECIFIC ISSUES\nThe following gate criteria failed. Address EACH one:\n${criteriaList}\n\nInstructions:\n- Do NOT rewrite the entire output — fix only the sections that failed\n- Add missing evidence (file:line references)\n- Add missing sections or flags\n- Preserve sections that already passed\n`
}


// ═══════════════════════════════════════════
// SRS ADVERSARIAL VERIFICATION
// ═══════════════════════════════════════════

const SRS_VERIFY_SCHEMA = {
  type: "object",
  properties: {
    domain: { type: "string" },
    fr_verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fr_id: { type: "string" },
          verdict: { type: "string", enum: ["CONFIRMED", "UNCERTAIN", "REJECTED"] },
          reasoning: { type: "string" },
          concerns: { type: "array", items: { type: "string" } },
        },
        required: ["fr_id", "verdict", "reasoning"],
      },
    },
    summary: { type: "string" },
  },
  required: ["domain", "fr_verdicts"],
}

// Single skeptic prompt — delegates to codebase-srs-verify agent which applies
// all 3 lenses internally (Code Evidence, Behavioral Completeness, Business Coherence)
// and spawns Explore subagents for deep code verification.
function verifySRSPrompt(domain, frGlob) {
  return `Verify all SRS outputs for domain "${domain.name}" using adversarial verification.

## Domain: ${domain.name}
## FR File Pattern: ${frGlob}

## Task
1. Use \`ls ${frGlob}\` to discover all FR files for this domain
2. Read every FR file fully
3. Read scout report at agent_docs/scout-report.md, HLD at agent_docs/architecture.md, and relevant LLD sections
4. Apply ALL 3 lenses (Code Evidence, Behavioral Completeness, Business Coherence) to EVERY FR
5. Spawn Explore subagents to verify code evidence claims, find missing error paths, and check auth patterns
6. Assign each FR a final verdict: CONFIRMED, UNCERTAIN, or REJECTED
7. Return structured output with verdict for EVERY FR in the domain

## CRITICAL
- Do NOT skip any FR — every FR in the domain gets a verdict
- Reasoning MUST reference all 3 lenses and EXPLAIN why the verdict was chosen
- Concerns MUST be specific and actionable (file:line references, concrete missing scenarios)
- Spawn Explore subagents strategically (max 5, batch related checks)
- Be skeptical but fair — reverse engineering is hard, UNCERTAINTY is valid`
}

/**
 * Run adversarial verification on SRS outputs for all domains.
 * For each domain, 1 codebase-srs-verify agent applies all 3 skeptic lenses
 * (Code Evidence, Behavioral Completeness, Business Coherence) and spawns
 * Explore subagents for deep code verification.
 * Returns consolidated verdicts per domain, passed to SRS synthesis.
 */
async function verifySRSForDomains(domains, srsResults) {
  const allVerdicts = {}
  const verificationStats = { total: 0, confirmed: 0, uncertain: 0, rejected: 0 }

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]
    const result = srsResults[i]
    if (!result) {
      log(`SRS-Verify: ${domain.name} — skipped (no SRS result)`)
      continue
    }

    log(`SRS-Verify: ${domain.name} — dispatching codebase-srs-verify agent...`)

    // Try to extract FR file paths from SRS output (for logging)
    const frFiles = extractOutputs(result).filter(f => f.match(new RegExp(`FR-${domain.name.toUpperCase()}-\\\\d+`)))
    const frGlob = `${foundationPath}features/FR-${domain.name.toUpperCase()}-*.md`
    log(`SRS-Verify: ${domain.name} — FR glob: ${frGlob} (${frFiles.length} path(s) extracted from SRS output)`)

    // Single codebase-srs-verify agent applies all 3 lenses + spawns Explore subagents
    const verifyResult = await agent(verifySRSPrompt(domain, frGlob), {
      label: `verify:srs:${domain.name}`,
      phase: 'SRS-Verify',
      agentType: 'codebase-srs-verify',
      schema: SRS_VERIFY_SCHEMA,
    })

    if (!verifyResult) {
      log(`SRS-Verify: ${domain.name} — WARNING: codebase-srs-verify agent returned no results`)
      continue
    }

    // Agent produces final verdicts directly (all 3 lenses applied internally, no majority vote needed)
    const consolidatedFRs = (verifyResult.fr_verdicts || []).map(frv => ({
      fr_id: frv.fr_id,
      verdict: frv.verdict,
      reasonings: [frv.reasoning],
      concerns: frv.concerns || [],
    }))

    for (const fr of consolidatedFRs) {
      verificationStats.total++
      if (fr.verdict === 'CONFIRMED') verificationStats.confirmed++
      else if (fr.verdict === 'UNCERTAIN') verificationStats.uncertain++
      else verificationStats.rejected++
      log(`  ${fr.fr_id}: ${fr.verdict}`)
    }

    allVerdicts[domain.name] = {
      frs: consolidatedFRs,
      stats: {
        total: consolidatedFRs.length,
        confirmed: consolidatedFRs.filter(f => f.verdict === 'CONFIRMED').length,
        uncertain: consolidatedFRs.filter(f => f.verdict === 'UNCERTAIN').length,
        rejected: consolidatedFRs.filter(f => f.verdict === 'REJECTED').length,
      },
    }
  }

  log(`SRS-Verify complete: ${verificationStats.total} FRs — ${verificationStats.confirmed} CONFIRMED, ${verificationStats.uncertain} UNCERTAIN, ${verificationStats.rejected} REJECTED`)
  return { verdicts: allVerdicts, stats: verificationStats }
}

/**
 * Write back verification verdicts to FR files on disk.
 * Extracted as a helper so it can be called both after the initial retry loop
 * and after gate-induced SRS re-runs.
 */
async function writebackVerificationVerdicts(verificationResult) {
  if (!verificationResult) return

  const vs = verificationResult.stats
  log(`SRS-Verify final: ${vs.total} FRs — ${vs.confirmed} CONFIRMED, ${vs.uncertain} UNCERTAIN, ${vs.rejected} REJECTED`)

  log('Writing verification verdicts to FR files...')
  const writebackTasks = []
  for (const [domainName, data] of Object.entries(verificationResult.verdicts)) {
    const frGlob = `${foundationPath}features/FR-${domainName.toUpperCase()}-*.md`
    const verdictMap = {}
    for (const fr of data.frs) {
      verdictMap[fr.fr_id] = { verdict: fr.verdict, concerns: fr.concerns, reasonings: fr.reasonings }
    }

    // Build conditional sections — only include what this domain needs
    const rejectedEntries = Object.entries(verdictMap).filter(([, v]) => v.verdict === 'REJECTED')
    const uncertainEntries = Object.entries(verdictMap).filter(([, v]) => v.verdict === 'UNCERTAIN')

    let extraSections = ''

    if (rejectedEntries.length > 0) {
      extraSections += `
### For REJECTED FRs ONLY
After the frontmatter, add this section at the END of each REJECTED FR file:
\`\`\`markdown
## ⚠️ Verification Rejected

This FR was **REJECTED** by adversarial verification.

### Skeptic Concerns
${rejectedEntries.map(([id, v]) => `**${id}**: ${(v.concerns || ['insufficient evidence']).join('; ')}`).join('\n')}

### What This Means
- This FR will be **excluded** from the unified feature index
- IMP and TST agents will **skip** this FR
- Human review is **required** before this FR can be used
\`\`\`
`
    }

    if (uncertainEntries.length > 0) {
      extraSections += `
### For UNCERTAIN FRs ONLY
After the frontmatter, add this section at the END of each UNCERTAIN FR file:
\`\`\`markdown
## ⚠️ Verification Uncertain

This FR was flagged as **UNCERTAIN** by adversarial verification.

### Skeptic Concerns
${uncertainEntries.map(([id, v]) => `**${id}**: ${(v.concerns || ['mixed verdict']).join('; ')}`).join('\n')}

### What This Means
- This FR is included in the feature index but **flagged for human review**
- IMP and TST agents will process this FR normally
- Review the concerns above and confirm or reject manually
\`\`\`
`
    }

    writebackTasks.push(() => agent(
      `## Task: Update verification status in FR files for domain ${domainName}

Read each FR file matching \`${frGlob}\` and update the frontmatter:
- Change \`verification: pending\` to the correct verdict (see map below)
- Change \`verification_date: ""\` to \`verification_date: "${new Date().toISOString().split('T')[0]}"\`

### FR Verdict Map
${Object.entries(verdictMap).map(([id, v]) => `- **${id}**: ${v.verdict}`).join('\n')}
${extraSections}
### CRITICAL
- ONLY update the frontmatter fields (verification, verification_date)
- ONLY add the rejection/uncertainty sections for REJECTED/UNCERTAIN FRs as instructed above
- Do NOT change any other content in the FR file
- For CONFIRMED FRs, just update the frontmatter — no extra section needed`,
      { label: `writeback:verify:${domainName}`, phase: 'SRS-Verify', agentType: 'general-purpose' }
    ))
  }

  if (writebackTasks.length > 0) {
    await parallel(writebackTasks)
    log('Verification verdicts written to FR files')
  }
}


// === PROMPT BUILDERS ===
// Each prompt builder accepts an optional failureFeedback string.
// When provided, it appends targeted failure feedback to the prompt.

function hldPrompt(failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — HLD

Extract system architecture from EXISTING code. Do NOT design new architecture.

## Context
- **Scout Report**: ${scoutReportPath}
- **Scope**: ${scope}
- **Foundation**: ${foundationPath}project-overview.md, ${foundationPath}user-context.md
- **Services detected**: ${serviceCount > 0 ? services.map(s => `${s.name} (${s.path}, ${s.type})`).join(', ') : 'Auto-detect from scout report'}
${focus ? `- **Focus**: ${focus}` : ''}

## Expected Outputs
1. ${foundationPath}architecture.md — C4 Container diagram (Mermaid), service descriptions, architecture style justification
2. ${foundationPath}adrs/ADR-{NNN}--{slug}.md — minimum 3 base ADRs (architecture style, communication pattern, data strategy)
3. ${foundationPath}adrs/README.md — ADR index with status tracking
4. ${foundationPath}contracts/api-conventions.md — observed URL/HTTP patterns
5. ${foundationPath}contracts/events.md — event types found in code
6. ${foundationPath}hard-boundaries.md — data ownership, communication rules, security boundaries

## CRITICAL
- Every claim needs code evidence (file:line) or UNCERTAINTY flag
- Infer service list from code if not provided
- Include "Summary for Synthesis" section with suggested domain groupings at the end`
  if (failureFeedback) p += failureFeedback
  return p
}

function lldPrompt(svc, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — LLD for ${svc.name}

Extract per-service technical design from EXISTING code for service "${svc.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **HLD**: ${foundationPath}architecture.md
- **Service**: ${svc.name} (path: ${svc.path}, type: ${svc.type})
- **Scope**: ${scope}

## Task — 9 Sections
Document all 9 sections for ${svc.name}, with code evidence (file:line) for each:

1. **Domain Model** — entities, value objects, aggregates, relationships
2. **API Contracts** — REST/GraphQL/gRPC endpoints, DTOs, auth requirements
3. **Data Storage** — DB type, schema overview, index/migration strategy
4. **Transaction Boundaries** — @Transactional blocks, saga patterns, unit of work
5. **Error Handling** — exception hierarchy, error response formats, retry policies, DLQs
6. **Caching Strategy** — providers, cached entities/queries, TTL/invalidation
7. **External Calls** — called services, circuit breakers, timeout configs, fallbacks
8. **Degraded Modes** — graceful degradation, health checks, readiness probes
9. **Security** — auth mechanism, input validation, CORS, rate limiting

## CRITICAL
- If scout report lacks detail for any section -> spawn Explore subagents
- Flag NOT FOUND for sections without code evidence
- Include "Summary for Synthesis" section at the end
- Output: ${foundationPath}backend/${svc.name}/tech-design/${svc.name}-service.md`
  if (failureFeedback) p += failureFeedback
  return p
}

function lldSynthesisPrompt(lldSummaries) {
  return `## MODE: CROSS-SERVICE SYNTHESIS — LLD

Merge per-service LLD outputs into cross-cutting documentation.

## Context
- **HLD**: ${foundationPath}architecture.md
- **Per-service LLD outputs**: ${services.map(s => `${foundationPath}backend/${s.name}/tech-design/${s.name}-service.md`).join(', ')}
- **LLD Agent Summaries**:
${lldSummaries.map((s, i) => `  ${i + 1}. ${services[i]?.name || `service-${i}`}: ${s}`).join('\n')}

## Task
1. **Cross-Cutting Concerns** -> ${foundationPath}cross-cutting.md
   - Auth patterns across services
   - Error format consistency
   - Logging/monitoring patterns
   - Data consistency mechanisms
   - Deployment pattern consistency

2. **API Contract Synthesis** -> ${foundationPath}contracts/api-{domain}.yaml
   - Group APIs by business domain (not by service)
   - Identify overlapping or conflicting endpoints
   - Flag gaps in API surface

3. **Error Code Canonicalization** -> ${foundationPath}contracts/error-codes.md
   - Deduplicate and normalize error codes across all services
   - Map which service raises which error
   - Flag inconsistent error semantics

4. **FR Enrichment** — Generate FR candidates for SRS phase
   - Group related endpoints into feature candidates
   - Identify cross-service features
   - Suggest domain groupings for SRS fan-out

5. **Service Interaction Map** — Mermaid diagram
   - Service dependency graph
   - Call chains for key use cases
   - Bottlenecks and tight coupling detected

## CRITICAL
- Work from LLD outputs — do NOT re-analyze code
- Include "Summary for Synthesis" section with suggested domains for SRS`
}

function srsPrompt(domain, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — SRS for ${domain.name}

Infer functional and non-functional requirements from EXISTING code for domain "${domain.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **HLD**: ${foundationPath}architecture.md
- **LLD**: ${foundationPath}backend/*/tech-design/*.md
- **Cross-cutting**: ${foundationPath}cross-cutting.md (if available)
- **Domain**: ${domain.name}
- **Services in domain**: ${(domain.services || []).join(', ')}
- **Features to analyze**: ${(domain.features || []).join(', ') || 'Auto-discover from code'}

## Task
1. **Feature Discovery** — Scan API endpoints, UI routes, background jobs, event handlers in domain
2. **Functional Requirements** — For EACH feature in domain:
   - FR-{${domain.name.toUpperCase()}}-{NNN} format
   - Description (inferred from endpoint semantics)
   - Actor/role (inferred from auth middleware)
   - Gherkin Scenario Outlines (happy path + error cases + edge cases)
   - Code evidence table
3. **NFRs** — Performance, security, availability, scalability from configs
4. **Feature Index** — ${foundationPath}features/README.md for this domain

## CRITICAL
- All features in this domain in ONE agent call (not per-feature)
- Flag all inference as UNCERTAIN — business intent cannot be known from code alone
- If context insufficient -> spawn Explore subagents
- Include "Summary for Synthesis" section at the end`
  if (failureFeedback) p += failureFeedback
  return p
}

function srsSynthesisPrompt(srsSummaries, verificationResult) {
  let verificationContext = ''
  if (verificationResult) {
    const { verdicts, stats } = verificationResult
    verificationContext = `

## Adversarial Verification Results
${stats.total} FRs verified by codebase-srs-verify agent per domain (3-lens analysis + Explore subagent deep-dive):
- **${stats.confirmed} CONFIRMED** (all 3 lenses pass — strong evidence, complete behavior, coherent business logic)
- **${stats.uncertain} UNCERTAIN** (one or more lenses found significant issues — needs human review)
- **${stats.rejected} REJECTED** (critical failure — evidence missing/fabricated, behavior wrong, or business logic incorrect)

### Per-Domain Verification Details
${Object.entries(verdicts).map(([domain, data]) => {
  const frDetails = data.frs.map(fr =>
    `  - ${fr.fr_id}: **${fr.verdict}** — concerns: ${fr.concerns.length > 0 ? fr.concerns.slice(0, 3).join('; ') : 'none'}`
  ).join('\n')
  return `#### ${domain}\n${frDetails}`
}).join('\n\n')}

**IMPORTANT for synthesis:**
- REJECTED FRs MUST be EXCLUDED from the unified feature index — do NOT list them in README.md
- REJECTED FRs MUST NOT appear in traceability matrix (they will not have IMP/TST downstream)
- UNCERTAIN FRs should be included but flagged for human review
- CONFIRMED FRs are reliable — include normally
- Cross-domain dependencies involving REJECTED FRs should be flagged`
  }

  return `## MODE: CROSS-DOMAIN SYNTHESIS — SRS

Merge per-domain SRS outputs into unified cross-domain documentation.

## Context
- **Domains**: ${domains.map(d => d.name).join(', ')}
- **Per-domain SRS outputs**: ${domains.map(d => `${foundationPath}features/FR-${d.name.toUpperCase()}-*.md`).join(', ')}
- **SRS Agent Summaries**:
${srsSummaries.map((s, i) => `  ${i + 1}. ${domains[i]?.name || `domain-${i}`}: ${s}`).join('\n')}
${verificationContext}

## Task
1. **Unified Feature Index** -> ${foundationPath}features/README.md
   - Complete domain+feature table
   - Status tracking: mark each FR as CONFIRMED/UNCERTAIN/REJECTED based on verification
   - Actor summary per domain

2. **Traceability Matrix** -> ${foundationPath}traceability/requirements-matrix.md
   - Every FR -> code module(s) + service
   - Evidence Quality: HIGH | MEDIUM | LOW | UNCERTAIN
   - Include verification status from adversarial review
   - Cross-domain dependencies

3. **Cross-Domain Dependencies**
   - Features spanning multiple domains
   - Shared actors across domains
   - Data flows between domains

4. **Global NFR Summary**
   - Aggregated performance/security/availability thresholds
   - Conflicting NFRs across domains

5. **Consistency Validation**
   - Same actor named differently?
   - Feature overlaps or gaps?
   - FR-ID conflicts?

## CRITICAL
- Do NOT modify per-domain feature files
- Include "Summary for Synthesis" section
`
}

function impPrompt(domain, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — IMP for ${domain.name}

Document implementation patterns from EXISTING code for domain "${domain.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **Domain**: ${domain.name}
- **Services**: ${(domain.services || []).join(', ')}
- **SRS Features**: ${foundationPath}features/FR-${domain.name.toUpperCase()}-*.md
- **LLD**: ${foundationPath}backend/*/tech-design/*.md
- **Cross-cutting**: ${foundationPath}cross-cutting.md

## Task — For EACH feature in this domain, document 5 aspects:
1. **Execution Flow** — Controller->Service->Repository chain, step-by-step with file:line
2. **Business Rules Mapping** — rule -> implementation (file:line), validation -> validator, authZ -> permission check
3. **Data Impact** — tables/collections modified, events published, cache invalidated
4. **Error Mapping** — exception types -> HTTP status codes -> error response bodies
5. **Security** — auth mechanism, input validation, data sanitization

Output: ${foundationPath}backend/{svc}/implementation/FR-${domain.name.toUpperCase()}-{NNN}-impl.md

## CRITICAL
- ALL features in this domain, not one feature per agent
- **BEFORE processing, READ each FR file and check frontmatter \`verification\` field. SKIP any FR marked \`verification: REJECTED\` — these were rejected by adversarial verification and must NOT have implementation specs generated.**
- Document what EXISTS, not what should be
- Every claim needs file:line evidence
- If context insufficient -> spawn Explore subagents
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}

function tstPrompt(domain, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — TST for ${domain.name}

Document test patterns from EXISTING test code for domain "${domain.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **Domain**: ${domain.name}
- **Services**: ${(domain.services || []).join(', ')}
- **SRS Features**: ${foundationPath}features/FR-${domain.name.toUpperCase()}-*.md
- **IMP**: ${foundationPath}backend/*/implementation/FR-${domain.name.toUpperCase()}-*-impl.md

## Task — For EACH feature in this domain, document 4 aspects:
1. **Test Architecture** — frameworks, test types, mock/stub strategy, CI integration
2. **Per-Feature Test Cases** — unit tests, integration tests, E2E, performance (from actual test files)
3. **Test Data & Fixtures** — factory classes, test data files, mock server configs
4. **Coverage Patterns** — coverage config, naming conventions, GAP ANALYSIS

Output: ${foundationPath}backend/{svc}/test-specs/FR-${domain.name.toUpperCase()}-{NNN}-test.md

## CRITICAL
- ALL features in this domain, not one feature per agent
- **BEFORE processing, READ each FR file and check frontmatter \`verification\` field. SKIP any FR marked \`verification: REJECTED\` — these were rejected by adversarial verification and must NOT have test specs generated.**
- Document what TESTS EXIST, not what should be written
- Explicitly flag: "⚠️ NO TESTS FOUND: <feature>" for missing coverage
- Every test case referenced needs file:line evidence
- If context insufficient -> spawn Explore subagents
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}


// === RERUN FUNCTIONS (called by gate engine on retry) ===
// Each rerun function receives failureDetails and re-runs the phase
// with targeted feedback. Returns the new result(s).

async function rerunHLD(previousResult, failureDetails) {
  const feedback = failureFeedbackForAgent('hld', failureDetails)
  log('  Re-running HLD agent with targeted feedback...')
  return await agent(hldPrompt(feedback), {
    label: 'HLD: architecture (retry)',
    phase: 'HLD',
    agentType: 'codebase-hld',
  })
}

async function rerunLLD(failureDetails) {
  // Parse which services failed from failure details
  const feedback = failureFeedbackForAgent('lld', failureDetails)
  log(`  Re-running LLD for ${serviceCount} service(s) with targeted feedback...`)
  return await parallel(
    services.map(svc => () =>
      agent(lldPrompt(svc, feedback), {
        label: `LLD: ${svc.name} (retry)`,
        phase: 'LLD',
        agentType: 'codebase-lld',
      })
    )
  )
}

async function rerunSRS(failureDetails) {
  const feedback = failureFeedbackForAgent('srs', failureDetails)
  log(`  Re-running SRS for ${domainCount} domain(s) with targeted feedback...`)
  return await parallel(
    domains.map(dom => () =>
      agent(srsPrompt(dom, feedback), {
        label: `SRS: ${dom.name} (retry)`,
        phase: 'SRS',
        agentType: 'codebase-srs',
      })
    )
  )
}

async function rerunIMP(failureDetails) {
  const feedback = failureFeedbackForAgent('imp', failureDetails)
  log(`  Re-running IMP for ${domainCount} domain(s) with targeted feedback...`)
  const tasks = domains.map(dom => () =>
    agent(impPrompt(dom, feedback), {
      label: `IMP: ${dom.name} (retry)`,
      phase: 'IMP+TST',
      agentType: 'codebase-imp',
    }).then(result => ({ type: 'imp', domain: dom.name, result }))
  )
  return await parallel(tasks)
}

async function rerunTST(failureDetails) {
  const feedback = failureFeedbackForAgent('tst', failureDetails)
  log(`  Re-running TST for ${domainCount} domain(s) with targeted feedback...`)
  const tasks = domains.map(dom => () =>
    agent(tstPrompt(dom, feedback), {
      label: `TST: ${dom.name} (retry)`,
      phase: 'IMP+TST',
      agentType: 'codebase-tst',
    }).then(result => ({ type: 'tst', domain: dom.name, result }))
  )
  return await parallel(tasks)
}

// === PIPELINE EXECUTION ===

log(`🔍 Reverse Engineering Pipeline — ${serviceCount} service(s), ${domainCount} domain(s)`)
log(`📋 Artifacts: ${artifacts.join(' -> ')}`)
log(`📂 Scope: ${scope}`)
if (focus) log(`🎯 Focus: ${focus}`)
log(`🚦 Gate mode: retry up to ${MAX_RETRIES}x, skip-to-report on exhaustion`)

// -- Phase 1: HLD (single agent + gate) --

let hldResult = null
let hldGatePassed = false
if (runHLD && serviceCount > 0 && !skipRemaining) {
  phase('HLD')
  log('Extracting architecture from code (single agent — cross-cutting)...')
  hldResult = await agent(hldPrompt(), {
    label: 'HLD: architecture',
    phase: 'HLD',
    agentType: 'codebase-hld',
  })
  log(`HLD agent complete — ${countIssues(hldResult)} UNCERTAINTY flag(s)`)

  // Gate check with retry
  const hldGate = await gateCheck('hld', { services, domains },
    async (fd) => { hldResult = await rerunHLD(hldResult, fd); return hldResult; },
    [foundationPath + 'architecture.md', foundationPath + 'adrs/', foundationPath + 'contracts/', foundationPath + 'hard-boundaries.md']
  )
  hldGatePassed = hldGate.passed
} else if (runHLD && !skipRemaining) {
  log('HLD: No services detected — skipping')
} else if (skipRemaining) {
  log('HLD: Skipped (gate exhaustion from previous phase)')
}

// -- Phase 2: LLD (fan-out per service + synthesis + gate) --

let lldResults = []
let lldSynthesisResult = null
let lldGatePassed = false
if (runLLD && serviceCount > 0 && !skipRemaining) {
  phase('LLD')
  log(`Fanning out LLD to ${serviceCount} service(s)...`)

  lldResults = await parallel(
    services.map(svc => () =>
      agent(lldPrompt(svc), {
        label: `LLD: ${svc.name}`,
        phase: 'LLD',
        agentType: 'codebase-lld',
      })
    )
  )

  const successfulLLD = lldResults.filter(Boolean).length
  log(`LLD fan-out complete — ${successfulLLD}/${serviceCount} service(s) documented`)

  // Cross-service synthesis
  if (successfulLLD > 1) {
    log('Synthesizing cross-service LLD...')
    const lldSummaries = lldResults.map((r, i) => extractSummary(r, `LLD:${services[i]?.name || i}`))
    lldSynthesisResult = await agent(lldSynthesisPrompt(lldSummaries), {
      label: 'LLD synthesis',
      phase: 'LLD',
      agentType: 'codebase-lld-synthesis',
    })
    log(`LLD synthesis complete — ${countIssues(lldSynthesisResult)} UNCERTAINTY flag(s)`)
  } else if (successfulLLD === 1) {
    log('LLD: Single service — synthesis skipped (no cross-service patterns to merge)')
  }

  // Gate check (validates per-service LLD + synthesis if applicable)
  const lldGate = await gateCheck('lld', { services, domains },
    async (fd) => { lldResults = await rerunLLD(fd); },
    services.map(s => foundationPath + 'backend/' + s.name + '/tech-design/' + s.name + '-service.md')
  )
  lldGatePassed = lldGate.passed
} else if (runLLD && !skipRemaining) {
  log('LLD: No services detected — skipping')
} else if (skipRemaining) {
  log('LLD: Skipped (gate exhaustion from previous phase)')
}

// -- Phase 3: SRS (fan-out per domain + synthesis + gate) --

let srsResults = []
let srsSynthesisResult = null
let srsGatePassed = false
if (runSRS && domainCount > 0 && !skipRemaining) {
  phase('SRS')
  log(`Fanning out SRS to ${domainCount} domain(s)...`)

  srsResults = await parallel(
    domains.map(dom => () =>
      agent(srsPrompt(dom), {
        label: `SRS: ${dom.name}`,
        phase: 'SRS',
        agentType: 'codebase-srs',
      })
    )
  )

  const successfulSRS = srsResults.filter(Boolean).length
  log(`SRS fan-out complete — ${successfulSRS}/${domainCount} domain(s)`)

  // -- Adversarial SRS Verification (always-on, with retry for REJECTED FRs, before synthesis) --
  let srsVerificationResult = null
  if (successfulSRS > 0 && !skipRemaining) {
    phase('SRS-Verify')
    log(`Adversarial SRS verification — codebase-srs-verify agent per domain (3-lens: code-evidence, behavioral-completeness, business-coherence + Explore subagents)`)

    // Round 1: verify all domains
    srsVerificationResult = await verifySRSForDomains(domains, srsResults)

    // Retry loop for REJECTED FRs — re-spawn SRS agent with skeptic feedback, then re-verify
    for (let retry = 1; retry <= MAX_VERIFY_RETRIES; retry++) {
      // Collect REJECTED FRs per domain
      const rejectedByDomain = {}
      if (srsVerificationResult) {
        for (const [domainName, data] of Object.entries(srsVerificationResult.verdicts)) {
          const rejected = data.frs.filter(f => f.verdict === 'REJECTED')
          if (rejected.length > 0) {
            rejectedByDomain[domainName] = rejected
          }
        }
      }

      if (Object.keys(rejectedByDomain).length === 0) break

      log(`SRS-Verify retry ${retry}/${MAX_VERIFY_RETRIES}: ${Object.entries(rejectedByDomain).map(([d, frs]) => `${frs.length} REJECTED in ${d}`).join(', ')}`)

      // For each domain with rejected FRs, re-run SRS agent with targeted feedback
      for (const [domainName, rejectedFRs] of Object.entries(rejectedByDomain)) {
        const domain = domains.find(d => d.name === domainName)
        if (!domain) continue

        // Build targeted feedback from ALL skeptic concerns across all rejected FRs
        const allConcerns = []
        const frList = []
        for (const fr of rejectedFRs) {
          frList.push(`- **${fr.fr_id}**: REJECTED. Concerns: ${fr.concerns.join('; ') || 'insufficient code evidence, weak business interpretation'}`)
          if (fr.concerns.length > 0) allConcerns.push(...fr.concerns)
        }

        const retryFeedback = `

## ⚠️ ADVERSARIAL VERIFICATION RETRY (${retry}/${MAX_VERIFY_RETRIES})

The following FRs were **REJECTED** by adversarial verification (3-lens analysis: Code Evidence, Behavioral Completeness, Business Coherence). You MUST fix these specific issues before re-verification:

${frList.join('\n')}

### Common Concerns Across All Rejected FRs
${[...new Set(allConcerns)].map(c => `- ${c}`).join('\n')}

### CRITICAL FIX INSTRUCTIONS
1. **Add specific code evidence** — every claim needs file:line references. Skeptics will spot-check these.
2. **Verify actor/role** — check auth middleware, permission annotations, role guards in the actual code.
3. **Expand Gherkin scenarios** — cover error paths, edge cases, and validation failures visible in the code.
4. **Flag remaining uncertainty** — if something truly cannot be determined from code alone, use UNCERTAINTY flag honestly.
5. **Do NOT invent evidence** — the verification agent will detect fabricated file:line references and reject again.`

        // Re-run SRS agent with retry feedback
        log(`  Re-running SRS for ${domainName} with verification feedback...`)
        const retrySRSResult = await agent(srsPrompt(domain, retryFeedback), {
          label: `SRS: ${domain.name} (verify-retry-${retry})`,
          phase: 'SRS-Verify',
          agentType: 'codebase-srs',
        })

        // Update srsResults so synthesis uses the retried output (Issue #1 fix)
        const domainIdx = domains.findIndex(d => d.name === domainName)
        if (domainIdx !== -1) srsResults[domainIdx] = retrySRSResult

        // Re-verify this domain only
        log(`  Re-verifying ${domainName} after retry...`)
        const reVerification = await verifySRSForDomains([domain], [retrySRSResult])

        // Merge results back: update the domain's verdicts in the main result
        if (reVerification && reVerification.verdicts[domainName]) {
          const oldFRs = srsVerificationResult.verdicts[domainName].frs
          const newFRs = reVerification.verdicts[domainName].frs
          const oldStats = srsVerificationResult.verdicts[domainName].stats

          // For FRs that were re-verified, update their verdicts
          // For FRs not in the new set (was CONFIRMED), keep old verdict
          const updatedFRs = oldFRs.map(oldFR => {
            const newFR = newFRs.find(n => n.fr_id === oldFR.fr_id)
            return newFR || oldFR
          })
          // Add any new FRs created during retry
          for (const newFR of newFRs) {
            if (!updatedFRs.find(f => f.fr_id === newFR.fr_id)) {
              updatedFRs.push(newFR)
            }
          }

          // Recalculate stats for this domain
          const newStats = { total: updatedFRs.length, confirmed: 0, uncertain: 0, rejected: 0 }
          for (const fr of updatedFRs) {
            if (fr.verdict === 'CONFIRMED') newStats.confirmed++
            else if (fr.verdict === 'UNCERTAIN') newStats.uncertain++
            else newStats.rejected++
          }

          srsVerificationResult.verdicts[domainName] = { frs: updatedFRs, stats: newStats }

          // Update global stats
          const deltaConfirmed = newStats.confirmed - oldStats.confirmed
          const deltaUncertain = newStats.uncertain - oldStats.uncertain
          const deltaRejected = newStats.rejected - oldStats.rejected
          srsVerificationResult.stats.confirmed += deltaConfirmed
          srsVerificationResult.stats.uncertain += deltaUncertain
          srsVerificationResult.stats.rejected += deltaRejected
        }
      }
    }

    // Write back final verdicts to FR files (Issue #4: optimized — only includes sections domain needs)
    await writebackVerificationVerdicts(srsVerificationResult)
  } else if (successfulSRS === 0) {
    log('SRS-Verify: No successful SRS results — skipping verification')
  }

  // Gate check (Issue #2: moved BEFORE synthesis so gate retry re-verifies before synthesis consumes stale results)
  const srsGate = await gateCheck('srs', { services, domains },
    async (fd) => {
      srsResults = await rerunSRS(fd)
      // After gate-induced SRS retry, re-verify the updated results
      const liveCount = srsResults.filter(Boolean).length
      if (liveCount > 0 && !skipRemaining) {
        log('Re-verifying SRS after gate retry...')
        srsVerificationResult = await verifySRSForDomains(domains, srsResults)
        await writebackVerificationVerdicts(srsVerificationResult)
      }
    },
    domains.map(d => foundationPath + 'features/FR-' + d.name.toUpperCase() + '-*.md')
  )
  srsGatePassed = srsGate.passed

  // Cross-domain synthesis (after gate — only on verified, gated, quality-passed FRs)
  if (successfulSRS > 1 && !skipRemaining) {
    log('Synthesizing cross-domain SRS...')
    const srsSummaries = srsResults.map((r, i) => extractSummary(r, `SRS:${domains[i]?.name || i}`))
    srsSynthesisResult = await agent(srsSynthesisPrompt(srsSummaries, srsVerificationResult), {
      label: 'SRS synthesis',
      phase: 'SRS',
      agentType: 'codebase-srs-synthesis',
    })
    log(`SRS synthesis complete — ${countIssues(srsSynthesisResult)} UNCERTAINTY flag(s)`)
  } else if (successfulSRS === 1 && !skipRemaining) {
    log('SRS: Single domain — synthesis skipped (domain-level README.md in features/ covers this domain, no cross-domain patterns to merge)')
  } else if (skipRemaining) {
    log('SRS: Synthesis skipped (gate exhaustion from SRS phase)')
  }
} else if (runSRS && !skipRemaining) {
  log('SRS: No domains detected — cannot infer requirements without domain grouping')
} else if (skipRemaining) {
  log('SRS: Skipped (gate exhaustion from previous phase)')
}

// -- Phase 4: IMP+TST (fan-out per domain + gate) --

let impResults = []
let tstResults = []
let impGatePassed = false
let tstGatePassed = false
if ((runIMP || runTST) && domainCount > 0 && !skipRemaining) {
  phase('IMP+TST')

  const impTasks = runIMP
    ? domains.map(dom => () =>
        agent(impPrompt(dom), {
          label: `IMP: ${dom.name}`,
          phase: 'IMP+TST',
          agentType: 'codebase-imp',
        }).then(result => ({ type: 'imp', domain: dom.name, result }))
      )
    : []

  const tstTasks = runTST
    ? domains.map(dom => () =>
        agent(tstPrompt(dom), {
          label: `TST: ${dom.name}`,
          phase: 'IMP+TST',
          agentType: 'codebase-tst',
        }).then(result => ({ type: 'tst', domain: dom.name, result }))
      )
    : []

  if (runIMP) log(`Fanning out IMP to ${domainCount} domain(s)...`)
  if (runTST) log(`Fanning out TST to ${domainCount} domain(s)...`)

  const allTasks = [...impTasks, ...tstTasks]
  if (allTasks.length > 0) {
    const allResults = await parallel(allTasks)
    impResults = allResults.filter(Boolean).filter(r => r.type === 'imp' && r.result)
    tstResults = allResults.filter(Boolean).filter(r => r.type === 'tst' && r.result)
    log(`IMP+TST complete — IMP: ${impResults.length}/${domainCount}, TST: ${tstResults.length}/${domainCount}`)
  }

  // IMP Gate
  if (runIMP && impResults.length > 0 && !skipRemaining) {
    const impGate = await gateCheck('imp', { services, domains },
      async (fd) => {
        const retried = await rerunIMP(fd)
        impResults = retried.filter(Boolean).filter(r => r.type === 'imp' && r.result)
      },
      domains.map(d => foundationPath + 'backend/*/implementation/FR-' + d.name.toUpperCase() + '-*-impl.md')
    )
    impGatePassed = impGate.passed
  }

  // TST Gate
  if (runTST && tstResults.length > 0 && !skipRemaining) {
    const tstGate = await gateCheck('tst', { services, domains },
      async (fd) => {
        const retried = await rerunTST(fd)
        tstResults = retried.filter(Boolean).filter(r => r.type === 'tst' && r.result)
      },
      domains.map(d => foundationPath + 'backend/*/test-specs/FR-' + d.name.toUpperCase() + '-*-test.md')
    )
    tstGatePassed = tstGate.passed
  }
} else if ((runIMP || runTST) && !skipRemaining) {
  log('IMP+TST: No domains — cannot document implementation or tests')
} else if (skipRemaining) {
  log('IMP+TST: Skipped (gate exhaustion from previous phase)')
}


// === REPORT: Cross-reference validation + completeness critic + gate summary ===

phase('Report')

const allOutputs = new Set()
const allWarnings = []

// Collect outputs from all phases
const phaseResults = [
  { name: 'HLD', result: hldResult },
  ...lldResults.filter(Boolean).map((r, i) => ({ name: `LLD:${services[i]?.name || i}`, result: r })),
  { name: 'LLD-Synthesis', result: lldSynthesisResult },
  ...srsResults.filter(Boolean).map((r, i) => ({ name: `SRS:${domains[i]?.name || i}`, result: r })),
  { name: 'SRS-Synthesis', result: srsSynthesisResult },
  ...impResults.filter(r => r.result).map(r => ({ name: `IMP:${r.domain}`, result: r.result })),
  ...tstResults.filter(r => r.result).map(r => ({ name: `TST:${r.domain}`, result: r.result })),
]

for (const { name, result } of phaseResults) {
  if (!result) continue
  const outputs = extractOutputs(result)
  outputs.forEach(o => allOutputs.add(o))
  const issues = countIssues(result)
  if (issues > 0) {
    allWarnings.push(`${name}: ${issues} UNCERTAINTY flag(s)`)
  }
}

// Summary counts
const hldOk = hldResult != null
const lldOk = lldResults.filter(Boolean).length
const lldSynthOk = lldSynthesisResult != null
const srsOk = srsResults.filter(Boolean).length
const srsSynthOk = srsSynthesisResult != null
const impOk = impResults.length
const tstOk = tstResults.length

// Gate summary
const gatePasses = gateResults.filter(g => g.passed).length
const gateFails = gateResults.filter(g => !g.passed).length
const exhaustedGates = gateResults.filter(g => !g.passed && g.attempt === MAX_RETRIES)

const pipelineStatus = skipRemaining
  ? 'partial (gate exhaustion)'
  : (hldOk || lldOk > 0 || srsOk > 0 || impOk > 0 || tstOk > 0)
    ? 'completed'
    : 'failed'

log('')
log(`🏁 Pipeline ${pipelineStatus}`)
log(`   ✅ HLD: ${hldOk ? 'complete' : 'skipped'} | Gate: ${hldGatePassed ? 'PASS' : (hldOk ? 'FAIL' : 'N/A')}`)
log(`   ✅ LLD: ${lldOk}/${serviceCount} services | Synthesis: ${lldSynthOk ? 'done' : 'skipped'} | Gate: ${lldGatePassed ? 'PASS' : (lldOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ SRS: ${srsOk}/${domainCount} domains | Synthesis: ${srsSynthOk ? 'done' : 'skipped'} | Gate: ${srsGatePassed ? 'PASS' : (srsOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ IMP: ${impOk}/${domainCount} domains | Gate: ${impGatePassed ? 'PASS' : (impOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ TST: ${tstOk}/${domainCount} domains | Gate: ${tstGatePassed ? 'PASS' : (tstOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   📄 Total outputs: ${allOutputs.size} files`)
log(`   ⚠️ Total warnings: ${allWarnings.length}`)
if (srsVerificationResult) {
  const vs = srsVerificationResult.stats
  log(`   🔍 SRS Verification: ${vs.total} FRs — ${vs.confirmed} CONFIRMED, ${vs.uncertain} UNCERTAIN, ${vs.rejected} REJECTED`)
}
log(`   🚦 Gate summary: ${gatePasses} passed, ${gateFails} failed${exhaustedGates.length > 0 ? ` (${exhaustedGates.length} exhausted at ${MAX_RETRIES} retries)` : ''}`)

if (allWarnings.length > 0) {
  allWarnings.forEach(w => log(`      ${w}`))
}

// Gate exhaustion details
if (exhaustedGates.length > 0) {
  log('')
  log('🛑 GATE EXHAUSTION REPORT:')
  log('   The following phases failed gate checks after ' + MAX_RETRIES + ' retries and were skipped:')
  exhaustedGates.forEach(g => {
    log(`      - ${g.phase}: ${g.parsed.summary}`)
  })
  log(`   💡 Remaining phases were NOT executed. Review the gate failures above and decide:`)
  log(`      • Fix quality issues in agent prompts/scout report and re-run`)
  log(`      • Manually supplement the failing sections`)
  log(`      • Accept partial output (skip phase entirely)`)
}

// -- Completeness Critic --

let criticResult = null
if (hldOk || lldOk > 0 || srsOk > 0) {
  log('')
  log('Running completeness critic...')
  criticResult = await agent(
    `## Completeness Critic — What's Missing?

Review the completed reverse engineering pipeline and identify gaps.

## Pipeline Summary
- **Status**: ${pipelineStatus}
- **Services analyzed**: ${serviceCount} (${services.map(s => s.name).join(', ') || 'none'})
- **Domains analyzed**: ${domainCount} (${domains.map(d => d.name).join(', ') || 'none'})
- **Artifacts generated**: ${artifacts.join(', ')}
- **HLD**: ${hldOk ? 'complete' : 'skipped'} | Gate: ${hldGatePassed ? 'PASS' : (hldOk ? 'FAIL' : 'N/A')}
- **LLD**: ${lldOk}/${serviceCount} services | Synthesis: ${lldSynthOk ? 'done' : 'skipped'} | Gate: ${lldGatePassed ? 'PASS' : (lldOk > 0 ? 'FAIL' : 'N/A')}
- **SRS**: ${srsOk}/${domainCount} domains | Synthesis: ${srsSynthOk ? 'done' : 'skipped'} | Gate: ${srsGatePassed ? 'PASS' : (srsOk > 0 ? 'FAIL' : 'N/A')}
- **IMP**: ${impOk}/${domainCount} domains | Gate: ${impGatePassed ? 'PASS' : (impOk > 0 ? 'FAIL' : 'N/A')}
- **TST**: ${tstOk}/${domainCount} domains | Gate: ${tstGatePassed ? 'PASS' : (tstOk > 0 ? 'FAIL' : 'N/A')}
- **Total outputs**: ${allOutputs.size} files
- **Warnings**: ${allWarnings.length} (${allWarnings.join('; ') || 'none'})
${exhaustedGates.length > 0 ? `- **GATE EXHAUSTED**: ${exhaustedGates.map(g => g.phase).join(', ')} — remaining phases skipped` : ''}

## ${exhaustedGates.length > 0 ? 'CRITICAL — Gate exhaustion occurred. In addition to normal checks, also:' : 'Check For'}
1. Any service NOT covered by LLD?
2. Any domain NOT covered by SRS/IMP/TST?
3. Any artifact type with ZERO outputs?
4. Any cross-service domain missing API contracts?
5. Any coverage gap not flagged?
6. Consistency: do feature counts across SRS/IMP/TST match?
${exhaustedGates.length > 0 ? `7. GATE EXHAUSTION IMPACT: Which artifacts are MISSING because phases were skipped?` : ''}
${exhaustedGates.length > 0 ? `8. Can the pipeline be resumed from the failing phase, or does the root cause need fixing first?` : ''}

Return a structured gap report. Be CONCRETE — name specific missing files, services, or domains.`,
    { label: 'completeness-critic', phase: 'Report' }
  )

  if (criticResult) {
    const criticText = typeof criticResult === 'string' ? criticResult : JSON.stringify(criticResult)
    const criticIssues = (criticText.match(/⚠️|❌|GAP|MISSING|missing|gap/g) || []).length
    if (criticIssues > 0) {
      log(`🔍 Completeness critic found ~${criticIssues} potential gaps`)
      allWarnings.push(`Completeness: ${criticIssues} gap(s) identified`)
    } else {
      log('Completeness critic: no gaps detected')
    }
  }
}

return {
  status: pipelineStatus,
  services: serviceCount,
  domains: domainCount,
  adversarial: {
    enabled: true,
    stats: srsVerificationResult ? srsVerificationResult.stats : null,
    perDomain: srsVerificationResult ? srsVerificationResult.verdicts : null,
  },
  artifacts: {
    hld: hldOk,
    lld: { services: lldOk, synthesis: lldSynthOk },
    srs: { domains: srsOk, synthesis: srsSynthOk },
    imp: impOk,
    tst: tstOk,
  },
  gates: {
    total: gateResults.length,
    passed: gatePasses,
    failed: gateFails,
    exhausted: exhaustedGates.length,
    results: gateResults.map(g => ({
      phase: g.phase,
      attempt: g.attempt,
      passed: g.passed,
      summary: g.parsed.summary,
    })),
  },
  outputs: [...allOutputs],
  warnings: allWarnings,
  criticFindings: criticResult ? extractSummary(criticResult, 'critic') : null,
  summary: `Reverse engineered ${serviceCount} service(s) across ${domainCount} domain(s). ${allOutputs.size} files generated. ${gatePasses}/${gateResults.length} gates passed${exhaustedGates.length > 0 ? `, ${exhaustedGates.length} gates exhausted (remaining phases skipped)` : ''}. ${allWarnings.length} warnings.`,
}

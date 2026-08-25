export const meta = {
  name: 'codebase-reverse',
  description: 'Reverse engineer codebase → agent_docs/ with per-service and per-domain fan-out, inter-phase gates with retry (max 3), adversarial SRS verification (codebase-srs-verify agent with 3-lens analysis per domain), cross-cutting synthesis (5 dedicated agents after SRS), and skip-to-report on gate exhaustion.',
  phases: [
    { title: 'HLD', detail: 'Extract architecture from code (single agent — cross-cutting)' },
    { title: 'Gate:HLD', detail: 'Validate HLD outputs against 6 criteria' },
    { title: 'LLD', detail: 'Fan-out per service + cross-service synthesis' },
    { title: 'Gate:LLD', detail: 'Validate LLD outputs against 5 criteria per service' },
    { title: 'Gate:LLD-SYNTHESIS', detail: 'Validate LLD synthesis outputs (contracts/api-*.yaml, contracts/error-codes.md) against 4 criteria — non-cascading' },
    { title: 'SRS', detail: 'Fan-out per domain + cross-domain synthesis' },
    { title: 'SRS-Verify', detail: 'Adversarially verify inferred FRs with codebase-srs-verify agent (3-lens analysis + Explore subagents) per domain' },
    { title: 'Gate:SRS', detail: 'Validate SRS outputs against 4 criteria per domain' },
    { title: 'Gate:SRS-SYNTHESIS', detail: 'Validate SRS synthesis outputs (features/README.md, traceability/requirements-matrix.md) against 4 criteria — non-cascading' },
    { title: 'Cross-Cutting', detail: 'Cross-cutting synthesis (5 dedicated agents): error-handling, caching-strategy, performance-test, frontend-architecture (Stage 1 ∥), then frontend-test-strategy (Stage 2)' },
    { title: 'Gate:Cross-Cutting', detail: 'Validate cross-cutting outputs against phase-specific criteria' },
    { title: 'IMP+TST', detail: 'Fan-out per domain (IMP ∥ TST per domain concurrently)' },
    { title: 'Gate:IMP+TST', detail: 'Validate IMP (5 criteria) and TST (5 criteria) per domain' },
    { title: 'Report', detail: 'Cross-reference validation + completeness critic + gate failure summary' },
  ],
}

// === SAFE-PARSE ARGS (MANDATORY) ===

const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
let {
  scope = '.',
  scoutReportPath,
  services = [],
  domains = [],
  artifacts = ['hld', 'lld', 'srs', 'imp', 'tst'],
  focus,
  foundationPath = 'agent_docs/',
  workDir,
  adversarial = true,
  runDate,  // ISO date string for deterministic execution (workflow-knowledge: no new Date())
  // ── Idempotent resume ──
  resumeFrom = null,  // { completedPhases: ['HLD','LLD'], phaseResults: { HLD: '...', LLD: [...] } }
} = _args

// Resolve relative paths from workDir so subagents write to the correct project directory
const resolvePath = (p) => (workDir && p && !p.startsWith('/')) ? `${workDir}/${p}` : p
foundationPath = resolvePath(foundationPath)
scoutReportPath = resolvePath(scoutReportPath)

// -- Phase Selection --
const runHLD = artifacts.includes('hld')
const runLLD = artifacts.includes('lld')
const runSRS = artifacts.includes('srs')
const runIMP = artifacts.includes('imp')
const runTST = artifacts.includes('tst')
const runCC  = artifacts.includes('cross-cutting')

// Derived counts
const serviceCount = services.length
const domainCount = domains.length

// === GATE + RETRY CONFIG ===

const MAX_RETRIES = 3
const MAX_VERIFY_RETRIES = 2
let skipRemaining = false

// ── Idempotent resume state ──
const completedPhases = new Set(resumeFrom?.completedPhases || [])
const resumeResults = resumeFrom?.phaseResults || {}
if (completedPhases.size > 0) {
  log(`⏭️ Resuming: ${completedPhases.size} phases already done → ${[...completedPhases].join(', ')}`)
}
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
 * On FAIL after MAX_RETRIES: sets skipRemaining = true (unless cascade=false).
 * cascade=false is for synthesis gates (lld-synthesis, srs-synthesis) — a failed
 * synthesis gate degrades the artifact but does NOT skip downstream phases.
 * Returns { passed, attempt, parsed }.
 */
async function gateCheck(phase, context, rerunFn, expectedOutputs, cascade = true) {
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
    gateResults.push({ phase, attempt, cascade, ...parsed })

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
  if (cascade) {
    log(`🛑 Gate ${phase}: FAILED after ${MAX_RETRIES} attempts — skipping all remaining phases`)
    skipRemaining = true
  } else {
    log(`⚠️ Gate ${phase}: FAILED after ${MAX_RETRIES} attempts — continuing pipeline (non-cascading synthesis gate)`)
  }
  return { passed: false, attempt: MAX_RETRIES, cascade, parsed: { passed: false, verdict: 'FAIL', summary: `Failed after ${MAX_RETRIES} attempts` } }
}

function gatePrompt(phase, attempt, previousFailure, context, expectedOutputs) {
  const { services, domains } = context
  let prompt = `## GATE: Validate ${phase.toUpperCase()} Phase Outputs

## Context
- **Phase**: ${phase}
- **Attempt**: ${attempt}/${MAX_RETRIES}
- **Services**: ${services.map(s => s.name).join(', ') || 'none'}
- **Domains**: ${domains.map(d => d.name).join(', ') || 'none'}
- **Expected outputs**: ${(expectedOutputs || []).join(', ') || 'auto-detect from ' + foundationPath}
- **Foundation path**: ${foundationPath}

## Instructions
1. Read the actual files from ${foundationPath} — verify independently
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
3. Read scout report at ${scoutReportPath}, HLD at ${foundationPath}architecture.md, and relevant LLD sections
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
  // Run all domain verifications in parallel — each domain reads disjoint FR files
  const results = await parallel(
    domains.map((domain, i) => async () => {
      const result = srsResults[i]
      if (!result) {
        log(`SRS-Verify: ${domain.name} — skipped (no SRS result)`)
        return { domainName: domain.name, skipped: true }
      }

      log(`SRS-Verify: ${domain.name} — dispatching codebase-srs-verify agent...`)

      // Try to extract FR file paths from SRS output (for logging)
      const frFiles = extractOutputs(result).filter(f => f.match(new RegExp(`FR-${domain.name.toUpperCase()}-\\d+`)))
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
        return { domainName: domain.name, skipped: true }
      }

      // Agent produces final verdicts directly (all 3 lenses applied internally, no majority vote needed)
      const consolidatedFRs = (verifyResult.fr_verdicts || []).map(frv => ({
        fr_id: frv.fr_id,
        verdict: frv.verdict,
        reasonings: [frv.reasoning],
        concerns: frv.concerns || [],
      }))

      // Per-domain stats (no shared mutation across parallel thunks)
      const domainStats = {
        total: consolidatedFRs.length,
        confirmed: consolidatedFRs.filter(f => f.verdict === 'CONFIRMED').length,
        uncertain: consolidatedFRs.filter(f => f.verdict === 'UNCERTAIN').length,
        rejected: consolidatedFRs.filter(f => f.verdict === 'REJECTED').length,
      }

      for (const fr of consolidatedFRs) {
        log(`  ${fr.fr_id}: ${fr.verdict}`)
      }

      return {
        domainName: domain.name,
        skipped: false,
        frs: consolidatedFRs,
        stats: domainStats,
      }
    })
  )

  // Merge parallel results
  const allVerdicts = {}
  const verificationStats = { total: 0, confirmed: 0, uncertain: 0, rejected: 0 }

  for (const r of results.filter(Boolean)) {
    if (r.skipped) continue
    allVerdicts[r.domainName] = { frs: r.frs, stats: r.stats }
    verificationStats.total += r.stats.total
    verificationStats.confirmed += r.stats.confirmed
    verificationStats.uncertain += r.stats.uncertain
    verificationStats.rejected += r.stats.rejected
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
- Change \`verification_date: ""\` to \`verification_date: "${runDate || 'REQUIRED: pass runDate in args'}"\`

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
- Output: ${foundationPath}tech-design/${svc.name}-service.md`
  if (failureFeedback) p += failureFeedback
  return p
}

function lldSynthesisPrompt(lldSummaries, failureFeedback) {
  let p = `## MODE: CROSS-SERVICE SYNTHESIS — LLD

Merge per-service LLD outputs — API contracts, error codes, FR candidates, service interaction map.
Cross-cutting concerns (error-handling, caching, etc.) are handled by dedicated codebase-cross-cutting-* agents in Phase 4.

## Context
- **HLD**: ${foundationPath}architecture.md
- **Per-service LLD outputs**: ${services.map(s => `${foundationPath}tech-design/${s.name}-service.md`).join(', ')}
- **LLD Agent Summaries**:
${lldSummaries.map((s, i) => `  ${i + 1}. ${services[i]?.name || `service-${i}`}: ${s}`).join('\n')}

## Task
**Note:** Cross-cutting concerns (error-handling, caching-strategy, performance-test,
frontend-architecture, frontend-test-strategy) are handled by dedicated
codebase-cross-cutting-* agents in Phase 4 after SRS — do NOT generate cross-cutting.md.

1. **API Contract Synthesis** -> ${foundationPath}contracts/api-{domain}.yaml
   - Group APIs by business domain (not by service)
   - Identify overlapping or conflicting endpoints
   - Flag gaps in API surface

2. **Error Code Canonicalization** -> ${foundationPath}contracts/error-codes.md
   - Deduplicate and normalize error codes across all services
   - Map which service raises which error
   - Flag inconsistent error semantics

3. **FR Enrichment** — Generate FR candidates for SRS phase
   - Group related endpoints into feature candidates
   - Identify cross-service features
   - Suggest domain groupings for SRS fan-out

4. **Service Interaction Map** — Mermaid diagram
   - Service dependency graph
   - Call chains for key use cases
   - Bottlenecks and tight coupling detected

## CRITICAL
- Work from LLD outputs — do NOT re-analyze code
- Include "Summary for Synthesis" section with suggested domains for SRS`
  if (failureFeedback) p += failureFeedback
  return p
}

function srsPrompt(domain, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — SRS for ${domain.name}

Infer functional and non-functional requirements from EXISTING code for domain "${domain.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **HLD**: ${foundationPath}architecture.md
- **LLD**: ${foundationPath}tech-design/*.md
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

function srsSynthesisPrompt(srsSummaries, verificationResult, failureFeedback) {
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
  if (failureFeedback) p += failureFeedback
  return p
}

function impPrompt(domain, failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — IMP for ${domain.name}

Document implementation patterns from EXISTING code for domain "${domain.name}".

## Context
- **Scout Report**: ${scoutReportPath}
- **Domain**: ${domain.name}
- **Services**: ${(domain.services || []).join(', ')}
- **Service types**: ${services.map(s => `${s.name}:${s.type}`).join(', ')}
- **SRS Features**: ${foundationPath}features/FR-${domain.name.toUpperCase()}-*.md
- **LLD**: ${foundationPath}tech-design/*.md
- **Cross-cutting**: ${foundationPath}cross-cutting.md

## Task — For EACH feature in this domain, document 5 aspects:
1. **Execution Flow** — Controller->Service->Repository chain, step-by-step with file:line
2. **Business Rules Mapping** — rule -> implementation (file:line), validation -> validator, authZ -> permission check
3. **Data Impact** — tables/collections modified, events published, cache invalidated
4. **Error Mapping** — exception types -> HTTP status codes -> error response bodies
5. **Security** — auth mechanism, input validation, data sanitization

Output: ${foundationPath}{backend|frontend}/{svc}/implementation/FR-${domain.name.toUpperCase()}-{NNN}-impl.md

## ROUTING (backend vs frontend)
For each FR, read its frontmatter \`services:\` field and resolve each listed service's type from **Service types** above:
- Type backend|node|go|java → \`backend/{svc}/implementation/...\`
- Type frontend|nextjs|react → \`frontend/{svc}/implementation/...\`
- An FR spanning both types → write ONE impl file per implementing service, each under its correct prefix.

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
- **Service types**: ${services.map(s => `${s.name}:${s.type}`).join(', ')}
- **SRS Features**: ${foundationPath}features/FR-${domain.name.toUpperCase()}-*.md
- **IMP**: ${foundationPath}{backend,frontend}/*/implementation/FR-${domain.name.toUpperCase()}-*-impl.md

## Task — For EACH feature in this domain, document 4 aspects:
1. **Test Architecture** — frameworks, test types, mock/stub strategy, CI integration
2. **Per-Feature Test Cases** — unit tests, integration tests, E2E, performance (from actual test files)
3. **Test Data & Fixtures** — factory classes, test data files, mock server configs
4. **Coverage Patterns** — coverage config, naming conventions, GAP ANALYSIS

Output: ${foundationPath}{backend|frontend}/{svc}/test-specs/FR-${domain.name.toUpperCase()}-{NNN}-test.md

## ROUTING (backend vs frontend)
For each FR, read its frontmatter \`services:\` field and resolve each listed service's type from **Service types** above:
- Type backend|node|go|java → \`backend/{svc}/test-specs/...\`
- Type frontend|nextjs|react → \`frontend/{svc}/test-specs/...\`
- An FR spanning both types → write ONE test spec file per implementing service, each under its correct prefix.

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


// === CROSS-CUTTING PROMPT BUILDERS ===
// Each reads reverse-engineered agent_docs/ artifacts. All use OBSERVE mode —
// extract patterns from code artifacts, flag inconsistencies, never DESIGN standards.

function ccErrorHandlingPrompt(failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — Cross-Cutting Error Handling

Extract observed error handling patterns from reverse-engineered code artifacts into unified system-wide documentation.

## Context
- **HLD**: ${foundationPath}architecture.md
- **Per-service LLD**: ${foundationPath}tech-design/*-service.md
- **API conventions**: ${foundationPath}contracts/api-conventions.md
- **Error codes**: ${foundationPath}contracts/error-codes.md
- **Hard boundaries**: ${foundationPath}hard-boundaries.md
- **SRS NFRs**: ${foundationPath}features/FR-*.md (error handling requirements)

## Task
Read ALL per-service LLD §9 (Error Flows & Degraded Mode) and synthesize ${foundationPath}error-handling.md:
1. Document observed response format(s) per service with file:line evidence
2. Build error taxonomy from observed codes (9 canonical categories)
3. Document observed HTTP mapping patterns
4. Extract security patterns (stacktrace exposure, PII sanitization, traceId presence)
5. Document observed logging patterns
6. Flag inconsistencies, gaps, and NOT OBSERVED sections

## CRITICAL
- OBSERVE, don't DESIGN — every claim needs code evidence (file:line)
- Sections without observed patterns → "⚠️ NOT OBSERVED"
- Flag inconsistencies: "Service A uses X (file:line), Service B uses Y (file:line)"
- Use template: .claude/templates/supporting/error-handling-TEMPLATE.md
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}

function ccCachingStrategyPrompt(failureFeedback) {
  const cacheInfra = true  // scope detection already verified architecture.md §6
  let p = `## MODE: REVERSE ENGINEERING — Cross-Cutting Caching Strategy

Extract observed cache patterns from reverse-engineered code artifacts into unified system-wide documentation.

## Context
- **HLD**: ${foundationPath}architecture.md §6 (cache infrastructure type)
- **Per-service LLD**: ${foundationPath}tech-design/*-service.md §7 (Caching Strategy)
- **Hard boundaries**: ${foundationPath}hard-boundaries.md

## Task
Read ALL per-service LLD §7 and synthesize ${foundationPath}caching-strategy.md:
1. Document observed cache architecture (L0-L3 layers)
2. Catalog observed cache patterns (Cache-Aside, Write-Through, etc.)
3. Build cache inventory from observed keys with TTL/pattern/eviction
4. Document observed invalidation strategies
5. Extract stampede prevention mechanisms
6. Document Redis config if observed
7. Document observed monitoring metrics

## CRITICAL
- OBSERVE, don't DESIGN — every claim needs code evidence (file:line)
- Sections without observed patterns → "⚠️ NOT OBSERVED"
- Flag cross-service REST invalidation as "⚠️ ANTI-PATTERN OBSERVED"
- Use template: .claude/templates/supporting/caching-strategy-TEMPLATE.md
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}

function ccPerformanceTestPrompt(failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — Cross-Cutting Performance Test

Create performance test plan from reverse-engineered SRS NFRs and per-service LLD performance characteristics.

## Context
- **HLD**: ${foundationPath}architecture.md §1 (service topology)
- **SRS NFRs**: ${foundationPath}features/FR-*.md (NFR-PERF-* targets)
- **Per-service LLD**: ${foundationPath}tech-design/*-service.md §8 (Performance & Scale)
- **Hard boundaries**: ${foundationPath}hard-boundaries.md

## Task
Read SRS NFRs and per-service LLD §8 to synthesize ${foundationPath}performance-test.md:
1. Extract NFR-PERF-* targets (quantified or flag NOT QUANTIFIED)
2. Define 5 test types with concrete parameters from NFR targets
3. Document test environment requirements
4. Define pass-fail criteria from NFR targets
5. Bottleneck investigation guide
6. Report template

## CRITICAL
- Targets come from SRS/LLD, not invented — flag "NOT QUANTIFIED" for placeholders
- Use template: .claude/templates/supporting/performance-test-TEMPLATE.md
- NEVER write test scripts (k6/JMeter configs)
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}

function ccFrontendArchitecturePrompt(failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — Cross-Cutting Frontend Architecture

Extract observed frontend architecture patterns from reverse-engineered code artifacts.

## Context
- **HLD**: ${foundationPath}architecture.md §1 (frontend services)
- **API routing**: ${foundationPath}frontend/{app}/api-routing.md (if exists)
- **Hard boundaries**: ${foundationPath}hard-boundaries.md
- **API conventions**: ${foundationPath}contracts/api-conventions.md
- **SRS features**: ${foundationPath}features/FR-*.md (frontend-scope features)

## Task
Read architecture.md and frontend artifacts to synthesize ${foundationPath}frontend-architecture.md:
1. Document observed rendering strategy (SSG/ISR/SSR/CSR) per page type
2. Extract middleware patterns (auth guard, redirects, matchers)
3. Document observed state management (TanStack Query, Zustand, etc.)
4. Document observed data fetching patterns with staleTime values
5. Extract auth & security patterns (token storage, CSRF, CSP)
6. Document observed error boundary hierarchy
7. i18n, Image optimization, SEO, Web Vitals, Responsive, Design System

## CRITICAL
- OBSERVE, don't DESIGN — every claim needs code evidence (file:line)
- Flag mismatches: "architecture.md declares X but code shows Y at file:line"
- Flag security risks prominently
- Use template: .claude/templates/supporting/frontend-architecture-TEMPLATE.md
- Include "Summary for Synthesis" section`
  if (failureFeedback) p += failureFeedback
  return p
}

function ccFrontendTestStrategyPrompt(failureFeedback) {
  let p = `## MODE: REVERSE ENGINEERING — Cross-Cutting Frontend Test Strategy

Extract observed frontend test patterns from reverse-engineered frontend architecture and error handling artifacts.

## Context
- **Frontend architecture**: ${foundationPath}frontend-architecture.md (from Stage 1)
- **Error handling**: ${foundationPath}error-handling.md §7 (frontend UX contract, from Stage 1)
- **API routing**: ${foundationPath}frontend/{app}/api-routing.md (if exists)
- **Hard boundaries**: ${foundationPath}hard-boundaries.md

## Task
Read frontend-architecture.md + error-handling.md to synthesize ${foundationPath}frontend-test-strategy.md:
1. Document observed test pyramid (unit/integration/E2E ratio)
2. Extract project setup (Vitest, Playwright, MSW configs)
3. Document observed MSW mocking conventions
4. Extract unit test patterns (hooks, utils, stores, formatters)
5. Document integration test patterns (component+API, form, error states)
6. Document E2E patterns (Page Object Model, auth setup, locators)
7. What's NOT tested (7 categories)
8. File conventions and coverage targets

## CRITICAL
- Document what EXISTS, not what should be
- Check ALL 9 error UX treatments from error-handling.md §7 for test coverage
- Use template: .claude/templates/supporting/frontend-test-strategy-TEMPLATE.md
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

async function rerunLldSynthesis(failureDetails) {
  const feedback = failureFeedbackForAgent('lld-synthesis', failureDetails)
  log('  Re-running LLD synthesis agent with targeted feedback...')
  const lldSummaries = lldResults.map((r, i) => extractSummary(r, `LLD:${services[i]?.name || i}`))
  return await agent(lldSynthesisPrompt(lldSummaries, feedback), {
    label: 'LLD synthesis (retry)',
    phase: 'LLD',
    agentType: 'codebase-lld-synthesis',
  })
}

async function rerunSrsSynthesis(failureDetails) {
  const feedback = failureFeedbackForAgent('srs-synthesis', failureDetails)
  log('  Re-running SRS synthesis agent with targeted feedback...')
  const srsSummaries = srsResults.map((r, i) => extractSummary(r, `SRS:${domains[i]?.name || i}`))
  return await agent(srsSynthesisPrompt(srsSummaries, srsVerificationResult, feedback), {
    label: 'SRS synthesis (retry)',
    phase: 'SRS',
    agentType: 'codebase-srs-synthesis',
  })
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

// -- Cross-Cutting rerun (all 5 agents re-run with feedback, respecting scope detection) --

async function rerunCrossCutting(failureDetails, ccScope) {
  const feedback = failureFeedbackForAgent('cross-cutting', failureDetails)
  log(`  Re-running cross-cutting agents with targeted feedback...`)
  const tasks = []

  if (ccScope.errorHandling) {
    tasks.push(() => agent(ccErrorHandlingPrompt(feedback), {
      label: 'CC: error-handling (retry)',
      phase: 'Cross-Cutting',
      agentType: 'codebase-cross-cutting-error-handling',
    }).then(r => ({ type: 'error-handling', result: r })))
  }
  if (ccScope.cachingStrategy) {
    tasks.push(() => agent(ccCachingStrategyPrompt(feedback), {
      label: 'CC: caching-strategy (retry)',
      phase: 'Cross-Cutting',
      agentType: 'codebase-cross-cutting-caching-strategy',
    }).then(r => ({ type: 'caching-strategy', result: r })))
  }
  if (ccScope.performanceTest) {
    tasks.push(() => agent(ccPerformanceTestPrompt(feedback), {
      label: 'CC: performance-test (retry)',
      phase: 'Cross-Cutting',
      agentType: 'codebase-cross-cutting-performance-test',
    }).then(r => ({ type: 'performance-test', result: r })))
  }
  if (ccScope.frontendArchitecture) {
    tasks.push(() => agent(ccFrontendArchitecturePrompt(feedback), {
      label: 'CC: frontend-architecture (retry)',
      phase: 'Cross-Cutting',
      agentType: 'codebase-cross-cutting-frontend-architecture',
    }).then(r => ({ type: 'frontend-architecture', result: r })))
  }
  if (ccScope.frontendTestStrategy) {
    tasks.push(() => agent(ccFrontendTestStrategyPrompt(feedback), {
      label: 'CC: frontend-test-strategy (retry)',
      phase: 'Cross-Cutting',
      agentType: 'codebase-cross-cutting-frontend-test-strategy',
    }).then(r => ({ type: 'frontend-test-strategy', result: r })))
  }

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
if (completedPhases.has('HLD')) {
  log('⏭️ HLD — already DONE (resumed)')
  hldResult = resumeResults.HLD
  hldGatePassed = true
} else if (runHLD && serviceCount > 0 && !skipRemaining) {
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
let lldSynthGatePassed = false
if (completedPhases.has('LLD')) {
  log('⏭️ LLD — already DONE (resumed)')
  lldResults = resumeResults.LLD || []
  lldGatePassed = true
} else if (runLLD && serviceCount > 0 && !skipRemaining) {
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

    // LLD-Synthesis gate — non-cascading: a failed contracts gate degrades the artifact but does NOT skip SRS/IMP/TST
    const lldSynthGate = await gateCheck('lld-synthesis', { services, domains },
      async (fd) => { lldSynthesisResult = await rerunLldSynthesis(fd) },
      [foundationPath + 'contracts/api-*.yaml', foundationPath + 'contracts/error-codes.md'],
      false
    )
    lldSynthGatePassed = lldSynthGate.passed
  } else if (successfulLLD === 1) {
    log('LLD: Single service — synthesis skipped (no cross-service patterns to merge)')
  }

  // Gate check (validates per-service LLD + synthesis if applicable)
  const lldGate = await gateCheck('lld', { services, domains },
    async (fd) => { lldResults = await rerunLLD(fd); },
    services.map(s => foundationPath + 'tech-design/' + s.name + '-service.md')
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
let srsSynthGatePassed = false
let srsVerificationResult = null
if (completedPhases.has('SRS')) {
  log('⏭️ SRS — already DONE (resumed)')
  srsResults = resumeResults.SRS || []
  srsGatePassed = true
} else if (runSRS && domainCount > 0 && !skipRemaining) {
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

    // SRS-Synthesis gate — non-cascading: a failed README/traceability gate degrades the artifact but does NOT skip IMP/TST
    const srsSynthGate = await gateCheck('srs-synthesis', { services, domains },
      async (fd) => { srsSynthesisResult = await rerunSrsSynthesis(fd) },
      [foundationPath + 'features/README.md', foundationPath + 'traceability/requirements-matrix.md'],
      false
    )
    srsSynthGatePassed = srsSynthGate.passed
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

// -- Phase 4: Cross-Cutting (scope detection → Stage 1 ∥ → barrier → Stage 2 → gate) --

let ccResults = { 'error-handling': null, 'caching-strategy': null, 'performance-test': null, 'frontend-architecture': null, 'frontend-test-strategy': null }
let ccGatePassed = false

if (completedPhases.has('CROSS_CUTTING')) {
  log('⏭️ CROSS-CUTTING — already DONE (resumed)')
  ccResults = resumeResults.CROSS_CUTTING || ccResults
  ccGatePassed = true
} else if (!skipRemaining && (runCC || runSRS)) {

  // --- Scope Detection ---
  // Determine which cross-cutting agents to run based on available artifacts

  const hasBackendService = services.some(s => s.type === 'backend' || s.type === 'node' || s.type === 'go' || s.type === 'java')
  const hasFrontendService = services.some(s => s.type === 'frontend' || s.type === 'nextjs' || s.type === 'react')

  // error-handling: always if ≥1 backend service (error patterns exist even without synthesis)
  const ccErrorHandling = hasBackendService

  // caching-strategy: only if architecture.md §6 declares cache infrastructure
  // We check at runtime — default to true, agent self-detects and exits early if N/A
  const ccCachingStrategy = hasBackendService  // agent checks architecture.md §6 internally

  // performance-test: only if SRS has NFR-PERF-* targets
  // We check at runtime — default to true, agent self-detects and exits early if N/A
  const ccPerformanceTest = srsResults.filter(Boolean).length > 0  // need SRS outputs

  // frontend-architecture: only if architecture.md §1 declares frontend services
  const ccFrontendArchitecture = hasFrontendService

  // frontend-test-strategy: only if frontend-architecture runs in Stage 1
  const ccFrontendTestStrategy = ccFrontendArchitecture

  const ccScope = {
    errorHandling: ccErrorHandling,
    cachingStrategy: ccCachingStrategy,
    performanceTest: ccPerformanceTest,
    frontendArchitecture: ccFrontendArchitecture,
    frontendTestStrategy: ccFrontendTestStrategy,
  }

  const ccAgentCount = [ccErrorHandling, ccCachingStrategy, ccPerformanceTest, ccFrontendArchitecture, ccFrontendTestStrategy].filter(Boolean).length

  if (ccAgentCount > 0) {
    phase('Cross-Cutting')
    log(`Cross-Cutting: scope detection — ${ccAgentCount} agent(s) applicable`)
    log(`  error-handling: ${ccErrorHandling ? 'YES' : 'no (no backend)'}`)
    log(`  caching-strategy: ${ccCachingStrategy ? 'YES' : 'no (no backend)'}`)
    log(`  performance-test: ${ccPerformanceTest ? 'YES' : 'no (no SRS NFRs)'}`)
    log(`  frontend-architecture: ${ccFrontendArchitecture ? 'YES' : 'no (no frontend service)'}`)
    log(`  frontend-test-strategy: ${ccFrontendTestStrategy ? 'YES (Stage 2)' : 'no (no frontend-architecture)'}`)

    // --- Stage 1: 4 agents in parallel ---

    const stage1Tasks = []
    if (ccErrorHandling) {
      stage1Tasks.push(() => agent(ccErrorHandlingPrompt(), {
        label: 'CC: error-handling',
        phase: 'Cross-Cutting',
        agentType: 'codebase-cross-cutting-error-handling',
      }).then(r => ({ type: 'error-handling', result: r })))
    }
    if (ccCachingStrategy) {
      stage1Tasks.push(() => agent(ccCachingStrategyPrompt(), {
        label: 'CC: caching-strategy',
        phase: 'Cross-Cutting',
        agentType: 'codebase-cross-cutting-caching-strategy',
      }).then(r => ({ type: 'caching-strategy', result: r })))
    }
    if (ccPerformanceTest) {
      stage1Tasks.push(() => agent(ccPerformanceTestPrompt(), {
        label: 'CC: performance-test',
        phase: 'Cross-Cutting',
        agentType: 'codebase-cross-cutting-performance-test',
      }).then(r => ({ type: 'performance-test', result: r })))
    }
    if (ccFrontendArchitecture) {
      stage1Tasks.push(() => agent(ccFrontendArchitecturePrompt(), {
        label: 'CC: frontend-architecture',
        phase: 'Cross-Cutting',
        agentType: 'codebase-cross-cutting-frontend-architecture',
      }).then(r => ({ type: 'frontend-architecture', result: r })))
    }

    log(`Cross-Cutting Stage 1: spawning ${stage1Tasks.length} agent(s) in parallel...`)
    const stage1Results = await parallel(stage1Tasks)

    // Collect Stage 1 results
    for (const r of stage1Results.filter(Boolean)) {
      ccResults[r.type] = r.result
      const issues = countIssues(r.result)
      log(`  CC ${r.type}: ${r.result ? 'complete' : 'FAILED'} — ${issues} UNCERTAINTY flag(s)`)
    }

    // --- Barrier: wait for error-handling + frontend-architecture ---
    // frontend-test-strategy needs both as input

    if (ccFrontendTestStrategy && ccResults['frontend-architecture']) {
      log('Cross-Cutting Stage 2: spawning frontend-test-strategy (depends on error-handling + frontend-architecture)...')
      const stage2Result = await agent(ccFrontendTestStrategyPrompt(), {
        label: 'CC: frontend-test-strategy',
        phase: 'Cross-Cutting',
        agentType: 'codebase-cross-cutting-frontend-test-strategy',
      })
      ccResults['frontend-test-strategy'] = stage2Result
      log(`  CC frontend-test-strategy: ${stage2Result ? 'complete' : 'FAILED'} — ${countIssues(stage2Result)} UNCERTAINTY flag(s)`)
    } else if (ccFrontendTestStrategy && !ccResults['frontend-architecture']) {
      log('  CC frontend-test-strategy: SKIPPED — frontend-architecture failed in Stage 1')
    }

    // --- Cross-Cutting Gate ---

    const ccExpectedOutputs = []
    if (ccErrorHandling) ccExpectedOutputs.push(foundationPath + 'error-handling.md')
    if (ccCachingStrategy) ccExpectedOutputs.push(foundationPath + 'caching-strategy.md')
    if (ccPerformanceTest) ccExpectedOutputs.push(foundationPath + 'performance-test.md')
    if (ccFrontendArchitecture) ccExpectedOutputs.push(foundationPath + 'frontend-architecture.md')
    if (ccFrontendTestStrategy) ccExpectedOutputs.push(foundationPath + 'frontend-test-strategy.md')

    const ccGate = await gateCheck('cross-cutting', { services, domains },
      async (fd) => {
        const retried = await rerunCrossCutting(fd, ccScope)
        for (const r of (retried || []).filter(Boolean)) {
          ccResults[r.type] = r.result
        }
      },
      ccExpectedOutputs
    )
    ccGatePassed = ccGate.passed
  } else {
    log('Cross-Cutting: No agents applicable — skipping')
    ccGatePassed = true  // no-op gate passes
  }
} else {
  if (skipRemaining) {
    log('Cross-Cutting: Skipped (gate exhaustion from previous phase)')
  } else {
    log('⏭️  Cross-Cutting: Skipped (not in --artifacts scope)')
    ccGatePassed = true  // intentionally skipped, not a failure
  }
}

// -- Phase 5: IMP+TST (fan-out per domain + gate) --

let impResults = []
let tstResults = []
let impGatePassed = false
let tstGatePassed = false
if (completedPhases.has('IMP') && completedPhases.has('TST')) {
  log('⏭️ IMP+TST — already DONE (resumed)')
  impResults = resumeResults.IMP || []
  tstResults = resumeResults.TST || []
  impGatePassed = true
  tstGatePassed = true
} else if ((runIMP || runTST) && domainCount > 0 && !skipRemaining) {
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
      domains.flatMap(d => [foundationPath + 'backend/*/implementation/FR-' + d.name.toUpperCase() + '-*-impl.md', foundationPath + 'frontend/*/implementation/FR-' + d.name.toUpperCase() + '-*-impl.md'])
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
      domains.flatMap(d => [foundationPath + 'backend/*/test-specs/FR-' + d.name.toUpperCase() + '-*-test.md', foundationPath + 'frontend/*/test-specs/FR-' + d.name.toUpperCase() + '-*-test.md'])
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
const ccErrorHandlingResult = ccResults['error-handling']
const ccCachingStrategyResult = ccResults['caching-strategy']
const ccPerformanceTestResult = ccResults['performance-test']
const ccFrontendArchitectureResult = ccResults['frontend-architecture']
const ccFrontendTestStrategyResult = ccResults['frontend-test-strategy']

const phaseResults = [
  { name: 'HLD', result: hldResult },
  ...lldResults.filter(Boolean).map((r, i) => ({ name: `LLD:${services[i]?.name || i}`, result: r })),
  { name: 'LLD-Synthesis', result: lldSynthesisResult },
  ...srsResults.filter(Boolean).map((r, i) => ({ name: `SRS:${domains[i]?.name || i}`, result: r })),
  { name: 'SRS-Synthesis', result: srsSynthesisResult },
  { name: 'CC:error-handling', result: ccErrorHandlingResult },
  { name: 'CC:caching-strategy', result: ccCachingStrategyResult },
  { name: 'CC:performance-test', result: ccPerformanceTestResult },
  { name: 'CC:frontend-architecture', result: ccFrontendArchitectureResult },
  { name: 'CC:frontend-test-strategy', result: ccFrontendTestStrategyResult },
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
const ccOk = [ccErrorHandlingResult, ccCachingStrategyResult, ccPerformanceTestResult, ccFrontendArchitectureResult, ccFrontendTestStrategyResult].filter(Boolean).length
const impOk = impResults.length
const tstOk = tstResults.length

// Gate summary
const gatePasses = gateResults.filter(g => g.passed).length
const gateFails = gateResults.filter(g => !g.passed).length
// Cascading exhaustion → remaining phases skipped. Non-cascading (synthesis) exhaustion → pipeline continued.
const exhaustedGates = gateResults.filter(g => !g.passed && g.attempt === MAX_RETRIES && g.cascade !== false)
const nonCascadingExhausted = gateResults.filter(g => !g.passed && g.attempt === MAX_RETRIES && g.cascade === false)

const pipelineStatus = skipRemaining
  ? 'partial (gate exhaustion)'
  : (hldOk || lldOk > 0 || srsOk > 0 || ccOk > 0 || impOk > 0 || tstOk > 0)
    ? 'completed'
    : 'failed'

log('')
log(`🏁 Pipeline ${pipelineStatus}`)
log(`   ✅ HLD: ${hldOk ? 'complete' : 'skipped'} | Gate: ${hldGatePassed ? 'PASS' : (hldOk ? 'FAIL' : 'N/A')}`)
log(`   ✅ LLD: ${lldOk}/${serviceCount} services | Synthesis: ${lldSynthOk ? 'done' : 'skipped'} | Synth gate: ${lldSynthGatePassed ? 'PASS' : (lldSynthOk ? 'FAIL' : 'N/A')} | Gate: ${lldGatePassed ? 'PASS' : (lldOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ SRS: ${srsOk}/${domainCount} domains | Synthesis: ${srsSynthOk ? 'done' : 'skipped'} | Synth gate: ${srsSynthGatePassed ? 'PASS' : (srsSynthOk ? 'FAIL' : 'N/A')} | Gate: ${srsGatePassed ? 'PASS' : (srsOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ CC: ${ccOk}/5 cross-cutting agents | Gate: ${ccGatePassed ? 'PASS' : (ccOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ IMP: ${impOk}/${domainCount} domains | Gate: ${impGatePassed ? 'PASS' : (impOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   ✅ TST: ${tstOk}/${domainCount} domains | Gate: ${tstGatePassed ? 'PASS' : (tstOk > 0 ? 'FAIL' : 'N/A')}`)
log(`   📄 Total outputs: ${allOutputs.size} files`)
log(`   ⚠️ Total warnings: ${allWarnings.length}`)
if (srsVerificationResult) {
  const vs = srsVerificationResult.stats
  log(`   🔍 SRS Verification: ${vs.total} FRs — ${vs.confirmed} CONFIRMED, ${vs.uncertain} UNCERTAIN, ${vs.rejected} REJECTED`)
}
log(`   🚦 Gate summary: ${gatePasses} passed, ${gateFails} failed${exhaustedGates.length > 0 ? ` (${exhaustedGates.length} exhausted at ${MAX_RETRIES} retries)` : ''}`)
if (nonCascadingExhausted.length > 0) {
  log(`   ⚠️ Non-cascading synthesis gates exhausted (pipeline continued): ${nonCascadingExhausted.map(g => g.phase).join(', ')}`)
}

if (allWarnings.length > 0) {
  allWarnings.forEach(w => log(`      ${w}`))
}

// Gate exhaustion details
if (exhaustedGates.length > 0) {
  log('')
  log('🛑 GATE EXHAUSTION REPORT:')
  log('   The following phases failed gate checks after ' + MAX_RETRIES + ' retries and were skipped:')
  exhaustedGates.forEach(g => {
    log(`      - ${g.phase}: ${g.summary}`)
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
- **Cross-Cutting**: ${ccOk}/5 agents | Gate: ${ccGatePassed ? 'PASS' : (ccOk > 0 ? 'FAIL' : 'N/A')}
- **IMP**: ${impOk}/${domainCount} domains | Gate: ${impGatePassed ? 'PASS' : (impOk > 0 ? 'FAIL' : 'N/A')}
- **TST**: ${tstOk}/${domainCount} domains | Gate: ${tstGatePassed ? 'PASS' : (tstOk > 0 ? 'FAIL' : 'N/A')}
- **Total outputs**: ${allOutputs.size} files
- **Warnings**: ${allWarnings.length} (${allWarnings.join('; ') || 'none'})
${exhaustedGates.length > 0 ? `- **GATE EXHAUSTED**: ${exhaustedGates.map(g => g.phase).join(', ')} — remaining phases skipped` : ''}
${nonCascadingExhausted.length > 0 ? `- **SYNTHESIS GATES EXHAUSTED (non-cascading)**: ${nonCascadingExhausted.map(g => g.phase).join(', ')} — artifacts degraded, pipeline continued` : ''}

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
    crossCutting: {
      errorHandling: ccErrorHandlingResult != null,
      cachingStrategy: ccCachingStrategyResult != null,
      performanceTest: ccPerformanceTestResult != null,
      frontendArchitecture: ccFrontendArchitectureResult != null,
      frontendTestStrategy: ccFrontendTestStrategyResult != null,
      total: ccOk,
    },
    imp: impOk,
    tst: tstOk,
  },
  gates: {
    total: gateResults.length,
    passed: gatePasses,
    failed: gateFails,
    exhausted: exhaustedGates.length,
    exhaustedNonCascading: nonCascadingExhausted.length,
    results: gateResults.map(g => ({
      phase: g.phase,
      attempt: g.attempt,
      passed: g.passed,
      cascade: g.cascade,
      summary: g.summary,
    })),
  },
  outputs: [...allOutputs],
  warnings: allWarnings,
  criticFindings: criticResult ? extractSummary(criticResult, 'critic') : null,
  summary: `Reverse engineered ${serviceCount} service(s) across ${domainCount} domain(s) with ${ccOk}/5 cross-cutting agent(s). ${allOutputs.size} files generated. ${gatePasses}/${gateResults.length} gates passed${exhaustedGates.length > 0 ? `, ${exhaustedGates.length} gates exhausted (remaining phases skipped)` : ''}${nonCascadingExhausted.length > 0 ? `, ${nonCascadingExhausted.length} synthesis gate(s) exhausted (pipeline continued)` : ''}. ${allWarnings.length} warnings.`,
}

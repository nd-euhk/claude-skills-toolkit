export const meta = {
  name: 'workflow-review-mr-pipeline',
  description: 'Review MR/PR across 6 dimensions in parallel with optional adversarial verification, synthesis, and report generation',
  phases: [
    { title: 'Review', detail: '6 specialized subagents review in parallel' },
    { title: 'Verify', detail: 'Adversarially verify findings with diverse-lens skeptics (adversarial mode only)' },
    { title: 'Synthesize', detail: 'Merge, deduplicate, compute overall verdict' },
    { title: 'Report', detail: 'Generate markdown review report' },
  ],
}

// ── Args ──
// {
//   diff: string,           // full unified diff
//   metadata: {             // MR metadata from gh/glab
//     id: number,
//     title: string,
//     author: string,
//     branch: string,
//     files: string[],
//     loc: number,
//     url: string,
//   },
//   repoPath: string,       // absolute path to repo
//   platform: 'github' | 'gitlab',
//   dimensions: string[],   // e.g. ['arch', 'security', 'bugs', 'conventions', 'impact', 'ops']
//   adversarial: boolean,   // enable Verify phase
//   runDate: string,        // YYYYMMDD for report filename
// }
const { diff, metadata, repoPath, platform, dimensions, adversarial, runDate } = args

const dimNames = dimensions.join(', ')

// ── Schemas ──
const SUBAGENT_OUTPUT = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          recommendation: { type: 'string' },
          affected_files: { type: 'array', items: { type: 'string' } },
        },
        required: ['severity', 'description', 'recommendation'],
      },
    },
  },
  required: ['verdict', 'findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    confirmed: { type: 'boolean' },
    reasoning: { type: 'string' },
    isFalsePositive: { type: 'boolean' },
  },
  required: ['confirmed', 'reasoning'],
}

const SYNTHESIS = {
  type: 'object',
  properties: {
    overallVerdict: { type: 'string', enum: ['APPROVED', 'NEEDS_ATTENTION', 'URGENT'] },
    mergedFindings: { type: 'array', items: { type: 'object' } },
    summary: { type: 'string' },
  },
  required: ['overallVerdict', 'mergedFindings'],
}

const REPORT_RESULT = {
  type: 'object',
  properties: {
    reportPath: { type: 'string' },
    verdict: { type: 'string' },
    totalFindings: { type: 'number' },
  },
  required: ['reportPath', 'verdict', 'totalFindings'],
}

// ── Dimension config ──
const ALL_DIMENSIONS = {
  arch: { agentType: 'review-mr-arch', label: 'Architecture', verdictSeverity: 'URGENT' },
  security: { agentType: 'review-mr-security', label: 'Security', verdictSeverity: 'CRITICAL' },
  bugs: { agentType: 'review-mr-bugs', label: 'Bug Detection', verdictSeverity: 'BUG_FOUND' },
  conventions: { agentType: 'review-mr-conventions', label: 'CLAUDE.md Compliance', verdictSeverity: 'VIOLATION' },
  impact: { agentType: 'review-mr-impact', label: 'Feature Impact', verdictSeverity: 'BLOCKER' },
  ops: { agentType: 'review-mr-ops', label: 'Operational Impact', verdictSeverity: 'BLOCKER' },
}

// ── Helpers ──

/** Build the input context for review subagents */
function subagentContext() {
  return `## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- Files changed: ${metadata.files ? metadata.files.length : 'unknown'}
- Lines changed: ${metadata.loc || 'unknown'}
- URL: ${metadata.url || 'unknown'}
- Platform: ${platform}
- Repo path: ${repoPath}

## Full Unified Diff

${diff}`
}

/** Build the context for synthesis (without full diff to save tokens) */
function synthesisContext(findingsByDim) {
  return `## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- Files changed: ${metadata.files ? metadata.files.length : 'unknown'}
- Lines changed: ${metadata.loc || 'unknown'}
- URL: ${metadata.url || 'unknown'}
- Platform: ${platform}

## Review Findings by Dimension

${JSON.stringify(findingsByDim, null, 2)}`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

const context = subagentContext()
const failedDimensions = []
let reviewResults = []

// ── Phase 1: Review — all dimensions in parallel ──
phase('Review')
log(`Dispatching ${dimensions.length} review subagent(s) in parallel: ${dimNames}`)

const rawResults = await parallel(
  dimensions.map(dim => () => {
    const cfg = ALL_DIMENSIONS[dim]
    return agent(
      `You are a ${cfg.label} review specialist. Review this MR/PR diff thoroughly.

${context}

Return your findings in the structured output format with verdict and findings array. Focus ONLY on ${cfg.label.toLowerCase()} issues. Be specific — cite exact file paths and line numbers where possible.`,
      {
        label: `review:${dim}`,
        phase: 'Review',
        agentType: cfg.agentType,
        schema: SUBAGENT_OUTPUT,
      }
    )
  })
)

// Process review results — handle partial failures
for (let i = 0; i < dimensions.length; i++) {
  const dim = dimensions[i]
  const result = rawResults[i]
  if (!result) {
    log(`⚠ ${ALL_DIMENSIONS[dim].label}: subagent failed or returned no output`)
    failedDimensions.push(dim)
  } else {
    const findingCount = result.findings ? result.findings.length : 0
    log(`✓ ${ALL_DIMENSIONS[dim].label}: ${result.verdict} (${findingCount} finding(s))`)
    reviewResults.push({ dimension: dim, label: ALL_DIMENSIONS[dim].label, ...result })
  }
}

if (reviewResults.length === 0) {
  log('✗ All subagents failed — no review results to process')
  return {
    reportPath: null,
    verdict: 'ERROR',
    findings: [],
    dimensions: {},
    stats: { totalFindings: 0, duration: 'N/A' },
    failedDimensions,
  }
}

// ── Phase 2: Verify (adversarial mode only) ──
let verifiedFindings = []

if (adversarial) {
  phase('Verify')

  // Collect all findings from all dimensions
  const allFindings = []
  for (const r of reviewResults) {
    for (const f of r.findings || []) {
      allFindings.push({ ...f, dimension: r.dimension, dimensionLabel: r.label })
    }
  }

  log(`Adversarial verification: ${allFindings.length} finding(s) to verify`)

  if (allFindings.length === 0) {
    log('No findings to verify — skipping Verify phase')
    verifiedFindings = []
  } else {
    // Pipeline: each finding verified by 3 diverse-lens skeptics
    const verifyResults = await pipeline(
      allFindings,
      async (finding) => {
        const desc = finding.description.slice(0, 80)
        log(`Verifying: ${desc}...`)

        const votes = await parallel([
          () => agent(
            `You are a CODE CORRECTNESS skeptic. Your job is to REFUTE this finding if it is a false positive.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(', ')}

**MR context**: ${metadata.title} — ${metadata.files ? metadata.files.length : '?'} files, ${metadata.loc || '?'} LOC

**Instructions**: Look at the actual code behavior. Could this be:
- Already handled elsewhere (middleware, framework, upstream)?
- A deliberate design choice, not a bug?
- Based on incorrect assumptions about the code path?

Default to confirmed=false (refute) if you are uncertain. Return confirmed=true ONLY if you are confident this is a real issue.`,
            {
              label: `verify:correctness:${finding.description.slice(0, 40)}`,
              phase: 'Verify',
              schema: VERDICT,
            }
          ),
          () => agent(
            `You are a SECURITY skeptic. Your job is to REFUTE this finding if it is a false positive.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(', ')}

**MR context**: ${metadata.title} — ${metadata.files ? metadata.files.length : '?'} files, ${metadata.loc || '?'} LOC

**Instructions**: Is this genuinely exploitable or does it have mitigating controls?
- Is there input validation upstream?
- Is the affected code reachable from user input?
- Are there compensating controls (WAF, rate limiting, auth layer)?

Default to confirmed=false (refute) if you are uncertain. Return confirmed=true ONLY if you are confident this is a real security concern.`,
            {
              label: `verify:security:${finding.description.slice(0, 40)}`,
              phase: 'Verify',
              schema: VERDICT,
            }
          ),
          () => agent(
            `You are a REPRODUCIBILITY skeptic. Your job is to REFUTE this finding if it cannot be reproduced from the diff alone.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(', ')}

**MR context**: ${metadata.title} — ${metadata.files ? metadata.files.length : '?'} files, ${metadata.loc || '?'} LOC

**Instructions**: Can you actually trigger this issue given the code in the diff?
- Is the affected code path actually changed in this MR?
- Would existing tests catch this?
- Is the finding speculation vs. concrete?

Default to confirmed=false (refute) if you are uncertain. Return confirmed=true ONLY if you are confident the issue is reproducible.`,
            {
              label: `verify:repro:${finding.description.slice(0, 40)}`,
              phase: 'Verify',
              schema: VERDICT,
            }
          ),
        ])

        const validVotes = votes.filter(Boolean)
        const confirmedCount = validVotes.filter(v => v.confirmed).length
        const survived = confirmedCount >= 2

        if (!survived) {
          log(`  ✗ Rejected: ${confirmedCount}/3 confirmed — ${desc}`)
        } else {
          log(`  ✓ Survived: ${confirmedCount}/3 confirmed — ${desc}`)
        }

        return {
          ...finding,
          verified: survived,
          verificationVotes: confirmedCount,
          verificationDetails: validVotes.map(v => v.reasoning),
          rejected: !survived,
        }
      }
    )

    verifiedFindings = verifyResults.filter(Boolean).filter(f => f.verified)
    const rejectedCount = verifyResults.filter(Boolean).filter(f => f.rejected).length
    log(`Verification complete: ${verifiedFindings.length} confirmed, ${rejectedCount} rejected (false positives)`)
  }
} else {
  // Standard mode — all findings pass through without verification
  for (const r of reviewResults) {
    for (const f of r.findings || []) {
      verifiedFindings.push({ ...f, dimension: r.dimension, dimensionLabel: r.label, verified: true })
    }
  }
}

// ── Phase 3: Synthesize ──
phase('Synthesize')

// Build per-dimension summary for synthesis
const findingsByDim = {}
for (const r of reviewResults) {
  findingsByDim[r.dimension] = {
    label: r.label,
    verdict: r.verdict,
    findings: r.findings || [],
  }
}

const synthesisInput = synthesisContext(findingsByDim)
const verifiedContext = adversarial
  ? `\n\n## Adversarial Verification Results\n${verifiedFindings.length} findings survived adversarial verification. These are the ONLY findings to include in the final report — rejected findings have been filtered out.\n${JSON.stringify(verifiedFindings, null, 2)}`
  : `\n\n## Findings to Include\n${JSON.stringify(verifiedFindings, null, 2)}`

const synthesis = await agent(
  `You are a review synthesizer. Merge, deduplicate, and compute the overall verdict.

${synthesisInput}${verifiedContext}

**Instructions**:
1. **Deduplicate**: If multiple dimensions flagged the same underlying issue (same file + same line range, or same problem), merge them into ONE finding with multiple category tags. Example: missing input validation flagged by both security AND bugs → one finding tagged [security, bugs].
2. **Compute overall verdict** (based on highest severity):
   - Any CRITICAL, URGENT, or BLOCKER → **URGENT**
   - Any BUG_FOUND, VIOLATION, or HIGH_RISK → **NEEDS_ATTENTION**
   - Otherwise → **APPROVED**
3. **Write a summary**: 2-3 sentences capturing the key risk of this MR.

Return the merged findings and overall verdict.`,
  {
    label: 'synthesize',
    phase: 'Synthesize',
    agentType: 'general-purpose',
    schema: SYNTHESIS,
  }
)

if (!synthesis) {
  log('✗ Synthesis failed')
  return {
    reportPath: null,
    verdict: 'ERROR',
    findings: verifiedFindings,
    dimensions: findingsByDim,
    stats: {
      totalFindings: verifiedFindings.length,
      verifiedFindings: adversarial ? verifiedFindings.length : undefined,
      rejectedFindings: adversarial
        ? (reviewResults.flatMap(r => r.findings || []).length - verifiedFindings.length)
        : undefined,
      duration: 'N/A',
    },
    failedDimensions,
  }
}

// ── Phase 4: Report ──
phase('Report')

// Build MR slug for filename
const titleSlug = (metadata.title || 'untitled')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 50)
const mrSlug = `${platform}-${metadata.id}-${titleSlug}`
const reportDir = `${repoPath}/.work/review-mr`

const report = await agent(
  `You are a report generator. Create a comprehensive markdown review report.

## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- URL: ${metadata.url || 'unknown'}
- Platform: ${platform}
- Files changed: ${metadata.files ? metadata.files.length : 'unknown'}
- Lines changed: ${metadata.loc || 'unknown'}
- Review date: ${runDate}

## Overall Verdict: ${synthesis.overallVerdict}

## Merged Findings
${JSON.stringify(synthesis.mergedFindings, null, 2)}

## Summary
${synthesis.summary}

## Per-Dimension Results
${JSON.stringify(findingsByDim, null, 2)}

## Mode
${adversarial ? 'Adversarial verification enabled — findings verified by 3 independent skeptics' : 'Standard — no adversarial verification'}

${failedDimensions.length > 0 ? `\n## ⚠ Failed Dimensions\n${failedDimensions.map(d => `- ${ALL_DIMENSIONS[d].label}`).join('\n')}` : ''}

**Instructions**:
1. Generate a complete markdown report following this structure:
   - Title: "MR Review: {title}"
   - Meta line: MR URL, Author, Branch, Files, +/- lines, Review date
   - Overall Verdict with emoji (✅ APPROVED, ⚠️ NEEDS_ATTENTION, 🚨 URGENT)
   - Per-dimension sections (only for dimensions that had findings or were reviewed)
   - Summary table with all findings
   - Mode indicator (Standard vs Adversarial)
   - Failed dimensions warning (if any)
2. Use severity-colored badges/emoji for each finding
3. Use the Bash tool to ensure directory ${reportDir} exists: mkdir -p ${reportDir}
4. Write the report using the Write tool to: ${reportDir}/REVIEW-${runDate}--${mrSlug}.md
5. The report MUST be written to disk, not just generated in your response.

Return the path to the saved report file, the verdict, and total finding count.`,
  {
    label: 'report',
    phase: 'Report',
    agentType: 'general-purpose',
    schema: REPORT_RESULT,
  }
)

// ── Return ──
const totalRawFindings = reviewResults.flatMap(r => r.findings || []).length

return {
  reportPath: report ? report.reportPath : null,
  verdict: synthesis.overallVerdict,
  findings: synthesis.mergedFindings,
  dimensions: findingsByDim,
  stats: {
    totalFindings: synthesis.mergedFindings ? synthesis.mergedFindings.length : 0,
    rawFindings: totalRawFindings,
    verifiedFindings: adversarial ? verifiedFindings.length : undefined,
    rejectedFindings: adversarial ? (totalRawFindings - verifiedFindings.length) : undefined,
    dimensionsRun: dimensions.length,
    dimensionsFailed: failedDimensions.length,
    duration: 'completed',
  },
  failedDimensions: failedDimensions.length > 0 ? failedDimensions : undefined,
}

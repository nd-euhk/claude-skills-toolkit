export const meta = {
  name: 'workflow-sdlc-review-code',
  description: 'Review source code across 7 dimensions with inline subagent prompts, codebase exploration, optional adversarial verification, synthesis, and report generation',
  phases: [
    { title: 'Review', detail: '7 specialized subagents review discovered code in parallel (inline prompts)' },
    { title: 'Verify', detail: 'Adversarially verify findings with diverse-lens skeptics (adversarial mode only)' },
    { title: 'Synthesize', detail: 'Merge, deduplicate, compute overall verdict' },
    { title: 'Report', detail: 'Generate markdown review report' },
  ],
}

// ── Args ──
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { repoPath, targetPath, dimensions, adversarial, runDate, scoutReports } = _args
const dimNames = dimensions.join(', ')
const normalizedPath = targetPath || "."

// ═══════════════════════════════════════════
// SCHEMAS (shared with MR workflow)
// ═══════════════════════════════════════════

const SUBAGENT_OUTPUT = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    decision_rationale: {
      type: "object",
      properties: {
        alignment: { type: "string" },
        alignment_detail: { type: "string" },
        risk_value: { type: "string" },
        risk_value_detail: { type: "string" },
        confidence: { type: "string" },
      },
      required: ["alignment", "risk_value", "confidence"],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          evidence: {
            type: "object",
            properties: {
              file: { type: "string" },
              line: { type: "string" },
              snippet: { type: "string" },
            },
            required: ["file", "line", "snippet"],
          },
          recommendation: { type: "string" },
          affected_files: { type: "array", items: { type: "string" } },
        },
        required: ["severity", "description", "evidence", "recommendation"],
      },
    },
  },
  required: ["verdict", "findings"],
}

const VERDICT = {
  type: "object",
  properties: {
    confirmed: { type: "boolean" },
    reasoning: { type: "string" },
    isFalsePositive: { type: "boolean" },
  },
  required: ["confirmed", "reasoning"],
}

const SYNTHESIS = {
  type: "object",
  properties: {
    overallVerdict: { type: "string", enum: ["APPROVED", "NEEDS_ATTENTION", "URGENT"] },
    mergedFindings: { type: "array", items: { type: "object" } },
    decision_summary: { type: "string" },
    summary: { type: "string" },
  },
  required: ["overallVerdict", "mergedFindings"],
}

const REPORT_RESULT = {
  type: "object",
  properties: {
    reportPath: { type: "string" },
    verdict: { type: "string" },
    totalFindings: { type: "number" },
  },
  required: ["reportPath", "verdict", "totalFindings"],
}

// ═══════════════════════════════════════════
// INLINE SUBAGENT PROMPTS — CODE REVIEW EDITION
// Adapted from MR prompts: explore codebase instead of analyzing diff
// ═══════════════════════════════════════════

const ARCH_PROMPT = `You are an ARCHITECTURE REVIEW SPECIALIST. Explore and review the source code in the target path for architectural quality. Focus ONLY on architecture — not code style, security, or bugs.

## Workflow
1. FIRST: Explore the target directory structure. Use Bash(find, ls) or Glob to understand module/package layout.
2. Find and read any ARCHITECTURE.md, README.md, ADR files (**/adr/*.md, **/decisions/*.md), or CLAUDE.md files for architectural rules.
3. Read key source files to understand: service boundaries, component layering, dependency direction, interface design.
4. Evaluate against the criteria below. Every finding MUST cite specific file paths and line numbers.

## What to Evaluate

### Architecture & Structure
- Is there a clear separation of concerns? (domain, application, infrastructure, presentation layers)
- Are module/service boundaries well-defined with clear responsibilities?
- Is the dependency direction correct? (domain should not depend on infrastructure)
- Are there circular dependencies between modules/packages?
- Do inter-service/module communication patterns follow consistent standards?

### ADR & Documentation Compliance
- Do architectural decisions in the code match documented ADRs (if any)?
- Are there architectural patterns in the code that should be documented as ADRs?
- Do CLAUDE.md architectural rules appear to be followed?

### Design Quality
- SOLID principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- Coupling: Are there tightly coupled modules that should be decoupled?
- Cohesion: Do components have focused, single responsibilities?
- Design patterns: Appropriate use? Over-engineering? Missing abstraction where needed?

### Code Organization
- Is the directory/package structure logical and consistent?
- Are files appropriately sized? (Flag files >500 lines for potential refactoring)
- Is the public API surface minimal and well-defined? (Check exports/public classes)

## Verdict
- APPROVED: Clean architecture, good separation of concerns, follows documented patterns.
- NEEDS_ATTENTION: Architectural concerns found — coupling issues, layering violations, missing documentation.
- URGENT: Critical architectural problems — circular dependencies, no separation of concerns, fundamental design flaws.

## CRITICAL RULES
1. EXPLORE FIRST before making judgments. Use Bash(find, ls), Glob, Grep, and Read to understand the codebase.
2. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
3. Remove any finding that lacks concrete evidence.
4. Only evaluate architecture — not code style, naming, formatting, or bugs.

Return structured output with verdict and findings array.`;

const SECURITY_PROMPT = `You are a SECURITY REVIEW SPECIALIST. Explore and review the source code in the target path for security vulnerabilities.

## Workflow
1. FIRST: Explore the target directory. List all files using Bash(find, ls) or Glob.
2. Search for security-sensitive patterns: authentication, authorization, input validation, cryptography, secrets management, data sanitization.
3. Read relevant files deeply. Every finding MUST cite specific file paths and line numbers.

## What to Evaluate

### OWASP Top 10
- Injection: SQL, NoSQL, OS command, LDAP — is user input sanitized before use in queries/commands?
- Broken Authentication: Weak password policies? Missing MFA? Session fixation risks?
- Sensitive Data Exposure: PII, credentials, tokens in logs/error messages/client-side code?
- Broken Access Control: Missing auth checks? IDOR patterns? Privilege escalation paths?
- Security Misconfiguration: Default credentials? Verbose error messages? Unnecessary HTTP methods?
- XSS: Unescaped user input in HTML/JS output?
- Insecure Deserialization: Deserializing untrusted data?
- Known Vulnerabilities: Outdated dependencies with CVEs? (Check package files)
- Insufficient Logging: Missing audit logs for auth events, sensitive data changes?

### Secrets Detection
- Hardcoded API keys, passwords, tokens, private keys
- Secrets in config files, env defaults, comments
- Connection strings with embedded credentials

### Auth/Authz Patterns
- Are all endpoints/operations protected by authentication?
- Is authorization checked at the appropriate granularity?
- Token handling: hardcoded secrets? Tokens in URLs? Missing validation?

### Data Protection
- Sensitive data encrypted at rest and in transit?
- Input validation on all user-facing entry points?
- Output encoding to prevent XSS?

## Verdict
- APPROVED: No security concerns found.
- NEEDS_ATTENTION: Security concerns — should be reviewed by security engineer.
- CRITICAL: Exploitable vulnerability, hardcoded secret, auth bypass, data exposure. Must be fixed.

## CRITICAL RULES
1. EXPLORE FIRST. Search for security patterns before making judgments.
2. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
3. Check if compensating controls exist before flagging (middleware, input validators, WAF config).
4. CRITICAL requires specificity — describe exact exploitation path.

Return structured output with verdict and findings array.`;

const BUGS_PROMPT = `You are a BUG DETECTION SPECIALIST. Explore and review the source code in the target path for potential bugs.

## Workflow
1. FIRST: Explore the target directory. List files and understand the code structure.
2. Focus on data flow paths: trace user input -> processing -> output. Identify all error paths.
3. Read key files deeply. Every finding MUST cite specific file paths and line numbers.

## What to Evaluate (5 categories)

### 1. Logic Bugs
- Inverted conditions, off-by-one errors, wrong variable references (copy-paste)
- Boolean logic errors (&& vs ||, missing parentheses), operator precedence issues
- Assignment vs comparison (= used where == or === intended)
- Switch/case fallthrough bugs, floating point comparison issues

### 2. Race Conditions
- Shared mutable state without synchronization (locks, mutexes, atomics)
- Async operations without error handling or cancellation
- Promise/goroutine/thread leaks, deadlock potential (nested locks)
- TOCTOU (check-then-act where state could change)
- Concurrent map/slice writes without synchronization

### 3. Edge Cases
- null/undefined/nil/None handling: checked before use?
- Empty states: empty string, array, object, response
- Boundary values: 0, -1, MAX_INT, MIN_INT, NaN, Infinity
- Type coercion traps, large values, negative values when only positive expected
- Concurrent modification while iterating

### 4. Error Handling
- Empty catch blocks that silently swallow errors
- Overly broad catch without re-throwing, missing error propagation
- Retry without backoff or limit, missing timeout on network/IO
- Resource cleanup: files, connections, locks not freed in error paths
- Transaction rollback missing on error in multi-step operations

### 5. Type Safety
- Type assertion without guard, implicit any types
- Union types not exhausted, optional chaining result not null-checked
- Enum mismatch, generic type misuse

### Cross-File Consistency
- Function signatures match all call sites? Exported functions used correctly by consumers?
- Order of operations make sense across files? Assumptions in one file violated by another?

## Verdict
- APPROVED: No bugs found. Code appears correct.
- NEEDS_ATTENTION: Potential issues — should be reviewed by human.
- BUG_FOUND: Definite bug — logic error, race condition, null crash, memory leak.

## CRITICAL RULES
1. EXPLORE FIRST. Trace data flow before judging.
2. BUG_FOUND requires specificity — describe exact conditions where bug manifests.
3. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
4. Use POTENTIAL severity if unsure; use BUG if definitely reproducible.
5. Bugs are defects in behavior, not style — don't flag naming or formatting.

Return structured output with verdict and findings array.`;

const CONVENTIONS_PROMPT = `You are a CLAUDE.md CONVENTIONS SPECIALIST. Explore and review the source code in the target path for compliance with project conventions.

## Workflow
1. FIRST: Find and READ all CLAUDE.md files in the repo (root, per-module, per-service).
2. Understand documented naming conventions, code patterns, architectural rules, testing standards.
3. Explore the target path. Compare code against each documented convention.
4. Every finding MUST cite both: the specific CLAUDE.md rule AND the violating code location.

## What to Evaluate

### CLAUDE.md Compliance
- Naming conventions: files, directories, classes, functions, variables follow documented patterns?
- Code patterns: error handling, logging, dependency injection match documented patterns?
- Architectural rules: layer dependencies, module structure follow CLAUDE.md rules?
- Testing standards: test structure, naming, coverage requirements met?
- Mandatory guidelines: Flag violations of MUST/REQUIRED/SHALL directives.

### Structure & Organization
- Directory layout matches documented project structure?
- Configuration keys, environment variables follow naming conventions?
- Git workflows, branch naming, commit conventions followed?

## Verdict
- APPROVED: Code follows all documented conventions.
- NEEDS_ATTENTION: Minor convention deviations. Should be reviewed.
- VIOLATION: Clear violation of mandatory CLAUDE.md guidelines. Must be fixed.

## CRITICAL RULES
1. READ CLAUDE.md FILES FIRST before making any judgment.
2. Only flag violations of DOCUMENTED conventions — not personal preferences.
3. Cite the specific CLAUDE.md section/path AND the violating code location.
4. EVERY finding MUST include concrete evidence.

Return structured output with verdict and findings array.`;

const IMPACT_PROMPT = `You are a FEATURE IMPACT SPECIALIST. Explore and review the source code in the target path for cross-feature impact and interface consistency.

## Workflow
1. FIRST: Map the target code. Identify public interfaces, exports, APIs.
2. Use Grep to find ALL consumers/importers of exported symbols.
3. Trace shared code paths. Identify potential blast radius of changes.
4. Every finding MUST cite both: the interface definition AND its consumers.

## What to Evaluate

### Interface Design
- Are public interfaces well-defined, minimal, and stable?
- Is there clear separation between public API and internal implementation?
- Are interface contracts consistently honored across implementations?
- Are there unused or overly broad exports that could be simplified?

### Cross-Module Impact
- Which modules/features consume the target code? Map all consumers.
- Would changes to these interfaces break consumers?
- Are there shared utilities/helpers/base classes with wide impact?
- Database schemas: what other code reads the same data?

### Breaking Change Risk
- Are there deprecated paths that consumers still use?
- Is backward compatibility maintained?
- Are there versioning or migration strategies in place?

## Verdict
- APPROVED: Well-designed interfaces, manageable impact scope.
- NEEDS_ATTENTION: Interface concerns or wide impact noted.
- BLOCKER: Breaking interface changes, high coupling, no migration path.

## CRITICAL RULES
1. Use Grep to find ALL consumers before concluding on impact.
2. EVERY finding MUST list both the interface AND its consumers.
3. Remove findings without concrete evidence.

Return structured output with verdict and findings array.`;

const OPS_PROMPT = `You are an OPERATIONAL IMPACT SPECIALIST. Explore and review the source code in the target path for operational safety and performance.

## Workflow
1. FIRST: Identify database schemas, external API calls, configuration, deployment configs.
2. Search for performance-sensitive patterns: queries, loops, caching, async operations.
3. Read key files deeply. Every finding MUST cite specific file paths and line numbers.

## What to Evaluate

### Database & Data Access
- N+1 query patterns? Missing indexes on queried columns? Full table scans?
- Transaction boundaries: appropriate scope? Rollback on error?
- Connection pooling: properly configured? Connection leaks?
- Migration safety: backward-compatible schema changes?

### Performance
- Memory: large object allocations? Memory leaks (unbounded caches, unremoved listeners)?
- CPU: tight loops on hot paths? Expensive computations without caching?
- Network: external API calls with timeout? Circuit breaker? Retry with backoff?
- Async: proper promise/goroutine lifecycle? Cancellation support?

### Deployment & Configuration
- Environment-specific configuration properly separated?
- Feature flags for gradual rollout?
- Health checks and graceful shutdown implemented?
- Backward-compatible changes? (Can old and new versions run concurrently?)

## Verdict
- APPROVED: Operationally sound. Safe to deploy.
- NEEDS_ATTENTION: Operational concerns — should be reviewed by DevOps/SRE.
- BLOCKER: Performance regression, unsafe data access, deployment risk, missing resilience patterns.

## CRITICAL RULES
1. EXPLORE FIRST before judging performance.
2. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
3. Flag missing resilience patterns (timeout, retry, circuit breaker) on external calls.

Return structured output with verdict and findings array.`;

const TESTS_PROMPT = `You are a TEST QUALITY & INTEGRITY SPECIALIST. Explore and review the test code in the target path. Scrutinize tests MORE carefully than production code.

## Workflow
1. FIRST: Find all test files in the target path (*.test.*, *.spec.*, test_*, *Test*, tests/, __tests__/).
2. Classify: test files (MAXIMUM scrutiny), test fixtures (HIGH scrutiny), test config (MEDIUM), production code (SECONDARY).
3. For each test file: check for cheating patterns. Every finding MUST cite specific file paths and line numbers.

## Test Cheating Patterns (10 patterns)

**CHEAT-1: Mocking Away Real Logic** — Core function being tested is mocked. Nothing actually tested.
**CHEAT-2: Testing Implementation Details** — Asserting internal state instead of observable behavior.
**CHEAT-3: Weak/No Assertions** — No expect/assert, or only toBeTruthy()/toBeDefined().
**CHEAT-4: Tautological Assertions** — Comparing value to itself. Invariant always true by construction.
**CHEAT-5: Sleep-Based Waiting** — setTimeout/sleep instead of waitFor()/findByText().
**CHEAT-6: Copy-Paste Tests** — Identical test bodies, different names.
**CHEAT-7: Relaxed Assertions** — Strict equality weakened to loose/partial match.
**CHEAT-8: Deleted/Skipped Tests** — .skip(), xdescribe(), @pytest.mark.skip without explanation.
**CHEAT-9: Test-Only Without Production Changes** — Tests added but production code unchanged.
**CHEAT-10: Coverage Padding** — Exercising code without asserting on output.

### Test-to-Implementation Mapping
- For each production code function/class, find corresponding test. Map coverage gaps.
- Are error paths tested? Edge cases covered? Happy path only?

### Test Quality
- Test names describe WHAT is tested and expected outcome?
- Tests independent (no shared mutable state)?
- Deterministic (no Math.random()/Date.now() without mocking)?
- Test infrastructure: lowered coverage thresholds? Disabled rules?

## Verdict
- APPROVED: Tests are honest, adequate, follow standards.
- NEEDS_ATTENTION: Test quality concerns. Non-blocking.
- CHEATING_FOUND: Deceptive tests. Pass without validating real behavior. SERIOUS — must be fixed.

## CRITICAL RULES
1. Test files get MORE scrutiny than production files — spend 70% of time on tests.
2. Every CHEATING finding must clearly explain WHY the test is deceptive.
3. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
4. Passing tests != correct tests. Your job is to find the difference.

Return structured output with verdict and findings array.`;

// ── Dimension Config ──
const ALL_DIMENSIONS = {
  arch: { prompt: ARCH_PROMPT, label: "Architecture", verdictSeverity: "URGENT" },
  security: { prompt: SECURITY_PROMPT, label: "Security", verdictSeverity: "CRITICAL" },
  bugs: { prompt: BUGS_PROMPT, label: "Bug Detection", verdictSeverity: "BUG_FOUND" },
  conventions: { prompt: CONVENTIONS_PROMPT, label: "CLAUDE.md Compliance", verdictSeverity: "VIOLATION" },
  impact: { prompt: IMPACT_PROMPT, label: "Feature Impact", verdictSeverity: "BLOCKER" },
  ops: { prompt: OPS_PROMPT, label: "Operational Impact", verdictSeverity: "BLOCKER" },
  tests: { prompt: TESTS_PROMPT, label: "Test Quality", verdictSeverity: "URGENT" },
}

// ── Helpers ──

function codeContext(scoutSummary) {
  const scoutSection = scoutSummary
    ? `## Scout Reports (from sdlc-scout)

${scoutSummary}

**Usage**: Read the scout report(s) above for codebase structure and module map before exploring. Focus your exploration on files relevant to your review dimension. The scout has already categorized files by relevance — prioritize High-relevance files.`
    : `## Scout Reports

No scout reports available. EXPLORE the codebase yourself using Bash(find, ls), Glob, Grep, and Read tools to discover the module structure before reviewing.`

  return `## Code Review Context
- Repo path: ${repoPath}
- Target path: ${normalizedPath}
- Review date: ${runDate}

${scoutSection}

## Instructions
You are reviewing the source code at ${normalizedPath} within ${repoPath}.
Every finding MUST include concrete evidence: file path, line numbers, and code snippet.
Apply your review criteria thoroughly — do not skip files or assume others will cover them.`
}

function synthesisContext(findingsByDim) {
  return `## Code Review Context
- Repo path: ${repoPath}
- Target path: ${normalizedPath}
- Review date: ${runDate}

## Review Findings by Dimension

${JSON.stringify(findingsByDim, null, 2)}`
}

// ═══════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════

// ── Scout context (provided by sdlc-scout skill) ──
// No Phase 0 scout here — sdlc-review SKILL.md calls sdlc-scout before dispatching this workflow.
// scoutReports[] arrives via args with structured data: name, outputPath, filesFound, modulesFound, entryPointsFound, etc.
const scoutSummary = scoutReports && scoutReports.length > 0
  ? scoutReports.map(r => {
      const reportLink = `[${r.name}](${r.outputPath})`
      return `- ${reportLink}: ${r.filesFound} files (${r.highRelevance || 0} high relevance), ${r.modulesFound || 0} modules, ${r.entryPointsFound || 0} entry points`
    }).join('\n')
  : null

if (scoutReports && scoutReports.length > 0) {
  log(`Using scout reports from sdlc-scout: ${scoutReports.length} report(s) covering ${scoutReports.reduce((s, r) => s + (r.filesFound || 0), 0)} files`)
} else {
  log("No scout reports provided — review agents will explore the codebase directly")
}

// ── Phase 1: Review — all dimensions in parallel ──
phase("Review")
log(`Dispatching ${dimensions.length} review subagent(s) in parallel: ${dimNames}`)

const context = codeContext(scoutSummary)
const failedDimensions = []
let reviewResults = []

const rawResults = await parallel(
  dimensions.map(dim => () => {
    const cfg = ALL_DIMENSIONS[dim]
    return agent(
      `${cfg.prompt}

${context}

Return your findings in structured output format with verdict and findings array. Focus ONLY on ${cfg.label.toLowerCase()} issues. EXPLORE the codebase first — be specific with file paths and line numbers. Every finding MUST include concrete evidence.`,
      {
        label: `review:${dim}`,
        phase: "Review",
        agentType: "general-purpose",
        schema: SUBAGENT_OUTPUT,
      }
    )
  })
)

for (let i = 0; i < dimensions.length; i++) {
  const dim = dimensions[i]
  const result = rawResults[i]
  if (!result) {
    log(`WARNING: ${ALL_DIMENSIONS[dim].label} subagent failed or returned no output`)
    failedDimensions.push(dim)
  } else {
    const findingCount = result.findings ? result.findings.length : 0
    log("OK: " + ALL_DIMENSIONS[dim].label + ": " + result.verdict + " (" + findingCount + " finding(s))")
    reviewResults.push({ dimension: dim, label: ALL_DIMENSIONS[dim].label, ...result })
  }
}

if (reviewResults.length === 0) {
  log("ERROR: All subagents failed - no review results to process")
  return {
    reportPath: null,
    verdict: "ERROR",
    findings: [],
    dimensions: {},
    stats: { totalFindings: 0, duration: "N/A" },
    failedDimensions,
  }
}

// ── Phase 2: Verify (adversarial mode only) ──
let verifiedFindings = []

if (adversarial) {
  phase("Verify")

  const allFindings = []
  for (const r of reviewResults) {
    for (const f of r.findings || []) {
      allFindings.push({ ...f, dimension: r.dimension, dimensionLabel: r.label })
    }
  }

  log(`Adversarial verification: ${allFindings.length} finding(s) to verify`)

  if (allFindings.length === 0) {
    log("No findings to verify - skipping Verify phase")
    verifiedFindings = []
  } else {
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
**Affected files**: ${(finding.affected_files || []).join(", ")}

**Context**: Reviewing source code at ${normalizedPath} in ${repoPath}

**Instructions**: Look at actual code behavior. Could this be already handled elsewhere (middleware, framework, upstream)? A deliberate design choice? Based on incorrect assumptions about code path?

Default to confirmed=false (refute) if uncertain. Return confirmed=true ONLY if confident this is a real issue.`,
            {
              label: `verify:correctness:${finding.description.slice(0, 40)}`,
              phase: "Verify",
              schema: VERDICT,
            }
          ),
          () => agent(
            `You are a SECURITY skeptic. Your job is to REFUTE this finding if it is a false positive.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(", ")}

**Context**: Reviewing source code at ${normalizedPath} in ${repoPath}

**Instructions**: Is this genuinely exploitable or does it have mitigating controls? Check: input validation upstream? Code reachable from user input? Compensating controls (WAF, rate limiting, auth layer)?

Default to confirmed=false (refute) if uncertain. Return confirmed=true ONLY if confident this is a real security concern.`,
            {
              label: `verify:security:${finding.description.slice(0, 40)}`,
              phase: "Verify",
              schema: VERDICT,
            }
          ),
          () => agent(
            `You are a REPRODUCIBILITY skeptic. Your job is to REFUTE this finding if it cannot be reproduced.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(", ")}

**Context**: Reviewing source code at ${normalizedPath} in ${repoPath}

**Instructions**: Can you actually trigger this issue from the code? Is the affected code path reachable? Would existing tests catch this? Is the finding speculation vs. concrete?

Default to confirmed=false (refute) if uncertain. Return confirmed=true ONLY if confident the issue is reproducible.`,
            {
              label: `verify:repro:${finding.description.slice(0, 40)}`,
              phase: "Verify",
              schema: VERDICT,
            }
          ),
        ])

        const validVotes = votes.filter(Boolean)
        const confirmedCount = validVotes.filter(v => v.confirmed).length
        const survived = confirmedCount >= 2

        if (!survived) {
          log(`  REJECTED: ${confirmedCount}/3 confirmed - ${desc}`)
        } else {
          log(`  SURVIVED: ${confirmedCount}/3 confirmed - ${desc}`)
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
  for (const r of reviewResults) {
    for (const f of r.findings || []) {
      verifiedFindings.push({ ...f, dimension: r.dimension, dimensionLabel: r.label, verified: true })
    }
  }
}

// ── Phase 3: Synthesize ──
phase("Synthesize")

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
  ? `

## Adversarial Verification Results
${verifiedFindings.length} findings survived adversarial verification. These are the ONLY findings to include in the final report - rejected findings have been filtered out.
${JSON.stringify(verifiedFindings, null, 2)}`
  : `

## Findings to Include
${JSON.stringify(verifiedFindings, null, 2)}`

const synthesis = await agent(
  `You are a review synthesizer. Merge, deduplicate, and compute the overall verdict.

${synthesisInput}${verifiedContext}

**Instructions**:
1. **Deduplicate**: If multiple dimensions flagged the same underlying issue (same file + same line range), merge into ONE finding with multiple category tags.
2. **Compute overall verdict** (based on highest severity):
   - Any CRITICAL, URGENT, CHEATING_FOUND, or BLOCKER -> **URGENT**
   - Any BUG_FOUND, VIOLATION, or HIGH_RISK -> **NEEDS_ATTENTION**
   - Otherwise -> **APPROVED**
3. **Write a summary**: 2-3 sentences capturing the key findings about this code.
4. **Synthesize decision rationale**: Review all agents decision_rationale fields. Write a 2-4 sentence decision_summary answering: What is the overall quality of this code? What are the main risks? Is the code production-ready?

Return the merged findings and overall verdict.`,
  {
    label: "synthesize",
    phase: "Synthesize",
    agentType: "general-purpose",
    schema: SYNTHESIS,
  }
)

if (!synthesis) {
  log("ERROR: Synthesis failed")
  return {
    reportPath: null,
    verdict: "ERROR",
    findings: verifiedFindings,
    dimensions: findingsByDim,
    stats: {
      totalFindings: verifiedFindings.length,
      verifiedFindings: adversarial ? verifiedFindings.length : undefined,
      rejectedFindings: adversarial
        ? (reviewResults.flatMap(r => r.findings || []).length - verifiedFindings.length)
        : undefined,
      duration: "N/A",
    },
    failedDimensions,
  }
}

// ── Phase 4: Report ──
phase("Report")

const pathSlug = normalizedPath
  .replace(/^\/+|\/+$/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 50) || "root"
const reportDir = `${repoPath}/.work/review`

const report = await agent(
  `You are a report generator. Create a comprehensive markdown code review report.

## Review Context
- Repo path: ${repoPath}
- Target path: ${normalizedPath}
- Review date: ${runDate}

## Overall Verdict: ${synthesis.overallVerdict}

## Scout Summary
${scoutSummary}

## Merged Findings
${JSON.stringify(synthesis.mergedFindings, null, 2)}

## Summary
${synthesis.summary}

## Per-Dimension Results
${JSON.stringify(findingsByDim, null, 2)}

## Mode
${adversarial ? "Adversarial verification enabled" : "Standard"}

${failedDimensions.length > 0 ? `## WARNING: Failed Dimensions\n${failedDimensions.map(d => `- ${ALL_DIMENSIONS[d].label}`).join("\n")}` : ""}

**Instructions**:
1. Generate a complete markdown report with:
   - Title: "Code Review: {target path}"
   - Meta line: Repo, Target path, Review date
   - Overall Verdict with emoji
   - Scout summary (what was reviewed)
   - Per-dimension sections (only for dimensions with findings)
   - Summary table with all findings (severity-colored badges)
   - Mode indicator (Standard vs Adversarial)
2. Use Bash: mkdir -p ${reportDir}
3. Write report to: ${reportDir}/REVIEW-CODE-${runDate}--${pathSlug}.md
4. Report MUST be written to disk.

Return the saved report path, verdict, and total finding count.`,
  {
    label: "report",
    phase: "Report",
    agentType: "general-purpose",
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
  scoutSummary: scoutSummary,
  stats: {
    totalFindings: synthesis.mergedFindings ? synthesis.mergedFindings.length : 0,
    rawFindings: totalRawFindings,
    verifiedFindings: adversarial ? verifiedFindings.length : undefined,
    rejectedFindings: adversarial ? (totalRawFindings - verifiedFindings.length) : undefined,
    dimensionsRun: dimensions.length,
    dimensionsFailed: failedDimensions.length,
    duration: "completed",
  },
  failedDimensions: failedDimensions.length > 0 ? failedDimensions : undefined,
}

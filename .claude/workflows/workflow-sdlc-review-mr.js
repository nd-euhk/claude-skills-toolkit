export const meta = {
  name: 'workflow-sdlc-review-mr',
  description: 'Review MR/PR across 7 dimensions in parallel with inline subagent prompts',
  phases: [
    { title: 'Review', detail: '7 specialized subagents in parallel (inline prompts)' },
    { title: 'Verify', detail: 'Adversarial verification (adversarial mode only)' },
    { title: 'Synthesize', detail: 'Merge, deduplicate, compute overall verdict' },
    { title: 'Report', detail: 'Generate markdown review report' },
  ],
}

const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { diff, metadata, repoPath, platform, dimensions, adversarial, runDate } = _args
const dimNames = dimensions.join(', ')

const SUBAGENT_OUTPUT = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    decision_rationale: {
      type: "object",
      properties: {
        pr_alignment: { type: "string" },
        pr_alignment_detail: { type: "string" },
        project_alignment: { type: "string" },
        project_alignment_detail: { type: "string" },
        risk_value: { type: "string" },
        risk_value_detail: { type: "string" },
        confidence: { type: "string" },
      },
      required: ["pr_alignment", "project_alignment", "risk_value", "confidence"],
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
// DIMENSION CONFIG + INLINE PROMPTS
// ═══════════════════════════════════════════

const ARCH_PROMPT = `You are an ARCHITECTURE REVIEW SPECIALIST. Review this MR/PR diff for architectural impact ONLY — not code quality, security, or bugs.

## What to Evaluate

### C4 Model Impact
- System Context: New/changed external system dependencies? Proper abstraction behind interfaces? Cascading failure risk?
- Container: Changed service/deployment boundaries? New services properly scoped? Inter-service communication follows standards?
- Component: Violated component dependency rules? Components in correct layer (domain/application/infrastructure/presentation)? Circular dependencies?

### ADR Compliance
- Search repo for ADR files. Read relevant ones. Flag violations of recorded architectural decisions — cite the specific ADR.
- Flag significant architectural decisions made WITHOUT a corresponding ADR.

### Design Quality
- Coupling: Increased coupling between modules? New dependencies justified?
- SOLID: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.
- Bounded Context: Domain logic leak across bounded contexts?
- Layering: Layer boundaries respected (no infrastructure code in domain layer)?

### Impact Analysis
- Map affected services/modules/packages. Identify downstream consumers that may break.
- Assess if this is a breaking change. Evaluate migration path.

## Decision Rationale
1. PR Description Accuracy: Does the MR description match what the code actually does?
2. Project Alignment: Does this align with project architectural direction and ADRs?
3. Risk/Value: Is architectural risk justified by the value?
4. Confidence: HIGH (clear evidence) / MEDIUM (some assumptions) / LOW (needs human review)

## Verdict
- APPROVED: No architectural concerns. Safe to merge.
- NEEDS_ATTENTION: Architectural concerns found. Should be reviewed by human architect.
- URGENT: Critical architectural risk — breaking change without migration path, ADR violation, boundary violation, circular dependency, fundamental SOLID violation. Must be addressed before merge.

## CRITICAL RULES
1. EVERY finding MUST include concrete evidence: file path, line numbers, and exact code snippet from the diff.
2. Remove any finding that lacks concrete evidence — speculation is not actionable.
3. Only evaluate architecture — do not comment on code style, variable names, formatting, or non-architectural bugs.
4. Reference ADRs by name and path when citing violations.
5. Empty findings table = APPROVED. That is a valid and valuable result.

Return structured output with verdict and findings array. For each finding provide: severity (URGENT/NEEDS_ATTENTION), category, description, evidence (file, line, snippet), recommendation, affected_files.`;

const SECURITY_PROMPT = `You are a SECURITY REVIEW SPECIALIST. Review this MR/PR diff for security vulnerabilities.

## What to Evaluate

### OWASP Top 10
- Injection: SQL, NoSQL, OS command, LDAP injection via unsanitized user input
- Broken Authentication: Weak password policies, missing MFA, session fixation
- Sensitive Data Exposure: PII, credentials, tokens in logs/error messages/client-side code
- XML External Entities (XXE): XML parsers processing untrusted input
- Broken Access Control: Missing auth checks, IDOR (insecure direct object references), privilege escalation paths
- Security Misconfiguration: Default credentials, verbose error messages, unnecessary HTTP methods
- Cross-Site Scripting (XSS): Unescaped user input in HTML/JS output
- Insecure Deserialization: Deserializing untrusted data
- Using Components with Known Vulnerabilities: Outdated dependencies with CVEs
- Insufficient Logging & Monitoring: Missing audit logs for auth events, data changes

### Secrets & Credentials
- Hardcoded API keys, passwords, tokens, private keys in source code
- Secrets in configuration files, environment variable defaults, comments
- Connection strings with embedded credentials

### Auth/Authz
- Missing authentication checks on new endpoints
- Authorization bypass via parameter manipulation
- Token handling: hardcoded JWT secrets, tokens in URLs, missing token validation

### Data Exposure
- PII/credentials logged in error messages or debug output
- Sensitive data returned in API responses (over-fetching)
- Missing data encryption at rest or in transit

### Dependencies
- New dependencies with known vulnerabilities? Check package files for version changes.
- Dependency confusion risk (internal package names exposed)

## Decision Rationale
1. PR Description Accuracy: Does description mention security-relevant changes?
2. Project Alignment: Does this follow project security standards?
3. Risk/Value: Is security risk justified?
4. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: No security concerns.
- NEEDS_ATTENTION: Security concerns found. Should be reviewed by security engineer.
- CRITICAL: Exploitable vulnerability, hardcoded secret, authentication bypass, data exposure. Must be fixed before merge.

## CRITICAL RULES
1. EVERY finding MUST include concrete evidence: file path, line numbers, and exact code snippet.
2. CRITICAL requires specificity — describe exact exploitation path.
3. Remove any finding lacking concrete evidence.
4. Check if input validation exists upstream before flagging injection.
5. Check if auth middleware covers the new endpoint before flagging missing auth.

Return structured output with verdict and findings array. For each finding: severity (CRITICAL/NEEDS_ATTENTION), category, description, evidence, recommendation, affected_files.`;


const BUGS_PROMPT = `You are a BUG DETECTION SPECIALIST. Review this MR/PR diff for potential bugs.

## What to Evaluate (5 categories)

### 1. Logic Bugs
- Inverted conditions (if (x) instead of if (!x))
- Off-by-one errors (<= vs <, loop boundaries)
- Wrong variable reference (copy-paste errors)
- Boolean logic errors (&& vs ||, missing parentheses)
- Assignment vs comparison (= used where == or === intended)
- Operator precedence causing unexpected evaluation order

### 2. Race Conditions
- Shared mutable state without synchronization
- Async operations without proper error handling or cancellation
- Promise/goroutine/thread leaks
- Deadlock potential (nested locks in inconsistent order)
- TOCTOU (Time-of-check to time-of-use)
- Concurrent map/slice writes without synchronization

### 3. Edge Cases
- null/undefined/nil/None: checked before use?
- Empty states: empty string, empty array, empty object, empty response
- Boundary values: 0, -1, MAX_INT, MIN_INT, NaN, Infinity
- Type coercion traps: == vs ===, falsy values (0, empty string, false, null, undefined)
- Large values: very long strings, deeply nested objects
- Negative values when only positive expected
- Concurrent modification while iterating

### 4. Error Handling
- Empty catch blocks that silently swallow errors
- Overly broad catch without re-throwing
- Missing error propagation (caught but not returned/thrown to caller)
- Retry without backoff (thundering herd)
- Retry without limit (infinite loop)
- Missing timeout on network/IO operations
- Resource cleanup: files, connections, locks not freed in error paths
- Transaction rollback: missing on error in multi-step operations

### 5. Type Safety
- Type assertion without guard (as Type without instanceof/typeof check)
- Implicit any types that bypass type checking
- Union type not exhausted in switch/if-else
- Optional chaining result not null-checked before further access
- Enum mismatch: comparing enums of different types

### Cross-File Analysis
- Do changed function signatures match all call sites?
- Are new/changed exported functions used correctly by consumers?
- Does order of operations make sense across files?

## Decision Rationale
1. PR Description Accuracy: Hidden behavior changes?
2. Project Alignment: Follows documented patterns and conventions?
3. Risk/Value: Is bug risk justified by the value?
4. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: No bugs found. Code appears correct.
- NEEDS_ATTENTION: Potential issues. Should be reviewed by human.
- BUG_FOUND: Definite bug — logic error, race condition, null crash, memory leak. Must be fixed before merge.

## CRITICAL RULES
1. Bugs are defects in behavior, not style — do not flag naming, formatting, or preference issues.
2. BUG_FOUND requires specificity — describe exact conditions where the bug manifests.
3. Pre-existing bugs (not introduced by this MR) are out of scope.
4. EVERY finding MUST include concrete evidence: file path, line numbers, and exact code snippet.
5. Remove any finding that lacks concrete evidence.
6. Use POTENTIAL severity if unsure whether condition can occur; use BUG if it definitely can.

Return structured output with verdict and findings array.`;

const CONVENTIONS_PROMPT = `You are a CLAUDE.md CONVENTIONS SPECIALIST. Review this MR/PR diff for compliance with project conventions.

## What to Evaluate

### CLAUDE.md Compliance
- Read all CLAUDE.md files in the repo (root, per-module, per-service)
- Check changed code against naming conventions, code patterns, architectural rules
- Flag violations of mandatory guidelines (MUST, REQUIRED, SHALL)
- Flag missing required patterns (e.g., error wrapping, logging format, test structure)

### Naming Standards
- Files, directories, classes, functions, variables follow project naming conventions?
- Test files follow naming pattern (*.test.*, *.spec.*)?
- Configuration keys, environment variables follow conventions?

### Code Patterns
- Error handling follows project pattern (custom errors, error codes, error chains)?
- Logging follows project format and level conventions?
- Dependency injection follows project pattern?
- Module/service structure follows project layout?

### Testing Standards
- Test structure follows project conventions (AAA, Given-When-Then)?
- Test naming follows project standard?
- Required test types present (unit, integration)?

## Decision Rationale
1. PR Description Accuracy: Does description mention convention-related changes?
2. Project Alignment: Does this follow documented conventions?
3. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: All changes follow project conventions.
- NEEDS_ATTENTION: Minor convention deviations. Should be reviewed.
- VIOLATION: Clear violation of mandatory CLAUDE.md guidelines. Must be fixed.

## CRITICAL RULES
1. Read CLAUDE.md files FIRST before making any judgment.
2. Only flag violations of documented conventions — not personal preferences.
3. Cite the specific CLAUDE.md section and line for each violation.
4. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
5. Remove any finding that lacks concrete evidence.

Return structured output with verdict and findings array.`;


const IMPACT_PROMPT = `You are a FEATURE IMPACT SPECIALIST. Review this MR/PR diff for cross-feature impact and regression risk.

## What to Evaluate

### Cross-Feature Impact
- Which features/modules are affected by this change? Map the blast radius.
- Are there shared code consumers that may break? (Use grep to find imports/usages)
- Could this change cause unexpected behavior in seemingly unrelated features?

### Interface/Implementation Consistency
- Do new/changed interfaces match their implementations?
- Are interface contracts honored? (Check all implementors)
- Are API responses consistent with existing patterns?

### Shared Code Impact
- Utilities, helpers, base classes: who else depends on them?
- Database schema changes: impact on other services reading the same data?
- Configuration changes: impact on other modules reading the same config?

### Regression Risk
- Could this change break existing functionality?
- Are there deprecated paths that existing consumers still use?
- Is there a feature flag or gradual rollout plan?

## Decision Rationale
1. PR Description Accuracy: Are all impacted areas mentioned?
2. Project Alignment: Does this change align with feature roadmap?
3. Risk/Value: Is the cross-feature risk justified?
4. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: No cross-feature concerns. Safe scope.
- NEEDS_ATTENTION: Cross-feature impact noted. Should be reviewed.
- BLOCKER: Breaking change for shared consumers, missing migration path, high regression risk. Must be addressed.

## CRITICAL RULES
1. Use grep/Glob to find ALL consumers of changed interfaces before concluding.
2. EVERY finding MUST include concrete evidence: file path, line numbers, and impacted consumer list.
3. Remove any finding that lacks concrete evidence.

Return structured output with verdict and findings array.`;

const OPS_PROMPT = `You are an OPERATIONAL IMPACT SPECIALIST. Review this MR/PR diff for deployment safety and operational risk.

## What to Evaluate

### Database Migrations
- New migration files: are they backward-compatible? (No destructive changes without multi-step migration)
- Schema changes: adding columns with defaults? Adding NOT NULL without default?
- Index changes: new indexes on large tables (could lock)? Dropped indexes still in use?
- Data migrations: safe for production data volume? Idempotent? Rollback plan?

### Performance Impact
- New queries: N+1 risk? Missing indexes? Full table scans?
- Memory: large object allocations? Memory leaks (event listeners, caches without bounds)?
- CPU: tight loops, expensive computations on hot paths?
- Network: new external API calls? Timeout configured? Circuit breaker in place?

### Deployment Risk
- Can this be deployed independently or does it require coordination?
- Is the change backward-compatible? (Can old and new versions run concurrently?)
- Configuration changes: new env vars with defaults? Feature flags for gradual rollout?

### Rollback Complexity
- Database migration rollback: reversible? Data loss on rollback?
- API contract: breaking changes that prevent rollback?
- State: any new state stores that complicate rollback?

## Decision Rationale
1. PR Description Accuracy: Are operational changes documented?
2. Project Alignment: Does deployment strategy follow project standards?
3. Risk/Value: Is operational risk justified?
4. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: Safe to deploy. No operational concerns.
- NEEDS_ATTENTION: Operational concerns. Should be reviewed by DevOps/SRE.
- BLOCKER: Unsafe migration, performance regression, deployment coordination required, irreversible change.

## CRITICAL RULES
1. Flag missing migration rollback plans for destructive DB changes.
2. EVERY finding MUST include concrete evidence: file path, line numbers, and code snippet.
3. Remove any finding that lacks concrete evidence.

Return structured output with verdict and findings array.`;


const TESTS_PROMPT = `You are a TEST QUALITY & INTEGRITY SPECIALIST. Scrutinize TEST changes MORE carefully than production code changes. Agents often write tests that pass without validating real behavior — your job is to catch this.

## Core Principle: Read Tests MORE Carefully Than Code
- Tests get your DEEPEST scrutiny — every assertion, every mock, every test case
- Production code gets SECONDARY review — only to understand what tests should validate
- Assume tests might be DECEPTIVE — passing tests != correct tests

## Test Cheating Patterns (10 patterns to detect)

**CHEAT-1: Mocking Away Real Logic** — Test mocks the core function being tested. Nothing is actually tested.
**CHEAT-2: Testing Implementation Details** — Asserting internal state/private fields instead of observable behavior.
**CHEAT-3: Assertion-Free / Weak Assertions** — No expect/assert, or only toBeTruthy()/toBeDefined(). Passes trivially.
**CHEAT-4: Tautological Assertions** — Comparing value to itself. Checking invariant always true by construction.
**CHEAT-5: Sleep-Based Waiting** — setTimeout(5000) instead of waitFor()/findByText(). Race condition.
**CHEAT-6: Copy-Paste Tests** — Multiple test cases with identical bodies, only test name differs.
**CHEAT-7: Relaxed Assertions** — toEqual(full) changed to toMatchObject(partial). toBe(true) changed to toBeTruthy().
**CHEAT-8: Deleted / Skipped Tests** — it.skip(), xdescribe(), @pytest.mark.skip added without explanation.
**CHEAT-9: Test-Only Changes Without Production Changes** — Tests added but no production code changed. Testing existing (potentially wrong) behavior?
**CHEAT-10: Coverage Padding** — Tests that exercise code paths but never assert on output. Calls function with each branch, asserts expect(true).toBe(true).

### Test-to-Implementation Mapping
- For each production code change, verify a corresponding test exists
- New if branch/function/case → is there a test for it?
- Modified behavior → would a test FAIL with the old behavior?
- New error handling → test that triggers the error path?

### Test Infrastructure
- Lowered coverage thresholds: branches 80 → 60?
- Disabled lint/test config rules?
- Increased timeouts hiding slow tests?

### Test Quality
- Test names describe WHAT is tested and expected outcome?
- Tests independent (no shared mutable state causing order-dependent failures)?
- Deterministic (no Math.random(), Date.now() without mocking)?

## Decision Rationale
1. PR Description Accuracy: Are test changes mentioned?
2. Project Alignment: Does this follow project testing standards?
3. Risk/Value: Are tests honest? Would they catch a regression?
4. Confidence: HIGH / MEDIUM / LOW

## Verdict
- APPROVED: Test changes are honest, adequate, and follow standards. Tests would catch regressions.
- NEEDS_ATTENTION: Test quality concerns. Non-blocking but worth improving.
- CHEATING_FOUND: Tests are deceptive. They pass without validating real behavior. This is a SERIOUS issue that should BLOCK merge.

## CRITICAL RULES
1. Test files get MORE scrutiny than production files — spend 70% of time on tests, 30% on production code.
2. Every CHEATING finding must clearly explain WHY the test is deceptive with specific evidence.
3. Deleted tests without explanation in MR description = red flag.
4. Production code changes without ANY corresponding test changes = gap or missing coverage.
5. EVERY finding MUST include concrete evidence: file path, line numbers, and exact code snippet from the diff.
6. Remove any finding that lacks concrete evidence.

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

function subagentContext() {
  return `## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- Files changed: ${metadata.files ? metadata.files.length : "unknown"}
- Lines changed: ${metadata.loc || "unknown"}
- URL: ${metadata.url || "unknown"}
- Platform: ${platform}
- Repo path: ${repoPath}

## Full Unified Diff

${diff}`
}

function synthesisContext(findingsByDim) {
  return `## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- Files changed: ${metadata.files ? metadata.files.length : "unknown"}
- Lines changed: ${metadata.loc || "unknown"}
- URL: ${metadata.url || "unknown"}

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
phase("Review")
log(`Dispatching ${dimensions.length} review subagent(s) in parallel: ${dimNames}`)

const rawResults = await parallel(
  dimensions.map(dim => () => {
    const cfg = ALL_DIMENSIONS[dim]
    return agent(
      `${cfg.prompt}

${context}

Return your findings in structured output format with verdict and findings array. Focus ONLY on ${cfg.label.toLowerCase()} issues. Be specific — cite exact file paths and line numbers. Every finding MUST include concrete evidence.`,
      {
        label: `review:${dim}`,
        phase: "Review",
        agentType: "general-purpose",
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
    log(`WARNING: ${ALL_DIMENSIONS[dim].label} subagent failed or returned no output`)
    failedDimensions.push(dim)
  } else {
    const findingCount = result.findings ? result.findings.length : 0
    log(`OK: ${ALL_DIMENSIONS[dim].label}: ${result.verdict} (${findingCount} finding(s))`)
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

**MR context**: ${metadata.title} - ${metadata.files ? metadata.files.length : "?"} files, ${metadata.loc || "?"} LOC

**Instructions**: Look at actual code behavior. Could this be already handled elsewhere (middleware, framework, upstream)? A deliberate design choice, not a bug? Based on incorrect assumptions about code path?

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

**MR context**: ${metadata.title} - ${metadata.files ? metadata.files.length : "?"} files, ${metadata.loc || "?"} LOC

**Instructions**: Is this genuinely exploitable or does it have mitigating controls? Check: input validation upstream? Code reachable from user input? Compensating controls (WAF, rate limiting, auth layer)?

Default to confirmed=false (refute) if uncertain. Return confirmed=true ONLY if confident this is a real security concern.`,
            {
              label: `verify:security:${finding.description.slice(0, 40)}`,
              phase: "Verify",
              schema: VERDICT,
            }
          ),
          () => agent(
            `You are a REPRODUCIBILITY skeptic. Your job is to REFUTE this finding if it cannot be reproduced from the diff alone.

**Finding**: ${finding.description}
**Category**: ${finding.category}
**Severity**: ${finding.severity}
**Affected files**: ${(finding.affected_files || []).join(", ")}

**MR context**: ${metadata.title} - ${metadata.files ? metadata.files.length : "?"} files, ${metadata.loc || "?"} LOC

**Instructions**: Can you actually trigger this issue given the code in the diff? Is the affected code path actually changed in this MR? Would existing tests catch this? Is the finding speculation vs. concrete?

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
  // Standard mode - all findings pass through without verification
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
1. **Deduplicate**: If multiple dimensions flagged the same underlying issue (same file + same line range, or same problem), merge them into ONE finding with multiple category tags. Example: missing input validation flagged by both security AND bugs -> one finding tagged [security, bugs].
2. **Compute overall verdict** (based on highest severity):
   - Any CRITICAL, URGENT, CHEATING_FOUND (or CHEATING), or BLOCKER -> **URGENT**
   - Any BUG_FOUND, VIOLATION, or HIGH_RISK -> **NEEDS_ATTENTION**
   - Otherwise -> **APPROVED**
3. **Write a summary**: 2-3 sentences capturing the key risk of this MR.
4. **Synthesize decision rationale**: Review all agents decision_rationale fields. Write a 2-4 sentence decision_summary answering: Is this PR worth merging? Why? Does the risk justify the value? If agents disagree on alignment, note the conflict.

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

const titleSlug = (metadata.title || "untitled")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 50)
const mrSlug = `${platform}-${metadata.id}-${titleSlug}`
const reportDir = `${repoPath}/.work/review`

const report = await agent(
  `You are a report generator. Create a comprehensive markdown review report.

## MR Metadata
- ID: ${metadata.id}
- Title: ${metadata.title}
- Author: ${metadata.author}
- Branch: ${metadata.branch}
- URL: ${metadata.url || "unknown"}
- Platform: ${platform}
- Files changed: ${metadata.files ? metadata.files.length : "unknown"}
- Lines changed: ${metadata.loc || "unknown"}
- Review date: ${runDate}

## Overall Verdict: ${synthesis.overallVerdict}

## Merged Findings
${JSON.stringify(synthesis.mergedFindings, null, 2)}

## Summary
${synthesis.summary}

## Per-Dimension Results
${JSON.stringify(findingsByDim, null, 2)}

## Mode
${adversarial ? "Adversarial verification enabled - findings verified by 3 independent skeptics" : "Standard - no adversarial verification"}

${failedDimensions.length > 0 ? `## WARNING: Failed Dimensions\n${failedDimensions.map(d => `- ${ALL_DIMENSIONS[d].label}`).join("\n")}` : ""}

**Instructions**:
1. Generate a complete markdown report following this structure:
   - Title: "MR Review: {title}"
   - Meta line: MR URL, Author, Branch, Files, +/- lines, Review date
   - Overall Verdict with emoji (APPROVED = checkmark, NEEDS_ATTENTION = warning, URGENT = siren)
   - Summary section (decision_summary)
   - Per-dimension sections (only for dimensions that had findings or were reviewed)
   - Summary table with all findings (severity-colored badges)
   - Mode indicator (Standard vs Adversarial)
   - Failed dimensions warning (if any)
2. Use the Bash tool to ensure directory ${reportDir} exists: mkdir -p ${reportDir}
3. Write the report using the Write tool to: ${reportDir}/REVIEW-MR-${runDate}--${mrSlug}.md
4. The report MUST be written to disk, not just generated in your response.

Return the path to the saved report file, the verdict, and total finding count.`,
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


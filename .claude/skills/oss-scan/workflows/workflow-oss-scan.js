export const meta = {
  name: 'workflow-oss-scan',
  description: 'Batch OSS compliance pipeline across multiple projects — per-project scan → selective risk-research → gate via executor subagents with step-selection auto-decided from scan results, then cross-project batch report',
  phases: [
    { title: 'Scan', detail: 'oss-scan-executor per project (batch mode, no prompting) + step-selection assessment' },
    { title: 'Research', detail: 'oss-risk-research-executor only for projects that need it (skipped for all-R1)' },
    { title: 'Gate', detail: 'oss-gate-executor per project — auto-pass R1, conditional R2, review/escalate R3/R4' },
    { title: 'Report', detail: 'Synthesize cross-project compliance summary' },
  ],
}

// ═════════════════════════════════════════════════════════
// MANDATORY safe-parse args — never destructure args directly
// ═════════════════════════════════════════════════════════
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const {
  projects = [],                // [{ name, path }]
  timestamp = '',               // 'YYYYMMDD-HHMMSS' — do skill sinh (workflow cấm Date.now)
  outputDir = '',               // thư mục batch report (mặc định .work/oss-compliance — cwd)
  stepSelect = 'auto',          // auto | full | skip-research | scan-only
  skillBaseDir = '',            // thư mục skill — cho report agent đọc template chính xác (references/reporting.md)
} = _args

if (projects.length === 0) {
  log('⚠️ Không có project nào được chọn — kết thúc workflow.')
}

// ═════════════════════════════════════════════════════════
// SCHEMAS — structured output từ mỗi stage agent
// ═════════════════════════════════════════════════════════

const SCAN_RESULT = {
  type: 'object',
  properties: {
    project: { type: 'string' },
    projectPath: { type: 'string' },
    scanReportPath: { type: 'string' },
    componentCount: { type: 'number' },
    riskSummary: {
      type: 'object',
      properties: {
        R1: { type: 'number' },
        R2: { type: 'number' },
        R3: { type: 'number' },
        R4: { type: 'number' },
        noLicense: { type: 'number' },
      },
      required: [],
    },
    needsResearch: { type: 'boolean' },
    gateMode: { type: 'string', enum: ['auto-pass', 'conditional', 'review', 'escalate'] },
    manualItems: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'FAILED'] },
  },
  required: ['project', 'projectPath', 'scanReportPath', 'componentCount', 'riskSummary', 'needsResearch', 'gateMode', 'status'],
}

const RESEARCH_RESULT = {
  type: 'object',
  properties: {
    project: { type: 'string' },
    researchReportPath: { type: 'string' },
    topRiskScore: { type: 'number' },
    topRisks: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED'] },
  },
  required: ['project', 'researchReportPath', 'status'],
}

const GATE_RESULT = {
  type: 'object',
  properties: {
    project: { type: 'string' },
    decision: { type: 'string', enum: ['PASS', 'PASS_WITH_CONDITIONS', 'NEEDS_REVIEW', 'FAIL', 'BLOCKED', 'PENDING'] },
    passCount: { type: 'number' },
    conditionCount: { type: 'number' },
    reviewCount: { type: 'number' },
    failCount: { type: 'number' },
    blockedCount: { type: 'number' },
    violations: { type: 'array', items: { type: 'string' } },
    decisionsNeeded: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'FAILED', 'skipped'] },
  },
  required: ['project', 'decision', 'status'],
}

const REPORT_RESULT = {
  type: 'object',
  properties: {
    reportPath: { type: 'string' },
    projectCount: { type: 'number' },
    passProjects: { type: 'number' },
    reviewProjects: { type: 'number' },
    failProjects: { type: 'number' },
    decisionsNeeded: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'failed'] },
  },
  required: ['reportPath', 'projectCount', 'status', 'summary'],
}

// ═════════════════════════════════════════════════════════
// PROMPTS
// ═════════════════════════════════════════════════════════

function scanPrompt(p) {
  return `You are the OSS SCAN executor for a batch compliance run.

Project: ${p.name}
Path: ${p.path}

Execute the OSS SCAN step per your system prompt (oss-scan-executor protocol):
1. Detect the project type and produce the SBOM (syft/trivy/build-tool parse).
2. Scan the filesystem for all 10 asset types.
3. Map every license to a risk group R1-R4; NOASSERTION/unlicensed → R4 + noLicense.
4. Write the scan report to ${p.path}/.work/oss-compliance/OSS-SCAN-<timestamp>--${p.name}.md (create .work/oss-compliance/ with mkdir -p if needed).
5. Compute needsResearch + gateMode (strictest group wins: escalate > review > conditional > auto-pass).
6. Return the SCAN_RESULT JSON object — match field names exactly.

## BATCH MODE — CRITICAL
- This runs inside a Workflow. Do NOT call AskUserQuestion or pause for user input.
- For [MANUAL] fields (commercial SDK, paid font, template, purpose of use), SKIP the question — flag each as [MANUAL] in the report and list it in manualItems.
- Never prompt, never pause. Record findings and move on.

If scan cannot run (no dependency manifests, or tool error), return status 'FAILED' with the reason in issues.`
}

function researchPrompt(scan, stepSelect) {
  const cap = scan.componentCount > 30
    ? ' Cap research to the 30 highest-risk components (--max-components 30).'
    : ''
  const focus = (stepSelect === 'full' && !scan.needsResearch)
    ? ' This project is all-R1 and was force-run — a CVE-only check is acceptable (--focus cve).'
    : ''
  return `You are the OSS RISK RESEARCH executor for a batch compliance run.

Project: ${scan.project}
Scan report: ${scan.scanReportPath}

Execute the OSS RISK RESEARCH step per your system prompt (oss-risk-research-executor protocol):
1. Read the scan report; scope research depth by risk group (R1 light CVE-only, R2 CVE+integration check, R3 deep CVE+legal+isolation, R4 full EULA+limits+data terms).${cap}${focus}
2. Research each component across the required axes with WebSearch/WebFetch — every score needs a source URL; no source = [ASSUMED].
3. Score each component 0-10 (CVSS×0.4 + License×0.3 + Maintenance×0.2 + Exploit×0.1) with confidence breakdown.
4. Write the research report to the same directory as the scan report: .work/oss-compliance/OSS-RESEARCH-<timestamp>--${scan.project}.md
5. Return the RESEARCH_RESULT JSON object — match field names exactly (researchReportPath, topRiskScore, topRisks, recommendation, status).

## BATCH MODE
- This runs inside a Workflow. Do NOT prompt the user. Record findings only.
- If web research cannot complete (network blocked), return status 'BLOCKED' and note it.`
}

function gatePrompt(ctx) {
  const researchFlag = ctx.research && ctx.research.researchReportPath
    ? ` Research report: ${ctx.research.researchReportPath}`
    : ''
  const autoPassFlag = ctx.gateMode === 'auto-pass'
    ? ' Auto-approve R1 components (--auto-pass-r1).'
    : ''
  return `You are the OSS GATE executor for a batch compliance run.

Project: ${ctx.project}
Scan report: ${ctx.scanReportPath}
${researchFlag}
Gate mode: ${ctx.gateMode}${autoPassFlag}

Execute the OSS GATE step per your system prompt (oss-gate-executor protocol):
1. Read the scan report (and research report if provided).
2. Apply the Allow/Restrict/Deny matrix per component: R1 PASS, R2 PASS_WITH_CONDITIONS, R4 NEEDS_REVIEW, R3 FAIL, no-license BLOCKED.
3. Respect research overrides: score ≥6 + R2 → NEEDS_REVIEW; score ≥8 → recommend replace/block; [ASSUMED] scores → warning only.
4. Write one violation report per FAIL/BLOCKED component to .work/oss-compliance/violations/ (verbatim policy citation, ≥2 remediation options, decision section left empty).
5. Collect decisionsNeeded: every R3/R4/no-license/FAIL/BLOCKED component, one entry each.
6. Return the GATE_RESULT JSON object — match field names exactly.

## BATCH MODE — CRITICAL
- This runs inside a Workflow. Do NOT prompt the user for decisions.
- Do NOT auto-approve R3/R4 or no-license components — record them as NEEDS_REVIEW / FAIL / BLOCKED.

Policy (quan-ly-rui-ro-opensource.md): R1 auto-approve; R2 conditional; R4 → NEEDS_REVIEW (LRB/Mua sắm); R3 and no-license → FAIL/BLOCKED (LRB). No license = no rights.`
}

function reportPrompt(results, ts, dir, skillBaseDir) {
  const compact = results.filter(Boolean).map(r => ({
    project: r.project,
    projectPath: r.projectPath,
    scanReportPath: r.scanReportPath,
    componentCount: r.componentCount,
    riskSummary: r.riskSummary,
    needsResearch: r.needsResearch,
    gateMode: r.gateMode,
    manualItems: r.manualItems || [],
    issues: r.issues || [],
    status: r.status,
    research: r.research ? {
      status: r.research.status,
      researchReportPath: r.research.researchReportPath || null,
      topRiskScore: r.research.topRiskScore || null,
      topRisks: r.research.topRisks || [],
      recommendation: r.research.recommendation || '',
      reason: r.research.reason || '',
    } : null,
    gate: r.gate ? {
      decision: r.gate.decision,
      passCount: r.gate.passCount || 0,
      conditionCount: r.gate.conditionCount || 0,
      reviewCount: r.gate.reviewCount || 0,
      failCount: r.gate.failCount || 0,
      blockedCount: r.gate.blockedCount || 0,
      violations: r.gate.violations || [],
      decisionsNeeded: r.gate.decisionsNeeded || [],
      status: r.gate.status,
      note: r.gate.note || '',
    } : null,
  }))
  const dataJson = JSON.stringify(compact, null, 2)

  return `You are synthesizing the final BATCH OSS COMPLIANCE REPORT.

Output directory: ${dir}
Timestamp: ${ts}
Report file: ${dir}/OSS-BATCH-${ts}.md

Ensure the directory exists (mkdir -p if needed), then write the report with the Write tool.

Per-project results (scan + research + gate) are provided as JSON below. Read individual scan/research/gate report files for detail where needed.

${dataJson}

## Report sections
${skillBaseDir ? `Exact template for these sections: ${skillBaseDir}/references/reporting.md — Read it first with the Read tool, then follow its structure verbatim.` : 'Section structure is fully specified below — no external template.'}
1. Executive summary — overall verdict, project counts by decision, top risks, components needing LRB
2. Per-project table — project, components, R1/R2/R3/R4/noLicense counts, research status + reason, gate decision, scan report path
3. Decisions needed — aggregated R3/R4/no-license + [MANUAL] items across all projects
4. Violations — FAIL/BLOCKED components with proposed remediation
5. Next steps

## Cross-skill suggestion (write into Next steps)
The aggregated \`decisionsNeeded\` (R3/R4/no-license + FAIL/BLOCKED items) tells you
whether any project carries a risky component — this is the ONLY signal the
suggestion is gated on.
- If \`decisionsNeeded\` is non-empty, add ONE line to the "Next steps" section
  per affected project:
  \`Gợi ý: /sdlc-review --code --security <project-path>\`
  plus one reason line: how the code links/uses the risky component (dynamic/
  static link, exploitable in code path) is extra input for LRB when
  deciding exception/replace.
- If \`decisionsNeeded\` is empty → do NOT add the suggestion. A clean run gets
  no cross-skill suggestion.

## Overall verdict rule
- BLOCKED if any project BLOCKED
- else FAIL if any project FAIL
- else NEEDS_REVIEW if any project NEEDS_REVIEW
- else PASS_WITH_EXCEPTIONS if any project PASS_WITH_CONDITIONS
- else PASS (or PENDING if scan-only mode)

## Return
Return the REPORT_RESULT JSON — reportPath, projectCount, passProjects (PASS + PASS_WITH_CONDITIONS), reviewProjects (NEEDS_REVIEW), failProjects (FAIL + BLOCKED), decisionsNeeded (aggregated), summary (2-3 sentences), status (completed if all projects processed, partial if any failed, failed if report could not be written).`
}

// ═════════════════════════════════════════════════════════
// STAGE HELPERS
// ═════════════════════════════════════════════════════════

// Stage 2: research — conditional per project (step-selection)
async function researchStage(scan) {
  if (scan.status === 'FAILED') {
    return { ...scan, research: { status: 'skipped', reason: 'scan failed' } }
  }
  if (stepSelect === 'scan-only' || stepSelect === 'skip-research') {
    return { ...scan, research: { status: 'skipped', reason: 'step-select=' + stepSelect } }
  }
  if (stepSelect === 'full') {
    // ép chạy research kể cả toàn R1
    const r = await agent(researchPrompt(scan, stepSelect), { label: 'research:' + scan.project, phase: 'Research', schema: RESEARCH_RESULT, agentType: 'oss-risk-research-executor' })
    return { ...scan, research: r }
  }
  if (!scan.needsResearch) {
    return { ...scan, research: { status: 'skipped', reason: 'all R1 — research not needed' } }
  }
  const r = await agent(researchPrompt(scan, stepSelect), { label: 'research:' + scan.project, phase: 'Research', schema: RESEARCH_RESULT, agentType: 'oss-risk-research-executor' })
  return { ...scan, research: r }
}

// Stage 3: gate — chạy cho mọi project còn xử lý được
async function gateStage(ctx) {
  if (ctx.status === 'FAILED') {
    return {
      ...ctx,
      gate: {
        project: ctx.project,
        decision: 'FAIL',
        status: 'FAILED',
        violations: ctx.issues || [],
        decisionsNeeded: (ctx.issues || []).map(i => `${ctx.project}: ${i}`),
      },
    }
  }
  if (stepSelect === 'scan-only') {
    return { ...ctx, gate: { project: ctx.project, decision: 'PENDING', status: 'skipped', note: 'scan-only mode' } }
  }
  const g = await agent(gatePrompt(ctx), { label: 'gate:' + ctx.project, phase: 'Gate', schema: GATE_RESULT, agentType: 'oss-gate-executor' })
  return { ...ctx, gate: g }
}

// ═════════════════════════════════════════════════════════
// EXECUTION
// ═════════════════════════════════════════════════════════

log(`OSS Batch Scan — ${projects.length} project(s), step-select=${stepSelect}`)

if (projects.length === 0) {
  // Không có project — trả về sớm, không spawn report agent vô ích
  return { reportPath: '', projectCount: 0, status: 'completed', summary: 'No projects selected' }
}

// Per-project pipeline: scan → (selective) research → gate.
// Pipeline (không barrier) — project A có thể ở Research trong khi project B còn Scan.
const results = await pipeline(
  projects,
  p => agent(scanPrompt(p), { label: 'scan:' + p.name, phase: 'Scan', schema: SCAN_RESULT, agentType: 'oss-scan-executor' }),
  scan => researchStage(scan),
  ctx => gateStage(ctx),
)

// Tóm tắt tiến độ
const done = results.filter(Boolean)
log(`${done.length}/${projects.length} project(s) processed`)

// Phase Report — barrier cuối: cần MỌI kết quả để tổng hợp
phase('Report')
const report = await agent(reportPrompt(results, timestamp, outputDir, skillBaseDir), {
  phase: 'Report',
  schema: REPORT_RESULT,
  agentType: 'general-purpose',
})

return report

export const meta = {
  name: 'workflow-sdlc-scout-pipeline',
  description: 'Multi-subproject scout pipeline for sdlc-explore: Preflight (skip existing) → Scout (discover per sub-project) → Report (write scout reports) → Audit (cross-project completeness check). Pipeline streams results independently.',
  phases: [
    { title: 'Preflight', detail: 'Check existing scout reports, skip already-completed sub-projects' },
    { title: 'Scout', detail: 'One Explore agent per sub-project, mapping files + patterns + technologies' },
    { title: 'Report', detail: 'Write per-subproject structured scout reports to .work/scouts/' },
    { title: 'Audit', detail: 'Cross-project completeness check — identify gaps, missed directories, uncovered topics' },
  ],
}

// ── Args (safe parse) ──
// { subProjects: [{name, paths, projectType, outputPath, repomixSnapshot?, patterns?, focus?}], language?: 'vi'|'en' }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { subProjects = [] } = _args

const langInstr = 'Viết tất cả output bằng tiếng Việt. Phải viết có dấu đầy đủ. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'
const L = { none: 'không có', noModules: 'không có module nào được xác định', noPatterns: 'không có pattern nào được xác định', noQuestions: 'không có câu hỏi nào chưa giải quyết', high: 'Mức Độ Cao', medium: 'Mức Độ Trung Bình', low: 'Mức Độ Thấp', writeReport: 'Viết scout report' }

// ── Schemas ──

const SCOUT_FINDING = {
  type: 'object',
  properties: {
    projectName: { type: 'string', description: 'Name of the sub-project scouted' },
    filesFound: { type: 'integer', description: 'Number of relevant files found' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path from project root' },
          relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string', description: 'Brief reason (1 sentence)' },
          keyExports: { type: 'array', items: { type: 'string' } },
        },
        required: ['path', 'relevance', 'reason'],
      },
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          evidence: { type: 'string', description: 'Code evidence (file:line or snippet)' },
        },
        required: ['pattern', 'evidence'],
      },
    },
    directoryStructure: { type: 'string', description: 'ASCII tree with brief annotations' },
    technologies: {
      type: 'array',
      items: {
        type: 'object',
        properties: { category: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' }, purpose: { type: 'string' } },
        required: ['category', 'name'],
      },
    },
    overview: { type: 'string', description: '2-3 sentence summary of purpose and role' },
    entryPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: { entryPoint: { type: 'string' }, type: { type: 'string' }, path: { type: 'string' }, description: { type: 'string' } },
        required: ['entryPoint', 'type', 'path'],
      },
    },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, responsibility: { type: 'string' }, dependencies: { type: 'array', items: { type: 'string' } }, publicAPI: { type: 'string' } },
        required: ['name', 'responsibility'],
      },
    },
    dependencies: {
      type: 'object',
      properties: {
        internal: { type: 'array', items: { type: 'object', properties: { module: { type: 'string' }, dependsOn: { type: 'string' }, relationship: { type: 'string' } } } },
        external: { type: 'array', items: { type: 'object', properties: { package: { type: 'string' }, version: { type: 'string' }, purpose: { type: 'string' } } } },
      },
    },
    questions: { type: 'array', items: { type: 'string' }, description: 'Unresolved questions' },
  },
  required: ['projectName', 'filesFound', 'files', 'patterns', 'directoryStructure', 'technologies', 'overview', 'modules'],
}

const GAPS = {
  type: 'object',
  properties: {
    foundGaps: { type: 'boolean' },
    crossProject: {
      type: 'array',
      items: { type: 'string' },
      description: 'Cross-cutting concerns or patterns that span multiple sub-projects but were missed',
    },
    missedDirectories: {
      type: 'array',
      items: { type: 'string' },
      description: 'Directories not covered by any sub-project scout',
    },
    uncoveredTopics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Important topics or patterns not addressed',
    },
    lowQualityReports: {
      type: 'array',
      items: { type: 'string' },
      description: 'Sub-project names whose reports look incomplete or shallow',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'What to re-scout or investigate next',
    },
  },
  required: ['foundGaps', 'crossProject', 'missedDirectories', 'uncoveredTopics', 'recommendations'],
}

// ── Guard ──

if (!subProjects.length) {
  log('No sub-projects provided — nothing to scout')
  return { mode: 'scout', status: 'empty', results: { subProjects: 0, totalFiles: 0, reports: [] } }
}

// ── Idempotent skip: check which reports already exist ──

phase('Preflight')
log(`Checking ${subProjects.length} sub-project(s) for existing reports...`)

const skipStatus = await agent(
  `${langInstr}
Check if the following scout report files already exist and have substantial content (not empty, not just a template):

${subProjects.map((p, i) => `${i + 1}. ${p.outputPath} — for sub-project "${p.name}"`).join('\n')}

For each file, check if it exists and has real content (more than just headers). Return a JSON array of {name, outputPath, exists: boolean}.

Important: only check file existence and content — do NOT modify anything.`,
  { label: 'check-existing-reports', phase: 'Preflight', agentType: 'Explore', schema: {
    type: 'object',
    properties: {
      existing: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, outputPath: { type: 'string' }, exists: { type: 'boolean' } },
          required: ['name', 'outputPath', 'exists'],
        },
      },
    },
    required: ['existing'],
  }}
)

const existingSet = new Set((skipStatus?.existing || []).filter(e => e.exists).map(e => e.name))
const toScout = subProjects.filter(p => !existingSet.has(p.name))
const toSkip = subProjects.filter(p => existingSet.has(p.name))

if (toSkip.length > 0) {
  log(`✓ ${toSkip.length} report(s) already exist — skipping: ${toSkip.map(p => p.name).join(', ')}`)
}
if (toScout.length === 0) {
  log('All reports already exist — nothing to scout')
  return { mode: 'scout', status: 'completed', results: { subProjects: subProjects.length, completed: subProjects.length, skipped: subProjects.length, failed: 0, totalFiles: 0, reports: toSkip.map(p => ({ name: p.name, outputPath: p.outputPath, filesFound: 0, skipped: true })), failedReports: [], gaps: null } }
}

// ═══════════════════════════════════════════
// PHASE: Scout — One Explore agent per sub-project (skip existing)
// ═══════════════════════════════════════════
phase('Scout')

log(`Scouting ${toScout.length} sub-project(s) — each with one Explore agent`)

// Pipeline over unscouted sub-projects: scout → report independently
const results = await pipeline(
  toScout,
  // ── Stage 1: Scout ──
  async (proj) => {
    const snapshotInstr = proj.repomixSnapshot
      ? `A repomix codebase snapshot is available at ${proj.repomixSnapshot} — read it first as your map for fast file navigation and structure overview. Then verify key findings by reading actual source files.`
      : 'No repomix snapshot available — use Glob and Grep to discover the codebase structure, then read key files directly.'

    const patternsHint = proj.patterns?.length
      ? `KEY PATTERNS TO SEARCH: ${proj.patterns.join(', ')}`
      : 'Infer relevant search patterns from the project type and purpose.'

    const focusHint = proj.focus
      ? `FOCUS AREA: ${proj.focus}`
      : 'Map all aspects of this sub-project comprehensively.'

    log(`Scout: ${proj.name} — ${proj.paths.join(', ')}`)

    const finding = await agent(
      `${langInstr}
Scout sub-project "${proj.name}" at paths: ${proj.paths.join(', ')}.

PROJECT TYPE: ${proj.projectType}
${focusHint}
${patternsHint}

SNAPSHOT: ${snapshotInstr}

TASK — produce a comprehensive scout report with these sections:

1. **Overview** — 2-3 sentence summary: what this sub-project does, its role, its main purpose
2. **Technologies** — scan config files (package.json, Cargo.toml, go.mod, pom.xml, etc.) to identify all frameworks, libraries, databases, and tools
3. **Directory Structure** — ASCII tree of the sub-project with each directory's responsibility annotated
4. **Modules and Responsibilities** — each logical module: its responsibility, internal dependencies, and public API surface
5. **Entry Points** — all entry points (main files, route handlers, CLI commands, API handlers, event handlers, workers) with type and description
6. **Dependencies** — internal cross-module dependencies AND external packages with versions and purposes
7. **Architectural Patterns** — observed patterns with code evidence (file:line), architecture style, data flow patterns
8. **Key Files** — all notable files ranked by relevance (high/medium/low) with reasons

INSTRUCTIONS:
- Use Glob and Grep for file discovery — be thorough
- Read key files to understand structure, exports, and patterns (read at minimum: entry points, config files, main modules)
- Map the full directory tree of ${proj.paths.join(', ')}
- Note architectural patterns with specific file:line evidence
- Flag any areas you couldn't fully explore as "questions"
- Timebox: complete within 5 minutes — prioritize breadth over depth

Return structured output with: projectName, filesFound, files (path/relevance/reason/keyExports), patterns, directoryStructure, technologies, overview, entryPoints, modules, dependencies, questions.`,
      { label: `scout-${proj.name}`, phase: 'Scout', agentType: 'Explore', schema: SCOUT_FINDING }
    )

    return { proj, finding }
  },

  // ── Stage 2: Write report ──
  async ({ proj, finding }) => {
    if (!finding) {
      log(`✗ ${proj.name}: scout agent failed — skipping report`)
      return { name: proj.name, outputPath: proj.outputPath, status: 'failed', filesFound: 0 }
    }

    // Relevance counts
    const highCount = (finding.files || []).filter(f => f.relevance === 'high').length
    const mediumCount = (finding.files || []).filter(f => f.relevance === 'medium').length
    const lowCount = (finding.files || []).filter(f => f.relevance === 'low').length

    if (finding.filesFound === 0) {
      log(`⚠ ${proj.name}: 0 files found — report may be empty. Check paths and patterns.`)
    } else {
      log(`${proj.name}: ${finding.filesFound} files (${highCount} high, ${mediumCount} medium, ${lowCount} low), ${(finding.patterns || []).length} patterns, ${(finding.technologies || []).length} technologies`)
    }

    // Build report sections
    const fileSection = (files, label) => {
      if (!files || !files.length) return `### ${label}\n(${L.none})\n`
      return `### ${label} (${files.length})\n${files.map(f =>
        `- \`${f.path}\` — ${f.reason}${f.keyExports?.length ? ` (exports: ${f.keyExports.join(', ')})` : ''}`
      ).join('\n')}\n`
    }

    const techTable = (finding.technologies || []).length
      ? finding.technologies.map(t => `| ${t.category} | ${t.name} | ${t.version || '—'} | ${t.purpose || '—'} |`).join('\n')
      : '| — | — | — | — |'

    const entryTable = (finding.entryPoints || []).length
      ? finding.entryPoints.map(e => `| ${e.entryPoint} | ${e.type} | \`${e.path}\` | ${e.description || '—'} |`).join('\n')
      : '| — | — | — | — |'

    const moduleList = (finding.modules || []).length
      ? finding.modules.map(m => `- **${m.name}** — ${m.responsibility}${m.dependencies?.length ? ` (depends on: ${m.dependencies.join(', ')})` : ''}${m.publicAPI ? `\n  - Public API: ${m.publicAPI}` : ''}`).join('\n')
      : `(${L.noModules})`

    const internalDeps = (finding.dependencies?.internal || []).length
      ? finding.dependencies.internal.map(d => `| ${d.module} | ${d.dependsOn} | ${d.relationship || '—'} |`).join('\n')
      : '| — | — | — |'

    const externalDeps = (finding.dependencies?.external || []).length
      ? finding.dependencies.external.map(d => `| ${d.package} | ${d.version || '—'} | ${d.purpose || '—'} |`).join('\n')
      : '| — | — | — |'

    const patternList = (finding.patterns || []).length
      ? finding.patterns.map(p => `- **${p.pattern}** — ${p.evidence}`).join('\n')
      : `(${L.noPatterns})`

    const questionList = (finding.questions || []).length
      ? finding.questions.map(q => `- ${q}`).join('\n')
      : `(${L.noQuestions})`

    await agent(
      `${langInstr}
${L.writeReport} cho sub-project "${proj.name}" vào file ${proj.outputPath}. Tạo thư mục với mkdir -p trước.

Dùng chính xác cấu trúc này:

# Scout Report: ${proj.name}

**Ngày:** (dùng \`date -u +%Y-%m-%dT%H:%M:%SZ\` để lấy timestamp)
**Loại dự án:** ${proj.projectType}
**Đường dẫn:** ${proj.paths.join(', ')}

## Tổng quan

${finding.overview || `(${L.none})`}

## Tóm tắt
- Tổng số file: ${finding.filesFound} (${highCount} high, ${mediumCount} medium, ${lowCount} low relevance)
- Patterns: ${(finding.patterns || []).length}
- Technologies: ${(finding.technologies || []).length}
- Modules: ${(finding.modules || []).length}
- Entry Points: ${(finding.entryPoints || []).length}

## Các File Liên Quan

${fileSection((finding.files || []).filter(f => f.relevance === 'high'), L.high)}
${fileSection((finding.files || []).filter(f => f.relevance === 'medium'), L.medium)}
${fileSection((finding.files || []).filter(f => f.relevance === 'low'), L.low)}

## Công Nghệ Sử Dụng

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
${techTable}

## Cấu Trúc Thư Mục

\`\`\`
${finding.directoryStructure || `(${L.none})`}
\`\`\`

## Modules và Trách Nhiệm

${moduleList}

## Entry Points

| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
${entryTable}

## Dependencies

### Internal Dependencies

| Module | Depends On | Relationship |
|--------|-----------|--------------|
${internalDeps}

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
${externalDeps}

## Architectural Patterns

${patternList}

## Câu Hỏi Chưa Giải Quyết

${questionList}

---

*Report generated by workflow-sdlc-scout-pipeline*
`,
      { label: `report-${proj.name}`, phase: 'Report' }
    )

    return {
      name: proj.name,
      outputPath: proj.outputPath,
      status: 'completed',
      filesFound: finding.filesFound,
      highRelevance: highCount,
      mediumRelevance: mediumCount,
      lowRelevance: lowCount,
      patternsObserved: (finding.patterns || []).length,
      technologiesDetected: (finding.technologies || []).length,
      questions: (finding.questions || []).length,
    }
  }
)

// ═══════════════════════════════════════════
// PHASE: Audit — Cross-project completeness check
// ═══════════════════════════════════════════
phase('Audit')

const valid = results.filter(Boolean)
const completed = valid.filter(r => r.status === 'completed')
const failed = valid.filter(r => r.status === 'failed')

// Collect summary for the critic
const projectSummaries = completed.map(r => {
  const proj = toScout.find(p => p.name === r.name)
  return `- **${r.name}**: ${r.filesFound} files, ${r.patternsObserved} patterns, ${r.technologiesDetected} technologies, paths: ${proj?.paths?.join(', ') || 'unknown'}`
}).join('\n')

const failedSummary = failed.length > 0
  ? `\nFAILED: ${failed.map(f => f.name).join(', ')}`
  : ''

const skippedSummary = toSkip.length > 0
  ? `\nSKIPPED (existing reports): ${toSkip.map(p => p.name).join(', ')}`
  : ''

log(`Cross-project critic: checking ${completed.length} completed + ${toSkip.length} skipped + ${failed.length} failed sub-projects for gaps`)

const gaps = completed.length > 0 ? await agent(
  `${langInstr}
You are a completeness critic. Review what was found across ALL sub-projects and identify what's MISSING.

SUB-PROJECTS COMPLETED:
${projectSummaries}
${failedSummary}
${skippedSummary}

ALL SUB-PROJECT PATHS:
${subProjects.map(p => `- **${p.name}**: ${p.paths.join(', ')}`).join('\n')}

TASK:
1. **Cross-project patterns** — are there architectural patterns or concerns that span multiple sub-projects but weren't captured by individual scouts?
2. **Missed directories** — are there directories in the overall project NOT covered by any sub-project?
3. **Uncovered topics** — what important aspects (security, performance, deployment, monitoring, testing strategy) are not addressed?
4. **Low quality reports** — any sub-project reports that look incomplete (very few files, no entry points mapped)?
5. **Recommendations** — what should be re-scouted or investigated next?

Be specific. If everything looks complete, say so — but default to finding at least one improvement opportunity.`,
  { label: 'completeness-audit', phase: 'Audit', schema: GAPS }
) : null

if (gaps?.foundGaps) {
  const gapCount = (gaps.crossProject?.length || 0) + (gaps.missedDirectories?.length || 0) + (gaps.uncoveredTopics?.length || 0)
  log(`⚠ Gaps found: ${gapCount} total (${gaps.crossProject?.length || 0} cross-project, ${gaps.missedDirectories?.length || 0} missed dirs, ${gaps.uncoveredTopics?.length || 0} uncovered topics)`)
  if (gaps.lowQualityReports?.length) {
    log(`⚠ Low-quality reports: ${gaps.lowQualityReports.join(', ')}`)
  }
} else {
  log('No significant gaps found')
}

// ═══════════════════════════════════════════
// RETURN
// ═══════════════════════════════════════════

const totalFiles = completed.reduce((sum, r) => sum + (r.filesFound || 0), 0)

return {
  mode: 'scout',
  status: failed.length === toScout.length && toSkip.length === 0 ? 'failed' : 'completed',
  results: {
    subProjects: subProjects.length,
    completed: completed.length + toSkip.length,
    skipped: toSkip.length,
    failed: failed.length,
    totalFiles,
    reports: [
      ...toSkip.map(p => ({ name: p.name, outputPath: p.outputPath, filesFound: 0, highRelevance: 0, mediumRelevance: 0, lowRelevance: 0, patternsObserved: 0, technologiesDetected: 0, questions: 0, skipped: true })),
      ...completed.map(r => ({
        name: r.name,
        outputPath: r.outputPath,
        filesFound: r.filesFound,
        highRelevance: r.highRelevance,
        mediumRelevance: r.mediumRelevance,
        lowRelevance: r.lowRelevance,
        patternsObserved: r.patternsObserved,
        technologiesDetected: r.technologiesDetected,
        questions: r.questions,
      })),
    ],
    failedReports: failed.map(r => ({ name: r.name, outputPath: r.outputPath })),
    gaps: gaps?.foundGaps ? {
      crossProject: gaps.crossProject || [],
      missedDirectories: gaps.missedDirectories || [],
      uncoveredTopics: gaps.uncoveredTopics || [],
      lowQualityReports: gaps.lowQualityReports || [],
      recommendations: gaps.recommendations || [],
    } : null,
  },
}

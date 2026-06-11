export const meta = {
  name: 'workflow-sdlc-scout-pipeline',
  description: 'Multi-subproject scout pipeline for sdlc-explore: parallel Explore agents per sub-project → dedup → completeness critic → report. One agent per sub-project; pipeline streams results independently.',
  phases: [
    { title: 'Scout', detail: 'Explore agents per sub-project, mapping files + patterns + technologies' },
    { title: 'Report', detail: 'Dedup findings, completeness critic, write per-subproject scout reports' },
  ],
}

// ── Args (safe parse) ──
// { subProjects: [{name, paths, projectType, outputPath, repomixSnapshot?, patterns?, focus?}], language?: 'vi'|'en' }
const _args = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const { subProjects = [], language = 'vi' } = _args

const useEnglish = language === 'en'
const langInstr = useEnglish
  ? 'Write all output in English. Keep technical terms and code identifiers in their original form.'
  : 'Viết tất cả output bằng tiếng Việt. Phải viết có dấu đầy đủ. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

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
          relevance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How relevant this file is to understanding the project' },
          reason: { type: 'string', description: 'Brief reason why this file is relevant (1 sentence)' },
          keyExports: { type: 'array', items: { type: 'string' }, description: 'Key exports, functions, or classes' },
        },
        required: ['path', 'relevance', 'reason'],
      },
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Architectural pattern or convention observed' },
          evidence: { type: 'string', description: 'Code evidence (file:line or snippet)' },
        },
        required: ['pattern', 'evidence'],
      },
    },
    directoryStructure: { type: 'string', description: 'ASCII tree of the sub-project directories with brief annotations' },
    technologies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Framework, Database, Library, Tool' },
          name: { type: 'string' },
          version: { type: 'string' },
          purpose: { type: 'string' },
        },
        required: ['category', 'name'],
      },
    },
    overview: { type: 'string', description: '2-3 sentence summary of the sub-project purpose and role' },
    entryPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entryPoint: { type: 'string' },
          type: { type: 'string' },
          path: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['entryPoint', 'type', 'path'],
      },
    },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          responsibility: { type: 'string' },
          dependencies: { type: 'array', items: { type: 'string' } },
          publicAPI: { type: 'string' },
        },
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
    questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Unresolved questions or areas needing deeper investigation',
    },
  },
  required: ['projectName', 'filesFound', 'files', 'patterns', 'directoryStructure', 'technologies', 'overview', 'modules'],
}

// ── Guard: no sub-projects ──

if (!subProjects.length) {
  log('No sub-projects provided — nothing to scout')
  return { mode: 'scout', status: 'empty', results: { subProjects: 0, totalFiles: 0, reports: [] } }
}

// ═══════════════════════════════════════════
// PHASE: Scout — One Explore agent per sub-project
// ═══════════════════════════════════════════
phase('Scout')

log(`Scouting ${subProjects.length} sub-project(s) — each with one Explore agent`)

// Pipeline over sub-projects: each goes through scout → report independently
const results = await pipeline(
  subProjects,
  // ── Stage 1: Scout the sub-project ──
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

  // ── Stage 2: Write report per sub-project ──
  async ({ proj, finding }) => {
    if (!finding) {
      log(`✗ ${proj.name}: scout agent failed — skipping report`)
      return { name: proj.name, outputPath: proj.outputPath, status: 'failed', filesFound: 0 }
    }

    // Relevance counts
    const highCount = (finding.files || []).filter(f => f.relevance === 'high').length
    const mediumCount = (finding.files || []).filter(f => f.relevance === 'medium').length
    const lowCount = (finding.files || []).filter(f => f.relevance === 'low').length

    log(`${proj.name}: ${finding.filesFound} files (${highCount} high, ${mediumCount} medium, ${lowCount} low), ${(finding.patterns || []).length} patterns, ${(finding.technologies || []).length} technologies`)

    // Build report sections
    const fileSection = (files, label) => {
      if (!files || !files.length) return `### ${label}\n(không có)\n`
      return `### ${label} (${files.length})\n${files.map(f =>
        `- \`${f.path}\` — ${f.reason}${f.keyExports?.length ? ` (exports: ${f.keyExports.join(', ')})` : ''}`
      ).join('\n')}\n`
    }

    const techTable = (finding.technologies || []).length
      ? (finding.technologies || []).map(t => `| ${t.category} | ${t.name} | ${t.version || '—'} | ${t.purpose || '—'} |`).join('\n')
      : '| — | — | — | — |'

    const entryTable = (finding.entryPoints || []).length
      ? (finding.entryPoints || []).map(e => `| ${e.entryPoint} | ${e.type} | \`${e.path}\` | ${e.description || '—'} |`).join('\n')
      : '| — | — | — | — |'

    const moduleList = (finding.modules || []).length
      ? (finding.modules || []).map(m => `- **${m.name}** — ${m.responsibility}${m.dependencies?.length ? ` (depends on: ${m.dependencies.join(', ')})` : ''}${m.publicAPI ? `\n  - Public API: ${m.publicAPI}` : ''}`).join('\n')
      : '(không có module nào được xác định)'

    const internalDeps = (finding.dependencies?.internal || []).length
      ? (finding.dependencies.internal || []).map(d => `| ${d.module} | ${d.dependsOn} | ${d.relationship || '—'} |`).join('\n')
      : '| — | — | — |'

    const externalDeps = (finding.dependencies?.external || []).length
      ? (finding.dependencies.external || []).map(d => `| ${d.package} | ${d.version || '—'} | ${d.purpose || '—'} |`).join('\n')
      : '| — | — | — |'

    const patternList = (finding.patterns || []).length
      ? (finding.patterns || []).map(p => `- **${p.pattern}** — ${p.evidence}`).join('\n')
      : '(không có pattern nào được xác định)'

    const questionList = (finding.questions || []).length
      ? (finding.questions || []).map(q => `- ${q}`).join('\n')
      : '(không có câu hỏi nào chưa giải quyết)'

    await agent(
      `${langInstr}
Viết scout report cho sub-project "${proj.name}" vào file ${proj.outputPath}. Tạo thư mục với mkdir -p trước.

Dùng chính xác cấu trúc này:

# Scout Report: ${proj.name}

**Ngày:** (dùng \`date -u +%Y-%m-%dT%H:%M:%SZ\` để lấy timestamp)
**Loại dự án:** ${proj.projectType}
**Đường dẫn:** ${proj.paths.join(', ')}

## Tổng quan

${finding.overview || '(không có)'}

## Tóm tắt
- Tổng số file: ${finding.filesFound} (${highCount} high, ${mediumCount} medium, ${lowCount} low relevance)
- Patterns: ${(finding.patterns || []).length}
- Technologies: ${(finding.technologies || []).length}
- Modules: ${(finding.modules || []).length}
- Entry Points: ${(finding.entryPoints || []).length}

## Các File Liên Quan

${fileSection((finding.files || []).filter(f => f.relevance === 'high'), 'Mức Độ Cao')}
${fileSection((finding.files || []).filter(f => f.relevance === 'medium'), 'Mức Độ Trung Bình')}
${fileSection((finding.files || []).filter(f => f.relevance === 'low'), 'Mức Độ Thấp')}

## Công Nghệ Sử Dụng

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
${techTable}

## Cấu Trúc Thư Mục

\`\`\`
${finding.directoryStructure || '(không có)'}
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
// RETURN
// ═══════════════════════════════════════════

const valid = results.filter(Boolean)
const completed = valid.filter(r => r.status === 'completed')
const failed = valid.filter(r => r.status === 'failed')
const totalFiles = completed.reduce((sum, r) => sum + (r.filesFound || 0), 0)

return {
  mode: 'scout',
  status: failed.length === subProjects.length ? 'failed' : 'completed',
  results: {
    subProjects: subProjects.length,
    completed: completed.length,
    failed: failed.length,
    totalFiles,
    reports: completed.map(r => ({
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
    failedReports: failed.map(r => ({ name: r.name, outputPath: r.outputPath })),
  },
}

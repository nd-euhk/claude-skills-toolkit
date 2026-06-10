export const meta = {
  name: 'workflow-sdlc-scout-pipeline',
  description: 'Multi-modal codebase scouting: parallel Explore agents → dedup → completeness critic → report. Used by sdlc:scout skill.',
  phases: [
    { title: 'Scout', detail: 'Parallel Explore agents covering distinct directory scopes' },
    { title: 'Aggregate', detail: 'Dedup, merge, completeness critic, identify gaps' },
    { title: 'Report', detail: 'Write scout report to .work/scouts/' },
  ],
}

// ── Args ──
// {
//   topic, scopes: [{name, paths, patterns, focus}], projectType, language, outputPath, scale, includeContent, deepMode
// }
const {
  topic = 'codebase exploration',
  scopes = [],
  projectType = 'unknown',
  language = 'vi',
  outputPath = null,
  scale = 'medium',
  includeContent = false,
  deepMode = false,
} = args

const useEnglish = language === 'en'
const langInstr = useEnglish
  ? 'Write all output in English. Keep technical terms and code identifiers in their original form.'
  : 'Viết tất cả output bằng tiếng Việt. Thuật ngữ kỹ thuật và mã định danh giữ nguyên tiếng Anh.'

const REPORT_PATH = outputPath || `.work/scouts/scout-${topic.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`

// ── Schemas ──

const SCOUT_FINDING = {
  type: 'object',
  properties: {
    scopeName: { type: 'string', description: 'Name of the scouted scope' },
    filesFound: { type: 'integer', description: 'Number of relevant files found' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path from project root' },
          relevance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How relevant this file is to the topic' },
          reason: { type: 'string', description: 'Brief reason why this file is relevant (1 sentence)' },
          keyExports: { type: 'array', items: { type: 'string' }, description: 'Key exports, functions, or classes in this file' },
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
          evidence: { type: 'string', description: 'Code evidence supporting this pattern (file:line or snippet)' },
        },
        required: ['pattern', 'evidence'],
      },
    },
    directoryStructure: { type: 'string', description: 'ASCII tree of the scouted directories with brief annotations per directory' },
    technologies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'E.g., Framework, Database, Library, Tool' },
          name: { type: 'string' },
          version: { type: 'string' },
          purpose: { type: 'string' },
        },
        required: ['category', 'name'],
      },
    },
    questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Unresolved questions or areas needing deeper investigation in this scope',
    },
    timedOut: { type: 'boolean', description: 'Whether this scope search timed out' },
  },
  required: ['scopeName', 'filesFound', 'files', 'patterns', 'questions'],
}

const GAPS = {
  type: 'object',
  properties: {
    foundGaps: { type: 'boolean', description: 'Whether any gaps were found' },
    missedDirectories: {
      type: 'array',
      items: { type: 'string' },
      description: 'Directories or areas that were not covered by any scout agent',
    },
    uncoveredTopics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Topics or patterns not covered by any agent',
    },
    missedDependencies: {
      type: 'array',
      items: { type: 'string' },
      description: 'External or internal dependencies not mapped',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'What to scout next or re-scout if gaps exist',
    },
  },
  required: ['foundGaps', 'missedDirectories', 'uncoveredTopics', 'recommendations'],
}

// ── Guard: no scopes ──

if (!scopes.length) {
  log('No scopes provided — writing empty report')
  await agent(
    `${langInstr}
Write a scout report header to ${REPORT_PATH}. Create the directory first with mkdir -p.

The report should say:

# Scout Report: ${topic}

## Summary
- No scopes were provided for scouting.
- This may indicate the project is empty or the search target didn't match any directories.

## Recommendation
Re-run with more specific search targets or broader directory scopes.`,
    { label: 'write-empty-report', phase: 'Report' }
  )
  return {
    mode: 'scout',
    status: 'empty',
    results: { filesFound: 0, agentsSpawned: 0, agentsCompleted: 0, gaps: [], reportPath: REPORT_PATH },
  }
}

// ═══════════════════════════════════════════
// PHASE: Scout — Multi-modal sweep
// ═══════════════════════════════════════════
phase('Scout')

log(`Starting multi-modal sweep: ${scopes.length} scopes for "${topic}" (scale: ${scale}, project: ${projectType})`)

// Content reading instruction varies by mode
const contentInstr = includeContent
  ? 'For HIGH-relevance files, read the first 100 lines to understand structure and key exports.'
  : 'Do NOT read file contents — list files, patterns, and structure only. Use Glob and Grep for discovery.'

const deepInstr = deepMode
  ? 'DEEP MODE: Also trace dependencies between files. For each high-relevance file, identify what imports it and what it imports.'
  : ''

const scoutResults = await parallel(
  scopes.map((scope, i) => () =>
    agent(
      `${langInstr}
Quickly scout ${scope.paths.join(', ')} for files related to: ${topic}.

SCOPE: ${scope.name}
FOCUS: ${scope.focus || 'all relevant files'}
PATTERNS TO SEARCH: ${scope.patterns?.join(', ') || 'infer from topic'}
PROJECT TYPE: ${projectType}

INSTRUCTIONS:
- Use Glob and Grep for file discovery — be thorough but fast
- ${contentInstr}
- ${deepInstr}
- Map the directory structure (ASCII tree) of the scouted area
- Identify technologies used (frameworks, libraries, tools) from config files
- Note architectural patterns with code evidence (file:line)
- Timebox: search thoroughly but complete within 3 minutes
- Flag any areas you couldn't fully explore as "questions"

Report structured output with: scopeName, filesFound, files (with path/relevance/reason/keyExports), patterns, directoryStructure, technologies, questions.`,
      { label: `scout-${scope.name}`, phase: 'Scout', agentType: 'Explore', schema: SCOUT_FINDING }
    )
  )
)

// Filter out nulls (skipped/timeout agents) and separate timed-out
const validResults = scoutResults.filter(Boolean)
const timedOutCount = scoutResults.filter(r => r && r.timedOut).length
const completedCount = validResults.filter(r => !r.timedOut).length

log(`Scout sweep complete: ${completedCount}/${scopes.length} completed${timedOutCount > 0 ? `, ${timedOutCount} timed out` : ''}`)

// ═══════════════════════════════════════════
// PHASE: Aggregate — Dedup + Merge + Completeness Critic
// ═══════════════════════════════════════════
phase('Aggregate')

// Deduplicate files by path (keep highest relevance)
const fileMap = new Map()
for (const r of validResults) {
  for (const f of r.files || []) {
    const existing = fileMap.get(f.path)
    if (!existing || relevanceRank(f.relevance) > relevanceRank(existing.relevance)) {
      fileMap.set(f.path, f)
    }
  }
}
function relevanceRank(r) { return r === 'high' ? 3 : r === 'medium' ? 2 : 1 }

const allFiles = Array.from(fileMap.values())
const highCount = allFiles.filter(f => f.relevance === 'high').length
const mediumCount = allFiles.filter(f => f.relevance === 'medium').length

// Deduplicate patterns
const patternSet = new Set()
const allPatterns = []
for (const r of validResults) {
  for (const p of r.patterns || []) {
    const key = p.pattern.toLowerCase()
    if (!patternSet.has(key)) {
      patternSet.add(key)
      allPatterns.push(p)
    }
  }
}

// Collect questions
const allQuestions = validResults.flatMap(r => r.questions || [])

// Collect technologies (dedup by name)
const techMap = new Map()
for (const r of validResults) {
  for (const t of r.technologies || []) {
    if (!techMap.has(t.name)) techMap.set(t.name, t)
  }
}
const allTechnologies = Array.from(techMap.values())

log(`Aggregated: ${allFiles.length} unique files (${highCount} high, ${mediumCount} medium), ${allPatterns.length} patterns, ${allQuestions.length} questions`)

// ── Completeness critic ──
log('Running completeness critic...')

const gaps = await agent(
  `${langInstr}
You are a completeness critic. Review what was found and identify what's MISSING.

TOPIC: ${topic}
PROJECT TYPE: ${projectType}
SCOPES SEARCHED: ${scopes.map(s => `${s.name}: ${s.paths.join(', ')}`).join(' | ')}
SCOPES TIMED OUT: ${timedOutCount}

FILES FOUND: ${allFiles.length} (${highCount} high relevance, ${mediumCount} medium)
PATTERNS OBSERVED: ${allPatterns.map(p => `- ${p.pattern}`).join('\n')}
QUESTIONS RAISED: ${allQuestions.map(q => `- ${q}`).join('\n')}

DIRECTORY MAPS FROM EACH AGENT:
${validResults.map(r => `=== ${r.scopeName} ===\n${r.directoryStructure || '(no map)'}`).join('\n\n')}

TASK: Identify:
1. Missed directories — which directories in the project were NOT covered by any scope? (check the directory maps)
2. Uncovered topics — what aspect of "${topic}" was not addressed?
3. Missed dependencies — external packages, internal cross-module deps not mapped?
4. Recommendations — what to scout next or re-scout?

Be specific. If everything is covered, say so. But default to finding at least something that could be improved.`,
  { label: 'completeness-critic', phase: 'Aggregate', schema: GAPS }
)

const gapReport = gaps || {
  foundGaps: false,
  missedDirectories: [],
  uncoveredTopics: [],
  missedDependencies: [],
  recommendations: ['Completeness critic failed — manual review recommended'],
}

if (gapReport.foundGaps) {
  log(`Gaps found: ${gapReport.missedDirectories.length} missed dirs, ${gapReport.uncoveredTopics.length} uncovered topics`)
} else {
  log('No significant gaps found')
}

// ═══════════════════════════════════════════
// PHASE: Report — Write scout report
// ═══════════════════════════════════════════
phase('Report')

log(`Writing scout report to ${REPORT_PATH}`)

const timestamp = '(agent: generate current ISO timestamp via `date -u +%Y-%m-%dT%H:%M:%SZ`)'

// Build file list for the report
const highFiles = allFiles.filter(f => f.relevance === 'high')
const mediumFiles = allFiles.filter(f => f.relevance === 'medium')
const lowFiles = allFiles.filter(f => f.relevance === 'low')

const fileListStr = (files, label) => {
  if (!files.length) return `### ${label}\n(none)\n`
  return `### ${label} (${files.length})\n${files.map(f =>
    `- \`${f.path}\` — ${f.reason}${f.keyExports?.length ? ` (exports: ${f.keyExports.join(', ')})` : ''}`
  ).join('\n')}\n`
}

const patternListStr = allPatterns.length
  ? allPatterns.map(p => `- **${p.pattern}** — ${p.evidence}`).join('\n')
  : '(no patterns identified)'

const techListStr = allTechnologies.length
  ? allTechnologies.map(t => `| ${t.category} | ${t.name} | ${t.version || '—'} | ${t.purpose || '—'} |`).join('\n')
  : '| — | — | — | — |'

const gapSectionStr = gapReport.foundGaps
  ? `
## Gaps Identified

### Missed Directories
${gapReport.missedDirectories.length ? gapReport.missedDirectories.map(d => `- ${d}`).join('\n') : '(none)'}

### Uncovered Topics
${gapReport.uncoveredTopics.length ? gapReport.uncoveredTopics.map(t => `- ${t}`).join('\n') : '(none)'}

### Missed Dependencies
${gapReport.missedDependencies?.length ? gapReport.missedDependencies.map(d => `- ${d}`).join('\n') : '(none)'}

### Recommendations
${gapReport.recommendations.map(r => `- ${r}`).join('\n')}
`
  : `
## Gaps
No significant gaps identified by completeness critic.
`

const questionSectionStr = allQuestions.length
  ? allQuestions.map(q => `- ${q}`).join('\n')
  : '(no unresolved questions)'

await agent(
  `${langInstr}
Write the scout report to ${REPORT_PATH}. Create the directory with mkdir -p first.

Use this EXACT content structure (replace placeholders with actual data):

# Scout Report: ${topic}

**Date:** ${timestamp}
**Scale:** ${scale} | **Mode:** ${deepMode ? 'deep' : 'standard'} | **Content:** ${includeContent ? 'yes' : 'no'}
**Project Type:** ${projectType}

## Summary
- Total files found: ${allFiles.length} (${highCount} high, ${mediumCount} medium, ${lowFiles.length} low relevance)
- Agents spawned: ${scopes.length}
- Agents completed: ${completedCount}${timedOutCount > 0 ? ` (${timedOutCount} timed out)` : ''}
- Patterns observed: ${allPatterns.length}
- Technologies detected: ${allTechnologies.length}

## Relevant Files

${fileListStr(highFiles, 'High Relevance')}
${fileListStr(mediumFiles, 'Medium Relevance')}
${lowFiles.length ? fileListStr(lowFiles, 'Low Relevance') : ''}

## Technologies Detected

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
${techListStr}

## Patterns Observed

${patternListStr}

## Directory Map

${validResults.map(r => `### ${r.scopeName}\n\`\`\`\n${r.directoryStructure || '(no map available)'}\n\`\`\``).join('\n\n')}
${gapSectionStr}
## Unresolved Questions

${questionSectionStr}

---

*Report generated by workflow-sdlc-scout-pipeline*
`,
  { label: 'write-report', phase: 'Report' }
)

// ═══════════════════════════════════════════
// RETURN
// ═══════════════════════════════════════════

return {
  mode: 'scout',
  status: 'completed',
  results: {
    topic,
    filesFound: allFiles.length,
    highRelevance: highCount,
    mediumRelevance: mediumCount,
    lowRelevance: lowFiles.length,
    agentsSpawned: scopes.length,
    agentsCompleted: completedCount,
    agentsTimedOut: timedOutCount,
    patternsObserved: allPatterns.length,
    technologiesDetected: allTechnologies.length,
    questions: allQuestions.length,
    gaps: gapReport.foundGaps ? {
      missedDirectories: gapReport.missedDirectories.length,
      uncoveredTopics: gapReport.uncoveredTopics.length,
    } : null,
    reportPath: REPORT_PATH,
  },
}

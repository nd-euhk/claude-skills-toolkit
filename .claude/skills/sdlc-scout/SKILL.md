---
name: sdlc-scout
description: >-
  SDLC-specific codebase scouting with project discovery, structured output,
  caching, and audit. Wraps the scout skill for parallel Explore agent execution
  and the scout-pipeline workflow for large multi-project codebases. Use when
  sdlc-review needs codebase exploration before review, sdlc-explore needs
  pre-pipeline scouting, or any SDLC flow requires structured codebase
  understanding with module maps, entry points, dependencies, and pattern
  analysis. Supports --focus, --patterns, --mode (review|explore).
argument-hint: "<target-path> [--focus <description>] [--patterns <keywords>] [--mode review|explore]"
version: 1.0.0
allowed-tools: Read, Write, Bash(git:*,find:*,ls:*,mkdir:*,wc:*), Grep, Glob, Agent, Workflow, Skill, AskUserQuestion
---

# SDLC Scout

SDLC-specific scouting wrapper. Discovers sub-projects, decides scouting strategy based on codebase scale, delegates parallel exploration to `scout` skill or `workflow-sdlc-scout-pipeline`, adds caching and cross-project audit. Produces structured reports consumable by `sdlc-review` and `sdlc-explore`.

**Key difference from `scout` skill:** `scout` does fast parallel file discovery with markdown output. `sdlc-scout` adds project discovery, structured schema output, repomix integration for large codebases, idempotent caching, completeness audit, and SDLC-specific report sections (modules, entry points, dependencies, technologies, architectural patterns). Think: `scout` = tactical search, `sdlc-scout` = strategic exploration.

## When to Use

**Called by other skills (primary use case):**
- `sdlc-review --code` needs codebase exploration before 7-dimension review
- `sdlc-explore` needs sub-project discovery + scouting before SDLC pipeline

**Not for:**
- Fast file search within a single directory → use `scout` skill directly
- Manual codebase exploration → use `sdlc-explore` for full pipeline
- Reviewing MR/PR diffs → use `sdlc-review --mr` (no scout needed)

## Quick Start

```bash
# From sdlc-review (code mode)
Skill(sdlc-scout, "src/auth/ --focus 'Authentication module' --patterns 'JWT,OAuth,token' --mode review")

# From sdlc-explore (full exploration)
Skill(sdlc-scout, ". --mode explore")

# Standalone
/sdlc-scout src/api/ --focus "REST API handlers" --patterns "route,controller,middleware"
```

## How Other Skills Use This

`sdlc-review --code` gọi `Skill(sdlc-scout, "{path} --mode review")` → nhận structured report → review agents đọc report thay vì tự explore.

`sdlc-explore` gọi `Skill(sdlc-scout, ". --mode explore")` → nhận `subProjectReports[]` → dùng cho Plan và SDLC pipeline.

Xem `references/integration-guide.md` để biết diff chi tiết khi sửa 2 skill trên.

## Core Workflow

### Phase 1: Discover Sub-Projects

Goal: find all sub-projects in the target path. This is a **skill-level operation** (Bash only, no agent context needed).

**Step 1.1: Universal Project Discovery**

Detect all sub-project patterns simultaneously:

- **Pattern 1 — Git Submodules**: `git submodule status`. Record: name, path, commit, branch. Excluded from Patterns 2-3.
- **Pattern 2 — Nested Git Repos**: `find {targetPath} -name ".git" -type d`. Check `git check-ignore` for each. Record: name, path, remote.
- **Pattern 3 — Monorepo Directories**: Look for `packages/*/`, `apps/*/`, `services/*/`, `modules/*/` with build files (`package.json`, `Cargo.toml`, `go.mod`, `pom.xml`). Skip dirs from Patterns 1-2.
- **Pattern 4 — Single Project (Fallback)**: If no other patterns → one sub-project = the target path itself.

**Step 1.2: Classify**

Count total files in each discovered sub-project:
```bash
find {path} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/dist/*' -not -path '*/build/*' | wc -l
```

Classify each:
- **Small** (<50 files) → 1 Explore agent, no repomix needed
- **Medium** (50-200 files) → 2-4 Explore agents, optional repomix
- **Large** (>200 files) → repomix snapshot + scout pipeline workflow

**Step 1.3: Pull Latest Source** (explore mode only, skip in review mode)

```bash
git submodule foreach 'git pull'  # if submodules exist
git pull                          # root repo
```

### Phase 2: Decide Strategy

Route based on mode and scale:

| Mode | Scale | Strategy |
|------|-------|----------|
| `review` | Small (<50 files) | `scout` skill — 1 Explore agent |
| `review` | Medium (50-200 files) | `scout` skill — 2-4 Explore agents |
| `review` | Large (200+ files) | `workflow-sdlc-scout-pipeline` with repomix |
| `explore` | Any size | `workflow-sdlc-scout-pipeline` with repomix (full featured) |

**Decision logic:**
```js
if (mode === 'explore' || anySubProject.files > 200) {
  // Use full scout pipeline: Preflight→Scout→Report→Audit
  strategy = 'pipeline'
} else {
  // Use scout skill for fast parallel exploration
  strategy = 'scout-skill'
}
```

**Repomix decision** (pipeline strategy only):
- If repomix available → pack each sub-project: `Skill(repomix, "{path} --style xml --remove-comments -o .work/repomix/{name}--{slug}.xml")`
- If repomix missing → AskUserQuestion: "Repomix chưa cài. Cài để tăng tốc?" (header: "Repomix")
  - Options: "Cài repomix" | "Tiếp tục không repomix"

### Phase 3: Execute Scout

#### Strategy A: Scout Skill (review mode, ≤200 files)

```
Skill(scout, "{targetPath}")
```

The `scout` skill handles: directory division, parallel Explore agent spawning, result aggregation, report writing to `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`.

After `scout` skill completes, read the generated report and enhance it with SDLC-specific sections if needed (entry points table, dependencies mapping). See `references/sdlc-enhancement.md`.

#### Strategy B: Scout Pipeline Workflow (explore mode or >200 files)

Prepare args per sub-project:
```js
const subProjects = discoveredProjects.map(p => ({
  name: p.name,
  paths: [p.path],
  projectType: p.type,              // node | python | go | rust | ...
  outputPath: `.work/scouts/scout-YYYYMMDD-${p.name}--${slug}.md`,
  repomixSnapshot: p.repomixFile || null,
  patterns: p.suggestedPatterns || null,
  focus: p.focus || null,
}))

const args = { subProjects, language: 'vi' }
```

**Check for existing reports first** (caching):
```bash
# For each sub-project, check if output file exists and has content
ls -la {outputPath} 2>/dev/null && wc -l {outputPath}
```

Skip sub-projects with existing valid reports (idempotent).

Invoke:
```
Workflow({ scriptPath: ".claude/workflows/workflow-sdlc-scout-pipeline.js", args })
```

**Guard**: `ls .claude/workflows/workflow-sdlc-scout-pipeline.js` → if missing, fall back to `scout` skill with warning.

### Phase 4: Audit (pipeline strategy only)

Pipeline workflow includes built-in Audit phase. For scout-skill strategy, run a lightweight completeness check:

1. List all directories in targetPath: `find {targetPath} -type d | head -50`
2. Compare against scouted files in report
3. Flag directories with no files in report as potential gaps
4. Add `## Unresolved Questions` section if gaps found

### Phase 5: Output

**Report location**: `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`

**Report sections**: Tổng quan, Tóm tắt, Các File Liên Quan (theo relevance), Công Nghệ, Cấu Trúc Thư Mục, Modules và Trách Nhiệm, Entry Points, Dependencies (internal + external), Architectural Patterns, Câu Hỏi Chưa Giải Quyết. Xem `references/report-format.md` để biết template đầy đủ và return data schema.

**Return data** — object với `reports[]` (mỗi report: name, outputPath, filesFound, highRelevance, patternsObserved, technologiesDetected, modulesFound, entryPointsFound) và `gaps` (missedDirectories, uncoveredTopics, recommendations). Xem `references/report-format.md` để biết schema đầy đủ.

## Key Principles

- **Wrapper, not replacement** — Delegates to `scout` skill or `workflow-sdlc-scout-pipeline.js`. Never spawns Explore agents directly.
- **Structured output** — Reports follow a fixed schema consumable by downstream SDLC skills. Never free-form text.
- **Scale-aware routing** — Auto-selects strategy based on file count and mode. User doesn't need to know implementation details.
- **Idempotent** — Checks for existing reports before scouting. Safe to call multiple times.
- **.gitignore aware** — Excludes `node_modules/`, `vendor/`, `dist/`, `build/`, `.git/` from file counting.
- **Bash for discovery, Agent for scout** — Phase 1 runs at skill level with Bash (no context cost). Phase 3 delegates to agents.
- **Resumable** — Pipeline strategy supports `Workflow({ resumeFromRunId })`. Skill strategy re-reads existing reports.

## Reference Guide

- `references/integration-guide.md` — Cách tích hợp vào sdlc-review và sdlc-explore (diff chi tiết, checklist verify)
- `references/report-format.md` — Template đầy đủ cho scout report, return data schema, các trường bắt buộc
- `references/sdlc-enhancement.md` — Cách enhance output của scout skill với SDLC-specific sections
- `references/pipeline-handoff.md` — Args schema, result structures, error handling cho workflow-sdlc-scout-pipeline.js

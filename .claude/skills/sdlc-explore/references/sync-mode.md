# Sync Mode — sdlc-explore

Update existing exploration documentation by detecting changes since last run, analyzing impact, and running only affected SDLC phases.

## Sync Step 1: Git Change Detection

**Baseline** (priority order):
1. Git tag `explore-*`: `git tag -l 'explore-*' --sort=-creatordate | head -1`
2. Report file timestamp: `ls -t .work/reports/explore-*.md .work/scouts/scout-*.md 2>/dev/null | head -1`, use `stat` for mtime
3. AskUserQuestion: "No previous exploration found. How far back?" (header: "Baseline", options: "7 days" | "14 days" | "30 days" | "Since specific commit")

**Collect changes** after baseline is established. Run Universal Project Discovery, then per project type:
```bash
git diff --stat $BASELINE..HEAD          # Main repo
git -C <submodule_path> log --oneline $BASELINE..HEAD
git -C <nested_repo_path> log --oneline --since="$DATE"
git log --oneline $BASELINE..HEAD -- <monorepo_path>/
```

**No git**: fallback to `find . -newer <baseline_file>`, warn human. **No changes**: report and offer "Run selected phases anyway?" (Yes/No).

## Sync Step 2: Impact Analysis

### Tier 1 — Rule-Based Mapping

| Change Pattern | Glob | SDLC Impact |
|----------------|------|-------------|
| Source code | `src/**`, `lib/**`, `app/**`, `services/**` | **IMP + TST** |
| API contracts | `*.proto`, `*.graphql`, `openapi*`, `contracts/**` | **SRS + LLD** |
| Architecture / Infra | `package.json`, `Dockerfile*`, `docker-compose*`, `terraform/**` | **HLD** |
| Database | `migrations/**`, `*.sql`, `prisma/**` | **LLD + IMP** |
| Tests only | `*.test.*`, `*.spec.*`, `__tests__/**` | **TST** |
| Config | `config/**`, `.env*`, `application*.yml` | **IMP** |
| Docs only | `README*`, `CHANGELOG*`, `docs/**` | **No sync needed** |
| New service/directory | New dir under services/apps/packages | **SRS + HLD + LLD** |

### Tier 2 — AI Deep Analysis

Trigger when diff > 100 lines, > 10 files, or changes touch core architecture. Spawn `Agent(Explore)` to analyze impact.

## Sync Step 3: Smart Suggestions

Combine Tier 1 + Tier 2. Present change summary, then AskUserQuestion:
- Question: "Which phases should be re-run based on detected changes?" (header: "Sync Scope", multiSelect: true)
- Options: "SRS" | "HLD" | "LLD" | "IMP" | "TST"
- Pre-select phases with HIGH-impact changes as `[recommended]`

## Sync Step 4: Execute Selected Phases

Run selected phases via Phase 4 workflow (if SRS/HLD/LLD/IMP/TST selected) → Phase 5 (if selected) → Phase 6 with auto-tagging.

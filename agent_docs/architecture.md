# Architecture Summary (for AI Agents)

## Service List

| Service/Skill | Purpose |
|---------------|---------|
| explore-codebase | End-to-end SDLC documentation generation (Scout -> Pipeline -> Sprint -> Summary) |
| orchestrator | Multi-agent workflow orchestration |
| sprint | Roadmap, backlog, and board artifact management |
| skill-composer | Create new Agent Skills from scratch |
| skill-refiner | Improve existing skills for quality and efficiency |
| skill-tester | Empirically test and benchmark skills (Quick + Full Pipeline) |
| plugin-creator | Create, validate, and publish Claude Code plugins |
| hook-creator | Create, validate, and refine hooks |
| subagent-creator | Create, validate, and refine subagents |
| debugging | Systematic debugging with root cause analysis |
| git | Git operations with conventional commits |
| problem-solving | Creative problem-solving techniques |
| sequential-thinking | Step-by-step analysis for complex problems |
| ask-user-question | Interactive user input and decisions |

## Communication Rules

| From | To | Protocol | Notes |
|------|----|----------|-------|
| Skill | Agent | Agent() tool with structured brief | Brief format: Context -> Inputs -> Task -> Constraints |
| Skill | Skill | Skill(name) tool invocation | Used for delegation (e.g., Skill(sprint), Skill(sequential-thinking)) |
| Agent | Filesystem | Read/Write/Edit tools | Output paths from default templates; priority overridden by spawn brief |
| Hook | Runtime | Shell command | Registered via hooks.json / settings.json event matchers |
| Agent | Templates | Read tool | Templates in `.claude/templates/{phase}/` |

## Key Constraints

1. **Bounded Scope**: Each skill is self-contained in its directory. No cross-skill file imports.
2. **No direct sprint file modification**: Always use `Skill(sprint)` for sprint artifact changes.
3. **Gate verification chain**: HLD -> gate-verifier before LLD -> gate-verifier before IMP+TST.
4. **Max 3 re-spawns**: Per phase on gate rejection.
5. **No implementation details in HLD**: Architecture only; LLD handles service internals.
6. **No output paths in agent briefs**: Agents determine output from their default templates.
7. **All changelogs in root CHANGELOG.md**: Never create skill-level changelogs.
8. **Plugin version bumped on any skill change**: Skill versions are independent from plugin version.
9. **Knowledge duplication is intentional**: Documented in CLAUDE.md as Bounded Scope Principle.

## Directory Layout

```
toolkit/
├── .claude/
│   ├── skills/          # 14 Agent Skills (each: SKILL.md + optional references/)
│   ├── agents/           # 11 sub-agents (each: .md definition)
│   ├── hooks/            # Shell scripts for event automation
│   ├── templates/        # 30 templates in 10 categories
│   └── settings.json     # Runtime configuration
├── agent_docs/           # Agent-oriented reference docs
│   ├── architecture.md   # This file
│   ├── domain-service-mapping.yaml
│   ├── hard-boundaries.md
│   ├── contracts/        # API and event conventions
│   └── backend/          # Per-service impl and test specs
├── docs/                 # User-facing documentation
│   └── architecture/     # HLD, ADRs, diagrams
├── evals/                # Eval infrastructure per skill
├── projects/             # Reference sub-projects
│   └── sanitizer-service/  # Python utility (email validation + input sanitization)
└── .work/                # Runtime artifacts (board, backlog, reports, plans)
```

## Phase Output Locations

| Phase | Agent | Writes To |
|-------|-------|-----------|
| SRS | srs | `docs/product/SRS.md`, `docs/product/features/` |
| HLD | hld | `docs/architecture/system-architecture.md`, `docs/architecture/ADRs/`, `docs/architecture/diagrams/`, `agent_docs/architecture.md`, `agent_docs/domain-service-mapping.yaml`, `agent_docs/hard-boundaries.md`, `agent_docs/contracts/` |
| LLD | lld | `agent_docs/tech-design/` |
| IMP | imp | `agent_docs/backend/{service}/implementation/` |
| TST | tst | `agent_docs/backend/{service}/test-specs/` |

# Scout Report: toolkit (explore-codebase)

## 1. Overview

This is a Claude Code plugin toolkit that provides Agent Skills, sub-agents, hooks, and evaluation infrastructure for SDLC automation. It also contains a reference sub-project (`sanitizer-service`) demonstrating the full SDLC pipeline output (SRS, HLD, architecture docs, test specs). The toolkit serves as both a development framework and a reference implementation for building Claude Code plugins.

## 2. Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Claude Code (Node.js) | N/A | Plugin execution environment |
| Markup | Markdown/YAML | N/A | Skill definitions, agent configs, docs |
| Scripting | Bash | N/A | Hook scripts, validation utilities |
| Config | JSON | N/A | Plugin manifest, settings, hooks config |
| VCS | Git | N/A | Version control, worktree isolation |
| Python | Python 3.x | 3.x | Reference sub-project (sanitizer-service) |
| Testing | pytest | N/A | Test framework for sanitizer-service |

## 3. Directory Structure

```
toolkit/
├── CLAUDE.md                           # Project instructions for Claude
├── .claude/                            # Claude Code configuration
│   ├── agents/                         # SDLC sub-agents (HLD, LLD, IMP, TST, SRS, gate-verifier, sprint-master, git-manager, debugger, tdd-backend, tdd-frontend)
│   ├── hooks/                          # Shell hooks (ensure-claude-md.sh)
│   ├── skills/                         # 14 Agent Skills
│   ├── templates/                      # Document templates (hld, lld, srs, tst, impl, sprint, contracts, agt, cr, supporting)
│   ├── worktrees/                      # Git worktree isolation directories
│   ├── hooks.json                      # Hook registration manifest
│   ├── settings.json                   # Project-level settings
│   └── settings.local.json             # Local settings override
├── agent_docs/                         # AI agent reference documentation
│   ├── architecture.md                 # Architecture overview
│   ├── domain-service-mapping.yaml     # Domain-to-service mapping
│   ├── hard-boundaries.md              # Hard boundary specifications
│   ├── roadmap.md                      # Roadmap for PaymentApp
│   ├── contracts/                      # API conventions and event schemas
│   │   ├── api-conventions.md
│   │   └── events.md
│   ├── features/                       # Feature requirement specs (FR-T-003)
│   ├── tech-design/                    # Per-service technical design
│   └── backend/sanitizer-service/      # Sanitizer service impl and test specs
├── docs/                               # User-facing documentation
│   ├── architecture/                   # Architecture docs with ADRs and diagrams
│   │   ├── system-architecture.md
│   │   ├── ADRs/                       # 3 ADRs (service decomposition, API conventions, event taxonomy)
│   │   └── diagrams/                   # Mermaid diagrams (system context, container, data flow)
│   ├── skill-testing.md                # Skill testing documentation
│   └── superpowers/                    # Plans and specs for superpowers feature
├── projects/                           # Reference sub-projects
│   └── sanitizer-service/              # Python utility: email validation + input sanitization
│       ├── src/sanitizer.py            # Core implementation (validate_email, sanitize_input)
│       ├── tests/                      # pytest test suite
│       ├── docs/                       # Architecture + product docs (SRS, ADRs, diagrams)
│       ├── agent_docs/                 # Agent-oriented docs (features, contracts, tech-design)
│       └── frontend/                   # React EmailInput component
├── evals/                              # Evaluation-driven development
│   ├── explore-codebase/               # Eval configs for explore-codebase skill
│   └── orchestrator/                   # Eval configs for orchestrator skill
├── scripts/                            # Utility scripts
│   └── validate-output-path.sh         # Hook validation script
└── .work/                              # Working artifacts
    ├── board.md                        # Sprint board
    ├── backlog.md                      # Sprint backlog
    ├── reports/                        # Scout reports and exploration outputs
    └── plans/                          # Execution plans
```

## 4. Modules and Responsibilities

| Module | Responsibility | Key Dependencies |
|--------|---------------|-----------------|
| `.claude/skills/` (14 skills) | Agent Skills - instructions for Claude to execute specific tasks | `.claude/agents/` for SDLC phase agents |
| `.claude/agents/` (11 agents) | SDLC sub-agents for design phases (SRS, HLD, LLD, IMP, TST) + gate-verifier + sprint-master + TDD agents | Skills provide orchestration |
| `.claude/hooks/` | Automation hooks triggered by Claude events | settings.json for registration |
| `.claude/templates/` (30 templates) | Document templates for all SDLC phases, agents, contracts, sprint, code review | Agents use them as defaults |
| `agent_docs/` | Reference docs for AI agents (architecture, features, contracts, tech-design, hard boundaries) | None |
| `docs/` | User-facing architecture documentation with ADRs and diagrams | None |
| `evals/` | Evaluation system for skill testing and benchmarking | Skills under test |
| `projects/sanitizer-service/` | Reference Python implementation of email validation + input sanitization utility | pytest for testing |
| `scripts/` | Shell utilities for validation | None |
| `.work/` | Runtime artifacts (board, backlog, plans) | agent_docs, skills |

## 5. Entry Points

| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| CLAUDE.md | Markdown | `CLAUDE.md` | Project instructions and conventions for Claude |
| Settings | JSON | `.claude/settings.json` | Project-level Claude Code settings with hook registration |
| Hooks config | JSON | `.claude/hooks.json` | Hook event bindings (SessionStart → ensure-claude-md) |
| Skills directory | Directory | `.claude/skills/` | 14 Agent Skills, each with SKILL.md + references |
| sanitizer entry | Python | `projects/sanitizer-service/src/sanitizer.py` | `validate_email()`, `sanitize_input()`, `validate_not_empty()` |

## 6. Dependencies

### Internal Dependencies

| Module | Depends On | Relationship |
|--------|-----------|-------------|
| Skills (explore-codebase, orchestrator) | `.claude/agents/` | Skills spawn agents via Agent() tool |
| Skills (all) | `.claude/templates/` | Agents use templates as default output format |
| Hooks | `.claude/settings.json` | Registered via settings hook config |
| Eval | Skills | Tests skill behavior empirically |
| agent_docs | SDLC pipeline | Generated by SRS→HLD→LLD→IMP→TST agents |
| sanitizer-service | pytest | Test framework dependency |
| sanitizer-service | Python stdlib (re, html, unicodedata) | Standard library only, no third-party packages |

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Claude Code CLI | N/A | Plugin host and execution environment |
| Git | 2.x | Version control, worktree management |
| Bash | 5.x | Hook script execution |
| Python | 3.x | Runtime for sanitizer-service reference project |

## 7. Architectural Patterns

**Plugin Architecture**: The project follows Claude Code's plugin architecture with skills in `.claude/skills/` and agent definitions in `.claude/agents/`. No `.claude-plugin/plugin.json` manifest found -- plugin structure is implicit.

**SDLC Pipeline Pattern**: Skills spawn SDLC sub-agents (SRS, HLD, LLD, IMP, TST) in a sequential pipeline with gate verification between phases. Each phase produces structured documentation consumed by subsequent phases. This is a document-driven SDLC approach.

**Skill-Based Orchestration**: Skills act as orchestrators that spawn specialized sub-agents. Skills provide workflow logic; agents provide domain expertise. Skills use frontmatter to control invocation behavior (disable-model-invocation, user-invocable).

**Agent Brief Pattern**: Agents receive input-only briefs (Context + Inputs + Task + Constraints) without output paths. Agents determine their own output locations based on default templates in `.claude/templates/`.

**Gate Verification Pattern**: Each SDLC phase is followed by a gate-verifier agent that checks outputs against published criteria. Rejected phases trigger re-spawn with feedback (max 3 re-spawns).

**Evaluation-Driven Development**: Skills are tested empirically using evaluation infrastructure with Quick Workflow and Full Pipeline modes. Results stored in `evals/<skill-name>/workspace/iteration-N/`.

**Template-Driven Output**: 30 templates across 10 categories ensure consistent document structure for all SDLC artifacts, from SRS through TST, plus sprint, contracts, code review, and agent routing.

**Data Flow**: Human input → Skill (orchestrator) → Scout → Plan → SDLC Agents → Gate Verifiers → Sprint Integration → Summary. All agents read shared scout reports as foundational input.

**Utility Function Pattern** (sanitizer-service): Pure functions with zero I/O, zero state, zero side effects. In-process library pattern -- no network, no database, no filesystem. Single-file Python module.

## 8. Skills Inventory

| Skill | Version | Purpose |
|-------|---------|---------|
| ask-user-question | N/A | Interactive user input for skills |
| debugging | N/A | Systematic debugging with root cause analysis |
| explore-codebase | 2.0.0 | End-to-end SDLC documentation generation |
| git | N/A | Git operations with conventional commits |
| hook-creator | 2.4.0 | Create/validate Claude Code plugin hooks |
| orchestrator | N/A | Orchestration of multi-agent workflows |
| plugin-creator | 1.7.0 | Create/validate Claude Code plugins |
| problem-solving | N/A | Creative problem-solving techniques |
| sequential-thinking | N/A | Step-by-step analysis for complex problems |
| skill-composer | 2.7.0 | Create Claude Code skills from scratch |
| skill-refiner | 1.4.0 | Improve existing Claude Code skills |
| skill-tester | 1.1.0 | Test and benchmark Claude Code skills |
| sprint | N/A | Manage roadmap, backlog, and board |
| subagent-creator | 1.4.0 | Create/validate Claude Code subagents |

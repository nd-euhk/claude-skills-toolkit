# ADR-001: Service Decomposition

## Context

The toolkit codebase contains 14 Agent Skills, 11 SDLC sub-agents, hooks, templates, evaluation infrastructure, sprint artifact management, and a reference sub-project (sanitizer-service). These components could be organized as:
- A single monolithic plugin with all skills and agents bundled together
- Separate independent plugins for each domain (SDLC pipeline, skill authoring, component authoring)
- The current plugin-based modular architecture with skill-per-domain and agent-based delegation

The decomposition must balance development velocity, component independence, and plugin framework constraints (Claude Code's plugin architecture requires `.claude/skills/` and `.claude/agents/` directories).

## Decision

**We will use skill-per-domain decomposition with agent-based delegation within a single plugin.**

Each skill owns exactly one domain responsibility:
- `explore-codebase` -- SDLC doc generation pipeline
- `orchestrator` -- multi-agent workflow orchestration
- `sprint` -- roadmap/backlog/board management
- `skill-composer` -- create new skills
- `skill-refiner` -- improve existing skills
- `skill-tester` -- test and benchmark skills
- `plugin-creator` -- plugin creation and publishing
- `hook-creator` -- hook creation and validation
- `subagent-creator` -- subagent creation and validation
- 5 support skills -- cross-cutting utilities

SDLC sub-agents (SRS, HLD, LLD, IMP, TST, gate-verifier) are specialized workers spawned by skills. They do not own domain logic; they execute domain-specific tasks delegated by skills.

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| Single plugin, skill-per-domain (chosen) | Matches Claude Code plugin architecture; skills are independently invocable; clear ownership boundaries; templates can be shared | Knowledge duplication between plugin-creator and component skills (documented limitation); versioning must be coordinated |
| Monolithic single skill | Simple; no coordination overhead | Impossible to decompose SDLC pipeline; exceeds Claude Code context window limits; no independent invocation |
| Separate plugins per domain | Maximum isolation; independent versioning | Plugin discovery overhead; template sharing impossible; cross-skill delegation (Skill() tool) breaks; violates bounded scope principle |

## Consequences

### Positive
- Each skill is independently invocable via `/command` or auto-trigger
- Clear domain boundaries mapped to individual skills
- Shared templates enable consistent output across the SDLC pipeline
- Agents can be reused across skills (e.g., gate-verifier used by both explore-codebase and orchestrator)

### Negative
- Knowledge duplication: `plugin-creator` includes summaries of skill/subagent/hook knowledge that overlap with specialist skills (documented in CLAUDE.md as Bounded Scope Principle)
- Version coordination: bumping one skill requires plugin version bump
- Cross-skill delegation: `Skill()` tool must be used for skill-to-skill communication

### Risks
- Context window pressure: loading multiple skills simultaneously could exceed Claude Code's context limit -> Mitigation: skills use progressive disclosure (references/ loaded on-demand)
- Duplication drift: summaries in plugin-creator could diverge from specialist skills -> Mitigation: CLAUDE.md explicitly documents this as a known limitation with a future improvement path

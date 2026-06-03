# Hard Boundaries

## Data Ownership

| Service | Owns (Read+Write) | Others Can Read | Others Cannot Access |
|---------|-------------------|-----------------|---------------------|
| explore-codebase | Pipeline config, agent briefs, scout reports | Agents read scout reports as input | Sprint artifacts (use sprint skill) |
| sprint | Roadmap, backlog, board (.work/) | All skills can read | No skill may write directly |
| skill-composer | Skill creation patterns, templates | plugin-creator reads summaries | No other skill edits |
| skill-refiner | Quality standards, checklists | plugin-creator reads summaries | No other skill edits |
| skill-tester | Test cases, benchmarks, workspaces | None | Only skill-tester writes evals |
| plugin-creator | Plugin manifest, directory layout | None | Component-specific details |
| hook-creator | Event matchers, decision schemas | plugin-creator reads summaries | No other skill edits |
| subagent-creator | Tool scoping, permission modes | plugin-creator reads summaries | No other skill edits |
| All support skills | Own patterns/frameworks | All skills consume | No writes from other skills |

## Forbidden Shortcuts

1. **NEVER modify sprint files directly** -- always use `Skill(sprint)`
2. **NEVER modify files in `agent_docs/`, `.claude/`, `CLAUDE.md`** without following the proper pipeline
3. **NEVER create skill-level changelogs** -- all changelog entries go in root `CHANGELOG.md`
4. **NEVER compare plugin version to skill version** -- they are independent tracking systems
5. **NEVER eliminate knowledge duplication between plugin-creator and specialist skills** -- this is documented Bounded Scope Principle
6. **NEVER write output paths in agent briefs** -- agents determine their own output locations
7. **NEVER skip gate verification** in SDLC pipeline phases
8. **NEVER exceed 3 re-spawns** per phase on gate rejection
9. **NEVER push/merge** -- agents commit local only, human merges
10. **NEVER create services without clear data ownership** -- every skill owns specific data

## Cross-Boundary Rules

### How to request data owned by another skill

1. **Sprint data**: Use `Skill(sprint)` with context, never Read sprint files directly for modification
2. **Skill patterns**: Read the specialist skill's SKILL.md if you need to understand its patterns
3. **Architecture decisions**: Read `docs/architecture/ADRs/` -- they are canonical
4. **Template formats**: Read from `.claude/templates/` -- do not hardcode template structure

### Communication across boundaries

- **Skill -> Skill**: `Skill(skill-name)` invocation with context/arguments
- **Skill -> Agent**: `Agent(agent-name)` with structured brief (Context, Inputs, Task, Constraints)
- **Agent -> Agent**: Never direct. Always mediated through the spawning skill
- **Hook -> Runtime**: Shell command execution triggered by lifecycle events

## Version Management Rules

1. Plugin version MUST be bumped when any skill/hook/subagent changes
2. Skill versions are independent from plugin version -- never compare them
3. PATCH: bug fixes, wording improvements
4. MINOR: new capabilities, expanded tool access
5. MAJOR: breaking changes to behavior or interface

## Bounded Scope Principle

Knowledge duplication between plugin-creator and specialist skills is intentional. It follows Claude's official architecture where each skill must be completely self-contained within its directory structure. Do not try to eliminate this duplication. It will be refactored when Claude implements `context: fork` skill execution.

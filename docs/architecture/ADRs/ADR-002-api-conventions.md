# ADR-002: API Conventions

## Context

The toolkit integrates components through several mechanisms:
- Skills invoke agents via `Agent()` tool calls with structured briefs
- Hooks trigger via Claude Code events (SessionStart, PreToolUse, PostToolUse, Stop)
- Skills invoke other skills via `Skill()` tool
- Agents read/write files on the filesystem using Read/Write/Edit tools
- Templates define output format for generated artifacts
- Eval infrastructure reads skill behavior and writes benchmark results

A unified API convention is needed to ensure consistency across all integration points.

## Decision

**We will use Skill frontmatter + Agent briefs as the inter-component contract, with file-based artifact output following template conventions.**

Integration conventions:
1. **Skill invocation**: Via frontmatter `description` field (auto-trigger) or `/skill-name` (user invocation). Frontmatter controls: `disable-model-invocation`, `user-invocable`.
2. **Agent briefs**: Structured pattern: Context -> Inputs -> Task -> Constraints. Briefs specify what agents READ, not where they WRITE. Agents determine output paths from their default templates.
3. **Agent output**: Agents write to files using default templates from `.claude/templates/`. The spawning skill can override template paths in the brief.
4. **Skill-to-skill**: `Skill(skill-name)` tool invocation with optional arguments string.
5. **Hooks**: Registered in `.claude/hooks.json` and `.claude/settings.json`. Event matchers specify trigger conditions. Decision schemas for prompt hooks.
6. **File artifacts**: All artifacts are markdown/yaml files. Frontmatter YAML block for metadata (title, status, created, dependencies, referenced_by, changelog).
7. **Error handling**: Gate verifier reports pass/fail with specific evidence. Agents report missing inputs and stop on critical failures.
8. **Versioning**: Each skill has independent semantic version in SKILL.md frontmatter. Plugin version in `.claude-plugin/plugin.json` tracks the aggregate.

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| Frontmatter + briefs + templates (chosen) | Aligns with Claude Code plugin conventions; agents have template-based consistency; briefs are human-readable; no custom schema needed | Agent output quality depends on template quality; no runtime contract validation |
| OpenAPI/Swagger-style spec | Machine-validatable; well-known standard | Claude Code skills/agents are not HTTP services; OpenAPI is over-engineered for file-based interop |
| Custom YAML DSL for every interaction | Maximum flexibility | Every integration point needs a custom parser; no tooling support; steep learning curve |

## Consequences

### Positive
- Consistent output format through shared templates
- Skills and agents are loosely coupled (file-based contract)
- Frontmatter provides discoverable metadata for every artifact
- Brief pattern is simple enough for agents to parse reliably

### Negative
- No runtime validation of agent output against template schema
- File paths are convention-based, not enforced by tooling
- Template changes require coordination with all consuming agents
- Agent briefs are prose, not machine-validatable

### Risks
- Template drift: agents may deviate from templates -> Mitigation: gate-verifier checks output structure
- Path conventions undocumented: new agents may write to wrong locations -> Mitigation: HLD agent defines output paths; gate-verifier verifies file existence

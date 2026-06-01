# Shared Template Architecture for Subagents

**Date**: 2026-06-01
**Status**: approved
**Context**: Orchestrator skill spawning SDLC subagents (srs, hld, lld, imp, tst, sprint)

## Problem

Templates for output format (FR-TEMPLATE, impl-spec-TEMPLATE, test-spec-TEMPLATE, etc.) were stored inside the orchestrator skill at `orchestrator/templates/`. However:

- Subagents are **shared resources** — multiple skills spawn them, not just orchestrator
- Templates need to be a **project-wide standard** — not owned by any single skill
- Each subagent had no internal knowledge of what template to use — relying solely on spawn prompts

## Decision: Hybrid Template Resolution (Approach C)

**Convention over configuration, with escape hatches.**

### Three components:

1. **Shared template location**: `.claude/templates/` — single source of truth for all output templates
2. **Default in subagent**: Each subagent defines its default template paths in a `## Templates` section
3. **Override via spawn**: Skills can override the default by specifying a template path in the spawn prompt

### Resolution rule:
```
template_path = spawn_prompt_template || subagent_default
```

## Architecture

```
.claude/templates/                  # Shared templates (project-wide)
├── srs/
│   ├── FR-TEMPLATE.md
│   ├── SRS-TEMPLATE.md
│   └── requirements-matrix-TEMPLATE.md
├── impl/
│   ├── impl-spec-backend-TEMPLATE.md
│   ├── impl-spec-frontend-TEMPLATE.md
│   └── migration-spec-TEMPLATE.md
├── tst/
│   ├── test-spec-backend-TEMPLATE.md
│   └── test-spec-frontend-TEMPLATE.md
├── contracts/
│   ├── error-codes-TEMPLATE.md
│   └── events-TEMPLATE.md
├── agt/
│   ├── agent-routing-TEMPLATE.md
│   ├── AGENTS-TEMPLATE.md
│   ├── roadmap-TEMPLATE.md
│   └── feature-index-TEMPLATE.md
└── cr/
    └── CR-TEMPLATE.md

.claude/agents/                     # Subagents with template defaults
├── srs.md          → ## Templates: FR-TEMPLATE, SRS-TEMPLATE, requirements-matrix
├── hld.md          → ## Templates: agent-routing-TEMPLATE (routing overlay), events-TEMPLATE
├── lld.md          → ## Templates: feature-index-TEMPLATE (work packages)
├── imp.md          → ## Templates: impl-spec-backend/frontend, migration-spec
├── tst.md          → ## Templates: test-spec-backend/frontend
└── sprint.md       → ## Templates: roadmap, feature-index, agent-routing, AGENTS

orchestrator/references/agent-brief-templates.md  # Simplified briefs
```

## Template Section Format (in subagents)

```markdown
## Templates

Default templates for output format. Use these unless the spawning skill specifies otherwise.

| Output | Template |
|--------|----------|
| FR file | `.claude/templates/srs/FR-TEMPLATE.md` |
| SRS | `.claude/templates/srs/SRS-TEMPLATE.md` |

**Override rule**: If the spawn prompt specifies a different template path, use that instead.
```

## Spawn Examples

### Default (no override needed):
```
Agent(srs, prompt: "Context: Task FOO-001... Output: Write SRS")
# → agent uses .claude/templates/srs/SRS-TEMPLATE.md automatically
```

### Override:
```
Agent(srs, prompt: "... Use template at custom-templates/special-srs.md")
# → agent uses the custom template instead
```

## Advantages

- **Single source of truth**: Template paths defined once per subagent
- **Zero duplication**: Any skill can spawn any subagent without knowing template paths
- **Backward compatible**: Existing spawn prompts still work (agent uses defaults)
- **Override capability**: Edge cases can use custom templates when needed

## Trade-offs

- Subagent definitions are now coupled to `.claude/templates/` path convention
- Requires template directory to exist before subagent runs
- Adding a new template type requires updates in two places (template file + subagent ## Templates section)

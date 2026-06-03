# API Conventions

## Agent Brief Format

Agent briefs follow a structured format:

```
Context: <what project/phase this is about>
Inputs:
  - <list of files/artifacts to read>
Task: <what the agent should do>
Constraints: <rules the agent must follow>
```

Briefs specify what agents READ, not where they WRITE. Agents determine output paths from their default templates.

## Skill Invocation

### Frontmatter Convention

```yaml
---
name: skill-name                    # lowercase, hyphens, <=64 chars
description: >-                     # <=1024 chars, specific trigger phrases
  What the skill does. Use when [trigger contexts/phrases].
version: 1.0.0                      # Optional: semantic version
allowed-tools: Read,Write,Bash(*)   # Optional: principle of least privilege
disable-model-invocation: true      # Optional: only users can invoke
user-invocable: false               # Optional: only Claude can invoke
---
```

### Invocation Controls

| Setting | Behavior |
|---------|----------|
| (default) | Both Claude and users can invoke; skill auto-activates on trigger |
| `disable-model-invocation: true` | Only users can invoke (e.g., `/deploy`, `/commit`) |
| `user-invocable: false` | Only Claude can invoke (background context skills) |

## File Artifact Convention

### Frontmatter (YAML block at top of every .md artifact)

```yaml
---
title: "Document Title"
status: draft | review | approved | current
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
updated_by: "author identifier"
depends_on:
  - path/to/dependency.md
referenced_by:
  - path/to/consumer.md
changelog:
  - 1.0 | YYYY-MM-DD | Description of change
---
```

### Status Values

| Status | Meaning |
|--------|---------|
| draft | Work in progress, not reviewed |
| review | Ready for gate verification |
| approved | Passed gate verification |
| current | Active and authoritative |
| deprecated | Superseded by newer artifact |
| superseded | Replaced by another artifact |

## Template Override Convention

Agents use default templates from `.claude/templates/{phase}/`. A spawning skill can override by specifying a different template path in the agent brief:

```
Override templates:
  - {output-type}: {path-to-alternative-template}
```

## Error Handling Convention

### Agent Errors

- Missing required input: Agent stops, reports to spawning skill
- Codebase exploration failure: Agent reports inability to gather needed info
- Write failure: Agent retries once, then reports error

### Gate Verification

- Pass: Agent reports "PASS" with evidence checklist
- Reject: Agent reports "REJECT" with specific issues and evidence
- Re-spawn max: 3 per phase. After 3: stop pipeline, report to human

## Versioning Convention

- **Skill version**: Independent semantic version in SKILL.md frontmatter
- **Plugin version**: Aggregate semantic version in `.claude-plugin/plugin.json`
- **Bump rule**: Any skill change -> plugin version bump (PATCH/MINOR/MAJOR matching)
- **CHANGELOG location**: Root `CHANGELOG.md` only; format: `- **skill-name X.Y.Z:** description`

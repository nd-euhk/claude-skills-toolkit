# Event Conventions

## Event Naming Convention

Events follow a `category:action:target` pattern:

```
{category}:{action}:{target}
```

### Categories

| Category | Source | Examples |
|----------|--------|----------|
| `session` | Claude Code runtime | `session:start`, `session:stop` |
| `tool` | Claude Code runtime | `tool:pre:Write`, `tool:post:Bash` |
| `phase` | SDLC pipeline skills | `phase:enter:HLD`, `phase:exit:IMP` |
| `gate` | gate-verifier agent | `gate:pass:SRS`, `gate:reject:HLD` |
| `pipeline` | explore-codebase/orchestrator | `pipeline:complete`, `pipeline:abort` |
| `skill` | Any skill | `skill:invoke:explore-codebase` |
| `agent` | Any skill spawning agent | `agent:spawn:hld`, `agent:error:tst` |

## Event Envelope Structure

```yaml
event:
  id: "evt-{uuid}"
  type: "category:action:target"
  timestamp: "YYYY-MM-DDTHH:mm:ssZ"
  source:
    skill: "skill-name"
    agent: "agent-name"  # if spawned by agent
  payload:
    phase: "SRS|HLD|LLD|IMP|TST"  # for pipeline events
    status: "pass|reject"          # for gate events
    attempt: 1-3                   # for gate re-spawn tracking
    message: "human-readable"
```

## Publishing and Subscribing Rules

### Lifecycle Events (Claude Code Runtime)

- **Publisher**: Claude Code runtime
- **Subscriber**: Hooks registered in `hooks.json` and `settings.json`
- **Guarantee**: At-most-once delivery to hooks
- **Ordering**: Sequential within session

### Pipeline Events (SDLC Skills)

- **Publisher**: explore-codebase / orchestrator skills
- **Subscriber**: Gate-verifier agent, sprint-master agent
- **Guarantee**: Sequential execution (no concurrent phases)
- **Ordering**: Strict linear order: SRS -> HLD -> LLD -> IMP+TST

### Skill Trigger Events

- **Publisher**: Claude Code runtime (on skill invocation)
- **Subscriber**: Skill's SKILL.md body is loaded into context
- **Guarantee**: On-demand loading
- **Ordering**: N/A (stateless trigger)

## Event Routing

| Event | Handler | Action |
|-------|---------|--------|
| `session:start` | `ensure-claude-md.sh` hook | Load CLAUDE.md into context |
| `tool:pre:Write\|Edit` | `validate-output-path.sh` hook | Validate output target path |
| `phase:exit:{phase}` | explore-codebase skill | Spawn gate-verifier agent |
| `gate:reject:{phase}` | explore-codebase skill | Re-spawn phase agent with feedback |
| `gate:pass:{phase}` | explore-codebase skill | Proceed to next phase |
| `pipeline:complete` | explore-codebase skill | Trigger sprint integration + summary |

## Gate Verification Re-Spawn Protocol

1. `phase:exit:{X}` -> spawn `gate-verifier`
2. If `gate:reject:{X}` -> re-spawn `{X}` agent with: `"RETRY #{N}: Previous attempt rejected. Gate feedback: {exact message}. Fix these specific issues."`
3. Max 3 re-spawns per phase
4. After 3 rejections: `pipeline:abort` with rejection summary
5. If `gate:pass:{X}` -> proceed to next phase

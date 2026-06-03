# ADR-003: Event Taxonomy

## Context

The toolkit uses Claude Code's built-in event system for hook-driven automation. Claude Code provides lifecycle events (SessionStart, PreToolUse, PostToolUse, Stop) and tool-level events (Write, Edit, Bash, Read). The toolkit also has internal phase transitions in its SDLC pipeline (SRS->HLD->LLD->IMP->TST->Sprint) and gate verification events (pass/reject). A taxonomy is needed to ensure consistent naming, handling, and routing.

## Decision

**We will classify events into three categories: Claude Code Lifecycle Events (external), SDLC Pipeline Events (internal), and Skill Trigger Events (activation).**

### Event Taxonomy

**Category 1: Claude Code Lifecycle Events** (defined by Claude Code runtime)
- `SessionStart` -- New session begins. Hook: `ensure-claude-md.sh` loads CLAUDE.md.
- `PreToolUse` -- Before a tool executes. Used for validation hooks (e.g., validate output paths).
- `PostToolUse` -- After a tool executes. Used for notification hooks.
- `Stop` -- Session ends. Used for cleanup hooks.

**Category 2: SDLC Pipeline Events** (internal, skill-defined)
- `phase:enter:{phase}` -- Agent begins an SDLC phase (SRS, HLD, LLD, IMP, TST)
- `phase:exit:{phase}` -- Agent completes an SDLC phase
- `gate:pass:{phase}` -- Gate verification passed
- `gate:reject:{phase}` -- Gate verification rejected (triggers re-spawn)
- `pipeline:complete` -- Full SDLC pipeline finished
- `pipeline:abort` -- Pipeline stopped (error or max retries exceeded)

**Category 3: Skill Trigger Events** (activation, skill-defined)
- `skill:invoke:{skill-name}` -- Skill invoked by user or auto-trigger
- `skill:delegate:{skill-name}` -- Skill invoked by another skill via Skill() tool
- `agent:spawn:{agent-name}` -- Agent spawned by a skill
- `agent:error:{agent-name}` -- Agent terminated with error

### Event Routing

| Event Category | Routing | Handler |
|---------------|---------|---------|
| Lifecycle | `hooks.json` / `settings.json` event matchers | Shell hooks or prompt hooks |
| Pipeline | In-skill logic (sequential execution) | Phase transitions managed by orchestrator/explore-codebase skills |
| Trigger | Frontmatter `description` field | Claude Code skill discovery system |

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| Three-category taxonomy (chosen) | Clear boundaries between external and internal events; aligns with Claude Code's event model; simple to extend | Pipeline events are not enforceable by the runtime -- they rely on skill implementation discipline |
| Flat event list | Simple; no categorization overhead | No clear distinction between system and application events; naming collisions likely |
| Event sourcing with event store | Full audit trail; replay capability | Far too complex for a plugin toolkit; no persistent storage in the architecture |

## Consequences

### Positive
- Clear separation between Claude Code runtime events and toolkit-internal events
- Pipeline events enable structured gate verification and re-spawn logic
- Skill trigger events document the invocation chain for debugging

### Negative
- Pipeline events are convention-based, not enforced by the runtime
- No event persistence -- events exist only during session execution
- Event naming is manual (no schema validation)

### Risks
- Skill developers may not consistently emit pipeline events -> Mitigation: SDLC skills (explore-codebase, orchestrator) hardcode the pipeline sequence
- Event naming drift over time -> Mitigation: this ADR serves as the canonical taxonomy reference

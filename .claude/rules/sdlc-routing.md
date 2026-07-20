# SDLC Routing

Map user intent to the correct SDLC flow and entry point. Resolve against the
runtime's live installed-skill catalog — never hardcode a skill name that may
differ across installations.

## Intent → Flow Resolution

Match the user's primary intent to a flow, not a keyword. Same intent expressed
in different words should resolve to the same flow.

| User intent | Flow | What it triggers |
|-------------|------|-------------------|
| Build a new feature, greenfield work, major change, create specs from scratch | `task` | Full forward pipeline: SRS → HLD → LLD → CROSS-CUTTING → IMP∥TST |
| Change existing behavior, modify a feature, update specs for existing code | `cr` | Impact analysis + selective re-spec: scout → analyze → re-spec affected phases |
| Fix a defect, repair broken behavior, resolve a bug | `fixbug` | Root-cause diagnosis + targeted fix: scout → diagnose → fix → verify |
| Write code from ready specs, implement from agent_docs, execute TDD cycle | `cook` | TDD execution: baseline → per-TC RED→GREEN→INTERFERENCE→REFACTOR→GATE |
| Reverse-engineer specs from an existing codebase, document what code does | `reverse` | Reverse pipeline: scout → HLD → LLD → SRS → VERIFY → CROSS-CUTTING → IMP∥TST |

## Entry Point Selection

After flow is determined, route to the correct entry point skill based on how
much human involvement the situation calls for.

| Situation | Entry point |
|-----------|-------------|
| New domain, unclear requirements, high-risk change, or human wants to review each phase | **orchestrator** — human-in-the-loop at every phase gate |
| Requirements are well-understood, human wants one upfront interview then autonomous execution | **automation** — grill once, dispatch workflow, monitor |
| Change is bounded to ≤2 files, no API/schema/security/auth/billing impact, no new service boundary | **quick** — triage grill, guard test only, GATE-light |

## Priority Rules

When intent is ambiguous or overlaps:

1. **Safety first** — if any signal suggests the task is NOT trivial, reject quick
2. **Evidence over assumption** — if you cannot confirm the scope from context, default to orchestrator
3. **Borderline always escalates** — "might be quick" = orchestrator; "might be cr" = task flow
4. **Explicit user request overrides inference** — if the user names a specific entry point, use it

## Resolution Procedure

1. Read the user's request and identify the primary intent
2. Match intent to a flow using the capability table above, not keyword grep
3. Assess human-involvement needs: domain familiarity, risk level, scope clarity
4. Select the entry point skill from the live installed-skill catalog
5. Load that skill's complete instructions before acting
6. If the selected skill is not installed, escalate to the next heavier entry point

# SDLC Orchestration

Protocol for spawning SDLC agents and coordinating parallel work. The entry
point skill is the controller — it grills, dispatches, and monitors. Agents
and workflows are the executors — they produce artifacts.

## Controller Responsibilities

The entry point skill (orchestrator, automation, quick) is the **only**
component that:

- Interacts with the human (grilling, confirmation, reporting)
- Makes flow routing decisions
- Dispatches agents and workflows
- Handles escalations
- Updates sprint artifacts (via `sprint` skill)

The controller **never**:
- Writes spec content, test cases, or implementation code directly
- Edits `agent_docs/features/` directly (only SRS/LLD agents touch these)
- Modifies sprint files directly (always through `sprint` skill)

## Agent Spawning Rules

When spawning phase agents:

1. **One agent per phase per domain** — fan out per-service or per-feature when parallel
2. **Provide exact file paths**, not "look around the repo"
3. **Include context from prior phase outputs** — the agent needs to know what was decided upstream
4. **Set clear acceptance criteria** — what files to read, what to produce, exit codes expected
5. **Use acceptEdits permission mode** for agents that write files
6. **Gate every agent output** — spawn gate agent after each phase agent completes

## Context Isolation

Agents receive what they need, not the full conversation:

- **Forward pipeline**: pass prior phase output file paths (SRS → HLD reads SRS outputs; HLD → LLD reads HLD outputs)
- **Reverse pipeline**: pass scout report + prior phase outputs
- **TDD agents**: pass TST spec + IMP spec for the current TC only
- **Cross-cutting agents**: pass architecture.md + per-service tech-design files
- **Never pass full conversation history** to a subagent

## Parallel Work Safety

Parallel agents are safe when their file ownership is disjoint:

| Safe to parallelize | Must serialize |
|---------------------|----------------|
| Per-service LLD agents (different service dirs) | SRS → HLD (HLD consumes SRS output) |
| Per-feature IMP agents (different feature files) | HLD → LLD (LLD consumes HLD output) |
| Per-domain SRS agents (different domain files) | LLD → LLD-Synthesis (synthesis consumes all LLDs) |
| IMP ∥ TST per feature (independent artifacts) | Cross-cutting after LLD (consumes all LLDs) |
| Per-TC TDD cycles (different test files) | RED → GREEN → REFACTOR within a TC (sequential) |
| Code review dimensions (7 independent analyses) | Synthesis after all dimensions complete |

## Workflow Dispatch

For autonomous execution (automation lane, reverse pipeline, review):

- Dispatch via `Workflow()` tool with structured args
- Workflow scripts live in `.claude/workflows/`
- Workflow handles its own agent fan-out internally
- Controller monitors workflow completion, does not micro-manage
- If a workflow fails, read its output before deciding to retry or escalate

## Status Protocol

After each phase agent completes, verify its output:

```
Phase: [SRS|HLD|LLD|...]
Status: DONE | DONE_WITH_CONCERNS | FAILED | BLOCKED
Artifacts: [file paths produced]
Concerns: [optional — anything the next phase should know]
```

- **DONE** → proceed to gate, then next phase
- **DONE_WITH_CONCERNS** → flag for human review at next gate
- **FAILED** → report to human, do not auto-retry
- **BLOCKED** → report the blocker, ask human for resolution

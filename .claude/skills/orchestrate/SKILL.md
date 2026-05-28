---
name: orchestrate
description: >-
  Orchestrate multi-phase SDLC workflows by delegating to specialized subagents.
  Use when implementing new features, handling change requests, running TDD/cook loops,
  debugging, fixing bugs, or reverse-engineering documentation from codebase.
  Pure orchestration - never explores, writes, or updates directly.
version: 1.0.1
allowed-tools: Read, AskUserQuestion, Agent, TaskCreate, TaskUpdate, TaskList
---

# Orchestrate

**CRITICAL RULE:** This skill is a PURE ORCHESTRATOR. Never explore code, write files, or update code directly. Every action delegates to a subagent. This prevents hallucination and ensures quality through specialization.

## Quick Start

### Step 1: Detect Task Type

Check the user's request for task signals. If the task type is ambiguous or no input provided, present the selection menu.

### Step 2: Present Selection Menu (if needed)

Use AskUserQuestion when the task type is unclear:

Ask: "What type of task is this?" (header: "Task Type")
Options:
- "New Feature" - Full SDLC phases 05-10, spec → design → impl spec → test spec → agent setup
- "Change Request" - Modify existing feature: re-spec, update design if needed, update board
- "Cook (TDD Loop)" - Direct TDD implementation: RED → GREEN → REFACTOR
- "Debug / Fix Bug" - Reproduce → test → fix → verify
- "Explore / Reverse Engineer" - Extract docs (HLD, LLD, SRS) from existing codebase

### Step 3: Route to Workflow

| Task Type | Workflow Reference | Primary Subagents |
|-----------|-------------------|-------------------|
| New Feature | `references/new-feature-workflow.md` | srs-specifier, hld-architect, lld-designer, imp-specifier, tst-specifier, agt-configurator |
| Change Request | `references/change-request-workflow.md` | imp-specifier, tst-specifier, agt-configurator (+ hld-architect, lld-designer if design changes) |
| Cook (TDD) | `references/cook-workflow.md` | implementer, test-writer, reviewer |
| Debug/Fix Bug | `references/debug-workflow.md` | Explore agent, test-writer, implementer |
| Explore/Reverse | `references/explore-workflow.md` | Explore agent, hld-architect, lld-designer, srs-specifier |

## Core Orchestration Pattern

Every phase follows this pattern:

```
1. DELEGATE work to specialized subagent
2. WAIT for subagent to complete
3. GATE REVIEW: Delegate verification to a DIFFERENT subagent
4. If gate PASSES → proceed to next phase
5. If gate FAILS → report gaps, re-delegate to original subagent for fixes
```

**Gate review is MANDATORY between every phase.** The reviewing subagent must be different from the one that produced the work.

## Gate Review Protocol

After every phase completion, run a gate review. See `references/gate-review.md` for detailed checklists per phase.

Quick pattern:
```
Agent type: <reviewer subagent>
Prompt: "Review the output of <phase> produced by <subagent>.
Gate criteria: <specific checklist>.
Report: PASS with minor notes / PASS with warnings / FAIL with required fixes.
If FAIL: list exactly what must be fixed before proceeding."
```

CRITICAL: Never skip gate review. Never use the same subagent type for both producing and reviewing the same phase.

## Task Selection Details

### New Feature

User signals: "implement", "build", "create feature", "new feature", "add", "develop"
Full flow: SRS (05) → HLD (06) → LLD (07) → IMP (08) → TST (09) → AGT (10)
Each phase has mandatory gate review before proceeding.

### Change Request

User signals: "change", "update", "modify", "adjust", "revise", "enhance"
Focuses on phases 08-10 (re-spec, re-test, update board).
If the change affects architecture (new services, new APIs, data model changes), also update phases 06-07.
If the original feature was marked "done" on the board, reopen it.

### Cook (TDD Loop)

User signals: "cook", "implement with TDD", "tdd", "red green refactor"
Direct implementation following TDD cycle. Best for features with complete specs (phases 05-09 done).

### Debug / Fix Bug

User signals: "debug", "fix", "bug", "broken", "error", "issue", "not working"
Reproduce → isolate → failing test → fix → verify → report.

### Explore / Reverse Engineer

User signals: "explore", "reverse engineer", "extract docs from", "document the codebase", "generate architecture from code"
Extract documentation (HLD, LLD, SRS) from existing code. Assess existing spec-test docs and supplement if missing.

## Subagent Catalog

These subagents are available for delegation. Scout the `../ai-agentic-starter-kit/.claude/agents/` and `.claude/agents/` directories for the full catalog.

### Spec & Design Agents
| Subagent | Phase | Produces |
|----------|-------|----------|
| srs-specifier | 05 (SRS) | FRs with Gherkin, NFRs, traceability matrix |
| hld-architect | 06 (HLD) | C4 diagrams, ADRs, domain-service-mapping, contracts |
| lld-designer | 07 (LLD) | Per-service tech design, OpenAPI contracts, work packages |

### Implementation Agents
| Subagent | Phase | Produces |
|----------|-------|----------|
| imp-specifier | 08 (IMP) | Decision-rich impl specs, migration specs |
| tst-specifier | 09 (TST) | Test specs at 7 layers |
| agt-configurator | 10 (AGT) | AGENTS.md, routing tables, board/backlog, health checks |

### Execution Agents (from ai-agentic-starter-kit)
| Subagent | Role | Produces |
|----------|------|----------|
| implementer | Write code | Implementation following impl spec |
| test-writer | Write tests | Failing tests from test spec + FR spec |
| reviewer | Review code | Architecture compliance, quality report |

### Support Agents
| Subagent | Role |
|----------|------|
| Explore | Scout codebase, find files, understand structure |
| component-validator | Structural validation of plugin components |
| skill-reviewer | Independent skill quality review |

## Agent Tool Availability Check (MANDATORY before every delegation)

**Before ANY delegation, verify Agent tool is available.** The Agent tool only exists in the main Claude session — spawned subagents CANNOT spawn further subagents.

### Check Pattern

```
1. Attempt to use Agent tool
2. If Agent tool IS available → delegate normally (standard flow)
3. If Agent tool is NOT available → ESCALATE to leader/parent (see below)
```

### When Agent Tool is NOT Available: Escalation Pattern

**CRITICAL: Never fall back to direct Write/Bash/Glob/Grep.** This violates pure orchestration and causes the exact hallucination/quality problems the skill is designed to prevent.

Instead, escalate to the parent/leader:

```
1. PAUSE the workflow
2. Use SendMessage to the leader/parent agent:
   "Need subagent: <subagent-type> for task: <task description>.
   Phase: <current phase>. Context: <what's needed>."
3. WAIT for leader to spawn the subagent and return results
4. RESUME workflow with the results
```

**Why this matters:** Falling back to direct work when Agent tool is unavailable defeats the skill's purpose. The orchestrator's value IS delegation — without it, you're just another agent doing direct work with no quality guarantees.

Full escalation protocol details: `references/escalation-pattern.md`

## Safety Rules

1. **Check Agent availability first** — Before any phase, verify Agent tool exists
2. **Never self-execute** — If a subagent can do it, delegate it; if you can't delegate, escalate
3. **Never fall back to direct work** — No Agent tool = escalate to leader, don't Write/Bash yourself
4. **Gate every phase** — No phase completes without independent review
5. **Different reviewer** — The gate reviewer is never the same subagent type as the producer
6. **Fail fast** — If a gate fails, fix before proceeding (don't stack broken phases)
7. **Read-only scouting** — Use Explore agent for all codebase exploration; if unavailable, escalate
8. **Agent isolation** — test-writer never reads impl code; implementer never modifies tests

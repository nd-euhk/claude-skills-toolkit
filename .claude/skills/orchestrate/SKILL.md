---
name: orchestrate
description: >-
  Orchestrate multi-phase SDLC workflows by delegating to specialized subagents.
  Use when implementing new features, handling change requests, running TDD/cook loops,
  debugging, fixing bugs, or reverse-engineering documentation from codebase.
  Pure orchestration - never explores, writes, or updates directly.
version: 2.1.0
allowed-tools: Read, AskUserQuestion, Agent, TaskCreate, TaskUpdate, TaskList, EnterPlanMode, ExitPlanMode
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
- "Sprint Management" - Manage roadmap, backlog, board (delegates to sprint skill)

### Step 3: Route to Workflow

| Task Type | Workflow Reference | Primary Subagents |
|-----------|-------------------|-------------------|
| New Feature | `references/new-feature-workflow.md` | srs-specifier, hld-architect, lld-designer, imp-specifier, tst-specifier, agt-configurator |
| Change Request | `references/change-request-workflow.md` | imp-specifier, tst-specifier, agt-configurator (+ hld-architect, lld-designer if design changes) |
| Cook (TDD) | `references/cook-workflow.md` | implementer, test-writer, reviewer |
| Debug/Fix Bug | `references/debug-workflow.md` | Explore agent, test-writer, implementer |
| Explore/Reverse | `references/explore-workflow.md` | Explore agent, hld-architect, lld-designer, srs-specifier |
| Sprint Management | sprint skill (Skill tool) | Delegates all roadmap/backlog/board operations to sprint skill |

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

## Plan Mode Protocol (Pre-Execution Planning)

**Applies to these workflows:** New Feature, Change Request, Explore/Reverse Engineer

Before executing any phase, the orchestrator MUST enter plan mode to produce an orchestration plan and get human sign-off. This prevents wasted work on incorrect assumptions.

### Plan Mode Flow

```
1. EnterPlanMode — enter plan mode (read-only, no writes)
2. DELEGATE to Plan subagent — analyze scope and create orchestration plan
3. DELEGATE to general-purpose:sonnet — write plan to .work/plans/YYYYMMDD/
4. RAISE human confirmation — present plan for approval
5. ExitPlanMode — exit plan mode (only after human confirms)
6. Execute — proceed with SDLC phases per the approved plan
```

### Plan Mode Protocol Details

**Step 1: Enter Plan Mode**

```
EnterPlanMode
```

This puts the session into plan mode, restricting writes. The orchestrator can only read, ask questions, and delegate.

**Step 2: Delegate to Plan Subagent**

```
Agent type: Plan
Prompt: "Analyze the <workflow-type> request and create a comprehensive orchestration plan.

Task: <user's task description>
Workflow: <new-feature | change-request | explore>
Scope: <what needs to be done>

Plan should include:
1. Task breakdown: each phase with clear inputs/outputs
2. Subagent assignments: which specialized agent per phase
3. Dependencies: what must complete before what
4. Gate review assignments: different reviewer per phase
5. Output paths: where each phase's output goes
6. Timeline estimate: phases and expected complexity

Report the plan in structured format ready for documentation."
```

**Step 3: Write Plan to File**

```
Agent type: general-purpose
Model: sonnet
Prompt: "Write the orchestration plan to .work/plans/<YYYYMMDD>/plan-<workflow-type>-<slug>.md.

Plan content:
<plan from Step 2>

The directory .work/plans/<YYYYMMDD>/ must be created if it doesn't exist.

Output: .work/plans/<YYYYMMDD>/plan-<workflow-type>-<slug>.md

Write the complete plan to the file."
```

**Step 4: Present for Human Confirmation**

Read the plan from `.work/plans/<YYYYMMDD>/plan-<workflow-type>-<slug>.md` and present a summary:

```
Plan ready for review: .work/plans/<YYYYMMDD>/plan-<workflow-type>-<slug>.md

<summarize phases, subagents, and key decisions>

Confirm to proceed with execution.
```

Use AskUserQuestion if there are branching decisions. Wait for explicit human approval.

**Step 5: Exit Plan Mode**

```
ExitPlanMode
```

Only call after human confirms the plan. This exits plan mode and allows writes.

**Step 6: Execute**

Proceed with the SDLC phases as defined in the approved plan. Every phase still requires mandatory gate review.

### When Plan Mode is NOT Required

Plan mode is NOT required for these workflows (they are direct-execution by nature):
- **Cook (TDD Loop)** — already has RED→GREEN→REFACTOR cycle, no planning needed
- **Debug / Fix Bug** — investigation-driven, too fluid for upfront planning
- **Sprint Management** — delegates to sprint skill, no SDLC phases

### Common Rules

- **Never skip plan mode** for New Feature, Change Request, or Explore workflows
- **Never self-plan** — always delegate to Plan subagent (pure orchestration)
- **Never execute before confirmation** — no ExitPlanMode until human approves
- **Plan is SSOT** — all subsequent phases reference the plan file for phase ordering and subagent assignments
- **Plan mode is read-only** — the orchestrator cannot modify files during plan mode; use subagents for file writes

## Task Selection Details

### New Feature

User signals: "implement", "build", "create feature", "new feature", "add", "develop"
Full flow: SRS (05) → HLD (06) → LLD (07) → IMP (08) → TST (09) → AGT (10)
Each phase has mandatory gate review before proceeding.

**If no input matched (ambiguous feature request):** Ask the human to clarify which feature. Use sprint skill to query `.work/board.md` for 🔲 Todo tasks — present these as candidates for implementation.

**After new feature specs complete (Phase 10 done):** Use sprint skill to update the corresponding board task status from 🔲 Todo → ✅ Ready. The feature is now ready for Cook (TDD implementation).

### Change Request

User signals: "change", "update", "modify", "adjust", "revise", "enhance"
Focuses on phases 08-10 (re-spec, re-test, update board).
If the change affects architecture (new services, new APIs, data model changes), also update phases 06-07.

**Board task check:** Use sprint skill to check `.work/board.md` for tasks related to the affected feature.
- If matching tasks found → proceed with change request flow (update specs, update board tasks)
- If NO matching tasks found → this is effectively a new feature. Redirect to New Feature workflow.

**After change request complete:** Use sprint skill to create/update a task on `.work/board.md` with status ✅ Ready. If the original feature was marked "done" on the board, reopen it.

### Cook (TDD Loop)

User signals: "cook", "implement with TDD", "tdd", "red green refactor"
Direct implementation following TDD cycle. Best for features with complete specs (phases 05-09 done).

**Task selection:** Use sprint skill to query `.work/board.md` for tasks with ✅ Ready status. Only implement tasks that are Ready — never pick 🔲 Todo or 🚧 In Progress tasks.

**After TDD cycle complete:** Use sprint skill to update the board task status from 🚧 In Progress → ✅ Done.

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

### When BOTH Agent Tool AND Leader Are Unavailable (Dead-End Handling)

**If you are in a context where you can neither delegate (no Agent tool) NOR escalate (no leader/SendMessage recipient), you are in a "double-bind" — common in test environments and nested subagent contexts.**

In this situation, follow this protocol strictly:

1. **DO NOT fall back to direct work** — This is the most critical rule. Never use Write, Edit, Bash, Grep, or Glob to do the work yourself. Direct work without delegation is the exact failure mode this skill prevents.

2. **Build a task plan** — Use TaskCreate to document the full phase plan showing:
   - Each phase with its subagent type
   - The task description you WOULD delegate
   - Expected output paths
   - Gate review assignments (different reviewer per phase)

3. **Report the plan to the user** — State clearly:
   - "I'm in a context without Agent tool access and without a leader to escalate to."
   - "Here is the orchestration plan I would execute:"
   - List each delegation with: phase, subagent, task, expected outputs
   - "To execute this plan, run me in a main Claude session where Agent tool is available."

4. **Use only allowed-tools** — Read (for reference files), AskUserQuestion (for user decisions), TaskCreate/TaskUpdate/TaskList (for tracking). These are safe in any context.

5. **STOP** — Do not proceed beyond planning. Wait for user guidance or a proper execution context.

**Why this matters:** In test environments (like skill-tester), the orchestrator cannot actually delegate. The test should verify that the orchestrator CORRECTLY IDENTIFIES what to delegate and REFUSES to do direct work — not that it succeeds at delegation. A correct plan + refusal to compromise = a working orchestrator.

## Sprint Skill Integration (Roadmap, Backlog, Board)

**CRITICAL: All roadmap, backlog, and board operations MUST delegate to the sprint skill.** Never read/write `agent_docs/roadmap.md`, `.work/backlog.md`, or `.work/board.md` directly.

### Delegation Pattern

Use the Skill tool to invoke sprint:

```
Skill: sprint
Args: "<task description>"
```

### When to Delegate to Sprint

| Operation | Sprint Delegation |
|-----------|-------------------|
| Get todo tasks from board | `Skill: sprint` — Query Workflow 8 |
| Get ready tasks for cook | `Skill: sprint` — Query Workflow 8 |
| Mark task as ready | `Skill: sprint` — CRUD Workflow 5D (update status) |
| Mark task as done | `Skill: sprint` — CRUD Workflow 5D (update status) |
| Create task on board | `Skill: sprint` — CRUD Workflow 5A (add board task) |
| Sync board → backlog | `Skill: sprint` — Workflow 3 |
| Sync backlog → roadmap | `Skill: sprint` — Workflow 4 |
| Full sync all layers | `Skill: sprint` — Workflow 6 |
| Validate consistency | `Skill: sprint` — Workflow 7 |
| Add/edit/delete any item | `Skill: sprint` — CRUD Workflows 5A/5B/5C |

### Task Status Flow (SDLC Integration)

```
🔲 Todo ──→ ✅ Ready ──→ 🚧 In Progress ──→ ✅ Done
  │            │              │                  │
  │            │              │                  └── Cook complete
  │            │              └── Cook starts (picked ready task)
  │            └── New Feature / Change Request complete (specs done)
  └── Backlog → Board breakdown (task created)
```

The orchestrator moves tasks through this flow:
- **New Feature workflow** → creates specs, then marks task 🔲 Todo → ✅ Ready
- **Change Request workflow** → updates specs, creates/updates task with ✅ Ready
- **Cook workflow** → picks ✅ Ready task, marks 🚧 In Progress, completes → ✅ Done
- **Sprint skill** → handles reverse sync (Done at board → Done at backlog → Done at roadmap)

## Safety Rules

1. **Check Agent availability first** — Before any phase, verify Agent tool exists
2. **Never self-execute** — If a subagent can do it, delegate it; if you can't delegate, escalate
3. **Never fall back to direct work** — No Agent tool = escalate to leader, don't Write/Bash yourself
4. **Gate every phase** — No phase completes without independent review
5. **Different reviewer** — The gate reviewer is never the same subagent type as the producer
6. **Fail fast** — If a gate fails, fix before proceeding (don't stack broken phases)
7. **Read-only scouting** — Use Explore agent for all codebase exploration; if unavailable, escalate
8. **Agent isolation** — test-writer never reads impl code; implementer never modifies tests
9. **Dead-end discipline** — If neither Agent tool nor leader is available, build a task plan and STOP. Never fall back to direct Write/Bash/Grep/Glob.
10. **Structured project data** — The explore workflow produces `.work/reports/project_registry.yaml` as SSOT for all per-project delegation. Every subsequent phase reads this registry rather than re-parsing free-text scouting reports. Each project gets 1 dedicated subagent per phase (never 1 subagent for multiple projects).

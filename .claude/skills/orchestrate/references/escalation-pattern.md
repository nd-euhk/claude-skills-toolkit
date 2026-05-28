# Escalation Pattern

When the orchestrate skill runs inside a spawned agent (Agent tool unavailable), it escalates delegation requests to the parent/leader instead of falling back to direct work.

## When This Applies

The orchestrate skill runs in two contexts:

| Context | Agent Tool | Behavior |
|---------|-----------|----------|
| **Main Claude session** | Available | Delegate directly via Agent tool |
| **Spawned subagent** (e.g., skill-tester) | NOT available | Escalate to leader via this pattern |

## Escalation Protocol

### Step 1: Detect Missing Agent Tool

Before any delegation, check if Agent tool is available. If not:

```
CRITICAL: Agent tool not available in this context.
ESCALATING to leader for subagent spawning.
DO NOT fall back to direct Write/Bash/Glob/Grep.
```

### Step 2: Send Escalation Request to Leader

Use SendMessage to request subagent spawning from the parent:

```
SendMessage:
  to: "<leader-name>"
  summary: "Request subagent: <subagent-type> for <phase>"
  message: "
ESCALATION: Orchestrate skill needs subagent spawning.

Requested subagent: <subagent-type> (e.g., srs-specifier, hld-architect, Explore)
Task: <detailed task description the subagent should execute>
Phase: <current SDLC phase>
Context:
  - Feature: <feature description>
  - Previous phase output: <path to output>
  - Workflow reference: <path to workflow file with exact delegation prompt>

ACTION NEEDED FROM LEADER:
1. Spawn <subagent-type> agent with the task above
2. Wait for completion
3. Collect output files
4. SendMessage back to me with:
   - Subagent output location
   - Completion status (PASS/FAIL)
   - Any issues encountered
"
```

### Step 3: Leader Processes Request

The leader (main Claude session):

1. Receives escalation request via the message
2. Spawns the requested subagent type with the specified task
3. Waits for subagent completion
4. Collects results
5. Sends results back to the orchestrate agent

### Step 4: Orchestrator Resumes

```
Received results from leader for <phase>.
Subagent: <subagent-type>
Status: <PASS/FAIL>
Output: <path to output files>

RESUMING orchestrate workflow at <current step>.
```

### Step 5: Continue Normal Flow

After receiving results, continue the normal workflow:
- If the task was a phase execution → proceed to gate review
- If the task was a gate review → evaluate gate result and proceed/retry

## Escalation Request Template

Use this exact format for consistency:

```
ESCALATION REQUEST
==================
Subagent: <name>
Model: <sonnet/opus/haiku>
Permission: <acceptEdits/plan/default>
Task: <one-line summary>

Prompt:
<full prompt to give to the subagent — copy from workflow reference>

Expected outputs:
- <file pattern or path>
- <file pattern or path>

Context files to read:
- <path to relevant spec/design file>
- <path to relevant spec/design file>

On completion, SendMessage results back to me with:
{ "phase": "<phase>", "status": "PASS|FAIL", "outputs": ["<path>", ...], "issues": ["<issue>", ...] }
```

## Example: SRS Delegation Escalation

```
SendMessage:
  to: "leader"
  summary: "Request subagent: srs-specifier for Phase 05"
  message: "
ESCALATION REQUEST
==================
Subagent: srs-specifier
Model: sonnet
Permission: acceptEdits
Task: Write SRS for user authentication feature

Prompt:
Write the SRS for feature: user authentication with email/password login,
registration, and password reset.

Requirements:
- Every FR must have Gherkin Scenario Outline + data-driven Examples
- >= 3 error cases per FR
- NFRs with concrete numbers
- Traceability matrix
- NO API paths, service names, or DB specifics

Output to: docs/product/ and agent_docs/traceability/

Expected outputs:
- docs/product/SRS.md
- docs/product/features/epic-auth/FR-AUTH-*.md (4 FR files)
- agent_docs/traceability/requirements-matrix.md

On completion, SendMessage results back to me."
```

## Anti-Patterns (Never Do These)

| Anti-Pattern | Why Wrong |
|-------------|----------|
| Falling back to direct Write when Agent tool missing | Destroys the skill's value proposition — no quality guarantee, no specialization |
| Using Bash/Glob/Grep directly for exploration | The Explore agent exists for this; if you can't spawn it, escalate |
| Silently skipping delegation and doing work yourself | User trusts the orchestrator to delegate, not to do the work |
| Using TeamCreate as a workaround | TeamCreate is for team coordination, not subagent delegation; the spawned teammates still won't have Agent tool |

## What the Orchestrator CAN Do Without Agent Tool

These actions are safe without Agent tool (they're orchestration, not execution):

- **Read** reference files and workflow documents
- **AskUserQuestion** for task type selection and user decisions
- **TaskCreate/TaskUpdate/TaskList** for workflow tracking
- **SendMessage** to communicate with leader/parent
- Check file existence with **Bash(ls, test)** (read-only metadata)
- **Read** existing spec/design files to assess state

Everything else (writing specs, exploring code, generating docs, running tests) must be delegated or escalated.

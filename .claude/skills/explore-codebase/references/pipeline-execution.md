# SDLC Pipeline Execution & Task Management

Detailed procedural steps for Phase 4 of explore-codebase, task tracking with Task tools, and project discovery commands. Load when executing the SDLC pipeline — not during Sync mode or Architect mode.

## Project Discovery Commands

Universal project discovery bash commands (moved from SKILL.md for brevity):

### Pattern 1: Git Submodules
```bash
git submodule status 2>/dev/null
```

### Pattern 2: Nested Git Repos
```bash
find . -name ".git" -not -path "./.git" -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.terraform/*" -not -path "*/.git/**" 2>/dev/null | sed 's|/\.git$||'
```
For each: check gitignore with `git check-ignore <path>`. Already a submodule (Pattern 1) → skip.

### Pattern 3: Monorepo Directories
```bash
ls -d packages/*/ apps/*/ services/*/ modules/*/ 2>/dev/null
find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null
find . -maxdepth 3 -name "Cargo.toml" -not -path "*/target/*" 2>/dev/null
find . -maxdepth 3 -name "go.mod" -not -path "*/vendor/*" 2>/dev/null
find . -maxdepth 3 -name "pom.xml" 2>/dev/null
```
Skip directories already detected in Pattern 1 or 2.

### Pattern 4: Single Project (Fallback)
If no other patterns found → single project = current repo.

---

## Unified Parallel Spawn Rule

All parallel agent spawns (scout, lld-service, imp, tst, gate-verifier) use the same logic. This is the authoritative copy.

**⚠️ NEVER spawn more than 15 agents simultaneously. For IMP+TST, count them TOGETHER — 8 IMP + 8 TST = 16 agents = 2 batches, not 1.**

```
GIVEN: total = number of agents to spawn in this wave
       For IMP+TST: total = I + T (combined, not separate)

IF total ≤ 15:
  → Spawn all in 1 batch, all run in parallel

IF total > 15:
  → batch_count = ceil(total / 15)
  → agents_per_batch = ceil(total / batch_count)
  → Spawn batch 1 (agents 1..agents_per_batch) → WAIT all complete
  → Spawn batch 2 (agents agents_per_batch+1 .. 2×agents_per_batch) → WAIT all complete
  → ...repeat for batch_count batches
```

Each batch runs in parallel within itself. Batches run sequentially — you MUST wait for one batch to finish before spawning the next. Divide agents evenly so batches are balanced — this minimizes total wall-clock time.

**Example (IMP+TST):** 25 FR groups → 25 IMP + 25 TST = 50 total → ceil(50/15) = 4 batches → ceil(50/4) = 13 per batch → batches of 13, 13, 12, 12.
**Example (IMP only):** 34 IMP agents → ceil(34/15) = 3 batches → ceil(34/3) = 12 per batch → batches of 12, 12, 10.

Batches are for execution pacing — all tasks are created upfront with correct blockedBy chains. The blockedBy graph handles ordering; batches prevent overwhelming the system with >15 concurrent agents.

---

## Dynamic Task Creation

Tracks exploration pipeline progress with Task tools. Each phase is a task with `blockedBy` forming the sequential chain.

**Metadata convention**: `phase` (repomix, scout, srs, hld, lld, imp, tst, sprint, summary), `service` (for lld-service), `fr_id` (for IMP/TST), `effort` (5m-20m).
**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically, only tracking is lost.

Count services/FRs at runtime. Create tasks in 2 waves:

### Wave 1 — Immediately after Phase 1 (sub-project count known)

```
TaskCreate("Repomix: {sub-project-1}") × N_subprojects  [sequential]
TaskCreate("Scout: {sub-project-1}") × N_subprojects     [parallel, max 15, blockedBy: repomix-{sub-project-1}]
TaskCreate("SRS")                                          [blockedBy: all scout tasks]
TaskCreate("Gate-SRS")                                     [blockedBy: srs]
TaskCreate("HLD")                                          [blockedBy: gate-srs]
TaskCreate("Gate-HLD")                                     [blockedBy: hld]
```

Repomix tasks run sequentially (CLI-bound). Scout tasks run in parallel (max 15 concurrent), each blocked by its corresponding repomix task. SRS is blocked by all scout tasks completing.

### Wave 2 — After HLD + SRS output is available (N services known, FRs grouped per Distribution Rule)

```
Step 1: Count N = services in domain-service-mapping.yaml
Step 2: Read SRS output + LLD work packages to extract FR-IDs per service
Step 3: Group FRs per FR Distribution Rule (topic-first + even split, max 5 FRs/agent)
Step 4: Count I = total IMP agents, T = total TST agents

TaskCreate("lld-service: {service-1}") × N             [parallel, max 15, blockedBy: gate-hld]
TaskCreate("Gate-LLD: {service-1}") × N                  [parallel, max 15, blockedBy: corresponding lld-service]
TaskCreate("lld-merge")                                  [blockedBy: all gate-lld]
TaskCreate("Gate-lld-merge")                             [blockedBy: lld-merge]
TaskCreate("IMP: {service}/{FR-LIST}") × I               [parallel, max 15, blockedBy: gate-lld-merge]
TaskCreate("TST: {service}/{FR-LIST}") × T               [parallel, max 15, blockedBy: gate-lld-merge]
TaskCreate("Gate-IMP: {service}/{FR-LIST}") × I          [parallel, max 15, blockedBy: corresponding imp]
TaskCreate("Gate-TST: {service}/{FR-LIST}") × T          [parallel, max 15, blockedBy: corresponding tst]
TaskCreate("Sprint")                                     [blockedBy: all gate imp + all gate tst]
TaskCreate("Summary")                                    [blockedBy: sprint]
```

### Re-spawn Handling

Gate rejection keeps task in_progress. After 3 retries, complete with rejection note, stop pipeline. Don't re-spawn entire batch — only the failing agent.

### Single Sub-Project

Skip parallel — 1 repomix task, 1 scout task, 1 task per phase. Creates simpler sequential chain. Per-service parallel adds overhead with no benefit.

### Mode Variants

**Architect** runs HLD + Gate-HLD only. **Sync** creates only selected-phase tasks from AskUserQuestion.

---

## Phase Execution Steps

Execute the steps below in order. Each step is mandatory — do not skip.

### Step 4.1: SRS Phase

1. **Spawn Agent(srs)** with the brief from `references/agent-briefs.md#phase-4-agentsrs`. Substitute:
   - `{project-name}`: the project name determined in Phase 1
   - `{N}`: total number of scout reports (from Phase 2)
   - `{run_date}`: today's date in YYYY-MM-DD format
   - `{slug}`: the slug determined in Phase 1
   - `{scout_report_paths}`: explicit list of all scout report file paths from Phase 2

2. **Wait** for Agent(srs) to complete.

3. **Spawn Agent(gate-verifier)** with the brief from `references/agent-briefs.md#phase-4-agentgate-verifier`. Substitute `{phase}` = `SRS`.

4. **If gate PASSES** → proceed to Step 4.2.
   **If gate REJECTS** → re-spawn Agent(srs) with rejection feedback (see Gate Rejection Handling below). Max 3 attempts total.

### Step 4.2: HLD Phase

1. **Spawn Agent(hld)** with the brief from `references/agent-briefs.md#phase-4-agenthld`. Substitute the same variables as Step 4.1 plus the SRS output path.

2. **Wait** for Agent(hld) to complete.

3. **Spawn Agent(gate-verifier)** with brief from agent-briefs.md. Substitute `{phase}` = `HLD`.

4. **If gate PASSES** → proceed to Step 4.3.
   **If gate REJECTS** → re-spawn Agent(hld) with rejection feedback. Max 3 attempts.

### Step 4.3: LLD Phase

1. **Extract service names**: After gate-hld passes, read `agent_docs/domain-service-mapping.yaml` to extract `N` service names. If the file does not exist, search for it with `find . -name "domain-service-mapping.yaml"`. If still not found, read the HLD output to identify service names.

2. **Spawn Agent(lld-service) × N** using the brief from `references/agent-briefs.md#phase-4-agentlld-service`. For each service, substitute:
   - `{service-name}`: the service name
   - `{N}`: this service's index (1-based)
   - `{total}`: total number of services
   - `{scout_report_path}`: the scout report covering this service
   Apply the Unified Parallel Spawn Rule (max 15 per batch).

3. **Wait** for all lld-service agents to complete.

4. **Spawn Agent(gate-verifier) × N** — one per service, in parallel batches. Substitute `{phase}` = `LLD-service: {service-name}`.

5. **If any gate REJECTS** → re-spawn only the failing lld-service agent(s). Max 3 attempts per agent.

6. **After all service gates pass**, spawn **Agent(lld-merge)** with the brief from `references/agent-briefs.md#phase-4-agentlld-merge`.

7. **Wait** for lld-merge to complete.

8. **Spawn Agent(gate-verifier)** for lld-merge. Substitute `{phase}` = `LLD-merge`.

9. **If gate PASSES** → proceed to Step 4.4.
   **If gate REJECTS** → re-spawn Agent(lld-merge) with rejection feedback. Max 3 attempts.

### Step 4.4: FR Distribution — CRITICAL, DO NOT SKIP

**This step is mandatory.** It groups FRs into IMP/TST agent assignments before creating Wave 2 tasks. Without it, IMP and TST will not execute.

1. **Read SRS output** to extract all FR-IDs and their owning services. If SRS output already maps FRs to services, use that mapping. Otherwise, read LLD work packages (each lists its service's FR-IDs at the top) to determine the service → FR mapping.

2. **For each service**, apply the **FR Distribution Rule** (topic-first grouping, max 5 FRs/agent, even distribution):
   - **Group by topic** — FRs sharing the same domain, entity, or flow belong together
   - **Each topic group ≤ 5 FRs** → 1 agent handles the whole group
   - **Topic group > 5 FRs** → split evenly: `agent_count = ceil(group_size / 5)`, `base = ceil(group_size / agent_count)`. Distribute evenly — no agent gets < 3 FRs if avoidable. Example: 13 FRs → 3 agents: 5+4+4. Example: 9 FRs → 2 agents: 5+4.
   - **No clear topic** → split all FRs of the service evenly using the same formula

   Produce a list of `{service}/{FR-LIST}` assignments. Record:
   - `I` = total IMP agent assignments
   - `T` = total TST agent assignments (same count as I — 1 TST agent per IMP agent group)

3. **Report the grouping**: "FR Distribution: {N} services, {M} total FRs → {I} IMP agents + {T} TST agents. Grouping: service-a/FR-1,FR-2,FR-3 (5 FRs), service-a/FR-4,FR-5,FR-6,FR-7 (4 FRs), ..."

### Step 4.5: Wave 2 Task Creation — CRITICAL, DO NOT SKIP

**This step is mandatory.** It creates task tracking for IMP, TST, and downstream phases.

1. **Create Wave 2 tasks** exactly as specified in [Wave 2](#wave-2--after-hld--srs-output-is-available-n-services-known-frs-grouped-per-distribution-rule):
   - `TaskCreate("IMP: {service}/{FR-LIST}") × I` — blockedBy: gate-lld-merge
   - `TaskCreate("TST: {service}/{FR-LIST}") × T` — blockedBy: gate-lld-merge
   - `TaskCreate("Gate-IMP: {service}/{FR-LIST}") × I` — blockedBy: corresponding imp
   - `TaskCreate("Gate-TST: {service}/{FR-LIST}") × T` — blockedBy: corresponding tst
   - `TaskCreate("Sprint")` — blockedBy: all gate imp + all gate tst
   - `TaskCreate("Summary")` — blockedBy: sprint

2. Since Steps 4.1-4.3 have already completed successfully, mark the corresponding Wave 1 and early Wave 2 tasks (repomix, scout, SRS, Gate-SRS, HLD, Gate-HLD, lld-service, Gate-LLD, lld-merge, Gate-lld-merge) as `completed`.

3. **Report**: "Wave 2 tasks created. {N} services, {M} FRs → {I} IMP + {T} TST agents. Proceeding to IMP and TST phases."

### Step 4.6-4.7: IMP + TST Phases (Combined Batching)

**⚠️ CRITICAL — DO NOT SPAWN ALL IMP+TST AGENTS AT ONCE. Batch them. The Unified Parallel Spawn Rule applies to the COMBINED total of IMP + TST agents per batch. Max 15 agents (IMP+TST combined) per batch. After one batch completes, spawn the next.**

Example: 25 FR groups → 25 IMP + 25 TST = 50 agents total. ceil(50/15) = 4 batches of ~13 agents each.

**For each batch:**

1. **Determine batch composition**: Take the next N FR groups such that IMP agents + TST agents ≤ 15. Example: 7 FR groups → 7 IMP + 7 TST = 14 agents → this batch = FR groups 1-7.

2. **Spawn IMP agents for this batch**: For each FR group in this batch, spawn **Agent(imp)** with the brief from `references/agent-briefs.md#phase-4-agentimp`. Substitute:
   - `{FR-LIST}`: the comma-separated FR-IDs assigned to this agent
   - `{N}`: this agent's index (1-based)
   - `{total}`: total IMP agents (`I`)
   - `{service-name}`: the owning service
   - `{project-name}`: the project name

3. **Spawn TST agents for this batch simultaneously** (same batch as IMP): For each FR group in this batch, spawn **Agent(tst)** with the brief from `references/agent-briefs.md#phase-4-agenttst`. Substitute the same variables.

4. Update each `IMP: {service}/{FR-LIST}` and `TST: {service}/{FR-LIST}` task to `in_progress` as its agent spawns.

5. **WAIT for ALL agents in this batch to complete.** Do NOT spawn the next batch until the current batch finishes.

6. **REPEAT** steps 1-5 for the next batch until all FR groups have been processed.

### Step 4.8: Gate IMP and TST

1. **After each IMP agent completes**, spawn **Agent(gate-verifier)** for that FR group's IMP output. Substitute `{phase}` = `IMP: {service}/{FR-LIST}`. Apply the Unified Parallel Spawn Rule.

2. **After each TST agent completes**, spawn **Agent(gate-verifier)** for that FR group's TST output. Substitute `{phase}` = `TST: {service}/{FR-LIST}`. Apply the Unified Parallel Spawn Rule.

3. **If any gate REJECTS** → re-spawn only the failing imp/tst agent with rejection feedback. Max 3 attempts per agent. Do NOT re-spawn an entire batch.

4. **After all IMP and TST gates pass** → proceed to Phase 5 (Sprint Integration).

---

## Gate Rejection Handling

Applies to all phases (Steps 4.1-4.8).

**When a gate REJECTS:**
- Re-spawn the failing agent (not the gate verifier) with: "RETRY #{attempt}: Previous attempt rejected. Gate feedback: {exact message}. Fix these specific issues."
- Maximum 3 re-spawns per agent. After 3: complete the task with a rejection note, stop the pipeline, and report to the human which agent failed and why.
- Do NOT re-spawn an entire parallel batch — only the specific agent whose output was rejected.

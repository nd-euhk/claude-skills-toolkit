# Task Management

Tracks exploration pipeline progress with Task tools. Each phase is a task with `blockedBy` forming the sequential chain. Gate rejection triggers re-spawn with the same task staying in_progress. Max 3 retries per phase.

**Metadata convention**: `phase`, `service` (for lld-service), `fr_id` (for IMP/TST), `effort` (5m-20m).
**Fallback**: If Task tools unavailable, proceed sequentially — pipeline works identically, only tracking is lost.

## Unified Parallel Spawn Rule

All parallel agent spawns (Explore, lld-service, imp, tst, gate-verifier) use the same logic:

```
GIVEN: total = number of agents to spawn

IF total ≤ 15:
  → Spawn all in 1 batch, all run in parallel

IF total > 15:
  → batch_count = ceil(total / 15)
  → agents_per_batch = ceil(total / batch_count)
  → Spawn batch 1 (agents 1..agents_per_batch) → wait all complete
  → Spawn batch 2 (agents agents_per_batch+1 .. 2×agents_per_batch) → wait all complete
  → ...repeat for batch_count batches
```

Each batch runs in parallel within itself. Batches run sequentially. Divide agents evenly so batches are balanced — this minimizes total wall-clock time.

**Example:** 34 agents → ceil(34/15) = 3 batches → ceil(34/3) = 12 per batch → batches of 12, 12, 10.

Batches are for execution pacing — all tasks are created upfront with correct blockedBy chains. The blockedBy graph handles ordering; batches prevent overwhelming the system with >15 concurrent agents.

## Dynamic Task Creation

Count services/FRs at runtime. Create tasks in 2 waves:

### Wave 1 — Immediately after Phase 1 (sub-project count known)

```
TaskCreate("Scout: {sub-project-1}") × N_subprojects  [parallel, max 15]
TaskCreate("SRS")                                       [blockedBy: all scout tasks]
TaskCreate("Gate-SRS")                                  [blockedBy: srs]
TaskCreate("HLD")                                       [blockedBy: gate-srs]
TaskCreate("Gate-HLD")                                  [blockedBy: hld]
```

### Wave 2 — After HLD + SRS output is available (N services and M FRs known)

```
Step 1: Count N = services in domain-service-mapping.yaml
Step 2: Count M = FRs from SRS output

TaskCreate("lld-service: {service-1}") × N             [parallel, max 15, blockedBy: gate-hld]
TaskCreate("Gate-LLD: {service-1}") × N                  [parallel, max 15, blockedBy: corresponding lld-service]
TaskCreate("lld-merge")                                  [blockedBy: all gate-lld]
TaskCreate("Gate-lld-merge")                             [blockedBy: lld-merge]
TaskCreate("IMP: {FR-1}") × M                           [parallel, max 15, blockedBy: gate-lld-merge]
TaskCreate("TST: {FR-1}") × M                           [parallel, max 15, blockedBy: gate-lld-merge]
TaskCreate("Gate-IMP: {FR-1}") × M                      [parallel, max 15, blockedBy: corresponding imp]
TaskCreate("Gate-TST: {FR-1}") × M                      [parallel, max 15, blockedBy: corresponding tst]
TaskCreate("Sprint")                                    [blockedBy: all gate imp + all gate tst]
TaskCreate("Summary")                                   [blockedBy: sprint]
```

## Re-spawn Handling

Gate rejection keeps task in_progress. After 3 retries, complete with rejection note, stop pipeline. Don't re-spawn entire batch — only the failing agent.

## Single Sub-Project

Skip parallel — 1 task per phase. Creates simpler sequential chain. Per-service parallel adds overhead with no benefit.

## Mode Variants

**Architect** runs HLD + Gate-HLD only. **Sync** creates only selected-phase tasks from AskUserQuestion.

# Task Management: Architecture Workflow Task Chains

Track each workflow with Task tools. Create all tasks before spawning any agents.

## Design Workflow Task Chain

```
TaskCreate("Plan architecture design")           // only if --auto absent
TaskCreate("Design system architecture")         [blockedBy: plan]
TaskCreate("Write ADRs (>=3)")                  [blockedBy: design]
TaskCreate("Define bounded contexts and hard boundaries") [blockedBy: design]
TaskCreate("Write API and event contracts")      [blockedBy: adrs]
TaskCreate("Draw C4 diagrams")                  [blockedBy: design]
TaskCreate("Backfill FR docs (post-SRS only)")   [blockedBy: adrs + boundaries]
TaskCreate("Self-check output theo Gate Criteria") [blockedBy: all-outputs]
TaskCreate("Summary report")                     [blockedBy: self-check]
```

**Parallelism:** ADRs, boundaries, and diagrams can run in parallel after design completes. Contracts depend on ADRs (need API conventions and event taxonomy decisions).

**Metadata:** `phase=architect`, `effort` (10m-20m per task).

## Review Workflow Task Chain

```
TaskCreate("Plan architecture review")                    // only if --auto absent
TaskCreate("Read and catalog all architecture artifacts")  [blockedBy: plan]
TaskCreate("Assess correctness and completeness")          [blockedBy: catalog]
TaskCreate("Assess consistency and technical debt")        [blockedBy: catalog]
TaskCreate("Assess scalability and resilience")            [blockedBy: catalog]
TaskCreate("Assess security posture")                      [blockedBy: catalog]
TaskCreate("Write gap ADRs")                               [blockedBy: completeness]
TaskCreate("Write recommendations")                        [blockedBy: all-assessments]
TaskCreate("Build health dashboard")                       [blockedBy: all-assessments]
TaskCreate("Self-check output theo Gate Criteria")         [blockedBy: all-outputs]
TaskCreate("Summary report")                               [blockedBy: self-check]
```

**Parallelism:** All 4 assessment tasks run in parallel after cataloging. Gap ADRs start as soon as completeness assessment finishes. Recommendations and dashboard wait for all assessments.

**Metadata:** `phase=architect`, `effort` (15m-30m per assessment dimension).

## Advisory Workflow Task Chain

```
TaskCreate("Plan architecture advisory")          // only if --auto absent
TaskCreate("Research options and constraints")    [blockedBy: plan]
TaskCreate("Evaluate options and recommend")      [blockedBy: research]
TaskCreate("Write advisory document")             [blockedBy: evaluate]
TaskCreate("Write ADR (if significant)")          [blockedBy: recommend]
TaskCreate("Summary report")                      [blockedBy: advisory-doc]
```

**No gate verification for advisory.** Outputs are consultative, not binding.

**Metadata:** `phase=architect`, `effort` (5m-15m per task).

## Output Rejection Handling

Không có gate agent riêng — architect-specialist tự self-check theo Gate Criteria của nó.
Nếu output không đạt criteria:
1. Keep the failed task as `in_progress`
2. Add a retry counter to task metadata: `retry=N`
3. Re-spawn architect-specialist với feedback cụ thể (output nào thiếu/không đạt)
4. After 3 retries, mark task `completed` với metadata `self-check=failed` và report to human

## Fallback

If Task tools are unavailable, proceed sequentially — pipeline works identically without task tracking.

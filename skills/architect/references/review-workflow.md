# Review Workflow: Brownfield Architecture Assessment

Review and assess existing architecture. Pipeline: Plan(opt) → architect-specialist(review) → gate → sprint(sync) → Summary.

## Phase 1: Plan (Optional, skip with --auto)

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope:
   - What triggered the review? (incident, planned audit, new requirements?)
   - Which architecture artifacts exist?
   - Any specific concerns or focus areas?
   - Is this a full assessment or targeted review?
3. Draft and approve plan → write to `.work/plans/arch-review-YYYYMMDD-{slug}.md`
4. Exit plan mode.

## Phase 2: Spawn architect-specialist (Review Mode)

Spawn `Agent(architect-specialist)` with the review brief. See `agent-brief-templates.md` for the full brief template.

Key instructions in brief:
- **Mode:** review (brownfield assessment)
- **Inputs:** All existing architecture artifacts (system-architecture.md, ADRs, architecture.md, domain-service-mapping.yaml, hard-boundaries.md, contracts/)
- **Outputs:** architecture-assessment.md (7 dimensions), recommendations.md (Yellow/Red fixes), gap ADRs, health-dashboard.md
- **Focus areas:** Any specific concerns from plan phase

**If plan exists**, include plan path and focus areas in brief.

## Phase 3: Gate Verification

Spawn `Agent(gate-verifier)` to check review outputs:

```
Read agent_docs/architecture-reviews/architecture-assessment-*.md
Read agent_docs/architecture-reviews/recommendations-*.md
Read agent_docs/architecture-reviews/health-dashboard.md
```

Gate criteria:
- [ ] All 7 dimensions assessed with evidence (correctness, completeness, consistency, scalability, security, resilience, technical debt)
- [ ] Every Yellow/Red finding has a concrete recommendation with effort + priority
- [ ] Missing ADRs identified and written (or explicitly noted as not needed)
- [ ] Health dashboard summarizes all dimensions with ratings and top 3 risks
- [ ] Each finding cites specific evidence (file path, code reference, config)

**On rejection:** Re-spawn architect-specialist with specific feedback from gate. Max 3 retries. After 3 failures, report to human with accumulated issues.

## Phase 4: Sprint Sync

After gate passes, integrate with sprint:
- `Skill(sprint)` to update board — create tasks for Yellow/Red findings
- Prioritize Must-fix findings into current/next sprint
- Should-fix and Nice-to-have go to backlog
- Link review artifacts to sprint tasks

## Phase 5: Summary

Report to human:
- **Architecture health:** Green/Yellow/Red counts per dimension
- **Top 3 risks:** with mitigation paths
- **Critical findings:** Must-fix items requiring immediate attention
- **Recommendations:** breakdown by priority and effort
- **Artifacts:** list all written files with paths
- **Gate result:** pass/fail with details
- **Next steps:** prioritize Must-fix items into sprint, schedule follow-up review

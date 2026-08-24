# Advisory Workflow: Focused Architectural Guidance

Provide targeted architectural advice for specific questions or decisions. Pipeline: Plan(opt) → architect-specialist(advisory) → Summary.

Advisory mode is lighter than design/review — no separate gate agent; architect-specialist tự self-check nhẹ (decision space + options + recommendation đủ). Outputs consultative, không bắt buộc viết file.

## Phase 1: Plan (Optional, skip with --auto)

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope:
   - What specific architectural question needs answering?
   - What options are under consideration?
   - What constraints apply? (budget, timeline, existing systems, team skills)
   - What's the decision authority? (recommendation vs binding decision)
3. Draft and approve plan → write to `.work/plans/arch-advisory-YYYYMMDD-{topic}-{slug}.md`
4. Exit plan mode.

## Phase 2: Spawn architect-specialist (Advisory Mode)

Spawn `Agent(architect-specialist)` with the advisory brief. See `agent-brief-templates.md` for the full brief template.

Key instructions in brief:
- **Mode:** advisory (focused guidance)
- **Question:** The specific architectural question from the user
- **Context:** optional — relevant artifacts (`agent_docs/project-overview.md`, `agent_docs/architecture.md`, `agent_docs/adrs/ADR-*.md`, constraints) nếu có
- **Outputs:** advisory-{topic}-{date}.md with decision space, option evaluation, recommendation, rationale

**If plan exists**, include plan path and key constraints in brief.

## Phase 3: Summary (No Separate Gate)

Report to human:
- **Question answered:** restate the original question
- **Options evaluated:** brief summary of each option with trade-offs
- **Recommendation:** which option, why, what risks to monitor
- **ADR written:** if applicable, path to ADR
- **Artifact:** path to advisory document
- **Next steps:** implementation path if decision was made

## Advisory Examples

| Question | Mode | Output |
|----------|------|--------|
| "Should we use monolith or microservices?" | Advisory | Trade-off analysis + recommendation |
| "Which database for this workload?" | Advisory | Options evaluated + ADR |
| "How to handle auth across services?" | Advisory | Pattern recommendation + contract |
| "Is our architecture ready for 10x scale?" | Advisory → Review | If artifacts exist, suggest review mode |
| "How to migrate from monolith to services?" | Advisory | Migration strategy + phased plan |

**Escalation rule:** If the advisory question requires full architecture design or review, escalate to the appropriate workflow rather than answering incompletely in advisory mode.

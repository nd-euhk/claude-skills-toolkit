# Design Workflow: Greenfield Architecture

Design system architecture from requirements. Pipeline: Plan(opt) → architect-specialist(design) → gate → sprint(sync) → Summary.

## Phase 1: Plan (Optional, skip with --auto)

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope:
   - What are the functional requirements (from SRS)?
   - What are the non-functional requirements (NFRs)?
   - Any technology constraints or preferences?
   - Expected scale and growth?
3. Draft and approve plan → write to `.work/plans/arch-design-YYYYMMDD-{slug}.md`
4. Exit plan mode.

## Phase 2: Spawn architect-specialist (Design Mode)

Spawn `Agent(architect-specialist)` with the design brief. See `agent-brief-templates.md` for the full brief template.

Key instructions in brief:
- **Mode:** design (greenfield from SRS)
- **Inputs:** SRS.md, FR-*.md, requirements-matrix, user-context
- **Outputs:** system-architecture.md, ADRs (>=3), architecture.md, domain-service-mapping.yaml, hard-boundaries.md, contracts/, diagrams/, backfill phase 5 artifacts
- **Template override:** None (use defaults)

**If plan exists**, include plan path and key decisions in brief.

## Phase 3: Gate Verification

Spawn `Agent(gate-verifier)` to check design outputs:

```
Read docs/architecture/system-architecture.md
Read docs/architecture/ADRs/ADR-*.md
Read agent_docs/architecture.md
Read agent_docs/domain-service-mapping.yaml
Read agent_docs/hard-boundaries.md
Read agent_docs/contracts/
Read docs/architecture/diagrams/
```

Gate criteria:
- [ ] System architecture covers C4 Level 1 and Level 2
- [ ] >=3 ADRs with context/decision/rationale/consequences
- [ ] Every FR maps to exactly one service (domain-service-mapping.yaml)
- [ ] Hard boundaries list data ownership and forbidden shortcuts
- [ ] Phase 5 backfill complete (no "TBD" references)
- [ ] No implementation details (no class names, DB schemas, code)

**On rejection:** Re-spawn architect-specialist with specific feedback from gate. Max 3 retries. After 3 failures, report to human with accumulated issues.

## Phase 4: Sprint Sync

After gate passes, integrate with sprint:
- `Skill(sprint)` to update board — new architecture tasks may be created
- If new services/domains defined, suggest backlog updates
- Link architecture artifacts to relevant features

## Phase 5: Summary

Report to human:
- **Architecture designed:** services identified, ADRs written, diagrams created
- **Key decisions:** service decomposition, API conventions, event taxonomy
- **Artifacts:** list all written files with paths
- **Gate result:** pass/fail with details
- **Next steps:** ready for HLD → LLD → IMP pipeline

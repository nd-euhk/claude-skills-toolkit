# Review Workflow: Brownfield Architecture Assessment

Review and assess existing architecture. Pipeline: Plan(opt) → architect-specialist(review) → Summary. Có thể là nâng cấp kiến trúc hiện tại của project này hoặc đánh giá kiến trúc hệ thống khác theo yêu cầu human.

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
- **Inputs:** All existing architecture artifacts (`agent_docs/architecture.md`, `agent_docs/adrs/ADR-*.md`, `agent_docs/domain-service-mapping.yaml`, `agent_docs/hard-boundaries.md`, `agent_docs/contracts/`)
- **Outputs:** architecture-assessment.md (7 dimensions), recommendations.md (Yellow/Red fixes), gap ADRs, health-dashboard.md
- **Focus areas:** Any specific concerns from plan phase

**If plan exists**, include plan path and focus areas in brief.

## Phase 3: Output Self-Check

No separate gate agent. architect-specialist tự self-check output theo Gate Criteria của nó (7 dimensions có evidence, mỗi Yellow/Red có recommendation với effort + priority, missing ADRs written hoặc noted, health dashboard đủ, mỗi finding cite evidence cụ thể) trước khi báo cáo. Nếu output thiếu/không đạt → re-spawn architect-specialist với feedback cụ thể (max 3 retries). After 3 failures, report to human with accumulated issues.

## Phase 4: Summary

Report to human:
- **Architecture health:** Green/Yellow/Red counts per dimension
- **Top 3 risks:** with mitigation paths
- **Critical findings:** Must-fix items requiring immediate attention
- **Recommendations:** breakdown by priority and effort
- **Artifacts:** list all written files with paths
- **Self-check:** output đã đạt criteria (architect-specialist tự check)
- **Next steps:** đề xuất các bước nâng cấp (không tự vào sprint — sprint thuộc controller)

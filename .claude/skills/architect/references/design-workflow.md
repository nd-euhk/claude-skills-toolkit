# Design Workflow: Greenfield Architecture

Design system architecture. Pipeline: Plan(opt) → architect-specialist(design) → Summary. Target có thể là project này hoặc hệ thống khác — cùng human thảo luận để chốt kiến trúc mong muốn.

## Phase 1: Plan (Optional, skip with --auto)

1. Call `EnterPlanMode`
2. Spawn `Agent(Plan)` to clarify scope:
   - What are the functional requirements? (từ `agent_docs/project-overview.md` pre-SRS, hoặc SRS/FR nếu post-SRS)
   - What are the non-functional requirements (NFRs)?
   - Any technology constraints or preferences?
   - Expected scale and growth?
3. Draft and approve plan → write to `.work/plans/arch-design-YYYYMMDD-{slug}.md`
4. Exit plan mode.

## Phase 2: Spawn architect-specialist (Design Mode)

Spawn `Agent(architect-specialist)` with the design brief. See `agent-brief-templates.md` for the full brief template.

Key instructions in brief:
- **Mode:** design (kiến trúc mới — project này hoặc hệ thống khác)
- **Inputs:** optional context — `agent_docs/project-overview.md`, user-context (pre-SRS); FR-*.md, requirements-matrix (post-SRS); đọc nếu có, thiếu thì thảo luận với human
- **Outputs:** khi viết file → `agent_docs/architecture.md` (C4 inline), `agent_docs/adrs/ADR-{NNN}--{slug}.md` (>=3), `agent_docs/domain-service-mapping.yaml`, `agent_docs/hard-boundaries.md`, `agent_docs/contracts/`. **KHÔNG viết `docs/`** — human docs xử lý riêng qua human-docs pipeline. Output file chỉ khi có outcome cần ghi lại (kiến trúc project này) — trao đổi thuần túy thì không cần.
- **Template override:** None (use defaults)

**If plan exists**, include plan path and key decisions in brief.

## Phase 3: Output Self-Check

No separate gate agent. architect-specialist tự self-check output theo Gate Criteria của nó (xem `agent_docs/`: architecture.md covers C4 L1+L2 inline, >=3 ADRs trong `agent_docs/adrs/`, mọi domain/feature maps đúng một service, hard boundaries có data ownership, không viết `docs/`, không implementation details) trước khi báo cáo. Nếu output thiếu/không đạt → re-spawn architect-specialist với feedback cụ thể (max 3 retries). After 3 failures, report to human with accumulated issues.

## Phase 4: Summary

Report to human:
- **Architecture designed:** services identified, ADRs written, C4 diagrams inline trong architecture.md
- **Key decisions:** service decomposition, API conventions, event taxonomy
- **Artifacts:** list all written files with paths
- **Self-check:** output đã đạt criteria (architect-specialist tự check)
- **Next steps:** ready for SRS → HLD (sdlc-hld refine) → LLD → IMP pipeline

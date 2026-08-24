# Agent Brief Templates

Templates for spawning architect-specialist in each mode. These are starting points — customize with project-specific context, plan decisions, and re-spawn context.

**Inputs là optional context** — đọc nếu có/helpful. Thiếu input không phải blocker: thảo luận với
human để thu thập yêu cầu trực tiếp. Target có thể là project này hoặc hệ thống khác. Output file
chỉ khi có outcome cần ghi lại và human muốn — trao đổi thuần túy thì không cần file.

## Design Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Design (greenfield architecture từ project-overview pre-SRS; SRS/FR nếu post-SRS)

**Inputs to read before starting (optional context — đọc nếu có):**
1. `agent_docs/project-overview.md` (pre-SRS, nếu có)
2. `agent_docs/user-context.md` (nếu có)
3. Post-SRS (nếu đã tồn tại): `agent_docs/features/*/FR-*.md`, `agent_docs/traceability/requirements-matrix.md`

**Outputs to produce (agent_docs/ only — KHÔNG viết docs/):**
1. `agent_docs/architecture.md` — C4 L1+L2 (inline Mermaid), bounded contexts, service decomposition, communication patterns, security, infrastructure
2. `agent_docs/adrs/ADR-001--service-decomposition.md` — context/decision/rationale/consequences
3. `agent_docs/adrs/ADR-002--api-conventions.md` — context/decision/rationale/consequences
4. `agent_docs/adrs/ADR-003--event-taxonomy.md` — context/decision/rationale/consequences
5. Additional ADRs (ADR-004+) for any other significant architectural decisions
6. `agent_docs/domain-service-mapping.yaml` — service → domain → data ownership
7. `agent_docs/hard-boundaries.md` — data ownership rules, forbidden shortcuts
8. `agent_docs/contracts/api-conventions.md` — URL structure, auth, pagination
9. `agent_docs/contracts/events.md` — naming, envelope, semantics
10. Backfill: chỉ khi post-SRS — update "TBD" references trong `agent_docs/features/*/FR-*.md`; pre-SRS thì bỏ qua

**Constraints:**
- Architecture only — no implementation details, no class names, no DB schemas
- Mọi domain/feature (từ project-overview pre-SRS, hoặc FR post-SRS) map đến đúng một service
- No direct DB access across service boundaries
- **KHÔNG viết `docs/`** — human docs xử lý riêng qua human-docs pipeline

**Plan context:** {plan_path if exists, key decisions from plan}

**Re-spawn context:** {nếu re-spawn: feedback từ lần chạy trước — output nào thiếu/không đạt}
```

## Review Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Review (brownfield architecture assessment)

**Inputs to read before starting (optional context — đọc nếu có):**
1. `agent_docs/architecture.md` (if exists)
2. `agent_docs/adrs/ADR-*.md`
3. `agent_docs/domain-service-mapping.yaml`
4. `agent_docs/hard-boundaries.md`
5. `agent_docs/contracts/`
6. Scan codebase for actual implementation vs documented architecture (spawn Explore agents) — nếu là project này

**Outputs to produce:**
1. agent_docs/architecture-reviews/architecture-assessment-{date}.md
   - Assess all 7 dimensions: correctness, completeness, consistency, scalability, security, resilience, technical debt
   - Rate each: Green (healthy), Yellow (needs attention), Red (critical)
   - Evidence required for every finding (file paths, code references)
2. agent_docs/architecture-reviews/recommendations-{date}.md
   - For each Yellow/Red: issue, impact, recommendation, effort (S/M/L/XL), priority (Must/Should/Nice)
3. agent_docs/architecture-reviews/health-dashboard.md
   - Summary table of all dimensions with ratings
   - Trend indicators if previous assessments exist
   - Top 3 risks with mitigation paths
4. Missing ADRs → `agent_docs/adrs/ADR-{NNN}--{slug}.md` (for undocumented decisions)

**Focus areas:** {specific concerns from plan phase, if any}

**Plan context:** {plan_path if exists, key focus areas from plan}

**Re-spawn context:** {nếu re-spawn: feedback từ lần chạy trước — output nào thiếu/không đạt}
```

## Advisory Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Advisory (focused architectural guidance)

**Question:** {the specific architectural question}

**Context to consider:**
1. {relevant project artifacts — project-overview, agent_docs/architecture.md, ADRs}
2. {constraints — budget, timeline, team skills, existing systems}
3. {options under consideration, if known}

**Outputs to produce:**
1. agent_docs/architecture-reviews/advisory-{topic}-{date}.md
   - Decision space: what are the viable options?
   - Option evaluation: trade-offs, risks, costs, benefits per option
   - Recommendation: which option, why, what risks to monitor
2. If decision is significant: `agent_docs/adrs/ADR-{next}--{topic}.md`

**Plan context:** {plan_path if exists, key constraints from plan}
```

## Spawn Pattern

All modes follow the same spawn pattern:
```
Agent(
  type: "architect-specialist",
  description: "Architecture {mode} — {brief description}",
  prompt: "{brief from template above, customized with project context}"
)
```

On output không đạt (design/review), re-spawn với `prompt` extended với re-spawn context section.

# Agent Brief Templates

Templates for spawning architect-specialist in each mode. These are starting points — customize with project-specific context, plan decisions, and gate feedback.

## Design Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Design (greenfield architecture from requirements)

**Inputs to read before starting:**
1. docs/product/SRS.md
2. Glob and read all docs/product/features/epic-*/FR-*.md
3. agent_docs/traceability/requirements-matrix.md
4. agent_docs/user-context.md (if exists)

**Outputs to produce:**
1. docs/architecture/system-architecture.md — C4 L1+L2, bounded contexts, service decomposition, communication patterns, security, infrastructure
2. docs/architecture/ADRs/ADR-001-service-decomposition.md — context/decision/rationale/consequences
3. docs/architecture/ADRs/ADR-002-api-conventions.md — context/decision/rationale/consequences
4. docs/architecture/ADRs/ADR-003-event-taxonomy.md — context/decision/rationale/consequences
5. Additional ADRs (ADR-004+) for any other significant architectural decisions
6. agent_docs/architecture.md — agent-facing summary
7. agent_docs/domain-service-mapping.yaml — service → domain → data ownership
8. agent_docs/hard-boundaries.md — data ownership rules, forbidden shortcuts
9. agent_docs/contracts/api-conventions.md — URL structure, auth, pagination
10. agent_docs/contracts/events.md — naming, envelope, semantics
11. docs/architecture/diagrams/system-context.mermaid
12. docs/architecture/diagrams/container-diagram.mermaid
13. docs/architecture/diagrams/data-flow.mermaid
14. Backfill: update any "TBD" references in docs/product/ with architectural decisions

**Constraints:**
- Architecture only — no implementation details, no class names, no DB schemas
- Every FR must map to exactly one service
- No direct DB access across service boundaries

**Plan context:** {plan_path if exists, key decisions from plan}

**Gate feedback:** {if re-spawning, include specific rejection reasons}
```

## Review Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Review (brownfield architecture assessment)

**Inputs to read before starting:**
1. docs/architecture/system-architecture.md (if exists)
2. docs/architecture/ADRs/ADR-*.md
3. agent_docs/architecture.md
4. agent_docs/domain-service-mapping.yaml
5. agent_docs/hard-boundaries.md
6. agent_docs/contracts/
7. Scan codebase for actual implementation vs documented architecture (spawn Explore agents)

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
4. Missing ADRs → docs/architecture/ADRs/ADR-*.md (for undocumented decisions)

**Focus areas:** {specific concerns from plan phase, if any}

**Plan context:** {plan_path if exists, key focus areas from plan}

**Gate feedback:** {if re-spawning, include specific rejection reasons}
```

## Advisory Mode Brief

```
Spawn Agent(architect-specialist) with this brief:

**Mode:** Advisory (focused architectural guidance)

**Question:** {the specific architectural question}

**Context to consider:**
1. {relevant project artifacts — SRS, ADRs, existing architecture docs}
2. {constraints — budget, timeline, team skills, existing systems}
3. {options under consideration, if known}

**Outputs to produce:**
1. agent_docs/architecture-reviews/advisory-{topic}-{date}.md
   - Decision space: what are the viable options?
   - Option evaluation: trade-offs, risks, costs, benefits per option
   - Recommendation: which option, why, what risks to monitor
2. If decision is significant: docs/architecture/ADRs/ADR-{next}-{topic}.md

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

On gate rejection (design/review), re-spawn with `prompt` extended with gate feedback section.

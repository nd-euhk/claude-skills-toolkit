# ADRs Gate Check Criteria

Load this file when verifying the **adrs** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md` (one per architectural decision)

## 1. ADR Structure (MADR Format)

Glob `knowledge/03-system-architecture/ADRs/ADR-*.md`. For each ADR, verify all required sections:
1. Title — short noun phrase
2. Status — "Proposed" (reverse-engineered, needs human confirmation)
3. Context — what problem does this decision solve? what constraints exist?
4. Decision — what was decided? must be specific, not vague
5. Consequences — what becomes easier? harder? what are the trade-offs?
6. Options Considered — each option with pros/cons and why rejected
7. References — source files, existing ADRs, tech-design sections

No section should say "TBD" or be empty.

## 2. Decision Specificity

Read the Decision section of each ADR:
- Must describe a concrete architectural choice, not a vague direction
- PASS: "Use PostgreSQL for all transactional data, with read replicas for reporting queries"
- FAIL: "Use appropriate database technology"
- Flag vague or non-decisions

## 3. Evidence-Backed

Read each ADR. The decision must be traceable to actual code:
- References section must list specific source files or tech-design sections
- Context section must describe actual project constraints, not hypothetical ones

## 4. Options Quality

Read the Options Considered section of each ADR:
- Must list at least 2 alternatives considered
- Each option must have: pros, cons, and why rejected
- The chosen option must be among those considered

## 5. Cross-ADR Consistency

Read all ADRs together:
- No contradictory decisions between ADRs
- ADR service references must match actual service names in `knowledge/04-microservices/`
- Flag ADRs referencing non-existent services or patterns

## 6. Consistency with C4

Cross-reference each ADR with `knowledge/03-system-architecture/C4-context-diagram.md`:
- ADR decisions must be consistent with C4 architecture
- If an ADR describes a service dependency, it must match C4 arrows

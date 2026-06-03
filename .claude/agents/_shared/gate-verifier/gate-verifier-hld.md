# HLD Gate Check Criteria

Load this file when verifying the **hld** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

## 1. C4 Diagrams

Read `docs/architecture/system-architecture.md`:
- Must contain System Context (C4 Level 1) — as Mermaid diagram or described
- Must contain Container Diagram (C4 Level 2) — as Mermaid diagram or described
- Must contain Bounded Context Map with domain boundaries

## 2. ADR Completeness

Glob `docs/architecture/ADRs/ADR-*.md`. At minimum, these 3 ADRs must exist:
- ADR-001 (service decomposition): context, decision, rationale, consequences — all 4 sections
- ADR-002 (API conventions): context, decision, rationale, consequences — all 4 sections
- ADR-003 (event taxonomy): context, decision, rationale, consequences — all 4 sections
- No section should say "TBD" or be empty

Additional ADRs (ADR-004+) are allowed and expected when the project has other significant architectural decisions. Verify each additional ADR also has all 4 sections with substantive content.

## 3. Service Mapping

Read `agent_docs/domain-service-mapping.yaml`:
- Every FR must be mappable to exactly one service
- Cross-reference: glob all FR files, check each FR title/domain appears in the mapping
- No orphan FRs (FR with no owning service)

## 4. Hard Boundaries

Read `agent_docs/hard-boundaries.md`:
- Must list data ownership per service (which service owns what data)
- Must list forbidden shortcuts (e.g., "service A must never query service B's database directly")
- Must define cross-boundary rules

## 5. No Implementation Details

Grep `docs/architecture/` and `agent_docs/architecture.md`:
- No class names, no database schemas (DDL), no code snippets
- grep for: "class ", "interface ", "CREATE TABLE", "@Autowired", "@Component" — must be zero

## 6. Phase 5 Backfill

Read `docs/product/SRS.md` and sample FR files. Search for architecture-dependent gaps:
- grep for: "to be determined", "TBD", "will be defined", "pending architecture" in `docs/product/`
- If HLD is complete, these should be resolved

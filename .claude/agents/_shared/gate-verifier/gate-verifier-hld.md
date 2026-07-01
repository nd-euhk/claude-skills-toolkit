# HLD Gate Check Criteria

Load this file when verifying the **hld** phase (architect skill design/review mode). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Note:** For system-wide merge workflow, use the dedicated criteria files:
- `gate-verifier-c4.md` for C4 Context Diagram
- `gate-verifier-adrs.md` for Architecture Decision Records
- `gate-verifier-hard-boundaries.md` for Hard Boundaries

## 1. C4 Diagrams

Read `docs/architecture/system-architecture.md` or `knowledge/03-system-architecture/C4-context-diagram.md` (reverse-engineering):
- Must contain System Context (C4 Level 1) — as Mermaid diagram or described
- Must contain Container Diagram (C4 Level 2) — as Mermaid diagram or described
- Must contain Bounded Context Map with domain boundaries

## 2. ADR Completeness

Glob `docs/architecture/ADRs/ADR-*.md` or `knowledge/03-system-architecture/ADRs/ADR-*.md` (reverse-engineering). At minimum, these ADRs must exist:
- ADR-001 (service decomposition): context, decision, rationale, consequences — all 4 sections
- ADR-002 (API conventions): context, decision, rationale, consequences — all 4 sections
- ADR-003 (event taxonomy): context, decision, rationale, consequences — all 4 sections
- No section should say "TBD" or be empty

Additional ADRs are allowed and expected. Verify each additional ADR also has all sections with substantive content.

## 3. Service Mapping

Check that every service has a clear bounded context:
- Every FR must be mappable to exactly one service
- No orphan FRs (FR with no owning service)
- **Reverse-engineering:** Cross-reference `knowledge/04-microservices/*/FR-*.md` with service names

## 4. Hard Boundaries

Read `agent_docs/hard-boundaries.md` or `knowledge/01-global-standards/hard-boundaries.md` (reverse-engineering):
- Must list data ownership per service (which service owns what data)
- Must list forbidden shortcuts (e.g., "service A must never query service B's database directly")
- Must define cross-boundary rules

## 5. No Implementation Details

Grep architecture documents for implementation-level content:
- No class names, no database schemas (DDL), no code snippets
- grep for: "class ", "interface ", "CREATE TABLE", "@Autowired", "@Component" — must be zero

## 6. Phase Backfill

If forward-engineering: read `docs/product/SRS.md`. Search for architecture-dependent gaps:
- grep for: "to be determined", "TBD", "will be defined", "pending architecture"
- If HLD is complete, these should be resolved

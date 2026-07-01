# Hard Boundaries Gate Check Criteria

Load this file when verifying the **hard-boundaries** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/01-global-standards/hard-boundaries.md`

## 1. Required Sections

Read the artifact. All sections must be present with substantive content:
1. Service Criticality Tiers — each service classified (Tier 0: critical path, Tier 1: important, Tier 2: supporting)
2. Data Consistency Boundaries — service data ownership, consistency models (strong, eventual, CQRS)
3. NFR Thresholds per Service — table: Service | p95 Latency | Throughput | Availability | RTO | RPO
4. Security Boundaries — auth domains, token propagation, service-to-service authn/authz
5. Deployment Boundaries — deploy groups, rollback groups, deploy order dependencies
6. Ownership Boundaries — team ownership, code ownership rules, cross-team contracts
7. Anti-Corruption Boundaries — ACLs needed, translation layers, legacy integration points

No section should be empty or contain only "TBD".

## 2. Service Completeness

Read the artifact. Every service in the project must be classified:
- Check against service list from `knowledge/04-microservices/` directories
- Flag any service missing from hard boundaries

## 3. Criticality Justification

Read the artifact. Every Tier 0 and Tier 1 classification must have:
- Specific justification (not generic: "important for business")
- Reference to business impact or user-facing criticality
- Flag unjustified classifications

## 4. NFR Threshold Evidence

Read the artifact. NFR thresholds must be traceable:
- p95 latency, throughput, availability — must reference actual config files or tech-design sections
- Flag thresholds that appear invented rather than extracted from code/config
- **Reverse-engineering mode:** numbers from config, not imagination

## 5. Consistency with C4

Cross-reference with `knowledge/03-system-architecture/C4-context-diagram.md`:
- Boundary definitions must match C4 bounded contexts
- Data ownership must be consistent with C4 service responsibilities
- Flag contradictions

## 6. Forbidden Shortcuts

Read the artifact. Must explicitly list:
- Forbidden cross-service patterns (e.g., "service A must never query service B's database directly")
- Anti-corruption layer requirements
- Cross-boundary rules (sync vs async, retry policies)

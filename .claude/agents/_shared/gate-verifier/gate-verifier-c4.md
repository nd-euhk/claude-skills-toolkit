# C4 Gate Check Criteria

Load this file when verifying the **c4** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/03-system-architecture/C4-context-diagram.md`

## 1. C4 Level 1 — System Context Diagram

Read the artifact. Verify:
- Must contain a System Context diagram (C4 Level 1) showing the system + users + external systems
- Diagram must be rendered as Mermaid code block or clearly described
- Must identify all external actors (users, external APIs, third-party services)

## 2. C4 Level 2 — Container Diagram

Read the artifact. Verify:
- Must contain a Container diagram (C4 Level 2) showing services, databases, message brokers, external APIs
- Every service in the project must appear in the diagram
- Every external dependency (DB, MQ, cache, cloud service) must be shown

## 3. Bounded Context Mapping

Read the artifact. Verify:
- Must define bounded contexts for every service
- Must describe context relationships (Shared Kernel, Customer/Supplier, Conformist, ACL, Open Host Service)
- Must reference DDD strategic design patterns where applicable

## 4. Service Inventory

Read the artifact. Verify:
- Complete service inventory table: Service | Type | Build System | Dependencies | External Deps | Bounded Context
- Every service name matches `knowledge/04-microservices/{name}/` directory
- Dependency lists match actual dependencies found in tech-design files

## 5. Integration View

Read the artifact. Verify:
- Must describe how services communicate (REST, gRPC, messaging, events)
- Communication patterns must match actual implementations in tech-design files
- No missing integration paths (check every service-to-service dependency from Collect phase)

## 6. Cross-Reference Consistency

Cross-reference with:
- `knowledge/04-microservices/*/tech-design.md` — service dependencies must match C4 arrows
- `.work/system-wide-notes/*.md` — service descriptions must be consistent
- Flag any contradictions between C4 and service-level documentation

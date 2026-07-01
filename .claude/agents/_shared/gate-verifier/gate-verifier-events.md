# Events Gate Check Criteria

Load this file when verifying the **events** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/02-central-contracts/events/evt-{name}.yaml` (one per event)

## 1. YAML Structure Completeness

Glob `knowledge/02-central-contracts/events/evt-*.yaml`. For each event spec, verify all required fields:

```yaml
name: <event name>
type: published | consumed
source: <service name>
description: <detailed description>
schema:
  properties:
    eventId: { type: string, description: "..." }
    timestamp: { type: string, format: date-time }
    # ... actual payload fields
consumers: [...]
publishers: [...]
versioning:
  current: "1.0.0"
  strategy: "..."
```

Flag any event spec missing required fields.

## 2. Schema Completeness

Read each event spec. The schema must:
- Include `eventId` (UUID) and `timestamp` (date-time) as standard fields
- Include all actual payload fields from the source code
- Every field must have: type, description

## 3. Consumer/Publisher Accuracy

Read each event spec. Verify consumer/publisher lists:
- Cross-reference with `.work/system-wide-notes/*.md` for consumer/publisher claims
- Every consumer must have: service name, handler path, processing mode (sync/async/batch)
- Every publisher must have: service name, trigger description, location (code path)

## 4. Source Code Traceability

Read each event spec. Every field in the schema must:
- Trace to a source code location (annotation, serialization class, message class)
- Flag fields that appear invented rather than extracted from code

## 5. Cross-Event Consistency

Read all event specs together. Verify:
- Consistent naming conventions across all events
- Consistent field formats (same field name = same type across events)
- Consistent versioning strategy across all events
- No duplicate event names

## 6. Cross-Reference with Cross-cutting Patterns

Cross-reference with `knowledge/01-global-standards/cross-cutting-patterns.md`:
- Event taxonomy in cross-cutting must match event types in specs
- Event versioning strategy must match cross-cutting conventions

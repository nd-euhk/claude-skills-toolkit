# APIs Gate Check Criteria

Load this file when verifying the **apis** phase (system-wide merge). Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

**Artifact:** `knowledge/02-central-contracts/apis/{svc}-api.yaml` (one per service, OpenAPI 3.0)

## 1. OpenAPI 3.0 Structure

Glob `knowledge/02-central-contracts/apis/*-api.yaml`. For each API spec, verify required OpenAPI sections:
- `info` — title, version, description
- `servers` — base URL, environment variants
- `paths` — endpoint definitions with HTTP methods
- `components/schemas` — request/response models
- `components/securitySchemes` — auth method
- `tags` — endpoint grouping by domain/EPIC

Flag any spec missing required sections.

## 2. Endpoint Completeness

For each API spec, cross-reference with:
- `knowledge/04-microservices/{svc}/FR-*.md` — every FR with an API endpoint must appear in the spec
- `knowledge/04-microservices/{svc}/tech-design.md` — all endpoints described must appear

Flag any missing endpoints.

## 3. Error Responses

Read each API spec. For every endpoint, verify:
- Error responses are defined (at minimum: 400, 401, 404, 500)
- Error response schemas reference global error codes where applicable
- Flag endpoints missing error response definitions

## 4. Schema Quality

Read each API spec. Verify request/response schemas:
- Every property has: type, description
- Required fields are explicitly marked
- Nested objects are properly expanded (not just `type: object`)

## 5. Source Code Traceability

Read each API spec. Every endpoint must:
- Trace to an FR-ID or source code path (controller, route, annotation)
- Flag endpoints that appear invented rather than extracted from code

## 6. Cross-API Consistency

Read all API specs together. Verify:
- Consistent path naming conventions across services
- Consistent error response format across services
- Consistent pagination patterns
- API versioning strategy is consistent

## 7. Consistency with C4

Cross-reference with `knowledge/03-system-architecture/C4-context-diagram.md`:
- Inter-service API calls in C4 must have corresponding API specs
- External API dependencies in C4 must be documented

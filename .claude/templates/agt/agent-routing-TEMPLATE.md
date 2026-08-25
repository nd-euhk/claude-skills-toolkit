---
title: "Agent Routing Table"
status: current
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on: []
referenced_by: []
changelog:
  - 1.0 | {{date}} | Initial routing table
---

# Agent Routing Table

> Agent đọc file này ĐẦU TIÊN khi nhận bất kỳ task nào.

## Reading Order

| Priority | File                                                                    | Luôn đọc?                         |
| -------- | ----------------------------------------------------------------------- | --------------------------------- |
| 1        | `hard-boundaries.md`                                                    | ✅ LUÔN                           |
| 2        | `conventions.md`                                                        | ✅ LUÔN                           |
| 3        | `features/FR-{xxx}.md`                                                  | Khi implement feature             |
| 4        | `contracts/api-{domain}.yaml`                                           | Khi cần API contract              |
| 5        | `{backend\|frontend}/{svc}/implementation/FR-{DOMAIN}-{NNN}--*-impl.md` | Khi implement                     |
| 6        | `{backend\|frontend}/{svc}/test-specs/FR-{DOMAIN}-{NNN}--*-test.md`     | Khi write tests                   |
| 7        | `tech-design/{service}-service.md`                                      | Khi cần architecture context      |
| 8        | `adrs/ADR-{NNN}.md`                                                     | Khi cần hiểu quyết định kiến trúc |
| 9        | `error-handling.md`                                                     | Khi implement error handling      |
| 10       | `caching-strategy.md`                                                   | Khi implement caching             |
| 11       | `event-schema.md`                                                       | Khi implement event-driven        |
| 12       | `migration-spec.md`                                                     | Khi viết DB migration             |
| 13       | `frontend-architecture.md`                                              | Khi implement frontend            |
| 14       | `scale-strategy.md`                                                     | Khi cần capacity planning         |
| 15       | `performance-test.md`                                                   | Khi viết performance tests        |
| 16       | `frontend-test-strategy.md`                                             | Khi viết frontend tests           |
| 17       | `db-operations.md`                                                      | Khi cần DB tuning                 |

**Stop-reading signal**: Khi đã có (1) Constraints + (2) WHAT + (3) HOW → bắt đầu code.

## Task → Files Mapping

| Task                       | Files cần load                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Implement backend feature  | hard-boundaries → conventions → FR spec → impl spec → test spec                           |
| Implement frontend feature | hard-boundaries → conventions → FR spec → api-routing → frontend-architecture → impl spec |
| Implement caching logic    | hard-boundaries → conventions → caching-strategy.md → tech-design/{service}               |
| Implement event-driven     | hard-boundaries → conventions → event-schema.md → tech-design/{service}                   |
| Implement error handling   | hard-boundaries → conventions → error-handling.md → impl spec                             |
| Write DB migration         | hard-boundaries → conventions → migration-spec.md → tech-design/{service}                 |
| Write frontend tests       | hard-boundaries → conventions → frontend-test-strategy.md → test spec                     |
| Write performance tests    | hard-boundaries → conventions → performance-test.md → scale-strategy.md                   |
| DB tuning / operations     | hard-boundaries → db-operations.md → tech-design/{service}                                |
| Capacity planning          | hard-boundaries → scale-strategy.md → architecture.md                                     |
| Bug fix                    | hard-boundaries → conventions → relevant code → FR spec (nếu có)                          |
| Code review                | hard-boundaries → git diff → FR spec → contracts                                          |
| Write tests only           | hard-boundaries → conventions → FR spec → test spec → contracts                           |

## File Map

```
agent_docs/
├── README.md                      ← BẠN ĐANG ĐÂY
├── hard-boundaries.md             ← Constraints tuyệt đối
├── conventions.md                 ← Coding style, patterns
├── project-overview.md            ← Condensed từ BRD
├── architecture.md                ← Condensed từ ADD
├── user-context.md                ← Condensed từ URD
├── roadmap.md                     ← SSOT timeline + sprint tasks
├── service-feature-matrix.md      ← Service → Feature mapping
│
├── features/
│   ├── README.md                  ← Dependency graph + impl order
│   └── FR-{DOMAIN}-{NNN}--{slug}.md
│
├── adrs/
│   └── ADR-{NNN}--{slug}.md      ← Architecture Decision Records
│
├── contracts/
│   ├── api-{domain}.yaml          ← OpenAPI specs
│   └── events.md                  ← Domain events
│
├── tech-design/
│   ├── cross-cutting.md
│   └── {name}-service.md          ← 9 sections per service
│
├── backend/{service}/
│   ├── implementation/FR-{DOMAIN}-{NNN}--*-impl.md
│   └── test-specs/FR-{DOMAIN}-{NNN}--*-test.md
│
├── frontend/{app}/
│   ├── api-routing.md             ← Page → API mapping
│   ├── implementation/FR-{DOMAIN}-{NNN}--*-impl.md
│   └── test-specs/FR-{DOMAIN}-{NNN}--*-test.md
│
├── performance/                   ← Performance test strategy
├── operations/                    ← Monitoring, incident, SLA
└── traceability/                  ← Requirements matrix
```

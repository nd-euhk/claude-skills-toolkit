# SDLC Standard Output Structure

Extracted from `../ai-agentic-starter-kit/_framework/sdlc/phase-*.md` on 2026-06-01.

## Canonical Directory Layout

```
agent_docs/
├── architecture.md                                    # Phase 6 — HLD agent summary
├── domain-service-mapping.yaml                        # Phase 6 — bounded context → service
├── hard-boundaries.md                                 # Phase 6 — ownership & reference rules
├── contracts/
│   ├── events.md                                      # Phase 6 — event taxonomy
│   ├── api-conventions.md                             # Phase 6 — API conventions
│   ├── api-{domain}.yaml                              # Phase 7 — OpenAPI per domain
│   └── error-codes.md                                 # Phase 7 — error code catalog
├── features/
│   └── FR-{DOMAIN}-{NNN}--{slug}.md                   # Phase 7 — work package (routing overlay)
├── tech-design/
│   ├── {name}-service.md                              # Phase 7 — per-service LLD (9 sections)
│   └── cross-cutting.md                               # Phase 7 — shared concerns
├── traceability/
│   └── requirements-matrix.md                         # Phase 5 — FR → PRD → BRD
├── backend/
│   ├── conventions.md                                 # Phase 8 — backend conventions
│   └── {service-name}/
│       ├── README.md                                  # Phase 8 — service overview
│       ├── implementation/
│       │   └── FR-{DOMAIN}-{NNN}--{slug}-impl.md      # Phase 8 — impl spec (10 sections)
│       └── test-specs/
│           └── FR-{DOMAIN}-{NNN}--{slug}-test.md      # Phase 9 — test spec (7 layers)
├── frontend/
│   ├── conventions.md                                 # Phase 8 — frontend conventions
│   └── {app-name}/
│       ├── implementation/
│       │   └── FR-{DOMAIN}-{NNN}--{slug}-impl.md      # Phase 8 — impl spec
│       └── test-specs/
│           └── FR-{DOMAIN}-{NNN}--{slug}-test.md      # Phase 9 — test spec
├── performance/
│   ├── README.md                                      # Phase 9 — perf overview
│   ├── nfr-mapping.md                                 # Phase 9 — NFR → perf test mapping
│   └── baseline.md                                    # Phase 9 — perf baseline
├── README.md                                          # Phase 10 — agent routing table
└── roadmap.md                                         # Phase 10 — feature roadmap (SSOT)

docs/
├── product/
│   ├── SRS.md                                         # Phase 5 — master SRS (overview + NFR catalog)
│   ├── SRS-BACKEND.md                                 # Phase 5 — backend SRS (large teams)
│   ├── SRS-FRONTEND.md                                # Phase 5 — frontend SRS (large teams)
│   └── features/epic-{slug}/
│       └── FR-{DOMAIN}-{NNN}--{slug}.md               # Phase 5 — enriched FR (Gherkin scenarios)
└── architecture/
    ├── system-architecture.md                         # Phase 6 — C4 Level 1/2 diagrams + narrative
    ├── ADRs/
    │   ├── ADR-001-service-decomposition.md           # Phase 6 — MANDATORY
    │   ├── ADR-002-api-gateway-and-versioning.md      # Phase 6 — MANDATORY
    │   ├── ADR-003-event-taxonomy.md                  # Phase 6 — MANDATORY
    │   └── ADR-{NNN}-{decision}.md                    # Phase 6 — additional ADRs
    └── diagrams/
        └── {name}.mermaid                             # Phase 6 — diagram sources

.work/
├── board.md                                           # Phase 10 — current sprint board
└── backlog.md                                         # Phase 10 — backlog
```

## Phase-by-Phase Output Summary

### Phase 05 (SRS)
| File | Type |
|------|------|
| `docs/product/SRS.md` | Master SRS (overview, NFR catalog, traceability) |
| `docs/product/SRS-BACKEND.md` | Backend SRS (large teams) |
| `docs/product/SRS-FRONTEND.md` | Frontend SRS (large teams) |
| `docs/product/features/epic-{slug}/FR-{DOMAIN}-{NNN}--{slug}.md` | Per-feature FR (Gherkin, >=3 error/edge cases) |
| `agent_docs/traceability/requirements-matrix.md` | SSOT trace FR → PRD → BRD |

### Phase 06 (HLD)
| File | Type |
|------|------|
| `docs/architecture/system-architecture.md` | C4 Level 1/2 diagrams + narrative |
| `docs/architecture/ADRs/ADR-{NNN}-{decision}.md` | 3 mandatory + additional ADRs |
| `docs/architecture/diagrams/{name}.mermaid` | Diagram source files |
| `agent_docs/architecture.md` | Agent-facing architecture summary (10 sections) |
| `agent_docs/domain-service-mapping.yaml` | Bounded context → service mapping |
| `agent_docs/hard-boundaries.md` | Ownership & reference rules |
| `agent_docs/contracts/events.md` | Event taxonomy |
| `agent_docs/contracts/api-conventions.md` | API conventions (versioning, error format, auth headers) |

### Phase 07 (LLD)
| File | Type |
|------|------|
| `agent_docs/tech-design/{name}-service.md` | Per-service LLD (9 sections: boundary, internal arch, domain model, API, clients, transactions, integrations, caching, perf/errors) |
| `agent_docs/tech-design/cross-cutting.md` | Shared concerns across services |
| `agent_docs/contracts/api-{domain}.yaml` | OpenAPI 3.1 per domain |
| `agent_docs/contracts/error-codes.md` | Error code catalog |
| `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | Work package per FR (routing overlay — links to FR spec, adds service+API info) |

### Phase 08 (IMP)
| File | Type |
|------|------|
| `agent_docs/backend/conventions.md` | Backend coding conventions |
| `agent_docs/backend/{service-name}/README.md` | Service overview |
| `agent_docs/backend/{service-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | Impl spec (10 sections, NO code snippets) |
| `agent_docs/frontend/conventions.md` | Frontend coding conventions |
| `agent_docs/frontend/{app-name}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | Impl spec |

### Phase 09 (TST)
| File | Type |
|------|------|
| `agent_docs/backend/{service-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | Test spec (7 layers) |
| `agent_docs/frontend/{app-name}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | Test spec |
| `agent_docs/performance/README.md` | Performance test overview |
| `agent_docs/performance/nfr-mapping.md` | NFR → perf test mapping |
| `agent_docs/performance/baseline.md` | Performance baselines |

### Phase 10 (AGT)
| File | Type |
|------|------|
| `AGENTS.md` | Vendor-neutral agent config |
| `agent_docs/README.md` | Routing table + file map |
| `agent_docs/roadmap.md` | Feature roadmap (SSOT) |
| `.work/board.md` | Current sprint board |
| `.work/backlog.md` | Backlog |

## Key Principles

| # | Principle | Detail |
|---|-----------|--------|
| 1 | **Nested per service** | `agent_docs/backend/{service-name}/` — keyed by service name, never project name |
| 2 | **No `agent_docs/projects/`** | SDLC does not create project subdirectories. Service names provide uniqueness |
| 3 | **agent_docs ≠ docs/** | `agent_docs/` = agent-facing (condensed, actionable). `docs/` = human-readable (full narrative). Never duplicate between the two |
| 4 | **Conventions per layer** | `agent_docs/backend/conventions.md` + `agent_docs/frontend/conventions.md` — no root-level conventions file |
| 5 | **Work packages at Phase 7** | `agent_docs/features/FR-*.md` = routing overlay linking back to FR spec. Created only when HLD (service decomposition) + tech-design are done |
| 6 | **Phase 5 does NOT create work packages** | `agent_docs/features/FR-*.md` is NOT created in Phase 5. Only traceability matrix goes to agent_docs |
| 7 | **agent_docs/ only** | Implementation specs, test specs, tech-design, work packages — all agent-only. Never in docs/ |

## Implications for Explore Workflow (Reverse Engineering)

When merging from sandbox to canonical:

**Category A — Service-scoped (direct copy, unique by service name):**
- `agent_docs/tech-design/{service-name}.md`
- `agent_docs/backend/{service-name}/implementation/`
- `agent_docs/backend/{service-name}/test-specs/`
- `agent_docs/frontend/{app-name}/implementation/`
- `agent_docs/frontend/{app-name}/test-specs/`

**Category B — Domain-scoped (direct copy, unique by domain slug):**
- `docs/product/features/epic-{domain-slug}/`
- `agent_docs/contracts/api-{domain}.yaml`
- `agent_docs/traceability/requirements-matrix-{CODE}.md` → merge into `agent_docs/traceability/requirements-matrix.md`

**Category C — Cross-project (synthesize, not replace):**
- `agent_docs/architecture.md` — merge, per-project sections
- `agent_docs/domain-service-mapping.yaml` — merge entries
- `agent_docs/hard-boundaries.md` — merge, per-project sections
- `agent_docs/contracts/events.md` — merge, deduplicate
- `agent_docs/contracts/api-conventions.md` — merge, deduplicate
- `agent_docs/contracts/error-codes.md` — merge, prefix by service
- `agent_docs/backend/conventions.md` — merge, deduplicate
- `agent_docs/frontend/conventions.md` — merge, deduplicate
- `agent_docs/performance/` — merge, per-service baselines
- `docs/product/SRS.md` — merge, per-project sections
- `docs/architecture/system-architecture.md` — from merged/ (Step 3c)
- `docs/architecture/ADRs/` — accumulate, prefix by project

**Category D — NOT created by explore (forward-engineering only):**
- `agent_docs/features/FR-*.md` — work packages (Phase 7). Explore skips these
- `agent_docs/backend/{service}/README.md` — service overview (Phase 8). Explore skips
- `agent_docs/README.md` — routing table (Phase 10). Explore skips
- `agent_docs/roadmap.md` — roadmap (Phase 10). Explore skips
- `.work/board.md` / `.work/backlog.md` — tracking (Phase 10). Explore skips

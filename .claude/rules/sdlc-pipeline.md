# SDLC Pipeline

Phase sequencing for forward and reverse SDLC pipelines. Route through these
phases based on the resolved flow — never skip a phase without explicit human
confirmation.

## Forward Pipeline (specs → code)

```
SRS → HLD → LLD → [CROSS-CUTTING] → IMP ∥ TST
                                  ↘ TDD cycle ↴
```

| Phase | Agent family | Produces | Skippable? |
|-------|-------------|----------|------------|
| SRS | `sdlc-srs` | Feature specs with Gherkin scenarios, NFRs, traceability | **Never** |
| HLD | `sdlc-hld` | C4 diagrams, ADRs, service boundaries, event taxonomy | With human confirmation |
| LLD | `sdlc-lld` | Per-service tech-design, domain models, API contracts, work packages | With human confirmation |
| CROSS-CUTTING | `sdlc-lld-error-handling`, `sdlc-lld-caching-strategy`, `sdlc-lld-performance-test`, `sdlc-lld-frontend-architecture`, `sdlc-lld-frontend-test-strategy` | System-wide standards synthesized from per-service LLD | With human confirmation; scope auto-detected from architecture |
| IMP | `sdlc-imp` | Per-feature implementation specs (execution flows, business rules, error mapping) | No |
| TST | `sdlc-tst` | Per-feature test specs (unit, integration, E2E, performance) | No |

CROSS-CUTTING runs after LLD, before IMP∥TST. Each of the 5 agents runs only
when its scope condition is met (e.g., caching-strategy only when
architecture.md §6 declares cache infrastructure).

IMP and TST run in parallel per feature — they share the same LLD work packages
but produce independent artifacts.

## Reverse Pipeline (code → specs)

```
Scout → HLD → LLD → LLD-Synthesis → SRS → SRS-Verify → SRS-Synthesis → [CROSS-CUTTING] → IMP ∥ TST
```

| Phase | Agent family | Consumes | Produces |
|-------|-------------|----------|----------|
| Scout | `sdlc-scout` skill | Codebase | Project discovery, file inventory, audit report |
| HLD | `codebase-hld` | Scout report | System architecture, C4 diagrams, ADRs from code patterns |
| LLD | `codebase-lld` (one per service) | Scout + HLD | Per-service tech-design from code artifacts |
| LLD-Synthesis | `codebase-lld-synthesis` | All per-service LLDs | Unified API contracts, canonicalized error codes, FR candidates |
| SRS | `codebase-srs` (one per domain) | Scout + HLD + LLD | Inferred functional + non-functional requirements |
| SRS-Verify | `codebase-srs-verify` (one per domain) | Per-domain SRS | Adversarial verification through 3 skeptic lenses |
| SRS-Synthesis | `codebase-srs-synthesis` | All verified SRS outputs | Cross-domain traceability, unified feature index |
| CROSS-CUTTING | `codebase-cross-cutting-*` (5 agents) | Per-service LLD + architecture | System-wide standards from observed code patterns |
| IMP | `codebase-imp` (one per domain) | Scout + HLD + LLD + SRS | Per-domain implementation pattern documentation |
| TST | `codebase-tst` (one per domain) | Scout + IMP + actual test files | Per-domain test pattern documentation |

## TDD Cycle (cook flow + quick flow)

```
Baseline capture → per-TC RED → GREEN → INTERFERENCE-LIGHT → REFACTOR-light → GATE-light → INTERFERENCE-FULL → REFACTOR-full → GATE-full
```

| Step | Agent | Modes |
|------|-------|-------|
| RED | `sdlc-tdd-be-red` / `sdlc-tdd-fe-red` | One test case, detects accidental green + interference |
| GREEN | `sdlc-tdd-be-green` / `sdlc-tdd-fe-green` | Minimal implementation for one TC |
| REFACTOR | `sdlc-tdd-be-refactor` / `sdlc-tdd-fe-refactor` | `light` (per-TC) or `full` (after GATE-light) |
| GATE | `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate` | `light` (4 checks) or `full` (10 checks) |

Quick flow uses a reduced cycle: RED (1 TC, no interference/refactor) → GREEN
(minimal) → GATE-light (4 checks). No REFACTOR-full, no GATE-full.

## Gate Protocol

Every phase agent output MUST pass its corresponding gate before the next phase
starts. Gate agents are read-only — they verify, never modify.

- **Forward pipeline gates**: `sdlc-gate` validates SRS, HLD, LLD, CROSS-CUTTING, IMP, TST outputs against structured per-phase criteria with retry context (max 3 attempts) and regression detection
- **Reverse pipeline gates**: `codebase-gate` validates HLD, LLD, LLD-Synthesis, SRS, SRS-Synthesis, IMP, TST outputs against code-evidence-based criteria
- **TDD gates**: GATE-light after GREEN, GATE-full after REFACTOR-full (via `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate`)
- **Gate failure**: stop the pipeline, report which criteria failed, propose next action. Critical criteria stop pipeline immediately regardless of retry count.
- **Never proceed past a failing gate** without human approval

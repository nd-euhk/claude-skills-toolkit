# SDLC Pipeline Rules

Phase sequencing cho forward và reverse SDLC pipeline. Route qua các phase này dựa trên
flow đã resolve — không bao giờ skip phase nếu không có explicit human confirmation.

## Forward Pipeline (specs → code)

```
SRS → HLD → LLD → [CROSS-CUTTING] → IMP ∥ TST
                                  ↘ TDD cycle ↴
```

| Phase | Agent family | Produces | Skippable? |
|-------|-------------|----------|------------|
| SRS | `sdlc-srs` | Feature specs với Gherkin scenarios, NFRs, traceability | **Never** |
| HLD | `sdlc-hld` | C4 diagrams, ADRs, service boundaries, event taxonomy | Với human confirmation |
| LLD | `sdlc-lld` | Per-service tech-design, domain models, API contracts, work packages | Với human confirmation |
| CROSS-CUTTING | `sdlc-lld-error-handling`, `sdlc-lld-caching-strategy`, `sdlc-lld-performance-test`, `sdlc-lld-frontend-architecture`, `sdlc-lld-frontend-test-strategy` | System-wide standards synthesized từ per-service LLD | Với human confirmation; scope auto-detected từ architecture |
| IMP | `sdlc-imp` | Per-feature implementation specs (execution flows, business rules, error mapping) | No |
| TST | `sdlc-tst` | Per-feature test specs (unit, integration, E2E, performance) | No |

CROSS-CUTTING chạy sau LLD, trước IMP∥TST. Mỗi agent trong 5 agent chỉ chạy khi scope
condition của nó được đáp ứng (vd: caching-strategy chỉ khi architecture.md §6 declares
cache infrastructure).

IMP và TST chạy parallel per feature — chúng share cùng LLD work packages nhưng produce
independent artifacts.

## Reverse Pipeline (code → specs)

```
Scout → HLD → LLD → LLD-Synthesis → SRS → SRS-Verify → SRS-Synthesis → [CROSS-CUTTING] → IMP ∥ TST
```

| Phase | Agent family | Consumes | Produces |
|-------|-------------|----------|----------|
| Scout | `sdlc-scout` skill | Codebase | Project discovery, file inventory, audit report |
| HLD | `codebase-hld` | Scout report | System architecture, C4 diagrams, ADRs từ code patterns |
| LLD | `codebase-lld` (one per service) | Scout + HLD | Per-service tech-design từ code artifacts |
| LLD-Synthesis | `codebase-lld-synthesis` | All per-service LLDs | Unified API contracts, canonicalized error codes, FR candidates |
| SRS | `codebase-srs` (one per domain) | Scout + HLD + LLD | Inferred functional + non-functional requirements |
| SRS-Verify | `codebase-srs-verify` (one per domain) | Per-domain SRS | Adversarial verification qua 3 skeptic lenses |
| SRS-Synthesis | `codebase-srs-synthesis` | All verified SRS outputs | Cross-domain traceability, unified feature index |
| CROSS-CUTTING | `codebase-cross-cutting-*` (5 agents) | Per-service LLD + architecture | System-wide standards từ observed code patterns |
| IMP | `codebase-imp` (one per domain) | Scout + HLD + LLD + SRS | Per-domain implementation pattern documentation |
| TST | `codebase-tst` (one per domain) | Scout + IMP + actual test files | Per-domain test pattern documentation |

## TDD Cycle (cook flow + quick flow)

```
Baseline capture → per-TC RED → GREEN → INTERFERENCE-LIGHT → REFACTOR-light → GATE-light
                                                                                         ↘ INTERFERENCE-FULL → REFACTOR-full → GATE-full
```

| Step | Agent | Modes |
|------|-------|-------|
| RED | `sdlc-tdd-be-red` / `sdlc-tdd-fe-red` | One test case, detects accidental green + interference |
| GREEN | `sdlc-tdd-be-green` / `sdlc-tdd-fe-green` | Minimal implementation cho một TC |
| REFACTOR | `sdlc-tdd-be-refactor` / `sdlc-tdd-fe-refactor` | `light` (per-TC) hoặc `full` (sau GATE-light) |
| GATE | `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate` | `light` (4 checks) hoặc `full` (10 checks) |

Quick flow dùng reduced cycle: RED (1 TC, no interference/refactor) → GREEN (minimal) →
GATE-light (4 checks). Không REFACTOR-full, không GATE-full.

## Test Intent Principle

<EXTREMELY-IMPORTANT>
Test phải verify INTENT, không chỉ BEHAVIOR. Một test không thể fail khi business logic
thay đổi là test sai — nó test implementation detail, không test business rule.
</EXTREMELY-IMPORTANT>

- **Business rule first** — mỗi test case phải map đến một business rule cụ thể từ SRS
  hoặc IMP spec. Nếu không chỉ ra được business rule nào → test có thể không cần thiết.
- **Test tên phải nói WHY** — `should_apply_volume_discount_when_order_exceeds_100_units`
  thay vì `should_call_pricing_service_with_correct_args`. Tên test là business outcome,
  không phải code path.
- **Refactor an toàn** — khi refactor, test chỉ fail nếu business behavior thay đổi. Nếu
  test fail vì bạn đổi function name hoặc restructure code → test đang test
  implementation, không phải intent.
- **Counter-signal**: mock quá nhiều implementation detail (internal method call, private
  field access) → test đang khóa implementation, không phải behavior. Mock at boundary,
  not internals.

---

## Gate Protocol

<EXTREMELY-IMPORTANT>
Mọi phase agent output PHẢI pass gate tương ứng trước khi phase tiếp theo bắt đầu. Gate
agents là read-only — chúng verify, không bao giờ modify. Không bao giờ proceed past
failing gate nếu không có human approval.
</EXTREMELY-IMPORTANT>

- **Forward pipeline gates**: `sdlc-gate` validates SRS, HLD, LLD, CROSS-CUTTING, IMP, TST outputs dựa trên structured per-phase criteria với retry context (max 3 attempts) và regression detection
- **Reverse pipeline gates**: `codebase-gate` validates HLD, LLD, LLD-Synthesis, SRS, SRS-Synthesis, IMP, TST outputs dựa trên code-evidence-based criteria
- **TDD gates**: GATE-light sau GREEN, GATE-full sau REFACTOR-full (qua `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate`)
- **Gate failure**: dừng pipeline, report criteria nào failed, propose next action. Critical criteria dừng pipeline ngay lập tức bất kể retry count.

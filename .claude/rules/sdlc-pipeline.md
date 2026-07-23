# SDLC Pipeline

Phase sequencing cho forward và reverse SDLC pipelines. Route qua các phase
này dựa trên flow đã resolve — không bao giờ skip một phase mà không có xác
nhận rõ ràng từ human.

## Forward Pipeline (specs → code)

```
SRS → HLD → LLD → [CROSS-CUTTING] → IMP ∥ TST
                                  ↘ TDD cycle ↴
```

| Phase | Agent family | Sản phẩm | Có thể skip? |
|---|---|---|---|
| SRS | `sdlc-srs` | Feature specs với Gherkin scenarios, NFRs, traceability | **Không bao giờ** |
| HLD | `sdlc-hld` | C4 diagrams, ADRs, service boundaries, event taxonomy | Có, với xác nhận của human |
| LLD | `sdlc-lld` | Per-service tech-design, domain models, API contracts, work packages | Có, với xác nhận của human |
| CROSS-CUTTING | `sdlc-lld-error-handling`, `sdlc-lld-caching-strategy`, `sdlc-lld-performance-test`, `sdlc-lld-frontend-architecture`, `sdlc-lld-frontend-test-strategy` | System-wide standards tổng hợp từ per-service LLD | Có, với xác nhận của human; scope auto-detected từ architecture |
| IMP | `sdlc-imp` | Per-feature implementation specs (execution flows, business rules, error mapping) | Không |
| TST | `sdlc-tst` | Per-feature test specs (unit, integration, E2E, performance) | Không |

CROSS-CUTTING chạy sau LLD, trước IMP∥TST. Mỗi trong 5 agent chỉ chạy khi
scope condition của nó được đáp ứng (ví dụ: caching-strategy chỉ khi
architecture.md §6 khai báo cache infrastructure). Khi auto-detect scope từ
architecture.md + SRS NFRs, dùng `Agent("sdlc-fable-thinking")` để verify scope
đúng trước khi dispatch.

IMP và TST chạy song song cho mỗi feature — chúng chia sẻ cùng LLD work
packages nhưng tạo ra các artifact độc lập.

## CR Flow Pipeline (change request)

CR flow là biến thể của forward pipeline: thêm pre-step impact analysis để
xác định phase nào bị ảnh hưởng, sau đó chạy forward pipeline với selective
phase skipping.

```
Impact Analysis → [SRS] → [HLD] → [LLD] → [CROSS-CUTTING] → [IMP] ∥ [TST]
                                                     ↘ TDD cycle ↴
```

Các phase trong ngoặc vuông `[]` = chỉ chạy nếu bị ảnh hưởng bởi change.

### Impact Analysis

Trước khi chạy bất kỳ phase nào, xác định blast radius:

1. **Xác định code artifacts bị ảnh hưởng** — file nào, service nào, API nào
2. **Map code → specs** — code artifacts đó thuộc FR-IDs nào, domain nào
3. **Xác định phase bị ảnh hưởng**:
   - API contracts thay đổi → HLD + LLD bị ảnh hưởng
   - Business rules thay đổi → SRS bị ảnh hưởng
   - Error flows thay đổi → error-handling (CROSS-CUTTING) bị ảnh hưởng
   - Cache behavior thay đổi → caching-strategy (CROSS-CUTTING) bị ảnh hưởng
   - Frontend patterns thay đổi → frontend-architecture + frontend-test-strategy (CROSS-CUTTING) bị ảnh hưởng
   - NFR targets thay đổi → performance-test (CROSS-CUTTING) bị ảnh hưởng
4. **Đọc các file nền tảng**: `agent_docs/hard-boundaries.md` (cross-service constraints) và cross-cutting files nếu có
5. **Dùng fable-thinking Agent** để verify scope trước khi chạy pipeline (xem `sdlc-fable-thinking-rules.md`)

### Impact Report

Sản phẩm của impact analysis là bảng blast radius (phase nào bị ảnh hưởng + lý
do) + risk assessment (breaking change?, rollback strategy). Format cụ thể do
orchestrator agent quyết định dựa trên context CR.

### Nguyên tắc CR

- **Không chạy phase không bị ảnh hưởng** — CR thường chỉ cần SRS delta + IMP delta
- **HLD/LLD chỉ chạy nếu API contracts hoặc service boundaries thay đổi**
- **CROSS-CUTTING chỉ chạy nếu cross-cutting standards bị ảnh hưởng** — error flows, cache strategy, frontend patterns, hoặc NFR targets
- **TST luôn chạy nếu IMP chạy** — test specs phải reflect CR changes
- **Impact report là critical artifact** — nó quyết định scope của toàn bộ pipeline
- **Phát hiện breaking change → cảnh báo human**: "CR này là BREAKING CHANGE. Cần version bump + migration plan."
- **CR ảnh hưởng code đã cook (done/review)** → "Code đã tồn tại cho feature này. Sau khi update specs → cần flow cook để sync code với specs mới."
- **CR gây conflict với task đang in-progress** → "Task {X} đang in-progress sẽ bị ảnh hưởng. Đề xuất: hoàn thành task hiện tại trước CR, hoặc merge CR vào task đang làm."

## Reverse Pipeline (code → specs)

```
Scout → HLD → LLD → LLD-Synthesis → SRS → SRS-Verify → SRS-Synthesis → [CROSS-CUTTING] → IMP ∥ TST
```

| Phase | Agent family | Đầu vào | Sản phẩm |
|---|---|---|---|
| Scout | `sdlc-scout` skill | Codebase | Project discovery, file inventory, audit report |
| HLD | `codebase-hld` | Scout report | System architecture, C4 diagrams, ADRs từ code patterns |
| LLD | `codebase-lld` (một agent/service) | Scout + HLD | Per-service tech-design từ code artifacts |
| LLD-Synthesis | `codebase-lld-synthesis` | Tất cả per-service LLDs | Unified API contracts, canonicalized error codes, FR candidates |
| SRS | `codebase-srs` (một agent/domain) | Scout + HLD + LLD | Inferred functional + non-functional requirements |
| SRS-Verify | `codebase-srs-verify` (một agent/domain) | Per-domain SRS | Adversarial verification qua 3 skeptic lenses |
| SRS-Synthesis | `codebase-srs-synthesis` | Tất cả verified SRS outputs | Cross-domain traceability, unified feature index |
| CROSS-CUTTING | `codebase-cross-cutting-*` (5 agents) | Per-service LLD + architecture | System-wide standards từ observed code patterns |
| IMP | `codebase-imp` (một agent/domain) | Scout + HLD + LLD + SRS | Per-domain implementation pattern documentation |
| TST | `codebase-tst` (một agent/domain) | Scout + IMP + actual test files | Per-domain test pattern documentation |

## TDD Cycle (cook flow + quick flow)

```
Baseline capture → per-TC RED → GREEN → INTERFERENCE-LIGHT → REFACTOR-light → GATE-light → INTERFERENCE-FULL → REFACTOR-full → GATE-full
```

| Bước | Agent | Modes | Ghi chú |
|---|---|---|---|
| RED | `sdlc-tdd-be-red` / `sdlc-tdd-fe-red` | Một test case | Phát hiện accidental green + interference. INTERFERENCE-LIGHT là một phần của RED phase — RED agent kiểm tra TC mới có làm vỡ TC cũ không |
| GREEN | `sdlc-tdd-be-green` / `sdlc-tdd-fe-green` | Implementation tối thiểu cho một TC | |
| REFACTOR | `sdlc-tdd-be-refactor` / `sdlc-tdd-fe-refactor` | `light` (per-TC) hoặc `full` (sau GATE-light) | |
| GATE | `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate` | `light` (4 checks) hoặc `full` (10 checks) | |

Quick flow dùng chu trình rút gọn: RED (1 TC, không interference/refactor) →
GREEN (tối thiểu) → GATE-light (4 checks). Không REFACTOR-full, không GATE-full.

Khi RED agent phát hiện **interference** (TC mới làm vỡ TC cũ): dùng `Agent("sdlc-fable-thinking", {prompt: "Decision: TDD Interference. Context: OBSERVED: TC mới + TC cũ cùng shared dependency, failure output. PRIOR: interference thường là real bug khi shared code thay đổi. ASSUMED: TC mới implementation làm thay đổi behavior của shared code. Options: A) Real interference — dừng pipeline, B) False positive — tiếp tục, C) TC cũ cần update — behavior mới đúng. Goal: xác định interference thật hay không, pipeline không dừng oan. Verify: đọc shared code sau implement + TC cũ test file + chạy TC cũ với input hợp lệ."})` để verify real interference hay false positive trước khi dừng pipeline.

## Gate Protocol

Mọi phase agent output PHẢI vượt qua gate tương ứng trước khi phase tiếp theo
bắt đầu. Gate agents là read-only — chúng verify, không bao giờ sửa.

- **Forward pipeline gates**: `sdlc-gate` validate SRS, HLD, LLD, CROSS-CUTTING, IMP, TST outputs dựa trên structured per-phase criteria với retry context (tối đa 3 lần) và regression detection. Gate verdict handling tuân theo `sdlc-review-rules.md`.
- **Reverse pipeline gates**: `codebase-gate` validate HLD, LLD, LLD-Synthesis, SRS, SRS-Synthesis, IMP, TST outputs dựa trên code-evidence-based criteria
- **TDD gates**: GATE-light sau GREEN, GATE-full sau REFACTOR-full (qua `sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate`)
- **Gate failure**: dừng pipeline, báo cáo criteria nào fail, đề xuất hành động tiếp theo. Critical criteria dừng pipeline ngay lập tức bất kể retry count.
- **Sau 3 retry không pass**: dùng `Agent("sdlc-fable-thinking", {prompt: "Decision: Gate Failure Strategy. Context: OBSERVED: gate fail criteria + số lần retry + output của từng lần retry. PRIOR: gate fail sau 3 retry thường là criteria quá strict hoặc agent không hiểu criteria. ASSUMED: criteria có thể được cover ở tầng khác (infrastructure, interceptor). Options: A) Skip gate với caveat — document coverage ở đâu, B) Retry thêm với instruction rõ hơn, C) Abort pipeline, nhờ human. Goal: pipeline tiếp tục không bỏ sót genuine gap. Verify: đọc gate report từ lần fail gần nhất + artifact được gate + codebase xem criteria đã được cover chưa."})` để đánh giá strategy — skip gate, continue manual, hay abort?
- **Không bao giờ proceed qua failing gate** nếu không có human approval

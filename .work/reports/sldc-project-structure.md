# SDLC Framework — Cấu trúc Dự án & Outputs

## Tổng quan

SDLC (Software Development Life Cycle) framework này định nghĩa quy trình phát triển phần mềm gồm **16 phase** (Phase 0–15), được thiết kế đặc biệt để hỗ trợ **AI agent** (Claude Code) làm việc hiệu quả. Framework kết hợp AI automation và human oversight, với cơ chế "gate" (cổng chặn) đảm bảo chất lượng ở mỗi bước.

- **Phiên bản**: 3.3.0 (cập nhật 2026-04-24)
- **Ngôn ngữ**: Tiếng Việt
- **Nguồn**: `/home/khuend/projects/AI/Kit/ai-agentic-starter-kit/sdlc/phase-{00..15}.md`

### Triết lý chính

1. **Gate-based**: Mỗi phase có "Gate Criteria" — điều kiện bắt buộc phải pass trước khi chuyển sang phase tiếp theo
2. **Tailoring**: Mô tả chế độ "Solo / Small / Medium / Large / Regulated" tùy theo quy mô dự án
3. **Agent-first**: Nhiều output được thiết kế riêng cho AI agent đọc (`agent_docs/`), tách biệt với tài liệu cho người (`docs/`)
4. **Traceability**: Mỗi yêu cầu có thể trace từ code nguồn ngược lại đến BRD
5. **Anti-patterns**: Mỗi phase đều có danh sách "điều không nên làm"
6. **Versioned**: Tất cả tài liệu đều có frontmatter YAML với version, phase_id, inputs, outputs

---

## 16 Phase của SDLC

### Phase 0: INT — Intake & Investment Gate
- **Mã**: INT
- **Tagline**: "CÓ NÊN LÀM?"
- **Owner**: BA, PO, Founder
- **Mục đích**: Trả lời câu hỏi "có nên làm dự án này KHÔNG?" — là kill gate cho những ý tưởng chưa chín
- **Kỳ vọng**: 40-60% idea bị **Hold hoặc Kill** — đó là bình thường

**Output**:
- `docs/intake/{idea-slug}.md`
- `agent_docs/intake/{idea-slug}-decision.md`

**Decision**: Go / Hold / Kill

---

### Phase 1: BRD — Business Requirements Document
- **Mã**: BRD
- **Tagline**: "TẠI SAO làm?"
- **Owner**: BA, PO, Business
- **Mục đích**: Trả lời "TẠI SAO" tổ chức cần xây dựng hệ thống? Vấn đề kinh doanh là gì?
- **Nguyên tắc quan trọng**: BRD không nói về tech. "React", "PostgreSQL", "microservices" = sai.

**Output**:
- `docs/business/BRD.md`
- `docs/business/business-rules/{name}.md`
- `agent_docs/project-overview.md`

---

### Phase 2: PRD — Product Requirements Document
- **Mã**: PRD
- **Tagline**: "Làm CÁI GÌ?"
- **Owner**: PO
- **Mục đích**: Chuyển từ "vấn đề kinh doanh" sang "sản phẩm cần xây dựng"
- **Quy tắc đặt tên FR**: `FR-{DOMAIN}-{NNN}--{slug}.md` — MỖI FR 1 FILE RIÊNG

**Output**:
- `docs/product/PRD.md`
- `docs/product/features/epic-{name}/FR-*.md`
- `docs/product/release-criteria.md`
- `agent_docs/features/FR-*.md`

---

### Phase 3: URD — User Requirements Document
- **Mã**: URD
- **Tagline**: "Cho AI?"
- **Owner**: BA
- **Mục đích**: Trả lời "Ai" thật sự dùng hệ thống — họ là ai, trong môi trường nào, với thiết bị gì?

**Output**:
- `docs/user/URD.md`
- `docs/user/usability-requirements.md`
- `docs/user/user-profiles/{user-type}.md`
- `agent_docs/user-context.md`

---

### Phase 4: UX — UX/UI Specification
- **Mã**: UX
- **Tagline**: "Trông THẾ NÀO?"
- **Owner**: Designer
- **Mục đích**: Giao diện "trông như thế nào", user "tương tác ra sao"?
- **Interaction Contracts** (Mới v2.0): Behavioral spec dạng text mô tả step-by-step khi user tương tác thì UI phải làm gì

**Output**:
- `docs/ux/UX-UI-SPEC.md`
- `docs/ux/wireframes/*.png`
- `docs/ux/component-specs/{component}.md`
- `docs/ux/design-tokens.md`
- `docs/ux/interactions/{flow-name}.md`

---

### Phase 5: SRS — Software Requirements Specification
- **Mã**: SRS
- **Tagline**: "ĐẶC TẢ CHÍNH XÁC: FRs + Gherkin Scenario Outline, NFRs, contracts"
- **Owner**: Tech Lead + QA
- **Mục đích**: Phase **bản lề** — chuyển từ ngôn ngữ business sang ngôn ngữ kỹ thuật chính xác, đo lường, verify được bằng test
- **Ranh giới phase**: SRS đặc tả WHAT ở mức behavior, KHÔNG chứa quyết định Phase 6 (service decomposition, API path) hoặc Phase 7 (tech-design internals)

**Output**:
- `docs/product/SRS.md`
- `docs/product/features/epic-*/FR-*.md` (enrich lên SRS-level)
- `agent_docs/traceability/requirements-matrix.md`

---

### Phase 6: HLD — High-Level Design (Architecture)
- **Mã**: HLD
- **Tagline**: "HỆ THỐNG ra sao? C4 diagrams, ADRs, hard boundaries"
- **Owner**: Architect
- **Mục đích**: Hệ thống "được cấu thành từ những gì", chúng "giao tiếp thế nào", data "ai sở hữu", và "tại sao" chọn cách này?

**Output**:
- `docs/architecture/system-architecture.md`
- `docs/architecture/ADRs/ADR-*.md`
- `docs/architecture/diagrams/*.mermaid`
- `agent_docs/architecture.md`
- `agent_docs/domain-service-mapping.yaml`
- `agent_docs/hard-boundaries.md`
- `agent_docs/contracts/events.md`
- `agent_docs/contracts/api-conventions.md`

---

### Phase 7: LLD — Technical Design (Low-Level Design)
- **Mã**: LLD
- **Tagline**: "TỪNG SERVICE: 9 mục nội bộ + work package cho agent"
- **Owner**: Senior Developer / Team Lead
- **Mục đích**: Bên trong mỗi service/module hoạt động thế nào — domain model, transaction boundary, cache, integration, fallback, error flows
- **9 mục cố định cho mỗi service**: Service Boundary, Internal Architecture, Domain Model, REST Clients, Transaction Boundaries, Integration Points, Caching Strategy, Performance & Scale, Error Flows & Degraded Mode

**Output**:
- `agent_docs/tech-design/{name}-service.md`
- `agent_docs/tech-design/cross-cutting.md`
- `agent_docs/contracts/api-{domain}.yaml`
- `agent_docs/features/FR-*.md` (Work package với routing overlay)

---

### Phase 8: IMP — Implementation Specification
- **Mã**: IMP
- **Tagline**: "DECISION + FLOW + TRACEABILITY ở mức feature (không phải code)"
- **Owner**: Senior Dev / AI (AI FULL DRAFT → human review)
- **Mục đích**: Cho feature cụ thể, "chạm vào đâu, flow nào, rule nào, chấp nhận khi nào?"
- **10 mục Backend Implementation**: Purpose, References, Affected Areas, Execution Flow, Business Rules Realized, Data & State Impact, Error Mapping, Security & Authorization, Implementation Notes, Acceptance Checklist

**Output**:
- `agent_docs/backend/{service}/implementation/FR-*-impl.md`
- `agent_docs/frontend/{app}/implementation/FR-*-impl.md`

---

### Phase 9: TST — Test Specification
- **Mã**: TST
- **Tagline**: "TEST cases: unit, integration, E2E, performance (TDD-first)"
- **Owner**: Senior Dev / AI (AI FULL DRAFT → human review)
- **Mục đích**: Agent đọc xong viết được test TRƯỚC implementation (TDD)

**Output**:
- `agent_docs/backend/{service}/test-specs/FR-*-test.md`
- `agent_docs/frontend/{app}/test-specs/FR-*-test.md`
- `agent_docs/performance/*`

---

### Phase 10: AGT — Agent Setup
- **Mã**: AGT
- **Tagline**: "AGENT CONFIG: AGENTS.md, routing, roadmap, validation protocol"
- **Owner**: Tech Lead
- **Mục đích**: Phase cuối của Spec & Setup — setup để AI agent bắt đầu code

**Output**:
- `AGENTS.md`
- `agent_docs/README.md` (routing table + File Map)
- `agent_docs/roadmap.md` (Single Source of Truth cho timeline)
- `.work/board.md`
- `.work/backlog.md`
- `scripts/check-*.sh`

---

### Phase 11: EXE — Agent Execution (Agentic TDD Loop)
- **Mã**: EXE
- **Tagline**: "Agent THỰC THI code: TDD loop tự động, 3 execution modes"
- **Owner**: Agent (Claude Code) — **AI tự chạy TDD loop**
- **3 Execution Modes**: Supervised, Semi-Autonomous, Full Autonomous
- **TDD Protocol**: PLAN → RED (write tests, verify fail) → GREEN (implement, verify pass) → REFACTOR → REPORT → INTEGRATION CHECK

**Output**:
- `projects/{service}/src/**`
- `.work/plans/{feature}-plan.md`
- `.work/reports/{feature}-report.md`

---

### Phase 12: QAG — Quality Assurance Gate
- **Mã**: QAG
- **Tagline**: "Quality gates: lint, test, security scan, human review"
- **Owner**: QA + Tech Lead
- **Mục đích**: Automated + human quality verification TRƯỚC khi merge

**Output**:
- CI/CD results
- Human review approval
- PR merged
- Traceability chain populated

---

### Phase 13: STG — Staging Deployment & Verification
- **Mã**: STG
- **Tagline**: "Deploy staging, smoke test, integration verify"
- **Owner**: DevOps + QA
- **Mục đích**: Deploy lên staging — môi trường gần giống production nhất — verify end-to-end trước khi ship

**Output**:
- Staging deployment healthy
- Smoke test report
- Integration sign-off
- Performance baseline

---

### Phase 14: REL — Production Release
- **Mã**: REL
- **Tagline**: "Deploy production, canary/blue-green, rollback plan"
- **Owner**: DevOps + Tech Lead
- **Mục đích**: Ship code lên production an toàn, có kiểm soát, có khả năng rollback nhanh
- **Deployment Strategy**: Rolling Update (thấp), Blue-Green (trung bình), Canary (cao)

**Output**:
- Production deployment
- Post-deploy smoke tests pass
- Release notes
- roadmap.md updated

---

### Phase 15: OPS — Operate, Monitor & Feedback Loop
- **Mã**: OPS
- **Tagline**: "Monitor, alert, incident response, feedback → docs update"
- **Owner**: SRE + Team
- **Mục đích**: Production không phải đích cuối — đó là **khởi đầu** của vòng lặp feedback
- **Bug-to-Doc-to-Fix Cycle**: Bug → Incident → Root cause → Update docs → Agent fix → QA → Staging → Production

**Output**:
- Monitoring configs
- Operations docs (monitoring-spec, incident-response, sla-targets, runbooks)
- Incident reports

---

## Vòng đời tổng thể (4 giai đoạn)

| Giai đoạn | Phase | Mô tả |
|---|---|---|
| 1. Khởi tạo & Kinh doanh | 0–3 | Từ ý tưởng (Intake) đến xác định yêu cầu kinh doanh (BRD), sản phẩm (PRD), người dùng (URD) |
| 2. Thiết kế Giao diện & Kỹ thuật | 4–7 | UX/UI, đặc tả phần mềm (SRS), kiến trúc (HLD), thiết kế kỹ thuật (LLD) |
| 3. Chuẩn bị & Thực thi Agent | 8–11 | Implementation spec, Test spec, Agent setup, và Agent code thực tế (TDD loop) |
| 4. Kiểm tra & Vận hành | 12–15 | Quality gate, Staging, Production release, và Operation/feedback loop |

---

## Cấu trúc thư mục tổng thể

```
/ (project root)
├── AGENTS.md                              # Vendor-neutral agent config (Phase 10)
├── CLAUDE.md                              # Claude-specific config
│
├── docs/                                  # Tài liệu cho NGƯỜI đọc
│   ├── intake/{idea-slug}.md              # Phase 0
│   ├── business/
│   │   ├── BRD.md                         # Phase 1
│   │   └── business-rules/{name}.md       # Phase 1
│   ├── product/
│   │   ├── PRD.md                         # Phase 2
│   │   ├── SRS.md                         # Phase 5
│   │   ├── release-criteria.md            # Phase 2
│   │   └── features/epic-{name}/FR-*.md   # Phase 2 → Phase 5
│   ├── user/
│   │   ├── URD.md                         # Phase 3
│   │   ├── usability-requirements.md      # Phase 3
│   │   └── user-profiles/{user-type}.md   # Phase 3
│   ├── ux/
│   │   ├── UX-UI-SPEC.md                  # Phase 4
│   │   ├── wireframes/*.png               # Phase 4
│   │   ├── component-specs/{component}.md # Phase 4
│   │   ├── design-tokens.md               # Phase 4
│   │   └── interactions/{flow-name}.md    # Phase 4
│   └── architecture/
│       ├── system-architecture.md         # Phase 6
│       ├── ADRs/ADR-{NNN}-{decision}.md   # Phase 6
│       └── diagrams/{name}.mermaid        # Phase 6
│
├── agent_docs/                            # Tài liệu cho AI AGENT đọc
│   ├── README.md                          # Routing table (Phase 10)
│   ├── project-overview.md                # Phase 1
│   ├── user-context.md                    # Phase 3
│   ├── architecture.md                    # Phase 6
│   ├── domain-service-mapping.yaml        # Phase 6
│   ├── hard-boundaries.md                 # Phase 6
│   ├── roadmap.md                         # Phase 10
│   ├── contracts/
│   │   ├── api-conventions.md             # Phase 6
│   │   ├── api-{domain}.yaml              # Phase 7 (OpenAPI)
│   │   ├── events.md                      # Phase 6
│   │   └── error-codes.md                 # Phase 7
│   ├── features/
│   │   ├── README.md                      # Phase 2
│   │   └── FR-{DOMAIN}-{NNN}--{slug}.md   # Phase 7 (Work package)
│   ├── tech-design/
│   │   ├── README.md                      # Phase 7
│   │   ├── cross-cutting.md               # Phase 7
│   │   └── {name}-service.md              # Phase 7 (9 mục)
│   ├── traceability/
│   │   └── requirements-matrix.md         # Phase 5
│   ├── backend/{service}/
│   │   ├── implementation/FR-*-impl.md    # Phase 8
│   │   └── test-specs/FR-*-test.md        # Phase 9
│   ├── frontend/{app}/
│   │   ├── implementation/FR-*-impl.md    # Phase 8
│   │   └── test-specs/FR-*-test.md        # Phase 9
│   ├── performance/                       # Phase 9
│   └── operations/                        # Phase 15
│       ├── monitoring-spec.md
│       ├── incident-response.md
│       ├── sla-targets.md
│       └── runbooks/{service}-runbook.md
│
├── projects/{service}/src/**              # Source code (Phase 11)
│
├── infra/
│   ├── ci-cd/qa-gate.yml                  # Phase 12
│   ├── staging/**                          # Phase 13
│   ├── production/**                       # Phase 14
│   └── monitoring/                        # Phase 15
│
├── .work/                                 # Work tracking
│   ├── board.md                           # Phase 10
│   ├── backlog.md                         # Phase 10
│   ├── plans/{feature}-plan.md            # Phase 11
│   ├── reports/{feature}-report.md        # Phase 11
│   └── incidents/INC-{NNN}-{slug}.md      # Phase 15
│
└── scripts/                               # Automation scripts
    ├── check-docs-sync.sh                 # Phase 10
    ├── check-traceability.sh              # Phase 10
    ├── smoke-test.sh                      # Phase 13
    └── trace-fr.sh                        # Phase 12
```

---

## Các phase quan trọng nhất cho AI agent

| Phase | Vai trò |
|---|---|
| **Phase 7 (LLD)** | Work package — cho agent biết code vào đâu |
| **Phase 8 (IMP)** | Impl spec — cho agent biết code như thế nào |
| **Phase 9 (TST)** | Test spec — cho agent biết test ra sao (TDD) |
| **Phase 10 (AGT)** | Agent setup — cấu hình agent sẵn sàng làm việc |
| **Phase 11 (EXE)** | Thực thi — agent tự chạy TDD loop |

---

## Templates được tham chiếu

| Template | Phase |
|---|---|
| `_templates/agent_docs/intake-lite-TEMPLATE.md` | Phase 0 |
| `_templates/agent_docs/intake-full-TEMPLATE.md` | Phase 0 |
| `docs/_template/INTERACTION/INTERACTION-CONTRACT-TEMPLATE.md` | Phase 4 |
| `agent_docs/_template/migration-spec-TEMPLATE.md` | Phase 8 |
| `agent_docs/_template/performance-test-TEMPLATE.md` | Phase 9 |
| `agent_docs/_template/release-notes-TEMPLATE.md` | Phase 14 |
| `agent_docs/_template/monitoring-spec-TEMPLATE.md` | Phase 15 |
| `agent_docs/_template/incident-response-TEMPLATE.md` | Phase 15 |
| `agent_docs/_template/sla-targets-TEMPLATE.md` | Phase 15 |
| `agent_docs/_template/SPEC-BOUNDARIES.md` | Phase 8 |
| `FR-TEMPLATE.md` | Phase 7 |

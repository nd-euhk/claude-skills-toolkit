# Kiểm kê Output — Skills & Subagents

> **Phạm vi:** Tất cả skills và subagents, **trừ** skill-refiner, skill-composer, skill-tester, subagent-creator, subagent-tester.
> **Ngày tổng hợp:** 2026-06-03

---

## PHẦN 1: OUTPUT CỦA SKILLS

### 1. architect
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Plan file | `.work/plans/arch-{design\|review\|advisory}-YYYYMMDD-{slug}.md` | Sau Plan Mode (nếu không có --auto) |
| Toàn bộ output của architect-specialist | (xem phần agent bên dưới) | Trong phase execution |
| Gate verification report | (từ gate-verifier agent) | Sau khi architect-specialist hoàn thành |
| Sprint sync | (từ sprint skill) | Sau gate pass |
| Summary report | `.work/reports/` | Cuối workflow |

### 2. ask-user-question
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Câu trả lời từ user | (trong hội thoại) | Sau mỗi lần gọi AskUserQuestion |
| Không có file output | — | Đây là skill methodology, không tự sinh file |

### 3. debugging
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Diagnostic report | `.work/debugs/DEBUG-YYYYMMDD--{topic}--{slug}.md` | Sau khi debugger agent hoàn thành |
| Không tự sinh file | — | Là skill technique, load references và spawn debugger agent |

### 4. explore-codebase
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| repomix snapshot | `.work/repomix/{project-name}--{slug}.xml` | Phase 1 (Scout - Repomix) |
| Scout reports | `.work/scouts/scout-YYYYMMDD-{project-name}--{slug}.md` | Phase 2 (Scout) |
| Plan file | `.work/plans/explore-YYYYMMDD--{slug}.md` | Phase 3 (Plan, nếu không có --auto) |
| SRS + FR files + traceability matrix | `docs/product/SRS.md`, `docs/product/features/.../FR-*.md`, `agent_docs/traceability/requirements-matrix.md` | Phase 4 (srs agent) |
| HLD: system architecture + ADRs + contracts | `docs/architecture/system-architecture.md`, `docs/architecture/ADRs/ADR-*.md`, `agent_docs/architecture.md`, `agent_docs/domain-service-mapping.yaml`, `agent_docs/hard-boundaries.md`, `agent_docs/contracts/` | Phase 4 (hld agent) |
| LLD: per-service tech-design | `agent_docs/tech-design/{name}-service.md` (1 file/service) | Phase 4 (lld-service agents, song song) |
| LLD merge: index + cross-cutting | `agent_docs/tech-design/README.md`, `agent_docs/tech-design/cross-cutting.md` | Phase 4 (lld-merge agent) |
| IMP specs | `agent_docs/{backend\|frontend}/{service\|app}/implementation/FR-*-impl.md` (1 file/FR) | Phase 4 (imp agents, song song) |
| TST specs | `agent_docs/{backend\|frontend}/{service\|app}/test-specs/FR-*-test.md` (1 file/FR) | Phase 4 (tst agents, song song với imp) |
| Gate verification reports | (từ gate-verifier agent sau mỗi phase) | Phase 4 (sau mỗi SDLC agent) |
| Sprint sync | (từ sprint skill) | Phase 5 |
| Summary report | `.work/reports/explore-YYYYMMDD--{slug}.md` | Phase 6 |

### 5. fixbug
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Scout report | (từ scout skill) | Step 1 |
| Diagnosis report | (trong hội thoại) | Step 2 |
| Bug artifacts | `.work/bugs/{BUG-ID}/context-snippets.json` | Step 5 |
| Bug artifacts | `.work/bugs/{BUG-ID}/risk-gate.json` | Step 5 |
| Bug artifacts | `.work/bugs/{BUG-ID}/verification.json` | Step 5 |
| Bug artifacts | `.work/bugs/{BUG-ID}/review-decision.json` | Step 5 |
| Code review | `.work/code-review/REVIEW-YYYYMMDD--{topic}--{slug}.md` (từ code-reviewer agent) | Step 5 |
| Sprint sync | (từ sprint skill) | Step 6 |
| Journal entry | `.work/journals/` (từ journal-writer agent) | Step 6 |
| Step markers | `✓ Step N: ...` (trong hội thoại) | Sau mỗi step |

### 6. git
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Git commits, push, PR, merge | (thao tác git thực tế) | Qua git-manager agent |
| Output markers | `✓ working branch: ...`, `✓ staged: ...`, `✓ security: ...`, `✓ commit: ...`, `✓ pushed: ...` | Sau mỗi thao tác |

### 7. hook-creator
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Hook configuration | `hooks/hooks.json` (plugin project) hoặc `.claude/hooks.json` (regular project) | Sau khi tạo/xác thực/cải thiện |
| Validation report | (trong hội thoại) | Sau khi validate |

### 8. orchestrator
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Plan file | `.work/plans/{task\|cr\|cook}-YYYYMMDD-{FR-name}--{slug}.md` | Sau Plan Mode (nếu không có --auto) |
| **Task Workflow:** SRS + HLD + LLD + IMP + TST | (từ các SDLC agents tương ứng) | Tuần tự từng phase với gate verification |
| **CR Workflow:** HLD(opt) + LLD(opt) + IMP + TST | (từ các SDLC agents tương ứng) | Chỉ các phase cần thay đổi |
| **Cook Workflow:** TDD reports (red/green/refactor/gate) | `.work/reports/{feature}-red-report.md`, `-green-report.md`, `-refactor-report.md`, `-gate-report.md` | BE và FE song song |
| Sprint sync | (từ sprint skill) | Sau khi tất cả phases pass gate |
| Summary report | `.work/reports/` | Cuối workflow |

### 9. plugin-creator
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Plugin manifest | `.claude-plugin/plugin.json` | Khi tạo mới plugin |
| Marketplace config | `.claude-plugin/marketplace.json` | Khi publish ra marketplace |
| Cấu trúc thư mục | `skills/`, `agents/`, `hooks.json`, `.mcp.json`, `.lsp.json` | Khi tạo mới plugin |
| Validation output | (từ `claude plugin validate`) | Khi validate |
| Scan report | `/tmp/plugin-scan.json` | Automated scanning phase |

### 10. problem-solving
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Không có file output | — | Là skill methodology/technique, không tự sinh file |

### 11. repomix
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Packed repository file | `repomix-output.xml` (mặc định) hoặc path tùy chỉnh | Sau khi chạy repomix |
| Token count summary | (trong console output) | Sau khi pack xong |

### 12. scout
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Scout report | `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md` | Sau khi tất cả Explore agents hoàn thành |
| Report sections | Overview, Technologies, Directory Structure, Modules, Entry Points, Dependencies, Architectural Patterns | Trong scout report |

### 13. sequential-thinking
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Không có file output | — | Là reasoning methodology, output trong hội thoại dưới dạng `Thought N/M: ...` |

### 14. sprint
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Roadmap | `agent_docs/roadmap.md` | Qua sprint-master agent |
| Backlog | `.work/backlog.md` | Qua sprint-master agent |
| Board | `.work/board.md` | Qua sprint-master agent |
| Cross-reference updates | (cập nhật trong 3 file trên) | Khi sync status |

---

## PHẦN 2: OUTPUT CỦA SUBAGENTS

### architect-specialist
**Design Mode:**
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| System architecture doc | `docs/architecture/system-architecture.md` | Step 1 |
| ADR-001: Service Decomposition | `docs/architecture/ADRs/ADR-001-service-decomposition.md` | Step 2 |
| ADR-002: API Conventions | `docs/architecture/ADRs/ADR-002-api-conventions.md` | Step 2 |
| ADR-003: Event Taxonomy | `docs/architecture/ADRs/ADR-003-event-taxonomy.md` | Step 2 |
| Additional ADRs | `docs/architecture/ADRs/ADR-004-*.md` | Step 2 (nếu cần) |
| Agent architecture summary | `agent_docs/architecture.md` | Step 3 |
| Domain-service mapping | `agent_docs/domain-service-mapping.yaml` | Step 3 |
| Hard boundaries | `agent_docs/hard-boundaries.md` | Step 3 |
| API conventions | `agent_docs/contracts/api-conventions.md` | Step 4 |
| Event schema | `agent_docs/contracts/events.md` | Step 4 |
| C4 System Context diagram | `docs/architecture/diagrams/system-context.mermaid` | Step 5 |
| C4 Container diagram | `docs/architecture/diagrams/container-diagram.mermaid` | Step 5 |
| Data flow diagram | `docs/architecture/diagrams/data-flow.mermaid` | Step 5 |

**Review Mode:**
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Architecture assessment | `agent_docs/architecture-reviews/architecture-assessment-{date}.md` | Step 2 |
| Recommendations | `agent_docs/architecture-reviews/recommendations-{date}.md` | Step 3 |
| Gap ADRs | `docs/architecture/ADRs/ADR-*.md` | Step 4 |
| Health dashboard | `agent_docs/architecture-reviews/health-dashboard.md` | Step 5 |

**Advisory Mode:**
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Advisory report | `agent_docs/architecture-reviews/advisory-{topic}-{date}.md` | Kết thúc phân tích |

### brainstormer
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Brainstorm summary report | `.work/brainstorming/BRAIN-YYYYMMDD--{topic}--{slug}.md` | Documentation Phase (phase 6) |
| Implementation plan (optional) | `.work/plans/plan-YYYYMMDD--{topic}--{slug}.md` | Finalize Phase (nếu user chọn Yes) |

### code-reviewer
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Code review report | `.work/code-review/REVIEW-YYYYMMDD--{topic}--{slug}.md` | Sau khi review hoàn thành |
| Report sections | Scope, Overall Assessment, Critical/High/Medium/Low Issues, Edge Cases, Positive Observations, Recommended Actions, Metrics | Trong review report |

### debugger
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Diagnostic report | `.work/debugs/DEBUG-YYYYMMDD--{topic}--{slug}.md` | Sau khi investigation hoàn thành |
| Report sections | Executive Summary, Technical Analysis, Actionable Recommendations, Supporting Evidence | Trong diagnostic report |

### fullstack-developer
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Phase implementation report | (trong hội thoại / message) | Sau khi implementation hoàn thành |
| Modified source files | (theo phase's File Ownership) | Trong quá trình implementation |
| Report format | Phase, Plan, Status, Files Modified, Tasks Completed, Tests Status, Issues, Next Steps | Trong implementation report |

### gate-verifier
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Gate verification report | (trong hội thoại) | Sau khi kiểm tra tất cả criteria |
| Report sections | Verdict (PASS/FAIL), Findings table, FR Granularity Audit (srs only), Summary, Cross-Phase Consistency (nếu verify nhiều phase) | Trong gate report |

### git-manager
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Git commits | (trong git history) | Sau mỗi lần commit |
| Git push | (trên remote) | Sau mỗi lần push |
| PR creation | (trên GitHub/GitLab) | Sau khi tạo PR |
| Merge | (trong git history) | Sau khi merge |
| Operation summary | (trong hội thoại / message) | Sau mỗi thao tác |

### hld
(Cùng output như architect-specialist Design Mode)

| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| System architecture doc | `docs/architecture/system-architecture.md` | Step 1 |
| ADRs (tối thiểu 3) | `docs/architecture/ADRs/ADR-*.md` | Step 2 |
| Agent architecture summary | `agent_docs/architecture.md` | Step 3 |
| Domain-service mapping | `agent_docs/domain-service-mapping.yaml` | Step 3 |
| Hard boundaries | `agent_docs/hard-boundaries.md` | Step 3 |
| API conventions | `agent_docs/contracts/api-conventions.md` | Step 4 |
| Event schema | `agent_docs/contracts/events.md` | Step 4 |
| C4 diagrams | `docs/architecture/diagrams/*.mermaid` | Step 5 |

### imp
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Backend implementation spec | `agent_docs/backend/{service}/implementation/FR-{DOMAIN}-{NNN}-impl.md` | 1 file/FR (10 sections) |
| Frontend implementation spec | `agent_docs/frontend/{app}/implementation/FR-{DOMAIN}-{NNN}-impl.md` | 1 file/FR (10 sections) |
| Spec sections | Purpose, References, Affected Areas, Execution Flow, Business Rules Realized, Data & State Impact, Error Mapping, Security & Authorization, Implementation Notes, Acceptance Checklist | Trong mỗi impl spec |

### journal-writer
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Journal entry | `.work/journals/` (theo naming pattern từ hooks) | Khi có sự kiện critical (bug, failure, etc.) |
| Entry sections | What Happened, The Brutal Truth, Technical Details, What We Tried, Root Cause Analysis, Lessons Learned, Next Steps | Trong mỗi entry |

### lld
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Tech design index | `agent_docs/tech-design/README.md` | Step 1 |
| Per-service tech design | `agent_docs/tech-design/{name}-service.md` | Step 2 (1 file/service, 9 sections) |
| Cross-cutting design | `agent_docs/tech-design/cross-cutting.md` | Step 3 |
| API contracts (OpenAPI) | `agent_docs/contracts/api-{domain}.yaml` | Step 4 |
| Feature work packages | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | Step 5 (1 file/FR) |

### lld-merge
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Tech design index | `agent_docs/tech-design/README.md` | Step 1 |
| Cross-cutting design | `agent_docs/tech-design/cross-cutting.md` | Step 2 |

### lld-service
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Per-service tech design | `agent_docs/tech-design/{service-name}-service.md` | Step 1 (9 sections) |
| API contracts (OpenAPI) | `agent_docs/contracts/api-{domain}.yaml` | Step 2 |
| Feature work packages | `agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md` | Step 3 (1 file/FR) |

### sprint-master
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Roadmap | `agent_docs/roadmap.md` | Khi create-roadmap / add-epic / sync |
| Backlog | `.work/backlog.md` | Khi create-backlog / add-feature / breakdown / sync |
| Board | `.work/board.md` | Khi create-board / add-task / breakdown / move / sync |
| Cross-reference updates | (trong 3 file trên) | Khi sync status |
| Sync summary report | (trong hội thoại) | Sau khi sync |

### srs
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| FR files (có Gherkin Scenario Outlines) | `docs/product/features/{epic-slug}/FR-{epic}-{NNN}--{slug}.md` | Step 1 (1 file/FR) |
| SRS document | `docs/product/SRS.md` | Step 2 |
| Traceability matrix | `agent_docs/traceability/requirements-matrix.md` | Step 3 |

### tester
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Test results report | (trong hội thoại / message) | Sau khi chạy tests |
| Report sections | Test Results Overview, Coverage Metrics, Failed Tests, Performance Metrics, Build Status, Critical Issues, Recommendations, Next Steps | Trong test report |

### tst
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Backend test spec | `agent_docs/backend/{service}/test-specs/FR-{DOMAIN}-{NNN}-test.md` | 1 file/FR |
| Frontend test spec | `agent_docs/frontend/{app}/test-specs/FR-{DOMAIN}-{NNN}-test.md` | 1 file/FR |
| NFR performance mapping | `agent_docs/performance/nfr-mapping.md` | Sau khi tất cả test specs hoàn thành |
| Performance baseline | `agent_docs/performance/baseline.md` | Sau khi tất cả test specs hoàn thành |
| Test spec sections | Risk Level, Unit Tests, Repository Tests, Controller/API Tests, Integration Tests, Client Tests (WireMock), Architecture Tests (ArchUnit), Performance Tests | Trong mỗi test spec |

### tdd-be-gate
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Gate report | `.work/reports/{feature}-gate-report.md` | Sau khi kiểm tra tất cả gates |
| Light mode (4 gates) | L1: Test Suite, L2: Hard Boundaries, L3: SQL Safety, L4: REST Client Resilience | Sau tdd-be-green |
| Full mode (10 gates) | L1-L4 + F5: Integration, F6: Lint, F7: Coverage, F8: Input Validation, F9: Error Handling, F10: Documentation | Sau tdd-be-refactor |

### tdd-be-green
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Domain model classes | `projects/{service}/src/main/java/.../domain/{Entity}.java` | Layer 1 |
| Repository interfaces | `projects/{service}/src/main/java/.../repository/{Entity}Repository.java` | Layer 2 |
| DTOs + Mappers | `projects/{service}/src/main/java/.../dto/{Feature}Request.java`, `Response.java`, `.../mapper/{Feature}Mapper.java` | Layer 3 |
| REST clients | `projects/{service}/src/main/java/.../client/{Target}ServiceClient.java` | Layer 4 |
| Service classes | `projects/{service}/src/main/java/.../service/{Feature}Service.java` | Layer 5 |
| Controller classes | `projects/{service}/src/main/java/.../controller/{Feature}Controller.java` | Layer 6 |
| DB migration | `projects/{service}/src/main/resources/db/migration/V{NNN}__{description}.sql` | Layer 7 |
| Configuration | `projects/{service}/src/main/java/.../config/{Feature}Config.java` | Layer 8 |
| Green report | `.work/reports/{feature}-green-report.md` | Step 5 |
| Stuck report | `.work/reports/{feature}-green-stuck.md` | Khi stuck sau 5 lần thử |

### tdd-be-red
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Unit tests (Service) | `projects/{service}/src/test/java/.../service/{Feature}ServiceTest.java` | Layer 1 |
| Controller tests | `projects/{service}/src/test/java/.../controller/{Feature}ControllerTest.java` | Layer 2 |
| Repository tests | `projects/{service}/src/test/java/.../repository/{Feature}RepositoryTest.java` | Layer 3 |
| REST client tests (WireMock) | `projects/{service}/src/test/java/.../client/{Target}ServiceClientTest.java` | Layer 4 |
| Integration tests | `projects/{service}/src/test/java/.../integration/{Feature}IntegrationTest.java` | Layer 5 |
| Architecture tests (ArchUnit) | `projects/{service}/src/test/java/.../architecture/{Feature}ArchitectureTest.java` | Step 3 |
| Red report | `.work/reports/{feature}-red-report.md` | Step 5 |

### tdd-be-refactor
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Refactored source files | (cập nhật src/main/java) | Trong quá trình refactor |
| Refactor report | `.work/reports/{feature}-refactor-report.md` | Sau khi refactor hoàn thành |
| Report format | `[{CATEGORY}] Mô tả thay đổi` | Trong refactor report |

### tdd-fe-gate
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Gate report | `.work/reports/{feature}-gate-report.md` | Sau khi kiểm tra tất cả gates |
| Light mode (4 gates) | L1: Unit Tests, L2: Token Security, L3: XSS Prevention, L4: State Coverage | Sau tdd-fe-green |
| Full mode (10 gates) | L1-L4 + F5: Type Check, F6: Lint, F7: E2E Tests, F8: Accessibility Audit, F9: API Resilience, F10: Documentation | Sau tdd-fe-refactor |

### tdd-fe-green
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Types + Zod schemas | `src/types/{feature}.ts` | Layer 1 |
| API client functions | `src/lib/api/{domain}.ts` | Layer 2 |
| Custom hooks | `src/hooks/use{Feature}.ts` | Layer 3 |
| Presentational components | `src/components/{feature}/{Component}.tsx` | Layer 4 |
| Container components | `src/components/{feature}/{Feature}Container.tsx` | Layer 5 |
| Page | `src/app/{route}/page.tsx` | Layer 6 |
| Routing config | (cập nhật route config) | Layer 7 |
| Green report | `.work/reports/{feature}-green-report.md` | Step 6 |
| Stuck report | `.work/reports/{feature}-green-stuck.md` | Khi stuck sau 5 lần thử |

### tdd-fe-red
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Component tests (Vitest) | `__tests__/{Component}.test.tsx` | Layer 1 |
| Hook tests (Vitest) | `__tests__/use{Hook}.test.ts` | Layer 2 |
| Integration tests (MSW) | `__tests__/{Feature}.integration.test.tsx` | Layer 3 |
| E2E tests (Playwright) | `e2e/{feature}.spec.ts` | Layer 4 |
| Red report | `.work/reports/{feature}-red-report.md` | Step 4 |

### tdd-fe-refactor
| Output | Đường dẫn | Khi nào sinh ra |
|--------|-----------|-----------------|
| Refactored source files | (cập nhật src/components, src/hooks, src/app) | Trong quá trình refactor |
| Refactor report | `.work/reports/{feature}-refactor-report.md` | Sau khi refactor hoàn thành |
| Report format | `[{CATEGORY}] Mô tả thay đổi` | Trong refactor report |

---

## PHẦN 3: BUILT-IN SKILLS (từ system prompt)

| Skill | Output | Khi nào sinh ra |
|-------|--------|-----------------|
| **deep-research** | Cited research report | Sau khi research + verify hoàn thành |
| **update-config** | Cập nhật `settings.json` / `settings.local.json` | Sau khi apply config |
| **keybindings-help** | Cập nhật `~/.claude/keybindings.json` | Sau khi rebind keys |
| **verify** | Verification results (pass/fail) | Sau khi run app và kiểm tra |
| **code-review** | Review findings (text hoặc PR comments) | Sau khi review diff |
| **simplify** | Applied fixes vào source code | Sau khi review + apply |
| **fewer-permission-prompts** | Cập nhật `.claude/settings.json` với allowlist | Sau khi scan transcripts |
| **loop** | Kết quả của mỗi lần chạy prompt | Theo interval (mặc định 10m) |
| **claude-api** | Code changes trong project | Trong quá trình build/debug |
| **run** | App running / screenshot | Sau khi launch app |
| **init** | `CLAUDE.md` file | Sau khi khởi tạo |
| **review** | PR review findings | Sau khi review PR |
| **security-review** | Security findings report | Sau khi review security |

---

## PHẦN 4: BUILT-IN AGENTS (từ system prompt)

| Agent | Output | Khi nào sinh ra |
|-------|--------|-----------------|
| **Explore** | Text findings về codebase (read-only) | Sau khi search hoàn thành |
| **Plan** | Implementation plan (trong hội thoại) | Sau khi phân tích và lập kế hoạch |
| **general-purpose** | Tùy thuộc vào task được giao | Sau khi hoàn thành task |
| **claude** | Tùy thuộc vào task (có tất cả tools) | Sau khi hoàn thành task |
| **claude-code-guide** | Hướng dẫn sử dụng (text) | Sau khi research |
| **statusline-setup** | Cập nhật status line config | Sau khi configure |

---

---

## ĐÍNH CHÍNH: `.work/reports/` KHÔNG CHỈ DÀNH CHO TDD

### Tất cả các file được viết vào `.work/reports/`:

| File | Sinh ra từ đâu | Khi nào |
|------|---------------|---------|
| `.work/tasks/task-YYYYMMDD-{FR-name}--{slug}.md` | orchestrator → Task Workflow → Phase 4 Summary | Sau khi SRS→HLD→LLD→IMP+TST hoàn thành + tất cả gates pass |
| `.work/cooks/cook-YYYYMMDD-{FR-name}--{slug}.md` | orchestrator → Cook Workflow → Phase 4 Summary | Sau khi TDD BE+FE hoàn thành + tất cả gates pass |
| `.work/reports/explore-YYYYMMDD--{slug}.md` | explore-codebase → Phase 6 Summary | Sau khi toàn bộ SDLC pipeline hoàn thành |
| `.work/reports/{feature}-red-report.md` | tdd-be-red / tdd-fe-red | Sau khi viết tests failed |
| `.work/reports/{feature}-green-report.md` | tdd-be-green / tdd-fe-green | Sau khi implementation pass tests |
| `.work/reports/{feature}-green-stuck.md` | tdd-be-green / tdd-fe-green | Khi stuck sau 5 lần thử |
| `.work/reports/{feature}-refactor-report.md` | tdd-be-refactor / tdd-fe-refactor | Sau khi refactor hoàn thành |
| `.work/reports/{feature}-gate-report.md` | tdd-be-gate / tdd-fe-gate | Sau khi gate verification hoàn thành |

### Các thư mục report KHÁC (không nằm trong `.work/reports/`):

| Thư mục | Dành cho |
|---------|---------|
| `.work/change-requests/` | **CR workflow summaries** — `cr-NNN-YYYYMMDD-{FR-name}--{slug}.md` |
| `.work/plans/` | Plan files từ architect, orchestrator, explore-codebase, brainstormer |
| `.work/scouts/` | Scout reports từ scout skill |
| `.work/repomix/` | Repomix snapshots |
| `.work/code-review/` | Code review reports từ code-reviewer agent |
| `.work/debugs/` | Diagnostic reports từ debugger agent |
| `.work/brainstorming/` | Brainstorm reports từ brainstormer agent |
| `.work/bugs/{BUG-ID}/` | Bug artifacts từ fixbug skill |
| `.work/journals/` | Journal entries từ journal-writer agent |

---

## CHI TIẾT: Luồng CR (Change Request) của Orchestrator

### Output của CR Workflow:

**Phase 1 — Pick Task:**
- Sprint-master chọn task có status **Done** hoặc **In Review** từ board

**Phase 2 — Plan (nếu không có --auto):**
- Plan file: `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md`
- Plan phải đánh giá: **HLD impact** (có/không + rationale) và **LLD impact** (có/không + rationale)

**Phase 3 — Execute CR Pipeline:**
- `Agent(hld)` → **CHỈ KHI** HLD bị ảnh hưởng
  - Output: cập nhật `docs/architecture/system-architecture.md`, ADRs, diagrams, contracts
- `Agent(gate-verifier)` → **CHỈ KHI** hld đã chạy
- `Agent(lld)` → **CHỈ KHI** LLD bị ảnh hưởng
  - Output: cập nhật `agent_docs/tech-design/*-service.md`, `agent_docs/contracts/api-*.yaml`, work packages
- `Agent(gate-verifier)` → **CHỈ KHI** lld đã chạy
- `Agent(imp)` + `Agent(tst)` → **LUÔN chạy** (song song)
  - Output: cập nhật/sửa `agent_docs/{backend,frontend}/*/implementation/FR-*-impl.md`
  - Output: cập nhật/sửa `agent_docs/{backend,frontend}/*/test-specs/FR-*-test.md`
- `Agent(gate-verifier)` × 2 → verify IMP và TST (song song)
- `Skill(sprint)` → thêm CR task vào Board với status **Ready** (hoặc **Blocked**)

**Phase 4 — Summary:**
- Report file: `.work/change-requests/cr-NNN-YYYYMMDD-{FR-name}--{slug}.md`
- Format: YAML frontmatter (title, type, status, hld_affected, lld_affected, phases_executed, changelog) + report body (task context, impact assessment, HLD changes, LLD changes, IMP summary, TST summary, gate results, artifacts modified table, final status)

**Phase 5 — Next Steps:**
- AskUserQuestion hỏi bước tiếp theo

### Điểm khác biệt chính giữa CR và Task Workflow:

| Khía cạnh | Task Workflow | CR Workflow |
|-----------|--------------|-------------|
| Task nguồn | Status **TODO** | Status **Done** hoặc **In Review** |
| SRS | **Luôn chạy** | **Không chạy** (CR dựa trên spec có sẵn) |
| HLD/LLD | **Luôn chạy** | **Có điều kiện** (chỉ khi plan xác định bị ảnh hưởng) |
| IMP+TST | Luôn chạy | Luôn chạy |
| Report path | `.work/reports/task-*.md` | `.work/change-requests/cr-NNN-*.md` |
| Output cuối | Task status: TODO → Ready | Task status: Done/In Review → Ready |

---

## CHI TIẾT: Fixbug Skill — Toàn bộ Output

### 3 Workflow Levels + Output tương ứng:

#### Quick Workflow (6 steps — vấn đề đơn giản)

| Step | Output | File/Artifact |
|------|--------|---------------|
| 1. Scout | `✓ Step 1: Scouted - [file], [N] direct deps` | Không có file, trong hội thoại |
| 2. Diagnose | `✓ Step 2: Diagnosed - Root cause: [brief]` + pre-fix state capture | Không có file, capture trong hội thoại |
| 3. Fix & Verify | `✓ Step 3: Fixed - [N] files, verified` | Source code changes + verification output |
| 4. Review + Prevent | `✓ Step 4: Review [score]/10` | `.work/code-review/REVIEW-YYYYMMDD--{topic}--{slug}.md` (từ code-reviewer) |
| 5. Report | `✓ Step 5: Reported` | (hội thoại) |
| 6. Finalize | `✓ Step 6: Finalized - sync-back, committed, journaled` | Sprint sync + git commit + `.work/journals/` entry |

#### Standard Workflow (6 steps — vấn đề trung bình)

| Step | Output | File/Artifact |
|------|--------|---------------|
| 1. Scout | `✓ Step 1: Scouted [N] areas - [M] files, [K] tests` | Scout report từ Skill(scout) hoặc Explore agents |
| 2. Diagnose | `✓ Step 2: Diagnosed - Root cause: [summary], Evidence: [brief], Scope: [N files]` | Pre-fix state capture + diagnosis report |
| 3. Implement | `✓ Step 3: Implemented - [N] files changed` | Source code changes |
| 4. Verify + Prevent | `✓ Step 4: Verified + Prevented - [before/after], [N] tests added, [M] guards` | `.work/bugs/{BUG-ID}/` artifacts (see below) |
| 5. Code Review | `✓ Step 5: Review [score]/10 - [status]` | `.work/code-review/REVIEW-*.md` |
| 6. Finalize | `✓ Step 6: Complete - [action]` | Sprint sync + git commit + `.work/journals/` |

#### Deep Workflow (9 steps — vấn đề phức tạp)

| Step | Output | File/Artifact |
|------|--------|---------------|
| 1. Scout | `✓ Step 1: Scouted - [N] files, system impact: [scope]` | Scout report (3+ Explore agents song song) |
| 2. Diagnose | `✓ Step 2: Diagnosed - Root cause: [summary], Evidence: [chain]` | Diagnosis report |
| 3. Research | `✓ Step 3: Research complete - [key findings]` | Research findings (từ general-purpose agent, song song với 1+2) |
| 4. Brainstorm | `✓ Step 4: Approach selected - [chosen]` | `.work/brainstorming/BRAIN-*.md` (từ brainstormer agent) |
| 5. Plan | `✓ Step 5: Plan created - [N] phases` | Implementation plan |
| 6. Implement | `✓ Step 6: Implemented - [N] files, [M] phases` | Source code changes |
| 7. Verify + Prevent | `✓ Step 7: Verified + Prevented - [N] tests, [M] guards` | `.work/bugs/{BUG-ID}/` artifacts |
| 8. Code Review | `✓ Step 8: Review [score]/10 - [status]` | `.work/code-review/REVIEW-*.md` |
| 9. Finalize | `✓ Step 9: Complete - [actions taken]` | Sprint sync + git commit + `.work/journals/` |

### `.work/bugs/{BUG-ID}/` Artifacts (Step Verify + Prevent):

Được tạo trong Step 4 (Standard) hoặc Step 7 (Deep), **bắt buộc trước khi finalize/commit/ship/push/PR/deploy**:

| Artifact | Nội dung |
|----------|---------|
| `context-snippets.json` | Root cause, repro steps, blast radius, public contracts affected |
| `risk-gate.json` | High-risk classification và auto-stop state |
| `verification.json` | Exact repro rerun results, test results, side-effect sweep results |
| `review-decision.json` | Code-reviewer decision (PASS/FAIL) |
| `adversarial-validation.json` | Required cho auto mode / high-risk / large-diff / ship-like work |

### BUG Summary Report (Step 6 Finalize):

Được tạo ở `.work/bugs/BUG-YYYYMMDD-{FR-ID}--{slug}.md` với format giống CR summary:

**YAML Frontmatter (REQUIRED):**
```yaml
---
title: "BUG-{NNN}: {Short Description}"
severity: critical | high | medium | low
status: diagnosed | fixed | verified | resolved | wont-fix
created: YYYY-MM-DD
updated: YYYY-MM-DD
affected_fr: "{FR-ID}: {FR title}"
root_cause: "{1-line root cause summary}"
workflow: quick | standard | deep
mode: autonomous | review | quick | parallel
artifacts:
  - context-snippets.json
  - risk-gate.json
  - verification.json
  - review-decision.json
confidence_score: X/10
review_score: X/10
changelog:
  - diagnosed | YYYY-MM-DD | Root cause identified: {summary}
  - fixed | YYYY-MM-DD | Fix implemented in {N} files
  - verified | YYYY-MM-DD | All tests pass, side-effect sweep clean
  - resolved | YYYY-MM-DD | Sprint sync complete, committed, journaled
---
```

**Report Body:** Root cause, Symptom vs cause, Fix applied, Blast radius, Side-effect sweep results, Prevention measures, Artifacts modified table, Gate artifacts list, Final status

### Review Cycle Logic (quyết định auto-approve hay cần human):

**Autonomous Mode:**
```
LOOP (max 3 cycles):
  1. Run code-reviewer → review-decision.json
  2. Run risk gate → risk-gate.json
  3. If auto/high-risk/large-diff/ship-like → run adversarial validator
  4. IF risk-gate.autoStopRequired AND not humanApproved → STOP (AskUserQuestion)
  5. IF review PASS + validator pass + no auto-stop → Auto-approved → PROCEED
  6. ELSE IF blocking issue AND cycle < 3 → Auto-fix → re-run tests → cycle++
  7. ELSE → ESCALATE to user
```

**Human-in-the-Loop Mode:**
```
ALWAYS:
  1. Run code-reviewer → review-decision.json
  2. Run adversarial/domain reviewers (khi risk triggers tồn tại)
  3. Display findings + AskUserQuestion với options:
     - Nếu validator blocks HOẶC critical_count > 0: "Fix blocking issues" / "Abort"
     - Nếu không: "Approve" / "Fix warnings" / "Abort"
  4. Handle response (max 3 fix cycles)
```

### Tổng kết tất cả output directories:

```
.work/
├── reports/           # TDD reports (red/green/refactor/gate) + Explore summary
├── tasks/             # Task workflow summaries
├── cooks/             # Cook workflow summaries
├── change-requests/   # CR workflow summaries
├── plans/             # Plan files từ architect, orchestrator, explore-codebase, brainstormer
├── scouts/            # Scout reports
├── repomix/           # Repomix XML snapshots
├── code-review/       # Code review reports
├── debugs/            # Diagnostic reports
├── brainstorming/     # Brainstorm reports
├── bugs/              # Bug summary reports (BUG-*.md) + bug artifacts (BUG-ID/*.json)
└── journals/          # Journal entries
```

---

## TÓM TẮT PHÂN LOẠI OUTPUT

### Output dạng file tài liệu SDLC:
- `docs/product/SRS.md`, `docs/product/features/.../FR-*.md`
- `docs/architecture/system-architecture.md`, `docs/architecture/ADRs/ADR-*.md`, `docs/architecture/diagrams/*.mermaid`
- `agent_docs/architecture.md`, `agent_docs/domain-service-mapping.yaml`, `agent_docs/hard-boundaries.md`
- `agent_docs/contracts/api-conventions.md`, `agent_docs/contracts/events.md`, `agent_docs/contracts/api-*.yaml`
- `agent_docs/tech-design/README.md`, `agent_docs/tech-design/*-service.md`, `agent_docs/tech-design/cross-cutting.md`
- `agent_docs/{backend,frontend}/*/implementation/FR-*-impl.md`
- `agent_docs/{backend,frontend}/*/test-specs/FR-*-test.md`
- `agent_docs/traceability/requirements-matrix.md`
- `agent_docs/performance/nfr-mapping.md`, `agent_docs/performance/baseline.md`
- `agent_docs/features/FR-*-*.md` (work packages)

### Output dạng file sprint:
- `agent_docs/roadmap.md`, `.work/backlog.md`, `.work/board.md`

### Output dạng file report (.work/):
- `.work/plans/*.md`
- `.work/reports/*.md` (red, green, refactor, gate reports)
- `.work/scouts/scout-*.md`
- `.work/repomix/*.xml`
- `.work/code-review/REVIEW-*.md`
- `.work/debugs/DEBUG-*.md`
- `.work/brainstorming/BRAIN-*.md`
- `.work/bugs/{BUG-ID}/*.json`
- `.work/journals/*.md`

### Output dạng source code:
- `projects/{service}/src/main/java/...` (backend implementation)
- `projects/{service}/src/test/java/...` (backend tests)
- `projects/{service}/src/main/resources/db/migration/...` (DB migration)
- `src/components/...`, `src/hooks/...`, `src/app/...`, `src/types/...`, `src/lib/api/...` (frontend implementation)
- `__tests__/...`, `e2e/...` (frontend tests)

### Output dạng configuration:
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- `hooks/hooks.json` hoặc `.claude/hooks.json`
- `.claude/settings.json`, `.claude/settings.local.json`
- `~/.claude/keybindings.json`

### Output dạng thao tác:
- Git commits, push, PR, merge
- Sprint artifact updates
- AskUserQuestion answers

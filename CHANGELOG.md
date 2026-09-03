# Changelog

All notable changes to the skills-toolkit plugin are documented here.

## [3.9.0] - 2026-09-03

### Added

- **4 agent TDD gate/refactor overnight:** `sdlc-tdd-be-gate-overnight`, `sdlc-tdd-fe-gate-overnight`,
  `sdlc-tdd-be-refactor-overnight`, `sdlc-tdd-fe-refactor-overnight` — trả structured JSON
  (`GATE_RESULT`/`REFACTOR_RESULT`) thay vì markdown như agent per-TC. Fix G2: workflow
  `schema` enforcement giờ khớp contract của agent (trước đó shared GATE/REFACTOR trả markdown
  xung đột với schema JSON).

### Changed

- **`sdlc-cook-overnight` 1.5.0:** MINOR — workflow dùng agent GATE/REFACTOR overnight (structured
  JSON) thay vì reuse agent per-TC; gate-fix retry route về REFACTOR (không phải GREEN); cập nhật
  per-feature-cook.md (agent list + interference/resume semantics) + unattended-policy.md
  (all-accidental-green).

### Fixed

- **`workflow-sdlc-cook-overnight.js`:**
  - **G1:** gate-fix retry dùng sai agent `GREEN_CHUNK` → chuyển về `REFACTOR` (persona sửa code
    quality khớp gate failures) + prompt "targeted fix, không full refactor".
  - **G3:** bỏ clobber `tcResults[].status = INTERFERENCE` — TC trong chunk vẫn giữ `DONE`
    (interference là test KHÁC bị break); detail nằm ở `warnings[]`, feature status `failed` qua
    guard `interferenceCount > 0`.
  - **G4:** thêm guard all-accidental-green (`doneCount===0 && skippedCount>0 && failedCount===0`)
    → trả `failed` thay vì báo `completed` với zero code.
  - **G5:** resume hỗ trợ `completedTcFiles` (map `{ tcId: [files] }`) bảo toàn `filesChanged`.
  - Cleanup: bỏ dead `STUCK` check; thêm note multi-batch (`redBatchSize > 1`) vào RED prompt.

## [3.8.0] - 2026-08-27

### Added

- **`workflow-sdlc-cook-overnight.js`:** workflow TDD **phased-batch** riêng cho overnight —
  RED batch (viết hết test, verify RED 1 lần, accidental-green LIGHT flag không sabotage) →
  GREEN chunk (3-5 TC/chunk + INTERFERENCE-LIGHT) → GATE light (INTERFERENCE-FULL baseline) →
  REFACTOR full → GATE full. Tách khỏi `workflow-sdlc-cook.js` (per-TC) — giảm ~60-75%
  wall-clock, ~70-80% token per-feature cho batch unattended. Hỗ trợ `redBatchSize`/
  `greenChunkSize` + idempotent resume (`resumeFrom`).
- **4 agent TDD batch:** `sdlc-tdd-be-red-overnight`, `sdlc-tdd-be-green-overnight`,
  `sdlc-tdd-fe-red-overnight`, `sdlc-tdd-fe-green-overnight` — RED batch (viết test cho
  batch, không mini-orchestrate/spawn), GREEN chunk (impl chunk + INTERFERENCE-LIGHT).
  Không đụng agent per-TC của sdlc-cook.

### Changed

- **`sdlc-cook-overnight` 1.4.0:** MINOR — Phase 4 dispatch `workflow-sdlc-cook-overnight.js`
  (phased-batch TDD) thay vì `workflow-sdlc-cook.js` per-TC. Cập nhật per-feature-cook.md
  (args mới + batch semantics) + unattended-policy.md (accidental-green SKIPPED = flag,
  không fail).

### Fixed

- **`workflow-sdlc-cook-overnight.js`:** guard `testCases` rỗng (tránh báo `completed` +
  tạo PR rỗng); mark TC chunk-sau là `ERROR` khi INTERFERENCE `break` (tránh báo sai
  `DONE`); `lightTcFilter` chỉ giữ `DONE`+`SKIPPED` (loại `BLOCKED`/`STALE` khỏi GATE);
  union `filesChanged` (giữ test files từ RED + impl files từ GREEN); early-return thêm
  `gateLight`/`refactorFull`/`gateFull: null` cho shape nhất quán.
- **`morning-report.md`:** mở rộng định nghĩa `PARTIAL` (có TC BLOCKED/STALE/ERROR nhưng
  gate vẫn pass), không chỉ "gate full fail".

## [3.7.4] - 2026-08-27

### Fixed

- **`workflow-sdlc-cook.js`:** PATCH — escape 2 backticks chưa escape trong `gateAgentPrompt()`
  L298 (nested template literal) gây `ReferenceError: scripts is not defined` khi GATE-light
  chạy với baseline file → workflow crash ở mọi feature tới gate. Đồng thời fix L269:
  single-quoted string → template literal để `${SPECS_ROOT}`/`${CODE_DIR}` được interpolate
  (trước đó agent đọc literal placeholder khi không có baseline).

## [3.7.3] - 2026-08-26

### Changed

- **`codebase-srs` 1.2.3:** PATCH — thêm **Naming rule** (reverse pipeline): `{DOMAIN}` = ONE
  uppercase token, NO hyphen — compound domain (vd module `payment-billing`) → domain chính vào
  `{DOMAIN}`, qualifier vào slug: `FR-PAYMENT-001--billing`, KHÔNG `FR-PAYMENT-BILLING-001`. Thêm
  Step 5 Self-Check cho tên file FR.
- **`codebase-gate` 1.1.1:** PATCH — thêm SRS criterion **S5**: FR filename theo single-token
  domain convention (`FR-[A-Z0-9]+-[0-9]{3,}(--[a-z0-9-]+)?.md`) — khép lỗ hổng gate tương đương
  sdlc-gate S6 ở reverse pipeline (post-write containment).
- **`sdlc-validate-agent-output.sh`:** fix false-positive — phase regex `sdlc-srs|codebase-srs`
  chặn `agent_docs/features/README.md`, nhưng codebase-srs Step 4 (Feature Index) bắt buộc viết
  file này (mâu thuẫn pre-existing từ trước FR-granularity guard). Thêm README.md vào allow-list
  cho cả forward + reverse; FR-*.md containment giữ nguyên.

## [3.7.2] - 2026-08-25

### Changed

- **`sdlc-srs`:** PATCH — thêm **Naming rule** — `{DOMAIN}` = ONE uppercase token, NO hyphen.
  Business area compound (vd "Payment & Billing") → domain chính vào `{DOMAIN}`, qualifier vào
  slug: `FR-PAYMENT-001--billing`, KHÔNG `FR-PAYMENT-BILLING-001`. Thêm self-check item cho tên file.
- **`sdlc-gate` 1.0.5:** PATCH — thêm SRS criterion **S6**: FR filename theo single-token domain
  convention (`FR-[A-Z0-9]+-[0-9]{3,}(--[a-z0-9-]+)?.md`) — bắt file compound-domain vượt qua
  validate hook (post-write containment).
- **`sdlc-validate-agent-output.sh`:** harden `extract_bash_paths()` — bắt `touch` (toàn bộ file
  args), sửa `cp`/`mv` capture **đúng** destination (last non-flag arg, xử lý multi-source). Khép
  các kênh Bash write lọt guard cho filename FR.
- **`sdlc-orchestrator` 1.15.2:** PATCH — flow-task spawn template chú thích `{DOMAIN}` single-token.
- **Templates:** `requirements-matrix-TEMPLATE`, `FR-TEMPLATE`, `feature-index-TEMPLATE` — ghi ràng
  buộc `{DOMAIN}` no-hyphen, compound → slug.

## [3.7.1] - 2026-08-25

### Changed

- **`agent-routing-TEMPLATE.md`:** chuẩn hóa ADR path còn sót `adr/` → `adrs/` — routing table
  (row 8) và directory tree khớp convention `agent_docs/adrs/`. Cùng class bug đã fix ở 3.6.0
  (validate script regex `adr/` → `adrs/`).
- **`workflow-sdlc-review-code.js`:** ARCH_PROMPT glob tìm ADR `**/adr/*.md` → `**/adrs/*.md` —
  glob cũ không match canonical `adrs/`, review bỏ sót ADR khi project theo convention mới.

## [3.7.0] - 2026-08-25

### Changed

- **`codebase-gate` 1.1.0:** MINOR — sửa **LLD-Synthesis criteria** cho khớp output thực tế của
  `codebase-lld-synthesis` (chỉ `contracts/api-*.yaml` + `contracts/error-codes.md`): LS1/LS4 trước
  đây check `cross-cutting.md` — file không bao giờ được sinh → gate không thể pass. LS1 → OpenAPI
  structure (`openapi:`/`paths:`), LS4 → service-ownership mapping trong error-codes.md. Thêm GATE:
  **CROSS-CUTTING** (5 criteria C1-C5, chỉ check file có trong `expectedOutputs`, còn lại N/A).
  Thêm `cross-cutting` vào phase table; IMP/TST read globs → `{backend,frontend}/*`.
- **`sdlc-codebase` 1.6.0:** MINOR — reverse pipeline giờ chạy **synthesis gates** (lld-synthesis +
  srs-synthesis, non-cascading) và **frontend routing** cho IMP/TST (file impl/test đặt dưới
  `backend/{svc}/` hoặc `frontend/{svc}/` theo service type của FR). Sửa reference `flow-reverse.md` +
  `procedures.md` — bỏ `cross-cutting.md` khỏi output LLD Synthesis.
- **`workflow-codebase-reverse.js`:** `gateCheck` nhận param `cascade` (default true) — synthesis
  gate fail không skip SRS/IMP/TST. Report phân biệt cascading vs non-cascading exhaustion. Thêm
  `rerunLldSynthesis`/`rerunSrsSynthesis` + feedback param cho 2 synthesis prompt. IMP/TST gate
  expectedOutputs phủ cả frontend globs.
- **`sdlc-gate` 1.0.4:** PATCH — bỏ Bash PreToolUse hook (chỉ giữ Write|Edit) để gate agent có thể
  enumerate file read-only; write vẫn bị chặn (defense-in-depth).
- **`sdlc-tdd-be-gate` / `sdlc-tdd-fe-gate`:** PATCH — bỏ Bash PreToolUse hook (giữ Write|Edit), tương tự `sdlc-gate`.
- **`.claude/scripts/sdlc-validate-agent-output.sh`:** `codebase-imp`/`codebase-tst` allowlist mở
  rộng sang `agent_docs/frontend/` (reverse pipeline giờ route frontend service). Bỏ mkdir path
  extraction (`mkdir -p` là setup hợp lệ; Write tool tự tạo parent dir).

## [3.6.1] - 2026-08-25

### Changed

- **`sdlc-srs`:** fix FR over-splitting — thêm **granularity rule** vào Step 1 "Discover
  Features": mỗi FR = một business capability (user-perceivable action có business rule riêng);
  KHÔNG tách field, validation rule, shared data element, hay cross-cutting concern thành FR
  độc lập (chúng là Input/validation trong FR, hoặc cross-cutting standards). Kèm
  **discriminator test** (xóa FR đi mà không business rule nào biến mất → không phải FR) và
  ví dụ `nextinput`. Thêm self-check tương ứng vào Step 5 Self-Check Gate.
- **`sdlc-orchestrator` 1.15.1:** PATCH — thêm criterion **S5** vào SRS Gate: mỗi FR map đến
  business capability, không có FR nào là field/validation/shared concern độc lập. Backstop
  cho granularity rule của `sdlc-srs`.
- **`sdlc-gate` 1.0.3:** PATCH — thêm criterion **S5** vào GATE: SRS (bảng criteria chính +
  per-criteria summary): mỗi FR map đến business capability. Đảm bảo gate agent thực sự
  enforce S5 khi chạy, không chỉ nằm ở orchestrator dispatch layer.
- **`subagents` (hooks):** fix validate hook command — đồng bộ `${CLAUDE_PROJECT_DIR}/.claude/scripts/
  sdlc-validate-agent-output.sh <phase>` cho toàn bộ 31 agent có PreToolUse hook. Trước đó 13 agent
  dùng `./scripts/...` (path sai → exit 127 = guard im lặng vô hiệu), 18 agent dùng `.claude/scripts/...`.
  Dùng placeholder `${CLAUDE_PROJECT_DIR}` vì hook command resolve theo cwd — deterministic bất kể
  working directory.
- **`.claude/scripts/sdlc-validate-agent-output.sh`:** siết allowlist path từ prefix-loose sang
  **exact filename patterns** — chống agent tự bịa tên file (FR/impl/test) khi context lớn. FR bắt
  buộc `FR-{DOMAIN}-{NNN}--{slug}.md` (forward) / `FR-{DOMAIN}-{NNN}.md` (reverse); impl/test bắt
  buộc suffix `-impl`/`-test`; tách `codebase-imp`/`codebase-tst` (backend-only) khỏi `sdlc-imp`/
  `sdlc-tst` (backend+frontend) theo đúng scope tài liệu; cho phép ADR index `adrs/README.md`; gate
  agent chặn mọi write (defense-in-depth). Verified 103/103 test case.
- **`agents` (ADR access):** cho phép đọc + refine ADR ở cả `agent_docs/adrs/` (canonical) và
  `agent_docs/adr/` (legacy — bộ cũ có thể ghi vào `adr/`). Read-instruction của 6 agent đọc ADR
  (sdlc-hld REFINE, sdlc-gate, codebase-gate, architect-specialist, human-docs-sync-architecture,
  human-docs-review) cập nhật check cả 2 dir; HLD/architect write allowlist nhận cả `adr/`.

## [3.6.0] - 2026-08-24

### Changed

- **`sdlc-automation` 1.11.0:** MINOR — thêm **Architecture Gate** vào Bước 3 Foundation Gate
  (mirror `sdlc-orchestrator`). Task flow bắt buộc đảm bảo `agent_docs/architecture.md` tồn tại
  trước khi dispatch workflow (MISSING → `Skill("sdlc-architect")` → plan-mode human gate →
  post-verify; vẫn missing → BLOCKED, không dispatch). Cr flow có điều kiện (chỉ khi chạm
  service boundary / human yêu cầu). Kiến trúc được chốt trong interactive preflight phase —
  không vi phạm plan-mode human gate của `architect`. Thêm row vào error-handling table;
  grilling-templates.md Round 3 ghi rõ không re-design (kiến trúc đã chốt ở Bước 3).
  **Giải quyết TODO defer automation ở v3.5.0** (orchestrator scope).
- **`sdlc-quick` 1.0.2:** PATCH — làm rõ architecture scope: quick KHÔNG mở rộng scope sang
  architecture. Change chạm service/boundary (G4) hoặc user yêu cầu kiến trúc → escalate lên
  orchestrator (sdlc-architect xử lý riêng). Trivial Gate note, When NOT to Use Quick (bullet +
  example row), triage-grill.md G4.

## [3.5.0] - 2026-08-24

### Changed

- **`sdlc-orchestrator` 1.15.0:** MINOR — thêm **Architecture Gate** vào Bước 3 Foundation Gate.
  Task flow bắt buộc đảm bảo `agent_docs/architecture.md` tồn tại trước SRS (MISSING → gọi
  `Skill("sdlc-architect")` → plan-mode human gate → post-verify; vẫn missing → BLOCKED, không
  proceed SRS). Cr flow có điều kiện (chỉ khi chạm service boundary / human yêu cầu). Thêm
  `sdlc-architect` vào Skill Reference; procedures.md §5.2 thêm row `agent_docs/architecture.md`.
  **Giải quyết TODO v3.3.0 "chưa tích hợp vào pipeline"** cho orchestrator; automation + codebase
  (reverse) defer.

## [3.4.0] - 2026-08-21

### Changed

- **`sdlc-architect` 1.1.0:** MINOR — đổi từ skill self-contained sang **gate/router**.
  Tự self-check `agent_docs/architecture.md`; chưa có → **bắt buộc** invoke skill `architect`
  (workflow `design`) để thiết kế; plan mode là human gate (human là **validator**, KHÔNG
  `--auto`); verify `architecture.md` tồn tại sau khi hoàn tất (MISSING → BLOCKED). Note
  status vào `.work/architecture-discussion-recap/architecture-discussion.md` trước khi route.
- **`architect` 1.1.0:** MINOR — align theo hướng **agent_docs/** (agent SSOT): design mode
  input từ `agent_docs/project-overview.md` (pre-SRS) thay vì `docs/product/SRS.md`; output
  CHỈ vào agent_docs/ (`architecture.md` C4 inline, `adrs/ADR-{NNN}--{slug}.md`,
  `domain-service-mapping.yaml`, `hard-boundaries.md`, `contracts/`); KHÔNG viết `docs/` —
  human docs xử lý riêng qua human-docs pipeline. **Bỏ gate-verifier** (agent `gate-verifier`
  không tồn tại) — không cần gate agent riêng; architect-specialist tự self-check output
  theo Gate Criteria của nó, human là validator qua plan mode.
- **`architect-specialist`:** align theo agent_docs/ — design/review/advisory output vào
  agent_docs/; C4 diagrams inline trong `architecture.md`; backfill điều kiện (chỉ khi post-SRS).
- **`sdlc-hld`:** đổi sang **REFINE, không recreate** — nếu `agent_docs/architecture.md` +
  `adrs/` đã tồn tại từ architect-specialist (pre-SRS logical architecture), giữ nguyên quyết
  định logical (style, service boundaries, event taxonomy), chỉ bổ sung chi tiết physical
  (data, security, infra) grounded trên FR/SRS. Không xóa quyết định pre-SRS nếu không có
  FR evidence + ADR thay thế.
- **`architect-specialist`:** 6 fix — (1) hook sửa từ `validate-output-path.sh` (KHÔNG tồn tại,
  guard "no docs/" đang silent no-op) sang `sdlc-validate-agent-output.sh architect` + thêm
  Bash matcher — guard giờ active; (2) input post-SRS trỏ `agent_docs/features/FR-*.md` +
  `traceability/requirements-matrix.md` thay `docs/product/SRS.md` (stale, mâu thuẫn agent_docs/
  direction); (3) bỏ Reverse-Engineering mode (reverse pipeline dùng `codebase-*`, không
  architect-specialist); (4) thêm Self-Check section bắt buộc — chạy Gate Criteria lên output
  thật, report PASS/FAIL từng criterion trước khi báo cáo; (5) example `domain-service-mapping.yaml`
  bỏ `ports` (implementation detail, mâu thuẫn gate "no implementation details").
- **`sdlc-validate-agent-output.sh`:** thêm phase `architect` (allow `architecture.md`, `adrs/`,
  `domain-service-mapping.yaml`, `hard-boundaries.md`, `contracts/`, `architecture-reviews/`,
  backfill `features/FR-*.md`); **fix regex `adr/` → `adrs/`** trong branch `sdlc-hld|codebase-hld`
  — trước đây block ADR writes vào `agent_docs/adrs/` (số nhiều) trong khi agent ghi `adrs/`,
  không phải `adr/`.
- **`architect` 1.1.0:** MINOR — **reframe thành consultant**: trao đổi, hướng dẫn, cấu trúc
  kiến trúc hệ thống — cùng human thảo luận để đạt kiến trúc mong muốn (hệ thống mới/khác,
  nâng cấp hiện tại, trao đổi thuần túy). Input (architecture.md, project-overview,
  user-context, FR) thành **optional context** — thiếu không blocker. **Bỏ sprint/sync** —
  không update sprint/backlog/roadmap (thuộc controller). Thêm **Discussion Mode** (trao đổi
  thuần túy, không bắt buộc viết file). Skill chỉ **tự trigger** qua Claude context — human
  không gõ `/architect` (giữ `user-invocable: false`).
- **`architect-specialist`:** reframe tương tự — role consultant, input optional, thêm
  **Discussion Mode** (trao đổi thuần túy, không viết file); Self-Check + Gate Criteria chỉ
  áp dụng khi có file output. KHÔNG liên quan sprint/sync.

### Added

- **`.claude/rules/sdlc-architect-rules.md`:** rule mới map hoàn cảnh sử dụng skill
  `architect` + agent `architect-specialist` trong SDLC — auto-trigger qua `sdlc-architect`
  (kiến trúc chưa có = bắt buộc tạo, không có path bỏ qua), boundaries (reverse pipeline,
  post-SRS sdlc-hld, CR/quick, double-invoke), plan-mode human gate, agent_docs/ direction,
  anti-patterns.
- **`sdlc-routing-rules.md`:** thêm intent "tạo/thiết kế kiến trúc hệ thống trước SRS" →
  flow `architect` → available qua `sdlc-architect` skill.

## [3.3.0] - 2026-08-21

### Added

- **`sdlc-architect` 1.0.0:** MINOR — skill standalone cho **logical architecture** trong luồng
  forward/greenfield. Tự self-check đã có `agent_docs/architecture.md` chưa — chưa có thì
  **bắt buộc phải tạo**: thảo luận với human (skill `fable-thinking`; human là **validator**,
  không phải tác giả), note từng quyết định vào
  `.work/architecture-discussion-recap/architecture-discussion.md` (cumulative — giữ context
  khi conversation compact), chỉ viết `architecture.md` khi human xác nhận mọi thứ clear VÀ
  yêu cầu triển khai. Physical HLD (C4, ADR) vẫn do `sdlc-hld` sau SRS. Luồng reverse codebase
  không dùng. **Chưa tích hợp vào pipeline** — preflight/orchestrator giữ nguyên, integration
  quyết định sau.

## [3.2.0] - 2026-08-20

### Changed

- **`sdlc-cook-overnight` 1.3.0:** MINOR — đóng 3 điểm human-gap trong luồng đêm (Harness Setup +
  Baseline Gate + PR đa-host):
  - **Harness Setup** (`per-feature-cook.md` §3a): detect build tool (Gradle / **Maven** / npm /
    Python) → test command + JUnit output dir per tool; cài deps cho Type 2 worktree mới
    (`npm ci`/`yarn install`/`pip install`; Gradle/Maven tự resolve qua `~/.gradle`/`~/.m2`).
    Trước đây worktree fresh thiếu deps → baseline fail → cả feature failed vô nghĩa.
  - **Baseline Gate** (§3c): phân loại 3 kết quả baseline — OK (dispatch), SOFT >10% pre-existing
    (dispatch + warning, như cũ), **HARD-FAIL** (không có baseline file — test không chạy được) →
    **SKIP feature + ghi rõ lý do, KHÔNG dispatch**. Trước đây dispatch mù với baseline=null → mọi
    RED đánh nhau với test harness hỏng, tốn cả đêm.
  - **PR đa-host** (`merge-manager.md` Bước 3): host-detect từ `git remote get-url` → GitHub
    (github.com + Enterprise) → `gh`; **GitLab (gitlab.com + self-host/enterprise)** → `glab`.
    **Auth guard** trước khi tạo (`gh`/`glab auth status`) — fail → KHÔNG tạo, KHÔNG treo interactive
    đêm, log "PR-ready" vào warning, sáng tạo tay.
- **`sdlc-cook` 2.4.0:** MINOR — `merge-manager.md` PR creation đa-host (GitHub→`gh`, GitLab→`glab`,
  kể cả self-host domain) + auth guard không treo đêm.

## [3.1.0] - 2026-08-20

### Added

- **`sdlc-review-codechange` 1.1.0:** MINOR — **diff-scope review** (tự động hoàn toàn). Skill
  detect branch hiện tại + merge target rồi scope review vào **DIFF giữa 2 branch** — review CHỈ
  code thay đổi thay vì toàn tree:
  - Flag `--base <branch>`: caller (cook/cook-overnight) truyền PR target tường minh (đáng tin
    nhất — controller biết chính xác sẽ merge vào đâu). Thiếu → skill auto-detect: `origin/HEAD`
    → fallback `origin/main|origin/master|main|master`. **KHÔNG dùng `@{upstream}` làm base** —
    feature branch đã push `-u` thì `@{upstream}` = chính nó, không phải integration target
    (cạm bẫy đã verify bằng git thật).
  - Flag `--full-tree`: opt-out — bỏ diff scope, review toàn bộ `targetPath` (audit module /
    working copy không phải merge-in-progress).
  - Fallback deterministic: `base == head`, diff rỗng, hoặc không resolve được base → full-tree +
    note vào report. Uncommitted changes ghi note nhưng KHÔNG mở rộng scope (cook luôn commit trước).
  - Phase 1d mới trong SKILL.md; workflow nhận `headBranch`/`baseBranch`/`diffFiles`/`diffStat`,
    dimension agents focus vào changed files + interactions (chạy `git diff <base>...HEAD -- <file>`).
- **`sdlc-review-codechange` 1.2.0:** MINOR — **Spec Compliance dimension** (trả lời "code có
  đáp ứng tài liệu không"). Flag `--specs <path>` (thư mục/file SRS + IMP + TST của feature);
  caller cook/cook-overnight truyền `<workspace>/agent_docs/features/<FEAT_ID>/`; thiếu →
  auto-detect từ headBranch (`FEAT-[A-Z0-9]+`); không resolve → SKIP deterministic + note vào
  report. Khi resolve → `spec` dimension auto-thêm: trace từng business rule / Gherkin scenario /
  execution-flow step đến code → traceability matrix GAP (unimplemented) / PARTIAL / DIVERGENT /
  IMPLEMENTED. Verdict: GAP → URGENT, DIVERGENT/PARTIAL → NEEDS_ATTENTION. `--full` giờ = 8
  dimension; flag `--spec` chạy riêng. Lý do: không dimension nào trong 7 cũ bắt được GAP —
  Bugs bắt code SAI ở chỗ CÓ, Tests bắt test gian lận, không ai bắt requirement THIẾU. Unattended
  default = **lean gating trio** `[security, bugs, spec]` (giảm ~60% chi phí đêm); `--full` opt-in.

### Changed

- **`sdlc-cook` 2.3.2:** PATCH — pre-PR review gợi ý truyền `--base <PR target>` (Type 2: `origin/main`;
  Type 1: `$ORIGINAL_BRANCH`) → review scope = diff feature...target; thêm `--specs
  <workspace>/agent_docs/features/<FEAT_ID>/` để check code có đáp ứng tài liệu không.
- **`sdlc-cook-overnight` 1.2.1:** PATCH — night review truyền `--base <targetBranch>` (PR target
  type-aware) + `--specs <specDir>`; night default = **lean gating trio** (`--security --bugs
  --spec` — code đúng + an toàn + đáp ứng tài liệu), không chạy advisory dimension ban đêm
  (giảm ~60% chi phí đêm). KHÔNG chặn PR creation (giữ nguyên unattended-policy).

## [3.0.0] - 2026-08-20

### Changed (Breaking)

- **`sdlc-review` REMOVED → tách thành 2 skill.** `sdlc-review` (v1.3.1 — merge `--mr`/`--code`
  trong một skill, error recovery dùng `AskUserQuestion`) bị xóa. Thay bằng:
  - **`sdlc-review-mr` 2.0.0:** review MR/PR trên GitHub/GitLab (gh / glab CLI), **interactive-only**
    (luôn có human + side-effect post comment). Flag `--mr <id|url>` / `--pr <id|url>`. Report
    `.work/review/REVIEW-MR-{runDate}--{platform}-{number}-{slug}.md`.
  - **`sdlc-review-codechange` 1.0.0:** review code cục bộ (thư mục/worktree/file) trên 7 dimension,
    có **UNATTENDED contract** (`--unattended` — zero prompt, error handling deterministic, verdict
    machine-readable) cho review đêm/CI. Gọi `Skill(sdlc-scout, ...)` (Phase 5a) trước khi dispatch
    `workflow-sdlc-review-code.js`. Flag `--full`/`--arch`/`--security`/`--bugs`/`--conventions`/
    `--impact`/`--ops`/`--tests`/`--adversarial`/`--focus`. Report
    `.work/review/REVIEW-CODE-{runDate}--{slug}.md`.
  - **Lý do tách:** bài toán "ngày làm tài liệu, tối code tự chạy, tự review và đánh giá" — sdlc-review
    cũ chặn unattended vì `AskUserQuestion` trong error recovery. Tách cho phép codechange chạy đêm
    không cần human.
- **Migration consumer:** mọi reference `sdlc-review --code` → `sdlc-review-codechange` (bỏ flag
  `--code`, codechange code-only): `sdlc-orchestrator` (fixbug, `--full`), `sdlc-cook` +
  `merge-manager.md` (gợi ý pre-PR, `Skill("sdlc-review-codechange", "--full " + CODE_DIR)`),
  `sdlc-quick` + `error-handling.md` (`Skill("sdlc-review-codechange", "--full")`), `sdlc-scout` +
  `integration-guide.md`, `oss-scan` SKILL.md + `workflow-oss-scan.js` (`/sdlc-review-codechange
  --security <path>`), `sdlc-output-rules.md`. Reference `sdlc-review --mr` → `sdlc-review-mr`
  (`sdlc-scout` SKILL.md).

### Added

- **`sdlc-cook-overnight` 1.2.0:** MINOR — wire **night review** (trước PR creation, sau GATE full
  pass): chạy `Skill("sdlc-review-codechange", "--full --unattended <targetPath>")`, ghi verdict
  (APPROVED/NEEDS_ATTENTION/URGENT/ERROR), KHÔNG chặn PR creation. Morning report thêm mục
  "Reviewed" kèm link report `.work/review/REVIEW-CODE-*.md`. Thêm `Skill` vào allowed-tools.
  `references/unattended-policy.md`: row 5 đổi thành "Night review" + section mới
  "Night Review (sdlc-review-codechange)".

## [2.39.4] - 2026-08-20

### Fixed
- **sdlc-codebase 1.5.2:** PATCH — reverse-pipeline LLD tech-design path nhất quán về
  top-level `agent_docs/tech-design/{svc}-service.md` (đúng với forward pipeline và hook
  `sdlc-validate-agent-output.sh`; trước đây workflow + agents + gate chỉ
  `backend/{svc}/tech-design/` khiến LLD gate false-fail dù artifact đã tồn tại):
  - **workflow-codebase-reverse.js:** 8 refs — LLD prompt (L517), LLD-synthesis context (L530),
    SRS prompt (L572), SRS-verify (L679), cross-cutting context (L746, L779, L810), LLD gate
    expected outputs (L1091) — đổi `backend/{svc}/tech-design/{svc}-service.md` →
    `tech-design/{svc}-service.md`. IMP (`backend/{svc}/implementation/`) và TST
    (`backend/{svc}/test-specs/`) giữ nguyên.
  - **codebase-lld 1.0.1:** output path + self-check gate → `agent_docs/tech-design/`.
  - **codebase-lld-synthesis 1.1.1:** đọc LLD từ `tech-design/*-service.md` và `tech-design/*-app.md`.
  - **codebase-srs 1.2.2, codebase-imp 1.0.1, codebase-gate 1.0.1:** đọc LLD từ `tech-design/`.
  - **codebase-cross-cutting-error-handling, codebase-cross-cutting-caching-strategy,
    codebase-cross-cutting-performance-test:** đọc per-service LLD từ `tech-design/`.

## [2.39.3] - 2026-08-19

### Fixed
- **sdlc-codebase 1.5.1:** PATCH — fix hardcoded scout report path trong reverse pipeline:
  - **workflow-codebase-reverse.js:** prompt của `codebase-srs-verify` hardcode
    `agent_docs/scout-report.md` (dòng 268) — không khớp path thật report tại
    `.work/scouts/` và không nhất quán với các prompt HLD/LLD/SRS/IMP/TST đã dùng
    `${scoutReportPath}` → đổi sang interpolate `scoutReportPath`.
  - **workflow-codebase-reverse.js (residual):** 3 chỗ còn hardcode `agent_docs/` relative
    trong khi mọi prompt khác dùng `${foundationPath}` — gatePrompt fallback
    `auto-detect from agent_docs/` (L178), gatePrompt "Read the actual files from
    agent_docs/" (L182), verify prompt `HLD at agent_docs/architecture.md` (L268)
    → đổi sang interpolate `${foundationPath}` (L178 dùng string concatenation vì
    nằm trong nested expression).
  - **codebase-srs-verify.md:** agent definition hardcode `agent_docs/scout-report.md`
    → đổi theo convention `codebase-hld` ("path provided in the task prompt").
- **codebase-srs-verify 1.0.1:** PATCH — agent definition đọc scout report từ task prompt,
  không hardcode path.

## [2.39.2] - 2026-08-17

### Fixed
- **sdlc-cook-overnight 1.1.1:** PATCH — validation lần đầu (7 phases), đưa references về
  đúng 2-type model + khớp convention sdlc-cook 2.3.1:
  - **per-feature-cook.md §1:** sửa invocation `detect-project.sh` — trước gọi như CLI
    (1 arg `$service`, script là library nên chạy trực tiếp = no-op); giờ `source` +
    `find_git_root` + `classify_project <git_root> <service_dir>` với absolute path từ
    `WORKSPACE_ROOT` (đúng canonical test-project-detection.sh pattern).
  - **Cross-reference prefix:** `references/tdd-orchestration.md#baseline-capture` (per-feature-cook.md),
    `references/merge-manager.md` (SKILL.md), `tdd-orchestration.md` (SKILL.md) → thêm prefix
    `sdlc-cook/` + anchor `#status-transition-map` — trước resolve sai vào chính overnight.
  - **morning-report.md cleanup:** `git worktree remove` + `git branch -D` (thiếu `-C`,
    chỉ cover Type 2) → thêm `git -C` prefix + variant Type 1 (không worktree — chỉ xóa
    branch, sub-repo đã restore ở Bước 10).
  - **SKILL.md frontmatter:** bỏ `Skill` khỏi `allowed-tools` (0 call — least privilege).

## [2.39.1] - 2026-08-17

### Fixed
- **sdlc-cook 2.3.1:** PATCH — đưa references về đúng 2-type model sau validation (D1-D6):
  - **SKILL.md Bước 4.5 (Type 2):** baseline command dùng absolute path
    `${SPECS_ROOT}/.claude/scripts/baseline` + `$WORKTREE_PATH/build/test-results/test/`
    (trước: relative `.claude/scripts/baseline` + placeholder `{build/test-results/test/}`
    — mâu thuẫn controller-never-cd). Thêm note SPECS_ROOT phải chứa `.claude/scripts/`.
  - **tdd-orchestration.md:** bỏ dòng "Map keys snake_case → camelCase" (baseline.py dump
    camelCase trực tiếp — verified); timeline + Capture Command type-aware (absolute path,
    cover Type 1 + Type 2, không `cd` persistent).
  - **merge-manager.md:** mọi lệnh `cd "$worktree_path"` + base `origin/main` → `CODE_DIR`
    + `PR_BASE` type-aware (Type 1: sub-repo `project_root` / `original_branch`); bỏ stale
    "Bước 4 (Create Worktree)"; Cleanup Procedure thêm variant Type 1 (không worktree);
    sdlc-review dùng `CODE_DIR`.
  - **error-recovery.md:** mọi "trong worktree" → `CODE_DIR` type-aware; section `#worktree-fail`
    mở rộng cover Type 1 in-place checkout fail (dirty tree, branch collision, detached HEAD,
    submodule gitlink) — giữ anchor để overnight reference không vỡ.
- **workflow-sdlc-cook.js:** baseline-missing warning trỏ đúng path
  `${SPECS_ROOT}/.claude/scripts/baseline` (trước: relative + sai CODE_DIR).

## [2.39.0] - 2026-08-17

### Changed
- **sdlc-cook-overnight 1.1.0:** MINOR — redesign type-aware cho batch-cook nhiều feature:
  - **2-type project model:** Type 1 (submodule / gitignored-subproject) → checkout IN-PLACE trong
    sub-repo, bắt buộc tuần tự, restore `original_branch` (finally semantics) sau mỗi feature, PR về
    remote của chính sub-repo; Type 2 (workspace-member) → worktree isolation, parallel an toàn khi
    disjoint service.
  - **Gating Parallel theo type:** Phase 2 giấu tùy chọn Parallel nếu có bất kỳ feature Type 1.
  - **Controller KHÔNG `cd`:** mọi thao tác qua absolute path; dispatch workflow với
    `repoPath` (nơi chạy code/test) + `specRoot` (nơi chứa `agent_docs/`) — hết phụ thuộc CWD của session.
- **sdlc-cook 2.3.0:** MINOR — type-aware branch strategy (Bước 3-4, 4.5, 8, 10):
  - Bước 4 tách branch theo type: Type 1 in-place checkout + capture `original_branch` + restore bắt buộc;
    Type 2 worktree như cũ. Bước 4.5 baseline chạy trong `repoPath`, script ở `specRoot` (Type 1: `.claude` ở parent).
  - Bước 8 args thêm `repoPath`/`specRoot` — workflow dùng làm CWD của mọi agent; không truyền →
    backward-compatible (CWD hiện tại). Bước 10 PR target type-aware (Type 1: remote của sub-repo).
- **workflow-sdlc-cook.js:** `repoPath` (vốn có nhưng chưa dùng) + `specRoot` (mới) giờ trở thành
  `CODE_DIR`/`SPECS_ROOT` — mọi prompt agent dùng `${CODE_DIR}` (chạy lệnh) và `${SPECS_ROOT}/agent_docs/`
  (đọc specs). Workflow không còn phụ thuộc CWD của session.
- **sdlc-cook/references/project-detection.md:** "Worktree Creation" → "Branch Strategy Theo Project
  Type" (2 chiến lược); Project object thêm `original_branch`, `worktree_path` = null cho Type 1.
- **sdlc-cook-overnight/references:** `batch-planning.md` (Parallel chỉ khi tất cả Type 2; safety table
  thêm Type 1 row), `per-feature-cook.md` (procedure tách theo type + repoPath/specRoot + restore),
  `unattended-policy.md` (auto-decision #15-17: Type 1 parallel→sequential, restore fail→chặn task kế,
  sub-repo không remote→không auto-PR).

## [2.38.0] - 2026-08-17

### Added
- **sdlc-cook-overnight 1.0.0:** Skill mới — batch-cook nhiều feature TDD qua đêm trong
  worktree isolation, unattended. Interactive Batch Plan qua AskUserQuestion (sequential /
  parallel / pick features), rồi unattended execution: dispatch `workflow-sdlc-cook.js`
  trực tiếp per feature (direct orchestration của sdlc-cook), auto tạo PR (không
  auto-merge), morning report tổng hợp tại `.work/reports/overnight-YYYYMMDD.md`.
  Failure isolation: 1 feature fail không lan sang feature khác.

## [2.37.0] - 2026-08-13

### Added
- **sdlc-output-rules.md:** Rule mới govern clarity của output do skill/subagent/workflow sinh ra.
  Nguyên tắc: "bất cứ điều gì cần giải thích thêm đều làm chậm giao tiếp và ra quyết định".
  Quy tắc 3 tầng cho acronym: (1) chuẩn ngành là identifier → giữ nguyên trong `agent_docs/`;
  (2) thuật ngữ business/domain-specific hoặc viết tắt tự chế → mở rộng lần dùng đầu hoặc vào
  glossary; (3) mọi output human-facing (gate report, review, escalation, PR description, `docs/`)
  → mở rộng acronym lần dùng đầu.

### Changed
- **sdlc-srs:** Thêm section "Output Clarity" — thuật ngữ domain trong FR spec phải đọc được ngay
  lần đầu gặp; không để acronym trôi nổi ngoài `project-overview.md` glossary.
- **codebase-srs 1.2.1:** PATCH — thêm section "Output Clarity" tương tự, kèm quy tắc flag INFERRED
  khi nghĩa thuật ngữ được suy đoán từ code.

## [2.35.1] - 2026-08-04

### Fixed
- **sdlc-cook 2.2.1:** PATCH — sửa comment sai tại Bước 8 code example (dòng 225-227):
  comment cũ nói baseline.js ghi snake_case và cần map sang camelCase trước khi truyền
  vào Workflow args. Thực tế cả `baseline.js` (dòng 318-320) và `baseline.py` (dòng
  386-388) đều emit camelCase (`tcIndex`, `preExistingFailures`, `byFile`). Nếu agent
  làm theo comment sai → map ngược key camelCase thành snake_case → interference
  detection chạy với index rỗng → silent failure (gate vẫn PASS). Đã sửa thành comment
  đúng, nhất quán với Bước 4.5 (dòng 170-172).

## [2.35.0] - 2026-08-01

### Changed
- **sdlc-scout 2.2.0:** MINOR — fix return schema mismatch giữa workflow pipeline và docs (`report-format.md` / `quality-gates.md` / `integration-guide.md`):
  - **Flatten return object:** bỏ wrapper `results` ở cả 3 return path (empty / all-skipped / main) — `reports`, `failedReports`, `gaps`, và các counters về top-level, khớp Return Data Schema.
  - **Thêm `modulesFound` / `entryPointsFound`** vào report objects (data vốn có sẵn từ `SCOUT_FINDING` nhưng chưa được `.length` hóa) — `workflow-sdlc-review-code.js` đọc 2 field này qua `scoutReports`.
  - **Normalize report shape:** cả skip lẫn completed branches đều có đủ field counts + `skipped: boolean` nhất quán.
  - **Align `status` với enum docs:** emit `'partial'` khi có sub-project fail một phần (trước đây luôn `'completed'`); trường hợp không có sub-project map `'empty'` → `'completed'`. `verifyScoutReport()` không còn crash vì `scoutResult.reports` giờ tồn tại.
  - **Restore `foundGaps`** trong object `gaps` trả về.
- **sdlc-review 1.3.1:** PATCH — sync `workflow-handoff.md` với kiến trúc scout hiện tại:
  - Xóa "Phase: Scout" khỏi code workflow phases (scout do SKILL.md gọi `sdlc-scout` trước khi dispatch — workflow không có phase scout nội bộ).
  - Thêm field `scoutReports` vào `codeArgs` schema (structured scout output mà SKILL.md Phase 5 thực tế gửi).

## [2.34.2] - 2026-07-31

### Fixed
- **sdlc-preflight 1.0.2:** PATCH — fix 2 drift từ consistency review:
  - File Dependency Map: xóa numbering "Phase 1/3/8" không tồn tại trong hệ thống SDLC
    (naming chuẩn: SRS → HLD → LLD → IMP); arrow vốn đã mang tên phase thật.
  - `grilling-conventions.md`: thay khuôn "Tách 3 file" cứng (Shared + Backend +
    Frontend tách rời — không khớp bảng Logic Gộp/Tách trong SKILL.md) bằng 2 nhánh
    đúng kịch bản: tách-theo-stack (mỗi backend stack 1 file `backend/{stack}/conventions.md`)
    và tách-FE-riêng (BE + Shared gộp `conventions.md`, FE riêng `frontend/conventions.md`).
    Summary block cập nhật 3 lựa chọn tương ứng.

## [2.34.1] - 2026-07-31

### Fixed
- **sdlc-gate 1.0.2:** PATCH — LLD gate L1 criteria lệch với producer design (agent + workflow + template):
  - Đổi 9 section headers từ gate-camp (Domain Model, API Contracts, REST Clients, Caching, Error Flows, Degraded Modes, Work Packages, Routing Overlay) sang producer-camp (Service Boundary, Internal Architecture, Domain Model, REST Clients, Transaction Boundaries, Integration Points, Caching Strategy, Performance & Scale, Error Flows & Degraded Mode).
  - Grep header tolerant `N.` numbering (template headers); API contracts kiểm tra riêng ở `contracts/api-*.yaml`; work package + routing overlay thuộc FR files (L3 đã cover).
- **sdlc-orchestrator 1.14.2:** PATCH — `procedures.md` §4.3 L1 mirror cùng 9 sections producer-camp.
- **sdlc-automation 1.10.1:** PATCH — `lldPrompt` CRITICAL RULES pin exact `##` headers từ LLD template để gate grep deterministic; `sdlc-lld.md` agent thêm dòng tương tự (agent không có version field).

## [2.34.0] - 2026-07-31

### Changed
- **sdlc-automation 1.10.0:** MINOR — production hardening với fable-thinking review:
  - **Gate verdict qua structured output:** thêm `schema: GATE_RESULT` cho `sdlc-gate` call,
    bỏ phụ thuộc regex trên text tự do. Gate agent trả explicit `critical` boolean thay vì
    keyword-match `/CRITICAL/i`. Giữ `parseGateVerdict` làm fallback cho string result.
  - **Unify phase naming:** `CROSS_CUTTING` (underscore) → `CROSS-CUTTING` xuyên suốt qua
    bracket notation. Sửa resume-check `completedPhases.has('CROSS_CUTTING')` — entry
    underscore không bao giờ khớp resume entry chuẩn (hyphen), khiến cross-cutting luôn
    chạy lại dù đã done.
  - **Retry budget:** `MAX_RETRIES` 1 → 2 (3 attempts), đồng bộ gate agent contract
    (attempt 1-3) và prompt "Attempt: X/3". SKILL.md cập nhật "max 2 attempts" → "max 3 attempts".
  - **Path fix:** error-handling.md E3.1 — `.claude/workflows/workflow-sdlc-automation.js` →
    `.claude/workflows/automation/workflow-sdlc-automation.js`.
  - **Resume docs:** thêm section "Workflow Crash & Resume" vào error-handling.md (tool-level
    `resumeFromRunId` + script-level `resumeFrom` với caveat `phaseResults` đầy đủ). E3.3
    option "Kill và chạy lại" → "Kill và resume".
  - **Fix syntax error (critical):** srsPrompt/hldPrompt/lldPrompt đóng thừa `}}` → `}` —
    workflow không parse được trước đó (node --check fail tại 3 function). Nay load được.
  - **Retry docs đồng bộ:** task-flow.md "max 2 attempts" → "max 3 attempts".
- **sdlc-gate 1.0.1:** PATCH — "Return Structured Result": ưu tiên structured output khi
  orchestrator cung cấp schema, giữ text format `GATE_VERDICT` làm fallback.

## [2.33.0] - 2026-07-30

### Changed
- **sdlc-cook 2.2.0:** MINOR — refine skill với fable-thinking analysis:
  - **Merge flow.md → SKILL.md:** Core execution flow (10 bước) giờ nằm trong
    body chính (298 dòng, dưới limit 500). flow.md bị xóa — nội dung đã merge.
  - **Deduplicate board update:** Transition map canonicalized về
    tdd-orchestration.md, xóa bản copy ở SKILL.md và flow.md cũ.
  - **Rename pipeline-status.md → tdd-orchestration.md:** Tên mới phản ánh đúng
    nội dung (TDD cycle, baseline, GATE, board update).
  - **Trim merge-manager.md:** 342→335 dòng. Conflict handling trỏ về
    error-recovery.md cho decision tree, giữ PR-specific procedures.
  - **Cross-references:** merge-manager.md ↔ error-recovery.md có
    bidirectional links cho conflict handling.
  - **Validation pass:** 7/7 phases. Script tests 7/7 PASS. Không broken links,
    không orphaned references.

## [2.32.1] - 2026-07-30

### Changed
- **sdlc-automation 1.9.1:** PATCH — refine sau khi xóa cook flow:
  - **grilling-templates.md:** Rút gọn 304→263 dòng (-41). Gộp các section nhỏ:
    Round 1 (Tổng quan & Users, AC & Business Rules), Round 2 (Performance &
    Availability, Security & Scale), Round 3 (Services & APIs, Data & External
    Dependencies). Giảm verbosity trong AskUserQuestion template descriptions.
  - **cr-flow.md:** Thêm cross-reference đến grilling-templates.md cho CR phức tạp.

## [2.32.0] - 2026-07-30

### Changed
- **sdlc-cook 2.1.0:** MINOR — thêm gợi ý sdlc-review --code trước khi tạo PR:
  - **merge-manager.md:** Chèn section mới "sdlc-review Gợi Ý (--code)" giữa
    Pre-merge Check và PR Creation. AskUserQuestion non-blocking hỏi human có
    muốn chạy `sdlc-review --code --full` trên worktree trước khi tạo PR không.
    Nếu đồng ý → `Skill("sdlc-review", "--code --full " + worktree_path)`.
    Tất cả lỗi đều non-blocking — tạo PR luôn có thể tiếp tục.
  - **flow.md:** Cập nhật Bước 10 — thêm item 2 (gợi ý review) vào numbered list.
  - **SKILL.md:** Version bump + cập nhật flow diagram.
  - Tham khảo pattern AskUserQuestion từ sdlc-orchestrator Section 6.2b.

## [2.31.0] - 2026-07-30

### Changed
- **sdlc-orchestrator 1.14.0:** MINOR — xóa cook flow khỏi orchestrator:
  - **Xóa `references/flow-cook.md`** — toàn bộ 441 dòng TDD cook procedure.
    sdlc-cook skill (v2.0.0) là điểm vào chuyên biệt cho TDD code execution.
  - **SKILL.md:** Xóa cook khỏi description (3 flow thay vì 4), keyword table,
    keyword overlap rules, flow selection UI, foundation gate cook section,
    flow routing table. Đổi tên TDD agent tables từ "(cook flow)" thành
    generic — các agent này vẫn được fixbug flow sử dụng.
  - **procedures.md:** Xóa Section 1.3 (TDD Agent Templates) và Section 3.6
    (TDD Per-TC Cycle). Cập nhật tất cả cook references. Thêm post-completion
    prompt: sau task/CR xong, hỏi human có muốn implement qua sdlc-cook không.
  - **flow-cr.md:** Cập nhật cook reference, thêm post-completion prompt.
  - **flow-fixbug.md:** Đổi "Khác biệt với cook flow" → "Đặc điểm TDD fix cycle".

- **sdlc-automation 1.9.0:** MINOR — xóa cook flow khỏi automation:
  - **Xóa `references/cook-flow.md`** — toàn bộ 440 dòng cook automation flow.
    sdlc-cook skill đã có workflow dispatch riêng trong worktree isolation.
  - **SKILL.md:** Xóa cook khỏi description, flow selection UI, keyword hints,
    foundation gate, toàn bộ Cook Automation Flow section, cook-flow.md khỏi
    reference index, workflow-sdlc-cook.js khỏi dependency table.
  - **task-flow.md:** Xóa "Next: flow cook" line, thêm post-completion prompt.
  - **Trọng tâm hóa:** automation giờ chỉ focus vào specs pipeline (task/CR).

- **sdlc-routing-rules.md:** Cập nhật Intent→Flow table — cook "Available via"
  từ "orchestrator, automation" thành "sdlc-cook skill".

## [2.30.0] - 2026-07-30

### Changed
- **sdlc-cook 2.0.0:** MAJOR — loại bỏ multi-feature dispatcher, đơn giản hóa về single-feature:
  - **Xóa `references/flow-multi.md`** — toàn bộ dispatcher logic (scan board, topological sort,
    pool management, monitor, wave continuation) không còn cần thiết. Claude Code agents view
    đã cung cấp parallel execution visualization ở tầng platform.
  - **Xóa auto mode** — không còn `/sdlc-cook` (no args) scan board. User gọi riêng từng feature.
  - **Xóa `--pool <N>` flag** — không còn pool concept. Mỗi lần gọi = 1 worktree.
  - **Đổi tên `flow-single.md` → `flow.md`** — chỉ còn một flow duy nhất.
  - **Thêm dependency check** vào flow.md — cảnh báo nếu `depends_on` chưa Done, không chặn cứng.
  - **Đơn giản hóa merge-manager.md** — bỏ wave continuation và unblock-deps dispatch.
  - **Dọn `references/error-recovery.md`** — bỏ 3 references đến "dispatcher".
  - **SKILL.md:** Giảm từ 190 dòng còn 110 dòng, mô tả rõ cách chạy song song qua agents view.
  - **Tổng:** Xóa ~350 dòng dispatcher logic, skill giảm ~40% độ phức tạp. Single responsibility
    rõ ràng: cook MỘT feature trong worktree isolation. Parallelism = platform concern.
- **sdlc-cook:** Loại bỏ cơ chế pipeline status tracking:
  - **Xóa `scripts/update-pipeline-status.{sh,js,py}`** — 3 script (~370 dòng) atomic-write
    vào `.pipeline/{frId}-status.json`. Cơ chế này write-only: workflow không đọc file,
    agent không được enforce gọi script, resume dùng `resumeFromRunId` (tool-level) và
    `COOK_REPORT` return value thay vì đọc file JSON.
  - **Dọn `workflow-sdlc-cook.js`** — xóa `statusUpdateCmd()`, `statusInstruction()`,
    `STATUS_SCRIPT`, và tất cả embedded bash instructions trong RED/GATE/REFACTOR prompts.
  - **Dọn `pipeline-status.md`** — xóa "Canonical Pipeline Status Schema" section và
    "Pipeline Status Polling" section. Giữ TDD cycle, agent reference, baseline capture,
    GATE protocol, board update.
  - **Dọn `merge-manager.md`** — pre-merge check đọc từ `COOK_REPORT` thay vì JSON file.
  - **Dọn `error-recovery.md`** — workflow crash recovery ưu tiên `resumeFromRunId`,
    fallback `resumeFrom` từ COOK_REPORT/log output thay vì đọc file.
  - **Xóa `.pipeline/` từ `.gitignore`** — không còn runtime data được ghi.
  - **Tổng:** Xóa ~685 dòng code + documentation cho một cơ chế không được đọc bởi ai.

## [2.29.0] - 2026-07-29

### Changed
- **sdlc-cook 1.1.0:** Refine full flow kết hợp workflow-knowledge patterns:
  - **Token efficiency:** Chuyển Python pseudocode (52 dòng) từ SKILL.md → flow-multi.md
    thành mô tả ngắn 7 dòng — agent tự parse args không cần script mẫu
  - **DRY:** Extract `runGateWithRetry()` helper — loại bỏ ~60 dòng retry logic trùng lặp
    giữa GATE light và GATE full trong workflow script (820→825 dòng, thêm idempotent)
  - **Structure:** Consolidate `tdd-cycle.md` → `pipeline-status.md` — giảm 1 file
    reference, TDD orchestration + GATE protocol trong cùng 1 file
  - **Resilience:** Idempotent phase skip qua `resumeFrom` args — workflow có thể resume
    từ phase đã crash thay vì chạy lại từ đầu (skip completed TCs, GATE light, REFACTOR, GATE full)
  - **UX:** Thêm `references/error-recovery.md` — centralized decision tree cho 10 error
    scenarios (INTERFERENCE, GATE fail, merge conflict, PR closed, worktree crash...)
  - **Maintainability:** Cập nhật tất cả cross-reference links sau khi xóa tdd-cycle.md

## [2.28.1] - 2026-07-28

### Fixed
- **sdlc-codebase 1.15.1:** Sửa critical bug `new Date()` trong `workflow-codebase-reverse.js`
  phá hủy workflow resume. Thay bằng `runDate` parameter truyền từ skill dispatch qua args.
  Cập nhật SKILL.md, flow-reverse.md, procedures.md để truyền `runDate` khi gọi workflow.
- **workflow-codebase-reverse:** Thay `new Date().toISOString().split('T')[0]` bằng
  `runDate` từ args — đảm bảo deterministic execution và khả năng resume.

## [2.28.0] - 2026-07-23

### Changed
- **advisor 1.1.0:** Refine — thêm decision-specific failure modes (frame adoption,
  first-option lock, fluent recommendation ≠ correct, stakes inflation), chuyển
  protocol thành procedural 5-step (FRAME → GROUND → REASON → ATTACK → DELIVER) với
  decision-specific adaptation cho từng bước. Thêm Agent tool cho phép spawn Explore
  agent để exploring codebase khi cần GROUND facts rộng (search pattern across files,
  verify claim spanning multiple services).

## [2.27.0] - 2026-07-23

### Added
- **advisor 1.0.0:** Subagent mới — structured reasoning tại decision point. Spawn khi
  controller gặp tình huống ambiguous (escalation, flow detection, gate fail, scope
  negotiation, grilling exit, fail-safe, bug keyword). Áp dụng fable-thinking protocol
  (Five Moves: FRAME → GROUND → REASON → ATTACK → DELIVER), trả về structured
  recommendation với confidence breakdown (OBSERVED/DERIVED/ASSUMED). Read-only, model
  fable, max 8 turns. Dùng chung cho orchestrator và automation.
- **sdlc-orchestration-rules:** Thêm section "Advisor Subagent — Decision Support" với
  bảng 9 decision points, context cần cung cấp, và hướng dẫn sử dụng kết quả.

### Changed
- **sdlc-orchestrator 1.13.0:** Thay 4 inline fable-thinking blocks bằng spawn `advisor`
  subagent: escalation trigger, flow detection ambiguous, foundation gate fail, skip
  phase proposal. Controller giờ dispatch advisor thay vì tự suy luận — context
  isolation, DRY, nhất quán protocol.
- **sdlc-automation 1.8.0:** Thay 5 inline fable-thinking blocks bằng spawn `advisor`
  subagent: grilling exit, fail-safe, bug keyword detection, flow selection ambiguous,
  gate fail sau retry exhausted.
- **sdlc-fable-thinking-rules:** Dịch "tell" → "dấu hiệu" / "dấu hiệu tố cáo" (3 vị trí,
  sát nghĩa theo context sử dụng: dấu hiệu nhận biết ở diagnostic list, dấu hiệu tố
  cáo ở Claim Discipline — grammar là thứ vô tình tố cáo claim đang giả dạng OBSERVED).

## [2.26.0] - 2026-07-23

### Changed
- **fable-thinking rule:** Cập nhật từ skill fable-thinking 1.4.0. Thêm Know Your Own
  Defaults (8 default failure modes), hoàn chỉnh The Floor với trap-detection tells.
  Tất cả technical terms giữ nguyên tiếng Anh: The Floor, Goal, Follow-through,
  Leftovers, Claim Discipline, Proportionality Gate, Self-Review Gate, Constraint
  Loop, Five Moves, Altitude Control, When Stuck, Portable Techniques, Harness
  Leverage, Pattern-match satisfaction, Template hijack, Fluent ≠ true, Prior-as-fact,
  Confirmation seeking, Frame adoption, Completion pressure, Surface blindness.
- **Tất cả rules:** Chuẩn hóa tên file với prefix `sdlc-` và suffix `-rules`:
  `fable-thinking.md` → `sdlc-fable-thinking-rules.md`,
  `sdlc-routing.md` → `sdlc-routing-rules.md`,
  `sdlc-pipeline.md` → `sdlc-pipeline-rules.md`,
  `sdlc-orchestration.md` → `sdlc-orchestration-rules.md`.
- **Tất cả rules:** Chuẩn hóa ngôn ngữ — giải thích bằng tiếng Việt, technical terms
  bằng tiếng Anh. Các block quan trọng dùng XML tags: `<EXTREMELY-IMPORTANT>`.
- **sdlc-routing-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML blocks cho critical
  sections (Intent → Flow Resolution, Anti-Patterns).
- **sdlc-pipeline-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML block cho Gate Protocol
  mandatory rule. Sửa TDD cycle diagram.
- **sdlc-orchestration-rules.md:** Chuẩn hóa ngôn ngữ VN/EN, XML blocks cho Controller
  Responsibilities, Parallel Work Safety, Escalation Protocol, fixbug constraint, và
  When Stuck guidance.
- **references/fable-thinking/protocol.md:** Cập nhật reference đến rule mới
  (`sdlc-fable-thinking-rules.md`).
- **sdlc-orchestrator 1.12.1:** Cập nhật reference từ `sdlc-escalation` →
  `sdlc-orchestration-rules.md` Escalation Protocol.

## [2.25.0] - 2026-07-23

### Changed
- **fable-thinking rule:** Cắt từ 400 → 165 dòng. Giữ The Floor, Claim Discipline,
  Proportionality Gate, Self-Review Gate, Execution Notes — phần luôn chạy. Chuyển 5
  Moves, Constraint Loop, Portable Techniques, Harness Leverage, Anti-Patterns, Altitude
  Control, When Stuck sang `.claude/references/fable-thinking/protocol.md` (load
  on-demand trong Standard/Full mode).
- **sdlc-routing rule:** Thêm bảng Anti-Patterns (5 template nguy hiểm khi pattern-match)
  từ `sdlc-fable-thinking.md`. Thêm bước "hold ≥2 viable flow hypotheses" vào
  Resolution Procedure.

### Removed
- **sdlc-fable-thinking rule:** Đã merge nội dung unique vào `sdlc-routing.md`
  (anti-patterns) và `sdlc-orchestration.md` (human interaction principles, when stuck).
  Phần restate fable-thinking protocol đã có trong `fable-thinking.md` rule.
- **sdlc-escalation rule:** Đã merge vào `sdlc-orchestration.md` (Escalation Protocol
  section với escalation chain, triggers table, fail-safe principles, message format).
- **sdlc-entry-gate rule:** Đã xóa — preflight logic do từng skill tự quản lý
  (orchestrator, automation, quick), không cần rule canonical.

### Summary
- Rules: 7 → 4 (fable-thinking, sdlc-routing, sdlc-pipeline, sdlc-orchestration)
- Tổng dòng: 919 → 448 (giảm 51%)
- Kiến trúc: rule = canonical reference (routing table, pipeline structure,
  orchestration protocol), skill = execution procedure. Không duplicate.

## [2.24.0] - 2026-07-23

### Changed
- **fable-thinking:** Chuyển từ skill thành rule — giao thức suy luận giờ luôn active trong context, không cần invoke thủ công. Rule tại `.claude/rules/fable-thinking.md`, references tại `.claude/references/fable-thinking/`. Skill gốc được giữ lại trong `.claude/skills/fable-thinking/`.
- **sdlc-orchestrator 1.12.0:** Thay thế mọi `Skill("fable-thinking")` bằng hướng dẫn áp dụng fable-thinking protocol nội tại. 4 decision points (escalation, flow detection, foundation gate, pipeline scope) giờ dùng protocol trực tiếp.
- **sdlc-automation 1.7.0:** Thay thế mọi `Skill("fable-thinking")` bằng hướng dẫn áp dụng fable-thinking protocol nội tại. 5 decision points (grilling exit, fail-safe, bug keyword, flow detection, gate fail) giờ dùng protocol trực tiếp.
- **sdlc-fable-thinking rule:** Cập nhật để reference rule fable-thinking chung, tập trung vào SDLC-specific application.

## [2.23.0] - 2026-07-23

### Added
- **sdlc-orchestrator 1.11.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries escalation, Flow Detection ambiguous, Foundation Gate fail, Pipeline Scope skip. Mỗi điểm gọi `Skill("fable-thinking")` với context cụ thể trước khi human quyết định.
- **sdlc-automation 1.6.0:** Tích hợp `fable-thinking` tại 4 decision points — Hard Boundaries (grilling exit + fail-safe), Flow Detection ambiguous, Bug keyword auto-escalation (thay thế auto-escalate bằng fable-thinking verify), Fail-safe sau 2 retry.
- **sdlc-fable-thinking rule:** Rule file `.claude/rules/sdlc-fable-thinking.md` định nghĩa when to invoke, invocation protocol, ambiguity detection criteria, và integration roadmap.

## [2.22.0] - 2026-07-21

### Changed
- **human-docs 2.5.0:** Bỏ workflow `human-docs-review.js` — chỉ spawn 1 agent duy nhất, không có orchestration logic. Chuyển logic spawn agent + format output vào thẳng SKILL.md body. Sync commands (sync:srs, sync:architecture) vẫn dùng workflow vì có parallel fan-out + data aggregation có ý nghĩa.

## [2.21.6] - 2026-07-21

### Changed
- **sdlc-preflight 1.0.1:** Thêm `user-invocable: false` — skill này được gọi tự động bởi orchestrator/automation trong SDLC entry gate, không phải user-facing command.
- **workflow-knowledge 1.3.1:** Thêm `user-invocable: false` — knowledge skill thuần túy dạy Claude về Workflow tool API, auto-activates khi Claude viết workflow scripts.

## [2.21.5] - 2026-07-21

### Changed
- **sdlc-automation 1.5.3:** Chuyển cook Monitor & Report template (20 dòng) từ SKILL.md vào `references/cook-flow.md#giai-đoạn-8-monitor--report`. SKILL.md giữ summary ngắn + link ref file. Cả 3 flows (task, cr, cook) giờ nhất quán dùng summary+link pattern.

## [2.21.4] - 2026-07-21

### Changed
- **sdlc-automation 1.5.2:** Trích xuất task flow procedure (105 dòng) ra `references/task-flow.md`. SKILL.md giữ summary 4 bước + link ref file, nhất quán với cr/cook flow pattern.
- **sdlc-pipeline:** Sửa 4 tên cross-cutting agent thiếu prefix `sdlc-lld-` trong forward pipeline table. Cả 5 tên giờ đều dùng full qualified name.

## [2.21.3] - 2026-07-21

### Added
- **sdlc-gate, codebase-gate, sdlc-tdd-be-gate, sdlc-tdd-fe-gate:** Added PreToolUse validation hooks for defense-in-depth. All 4 gate agents are read-only but now have hooks calling `sdlc-validate-agent-output.sh` to block any accidental Write/Edit/Bash output.
- **sdlc-validate-agent-output.sh:** Added `sdlc-tdd-be-gate` and `sdlc-tdd-fe-gate` to the read-only gate case (merged with `sdlc-gate|codebase-gate`).

## [2.21.2] - 2026-07-21

### Fixed
- **sdlc-validate-agent-output.sh:** Added `codebase-gate` case (merged with `sdlc-gate`) in phase validation. Previously `codebase-gate` fell through to the catch-all `*` case, printing "Unknown phase" to stderr. Gate agents are read-only — the case blocks Write/Edit/Bash as defense-in-depth, symmetric with `sdlc-gate`.

## [2.21.1] - 2026-07-21

### Changed
- **sdlc-automation 1.5.1:** Documented fixbug flow as orchestrator-only. Bug keywords ("bug"/"lỗi"/"fix") now trigger explicit escalation to orchestrator with `flow=fixbug` instead of ambiguous hints. Fixbug requires human diagnosis judgment — cannot be autonomous.
- **sdlc-routing:** Added "Available via" column to intent→flow table. `fixbug` explicitly marked as **orchestrator only**.
- **sdlc-escalation:** Added fixbug flow section documenting orchestrator-only constraint and escalation rules from quick/automation.
- **sdlc-entry-gate:** Added orchestrator-only annotation to fixbug row.

## [2.21.0] - 2026-07-21

### Changed
- **sdlc-automation 1.5.0:** Replaced agent self-check gate pattern with independent `sdlc-gate` verification. Writing agents no longer self-evaluate — workflow spawns dedicated `sdlc-gate` (model: sonnet, read-only) after each phase to verify outputs against structured criteria. Cross-cutting uses a single centralized gate check after all agents complete. Added retry context with `previousFailure` (max 2 attempts) and regression detection. Removed dead `GATE_CRITERIA` inline object and all `## Gate Self-Check` sections from agent prompts. Workflow meta now includes explicit Gate phase.
- **workflow-sdlc-automation.js:** `runPhase()` now two-step: spawn writing agent → spawn `sdlc-gate`. New `gateCheck()` function with `crossCuttingScope` support. `parseGateVerdict()` replaces `parseGateResult()` — parses `GATE_VERDICT: PASS|FAIL` structured output. Cross-cutting agents use `skipGate: true` — gate unified after all CC outputs.

## [2.20.0] - 2026-07-21

### Added
- **sdlc-gate 1.0.0:** New dedicated gate agent for the forward SDLC pipeline. Validates SRS, HLD, LLD, CROSS-CUTTING, IMP, and TST phase outputs against structured per-phase criteria with concrete grep-able verification instructions. Read-only (Read, Bash, Glob, Agent) — returns `GATE_VERDICT: PASS|FAIL` with per-criteria breakdown, per-entity reporting, and regression detection. Supports retry context (max 3 attempts) and conditional cross-cutting criteria via `crossCuttingScope`. Symmetric to `codebase-gate` in the reverse pipeline. Replaces the manual gate checklist previously in `procedures.md:356-404`.

### Changed
- **sdlc-orchestrator (procedures.md):** Section 4 replaced manual gate checklist with `sdlc-gate` agent spawn template (Section 4.0) and criteria summary tables with critical flag markers. Section 1.1 spawn templates updated to reference sdlc-gate. Cross-cutting templates updated.
- **sdlc-orchestrator (flow-task.md):** Step 4.1 sub-step 7 and step 4.3 sub-step 7 updated to spawn `sdlc-gate` instead of manual gate verification. Spawn templates simplified — removed gate self-check instructions (now handled by sdlc-gate).
- **sdlc-pipeline.md:** Gate Protocol section updated to document both `sdlc-gate` (forward) and `codebase-gate` (reverse) as phase gate agents.
- **sdlc-validate-agent-output.sh:** Added `sdlc-gate` case — defense-in-depth block for any accidental Write/Edit attempts on the read-only gate agent.

## [2.19.2] - 2026-07-20

### Fixed
- **human-docs-sync-srs 1.1.1:** Xóa tất cả references đến `agent_docs/` khỏi SRS-TEMPLATE.md. SRS là tài liệu cho người đọc — phải tự chứa đầy đủ nội dung, không bắt người đọc nhảy sang file khác. Bỏ cột "Source" (link về agent_docs) trong FR Overview, bỏ link error-handling.md trong Security section, bỏ link caching-strategy.md trong Scalability section, bỏ reference đến user-context.md trong fallback message. Agent definition cập nhật FR overview table header và hard boundary fallback message cho đồng bộ.

## [2.19.1] - 2026-07-20

### Fixed
- **human-docs 2.4.1:** Sửa 5 stale references từ đợt tái cấu trúc routing hub (2.19.0). SRS-TEMPLATE.md: link `docs/architecture/error-handling.md` → `agent_docs/error-handling.md`, link `docs/architecture/caching-strategy.md` → `agent_docs/caching-strategy.md`, bỏ tham chiếu `agent_docs/scale-strategy.md` (không tồn tại). SKILL.md edge case: `ADRs/README.md` → `README.md`. sync-architecture.js: log message `ADRs/README.md` → `README.md`.
- **human-docs-review 1.0.0:** Thêm `version` field vào frontmatter (bị thiếu từ khi tạo).

## [2.19.0] - 2026-07-20

### Changed
- **human-docs 2.4.0:** Tái cấu trúc hoàn toàn sync:architecture. **Bỏ copy as-is** cross-cutting files. Thay bằng routing hub: `docs/architecture/README.md` trỏ thẳng về `agent_docs/` cho ADRs + 5 cross-cutting files. `system-architecture.md` tổng hợp cross-cutting summaries (1 đoạn/file). Output giảm từ ~8 files xuống 3 files (README.md + system-architecture.md + diagrams/).
- **human-docs-sync-architecture 1.3.0:** Step 4 thay bằng đọc cross-cutting files để lấy summaries (không copy). Step 5 thay `ADRs/README.md` bằng `README.md` hub routing. Step 6 (cross-cutting copy) bị xóa. Output schema: `cross_cutting_synced`/`skipped` → `cross_cutting_summaries`/`missing` + `readme_generated`.
- **human-docs-sync-srs 1.1.0:** Step 6 dùng `SRS-TEMPLATE.md` (8 sections, có NFR sub-categories). Step 7 (features/README.md) revert về inline — index table không cần template riêng.
- **human-docs-review:** Cập nhật scan paths — cross-cutting files không còn check trong docs/ (chỉ check routing references trong README.md).
- **Templates:** 3 templates thay vì 4. `SRS-TEMPLATE.md` (đầy đủ 8 sections), `system-architecture-TEMPLATE.md` (14 sections với cross-cutting summaries), `architecture-README-TEMPLATE.md` (routing hub). Xóa `features-README-TEMPLATE.md` và `ADRs-README-TEMPLATE.md` (index đơn giản → inline).

## [2.18.0] - 2026-07-20

### Added
- **human-docs 2.3.0:** Thêm cross-cutting sync vào `sync:architecture`. 5 file (`error-handling.md`, `caching-strategy.md`, `frontend-architecture.md`, `frontend-test-strategy.md`, `performance-test.md`) được sync as-is từ `agent_docs/` → `docs/architecture/` với header nguồn. File cross-cutting không tồn tại → skip file đó, không block.
- **human-docs-sync-architecture 1.1.0:** Added Step: Sync cross-cutting files (5 files). Updated output schema with `cross_cutting_synced` and `cross_cutting_skipped`. Added hard boundary: never create empty placeholder files for missing cross-cutting sources.
- **human-docs-review:** Mở rộng review scope — quét 5 file cross-cutting source + output. Classify `missing` nếu source tồn tại nhưng chưa sync.

## [2.17.0] - 2026-07-20

### Added
- **codebase-cross-cutting-error-handling 1.0.0:** New dedicated agent for reverse pipeline — extracts observed error handling patterns from code artifacts. Uses OBSERVE mindset (not DESIGN): documents patterns, inconsistencies, and gaps rather than prescribing standards. Writes `agent_docs/error-handling.md`.
- **codebase-cross-cutting-caching-strategy 1.0.0:** New dedicated agent for reverse pipeline — extracts observed caching patterns from code artifacts (L0-L3 layers, cache inventory, invalidation strategies, stampede prevention). Writes `agent_docs/caching-strategy.md`.
- **codebase-cross-cutting-performance-test 1.0.0:** New dedicated agent for reverse pipeline — creates performance test plan from reverse-engineered SRS NFRs and per-service LLD performance characteristics. Writes `agent_docs/performance-test.md`.
- **codebase-cross-cutting-frontend-architecture 1.0.0:** New dedicated agent for reverse pipeline — extracts observed frontend architecture patterns (rendering strategy, state management, auth, error boundaries). Writes `agent_docs/frontend-architecture.md`.
- **codebase-cross-cutting-frontend-test-strategy 1.0.0:** New dedicated agent for reverse pipeline — extracts observed frontend test strategy (test pyramid, MSW patterns, coverage targets). Runs in Stage 2 after error-handling + frontend-architecture. Writes `agent_docs/frontend-test-strategy.md`.
- **sdlc-codebase 1.4.0:** Added Cross-Cutting phase to reverse pipeline (Phase 4, between SRS and IMP+TST). 5 dedicated agents with scope detection + 2-stage fan-out (Stage 1: 4 agents parallel, Stage 2: 1 agent after barrier). Updated pipeline diagram, subagent table, smart detection, and flow documentation.
- **workflow-codebase-reverse.js:** Added Cross-Cutting phase with scope detection, Stage 1 (4 agents parallel), barrier, Stage 2 (frontend-test-strategy), gate check with retry, and report integration.

### Changed
- **codebase-lld-synthesis 1.1.0:** Slimmed — removed `cross-cutting.md` generation (deferred to dedicated `codebase-cross-cutting-*` agents in post-SRS phase). Now focuses on API contract synthesis, error code canonicalization, FR candidates, and service interaction mapping.

### Documentation
- **flow-reverse.md:** Added Phase 3.5 Cross-Cutting section with scope detection rules, mode explanation (OBSERVE vs DESIGN), expected outputs table, and gate criteria.
- **procedures.md:** Added Cross-Cutting Gate criteria (7 checks) and Explore patterns for all 5 cross-cutting agents.
- **SKILL.md:** Updated pipeline diagram, phase explanation, subagent table with 5 new agents, and smart detection with cross-cutting artifacts.

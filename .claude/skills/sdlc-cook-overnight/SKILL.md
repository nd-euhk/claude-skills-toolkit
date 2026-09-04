---
name: sdlc-cook-overnight
description: >-
  Batch-cook nhiều feature TDD qua đêm unattended, type-aware (worktree isolation
  cho workspace-member; in-place checkout tuần tự cho submodule/gitignored-subproject).
  Dùng khi cần cook toàn bộ task một lần: "cook xuyên màn đêm", "cook overnight",
  "cook hết tất cả task", "cook all features", "batch cook", "chạy đêm cook",
  "overnight run". Interactive Batch Plan (sequential / parallel / pick features)
  qua AskUserQuestion, rồi unattended execution — auto tạo PR, không auto-merge,
  morning report. Direct orchestration của sdlc-cook — không tạo/sửa specs.
version: 1.11.0
argument-hint: "all | FEAT-001 FEAT-002 ..."
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Bash, Agent, Workflow, AskUserQuestion, Skill
---

# SDLC Cook Overnight

Batch controller cook NHIỀU feature TDD trong một đêm. Khác sdlc-cook (1 feature,
interactive), skill này:

- **Interactive ở đầu** — Batch Plan qua AskUserQuestion: sequential / parallel / pick
- **Unattended giữa đêm** — dispatch `workflow-sdlc-cook-overnight.js` per feature (phased-batch TDD), không hỏi giữa chừng
- **Kết thúc đêm** — auto tạo PR (không merge), morning report tổng hợp
- **Form-2 chain (FR phụ thuộc nhau cùng git root)** — cook stacked: FR_k branch từ branch
  FR_(k-1) sau khi FR_(k-1) xong Phase 5 (PR created), tạo PR **stacked** (base = branch upstream).
  Hệ quả code: code của FR_(k-1) đã nằm sẵn trong FR_k khi cook — đúng nghĩa "FR_k depends FR_(k-1)".

## Relationship với sdlc-cook

Direct orchestration — skill này **KHÔNG** gọi `Skill(sdlc-cook)` mà tự:

- Lặp lại per-feature setup của sdlc-cook (Bước 3→4.5: project detect → worktree → baseline)
- Dispatch `Workflow({scriptPath: ".claude/workflows/cook/workflow-sdlc-cook-overnight.js", args})`
  trực tiếp per feature — workflow riêng chạy **phased-batch TDD** (RED batch → GREEN chunk →
  GATE light → REFACTOR full → GATE full), tách khỏi `workflow-sdlc-cook.js` (per-TC) của sdlc-cook
- Link reference của sdlc-cook cho chi tiết — không duplicate logic sâu

## Hard Boundaries

- **Không auto-merge bao giờ** — luôn tạo PR cho human review sáng
- **Không tạo/sửa specs** — chỉ cook feature đã có đủ SRS + HLD + LLD + IMP + TST
- **Branch isolation bắt buộc, type-aware** — Type 2: mỗi feature 1 worktree, branch
  `feature/{FEAT_ID}-{service}`; Type 1: checkout in-place trong sub-repo, tuần tự,
  restore bắt buộc trước task kế. **baseRef** (ref feature checkout từ + PR vào): default =
  integration theo type (Type 1 branch gốc sub-repo; Type 2 KHÔNG auto `origin/main` nếu repo
  release-branch — derive integration base qua skill git, Phase 3); feature trong chain →
  baseRef = branch của upstream FR
- **Chain (Form-2) chỉ trong cùng git root** — FR_k phụ thuộc FR_(k-1) chain được khi cùng
  `project_root` + cùng batch. FR_k branch từ branch FR_(k-1) ⇒ code FR_(k-1) hiện diện khi
  cook FR_k; PR stacked vào branch upstream. Upstream partial/failed → chain halt, phần còn
  lại trong chain SKIP (không cook trên base vỡ). Không chain xuyên repo/submodule khác nhau
- **Failure isolation** — 1 feature fail không lan sang feature khác (riêng chain: downstream
  của feature fail bị chặn có chủ đích — không phải lan failure, mà không thể cook trên base vỡ)
- **Không sửa board/backlog trực tiếp** — spawn `sdlc-sprint-board` / `sdlc-sprint-backlog`
- **Respect scope** — chỉ cook feature được chốt ở Batch Plan

## Quick Start

```
/sdlc-cook-overnight all                          # cook mọi feature 🟢 Ready for Cook
/sdlc-cook-overnight FEAT-001 FEAT-003            # cook 2 feature cụ thể
```

Flow: **Preflight → Interactive Batch Plan → Lanes → Execute (unattended) → PR → Morning Report**

---

## Flow Chi Tiết

### Phase 1: Preflight

Đọc `.work/board.md` + `.work/backlog.md`, thu thập feature cookable:

```bash
grep -n "🟢 Ready for Cook" .work/board.md     # board: feature sẵn sàng
grep -n "depends_on" .work/backlog.md           # backlog: dependency
```

Xây feature list — mỗi entry = **1 cook unit** (1 branch = 1 workflow = 1 PR): FEAT id (FEAT
`🟢 Ready for Cook` — mang đúng 1 FR spec `FR-{DOM}-{NNN}`), FR id, service, layer (be/fe),
status, `depends_on` (cột `Depends On` của backlog — FEAT ids, cũng là cạnh chain tiềm năng),
`project_type` + `project_root` (git root — cả 2 detect qua `detect-project.sh`; cần cho gating
sequential/parallel ở Phase 2 VÀ chain eligibility ở Phase 3).

Chọn scope theo argument:

| Argument | Scope |
|----------|-------|
| `all` (hoặc không có) | Mọi feature 🟢 Ready for Cook trên board |
| `FEAT-001 FEAT-002 ...` | Chỉ các FEAT ids liệt kê (verify tồn tại + ready) |

### Phase 2: Interactive Batch Plan

AskUserQuestion chọn chiến lược:

```javascript
AskUserQuestion({
  questions: [{
    question: "Chiến lược chạy batch này?",
    header: "Strategy",
    multiSelect: false,
    options: [
      { label: "Sequential",
        description: "Từng feature chạy lần lượt. An toàn tuyệt đối, chậm nhất." },
      { label: "Parallel",
        description: "Tất cả feature chạy song song. Chỉ hợp lệ khi MỌI feature là Type 2 (workspace-member) + khác service + KHÔNG có cặp depends_on (chain). Có Type 1 hoặc cặp chain → tùy chọn này ẩn." },
      { label: "Pick features",
        description: "Chọn FEAT ids cụ thể để cook, bỏ phần còn lại." },
    ]
  }]
})
```

Chọn `Pick features` → AskUserQuestion multiSelect danh sách feature cookable.

**Gating theo project type:** dò `project_type` + `project_root` cho từng feature cookable.
Có bất kỳ feature Type 1 → bắt buộc **Sequential**. Có cặp cookable CÙNG `project_root` + có cạnh
`depends_on` (tức chain Form-2) → cũng bắt buộc **Sequential** (chain chạy tuần tự; Parallel chỉ
cho batch hoàn toàn độc lập — không feature nào phụ thuộc feature nào). Còn lại (toàn Type 2,
không cặp chain) → cho phép cả 3 chiến lược.

### Phase 3: Build Lanes

Sắp feature thành lane theo chiến lược. Thuật toán + parallel safety:
→ `references/batch-planning.md`

| Strategy | Lane structure |
|----------|----------------|
| Sequential | 1 lane: tất cả feature, **thứ tự topo** theo cạnh `depends_on` in-batch (mọi cạnh thỏa; cùng priority giữ thứ tự board). **Bắt buộc nếu có Type 1 HOẶC có cặp chain** |
| Parallel | 1 lane per feature → chạy đồng thời. Chỉ khi tất cả Type 2 + khác service + **không cặp depends_on** |
| Pick | Chỉ các feature được chọn, thứ tự topo như Sequential (1 lane, tuần tự) |

**baseRef per feature** (định nghĩa lần đầu: ref feature checkout từ + PR vào) — tính ở Phase 3,
dùng xuyên suốt Phase 4-5. baseRef = fork base = PR target — resolve release-branch-aware TRƯỚC
khi fork (fork sai base → MR diff kéo rác, không cứu được bằng PR target):

- **Mặc định** = integration base theo type: Type 1 → branch gốc sub-repo (`ORIGINAL_BRANCH`);
  Type 2 → KHÔNG auto `origin/main` — repo bình thường lấy workspace default; repo release-branch
  (main stale, open feature MR target khác default — MR-convention) → derive integration base qua
  skill git (`git/references/workflow-pr.md` Step 3). Không confirm được → fork default, PR-time
  guard không target mù (row 19).
- **Chained** (feature có upstream in-batch, cùng `project_root`) = **branch thật của upstream FR**
  (vd `feature/FR-AUTH-005-auth-service`) — feature kế checkout từ branch đó, PR stacked vào đó.
- Dependency in-batch nhưng khác `project_root` / upstream không Ready → **không chain được** → giữ SKIP rule cũ.

Chi tiết lane + eligibility → `references/batch-planning.md`.

In plan summary TRƯỚC khi dispatch (để human soát lần cuối trước khi đêm chạy) — in chain +
baseRef để human thấy rõ FR nào stacked lên FR nào:

```
═══ Overnight Cook Plan ═══
[sequential] 4 features, 1 lane, 1 chain
  L1: FEAT-002 (auth-service) → FR-AUTH-005   base: origin/main
  L1: FEAT-003 (auth-service) → FR-AUTH-006   base: feature/...FR-AUTH-005  (chain: depends FEAT-002)
  L1: FEAT-004 (payment-service) → FR-PAY-001 base: origin/main
Skipped (không cookable):
  - FEAT-005: chưa đủ specs
  - FEAT-006: dependency khác repo / không in batch (không chain được)
```

### Phase 4: Execute Batch (unattended)

Với MỖI feature, làm đúng per-feature procedure rồi dispatch. Chi tiết:
→ `references/per-feature-cook.md`

**TDD strategy khác sdlc-cook:** overnight chạy **phased-batch**, không per-TC. RED viết
hết test + verify 1 lần → GREEN theo chunk (3-5 TC/chunk) → REFACTOR + GATE 1 lượt. Accidental-green
detect LIGHT (flag cho human sáng, không sabotage). Tốc độ ~60-75% nhanh hơn, đổi lấy granularity
feedback thấp hơn — phù hợp unattended (không có human can thiệp giữa đêm).

```
Per feature:
  1. Project detect     (sdlc-cook Bước 3 — scripts/detect-project.sh: lấy project_type + project_root)
  2. Tách branch        (Bước 4 — type-aware + **baseRef**: default integration per type; chained → checkout/worktree từ branch upstream. Type 1 capture `original_branch` TRƯỚC)
  3. Harness setup + baseline gate (Bước 4.5 — detect build tool + cài deps Gradle/Maven/npm/py; baseline.py parse camelCase; gate: OK→dispatch, SOFT→+warning, HARD-FAIL→skip feature. Baseline đo trên chính branch feature — chained đã gồm code upstream, self-consistent)
  4. Board update → 🚧 In Progress (sdlc-sprint-board)
  5. Read TST/IMP specs → extract TCs, sort CRITICAL→HIGH→MEDIUM→LOW (Bước 6)
  6. Dispatch workflow-sdlc-cook-overnight.js với args {featureName, frId, service, layer, testCases, baseline, repoPath, specRoot, redBatchSize, greenChunkSize} (repoPath = worktree/sub-repo trên branch có base = baseRef)
  7. Collect COOK_REPORT → persist checkpoint ngay (gọi `scripts/persist-cook-report.py`, chi tiết §7 per-feature-cook)
  8. Type 1 → restore original_branch. **CHAIN:** restore ở FR cuối chain hoặc khi chain halt — KHÔNG restore giữa chain (FR kế checkout từ branch FR hiện tại in-place). Chi tiết per-feature-cook §7
```

**Sequential** — xong feature này mới feature kế. **Đây cũng là vòng lặp chạy chain (Form-2)**:
lane đã xếp topo nên khi tới feature chained, upstream của nó đã cook xong ngay trước đó — không
cần async/event; gate từng bước là đủ:

```
for each feat in lane:                          # lane đã topo: upstream luôn đứng trước
  if feat.baseRef là branch upstream (chained):
    if upstream.status != "completed":          # upstream cook partial/failed → chain halt
      skipRestOfChain(feat)                     # → SKIP phần còn lại của chain, ghi reason; break
  report = cookOne(feat)      # fire 1 Workflow, await hoàn thành (§2 dùng baseRef = branch upstream)
  persistCheckpoint(report)   # harness ghi .work/reports/per-feature/ (§7 per-feature-cook)
  # Type 1 restore original_branch → trong finally của §7 per-feature-cook: chạy khi feat là
  # FR cuối chain (chain đi hết) HOẶC feat fail làm chain halt; KHÔNG restore giữa chain khi success
```

> Gate dispatch: FR_k chạy chỉ khi FR_(k-1) đạt Phase 5 terminal `completed` (branch committed +
> pushed + ổn định). PR/auth/review outcome KHÔNG chặn (giữ continue-on-fail) — kể cả upstream
> PR-creation auth-fail, downstream vẫn cook stacked; report ghi cả 2 cần tạo PR tay.

**Parallel** — fire tất cả Workflow cùng một lượt, rồi chờ từng task:

```
tasks = [cookOne(feat) for feat in lanes]   # nhiều Workflow() call trong cùng turn
for task in tasks: await task               # collect + persist checkpoint từng cái (§7 per-feature-cook)
```

> ⚠️ **Type 1 — không bao giờ song song** (in-place checkout ảnh hưởng cả working project).
> Type 2 — không chạy 2 feature CÙNG service song song: dù worktree tách rời, PR về cùng
> branch dễ merge conflict + chung test suite baseline. Parallel an toàn khi disjoint service.
> **Chain — không bao giờ song song** (kể cả Type 2): FR_k cần branch FR_(k-1) làm base; worktree
> upstream giữ nguyên qua đêm (không xóa giữa đêm) để FR_k checkout từ local branch của nó.

### Phase 5: PR + Cleanup

Feature `COOK_REPORT.status = "completed"`:
- Pre-merge check: tests pass, GATE verified, không có uncommitted changes
- **Night review** (trước PR): chạy
  `Skill("sdlc-review-codechange", "--security --bugs --spec --unattended --base <targetBranch> --specs <specDir> <targetPath>")`
  trên code vừa cook — **lean gating trio** (code đúng + an toàn + đáp ứng tài liệu); 5 dimension
  advisory (arch/conventions/impact/ops/tests) không chạy ban đêm, chờ human review sáng.
  `targetBranch` = `baseRef` của feature (resolve ở Phase 3 — release-branch-aware, KHÔNG auto
  `origin/main`), dùng chung cho fork base + review `--base` + PR target. Chained → branch upstream
  FR; Type 1 → branch gốc sub-repo. Type 2 plain → Phase 3 đã derive integration base (MR-convention:
  open feature MR target khác default → `releases/...`; không → workspace default). PR-time: nếu fork
  từ default nhưng main không phải ancestor của HEAD (fork từ line khác / release-branch) → target
  theo MR-convention (`git/references/workflow-pr.md` Step 3); không derive được → log candidates,
  review chạy với default + flag "target có thể sai", PR theo unattended-policy row 19;
  `specDir` = `<workspace>/agent_docs/features/<FEAT_ID>/`. Review scope =
  diff feature...target (chỉ code thay đổi) + Spec Compliance (code có đáp ứng tài liệu). Giữ
  `verdict` (controller state) — Phase 6 điền mục Reviewed. KHÔNG chặn PR creation.
  Chi tiết verdict handling → `references/unattended-policy.md` mục Night Review
- **Auto tạo PR** — **DELEGATE qua skill `git` operation `pr`** (KHÔNG tự chạy `gh`/`glab`/REST
  inline ở skill này):
  `Skill("git", "pr {BRANCH} --to {baseRef} --repo {repo} --title ... --body ...")` — `baseRef`
  xác định ở trên. Skill git lo host-detect (GitHub→`gh`, GitLab→`glab`, GitLab không `glab` →
  REST qua git-credential PAT), auth guard, target derivation, fallback log tay.
  - Auth guard / host fail (kể cả GitLab-REST 401 — password thường không phải PAT) → KHÔNG tạo,
    KHÔNG hỏi đêm, log "PR-ready nhưng chưa tạo được (lý do)" vào warning (sáng tạo tay); board
    giữ 🚧 In Progress (policy row 19). Không để CLI treo interactive.
  - Type 2: worktree branch `feature/{FEAT_ID}-{service}` đã push → delegate `pr ... --to
    {baseRef}`. Chained → `--to` = branch upstream FR (PR stacked, diff = delta FR_k).
  - Type 1: push branch sub-repo trước, rồi delegate `pr --repo {subrepo} --to {branch gốc
    sub-repo}`. Không có remote → KHÔNG auto-PR, log cảnh báo.
  - **Chained FR_k:** human merge sáng BOTTOM-UP (FR_1 trước, rồi FR_2...) — xem morning-report
    mục Chain merge order.
  - PR body format (truyền qua `--body`): `sdlc-cook/references/merge-manager.md`
- **KHÔNG merge** — để sáng human review
- Board → 👀 In Review (sdlc-sprint-board)

Feature `partial` / `failed`:
- Type 2: giữ worktree để debug. Type 1: restore branch gốc (không giữ checkout in-place
  qua đêm — sẽ ảnh hưởng project), ghi branch + commit hash để sáng checkout lại
- Giữ lý do + files changed (controller state) — Phase 6 điền mục Failed/Skipped
- Board → ⛔ Blocked (theo status transition map trong `sdlc-cook/references/tdd-orchestration.md#status-transition-map`)

### Phase 6: Morning Report

Dựng `.work/reports/overnight-YYYYMMDD.md` — deliverable chính cho human sáng hôm sau.
Nguồn = **checkpoint files** `.work/reports/per-feature/*.json` (mỗi feature đã persist ở
Phase 4/7 — KHÔNG từ memory) + controller state: skip list (trước dispatch), night-review
verdict + `.work/review/*.md` path, PR link/number. Template + aggregation:
→ `references/morning-report.md`

```
# Overnight Cook Report — YYYY-MM-DD
## Tóm tắt: X/Y features DONE, Z failed, W skipped
## Bảng per-feature: status | PR link | GATE light/full | TCs | Review verdict (Base = baseRef — hiện nếu chained)
## Mục Reviewed: per-feature review verdict (APPROVED/NEEDS_ATTENTION/URGENT/ERROR) + link report .work/review/REVIEW-CODE-*.md
## Chain + merge order (nếu có stacked): FR_1 → FR_2 → ... merge BOTTOM-UP, không merge FR_k trước FR_(k-1)
## Failed/Skipped chi tiết + lý do (kể cả "upstream chain {id} failed")
## Việc cần human sáng nay (PR review + merge theo thứ tự chain, fail cần xử lý, verdict URGENT/ERROR)
```

---

## Unattended Policy

Đêm chạy, controller tự quyết tại mọi điểm vốn cần human trong sdlc-cook. Bốn rule bất
biến (vi phạm = blocker):

1. **Never auto-merge** — bất kể GATE pass đến đâu, luôn tạo PR chờ human review sáng.
2. **Continue-on-fail** — failure dừng feature đó, KHÔNG dừng batch.
3. **Spec không rõ = fail, không đoán** — TC STALE/BLOCKED dừng feature, không tự suy diễn.
4. **No silent skip** — mọi skip/fail phải có lý do tường minh trong morning report.

Bảng auto-decision đầy đủ (19 điểm HITL → auto-decision + mục morning report tương ứng)
và edge cases (parallel same-service, worktree fail, mixed-type batch):
→ `references/unattended-policy.md`

## Key Notes

- Mỗi feature = 1 branch = 1 Workflow = 1 PR (Type 1: branch in-place trong sub-repo; Type 2: worktree)
- **baseRef** (per FR): ref mà FR checkout từ + PR vào. Mặc định = integration base theo type
  (Type 1 branch gốc sub-repo; Type 2 KHÔNG auto `origin/main` — release-branch derive qua skill git,
  Phase 3). **Chained FR_k** = branch thật của FR_(k-1) (cùng git root) ⇒ code FR_(k-1) đã nằm trong
  FR_k khi cook; PR FR_k **stacked** vào branch upstream.
- **PR chained merge sáng BOTTOM-UP theo thứ tự chain** (FR_1 trước FR_2 ...) — không auto-merge,
  không merge FR_k trước FR_(k-1). Nếu human "request changes" FR_1 → branch FR_1 đổi → FR_2 cần
  rebase tay (chỉ cảnh báo, skill không tự rebase).
- Controller KHÔNG `cd` — mọi thao tác qua absolute path. Dispatch workflow với `repoPath`
  (nơi chạy code/test) + `specRoot` (nơi chứa `agent_docs/`). Không truyền → workflow
  dùng CWD hiện tại (backward-compatible)
- Baseline output camelCase (`tcIndex`, `preExistingFailures`, `byFile`) — truyền thẳng vào args
- Morning report là deliverable chính — human đọc nó để review sáng
- Sau khi merge (sáng), cleanup worktree + board ✅ Done theo sdlc-cook Bước 10 — chained branch/worktree
  cleanup **bottom-up**: không xóa branch upstream trước khi downstream (đã merge vào) xong

## Full Reference

- `references/batch-planning.md` — lane building algorithm, parallel safety, plan summary format
- `references/per-feature-cook.md` — per-feature procedure, baseline capture, TC extraction, Workflow args, checkpoint persist
- `references/unattended-policy.md` — auto-decision table chi tiết + edge cases
- `references/morning-report.md` — template + aggregation rules
- `scripts/persist-cook-report.py` — harness ghi COOK_REPORT thành checkpoint per-FR (atomic + validate)

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
version: 1.5.1
argument-hint: "all | FEAT-001 FEAT-002 ..."
allowed-tools: Read, Write, Edit, Bash, Agent, Workflow, AskUserQuestion, Skill
---

# SDLC Cook Overnight

Batch controller cook NHIỀU feature TDD trong một đêm. Khác sdlc-cook (1 feature,
interactive), skill này:

- **Interactive ở đầu** — Batch Plan qua AskUserQuestion: sequential / parallel / pick
- **Unattended giữa đêm** — dispatch `workflow-sdlc-cook-overnight.js` per feature (phased-batch TDD), không hỏi giữa chừng
- **Kết thúc đêm** — auto tạo PR (không merge), morning report tổng hợp

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
  restore bắt buộc trước task kế
- **Failure isolation** — 1 feature fail không lan sang feature khác
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

Xây feature list — mỗi entry gồm: FEAT id, FR id, service, layer (be/fe), status, depends_on,
project_type (detect qua `detect-project.sh` — cần cho gating sequential/parallel ở Phase 2).

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
        description: "Tất cả feature chạy song song. Chỉ hợp lệ khi MỌI feature là Type 2 (workspace-member) + khác service. Có Type 1 → tùy chọn này ẩn." },
      { label: "Pick features",
        description: "Chọn FEAT ids cụ thể để cook, bỏ phần còn lại." },
    ]
  }]
})
```

Chọn `Pick features` → AskUserQuestion multiSelect danh sách feature cookable.

**Gating theo project type:** dò `project_type` cho từng feature cookable. Có bất kỳ
feature Type 1 → chiến lược bắt buộc **Sequential** (không đưa Parallel vào options).
Tất cả Type 2 → cho phép cả 3 chiến lược.

### Phase 3: Build Lanes

Sắp feature thành lane theo chiến lược. Thuật toán + parallel safety:
→ `references/batch-planning.md`

| Strategy | Lane structure |
|----------|----------------|
| Sequential | 1 lane: tất cả feature, thứ tự theo dependency + priority. **Bắt buộc nếu có Type 1** |
| Parallel | 1 lane per feature → chạy đồng thời. Chỉ khi tất cả Type 2 + warn nếu cùng service |
| Pick | Chỉ các feature được chọn, giữ thứ tự (tuần tự — user chọn thủ công) |

In plan summary TRƯỚC khi dispatch (để human soát lần cuối trước khi đêm chạy):

```
═══ Overnight Cook Plan ═══
[sequential] 3 features, 1 lane
  L1: FEAT-002 (auth-service) → FR-AUTH-005
  L1: FEAT-003 (auth-service) → FR-AUTH-006
  L1: FEAT-004 (payment-service) → FR-PAY-001
Skipped (không cookable): FEAT-005 (chưa đủ specs)
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
  1. Project detect     (sdlc-cook Bước 3 — scripts/detect-project.sh)
  2. Tách branch        (Bước 4 — type-aware: Type 1 in-place checkout + capture original_branch; Type 2 worktree)
  3. Harness setup + baseline gate (Bước 4.5 — detect build tool + cài deps Gradle/Maven/npm/py; baseline.py parse camelCase; gate: OK→dispatch, SOFT→+warning, HARD-FAIL→skip feature)
  4. Board update → 🚧 In Progress (sdlc-sprint-board)
  5. Read TST/IMP specs → extract TCs, sort CRITICAL→HIGH→MEDIUM→LOW (Bước 6)
  6. Dispatch workflow-sdlc-cook-overnight.js với args {featureName, frId, service, layer, testCases, baseline, repoPath, specRoot, redBatchSize, greenChunkSize}
  7. Collect COOK_REPORT
  8. Type 1 → restore original_branch (finally — chặn task kế nếu fail)
```

**Sequential** — xong feature này mới feature kế:

```
for each feat in lane:
  report = cookOne(feat)      # fire 1 Workflow, await hoàn thành
  records.push({...feat, ...report})
```

**Parallel** — fire tất cả Workflow cùng một lượt, rồi chờ từng task:

```
tasks = [cookOne(feat) for feat in lanes]   # nhiều Workflow() call trong cùng turn
for task in tasks: await task               # collect COOK_REPORT từng cái
```

> ⚠️ **Type 1 — không bao giờ song song** (in-place checkout ảnh hưởng cả working project).
> Type 2 — không chạy 2 feature CÙNG service song song: dù worktree tách rời, PR về cùng
> branch dễ merge conflict + chung test suite baseline. Parallel an toàn khi disjoint service.

### Phase 5: PR + Cleanup

Feature `COOK_REPORT.status = "completed"`:
- Pre-merge check: tests pass, GATE verified, không có uncommitted changes
- **Night review** (trước PR): chạy
  `Skill("sdlc-review-codechange", "--security --bugs --spec --unattended --base <targetBranch> --specs <specDir> <targetPath>")`
  trên code vừa cook — **lean gating trio** (code đúng + an toàn + đáp ứng tài liệu); 5 dimension
  advisory (arch/conventions/impact/ops/tests) không chạy ban đêm, chờ human review sáng.
  `targetBranch` = PR target (type-aware: Type 2 → `origin/main` của workspace; Type 1 → branch
  gốc của sub-repo); `specDir` = `<workspace>/agent_docs/features/<FEAT_ID>/`. Review scope =
  diff feature...target (chỉ code thay đổi) + Spec Compliance (code có đáp ứng tài liệu). Ghi
  `verdict` vào morning report mục Reviewed. KHÔNG chặn PR creation.
  Chi tiết verdict handling → `references/unattended-policy.md` mục Night Review
- **Auto tạo PR** (type-aware target branch, host-detect + auth guard):
  - Host = `git -C <repo> remote get-url origin` → parse: github.com / GitHub Enterprise → `gh`;
    gitlab.com / GitLab self-host → `glab`.
  - **Auth guard trước khi tạo:** `gh auth status` / `glab auth status` — fail → KHÔNG tạo,
    KHÔNG hỏi đêm, log "PR-ready nhưng chưa tạo được (lý do)" vào warning (sáng tạo tay).
    Không để `gh`/`glab` treo interactive.
  - Type 2: `gh pr create` / `glab mr create` từ worktree branch `feature/{FEAT_ID}-{service}` → `origin/main` của workspace
  - Type 1: push branch của sub-repo → PR về branch gốc của chính sub-repo (remote của sub-repo).
    Không có remote → KHÔNG auto-PR, log cảnh báo.
  - PR body format: `sdlc-cook/references/merge-manager.md`
- **KHÔNG merge** — để sáng human review
- Board → 👀 In Review (sdlc-sprint-board)

Feature `partial` / `failed`:
- Type 2: giữ worktree để debug. Type 1: restore branch gốc (không giữ checkout in-place
  qua đêm — sẽ ảnh hưởng project), ghi branch + commit hash để sáng checkout lại
- Ghi lý do + files changed vào morning report
- Board → ⛔ Blocked (theo status transition map trong `sdlc-cook/references/tdd-orchestration.md#status-transition-map`)

### Phase 6: Morning Report

Tạo `.work/reports/overnight-YYYYMMDD.md` — tổng hợp toàn batch, là deliverable chính
cho human sáng hôm sau. Template + aggregation: → `references/morning-report.md`

```
# Overnight Cook Report — YYYY-MM-DD
## Tóm tắt: X/Y features DONE, Z failed, W skipped
## Bảng per-feature: status | PR link | GATE light/full | TCs | Review verdict
## Mục Reviewed: per-feature review verdict (APPROVED/NEEDS_ATTENTION/URGENT/ERROR) + link report .work/review/REVIEW-CODE-*.md
## Failed/Skipped chi tiết + lý do
## Việc cần human sáng nay (PR review, fail cần xử lý, verdict URGENT/ERROR)
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
- Controller KHÔNG `cd` — mọi thao tác qua absolute path. Dispatch workflow với `repoPath`
  (nơi chạy code/test) + `specRoot` (nơi chứa `agent_docs/`). Không truyền → workflow
  dùng CWD hiện tại (backward-compatible)
- Baseline output camelCase (`tcIndex`, `preExistingFailures`, `byFile`) — truyền thẳng vào args
- Morning report là deliverable chính — human đọc nó để review sáng
- Sau khi merge (sáng), cleanup worktree + board ✅ Done theo sdlc-cook Bước 10

## Full Reference

- `references/batch-planning.md` — lane building algorithm, parallel safety, plan summary format
- `references/per-feature-cook.md` — per-feature procedure, baseline capture, TC extraction, Workflow args
- `references/unattended-policy.md` — auto-decision table chi tiết + edge cases
- `references/morning-report.md` — template + aggregation rules

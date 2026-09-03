# Unattended Policy — Auto-Decision Table

Đêm chạy, controller tự quyết tại mọi điểm vốn cần human trong sdlc-cook. Đây là
phần "unattended" của overnight — không hỏi giữa chừng, mọi quyết định ghi vào log
và morning report để human review sáng.

## Auto-Decision Table

| # | Điểm HITL (trong sdlc-cook) | Auto-decision đêm | Morning report |
|---|------------------------------|-------------------|----------------|
| 1 | Feature không 🟢 Ready for Cook | Skip feature, ghi lý do (status hiện tại) | Mục Skipped |
| 2 | Feature không tồn tại trên board | Skip, ghi lỗi FEAT id không hợp lệ | Mục Skipped |
| 3 | Dependency (`depends_on`) chưa ✅ Done | Skip feature, ghi dependency + status | Mục Skipped |
| 4 | Feature đang 🚧 In Progress (cook khác đang chạy) | Skip — không spawn cook trùng | Mục Skipped |
| 5 | Night review (trước PR) | Chạy `sdlc-review-codechange --security --bugs --spec --unattended` (lean gating trio) trên worktree/subrepo sau GATE full pass; ghi verdict; KHÔNG chặn PR creation | Mục Reviewed |
| 6 | PR creation | Auto tạo PR (host-detect: GitHub→`gh`, GitLab→`glab`, auth guard trước; fail → row 19), KHÔNG merge | Mục PR created |
| 7 | INTERFERENCE-LIGHT (1 chunk break test khác cùng file) | Dừng feature đó, ghi chi tiết (test broken, file, line) | Mục Failed |
| 8 | TC BLOCKED / STALE / ERROR | Feature fail, ghi spec/tc cần human | Mục Failed |
| 8b | Accidental-green (batch LIGHT — test đã pass sẵn, không sabotage) | KHÔNG fail từng TC — TC `SKIPPED`, flag cho human sáng review (test có thể đã được impl trước đó, hoặc spec sai). NHƯNG nếu TẤT CẢ TC của feature accidental-green (không có implementation nào) → feature fail | Mục Warnings (hoặc Failed nếu toàn bộ accidental-green) |
| 9 | GATE light fail (sau retry ×2) | Feature failed, ghi gate failures | Mục Failed |
| 10 | GATE full fail (sau retry ×2) | Feature partial, ghi gate failures | Mục Partial |
| 11 | Workflow crash | Log crash, feature chưa xong. Sáng resume `resumeFromRunId` | Mục Failed/Blocked |
| 12 | REFACTOR break tests | REFACTOR auto-revert; warning | Mục Warnings |
| 13 | Merge conflict (khi PR) | Không resolve đêm — tạo PR như thường, ghi conflict warning | Mục Warnings |
| 14 | PR closed/merged | Không xảy ra đêm (human chỉ merge sáng) | — |
| 15 | Type 1: human chọn Parallel | Tự chuyển về Sequential — in-place checkout không song song được; ghi lý do | Plan summary |
| 16 | Type 1: restore branch gốc fail | Warning HIGH — chặn task kế (sub-repo đang ở branch task) | Mục Warnings |
| 17 | Type 1: sub-repo không có remote | Không auto-PR, log cảnh báo — sáng human tự push/PR | Mục Warnings |
| 18 | Baseline HARD-FAIL (harness không chạy được — không có baseline file) | Skip feature; ghi lệnh test + exit code + thiếu gì (deps/build/output-dir); KHÔNG dispatch workflow | Mục Skipped |
| 19 | PR host/auth fail (`gh`/`glab` không authed, repo host lạ) | Không tạo PR, KHÔNG treo/hỏi đêm; log "PR-ready nhưng chưa tạo được (lý do)". **Board giữ 🚧 In Progress** (chưa có PR nên chưa chuyển 👀 In Review) — sáng human tạo PR tay rồi mới chuyển 👀 In Review | Mục Warnings |

## Night Review (sdlc-review-codechange)

Sau khi feature `COOK_REPORT.status = "completed"` (GATE full pass) và trước khi tạo PR,
chạy review tự động trên code vừa cook — thay cho bước "sdlc-review-codechange gợi ý" của sdlc-cook
mà đêm không thể hỏi:

```javascript
// Type 2: worktree path; Type 1: sub-repo path
// targetBranch = PR target: Type 2 → "origin/main" (workspace); Type 1 → branch gốc sub-repo.
// specDir = <workspace>/agent_docs/features/<FEAT_ID>/ (SRS + IMP + TST).
// --base → review scope = diff feature...target — chỉ code thay đổi, deterministic đêm.
// --specs → thêm Spec Compliance: code có đáp ứng tài liệu (GAP/PARTIAL/DIVERGENT).
// Lean gating trio ban đêm: security + bugs + spec (code đúng + an toàn + đáp ứng tài liệu).
// Không chạy arch/conventions/impact/ops/tests ban đêm — advisory, chờ human sáng.
// Muốn full 8 → đổi thành "--full ..." (opt-in).
Skill("sdlc-review-codechange", `--security --bugs --spec --unattended --base ${targetBranch} --specs ${specDir} ${targetPath}`)
```

Kết quả xử lý:

| result.verdict | Xử lý đêm | Morning report |
|----------------|-----------|----------------|
| `APPROVED` | Tạo PR bình thường | Reviewed: APPROVED |
| `NEEDS_ATTENTION` | Tạo PR bình thường | Reviewed: NEEDS_ATTENTION |
| `URGENT` | Tạo PR bình thường; đánh dấu "cần human review" | Reviewed: URGENT ⚠️ |
| `ERROR` | Tạo PR bình thường; ghi lý do (skill/workflow fail) | Reviewed: ERROR (lý do) |

**Nguyên tắc:** review đêm KHÔNG chặn PR creation — nó thêm signal cho human sáng, không
thay thế GATE. Mọi verdict ghi vào morning report mục Reviewed. Không bao giờ auto-merge
dựa trên review verdict. Nếu `result.reportPath` tồn tại (`.work/review/REVIEW-CODE-*.md`),
liên kết nó trong morning report để human đọc chi tiết.

## Nguyên Tắc

1. **Continue-on-fail** — mọi failure dừng feature đó, KHÔNG dừng batch. Feature kế vẫn chạy.
2. **Log everything** — mỗi auto-decision ghi: feature, điểm HITL, quyết định, lý do.
3. **No silent skip** — feature bị skip phải có lý do tường minh trong report.
4. **Never auto-merge** — bất kể GATE pass đến đâu.
5. **Spec không rõ = fail, không đoán** — STALE phải dừng feature, không tự suy diễn spec.
6. **Sáng nay là thời điểm quyết định** — report liệt kê mọi việc cần human (PR review,
   fail cần fix, dependency chưa xong), không giấu dưới implied completeness.

## Escalation Lên Orchestrator (sáng hôm sau)

Nếu feature fail vì spec sai/thiếu (không phải implementation error) → sáng đề xuất
human chạy orchestrator flow=`cr` (sửa specs) hoặc `task` (tạo specs mới). Overnight
KHÔNG tự sửa specs — theo đúng escalation protocol của `sdlc-orchestration-rules.md`.

## Edge Cases

### Baseline pre-existing failures > 10% suite

Ghi warning vào report: "N suite có N% tests fail trước TDD — cân nhắc fix trước".
Vẫn chạy feature (RED/GATE agent exclude pre-existing failures).

### Parallel + same-service

Nếu human chọn Parallel mà có feature cùng service → chạy như chọn, nhưng report
phải có mục "Merge conflict risk" ghi rõ feature nào cùng service.

### Worktree creation fail (Type 2) / in-place checkout fail (Type 1)

Ghi lý do (branch tồn tại / path tồn tại / disk full) theo
`sdlc-cook/references/error-recovery.md#worktree-fail`. Feature failed, tiếp tục batch.

### Mixed-type batch

Batch có cả Type 1 và Type 2 → chạy Sequential toàn bộ (Type 1 ép tuần tự). Không tách
lane "Type 2 song song + Type 1 tuần tự" trong cùng một đêm — phức tạp + dễ nhầm restore.

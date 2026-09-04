# Batch Planning — Lane Building & Parallel Safety

Dùng trong Phase 3 (Build Lanes) của sdlc-cook-overnight. Chuyển feature list →
lane structure an toàn cho unattended overnight.

## Input

Feature list từ Preflight, mỗi entry:
`{ featId, frId, service, layer, status, dependsOn: [featId], projectType, projectRoot }`
`projectRoot` = git root của feature (capture từ `detect-project.sh` ở Preflight) — quyết định cạnh
`depends_on` có hợp lệ thành chain (cùng repo) hay không.

## Lane Building Algorithm

### Sequential

1. Parse cạnh `depends_on` **trong-batch**: A có cạnh → B nếu B ∈ `dependsOn(A)` VÀ B cookable
   (`🟢 Ready for Cook`) VÀ cùng `projectRoot` với A. Cạnh hợp lệ = **chain edge (Form-2)** — FR_k
   cần code FR_(k-1) hiện diện khi cook.
2. Topo sort: mọi cạnh thỏa (feature xếp SAU feature nó depends). Cùng priority → giữ thứ tự board.
3. Với mỗi feature tính **`baseRef`** (ref checkout + PR vào) — resolve release-branch-aware (SKILL Phase 3):
   - Không phải đích của chain edge → integration base theo type (Type 1 branch gốc sub-repo; Type 2
     KHÔNG auto `origin/main` — release-branch derive qua skill git, xem SKILL Phase 3) — giữ nguyên.
   - Đích của chain edge (FR_k, k≥2) → **branch upstream FR_(k-1)** (controller tạo khi dispatch
     upstream xong Phase 5). Ghi nhận FR_k chained → Phase 4 chờ upstream completed rồi mới dispatch.
4. Kết quả: 1 lane duy nhất, thứ tự topo. **Chain bắt buộc tuần tự trong lane này** — không tách
   lane song song cho FR chained.

### Parallel

**Điều kiện tiên quyết:** MỌI feature trong batch là Type 2 (workspace-member). Có bất kỳ
feature Type 1 → phase này KHÔNG khả dụng; tự chuyển về Sequential (in-place checkout
không thể chạy song song) và ghi lý do vào plan summary. Có bất kỳ **chain edge** (depends_on
in-batch + cùng root) → cũng KHÔNG khả dụng: chain phải tuần tự (FR_k cần code FR_(k-1) trong
branch của nó), tự chuyển Sequential.

1. Nhóm feature theo service.
2. Nếu 2+ feature CÙNG service → phát warning rõ trong plan summary:
   `⚠️ FEAT-002 + FEAT-003 cùng auth-service — PR về cùng branch, rủi ro merge conflict.`
3. Kết quả: mỗi feature 1 lane (độc lập). Nếu vẫn có feature cùng service → vẫn chạy
   parallel nhưng flag cho human ở plan summary (human đã chọn Parallel thì tự chịu).

### Pick

1. Chỉ giữ feature được human chọn (AskUserQuestion multiSelect).
2. Dùng dependency order như Sequential.
3. Kết quả: 1 lane (sequential) — vì user chọn thủ công, không có yêu cầu song song.

## Parallel Safety Rules

| Tín hiệu | An toàn? | Lý do |
|----------|----------|-------|
| Type 1 (submodule / gitignored-subproject) | ❌ Không bao giờ parallel | In-place checkout đổi branch của chính sub-repo — ảnh hưởng cả working project |
| Disjoint service (Type 2) | ✅ | Worktree tách, file khác nhau, PR về branch khác service |
| Cùng service, disjoint file (Type 2) | ⚠️ Có điều kiện | Worktree tách nhưng PR về cùng branch → merge conflict tiềm ẩn |
| Cùng service, shared file (spec, config) (Type 2) | ❌ Không | Chạm cùng file = conflict chắc chắn |
| `depends_on` in-batch + cùng `project_root` (chain edge) | ❌ Không parallel | Phải cùng 1 lane tuần tự — FR_k cook trên branch FR_(k-1) (code present); không tách lane |
| `depends_on` khác root / không in-batch / upstream không Ready | ❌ Không → SKIP | Feature B phụ thuộc output của A — không thể cook độc lập đêm nay |

**Quy tắc cứng:** dependency chưa Done:
- Cùng batch + cùng `project_root` + upstream Ready → **HOLD** (xếp sau upstream trong lane, dispatch
  sau khi upstream Phase 5 completed) — KHÔNG SKIP, KHÔNG chạy trước dependency.
- Còn lại (khác root / không in-batch / upstream không Ready) → **SKIP** (log lý do vào plan summary).

## Plan Summary Format

Print plan summary ở cuối Phase 3, trước khi dispatch. Human soát lần cuối:

```
═══ Overnight Cook Plan ═══
[strategy] {N} features, {M} lanes
  L{idx}: {FEAT-ID} ({service}) → {FR-ID} [base: {baseRef}]
          [chain ← {FEAT-upstream}: base = branch {upstream}, cook sau khi upstream completed]
  ...
Chain (Form-2 — cùng git root, merge sáng bottom-up): FR_1 → FR_2 → ...
Skipped (không cookable):
  - {FEAT-ID}: lý do (chưa đủ specs / dependency chưa done khác root hoặc không in-batch / không chọn)
Warning: {tín hiệu parallel không an toàn nếu có}
Type 1: {liệt kê feature Type 1} — bắt buộc tuần tự, PR về remote của sub-repo
```

## Confirmation

Sau plan summary, KHÔNG cần AskUserQuestion thêm (human đã chọn strategy ở Phase 2).
Dispatch ngay — đây là điểm "cuối cùng human có thể dừng".

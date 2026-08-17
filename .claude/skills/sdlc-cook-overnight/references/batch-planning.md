# Batch Planning — Lane Building & Parallel Safety

Dùng trong Phase 3 (Build Lanes) của sdlc-cook-overnight. Chuyển feature list →
lane structure an toàn cho unattended overnight.

## Input

Feature list từ Preflight, mỗi entry:
`{ featId, frId, service, layer, status, dependsOn: [featId] }`

## Lane Building Algorithm

### Sequential

1. Build dependency order: feature có dependency → xếp SAU dependency đã merge.
2. Cùng priority → giữ thứ tự board.
3. Kết quả: 1 lane duy nhất, list có thứ tự.

### Parallel

**Điều kiện tiên quyết:** MỌI feature trong batch là Type 2 (workspace-member). Có bất kỳ
feature Type 1 → phase này KHÔNG khả dụng; tự chuyển về Sequential (in-place checkout
không thể chạy song song) và ghi lý do vào plan summary.

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
| `depends_on` chưa ✅ Done | ❌ Không | Feature B phụ thuộc output của A chưa merge |

**Quy tắc cứng:** dependency chưa Done → feature đó SKIP (log vào plan summary),
không bao giờ chạy trước dependency.

## Plan Summary Format

Print plan summary ở cuối Phase 3, trước khi dispatch. Human soát lần cuối:

```
═══ Overnight Cook Plan ═══
[strategy] {N} features, {M} lanes
  L{idx}: {FEAT-ID} ({service}) → {FR-ID}
  ...
Skipped (không cookable):
  - {FEAT-ID}: lý do (chưa đủ specs / dependency chưa done / không chọn)
Warning: {tín hiệu parallel không an toàn nếu có}
Type 1: {liệt kê feature Type 1} — bắt buộc tuần tự, PR về remote của sub-repo
```

## Confirmation

Sau plan summary, KHÔNG cần AskUserQuestion thêm (human đã chọn strategy ở Phase 2).
Dispatch ngay — đây là điểm "cuối cùng human có thể dừng".

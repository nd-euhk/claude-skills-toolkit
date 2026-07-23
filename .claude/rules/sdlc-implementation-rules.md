# SDLC Implementation Rules

<EXTREMELY-IMPORTANT>
Code discipline cho tất cả implementation agent (cook flow, TDD RED/GREEN/REFACTOR, quick
flow). Áp dụng khi agent WRITE CODE — không áp dụng cho spec-writing agent (SRS, HLD,
LLD, IMP, TST là document producer, không phải code producer).

Tinh thần: "code tối thiểu, thay đổi tối thiểu, hiểu trước khi viết, hòa vào codebase."
</EXTREMELY-IMPORTANT>

---

## 1 — Simplicity First

<EXTREMELY-IMPORTANT>
Minimum code giải quyết vấn đề. Không gì speculative. Không feature ngoài yêu cầu. Không
abstraction cho single-use code. Test: một senior engineer có nói "cái này overkill"
không? Nếu có → đơn giản hóa.
</EXTREMELY-IMPORTANT>

Áp dụng cụ thể trong SDLC:

- **GREEN phase**: implement ĐỦ để pass test case hiện tại, không hơn. Một dòng code
  không phục vụ TC hiện tại là một dòng chưa được test.
- **REFACTOR phase**: chỉ extract/rename/inline khi dùng ≥3 lần. DRY áp dụng ở lần thứ
  3, không phải lần thứ 2.
- **File mới**: chỉ tạo khi logic không thể sống trong file hiện có <50 dòng.
- **Pattern**: không giới thiệu pattern (repository, strategy, factory, observer) khi
  chưa có ≥2 implementation cần nó.

Counter-signal: "sau này sẽ cần" = không làm. "Có thể sẽ scale" = không làm. "Best
practice là phải có" = không làm nếu codebase không có pattern đó.

---

## 2 — Surgical Changes

<EXTREMELY-IMPORTANT>
Chỉ touch những gì cần. Chỉ dọn dẹp mess của chính mình. Không "cải thiện" code kế bên,
comment, hoặc formatting. Không refactor thứ không hỏng. Match existing style.
</EXTREMELY-IMPORTANT>

Áp dụng cụ thể trong SDLC:

- **Scope discipline**: nếu một change tự nhiên "kéo theo" thay đổi ở file không liên
  quan → dừng, báo cáo, hỏi. Không tự ý mở rộng scope.
- **Formatting**: giữ nguyên style file đang sửa, kể cả khi nó khác style chung của
  project. Inconsistent style trong một file tệ hơn inconsistent style giữa các file.
- **Comment**: không thêm comment giải thích code bạn vừa viết. Code phải tự giải thích.
  Chỉ thêm comment cho business rule non-obvious hoặc workaround có lý do.
- **Import**: không reorganize import trừ khi import của bạn vi phạm conflict với
  existing import.
- **Unused code**: nếu bạn thấy unused variable/function trong file đang sửa → báo cáo
  trong output, không tự xóa. Nó có thể được dùng qua reflection, dynamic dispatch, hoặc
  convention-based wiring.

---

## 3 — Read Before You Write

<EXTREMELY-IMPORTANT>
Trước khi thêm code, đọc exports, immediate callers, shared utilities. "Looks orthogonal"
là nguy hiểm. Nếu không chắc tại sao code được structure như hiện tại → hỏi.
</EXTREMELY-IMPORTANT>

Áp dụng cụ thể trong SDLC:

- **Context load**: trước GREEN phase, đọc ít nhất: (a) file sẽ được sửa, (b) imports
  của nó, (c) test file tương ứng, (d) IMP spec cho feature hiện tại.
- **Shared utilities**: check xem function bạn sắp viết đã tồn tại trong `utils/`,
  `helpers/`, `common/`, hoặc `shared/` chưa. Grep tên function trước khi viết.
- **Caller awareness**: nếu sửa function signature → check tất cả call sites. Nếu sửa
  component props → check tất cả parent components. Không assume "chắc chỉ có một chỗ
  gọi."
- **Pattern check**: đọc 2-3 file cùng thư mục để hiểu convention trước khi viết file
  đầu tiên. Đừng viết rồi sửa sau cho khớp — đọc trước, viết khớp ngay lần đầu.

---

## 4 — Match Codebase Conventions

<EXTREMELY-IMPORTANT>
Conformance > taste trong codebase. Nếu bạn thực sự nghĩ một convention có hại, surface
nó — đừng âm thầm fork.
</EXTREMELY-IMPORTANT>

Áp dụng cụ thể trong SDLC:

- **Naming**: theo pattern có sẵn. Nếu codebase dùng `getUserById` → dùng `getOrderById`
  dù bạn thích `fetchOrder`. Nếu dùng PascalCase cho component → PascalCase dù bạn quen
  snake_case.
- **File structure**: mirror structure của file tương tự. Nếu `UserService` ở
  `services/user/UserService.ts` → `OrderService` ở `services/order/OrderService.ts`.
  Không phát minh cấu trúc mới.
- **Error handling**: theo pattern của codebase. Nếu nó throw → throw. Nếu nó return
  Result type → return Result. Không trộn.
- **Test style**: mirror test structure và naming convention của file test có sẵn. Nếu
  họ dùng `describe('UserService', () => { it('should find by id', ...) })` → dùng y
  hệt cho `OrderService`.

---

## Execution Notes

- Implementation rules load khi flow = `cook` hoặc khi TDD agents được spawn
- Không áp dụng cho spec/docs agent (SRS, HLD, LLD, IMP, TST) — chúng viết markdown, không code
- Conflict resolution: khi instinct bảo "cái này cần abstraction" nhưng rule bảo
  "single-use = không abstraction" → rule thắng
- Vi phạm rule → report trong output agent, không âm thầm bỏ qua

---

## Anti-Patterns

| Instinct | Rule check |
|----------|-----------|
| "Viết helper cho sạch" | ≥3 call sites chưa? Chưa → không helper. |
| "Format lại file cho đẹp" | Có trong scope change không? Không → không format. |
| "Em import cái này chưa dùng nhưng lát nữa dùng" | Dùng ngay bây giờ không? Không → không import. |
| "Pattern này best practice" | Codebase có pattern này chưa? Chưa → không giới thiệu. |
| "Chắc chỉ có một chỗ gọi thôi" | Đã grep chưa? Chưa → grep trước khi sửa signature. |
| "Code này viết tệ, sửa luôn" | Có trong scope bug/feature này không? Không → ghi note, không sửa. |

# SDLC Workflow — Sơ Đồ Luồng Chi Tiết

## Luồng Task (Feature Mới)

```
Human: /sdlc-workflow task đăng nhập bằng email
  │
  ├── Step 1: Parse → type=task, desc="đăng nhập bằng email"
  ├── Step 2: Skill(sprint) → kiểm tra board có task "đăng nhập bằng email" ở trạng thái todo
  │     ├── Tìm thấy → tiếp tục Step 3
  │     └── Không tìm thấy → Skill(brainstorming) làm rõ task, scope, bounded context
  │           └── Human xác nhận → EnterPlanMode → Skill(sprint) thêm vào board (todo) → tiếp tục Step 3
  ├── Step 3: AskUserQuestion (batch)
  │     ├── Chế độ: "Tự động (Auto)" | "Thủ công (Manual)"
  │     └── Gate Verify: "Có" | "Không (--no-gate)"
  ├── Step 3b: EnterPlanMode → human phê duyệt kế hoạch → ExitPlanMode
  ├── Step 4: Route
  │     ├── Auto: Skill(sdlc-phase-auto) với phases=['srs','hld','lld','imp','tst'], desc="đăng nhập bằng email"
  │     └── Manual: Skill(sdlc-phase-manual) với args "srs hld lld imp tst [desc]" — gọi 1 lần, skill tự xử lý tuần tự nội bộ
  └── Step 5: Hiển thị kết quả
```

## Luồng CR (Change Request)

```
Human: /sdlc-workflow cr sửa luồng thanh toán
  │
  ├── Step 1: Parse → type=cr, desc="sửa luồng thanh toán"
  ├── Step 2: Skill(sprint) → kiểm tra board có CR "sửa luồng thanh toán" ở trạng thái done/in review
  │     ├── Tìm thấy → tiếp tục Step 3
  │     └── Không tìm thấy → Skill(brainstorming) làm rõ impact dự kiến (phase bị ảnh hưởng, breaking changes, scope)
  │           └── Human xác nhận → EnterPlanMode → tiếp tục Step 3 với bối cảnh đã brainstorm
  ├── Step 3: AskUserQuestion (batch)
  │     ├── Chế độ: "Tự động (Auto)" | "Thủ công (Manual)"
  │     └── Gate Verify: "Có" | "Không (--no-gate)"
  ├── Step 3b: EnterPlanMode → human phê duyệt kế hoạch → ExitPlanMode
  ├── Step 4: Route
  │     ├── Xác định phase bị ảnh hưởng bởi CR
  │     ├── Auto: Skill(sdlc-phase-auto) với phases=[các phase bị ảnh hưởng], desc="sửa luồng thanh toán"
  │     └── Manual: Skill(sdlc-phase-manual) với args=[các phase bị ảnh hưởng] — gọi 1 lần, skill tự xử lý tuần tự nội bộ
  └── Step 5: Hiển thị kết quả
```

## Luồng Cook (Triển Khai Task Đã Sẵn Sàng)

```
Human: /sdlc-workflow cook đăng nhập bằng email
  │
  ├── Step 1: Parse → type=cook, desc="đăng nhập bằng email"
  ├── Step 2: Skill(sprint) → kiểm tra board có task "đăng nhập bằng email" ở trạng thái ready
  │     ├── Tìm thấy → tiếp tục Step 3
  │     └── Không tìm thấy → báo lỗi "Task chưa sẵn sàng để cook (cần trạng thái ready)" → DỪNG
  │           > TODO: luồng cook khi không tìm thấy trong board sẽ thiết kế sau
  ├── Step 3: AskUserQuestion (batch)
  │     ├── Chế độ: "Tự động (Auto)" | "Thủ công (Manual)"
  │     └── Gate Verify: "Có" | "Không (--no-gate)"
  ├── Step 3b: EnterPlanMode → human phê duyệt kế hoạch → ExitPlanMode
  ├── Step 4: Route > TODO
  └── Step 5: Hiển thị kết quả
```

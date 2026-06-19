# Shared Patterns cho SDLC Flow Skills

Các pattern dùng chung cho tất cả 4 flow skill (task, fixbug, contract, compliance).
Mỗi flow skill nên tham chiếu file này thay vì lặp lại pattern.

## 1. EnterPlanMode Pattern

Mỗi bước có output quan trọng đều cần EnterPlanMode để con người phê duyệt:

```
① Trình bày kế hoạch cụ thể cho bước tiếp theo:
   - Sẽ tạo/sửa những file nào?
   - Nội dung dự kiến là gì?
   - Agent nào sẽ được dispatch?
   - Có risk gì không?

② Gọi EnterPlanMode → con người xem plan và phê duyệt

③ Sau khi phê duyệt, ExitPlanMode và dispatch agent

④ Report kết quả cho con người
```

**Quy tắc:**
- Luôn trình bày plan TRƯỚC khi gọi EnterPlanMode
- Plan phải cụ thể: file paths, agent names, expected outputs
- Không gộp nhiều bước vào một plan — mỗi EnterPlanMode cho một bước logic
- Nếu con người từ chối plan → quay lại brainstorming để điều chỉnh

## 2. Brainstorming Workflow

Dùng `Agent(brainstormer)` để phân tích cùng con người trước khi lập plan:

```
① Mời Agent(brainstormer) với context đầy đủ:
   - Mô tả vấn đề/yêu cầu
   - Service/context liên quan
   - Constraints đã biết

② Brainstormer sẽ đặt câu hỏi và phân tích:
   - Phạm vi: những gì bị ảnh hưởng?
   - Edge cases: những tình huống ngoại lệ?
   - Dependencies: liên quan đến services/contracts nào?
   - Risk: rủi ro và cách giảm thiểu

③ Lưu kết quả brainstorming vào .work/brainstorming/BRAIN-YYYYMMDD--{slug}.md

④ Dùng kết quả làm input cho EnterPlanMode
```

## 3. Error Recovery Khi Subagent Thất Bại

Khi dispatch agent thất bại (timeout, output sai, lỗi tool):

### Phân Loại Lỗi

| Loại lỗi | Triệu chứng | Cách xử lý |
|----------|------------|-----------|
| Timeout | Agent không phản hồi sau 120s | Retry 1 lần với prompt ngắn hơn. Nếu vẫn fail → báo cáo, hỏi con người |
| Output sai định dạng | File tạo ra không đúng cấu trúc | Gọi lại agent với prompt chi tiết hơn, kèm example output |
| Tool permission bị từ chối | Agent không được phép Write/Edit | Kiểm tra PreToolUse hooks — file path có hợp lệ không? |
| Dependency missing | Agent không tìm thấy file tham chiếu | Cung cấp explicitly file path thay vì để agent tự tìm |

### Quy Trình Recovery

```
① Phát hiện lỗi — đọc output của agent
② Chẩn đoán nguyên nhân gốc — dùng phân loại trên
③ Thử recovery strategy phù hợp
④ Nếu recovery fail → báo cáo cho con người:
   - Agent nào fail
   - Nguyên nhân
   - Đã thử những gì
   - Đề xuất: thủ công / skip / retry với approach khác
⑤ Ghi nhận vào báo cáo tổng kết
```

### Không Bao Giờ

- Im lặng bỏ qua lỗi — luôn báo cáo
- Tự retry vô hạn — tối đa 2 lần
- Tự sửa output của agent — nếu sai, gọi lại agent

## 4. Subagent Dispatch Conventions

### Cách Gọi Agent

```
Agent({agent-name}) với:
- {param1}: {value1}
- {param2}: {value2}
- Language: vi
```

Luôn truyền `Language: vi` cho agent để output tiếng Việt có dấu.

### Verify Outputs

Sau mỗi lần dispatch agent, đọc output file và verify:
- File có được tạo không?
- Cấu trúc có đúng không?
- Nội dung có hợp lý không?

Nếu output sai → ghi nhận và retry (xem Error Recovery).

### Song Song vs Tuần Tự

| Tình huống | Cách dispatch |
|-----------|--------------|
| IMP và TST specs từ cùng FR | Song song (độc lập) |
| Provider trước, Consumer sau | Tuần tự |
| Nhiều consumers độc lập | Song song |
| Contract update trước cascade | Tuần tự (sống còn) |
| ADR trước khi cập nhật standards | Tuần tự |

## 5. Knowledge/ Directory Bootstrap

Khi `knowledge/` chưa tồn tại trong target project, tạo cấu trúc:

```
knowledge/
├── README.md                        # Portal điều hướng
├── 01-global-standards/
│   ├── hard-boundaries.md           # Ranh giới bảo mật — áp dụng 100% services
│   ├── coding-conventions.md        # Chuẩn code chung
│   └── cross-cutting-patterns.md    # Pattern xử lý chung (idempotency, tracing, circuit breaker)
├── 02-central-contracts/
│   ├── apis/                        # OpenAPI 3.0 specs — mỗi service một file
│   ├── events/                      # AsyncAPI-style event definitions
│   └── global-error-codes.md        # Bảng mã lỗi duy nhất toàn hệ thống
├── 03-system-architecture/
│   ├── C4-context-diagram.md        # Sơ đồ tương tác toàn hệ thống
│   └── ADRs/                        # Architecture Decision Records
└── 04-microservices/
    └── {service}/
        └── tech-design.md           # Thiết kế kỹ thuật của service
```

**Quy tắc đặt tên file:**
- FR specs: `FR-{EPIC}-{NNN}--{slug}.md` (vd: `FR-WAL-001--topup-bank.md`)
- IMP specs: `FR-{EPIC}-{NNN}--{slug}-impl.md`
- TST specs: `FR-{EPIC}-{NNN}--{slug}-test.md`
- ADRs: `ADR-{NNN}--{slug}.md`
- API specs: `api-{service-name}.yaml`
- Event specs: `evt-{event-name}.yaml`

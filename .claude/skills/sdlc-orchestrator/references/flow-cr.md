# Flow: cr (Change Request)

**Trigger:** Thay đổi yêu cầu đối với feature hiện có.
**Precondition:** Target task phải tồn tại và đã được đánh giá status.

## Bước 1: Xác định Task Bị Ảnh Hưởng

1. Parse human input để xác định task(s) mà CR nhắm đến
2. Đọc `.work/board.md` để tìm task
3. Nếu task KHÔNG tìm thấy trên board → hỏi: "Task không có trên board. Feature request mới?" Nếu yes → route flow task

## Bước 2: Đánh giá Task Status

| Status | Hành động |
|---|---|
| **TODO** | "Task chưa code → đây là cập nhật yêu cầu." Route sang **flow task** |
| **ready** | Giống TODO — chưa có code. Route sang **flow task** |
| **in progress** | CR thực sự — code đang được viết. Tiếp tục Bước 3 |
| **review** | CR thực sự — code tồn tại, đang review. Tiếp tục Bước 3 |
| **done** | CR thực sự — code trong production. Tiếp tục Bước 3 (cẩn trọng) |

## Bước 3: Grilling Interview

Invoke `Skill(grilling)` để làm rõ:
- Thay đổi chính xác những gì? Tại sao?
- Phạm vi thay đổi? (services nào, APIs nào, features nào)
- Có ảnh hưởng architecture không? (cần HLD?)
- Có ảnh hưởng service internals không? (cần LLD?)
- Downstream impacts: features khác, dependent tasks, integrations?
- Mức độ khẩn cấp và rủi ro?

## Bước 4: Impact Analysis

Dựa trên grilling, xác định blast radius:

1. Đọc `agent_docs/features/README.md` — dependency graph
2. Đọc `agent_docs/features/FR-*.md` — affected feature specs
3. Đọc `agent_docs/domain-service-mapping.yaml` — affected services
4. Báo cáo human: "CR này ảnh hưởng: [list FRs, services, APIs]. Các phase cần chạy lại: [list]."

## Bước 5: Thực thi Specs Pipeline (Optional Update)

Chạy **Specs Pipeline**, nhưng CHỈ cho phase bị ảnh hưởng:
- Architecture thay đổi → chạy HLD (và mọi thứ sau đó)
- API contract thay đổi → chạy LLD (và mọi thứ sau đó)
- Feature behavior thay đổi → chạy SRS (và mọi thứ sau đó)
- Chỉ implementation detail thay đổi → chỉ chạy IMP ∥ TST

**Đừng chạy lại phase không bị ảnh hưởng.** Xác nhận với human trong Plan step.

## Bước 6: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → "Sprint Artifact Update".

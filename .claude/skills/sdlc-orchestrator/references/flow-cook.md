# Flow: cook

**Trigger:** Thực thi code từ ready specs — build feature thực tế.
**Precondition:** Task PHẢI có status `ready` trên board.

## Bước 1: Xác minh Readiness

1. Đọc `.work/board.md` và `.work/backlog.md`
2. Tìm task human muốn cook
3. Route theo status:

| Status | Hành động |
|---|---|
| **ready** | Tiếp tục Bước 2 |
| **TODO** | Từ chối: "Task chưa có specs đầy đủ. Chạy flow task trước." |
| **in progress** | Cảnh báo: "Task đang được triển khai. Tiếp tục hay spawn thêm developer?" |
| **review** | Cảnh báo: "Task đang review. Chạy cook lại từ đầu hay chỉ cần fix review findings?" |
| **done** | Cảnh báo: "Task đã done. Muốn sửa gì thêm? Nếu là bug, dùng flow fixbug." |
| **Không tìm thấy** | Từ chối: "Task không tồn tại trên board." |

## Bước 2: Grilling Interview

Nếu task status `ready` và context chưa đủ:
- Xác nhận service(s) cần build (backend, frontend, hoặc cả hai)
- Xác nhận branch để làm việc
- Xác nhận deployment hoặc environment requirements đặc biệt
- Xác nhận dependencies (tất cả dependent tasks đã done chưa?)

## Bước 3: Chuyển Task sang In Progress

1. Update task status trên board từ `ready` → `in progress`
2. Invoke `Skill(sprint)` để cập nhật `.work/board.md` và `.work/backlog.md`

## Bước 4: Spawn Developer Agents

Dựa trên feature specs của task (kiểm tra FR layer):
- **Backend features** → spawn `sdlc-backend-developer`
- **Frontend features** → spawn `sdlc-frontend-developer`
- **Cả hai** → default tuần tự (backend trước, frontend sau). Song song nếu thực sự độc lập (xác nhận với human)

Template: `references/procedures.md` → "Developer Agent — cook".

## Bước 5: Code Review

Sau khi developer agents finish:

1. Invoke `Skill(sdlc-review)` trên code mới
2. Dùng mode phù hợp:
   - `--code` mode để review against IMP và TST specs
   - `--full` mode để comprehensive review (arch, security, bugs, conventions, impact, ops, tests)
3. Nếu review tìm thấy issues → spawn developer agents để fix. Lặp đến khi review pass hoặc human chấp nhận với known issues.

## Bước 6: Git Push

1. Invoke `Skill(git)` để commit và push code
2. Đảm bảo commit message tham chiếu FR-ID và task
3. Xác nhận với human trước khi push lên shared/protected branch

## Bước 7: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → "Sprint Artifact Update". Cụ thể:
- Board: move task từ `in progress` → `in review` → `done`
- Backlog: update status thành `done`
- Roadmap: update feature progress

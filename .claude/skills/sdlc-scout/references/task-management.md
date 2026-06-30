# Quản Lý Tác Vụ Scout

Theo dõi tiến trình thực thi scout agent song song qua Claude Native Tasks (TaskCreate, TaskUpdate, TaskList).

## Khi Nào Tạo Tác Vụ

| Số Agent | Tạo Tác Vụ? | Lý Do |
|----------|-------------|-------|
| ≤ 2      | Không       | Overhead vượt lợi ích, hoàn thành nhanh |
| ≥ 3      | Có          | Cần phối hợp, theo dõi tiến trình |

## Quy Trình Đăng Ký Tác Vụ

```
TaskList()                          // Kiểm tra tác vụ scout hiện có
  → Có tác vụ?  → Bỏ qua, dùng lại
  → Trống?      → TaskCreate cho mỗi agent (xem schema bên dưới)
```

## Schema Metadata

```
TaskCreate(
  subject: "Scout {thư-mục} cho {mục-tiêu}",
  activeForm: "Đang scout {thư-mục}",
  description: "Tìm kiếm {thư-mục} cho {patterns}",
  metadata: {
    agentType: "Explore",
    scope: "src/auth/,src/middleware/",
    scale: 6,
    agentIndex: 1,               // Vị trí 1-indexed
    totalAgents: 6,
    priority: "P2",              // Luôn P2 cho scout coordination
    effort: "3m"                 // Timeout cố định mỗi agent
  }
)
```

### Trường Bắt Buộc

- `agentType` — Loại subagent: `"Explore"`
- `scope` — Ranh giới thư mục (phân cách bằng dấu phẩy)
- `scale` — Tổng số SCALE từ bước ước lượng
- `agentIndex` / `totalAgents` — Theo dõi vị trí (vd: 3 trên 6)
- `priority` — Luôn `"P2"` (scout = coordination, không phải primary work)

### Trường Tùy Chọn

- `searchPatterns` — Từ khóa chính đang tìm (hỗ trợ debug)

## Vòng Đời Tác Vụ

```
Bước 3: TaskCreate mỗi agent      → status: pending
Bước 4: Trước khi spawn agent     → TaskUpdate → status: in_progress
Bước 5: Agent trả về report       → TaskUpdate → status: completed
Bước 5: Agent timeout (3 phút)    → Giữ in_progress, thêm error metadata
```

### Xử Lý Timeout

```
TaskUpdate(taskId, {
  metadata: { ...existing, error: "timeout" }
})
// Tác vụ giữ in_progress — phân biệt timeout với chưa hoàn thành
// Ghi vào phần "Câu Hỏi Chưa Giải Quyết" trong report
```

## Ví Dụ

### Scout Với 6 Agent

```
// Bước 3: Đăng ký 6 tác vụ
TaskCreate(subject: "Scout src/auth/ tìm auth files",
  activeForm: "Đang scout src/auth/",
  metadata: { agentType: "Explore", scope: "src/auth/", scale: 6,
              agentIndex: 1, totalAgents: 6, priority: "P2" })  // → taskId1

// Lặp lại cho agent 2-6 với scope khác nhau

// Bước 4: Spawn agent
TaskUpdate(taskId1, { status: "in_progress" })
// ... spawn tất cả Explore subagents trong 1 lần gọi Agent

// Bước 5: Thu thập
TaskUpdate(taskId1, { status: "completed" })  // đã nhận report
TaskUpdate(taskId3, { metadata: { error: "timeout" } })  // timeout
```

## Xử Lý Lỗi

Nếu `TaskCreate` thất bại: ghi warning, tiếp tục không cần task tracking. Scout vẫn hoạt động đầy đủ — task chỉ thêm observability, không phải functionality.

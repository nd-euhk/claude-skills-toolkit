# Thực Thi Scout Với Explore Subagents

Sử dụng Explore subagents khi cần tìm kiếm codebase song song. Spawn qua công cụ `Agent`.

## Cách Hoạt Động

Spawn nhiều `Explore` subagents qua công cụ `Agent` để tìm kiếm codebase song song.

## Cấu Hình Agent

```
subagent_type: "Explore"
```

## Prompt Template

```
Nhanh chóng scout {THƯ-MỤC} để tìm file liên quan đến: {YÊU-CẦU}

Hướng dẫn:
- Tìm file liên quan khớp với nhiệm vụ
- Dùng Grep để tìm file
- Liệt kê file với mô tả ngắn
- Timeout: 3 phút tối đa
- Bỏ qua nếu timeout

Định dạng báo cáo:
## File Tìm Thấy
- `path/file.ext` - mô tả

## Patterns
- Pattern chính quan sát được
```

## Chiến Lược Chia Thư Mục

Chia codebase theo logic:
- `src/` - Mã nguồn
- `lib/` - Thư viện
- `tests/` - File kiểm thử
- `config/` - Cấu hình
- `api/` - API routes
- `middleware/` - Middleware
- `models/` - Data models
- `utils/` - Tiện ích

### Quy Tắc Phân Chia

- Mỗi agent nhận một phạm vi thư mục riêng biệt
- Không chồng lấn giữa các agent
- Ưu tiên chia theo module chức năng (auth, payment, user...) thay vì theo loại file
- Đảm bảo độ phủ tối đa

## Hướng Dẫn Quy Mô

- Codebase nhỏ (<50 file): 2-3 agent
- Codebase vừa (50-200 file): 4-6 agent
- Codebase lớn (200+ file): 6-8 agent hoặc pipeline workflow

## Thực Thi Song Song

- Spawn tất cả agent trong một lần gọi `Agent` duy nhất
- Mỗi agent nhận phạm vi thư mục riêng
- Không trùng lặp giữa các agent

## Xử Lý Timeout

- Đặt timeout 3 phút cho mỗi agent
- Bỏ qua agent không phản hồi
- Không khởi động lại agent đã timeout
- Tổng hợp kết quả có sẵn

## Đọc Nội Dung File (Chunked Reading)

Khi cần đọc nội dung file, dùng chunking để giữ trong giới hạn context (<150K tokens vùng an toàn).

### Bước 1: Đếm Dòng

```bash
wc -l path/to/file1.ts path/to/file2.ts path/to/file3.ts
```

### Bước 2: Tính Toán Chunk

- **Mục tiêu:** ~500 dòng mỗi chunk (an toàn cho hầu hết file)
- **Tối đa file mỗi agent:** 3-5 file nhỏ HOẶC 1 file lớn chia chunk

**Công thức chia chunk:**
```
số_chunk = ceil(tổng_số_dòng / 500)
số_dòng_mỗi_chunk = ceil(tổng_số_dòng / số_chunk)
```

### Bước 3: Đọc File Song Song

**File nhỏ (<500 dòng mỗi file) — dùng Read trực tiếp:**
Đọc từng file với công cụ `Read`. Gom các lần đọc độc lập vào một message để thực thi song song.

**File lớn (>500 dòng) — dùng Read với offset/limit:**
```
Read file_path="large-file.ts" offset=1 limit=500
Read file_path="large-file.ts" offset=501 limit=500
Read file_path="large-file.ts" offset=1001 limit=500
```

### Cây Quyết Định Chunking

```
File < 500 dòng       → Đọc toàn bộ file
File 500-1500 dòng    → Chia 2-3 lần Read với offset/limit
File > 1500 dòng      → Chia thành ceil(số_dòng/500) lần Read
```

Thực thi tất cả các lần đọc trong một message duy nhất để chạy song song.

## Tổng Hợp Kết Quả

Kết hợp kết quả từ tất cả agent:
1. Loại bỏ trùng lặp đường dẫn file
2. Hợp nhất mô tả
3. Ghi chú các khoảng trống/timeout
4. Liệt kê câu hỏi chưa giải quyết

## Ví Dụ

Yêu cầu: "Tìm file liên quan đến xác thực"

```
Agent 1: Scout src/auth/, src/middleware/ tìm auth files
Agent 2: Scout src/api/, src/routes/ tìm auth endpoints
Agent 3: Scout tests/ tìm auth tests
Agent 4: Scout lib/, utils/ tìm auth utilities
Agent 5: Scout config/ tìm auth configuration
Agent 6: Scout types/, interfaces/ tìm auth types
```

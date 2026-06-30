# Bổ Sung SDLC — Enhance Scout Output

Cách bổ sung SDLC-specific sections vào report sau khi Explore agent hoàn thành. Dùng cho chiến lược trực tiếp (review mode, ≤200 file). Pipeline strategy đã bao gồm bước enhancement nội bộ.

## Khi Nào Bổ Sung

Luôn bổ sung khi `mode=review` — review agents cần dữ liệu có cấu trúc để quyết định file nào cần đọc. Với `mode=explore`, pipeline workflow xử lý enhancement nội bộ.

## Quy Trình Bổ Sung

### Bước 1: Đọc Scout Report

Đọc report đã sinh từ `.work/scouts/scout-YYYYMMDD-{topic}--{slug}.md`.

### Bước 2: Trích Xuất + Làm Giàu

Dùng 1 Explore agent để đọc report và source code thực tế, bổ sung:

#### Modules và Trách Nhiệm

Với mỗi module logic tìm thấy, thêm:
- **Tên** — định danh module
- **Trách nhiệm** — module này làm gì (1 câu)
- **Phụ thuộc** — những module khác mà nó phụ thuộc
- **Public API** — các hàm/class được export chính

Prompt cho agent:
```
Đọc scout report tại {reportPath}. Sau đó khám phá source code của 
top-N file (chỉ high relevance) để xác định module logic.

Với mỗi module, xác định:
1. Trách nhiệm — module này làm gì?
2. Phụ thuộc — import/gọi những module nào khác?
3. Public API — các symbol được export chính là gì?

Thêm vào report phần "## Modules và Trách Nhiệm".
```

#### Bảng Entry Points

Quét tất cả entry point và thêm bảng:
```
| Entry Point | Type | Path | Description |
|-------------|------|------|-------------|
| main()      | CLI  | src/index.ts | Application bootstrap |
```

Các loại: `HTTP Handler`, `CLI Command`, `Event Handler`, `Worker`, `Cron Job`, `gRPC`, `GraphQL`, `Middleware`, `Startup Hook`.

#### Dependency Mapping

Đọc file cấu hình để xây dựng bảng external dependency:
```
| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.0 | HTTP framework |
```

Với internal dependency, xây dựng đồ thị phụ thuộc chéo giữa các module:
```
| Module | Depends On | Relationship |
|--------|-----------|--------------|
| auth   | database  | Reads user records |
| auth   | cache     | Stores sessions |
```

#### Architectural Patterns

Xác định pattern kèm bằng chứng cụ thể:
```
- **Repository Pattern** — src/db/user-repo.ts:15 triển khai data access layer
- **Middleware Chain** — src/middleware/ chain trong src/app.ts:42-56
```

### Bước 3: Ghi Report Đã Bổ Sung

Ghi đè report với phiên bản đã bổ sung. Giữ tất cả phần gốc, thêm phần SDLC.

## Token Budget

- Enhancement agent: 1 Explore agent, schema output
- Timeout: 3 phút
- Nếu scout report có >20 file high-relevance → lấy mẫu top 10

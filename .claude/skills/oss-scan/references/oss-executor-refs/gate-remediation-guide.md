# Hướng Dẫn Khắc Phục Vi Phạm

Danh sách phương án thay thế cho các license rủi ro cao. Dùng khi đề xuất
remediation trong violation report hoặc khi `oss-scan-executor` cần điền trường "Ghi chú
thay thế" (trường 22).

## Bảng Thay Thế License → Giải Pháp

### AGPL-3.0 → chọn một trong

| Giải pháp | Chi tiết |
|-----------|----------|
| **Apache-2.0 tương đương** | Thư viện cùng chức năng license permissive (phổ biến nhất) |
| **MIT/BSD tương đương** | Thư viện lightweight hơn |
| **Tách microservice độc lập** | Chạy AGPL component như service riêng giao tiếp qua API — không link, không sửa đổi |
| **Bản commercial** | Nếu vendor bán license commercial (nhiều AGPL project làm vậy) |

### GPL-2.0/3.0 (link vào sản phẩm) → chọn một trong

| Giải pháp | Chi tiết |
|-----------|----------|
| **Tách process** | Chạy như standalone executable/CLI, giao tiếp qua exec/network |
| **Bản commercial** | Nếu dual-license (GPL + commercial) |
| **Thư viện permissive thay thế** | Tìm thư viện cùng chức năng license MIT/Apache/BSD |
| **Chỉ dùng build-time** | Nếu chỉ dùng lúc build (tool), không runtime link |

### SSPL / BUSL / Commons Clause → chọn một trong

| Giải pháp | Chi tiết |
|-----------|----------|
| **Thay thế hoàn toàn** | Hầu hết trường hợp — không có exception thông thường |
| **Tự host alternative** | Tìm open-source alternative license permissive |

### Non-commercial / research-only → chọn một trong

| Giải pháp | Chi tiết |
|-----------|----------|
| **Mua commercial license** | Nếu tồn tại |
| **Thay thế** | Tìm dữ liệu/asset tương đương license thương mại được |
| **Loại bỏ** | Nếu không thiết yếu |

### NOASSERTION / Unlicensed → chọn một trong

| Giải pháp | Chi tiết |
|-----------|----------|
| **Xin license từ tác giả** | Bằng văn bản, có audit trail |
| **Thay thế** | Component có license rõ ràng |
| **Chặn vĩnh viễn** | Mặc định nếu không xác định được chủ sở hữu |

## Bảng Thay Thế Theo Chức Năng (mẫu)

Các cặp thay thế phổ biến theo ngôn ngữ/ecosystem:

| Chức năng | License rủi ro (tránh) | Alternative an toàn |
|-----------|----------------------|---------------------|
| PDF generation (Java) | iText (AGPL) | Apache PDFBox (Apache-2.0), OpenPDF (LGPL) |
| PDF generation (JS) | jsPDF phiên bản mới (cần commercial) | pdf-lib (MIT) |
| ORM (Java) | Hibernate (LGPL — OK nếu dynamic) | Spring Data JPA wrapper |
| Task queue | Sidekiq Pro (commercial) | GoodJob (MIT), Sidekiq OSS |
| Database driver | MySQL connector (GPL dual) | MariaDB connector (LGPL) |
| Template engine | Thymeleaf (Apache-2.0 — OK) | Freemarker (Apache-2.0) |
| Icon set | Font Awesome Pro (commercial) | Font Awesome Free (CC-BY-4.0 + OFL) |
| Chart lib | Highcharts (commercial) | Chart.js (MIT), ECharts (Apache-2.0) |
| Admin template | Regular License (cấm bán) | Mua Extended License hoặc tự build |
| AI model | Llama (có MAU cap) | Qwen/Apache-2.0 models nếu phù hợp |

**Lưu ý:** bảng trên là mẫu khởi đầu — executor cần research thêm alternative cụ
thể cho từng component khi cần. Không tự ý chọn thay thế mà chưa verify license
của alternative đó (phải thuộc R1/R2).

## Quy Trình Khắc Phục

```
1. Xác định component vi phạm (oss-gate-executor phát hiện)
2. Tra bảng thay thế → đề xuất ≥2 phương án
3. Verify license của alternative (phải R1 hoặc R2 có điều kiện đạt)
4. Đánh giá migration cost: thay đổi API, data migration, performance
5. Trình human/LRB chọn phương án
6. Ghi kết quả vào violation report + Registry
7. Sau khi thay thế → chạy lại oss-scan-executor để xác nhận sạch
```

## Quy Tắc

1. **Alternative phải được verify license** — không đề xuất "thay bằng X" nếu
   chưa biết X license gì
2. **Migration cost luôn được đánh giá** — không đề xuất thay thế như hành động
   vô hại
3. **Ưu tiên thay thế ít phá vỡ nhất** — dynamic→static, minor→major là các cấp
   khác nhau
4. **Không tự thực hiện thay thế** — executor chỉ đề xuất, human/LRB quyết định và
   thực hiện (hoặc phối hợp qua cook flow)

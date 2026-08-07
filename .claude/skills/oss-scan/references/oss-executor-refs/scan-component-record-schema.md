# Mẫu Hồ Sơ Thành Phần Bên Thứ Ba (Component Record)

Template 22 trường chuẩn hóa từ `quan-ly-rui-ro-opensource.md` (mục 7.1). Mỗi
thành phần trong báo cáo scan phải tuân thủ schema này để `oss-risk-research-executor`
và `oss-gate-executor` tiêu thụ được một cách máy-móc-hiểu được.

## Cấu Trúc Báo Cáo Scan

Báo cáo `.work/oss-compliance/OSS-SCAN-*.md` gồm:

1. **YAML frontmatter** — metadata máy đọc được
2. **Phần tổng quan** — bảng summary theo nhóm rủi ro (R1/R2/R3/R4)
3. **Các record component** — mỗi record theo 22 trường dưới đây
4. **Phần gap** — "Câu hỏi chưa giải quyết" (Type 10 blindness, manual items)
5. **JSON summary block** — cuối file, trong code fence, cho executor hạ nguồn

### YAML Frontmatter

```yaml
---
project: <tên project hoặc đường dẫn>
scan_date: YYYY-MM-DD
tool_version: oss-scan-1.0.0
scanner: syft|<build-tool-parse>|trivy
component_count: <số nguyên>
direct_only: true|false
---
```

### JSON Summary Block (cuối file)

```json
{
  "project": "...",
  "scan_date": "YYYY-MM-DD",
  "components": [
    {
      "ma_ho_so": "TPC-2026-0001",
      "ten": "...",
      "loai_tai_san": 1,
      "version": "...",
      "license": "...",
      "spdx_id": "...",
      "nhom_rui_ro": "R1",
      "cach_tich_hop": "dynamic_link",
      "nguon": "...",
      "trang_thai": "Under-review",
      "ngay_ra_soat_ke_tiep": "YYYY-MM-DD"
    }
  ]
}
```

---

## Bảng 22 Trường Component Record

| # | Trường | Auto-fill rule | Bắt buộc? | Ví dụ |
|---|--------|---------------|-----------|-------|
| 1 | Mã hồ sơ | TPC-{YYYY}-{số tăng dần:04d} | ✅ | TPC-2026-0142 |
| 2 | Tên thành phần | Từ SBOM component name / filename | ✅ | openpdf |
| 3 | Loại tài sản | Theo 10 nhóm (scan-asset-types.md) | ✅ | 1 (thư viện OSS) |
| 4 | Phiên bản được duyệt | Từ SBOM / lockfile (semver) | ✅ | 1.3.30 |
| 5 | License (SPDX ID) | Từ SBOM license field; filesystem → LICENSE file | ✅ | LGPL-2.1-only |
| 6 | Nhóm rủi ro | Auto-map từ scan-license-policy.md | ✅ | R2 |
| 7 | Nguồn tải chính thức | Từ SBOM purl / source-url / registry | ✅ | Maven Central |
| 8 | Mục đích sử dụng | [MANUAL] hoặc infer từ import context | ⚠️ | Sinh file PDF sao kê |
| 9 | Sản phẩm/hệ thống áp dụng | [MANUAL] hoặc project name (cwd) | ⚠️ | Backend Portal X |
| 10 | Cách tích hợp | Infer từ dep type | ✅ | dynamic_link |
| 11 | Có sửa đổi mã nguồn không | [MANUAL] default "Không" | ⚠️ | Không |
| 12 | Nghĩa vụ tuân thủ | Auto-gen từ scan-license-policy.md | ✅ | Giữ notice LGPL; không static link |
| 13 | Bằng chứng license | Path tới LICENSE file / URL | ✅ | LICENSE.txt v1.3.30 |
| 14 | Điều kiện phê duyệt | Auto-gen theo nhóm rủi ro | ⚠️ | "Chỉ backend; cấm đưa vào SDK" |
| 15 | Người đề xuất | [MANUAL] | ⚠️ | — |
| 16 | Owner | [MANUAL] | ⚠️ | — |
| 17 | Người phê duyệt & ngày | [MANUAL] | ⚠️ | — |
| 18 | Ngày rà soát gần nhất | Auto: ngày scan | ✅ | 2026-08-07 |
| 19 | Ngày rà soát kế tiếp | Auto: scan_date + chu kỳ theo nhóm (R1:24mo, R2:12mo, R3:6mo, R4:6mo) | ✅ | 2027-08-07 |
| 20 | Trạng thái | "Under-review" cho mới, "Active" nếu có trong Registry | ✅ | Under-review |
| 21 | Hạn hợp đồng/thanh toán | [MANUAL] cho R4, "Không áp dụng" cho khác | ⚠️ | — |
| 22 | Ghi chú thay thế | Auto: search gate-remediation-guide.md | ⚠️ | Apache PDFBox |

**Bắt buộc (✅):** trường executor auto-fill được — luôn có mặt trong báo cáo.
**Tùy chọn (⚠️):** cần input con người — executor hỏi qua AskUserQuestion hoặc điền
placeholder `[MANUAL]` và flag trong gap section.

## Giá Trị Cho Phép Của Các Trường Enum

### Loại tài sản (trường 3)

`1`=Thư viện OSS, `2`=SDK/API thương mại, `3`=Font, `4`=Icon/ảnh/video,
`5`=Template, `6`=AI model, `7`=Dataset, `8`=Dev tool, `9`=Container image,
`10`=Plugin/code snippet.

### Cách tích hợp (trường 10)

```
static_link        | Liên kết tĩnh (binary/JAR packed)
dynamic_link       | Liên kết động (runtime resolution)
standalone_service | Dịch vụ chạy tách biệt (network/exec)
build_time_only    | Chỉ dùng lúc build (plugin, generator)
saas_api           | Gọi qua SaaS API
container_base     | Base image của container
embedded_file      | File nhúng trong sản phẩm (font, ảnh, model)
plugin             | Plugin/extension runtime
```

### Nhóm rủi ro (trường 6)

`R1` (permissive) | `R2` (weak copyleft/điều kiện) | `R3` (strong copyleft) | `R4` (commercial/đặc thù)

### Trạng thái (trường 20)

`Active` | `Under-review` | `Deprecated` | `Banned`

### Chu kỳ rà soát (trường 19)

```
R1 → +24 tháng
R2 → +12 tháng
R3 → +6 tháng
R4 → +6 tháng (hoặc theo hạn hợp đồng, lấy sớm hơn)
```

## Quy Tắc Validation

1. **Mã hồ sơ duy nhất** trong phạm vi báo cáo
2. **SPDX ID hợp lệ** hoặc NOASSERTION — license lạ → flag R4
3. **Nhóm rủi ro nhất quán với license** theo scan-license-policy.md — nếu mâu thuẫn,
   scan-license-policy.md thắng
4. **Nguồn tải là URL hợp lệ** hoặc tên registry chính thức
5. **Trạng thái mặc định = Under-review** trừ khi có Registry trước đó
6. Record không đạt validation → đánh dấu `[INVALID]` trong báo cáo, không bỏ sót

## Markdown Template Cho Mỗi Record

```markdown
### TPC-2026-0001 — openpdf 1.3.30

| Trường | Giá trị |
|--------|---------|
| Loại tài sản | Thư viện mã nguồn mở (Java) |
| Phiên bản | 1.3.30 |
| License (SPDX ID) | LGPL-2.1-only |
| Nhóm rủi ro | R2 |
| Nguồn tải | Maven Central, SHA-256: a1b2... |
| Mục đích sử dụng | Sinh file PDF sao kê cho người dùng |
| Sản phẩm/hệ thống | Backend Portal X |
| Cách tích hợp | Dynamic link (JAR runtime) |
| Sửa đổi mã nguồn? | Không |
| Nghĩa vụ tuân thủ | Giữ notice LGPL; không static link; nếu sửa đổi phải công bố; cho phép người dùng thay thế (relink) |
| Bằng chứng license | LICENSE.txt v1.3.30 |
| Điều kiện phê duyệt | "Chỉ backend; cấm đưa vào SDK phân phối" |
| Người đề xuất | [MANUAL] |
| Owner | [MANUAL] |
| Phê duyệt & ngày | [MANUAL] |
| Rà soát gần nhất | 2026-08-07 |
| Rà soát kế tiếp | 2027-08-07 |
| Trạng thái | Under-review |
| Hạn hợp đồng | Không áp dụng |
| Ghi chú thay thế | Apache PDFBox (Apache-2.0) |
```

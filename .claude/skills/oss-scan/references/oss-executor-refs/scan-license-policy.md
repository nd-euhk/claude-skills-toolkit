# Chính Sách License Nội Bộ

Mã hóa máy-móc-hiểu được của chính sách license từ `quan-ly-rui-ro-opensource.md`
(mục 2.2 + 5.1). Đây là nguồn sự thật cho cả 3 executor: `oss-scan-executor` (map license →
nhóm rủi ro), `oss-risk-research-executor` (xác định ưu tiên research), `oss-gate-executor`
(đối chiếu Allow/Restrict/Deny).

## Nguyên tắc vàng

> **"No license = No rights"** — một thành phần không ghi license đồng nghĩa tác
> giả giữ toàn bộ quyền, không được phép sử dụng, kể cả khi tải công khai trên
> Internet. Mọi hoạt động của tổ chức được coi là **sử dụng thương mại** — cấm
> dùng tài sản mang điều khoản "non-commercial", "research only", "evaluation only".

---

## ALLOWLIST (R1) — Cho phép, tự động phê duyệt

| SPDX ID | Tên đầy đủ | Điều kiện kèm theo |
|---------|-----------|-------------------|
| MIT | MIT License | Giữ nguyên copyright notice trong file NOTICE của bản phát hành |
| ISC | ISC License | Giữ nguyên copyright notice |
| BSD-2-Clause | BSD 2-Clause | Giữ nguyên copyright notice |
| BSD-3-Clause | BSD 3-Clause | Giữ nguyên copyright notice |
| Apache-2.0 | Apache License 2.0 | Giữ NOTICE; lưu ý điều khoản chấm dứt khi kiện patent |
| Zlib | zlib License | Giữ notice |
| CC0-1.0 | Creative Commons Zero | Không nghĩa vụ (vẫn ghi nhận vào Registry) |
| Unlicense | The Unlicense | Không nghĩa vụ (vẫn ghi nhận vào Registry) |
| WTFPL | Do What The Fuck You Want | Không nghĩa vụ (vẫn ghi nhận vào Registry) |
| OFL-1.1 | SIL Open Font License | Không bán font đứng riêng; giữ tên font gốc khi sửa đổi; được nhúng app/web |
| PostgreSQL | PostgreSQL License | Giữ notice |
| PSF-2.0 | Python Software Foundation License | Giữ notice |
| 0BSD | BSD Zero Clause | Không nghĩa vụ |

## RESTRICTED LIST (R2) — Cho phép có điều kiện, phải qua thẩm định

| SPDX ID / Trường hợp | Điều kiện được duyệt |
|---------------------|---------------------|
| LGPL-2.1-only, LGPL-2.1-or-later, LGPL-3.0-only, LGPL-3.0-or-later | Chỉ dynamic linking, không sửa đổi thư viện; nếu sửa đổi → công bố phần sửa; với mobile app (thường static link) → phải qua LRB |
| MPL-2.0 | Không sửa file gốc; nếu sửa → công bố file đã sửa |
| EPL-2.0, EPL-1.0 | Không sửa file gốc; nếu sửa → công bố file đã sửa |
| CDDL-1.0, CDDL-1.1 | Không sửa file gốc; nếu sửa → công bố file đã sửa |
| GPL-2.0-only, GPL-2.0-or-later, GPL-3.0-only, GPL-3.0-or-later (công cụ, không link) | Chỉ dùng như công cụ độc lập (compiler, CLI, server chạy tách biệt giao tiếp qua network/exec) — không link vào code sản phẩm. Ví dụ hợp lệ: Git, Linux, GCC |
| Font thương mại | Có hợp đồng ghi rõ kênh sử dụng (web/app/in ấn), số lượt cài đặt/pageview; Mua sắm giữ hợp đồng gốc |
| SDK/API thương mại | Rà soát điều khoản dữ liệu (đặc biệt dữ liệu KH gửi ra ngoài), hạn mức, quyền chấm dứt |
| Mô hình AI có license riêng (Llama, OpenRAIL...) | LRB xác nhận: quyền dùng thương mại, hạn mức MAU, nghĩa vụ attribution, use-case bị cấm (Acceptable Use Policy) |
| CC-BY-4.0, CC-BY-3.0 (ảnh, icon, nội dung) | Thực hiện attribution đúng format tác giả yêu cầu, tại nơi người dùng nhìn thấy được |
| Dual-license (GPL + Commercial) | Mua bản commercial nếu không đáp ứng được GPL |

## DENYLIST (R3/deny) — Cấm sử dụng trong sản phẩm

| SPDX ID / Trường hợp | Lý do |
|---------------------|-------|
| AGPL-3.0-only, AGPL-3.0-or-later | Nghĩa vụ công bố mã nguồn áp dụng cả khi chỉ cung cấp qua mạng (SaaS) — đúng mô hình kinh doanh. Ngoại lệ duy nhất: chạy như dịch vụ độc lập hoàn toàn tách biệt, không sửa đổi, do LRB phê duyệt |
| SSPL-1.0 | Hạn chế cung cấp như một dịch vụ |
| BUSL-1.1 | Điều khoản cạnh tranh mơ hồ, rủi ro cao |
| Commons Clause | Hạn chế bán phần mềm; điều khoản mơ hồ |
| GPL link trực tiếp (static/dynamic) vào sản phẩm phân phối | Buộc công bố toàn bộ mã nguồn sản phẩm |
| CC-BY-NC-*, CC-BY-ND-* | Tổ chức thương mại — mọi sử dụng đều là thương mại |
| Non-commercial, "research only", "evaluation only" | Tổ chức thương mại không được dùng |
| Không có license / không xác định được (NOASSERTION) | No license = no rights |
| "JSON License" (Good, not Evil) | Điều khoản đạo đức mơ hồ, không đủ chắc chắn pháp lý |
| Font/ảnh/template tải "miễn phí" từ nguồn không chính thức | Vi phạm bản quyền trực tiếp |
| CC-BY-SA (code copy nguyên khối từ StackOverflow) | Mặc định mang copyleft. Chỉ dùng làm tham khảo, viết lại theo cách của mình |

---

## Bảng Map Nhóm Rủi Ro

Quy tắc ưu tiên khi license không nằm trong một nhóm rõ ràng: **lấy nhóm nghiêm
ngặt hơn**. Nếu license không phải SPDX hợp lệ → NOASSERTION → R4.

| Nhóm | SPDX ID / trường hợp | Chính sách mặc định |
|------|---------------------|--------------------|
| **R1** | MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, Zlib, CC0-1.0, Unlicense, WTFPL, OFL-1.1, PostgreSQL, PSF-2.0, 0BSD, BSL-1.0 | ✅ Cho phép (auto-approve) |
| **R2** | LGPL-*, MPL-*, EPL-*, CDDL-*, GPL-* (chỉ tool standalone), CC-BY-*, commercial font/SDK/AI, dual-license, license "với điều kiện" | ⚠️ Cho phép có điều kiện (cần review) |
| **R3** | AGPL-*, SSPL-*, BUSL-*, GPL-* (link vào sản phẩm), CC-BY-SA, CC-BY-NC, CC-BY-ND, non-commercial, JSON License, unlicensed | 🔶 Hạn chế — mặc định từ chối, chỉ duyệt ngoại lệ ở cấp Hội đồng |
| **R4** | Commercial EULA, proprietary license, custom terms, rights-managed assets, NOASSERTION, license không xác định | 🔶 Bắt buộc review từng trường hợp (LRB + Mua sắm); thành phần không có license = ❌ Cấm |

### Ngưỡng rủi ro license cho risk scoring

Dùng trong `oss-risk-research-executor`:

- R1 → 0
- R2 → 2
- R3 → 6
- R4 → 3–8 (tùy mức độ: EULA rõ ràng = 3, NOASSERTION = 5, unlicensed = 8)

---

## Ghi chú triển khai

- **Multi-license**: SBOM có thể trả về danh sách license cho một component.
  Dùng quy tắc "nghiêm ngặt nhất" — nếu bất kỳ license nào trong danh sách thuộc
  R3/deny → component đó bị flag R3 trừ khi tách được cách tích hợp riêng.
- **License đổi theo phiên bản**: một số thư viện đổi license giữa major version
  (vd MySQL, Redis, Elasticsearch). Luôn dùng license của **phiên bản cụ thể đang
  dùng**, không phải license mặc định của project.
- **Không SPDX**: các license lạ (vd "good luck with that", "BEER-WARE") → mặc
  định R4, flag cho research phase.

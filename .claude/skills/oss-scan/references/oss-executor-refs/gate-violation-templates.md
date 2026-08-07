# Mẫu Báo Cáo Vi Phạm

Template violation report cho từng loại vi phạm Denylist. Mỗi vi phạm FAIL/
BLOCKED phải có một report theo cấu trúc chuẩn để LRB xử lý nhất quán.

## Cấu Trúc Chung Violation Report

```markdown
# Vi Phạm License — [Tên component] [Version]

## Thông tin vi phạm
- **Mã hồ sơ:** TPC-XXXX-XXXX
- **Component:** [tên] [version]
- **Loại tài sản:** [1-10]
- **License phát hiện:** [SPDX ID / NOASSERTION]
- **Nhóm rủi ro:** R3/R4
- **Ngày phát hiện:** YYYY-MM-DD
- **Người phát hiện:** oss-gate-executor (tự động)

## Loại vi phạm
[Chọn một từ danh sách dưới]

## Chính sách bị vi phạm
> Trích dẫn điều khoản từ scan-license-policy.md / Quy định tối thiểu (mục 14)

## Vị trí sử dụng
- **Sản phẩm/hệ thống:** [...]
- **File/package:** [...]
- **Cách tích hợp:** [static_link | dynamic_link | ...]

## Phương án khắc phục (đề xuất)
[Theo gate-remediation-guide.md — liệt kê ít nhất 2 lựa chọn]

## Thông tin thêm (research)
- **Rủi ro kỹ thuật:** [từ oss-risk-research-executor nếu có]
- **Rủi ro pháp lý:** [nếu có legal case]

## Quyết định (do human/LRB)
- [ ] Duyệt exception (kèm lý do + điều kiện)
- [ ] Thay thế bằng [...]
- [ ] Isolate thành standalone service
- [ ] Chặn vĩnh viễn
- [ ] Xóa khỏi sản phẩm

Người quyết định: ______  Ngày: ______
```

## Các Loại Vi Phạm + Trích Dẫn Chính Sách

### 1. AGPL trong sản phẩm

> **Chính sách:** "AGPL-3.0 trong bất kỳ code nào link với sản phẩm/dịch vụ —
> nghĩa vụ công bố mã nguồn áp dụng cả khi chỉ cung cấp qua mạng (SaaS). Ngoại
> lệ duy nhất: chạy như dịch vụ độc lập hoàn toàn tách biệt, không sửa đổi, do
> LRB phê duyệt."

**Remediation mặc định:** thay bằng license permissive tương đương, HOẶC tách
thành microservice độc lập giao tiếp qua API (không link), HOẶC xin exception LRB.

### 2. SSPL / BUSL / Commons Clause

> **Chính sách:** "Hạn chế cung cấp như một dịch vụ; điều khoản mơ hồ, rủi ro cao."

**Remediation:** gần như luôn thay thế. Không có exception thông thường.

### 3. GPL link trực tiếp vào sản phẩm

> **Chính sách:** "GPL link trực tiếp (static/dynamic) vào sản phẩm phân phối —
> buộc công bố toàn bộ mã nguồn sản phẩm."

**Remediation:** tách sang standalone process (exec/network boundary) HOẶC thay
bằng bản commercial (nếu dual-license) HOẶC thay bằng thư viện permissive.

### 4. Non-commercial / research-only / evaluation-only

> **Chính sách:** "Tổ chức thương mại — mọi sử dụng đều là thương mại."

**Remediation:** loại bỏ hoàn toàn, hoặc mua license commercial nếu tồn tại.

### 5. Không có license (No license = No rights)

> **Chính sách:** "Một thư viện/ảnh/font không ghi license đồng nghĩa tác giả giữ
> toàn bộ quyền, không được phép sử dụng."

**Remediation:** chặn vĩnh viễn trừ khi xin được license từ tác giả (bằng văn
bản), hoặc thay bằng component có license rõ ràng.

### 6. JSON License / license đạo đức mơ hồ

> **Chính sách:** '"shall be used for Good, not Evil" — không đủ chắc chắn pháp lý.'

**Remediation:** thay thế; nếu bắt buộc dùng, xin ý kiến LRB bằng văn bản.

### 7. Tài sản từ nguồn không chính thức

> **Chính sách:** "Font/ảnh/template tải 'miễn phí' từ nguồn không chính thức
> (crack, chia sẻ lại) — vi phạm bản quyền trực tiếp."

**Remediation:** xóa ngay, thay bằng nguồn chính thức có license.

### 8. Code copy nguyên khối từ StackOverflow

> **Chính sách:** "Mặc định mang CC-BY-SA (copyleft). Chỉ dùng làm tham khảo,
> viết lại theo cách của mình."

**Remediation:** viết lại code theo phong cách riêng (không copy nguyên khối),
xác nhận không còn giữ lại cấu trúc đáng kể.

---

## Quy Tắc Sử Dụng Template

1. **Mỗi component vi phạm = 1 report riêng** — không gộp nhiều component
2. **Trích dẫn chính sách nguyên văn** — không paraphrase (legal evidence)
3. **Luôn đề xuất ≥2 phương án** — human có lựa chọn thực sự
4. **Không tự điền phần quyết định** — chỉ human/LRB điền
5. **Giữ audit trail** — report lưu trong `.work/oss-compliance/violations/`

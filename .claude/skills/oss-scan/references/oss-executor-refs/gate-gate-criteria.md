# Ma Trận Quyết Định Gate

Quy tắc PASS/FAIL/BLOCKED khi đối chiếu component với chính sách Allow/Restrict/
Deny (`scan-license-policy.md`). Input là báo cáo scan (`oss-scan-executor`) + tùy chọn báo cáo
research (`oss-risk-research-executor`).

## Quyết Định Theo Nhóm Rủi Ro

| Nhóm | Chính sách | Quyết định mặc định | Điều kiện PASS |
|------|-----------|--------------------|----------------|
| **R1** | ✅ Allowlist — auto-approve | **PASS** | Giữ notice/attribution trong bản phát hành |
| **R2** | ⚠️ Restricted — cho phép có điều kiện | **PASS_WITH_CONDITIONS** | Cách tích hợp đúng điều kiện (vd: dynamic linking) + không sửa đổi mã nguồn |
| **R3** | 🔶 Hạn chế — mặc định từ chối | **FAIL** (cần exception) | Chỉ duyệt ngoại lệ ở cấp LRB; chạy như standalone service tách biệt, không sửa đổi |
| **R4** | 🔶 Bắt buộc review từng trường hợp | **NEEDS_REVIEW** | Có hợp đồng/EULA rõ ràng + owner + điều kiện phê duyệt |

## Các Trạng Thái Quyết Định

| Trạng thái | Ý nghĩa | Hành động |
|-----------|---------|-----------|
| **PASS** | Component hợp lệ, không có vấn đề | Không cần action |
| **PASS_WITH_CONDITIONS** | Hợp lệ nếu đáp ứng điều kiện | Xác nhận điều kiện được đáp ứng, ghi vào record |
| **NEEDS_REVIEW** | Cần review con người (R4) | Escalate cho LRB/Mua sắm |
| **FAIL** | Vi phạm chính sách (R3/deny) | Tạo violation report, đề xuất remediation |
| **BLOCKED** | Chặn hoàn toàn — không thể dùng | Dừng pipeline, escalate lên leadership |

## Kết Quả Gate Tổng Hợp

| Điều kiện | Kết quả |
|-----------|---------|
| Tất cả component PASS | ✅ **PASS** — sẵn sàng |
| Có ≥1 PASS_WITH_CONDITIONS | ⚠️ **PASS_WITH_EXCEPTIONS** — xác nhận điều kiện |
| Có ≥1 NEEDS_REVIEW (R4) | 🔶 **NEEDS_REVIEW** — chuyển LRB |
| Có ≥1 FAIL (R3/deny) | ❌ **FAIL** — chặn, đề xuất remediation |
| Có component BLOCKED (unlicensed/no-license) | ⛔ **BLOCKED** — dừng pipeline ngay |

## Checklist Chi Tiết (Theo Trường)

### PASS (R1) — 4 check

1. License ∈ Allowlist (scan-license-policy.md)
2. SPDX ID hợp lệ (không NOASSERTION)
3. Notice/attribution yêu cầu được giữ
4. Không nằm trong Denylist

### PASS_WITH_CONDITIONS (R2) — 5 check

1. License ∈ Restricted list
2. Cách tích hợp đáp ứng điều kiện (dynamic link cho LGPL, không sửa file gốc
   cho MPL/EPL/CDDL)
3. Không sửa đổi mã nguồn (hoặc fork có kiểm soát + công bố)
4. Mobile app static link → flag "cần LRB review"
5. Commercial (font/SDK/AI) → có contract/EULA + hạn mức xác định

### NEEDS_REVIEW (R4) — check

1. License/EULA tồn tại và rõ ràng
2. Có hợp đồng (font thương mại, SDK, template Extended)
3. Hạn mức (seat/MAU/giao dịch) được ghi nhận
4. Điều khoản dữ liệu (đặc biệt dữ liệu KH gửi ra ngoài) được rà soát
5. AI model: quyền dùng thương mại + MAU cap + AUP use-case bị cấm xác nhận

### FAIL (R3/deny) — trigger

1. License ∈ Denylist (AGPL, SSPL, BUSL, Commons Clause, non-commercial)
2. GPL link vào sản phẩm (static/dynamic) — không phải standalone tool
3. CC-BY-SA code copy nguyên khối
4. "No license" / unidentifiable
5. Nguồn không chính thức (crack, reshare)

### BLOCKED — trigger

1. Component **không có license nào** (NOASSERTION + không tìm thấy LICENSE file)
2. Unlicensed + thuộc loại tài sản nhạy cảm (SDK payment, core library)

## Tương Tác Với oss-risk-research-executor

Nếu có báo cáo research kèm theo:

- **Component rủi ro Cao/Nghiêm trọng (score ≥6)** + thuộc R2 → nâng thành
  NEEDS_REVIEW dù license nói R2
- **Component rủi ro Nghiêm trọng (score ≥8)** → đề xuất replace/chặn bất kể
  license
- **Score `[ASSUMED]`** → không dùng làm căn cứ FAIL; chỉ flag cảnh báo
- **Không có research report** → gate vẫn chạy trên license-only (dữ liệu từ
  oss-scan-executor), nhưng ghi chú "chưa research CVE"

## Quy Trình Xử Lý FAIL/BLOCKED

```
FAIL/BLOCKED phát hiện
  → Tạo violation report (gate-violation-templates.md)
  → Đề xuất remediation (gate-remediation-guide.md)
  → Trình human: approve exception | thay thế | isolate | chặn vĩnh viễn
  → Không auto-approve exception
```

**Nguyên tắc:** gate executor này KHÔNG tự quyết định exception. Mọi FAIL/BLOCKED đều
trình human quyết định, trừ khi user config `--auto-pass-r1` (chỉ áp dụng cho R1).

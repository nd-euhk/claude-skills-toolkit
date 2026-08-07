# Thuật Toán Tính Điểm Rủi Ro

Định nghĩa cách tính điểm rủi ro tổng hợp cho mỗi component, dùng để xếp hạng
trong báo cáo research. Điểm được tính từ 4 yếu tố: CVE/vulnerability, license
risk, maintenance, và exploit availability.

## Công Thức

```
Điểm tổng (0–10) = CVSS_impact × 0.4
                 + License_risk × 0.3
                 + Maintenance_score × 0.2
                 + Exploit_availability × 0.1
```

Mỗi yếu tố được normalize về thang 0–10 trước khi nhân trọng số.

## Các Yếu Tố

### 1. CVSS impact (0–10) — trọng số 0.4

Từ CVE cao nhất của component.

| Điều kiện | Score |
|-----------|-------|
| Không có CVE nào được biết | 0 |
| CVSS v3 0.1–3.9 (Low) | 2 |
| CVSS v3 4.0–6.9 (Medium) | 5 |
| CVSS v3 7.0–8.9 (High) | 8 |
| CVSS v3 9.0–10.0 (Critical) | 10 |

**Nếu phiên bản đang dùng không bị ảnh hưởng** bởi CVE đó (đã fix ở version
cao hơn) → giảm 1 bậc. Nếu phiên bản đang dùng **bị ảnh hưởng trực tiếp** →
giữ nguyên score.

### 2. License risk (0–10) — trọng số 0.3

Từ `oss-scan-executor` nhóm rủi ro, theo bảng `scan-license-policy.md`:

| Nhóm | Score |
|------|-------|
| R1 (permissive) | 0 |
| R2 (weak copyleft/điều kiện) | 2 |
| R4 (commercial, EULA rõ ràng) | 3 |
| R4 (NOASSERTION / license không xác định) | 5 |
| R3 (strong copyleft — GPL/AGPL/SSPL) | 6 |
| R4 (unlicensed / "no license") | 8 |

### 3. Maintenance score (0–10) — trọng số 0.2

Đánh giá mức độ duy trì của project (stale/abandoned indicators):

| Điều kiện | Score |
|-----------|-------|
| Release trong 6 tháng qua | 0 |
| Release 6–12 tháng trước (stale) | 3 |
| Release 12–18 tháng trước | 5 |
| Không release >18 tháng (abandoned) | 6 |
| Deprecated/archived (README nói "no longer maintained") | 8 |
| Repo bị xóa / không tìm thấy | 10 |

### 4. Exploit availability (0–10) — trọng số 0.1

| Điều kiện | Score |
|-----------|-------|
| Không có exploit được biết | 0 |
| PoC tồn tại (GitHub PoC, ExploitDB) | 5 |
| Đang bị khai thác actively (ransomware, malware campaigns) | 10 |

## Phân Loại Mức Rủi Ro

| Điểm tổng | Mức | Hành động |
|-----------|-----|-----------|
| 0 – 2.9 | 🟢 Thấp | Chấp nhận, rà soát theo chu kỳ |
| 3 – 5.9 | 🟡 Trung bình | Cần đánh giá thêm, xem xét upgrade |
| 6 – 7.9 | 🟠 Cao | Ưu tiên xử lý — upgrade/giảm thiểu |
| 8 – 10 | 🔴 Nghiêm trọng | Chặn hoặc thay thế ngay — escalate lên oss-gate-executor |

## Ưu Tiên Research Theo Nhóm License

Không cần research sâu như nhau cho mọi component. Ưu tiên theo:

| Nhóm | Mức research | Lý do |
|------|-------------|-------|
| R1 | Nhẹ — chỉ CVE check nhanh | License không phải vấn đề; chỉ cần biết vulnerability |
| R2 | Trung bình — CVE + cách tích hợp | Cần xác nhận cách link (dynamic/static) có đúng điều kiện không |
| R3 | Sâu — CVE + legal cases + exception tiền lệ | Có thể bị chặn hoàn toàn; cần evidence cho quyết định |
| R4 | Sâu nhất — CVE + EULA terms + hạn mức + legal | Commercial deps có rủi ro hợp đồng, không chỉ kỹ thuật |

## Quy Tắc Khi Thiếu Dữ Liệu

- **Không có thông tin CVSS** → score 0 cho yếu tố CVSS, ghi chú "chưa research
  đủ" trong báo cáo
- **Không chắc maintenance** → ASSUMED active (score 0) nếu repo tồn tại và có
  recent commit; nếu không chắc chắn hoàn toàn → flag `[UNVERIFIED]`
- **CVE cũ không còn áp dụng** → tính theo phiên bản đang dùng, không phải version
  mới nhất
- **Không bao giờ tự suy đoán score** — mỗi score phải kèm nguồn (URL) hoặc flag
  `[ASSUMED]`

## Confidence Breakdown

Với mỗi component, ghi rõ:

```
Confidence: OBSERVED | DERIVED | ASSUMED
- OBSERVED: đọc được từ nguồn (NVD, GitHub advisory, license file)
- DERIVED: suy ra từ OBSERVED (vd: license R3 → score 6)
- ASSUMED: ước lượng khi thiếu dữ liệu — cần verify trước khi quyết định
```

Component có bất kỳ yếu tố nào ASSUMED → đánh dấu `[REQUIRES_VERIFICATION]` và
không được oss-gate-executor xử lý như finding đã xác nhận.

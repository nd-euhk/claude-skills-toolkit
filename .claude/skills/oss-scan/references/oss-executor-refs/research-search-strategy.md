# Chiến Lược Tìm Kiếm Rủi Ro

Protocol tìm kiếm web cho từng component. Mỗi component được research theo 4
trục: vulnerability, license risk, maintenance, và exploit availability.

## Template Truy Vấn

### Trục 1 — CVE / Vulnerability

```
"<tên thư viện>" "<version>" CVE vulnerability
"<tên thư viện>" "<version>" security advisory
"<tên thư viện>" vulnerabilities npm/maven/pypi (theo ecosystem)
```

Ví dụ:
```
"log4j" "2.14.1" CVE vulnerability
"lodash" "4.17.21" security advisory
"express" vulnerabilities npm
```

**Lưu ý:** luôn kèm version cụ thể. CVE thường khóa theo version range — không
kèm version sẽ cho kết quả sai.

### Trục 2 — License risk

```
"<tên thư viện>" license change history
"<SPDX-ID>" license commercial use restriction
"<tên thư viện>" "license" "legal" "risk"
```

Ví dụ:
```
"Elasticsearch" "SSPL" license change
"AGPL-3.0" commercial SaaS use restriction
"MongoDB" "SSPL" legal risk
```

**Khi nào cần:** license đổi giữa version (MySQL/Redis/Elasticsearch tiền lệ),
license hiếm gặp, hoặc nhóm rủi ro R3/R4.

### Trục 3 — Maintenance / health

```
"<tên thư viện>" last release abandoned unmaintained
"<tên thư viện>" deprecated archived
```

**Khi nào cần:** SBOM version cũ, không có release trong 6 tháng, hoặc repo
không tìm thấy.

### Trục 4 — Exploit availability

```
"<CVE-ID>" exploit poc
"<tên thư viện>" "<version>" exploit
```

**Khi nào cần:** sau khi tìm thấy CVE HIGH/CRITICAL — cần xác định có PoC/active
exploit không.

## Quy Trình Research Mỗi Component

```
1. Xác định nhóm rủi ro từ báo cáo scan (R1-R4)
2. Chọn trục research theo ưu tiên (research-risk-scoring.md)
   - R1: chỉ trục 1 (CVE) nhanh
   - R2: trục 1 + 2 (nếu license điều kiện)
   - R3: trục 1 + 2 + 4 (full)
   - R4: trục 1 + 2 + 3 + 4 (full + EULA terms)
3. Chạy WebSearch cho từng truy vấn
4. Ghi lại: URL nguồn, kết quả, ngày research
5. Tính score theo research-risk-scoring.md
```

## Batch & Rate Limit

- **Batch**: nhóm components thành lô 5
- **Delay**: 2 giây giữa các search call (tránh rate limit)
- **Cap**: `--max-components N` để giới hạn (mặc định: toàn bộ R3/R4 + top 5 R2,
  các R1 còn lại chỉ CVE check)
- **Timeout**: research agent tối đa 5 phút/component; quá hạn → dừng, ghi
  `[TIMEOUT]`, chuyển component tiếp theo

## Trích Xuất & Ghi Chép Kết Quả

Với mỗi component, ghi vào báo cáo:

```
### <tên> <version> (TPC-xxxx)

| Yếu tố | Score | Nguồn | Chi tiết |
|--------|-------|-------|----------|
| CVSS impact | 8 | [NVD CVE-2024-xxxx](url) | RCE qua unauthenticated... |
| License risk | 2 | oss-scan-executor (R2) | LGPL dynamic link OK |
| Maintenance | 0 | [GitHub releases](url) | v4.0.2 released 2026-06 |
| Exploit | 5 | [PoC](url) | Public PoC exists |
| **Tổng** | **4.1** | | 🟡 Trung bình |

Recommendation: [upgrade | monitor | replace | escalate]
```

## Quy Tắc Evidence

1. **Ưu tiên primary source**: NVD, OSV, GitHub Security Advisory, vendor
   security page > blog, forum, aggregator
2. **Mỗi score phải có URL nguồn** — không có nguồn = score `[ASSUMED]`
3. **Đọc errors literally**: ghi chính xác CVE ID, CVSS score, affected version
   range — không paraphrase
4. **Conflicting sources**: 2 nguồn mâu thuẫn → ưu tiên vendor chính thức; ghi
   chú cả hai trong báo cáo
5. **CVE cũ không áp dụng** cho phiên bản đang dùng → ghi "fixed in X, not
   affected" thay vì đánh số

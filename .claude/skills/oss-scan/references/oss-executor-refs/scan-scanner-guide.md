# Hướng Dẫn Scanner

Hướng dẫn vận hành các công cụ scan dependency/SBOM. Thứ tự ưu tiên:
**Syft > Trivy > build-tool parse** (fallback không cần cài đặt thêm).

## Kiểm Tra Công Cụ

Trước khi scan, kiểm tra tool nào có sẵn:

```bash
which syft        # ưu tiên 1
which trivy       # ưu tiên 2
```

Nếu không có tool nào → dùng **build-tool parse** (luôn hoạt động, không cần cài
đặt). Nếu user muốn scan kỹ hơn (container image), có thể hỏi xác nhận cài Syft.

## Syft (ưu tiên — license detection tốt nhất)

```bash
# Quét thư mục source
syft dir:. -o cyclonedx-json > sbom.json

# Quét image (loại 9 — container)
syft <image>:<tag> -o cyclonedx-json > sbom-image.json
```

Output CycloneDX JSON có cấu trúc:

```json
{
  "metadata": { "component": { "name": "...", "version": "..." } },
  "components": [
    {
      "bom-ref": "pkg:npm/lodash@4.17.21",
      "name": "lodash",
      "version": "4.17.21",
      "licenses": [ { "license": { "id": "MIT" } } ],
      "purl": "pkg:npm/lodash@4.17.21",
      "supplier": { "name": "..." }
    }
  ]
}
```

### Extract dữ liệu cần thiết từ SBOM JSON

Với mỗi component trong `components[]`:

| Field | Nguồn SBOM |
|-------|-----------|
| Tên | `name` |
| Phiên bản | `version` |
| License (SPDX ID) | `licenses[].license.id` (nếu là SPDX) hoặc `licenses[].license.name` |
| Nguồn tải | `purl` (parse registry từ prefix: `pkg:npm`, `pkg:maven`, `pkg:pypi`) |
| Checksum | `hashes[]` nếu có |
| Loại tài sản | infer từ purl prefix |

### Map purl prefix → loại tài sản

```
pkg:npm/*       → loại 1 (thư viện OSS, npm ecosystem)
pkg:maven/*     → loại 1 (Java)
pkg:pypi/*      → loại 1 (Python)
pkg:golang/*    → loại 1 (Go)
pkg:cargo/*     → loại 1 (Rust)
pkg:github/*    → loại 1/10 (repo trực tiếp — license bất định)
pkg:docker/*    → loại 9 (container)
```

## Trivy (dự phòng — mạnh về vulnerability hơn license)

```bash
# Quét filesystem
trivy fs . --format json > trivy-fs.json

# Quét image
trivy image <image>:<tag> --format json > trivy-image.json
```

Trivy output lồng theo layers. Nếu dùng Trivy cho SBOM, extract các component
từ `Results[].Packages[]` (cấu trúc tương tự CycloneDX). Trivy phù hợp hơn cho
vulnerability scan — nên được gọi trong `oss-risk-research-executor` khi cần CVEs.

## Build-tool Parse (fallback — luôn hoạt động)

Khi không có Syft/Trivy, parse trực tiếp các file dependency. Đây là cách đáng
tin cậy nhất cho license chuẩn xác vì đọc đúng file lock.

### Node.js (package.json + package-lock.json / yarn.lock / pnpm-lock.yaml)

```bash
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.dependencies||{},null,2))"
```

Lockfile có phiên bản chính xác; package.json có license. Merge hai nguồn.

### Java (pom.xml)

```bash
# Extract groupId:artifactId:version
grep -A3 '<dependency>' pom.xml | grep -E '<(groupId|artifactId|version)>' | sed 's/<[^>]*>//g' | tr '\n' ' ' | sed 's/  */ /g'
```

License từ `<licenses>` block trong pom (nếu có) hoặc phải tra cứu riêng.

### Java (build.gradle / build.gradle.kts)

```bash
grep -E "^(implementation|api|compileOnly|runtimeOnly|testImplementation)\s+" build.gradle
```

### Python (requirements.txt / pyproject.toml / poetry.lock)

```bash
grep -E "^[a-zA-Z0-9_\-]+[=!<>=~]=?[0-9]" requirements.txt
```

### Go (go.mod)

```bash
grep -E "^\s+[a-zA-Z0-9_\.\-/]+\s+v[0-9]" go.mod
```

### Container (Dockerfile + docker-compose.yml)

```bash
grep -E "^FROM " Dockerfile
grep -E "image:\s*" docker-compose.yml
```

---

## Tổng Hợp SBOM + Filesystem

Sau khi có SBOM và filesystem scan:

1. **Normalize license**: map các license không phải SPDX về dạng SPDX chuẩn.
   Dùng bảng trong `scan-license-policy.md`. Không nhận ra → NOASSERTION → R4.
2. **Map nhóm rủi ro**: từ scan-license-policy.md, lấy nhóm nghiêm ngặt nhất nếu
   multi-license.
3. **Dedup**: component trong cả SBOM và filesystem → merge, SBOM thắng.
4. **Điền 22 trường**: theo scan-component-record-schema.md.
5. **Chu kỳ rà soát**: theo nhóm rủi ro (R1:+24mo, R2:+12mo, R3/R4:+6mo).

## Xử Lý Lỗi Thường Gặp

| Vấn đề | Xử lý |
|--------|-------|
| Syft không có license cho component | Dùng `licenses[].license.name` (free text) → map; nếu vẫn không có → NOASSERTION/R4 |
| SBOM bị thiếu transitive deps | Dùng build-tool parse bổ sung; hoặc flag trong gap section |
| Container image quét quá chậm | Chỉ scan base image, không scan từng layer; ghi chú "nên chạy Trivy image scan riêng" |
| Không có file dependency nào | Report rỗng + hỏi user về commercial/manual deps |
| npm peer deps gây duplicate | Dedup theo `purl` (bom-ref), giữ bản mới nhất |

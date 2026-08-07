# 10 Loại Tài Sản & Detection Heuristic

Detection heuristic cho 10 loại tài sản từ `quan-ly-rui-ro-opensource.md` (mục
2.1). Mỗi loại có: cách phát hiện, confidence indicators, và điểm yếu đã biết.

Hai pha quét:

- **Pha 2 (SBOM)**: bắt loại 1, 2 (một phần), 6 (một phần), 7 (một phần)
- **Pha 3 (Filesystem)**: bắt loại 3, 4, 5, 8, 9, 10 (một phần)

---

## Bảng Tổng Hợp

| # | Loại tài sản | Cách phát hiện | Confidence | Điểm yếu |
|---|--------------|----------------|------------|----------|
| 1 | Thư viện mã nguồn mở | SBOM, lockfile (package.json, pom.xml, build.gradle, go.mod, requirements.txt) | Cao | Transitive deps có thể overwhelm — lọc theo direct default |
| 2 | SDK/API thương mại | SBOM license=NOASSERTION/proprietary; deps từ private registry | Trung bình | Nhiều SDK thương mại không vào SBOM — cần manual prompt |
| 3 | Font chữ | Glob `**/*.{ttf,otf,woff,woff2}` | Cao | Font nhúng trong binary/bundle khó detect |
| 4 | Icon, hình ảnh, video | Glob `**/*.{png,jpg,jpeg,svg,ico,gif,webp}` trong asset dirs | Trung bình | Ảnh stock không có file license kèm — cần manual |
| 5 | Template giao diện | Thư mục `/themes/`, `/templates/`, `/layouts/`; HTML template markers | Trung bình | Regular vs Extended License không thể tự phát hiện |
| 6 | Mô hình AI/LLM | Glob `**/*.{gguf,bin,pt,safetensors,onnx}`; deps transformers/llama-cpp | Trung bình | License model nằm trong README/HF card, không phải file LICENSE chuẩn |
| 7 | Dữ liệu mẫu/dataset | Glob `**/*.{csv,jsonl,parquet}` trong /data/, /datasets/, /fixtures/ | Thấp | Dataset license (ODbL, research-only) nằm trong metadata, hiếm khi có LICENSE file |
| 8 | Công cụ phát triển & build | CI configs (.github/workflows/, .gitlab-ci.yml); Docker Desktop refs; IDE configs | Thấp | "Free cho cá nhân/OSS" không detect được qua filesystem — cần manual |
| 9 | Container image, package hệ thống | Parse Dockerfile FROM; docker-compose.yml `image:`; Helm chart deps; rpm/deb | Cao | Một image chứa hàng trăm license con — cần gắn tag "base image" |
| 10 | Plugin, extension, code snippet | IDE extensions (.vscode/extensions.json); ESLint/Prettier plugins; CMS plugin dirs; SO links trong comments | Rất thấp | Code copy từ SO / AI-generated **không thể** detect qua filesystem |

---

## Chi Tiết Detection Theo Loại

### Loại 1 — Thư viện mã nguồn mở

**Nguồn:** SBOM output (Syft/Trivy) hoặc parse build tool files trực tiếp.

```
package.json        → dependencies + devDependencies
pom.xml             → <dependency> + <parent>
build.gradle(.kts)  → implementation/api/compileOnly/runtimeOnly
go.mod              → require blocks
requirements.txt    → package==version
```

**Confidence indicators:** có SPDX license hợp lệ, từ public registry
(Maven Central, npmjs, PyPI, crates.io, go proxy).

### Loại 2 — SDK/API thương mại

**Nguồn:** SBOM + manual prompt (SBOM không bắt được hầu hết SDK thương mại).

**Confidence indicators:**
- License = NOASSERTION hoặc "proprietary" trong SBOM
- Dependency từ private registry (URL chứa `artifactory`, `nexus` nội bộ, `@scope/` npm private)
- Tên chứa từ khóa: `sdk`, `api`, `payment`, `ekyc`, `firebase`
- File EULA/agreement nằm cạnh dependency

**Manual prompt bắt buộc:** SDK thương mại dùng trong dự án mà SBOM không thấy.
Hỏi user: tên SDK, nhà cung cấp, license/EULA, có hợp đồng không, hạn mức.

### Loại 3 — Font chữ

**Nguồn:** Glob.

```
find . -type f \( -name "*.ttf" -o -name "*.otf" -o -name "*.woff" -o -name "*.woff2" \)
```

**Confidence indicators:**
- File LICENSE/OFL.txt nằm cùng thư mục font
- Tên font khớp foundry nổi tiếng (Roboto, Inter, SF Pro, Google Fonts)
- Nếu font từ thư mục `node_modules/` → gắn với package npm (quét qua SBOM)

**Lưu ý:** license font tách theo kênh (web ≠ app ≠ in ấn). App embedding và
webfont là quyền mua riêng. Flag font phát hiện nhưng không rõ nguồn.

### Loại 4 — Icon, hình ảnh, video

**Nguồn:** Glob trong asset dirs (`/assets`, `/static`, `/public`, `/resources`,
`src/main/resources`).

**Confidence indicators:**
- File `LICENSE`/`credits.txt`/`attribution.txt` trong thư mục
- Sprite sheet từ Font Awesome/Flaticon/Iconify (biết qua naming convention)
- File tải từ stock site — không có license kèm → manual

### Loại 5 — Template giao diện

**Nguồn:** Thư mục + file markers.

```
templates/, themes/, layouts/, theme-*, wp-content/themes/
```

**Confidence indicators:**
- README nhắc "Regular License" / "Extended License"
- HTML có marker framework (AdminLTE, shadcn, Material Dashboard, v.v.)

**Lưu ý:** Regular License thường CẤM dùng trong sản phẩm thu phí người dùng cuối.
Mọi template phát hiện → flag manual review về loại license.

### Loại 6 — Mô hình AI/LLM

**Nguồn:** Glob + dependency analysis.

```
*.gguf, *.bin, *.pt, *.pth, *.safetensors, *.onnx
```

**Confidence indicators:**
- File LICENSE/README nói "Llama Community License", "OpenRAIL", "Apache-2.0 with
  use-case restriction"
- HuggingFace model card (`*.json` có `model_info` / `library_name: transformers`)
- Dependency vào `transformers`, `llama-cpp-python`, `torch`

**Lưu ý:** license model thường có: MAU cap, cấm use-case, nghĩa vụ ghi nguồn
"Built with...", quyền với output. Không thể tự detect được → luôn manual review.

### Loại 7 — Dữ liệu mẫu/dataset

**Nguồn:** Glob trong /data/, /datasets/, /testdata/, /fixtures/.

**Confidence indicators:**
- Metadata nói "CC-BY-SA", "ODbL", "research-only"
- Dataset nổi tiếng (khớp tên public dataset)

**Lưu ý:** nhiều dataset CẤM dùng thương mại; share-alike lan truyền với dữ liệu
phái sinh. Flag manual nếu dataset không rõ nguồn.

### Loại 8 — Công cụ phát triển & build

**Nguồn:** Config files.

```
.github/workflows/*, .gitlab-ci.yml, .docker/config.json, .vscode/, .idea/, Dockerfile
```

**Confidence indicators:**
- CI dùng action/image thương mại
- Nhắc "Docker Desktop", "requires license for commercial use"
- Plugin IDE trả phí

**Lưu ý:** license "free for OSS/individual" không detect được qua filesystem.
Manual prompt: hỏi user về công cụ build/thương mại đang dùng.

### Loại 9 — Container image, package hệ thống

**Nguồn:** Parse Dockerfile + compose.

```
FROM node:20-alpine         → base image: node:20-alpine
image: postgres:16          → docker-compose
```

**Confidence indicators:**
- `FROM` dòng đầu tiên = base image (flag riêng vì chứa hàng trăm license con)
- `apk add` / `apt-get install` / `yum install` trong Dockerfile = packages hệ thống
- Helm chart `Chart.yaml` dependencies

**Lưu ý:** một base image chứa cả OS → hàng trăm license con. Gắn tag
`container_base` và recommend quét image riêng bằng Trivy image scan. Image
"cá nhân" không rõ nguồn gốc → R4/unlicensed.

### Loại 10 — Plugin, extension, code snippet

**Nguồn:** Config + heuristic.

```
.vscode/extensions.json, .vscode/extensions/, .eslintrc (plugins), wp-content/plugins/
```

**Confidence indicators:**
- Plugin CMS (WordPress plugin phổ biến GPL)
- Extension IDE trả phí
- Comment trong code nhắc StackOverflow URL (→ code copy risk)

**Điểm yếu đã biết (FLAG rõ trong báo cáo):**
Code copy từ StackOverflow (CC-BY-SA) và code AI-generated **không thể** detect
qua filesystem. Skill phải:
1. Ghi chú gap này trong phần "Câu hỏi chưa giải quyết" của báo cáo
2. Recommend developer attestation (hỏi dev team trực tiếp)
3. Grep comment chứa `stackoverflow.com` để tìm dấu hiệu

---

## Quy Tắc Merge & Dedup

- Component xuất hiện trong cả SBOM và filesystem → merge, ưu tiên thông tin từ
  SBOM (license, version chuẩn hơn).
- Font/ảnh trong `node_modules/` → gắn package npm thay vì tạo record riêng.
- Base image (`FROM` dòng đầu) → record riêng với loại 9, không merge vào
  dependencies phụ.
- Nếu một file asset không có license đi kèm → license = "UNKNOWN" → R4.

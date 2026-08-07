# Project Detection — Phát Hiện Project Trong Folder

Quy tắc chi tiết để liệt kê các project con của một folder do human cung cấp.
Input của Phase 1 (SKILL.md). Mục tiêu: phát hiện đúng, không bỏ sót, không
trúng thư mục không phải project.

## Dấu Hiệu Nhận Diện Project

Một thư mục con được coi là **project** nếu có **≥1 dấu hiệu** sau:

| Ưu tiên | Dấu hiệu | Lệnh check | Ghi chú |
|---|---|---|---|
| 1 (mạnh nhất) | `.git/` | `test -d "$dir/.git"` | Mỗi git repo = 1 project. Có thể dùng `.git` file (worktree/submodule) |
| 2 | Dependency manifest | `ls pom.xml build.gradle build.gradle.kts package.json go.mod requirements.txt pyproject.toml Cargo.toml composer.json *.csproj` | Java / Node / Go / Python / Rust / PHP / .NET |
| 3 | CI config | `ls .gitlab-ci.yml .github/workflows Jenkinsfile .circleci` | Repo CI config thường đi kèm project |

**Không cần đủ 3 — chỉ cần 1 dấu hiệu** để đưa vào danh sách. Dấu hiệu càng
nhiều thì độ tin cậy càng cao, ưu tiên hiển thị trong bảng xác nhận.

## Loại Trừ Luôn Luôn

Bỏ qua các thư mục sau dù chúng có manifest:

- Thư mục ẩn (`.` prefix): `.git`, `.github`, `.work`, `.claude`, `.mvn`, `.venv`, `.idea`, `.vscode`
- Dependency/build dirs: `node_modules`, `target`, `build`, `dist`, `out`, `vendor`
- Environment: `.venv`, `venv`, `.tox`, `__pycache__`
- Các dir con của một Maven multi-module **khi đã có parent pom ở cấp trên**
  (xem "Multi-Module & Monorepo" dưới đây)

## Thuật Toán Phát Hiện

```
scanProjects(folder):
  for each entry in folder (depth 1, bỏ ẩn + exclusions):
    if isProjectDir(entry):          # ≥1 dấu hiệu
      projects += { name: entry.name, path: entry.path, signals: [...] }
    else:
      if hasNestedProject(entry):    # có project ở depth 2+
        projects += detectNested(entry)   # đệ quy sâu hơn
  return projects
```

- **Mặc định scan ở depth 1** — hầu hết project container đặt các repo ngang
  hàng. Nếu folder chứa folder (nested) mới đệ quy sâu hơn (tối đa depth 3).
- Ghi lại **signals** phát hiện được (vd `['.git', 'pom.xml']`) — dùng trong
  bảng xác nhận Phase 2 để human thấy lý do.

## Multi-Module & Monorepo

### Maven multi-module (Java)

`e-voucher-beans/` có `pom.xml` (parent) + `e-voucher-beans/`, `e-voucher-repository/`
(modules con). Khi đã có **parent pom ở cấp trên** → **chỉ tính cấp trên** là
project. Các module con là một phần của project, không phải project riêng.

Kiểm tra: `pom.xml` cấp trên có `<modules>` → bỏ qua các module con ở depth 1.

### Monorepo

Nếu không có dấu hiệu ở cấp trên nhưng có manifest ở depth 2 (vd
`apps/web/package.json`, `services/api/pom.xml`) → mỗi package/service là một
**project con**. Ghi rõ trong tên: `web`, `services/api`.

### Không có dấu hiệu nào

Thư mục không có `.git`/manifest/CI ở depth 1–3 → **không phải project** → báo
human, không thêm vào danh sách. Đừng ép.

## Output

```
[
  { name: "e-voucher-beans", path: "/abs/path/projects/e-voucher-beans", signals: [".git", "pom.xml"] },
  { name: "film-gateway-ocp", path: "/abs/path/projects/film-gateway-ocp", signals: [".git", "pom.xml", ".gitlab-ci.yml"] },
  ...
]
```

- Luôn dùng **absolute path** trong `path` — workflow agent (oss-scan-executor)
  cần path chính xác, không được "tự tìm"
- Nếu folder human cung cấp **chính là** một project (có `.git`) chứ không phải
  container → vẫn dispatch workflow với project đó (hoặc escalate lên orchestrator
  nếu human muốn tương tác từng bước)

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Folder rỗng / không có project nào | Báo human, kết thúc, không dispatch workflow |
| 1 project duy nhất | Dispatch workflow với 1 project đó (hoặc escalate orchestrator nếu human muốn tương tác từng bước) |
| Project bị exclude nhầm (không manifest vì source ngoài) | Human thêm qua "Other" trong Phase 2 |
| Duplicate path (nested + parent) | Ưu tiên cấp parent (multi-module rule) |
| Symbolic link tới project | Follow nếu target là dir, cảnh báo nếu loop |

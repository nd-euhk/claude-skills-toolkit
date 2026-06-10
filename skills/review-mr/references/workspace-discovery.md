# Workspace Discovery

Cách phát hiện tất cả các git repository trong workspace để review MRs.

## Discovery Steps

### Step 1: Current Repository

```bash
ROOT_REPO=$(git rev-parse --show-toplevel 2>/dev/null)
```

Nếu thành công → thêm vào danh sách candidate.
Nếu thất bại (không phải git repo) → bỏ qua, tiếp tục step 2.

### Step 2: Git Submodules

```bash
git submodule status 2>/dev/null
```

Output format: ` <commit-hash> <path> (<branch>)`

Mỗi submodule path là một candidate. Ghi nhận path để deduplicate sau này.

**Edge cases**:
- Submodule chưa được init (prefix `-`): vẫn liệt kê nhưng đánh dấu "not initialized"
- Submodule có thay đổi local (prefix `+`): cảnh báo user
- Không có submodule nào: bỏ qua

### Step 3: projects/ Directory (Gitignored)

Project sử dụng thư mục `projects/` (được gitignore) để chứa các sub-projects:

```bash
for d in projects/*/; do
  if [ -d "$d/.git" ]; then
    echo "$d"
  fi
done
```

**Edge cases**:
- `projects/` không tồn tại → bỏ qua
- Thư mục con không phải git repo → bỏ qua
- Symlink → resolve rồi check

### Step 4: Deduplicate

Submodule paths có thể trùng với `projects/` paths. Loại bỏ trùng lặp:

```
all_candidates = current_repo + submodules + projects_dirs
unique_candidates = deduplicate by resolved absolute path
```

### Step 5: Present to User

**N = số lượng unique repos**:

- **N == 0**: "Không tìm thấy git repository nào. Vui lòng cung cấp URL MR/PR trực tiếp."
- **N == 1**: Tự động chọn, hiển thị "Đang review MRs từ `<repo-name>`"
- **2 <= N <= 4**: Dùng `AskUserQuestion`:
  ```yaml
  question: "Chọn repository để review MRs:"
  options:
    - label: "current-project"
      description: "Repo chính: /home/user/projects/main-project"
    - label: "projects/backend"
      description: "Git repo trong projects/: /home/user/projects/main-project/projects/backend"
    - label: "submodules/shared-lib"
      description: "Git submodule: /home/user/projects/main-project/submodules/shared-lib"
  ```
- **N > 4**: Hiển thị numbered table:
  ```
  Chọn repository để review MRs:

  1. current-project          (repo chính)
  2. projects/backend         (gitignored)
  3. projects/frontend        (gitignored)
  4. projects/shared-lib      (gitignored)
  5. submodules/docs          (submodule)

  Nhập số (1-5):
  ```
  Chờ user nhập số qua text input.

## Platform Detection

Sau khi chọn repo, detect platform từ git remote:

```bash
git -C <repo-path> remote get-url origin
```

| URL pattern | Platform | CLI |
|-------------|----------|-----|
| `github.com` | GitHub | `gh` |
| `gitlab.com` hoặc `gitlab.*` | GitLab | `glab` |
| Khác / không xác định | Hỏi user | — |

Nếu không xác định được, dùng `AskUserQuestion`:
```yaml
question: "Không thể xác định platform từ remote. Bạn dùng platform nào?"
options:
  - label: "GitHub"
  - label: "GitLab"
```

## Multi-Repo Edge Cases

- **Submodule chưa fetch**: `git submodule update --init` trước khi list
- **projects/ không có quyền đọc**: Bỏ qua thư mục, không crash
- **Repo không có remote origin**: Vẫn liệt kê nhưng đánh dấu "no remote", không thể fetch MRs
- **Repo có cả GitHub và GitLab remotes**: Dùng origin, nếu origin không rõ thì hỏi user
- **Same repo xuất hiện nhiều lần**: Deduplicate bằng resolved path

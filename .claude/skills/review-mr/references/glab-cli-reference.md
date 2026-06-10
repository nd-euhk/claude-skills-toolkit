# GitLab CLI Reference for MR Review

Các lệnh `glab` CLI dùng trong skill `review-mr`.

## Authentication

Yêu cầu `glab` đã được cài đặt và xác thực:
```bash
glab auth status
```

## Fetch MR List

```bash
glab mr list \
  --repo <owner/repo> \
  --state opened \
  --output json
```

Output là JSON array. Parse các field:
- `iid` → MR number (internal ID — dùng cái này, không phải `id`)
- `title` → tiêu đề MR
- `source_branch` → source branch
- `target_branch` → target branch
- `updated_at` → thời gian cập nhật cuối
- `author.username` → tác giả
- `web_url` → link đến MR

## Fetch MR Diff

```bash
glab mr diff <number> --repo <owner/repo>
```

Output là unified diff format.

## Fetch MR Metadata

```bash
glab mr view <number> --repo <owner/repo> --output json
```

Parse các field:
- `title` → tiêu đề
- `author.username` → tác giả
- `source_branch` → source branch
- `target_branch` → target branch
- `changes_count` → số dòng thay đổi (dạng string như "+100 -50")
- `web_url` → link
- `created_at` → thời gian tạo
- `description` → mô tả MR

## Post MR Note (Comment)

```bash
glab mr note <number> --repo <owner/repo> --message "<markdown content>"
```

Mỗi finding được post thành 1 note riêng.

## Approve MR (optional — human decision)

```bash
glab mr approve <number> --repo <owner/repo>
```

**Cảnh báo**: Skill review-mr KHÔNG tự động approve. Đây là quyết định của human.

## Fetch MR Notes (existing)

```bash
glab mr note list <number> --repo <owner/repo> --output json
```

Có thể dùng để check xem review-mr đã comment trước đó chưa.

## Resolve Owner/Repo

Từ repo path, extract owner/repo:
```bash
git -C <repo-path> remote get-url origin
# https://gitlab.com/owner/repo.git → owner/repo
# git@gitlab.com:owner/repo.git     → owner/repo
```

## GitLab-Specific Considerations

- **Internal ID vs Global ID**: GitLab MR có 2 IDs — `iid` (internal, dùng trong project) và `id` (global). Dùng `iid` cho tất cả lệnh `glab mr`.
- **Self-hosted GitLab**: Nếu remote URL không phải `gitlab.com`, kiểm tra `glab` config để đảm bảo host đã được cấu hình.
- **MR Approval Rules**: Một số GitLab instance yêu cầu approval từ specific users/groups. Review-mr không xử lý auto-approve.

## Error Handling

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `glab auth` fails | Chưa login | Báo user chạy `glab auth login` |
| `glab mr list` empty | Không có MR mở | Báo "No open MRs found" |
| `glab mr diff` fails | MR không tồn tại | Báo "MR not found" |
| `glab mr note` fails | Không có quyền | Báo "Cannot comment on this MR" |
| Self-hosted URL | Không phải gitlab.com | Kiểm tra glab host config |

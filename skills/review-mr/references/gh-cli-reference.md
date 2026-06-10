# GitHub CLI Reference for MR Review

Các lệnh `gh` CLI dùng trong skill `review-mr`.

## Authentication

Yêu cầu `gh` đã được cài đặt và xác thực:
```bash
gh auth status
```

## Fetch PR List

```bash
gh pr list \
  --repo <owner/repo> \
  --state open \
  --json number,title,headRefName,baseRefName,updatedAt,author,url
```

Output là JSON array. Parse các field:
- `number` → MR number
- `title` → tiêu đề PR
- `headRefName` → source branch
- `baseRefName` → target branch
- `updatedAt` → thời gian cập nhật cuối
- `author.login` → tác giả
- `url` → link đến PR

## Fetch PR Diff

```bash
gh pr diff <number> --repo <owner/repo>
```

Output là unified diff format. Dùng trực tiếp làm input cho subagents.

**Options hữu ích**:
- `--color never` → tắt màu (dùng khi parse output)

## Fetch PR Metadata

```bash
gh pr view <number> --repo <owner/repo> \
  --json title,author,headRefName,baseRefName,additions,deletions,files,url,createdAt,body
```

Parse các field:
- `title` → tiêu đề
- `author.login` → tác giả
- `headRefName` → source branch
- `baseRefName` → target branch
- `additions` → số dòng thêm
- `deletions` → số dòng xóa
- `files` → số file thay đổi
- `url` → link
- `createdAt` → thời gian tạo
- `body` → mô tả PR

## Post PR Comment

```bash
gh pr comment <number> --repo <owner/repo> --body "<markdown content>"
```

Mỗi finding được post thành 1 comment riêng.

## Fetch PR Comments (existing)

```bash
gh pr view <number> --repo <owner/repo> --comments --json comments
```

Có thể dùng để check xem review-mr đã comment trước đó chưa.

## Resolve Owner/Repo

Từ repo path, extract owner/repo:
```bash
git -C <repo-path> remote get-url origin
# https://github.com/owner/repo.git → owner/repo
# git@github.com:owner/repo.git     → owner/repo
```

## Error Handling

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `gh auth` fails | Chưa login | Báo user chạy `gh auth login` |
| `gh pr list` empty | Không có PR mở | Báo "No open PRs found" |
| `gh pr diff` fails | PR không tồn tại | Báo "PR not found" |
| `gh pr comment` fails | Không có quyền | Báo "Cannot comment on this PR" |
| Rate limit | Quá nhiều requests | Đợi và thử lại |

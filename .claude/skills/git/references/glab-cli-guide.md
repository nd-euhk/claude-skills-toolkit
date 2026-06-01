# GitLab CLI Guide

> `glab` là CLI chính thức của GitLab. Trên GitLab, "Pull Request" được gọi là "Merge Request" (MR).

## Authentication
```bash
glab auth login        # Interactive login (chọn gitlab.com hoặc self-hosted)
glab auth status       # Check auth state
glab auth logout       # Logout

# Self-hosted GitLab
glab auth login --hostname gitlab.company.com
```

## Merge Requests

### Create MR
```bash
# Basic
glab mr create --target-branch main --source-branch feature-branch \
  --title "feat: add login" --description "Summary"

# Với HEREDOC description
glab mr create --target-branch main --title "feat(auth): add OAuth" \
  --description "$(cat <<'EOF'
## Summary
- Added OAuth2 provider support
- Implemented token refresh

## Test plan
- [ ] Unit tests pass
- [ ] Manual login test
EOF
)"

# Draft mode (WIP)
glab mr create --draft --title "WIP: new feature"

# Assign reviewers / assignees
glab mr create --reviewer user1,user2 --assignee user3

# Add labels
glab mr create --label "bug,priority::high"

# Auto-fill từ commit message
glab mr create --fill

# Remove source branch sau khi merge
glab mr create --remove-source-branch

# Squash khi merge
glab mr create --squash-before-merge
```

### View/Review MR
```bash
glab mr list                    # List MRs (mặc định state=opened)
glab mr list --all              # All states
glab mr view 123                # View MR details
glab mr view 123 --web          # Open in browser
glab mr checkout 123            # Checkout MR locally
glab mr diff 123                # View MR diff
glab mr status                  # MRs của bạn + reviews
```

### Approve & Merge MR
```bash
glab mr approve 123             # Approve MR
glab mr revoke 123              # Revoke approval

glab mr merge 123               # Default merge
glab mr merge 123 --squash      # Squash commits
glab mr merge 123 --rebase      # Rebase trước khi merge
glab mr merge 123 --when-pipeline-succeeds  # Auto-merge khi CI pass
glab mr merge 123 --remove-source-branch    # Xóa source branch
```

### MR Comments / Notes
```bash
glab mr note 123 --message "LGTM!"
glab mr todo 123                # Add MR vào todo list
```

### MR Updates
```bash
glab mr update 123 --title "New title"
glab mr update 123 --label "added-label" --unlabel "removed-label"
glab mr update 123 --ready       # Convert draft → ready
glab mr update 123 --draft       # Mark as draft
```

## Issues

```bash
glab issue list                 # List issues
glab issue view 42              # View issue
glab issue create --title "Bug" --description "Description"
glab issue create --title "Bug" --label "bug" --assignee @me

# Tạo branch từ issue
glab issue update 42 --label "in-progress"
git checkout -b "42-fix-login-bug"

# Close / Reopen
glab issue close 42
glab issue reopen 42

# Note (comment)
glab issue note 42 --message "Investigating"
```

## Repository

```bash
glab repo view                  # Current repo info
glab repo view owner/repo       # View specific repo
glab repo view --web            # Open in browser
glab repo clone owner/repo      # Clone
glab repo fork owner/repo       # Fork
glab repo create new-project    # Create new project
glab repo archive owner/repo    # Archive
```

## CI/CD Pipelines

```bash
glab ci list                    # List pipelines
glab ci view                    # View latest pipeline (current branch)
glab ci view <pipeline-id>      # View specific pipeline
glab ci status                  # Status của pipeline gần nhất
glab ci trace                   # Tail job logs
glab ci trace <job-id>          # Tail specific job
glab ci retry <pipeline-id>     # Retry failed pipeline
glab ci cancel <pipeline-id>    # Cancel running pipeline

# Run pipeline với variables
glab ci run --branch main --variables KEY1:value1,KEY2:value2

# Lint .gitlab-ci.yml
glab ci lint
glab ci lint .gitlab-ci.yml
```

## Releases

```bash
glab release list
glab release view v1.0.0
glab release create v1.0.0 --name "Release 1.0" --notes "Changelog..."
glab release upload v1.0.0 ./dist/*.tar.gz   # Upload artifacts
glab release delete v1.0.0
```

## Snippets

```bash
glab snippet list
glab snippet view 123
glab snippet create --title "Helper" --filename "helper.sh" \
  --description "Utility script" path/to/file.sh
```

## API Direct Access

```bash
glab api projects/:id/merge_requests/123/notes  # Direct API call
glab api -X POST projects/:id/issues -f title="Bug" -f description="Details"
glab api graphql -f query='{ currentUser { name } }'   # GraphQL
```

## JSON / Output Formatting

```bash
glab mr list --output json
glab mr view 123 --output json
glab issue list --output json | jq '.[].title'

# Custom format
glab mr list -F json -f number,title,author
```

## Common Patterns

### Create MR với auto-merge khi CI pass
```bash
glab mr create --fill --remove-source-branch && \
glab mr merge --when-pipeline-succeeds --squash
```

### Close all opened MRs của một label
```bash
glab mr list --label "stale" --output json | \
  jq -r '.[].iid' | xargs -I {} glab mr close {}
```

### Watch CI pipeline đến khi xong
```bash
glab ci view --wait
```

### Sync fork với upstream
```bash
glab repo sync
```

## Tips

- Trên GitLab, "branch" gọi là "branch", nhưng MR có khái niệm `source_branch` và `target_branch` (≠ `head`/`base` của GitHub).
- `glab` đọc config từ `~/.config/glab-cli/config.yml`.
- Nếu repo thuộc self-hosted instance, đặt `GITLAB_HOST` env var hoặc dùng `--host`.
- Scope token: cần `api` scope cho hầu hết operations; `read_api` chỉ đọc.
- Labels GitLab dùng cú pháp `scope::value` (vd `priority::high`) — khác với GitHub `priority:high`.

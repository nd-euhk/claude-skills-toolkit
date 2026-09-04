# Pull / Merge Request Workflow (PR/MR)

Canonical PR/MR creation cho skill `git` — operation `pr`. **Chủ duy nhất của PR/MR creation.**
Các skill khác (sdlc-cook, sdlc-cook-overnight, ...) KHI cần tạo PR/MR phải delegate qua
`pr` ở đây — KHÔNG tự chạy `gh`/`glab`/curl inline ở skill ngoài.

## Input (từ caller)

- `repo`: thư mục repo (mặc định CWD). Type 1 sub-repo → truyền đường dẫn sub-repo.
- `from`: source branch (mặc định branch hiện tại của repo).
- `--to target`: TARGET branch — nếu caller biết (vd cook chain → branch upstream FR, hoặc
  default của sub-repo) thì truyền. KHÔNG truyền → derive (Step 3).
- `--title` / `--body`: nếu caller cung cấp thì dùng (vd cook có body format riêng); nếu không
  thì generate theo convention (Step 5).

## Step 1: Sync + Remote Diff

PR/MR dựa trên remote branch — local diff chứa cả thay đổi chưa push. Luôn merge default (hoặc
base) vào trước khi tạo:

```bash
git -C "$REPO" fetch origin
git -C "$REPO" push -u origin HEAD 2>/dev/null || true
HEAD_BRANCH="$(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
```

**"Branch not on remote"** → push rồi retry. **"No upstream"** → `git push -u origin HEAD`.

## Step 2: Detect Host

```bash
REMOTE="$(git -C "$REPO" remote get-url origin)"
HOST="$(echo "$REMOTE" | sed -E 's#(https?://|git@|ssh://git@)##' | cut -d: -f1 | cut -d/ -f1)"
```

| Host | CLI / tier |
|------|-----------|
| `github.com`, GitHub Enterprise (GHE) | `gh` |
| `gitlab.com`, GitLab self-host/enterprise | `glab` nếu có; KHÔNG có `glab` → GitLab REST qua git-credential PAT (Step 4, `gitlab-rest-mr.md`) |
| Khác / không detect | Log URL tay (Step 4, fallback) |

**KHÔNG dùng `gh` cho GitLab** — `gh` chỉ github.com/GHE. `glab` không bắt buộc nếu có
credential PAT (xem `references/gitlab-rest-mr.md`).

## Step 3: Derive Target Branch (KHÔNG hardcode `origin/main`)

**Hardcode `main` là SAI** với repo release-branch workflow: `main` có thể stale (lùi N commits),
MR vào `main` sẽ kéo rác. Ladder — dùng bước đầu tiên khớp:

1. **Caller truyền `--to`** → dùng thẳng. (Cook biết: chain → branch upstream FR; Type 1 →
   default branch sub-repo. Đây là explicit, không phải default-main.)
2. **Đã có PR/MR đang mở cho CHÍNH source branch này** → tái dùng `target_branch` của nó
   (idempotent + bắt convention repo). Check: `gh pr list --head <from>` / `glab mr list
   --source <from>`; GitLab REST → GET merge_requests?source_branch=.
3. **Default = remote HEAD**:
   ```bash
   DEFAULT="$(git -C "$REPO" remote show origin | awk '/HEAD branch/ {print $NF}')"
   ```
4. **Guard ancestor:** default chỉ hợp lệ làm target nếu feature fork từ nó:
   ```bash
   if git -C "$REPO" merge-base --is-ancestor "origin/$DEFAULT" HEAD; then
     TARGET="$DEFAULT"        # feature fork từ default — target đúng
   else
     # default KHÔNG phải ancestor → feature fork từ line khác (release-branch workflow).
     # Target default = MR vào main kéo rác. PHẢI derive, không target mù.
   fi
   ```
   Khi guard FAIL, derive theo thứ tự:
   - (a) **MR-convention:** target của PR/MR đang mở gần nhất từ sibling feature branch (cùng
     prefix `feature/`, khác source hiện tại) → dùng target đó. Đây là cách bắt integration
     branch thật (vd repo open MRs đều target `releases/X.Y.Z`).
   - (b) **Branch gần nhất:** remote branch ≠ default ≠ source, có `git merge-base HEAD <cand>`
     mới nhất (fork point gần HEAD nhất) → target.
   - (c) Vẫn không xác định được → **KHÔNG tạo PR mù.** Log `PR-ready (target không xác định)`
     kèm candidates (default + các branch gần + lý do main sai) → human chọn. Unattended: không
     tự chốt target sai.

**Verify trước khi tạo:** diff `from...target` chỉ chứa commit của feature (`git log
origin/$TARGET...origin/$HEAD --oneline`). Nếu diff kéo hàng chục commit lạ → target sai, dừng.

## Step 4: Auth Guard + Create (theo host)

Auth guard TRƯỚC khi tạo. Fail → KHÔNG tạo, KHÔNG treo interactive (cook đêm không ai trả lời),
log `PR-ready (lý do)` → human tạo tay. Không để CLI treo chờ input.

- **GitHub/GHE → `gh`:** `gh auth status` pass → `gh pr create --base "$TARGET" --head "$HEAD"
  --title ... --body ...`.
- **GitLab + `glab`:** `glab auth status` pass →
  `glab mr create --source "$HEAD_BRANCH" --target-branch "$TARGET" --title ... --description ...`.
- **GitLab + KHÔNG `glab`:** → `references/gitlab-rest-mr.md` (tạo MR qua REST bằng PAT từ
  git-credential; guard `GET /api/v4/user`; 401 → log tay).
- **Repo host lạ / không có credential:** log URL tay.

## Step 5: Content

**Title:** nếu caller cung cấp → dùng. Không → conventional commit format, <72 chars, KHÔNG số
version.
**Body:** nếu caller cung cấp → dùng (vd cook body format: Summary + Changed Files + test plan).
Không → summary bullets + test plan checklist. Từng kết quả tạo thành công → trả về URL
(PR/MR `web_url`).

## DO NOT (local comparison)

- ❌ `git diff main...HEAD` — main có thể không phải base thật; dùng `origin/$TARGET`.
- ❌ `git diff --cached`, ❌ `git status` làm nguồn diff PR.

## Error Handling

| Error | Action |
|-------|--------|
| Branch not on remote | `git push -u origin HEAD`, retry |
| Empty diff | Warn: "No changes for PR" |
| Push rejected | `git pull --rebase`, resolve, push |
| No upstream | `git push -u origin HEAD` |
| Auth guard fail | Log `PR-ready (lý do)` — không treo, không retry mù |
| Target sai (diff kéo commit lạ) | Dừng, log candidates, không tạo |
| GitLab REST 401 (password thường, không PAT) | Log tay — không echo token |

# GitLab MR qua REST (không cần `glab`)

Path trong tier PR/MR của `workflow-pr.md` (Step 4): GitLab (gitlab.com / self-host) KHÔNG có
`glab`, nhưng git-credential store có PAT cho host → tạo MR qua GitLab REST API. Đã verify trên
GitLab self-host (git.vnpay.vn).

## Tiền đề

- `git config credential.helper=store` → `~/.git-credentials` chứa dòng
  `https://<user>:<PAT>@<host>` (password CHÍNH LÀ Personal Access Token).
- KHÔNG dùng `gh` cho GitLab (chỉ github.com/GHE).

## Quy tắc bảo mật (bất biến)

- Token CHỈ đọc trong-shell → biến env, KHÔNG bao giờ vào command args, log, report, hay file.
- KHÔNG echo `$TOKEN`. Báo lỗi bằng status code + thân response không kèm header.
- Nếu credential là plain password (không phải PAT) → `GET /api/v4/user` trả 401 → fallback log
  URL tay (như `workflow-pr.md` Step 4). KHÔNG retry mù.

## Recipe

### 1. Parse token từ git-credentials (in-shell)

```bash
# Lấy dòng khớp host từ ~/.git-credentials, strip scheme://, bỏ phần sau @, tách user:pass
CRED_LINE="$(grep -F "://" ~/.git-credentials | grep "@${GITLAB_HOST}" | head -1)"
# vd line: https://khuend:glpat-XXX@git.vnpay.vn
BODY="${CRED_LINE#*://}"                      # khuend:glpat-XXX@git.vnpay.vn
BODY="${BODY%@*}"                             # khuend:glpat-XXX
CRED_USER="${BODY%%:*}"
export CRED_TOKEN="${BODY#*:}"                # pass = PAT. env-var, không in ra.
```

Nếu `CRED_LINE` rỗng → không có credential → log tay, dừng.

### 2. Guard: token có phải PAT không (bắt buộc trước POST)

```bash
if curl -fsS -o /dev/null -H "PRIVATE-TOKEN: ${CRED_TOKEN}" \
    "https://${GITLAB_HOST}/api/v4/user"; then
  echo "PAT valid"
else
  echo "auth-fail (không phải PAT / hết hạn) → log PR-ready, tạo tay"
fi
```

200 → PAT hợp lệ. 401 → plain password không phải PAT → fallback tay.

### 3. Xác định target

Từ `workflow-pr.md` Step 3 — nhận `--to` từ caller; nếu không, derive (MR-convention:
GET merge_requests đang mở → `target_branch` của MR gần nhất cùng source-line). KHÔNG mặc định
`origin/main` nếu main không phải ancestor của HEAD.

### 4. URL-encode toàn bộ namespace path

GitLab REST cần project xác định bằng id HOẶC namespace path URL-encoded toàn bộ (các `/` trong
path thành `%2F`) — khỏi lookup project id:

```bash
# namespace path từ remote: vd https://git.vnpay.vn/dvtt/vnpay-ecos-02/hotel/hotel-v5/hotel-search-api
NS_PATH="$(echo "$REMOTE" | sed -E 's#(https?://[^/]+/|git@[^:]+:|ssh://git@[^:]+:)##' | sed 's#\.git$##')"
ENC_NS="$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1], safe=''))" "$NS_PATH")"
```

### 5. POST tạo MR

```bash
RESP="$(curl -fsS -X POST \
  -H "PRIVATE-TOKEN: ${CRED_TOKEN}" -H "Content-Type: application/json" \
  -d "{\"source_branch\":\"${FROM}\",\"target_branch\":\"${TARGET}\",\"title\":\"${TITLE}\",\"description\":$(python3 -c "import json,sys;print(json.dumps(sys.stdin.read()))" <<<"$BODY"),\"remove_source_branch\":true}" \
  "https://${GITLAB_HOST}/api/v4/projects/${ENC_NS}/merge_requests")"
# → iid + web_url
echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['web_url'])"
```

`source_branch` = branch feature (đã push). `remove_source_branch: true`. Thành công → trả về
`web_url` cho morning report. 4xx/5xx → đọc `message` trong response, KHÔNG kèm header.

## Self-host lưu ý

- Host `gitlab.congty.com` (không phải gitlab.com): domain dùng nguyên trong URL — không cần
  cấu hình `glab auth login`; credential store + PAT là đủ.
- Nếu repo là submodule/subproject (Type 1 cook): remote nằm trong thư mục sub-repo — parse
  `$REMOTE` từ `git -C "$REPO" remote get-url origin`.

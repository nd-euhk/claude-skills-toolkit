---
name: oss-scan
description: >-
  Quét tuân thủ license/OSS cho target path do human truyền vào (folder chứa
  nhiều project hoặc 1 project đơn lẻ), rồi chạy luồng oss compliance
  (scan → risk-research → gate, qua 3 executor subagents) qua Workflow cho từng
  project. Nhận path trực tiếp từ argument (--target <path> hoặc <folder-path>);
  chỉ AskUserQuestion chọn project nào khi không truyền path. Tự đánh giá
  step-selection theo kết quả scan từng project: skip research khi toàn bộ
  dependency R1, gate auto-pass, chạy full research + escalate cho R2/R3/R4.
  Output là batch report tổng hợp trong .work/oss-compliance/ (luôn ở
  .work/ của nơi invoke skill, không theo target path).
argument-hint: "[<folder-path>] [--target <path>] [--all | --select] [--step-select auto|full|skip-research|scan-only] [--output <path>]"
version: 1.0.0
user-invocable: true
when_to_use: "Invoke khi cần scan rủi ro license/OSS cho nhiều project cùng lúc trong một folder, chạy batch luồng oss compliance cho nhiều repo, hoặc kiểm kê dependency hàng loạt trước release."
category: compliance
keywords: [oss, batch, scan, compliance, license, multi-project, workflow, sbom, batch-scan]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(ls:*,find:*,grep:*,cat:*,mkdir:*,date:*)
  - Grep
  - Glob
  - AskUserQuestion
  - Workflow
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# OSS Scan — Quét Tuân Thủ License Hàng Loạt

Batch orchestrator cho luồng oss compliance. Nhận một **target path** do human
truyền vào — folder chứa nhiều project hoặc một project đơn lẻ. Nếu có path
(`--target <path>` hoặc positional) → scan thẳng, không hỏi lại. Nếu không có
path → AskUserQuestion hỏi human chọn project nào để scan. Sau đó dispatch một
**Workflow** (`./workflows/workflow-oss-scan.js`) để chạy luồng
`scan → risk-research → gate` cho từng project với **step-selection tự đánh giá**
từ kết quả scan. Pipeline chạy qua 3 **executor subagents** (`.claude/agents/oss/oss-*-executor.md`)
— agent xử lý trực tiếp, không invoke skill.

**Input:** target path (folder container hoặc project đơn lẻ) — argument hoặc hỏi
**Output:** per-project reports trong `.work/oss-compliance/` của từng project +
batch summary tại `.work/oss-compliance/OSS-BATCH-<timestamp>.md` (luôn
trong `.work/` của nơi invoke skill)

## Khi Nào Sử Dụng

- Scan rủi ro license/OSS cho **nhiều project cùng lúc** trong một folder
- Kiểm kê dependency hàng loạt trước release nhiều sản phẩm
- Cần quyết định compliance cross-project: project nào PASS, project nào cần
  LRB, project nào có vi phạm Denylist

**Không dùng cho:**
- Scan **một** project đơn lẻ → workflow vẫn chạy được với 1 project; nếu muốn
  xử lý tương tác từng bước → escalate lên orchestrator
- Tra cứu CVE/legal cho một component → chạy trực tiếp executor
  `oss-risk-research-executor` trên scan report của component đó
- Quyết định chặn/cho phép từng component → chạy trực tiếp executor
  `oss-gate-executor` trên scan report đó

## Khởi Động Nhanh

```bash
# Chỉ định thẳng target path cần xử lý — project đơn lẻ hoặc folder chứa nhiều project
/oss-scan --target /path/to/project-or-folder

# Truyền path dạng positional (tương đương --target)
/oss-scan /path/to/folder

# Không truyền path → skill hỏi human chọn project nào để scan
/oss-scan

# Quét mọi project trong folder, tự chọn step per project (không hỏi lại)
/oss-scan /path/to/folder

# Chọn subset project qua AskUserQuestion (kể cả khi đã truyền path)
/oss-scan /path/to/folder --select

# Scan hết, ép chạy full pipeline (scan + research + gate) cho mọi project
/oss-scan /path/to/folder --step-select full

# Scan + gate, bỏ research web (nhanh, license-only)
/oss-scan /path/to/folder --step-select skip-research

# Chỉ lập SBOM/kiểm kê, không research/gate
/oss-scan /path/to/folder --step-select scan-only

# Đổi nơi lưu batch report
/oss-scan /path/to/folder --output /tmp/oss-batch/
```

**Quy tắc path:**
- Có path (`--target` hoặc positional) → scan thẳng, không hỏi lại project nào
- Không có path → **hỏi human** chọn project cần scan trước khi làm gì khác

## Luồng Hoạt Động

### Phase 0 — Nhận target path

1. **Resolve target path** theo độ ưu tiên:
   1. `--target <path>` — option chỉ định thẳng target path để xử lý
   2. `<folder-path>` — positional, tương đương `--target`
   3. Không có path nào → **AskUserQuestion hỏi human chọn project nào để scan**:
      detect project từ cwd làm candidates (multiSelect), option "Other" cho phép
      gõ target path trực tiếp. Nếu chọn nhiều project từ cwd → list đã xác định;
      nếu gõ path qua "Other" → phân loại ở bước 3
2. **Verify target tồn tại** — `test -d` trước khi scan. Nếu không tồn tại →
   báo lỗi, hỏi lại
3. **Phân loại target** (quyết định đi đường nào):
   - Target là **project đơn lẻ** (bản thân nó có manifest/`.git`/CI) → không
     detect project con, dùng thẳng target làm project duy nhất
   - Target là **folder container** → qua Phase 1 phát hiện project con
   - Nếu human muốn tương tác từng bước cho project đơn → escalate lên
     orchestrator

### Phase 1 — Phát hiện project

Nếu target (Phase 0) **đã là project đơn lẻ** → bỏ qua bước này, ghi thẳng
`[{ name, path: target, signals: [...] }]`.

Nếu target là **folder container** → quét folder để liệt kê các project con.
Heuristic đầy đủ: đọc `references/project-detection.md`.

Tóm tắt: một thư mục con được coi là **project** nếu có ≥1 dấu hiệu:

- Có `.git/` → **dấu hiệu mạnh nhất** (mỗi repo = 1 project)
- Có dependency manifest: `pom.xml`, `build.gradle(.kts)`, `package.json`,
  `go.mod`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `*.csproj`
- Có CI config: `.gitlab-ci.yml`, `.github/workflows/`, `Jenkinsfile`

Loại trừ: thư mục ẩn, `node_modules`, `.work`, `.venv`, `target`, `build`.

**Ghi lại danh sách:** `[{ name, path, signals }]` — đây là input cho Phase 2.

### Phase 2 — AskUserQuestion xác nhận project (chỉ khi cần)

**Chỉ chạy bước này khi cần xác nhận**, không phải lúc nào cũng hỏi:

- Đã có path từ Phase 0 **và không dùng `--select`** → **bỏ qua bước này**, dùng
  toàn bộ project phát hiện được, scan thẳng (không hỏi human)
- Chưa có path (Phase 0 đã hỏi chọn project) → Phase 0 là bước xác nhận duy nhất,
  không hỏi lại
- Human dùng `--select` → chạy wizard bên dưới để chọn subset thủ công

Wizard (chỉ khi `--select`): **hỏi từng câu, chờ phản hồi, rồi hỏi tiếp. Không
gộp câu hỏi.**

1. **Câu 1** — phạm vi lựa chọn (header: "Projects"):
   - `Tất cả N project` (đề xuất)
   - `Chọn subset`
   - `Không project nào` → dừng, kết thúc
2. Nếu **Chọn subset** → hỏi **từng batch ≤3 project** (multiSelect) cho đến khi
   hết danh sách. Mỗi câu: "Chọn project từ batch này" (header: "Batch X/Y").
   Option "Other" cho phép human gõ thêm path ngoài danh sách phát hiện.
3. Với mỗi project được chọn, ghi rõ `{ name, path }`.

**Escape hatch:** human có thể bỏ qua phát hiện tự động và gõ path trực tiếp qua
"Other" — skill nhận diện và thêm vào danh sách.

### Phase 3 — Lập step-selection plan

Xác định mode xử lý tổng (từ `--step-select`, mặc định `auto`):

| `--step-select` | Scan | Research | Gate |
|---|---|---|---|
| `auto` (mặc định) | ✅ mọi project | ⚙️ quyết định theo kết quả scan | ⚙️ mode theo kết quả scan |
| `full` | ✅ | ✅ mọi project | ✅ full |
| `skip-research` | ✅ | ❌ skip hết | ✅ |
| `scan-only` | ✅ | ❌ | ❌ (đánh dấu PENDING) |

Step-selection chi tiết per-project (ma trận R1–R4): đọc
`references/step-selection.md`. Logic lõi:
- **Toàn R1** → skip research, gate `--auto-pass-r1`
- **Có R2** → research (CVE + cách tích hợp), gate conditional
- **Có R4** → research full (EULA, hạn mức), gate → NEEDS_REVIEW
- **Có R3 hoặc no-license** → research full (legal), gate → escalate LRB
- **Scan fail** → không research/gate, ghi nhận trong report

### Phase 4 — Dispatch workflow

Sinh timestamp và args, rồi dispatch **Workflow tool** trỏ đến script nằm trong
chính skill này:

```
Workflow({
  scriptPath: "<base-dir>/workflows/workflow-oss-scan.js",
  args: {
    projects: [{ name, path }],        // từ Phase 1 (detect) hoặc Phase 2 (chọn)
    stepSelect: 'auto',                 // từ Phase 3
    timestamp: 'YYYYMMDD-HHMMSS',       // do skill sinh (workflow cấm Date.now)
    outputDir: '.work/oss-compliance',  // luôn .work/ (cwd) — không theo target path
    skillBaseDir: '<base-dir>',         // thư mục skill — cho report agent đọc references/reporting.md
  }
})
```

`<base-dir>` = thư mục skill hiện tại (`.claude/skills/oss-scan/`).
`outputDir` luôn là `.work/oss-compliance` tương đối theo cwd (nơi invoke
skill) — batch report không bao giờ đặt theo target path.
Workflow tự xử lý: scan song song → research có điều kiện → gate → batch report.
Không gọi Workflow nếu danh sách project rỗng.

### Phase 5 — Monitor + báo cáo

1. Chờ workflow hoàn thành (notification). Không micro-manage.
2. **Đọc batch report** (`OSS-BATCH-*.md`) để lấy kết quả tổng hợp
3. **AskUserQuestion các decisions cần human** — workflow gom về
   `decisionsNeeded` (R3/R4/no-license, component FAIL/BLOCKED). Trình từng
   quyết định theo format trong `references/reporting.md`
4. Báo cáo outcome-first:

```
OSS Scan: [PASS | PASS_WITH_EXCEPTIONS | NEEDS_REVIEW | FAIL | BLOCKED]
Projects: N (PASS: x | CONDITION: y | REVIEW: z | FAIL: w | BLOCKED: v)
Batch report: .work/oss-compliance/OSS-BATCH-<ts>.md
Decisions needed: [component R3/R4/no-license cần LRB]
```

### Phase 5b — Gợi ý cross-skill (report-driven)

Gợi ý `sdlc-review-codechange` **chỉ xuất hiện khi workflow ghi nó vào batch report** —
workflow giữ toàn bộ data (`decisionsNeeded`), nó quyết định và viết gợi ý;
skill chỉ relay, không tự tính.

1. Sau khi đọc batch report (Phase 5), tìm trong phần **Next steps** dòng
   `Gợi ý: /sdlc-review-codechange --security <project-path>` — workflow chỉ ghi
   dòng này khi có component R3/R4/no-license hoặc FAIL/BLOCKED.
2. **Nếu có dòng gợi ý** → relay nguyên văn cho human trong báo cáo kết quả:
   ```
   Gợi ý: /sdlc-review-codechange --security <project-path>
   ```
   - **Lý do:** cần biết cách code đang link/dùng component rủi ro (dynamic/
     static link, có khai thác được trong code path không) — input bổ sung cho
     LRB khi quyết định exception/replace.
   - Chỉ relay, **không tự chạy** sdlc-review-codechange.
3. **Nếu batch report KHÔNG có dòng gợi ý** → không gợi ý (run toàn R1 PASS →
   không có component rủi ro để gợi ý).

## Xử Lý `[MANUAL]` Items

Scan executor bình thường xử lý các field không auto-fill được (SDK thương mại,
font trả phí, template marketplace, mục đích sử dụng...) bằng cách hỏi user
(AskUserQuestion). **Trong batch mode, workflow agent chạy scan KHÔNG được
prompt** (workflow cấm mid-run user input). Thay vào đó:

1. Scan agent flag mục đó là `[MANUAL]` trong report + liệt kê vào
   `manualItems` của SCAN_RESULT
2. Workflow gom `manualItems` từ mọi project vào `decisionsNeeded`
3. **Sau khi workflow xong**, skill (main session) hỏi human qua AskUserQuestion
   cho từng mục `[MANUAL]` còn thiếu, hoặc liệt kê trong batch report để
   Đầu mối License điền sau

## Báo Cáo Kết Quả

Batch report (`OSS-BATCH-<timestamp>.md`) gồm:

1. **Executive summary** — trạng thái tổng thể, số project pass/review/fail
2. **Bảng per-project** — project, component count, risk summary R1–R4, research
   đã chạy/skip + lý do, gate decision, path các report
3. **Decisions needed** — gom R3/R4/no-license items từ mọi project
4. **Violations** — component vi phạm Denylist (FAIL/BLOCKED)
5. **Next steps** — đề xuất: project nào release được, project nào cần khắc phục

Chi tiết template: `references/reporting.md`.

## Hard Boundaries

- **Workflow nằm trong skill** — `./workflows/workflow-oss-scan.js`.
  Skill gọi `Workflow({scriptPath})`, không copy script ra nơi khác
- **Không tự quyết định chặn/cho phép R3/R4** — skill chỉ tổng hợp và trình
  human/LRB. Quyết định cuối thuộc human (gate executor chỉ ghi `decisionsNeeded`
  và violation report, không auto-approve)
- **Không prompt trong workflow** — mọi AskUserQuestion diễn ra ở main session
  (Phase 2 và sau Phase 5), không bao giờ trong workflow agent
- **Executor xử lý trực tiếp, không invoke skill** — 3 bước pipeline chạy qua
  `.claude/agents/oss/oss-scan-executor|oss-risk-research-executor|oss-gate-executor`.
  Reference chi tiết để subagent đọc nằm tại
  `.claude/skills/oss-scan/references/oss-executor-refs/` (bản preserve của
  các ref gốc — skill gốc đã xóa)
- **Không sửa report của scan/research/gate executor** — input workflow là read-only
- **Batch report không đè per-project report** — mỗi project giữ `.work/` riêng

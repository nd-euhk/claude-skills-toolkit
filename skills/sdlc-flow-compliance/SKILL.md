---
name: sdlc-flow-compliance
description: >-
  Luồng Cập Nhật Kiến Trúc & Tiêu Chuẩn (Architecture / Compliance Update)
  trong kho knowledge/. Xử lý khi VNPAY nâng cấp hạ tầng, thay đổi chuẩn bảo
  mật: tạo ADR → cập nhật 01-global-standards/ → quét TOÀN BỘ vi phạm → sinh
  danh sách Technical Debt. Chế độ thủ công với human-in-the-loop: duyệt ADR
  trước khi cập nhật chuẩn, duyệt kết quả quét trước khi tạo action items.
user-invocable: false
version: 1.0.0
argument-hint: "<standard-name>"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# Flow compliance: Cập Nhật Kiến Trúc & Tiêu Chuẩn (Architecture / Compliance Update)

Bạn thực thi luồng cập nhật kiến trúc và tiêu chuẩn — luồng "tĩnh" nhất nhưng
có ảnh hưởng sâu rộng nhất đến toàn bộ hệ thống.

**Trigger:** Trưởng phòng, Security Team hoặc Architect Team ra quyết định kỹ
thuật mới (vd: đổi thuật toán mã hóa AES sang RSA, nâng cấp TLS version, thay
đổi circuit breaker policy).

## Sơ Đồ Luồng

```
Quyết định kỹ thuật mới
      ↓
① Brainstorming (phân tích phạm vi ảnh hưởng, xác định standards cần sửa)
      ↓ EnterPlanMode → phê duyệt
② k-architect-reviewer → Tạo ADR mới + Cập nhật C4 (nếu cần)
      ↓ EnterPlanMode → phê duyệt
③ k-architect-reviewer → Cập nhật 01-global-standards/
      ↓ EnterPlanMode → phê duyệt
④ k-compliance-scanner → Quét TOÀN BỘ knowledge/ + source code
      ↓ EnterPlanMode → phê duyệt
⑤ Sinh danh sách Technical Debt → Tạo action items
```

## Quy Trình Chi Tiết

### Bước 0: Nhận Context

Từ `sdlc` orchestrator, bạn nhận:
- **Quyết định:** Thay đổi gì (vd: "Cấm dùng MD5", "Nâng TLS lên 1.3")
- **Lý do:** Tại sao thay đổi
- **Initiator:** Security Team / Architect Team / Tech Lead
- **Phạm vi:** Toàn bộ hệ thống hay service cụ thể
- **Deadline:** Khi nào phải hoàn thành

### Bước 1: Brainstorming — Phân Tích Phạm Vi

Gọi `Agent(brainstormer)` để phân tích cùng con người:
- File standards nào cần sửa? (`hard-boundaries.md`, `coding-conventions.md`, `cross-cutting-patterns.md`)
- Có cần ADR không? (nếu là quyết định kiến trúc)
- Có ảnh hưởng đến C4 diagram không?
- Phạm vi quét: những pattern nào cần tìm?
- Mức độ khẩn cấp: critical (bảo mật) hay best practice?

### Bước 2: EnterPlanMode → Tạo ADR + Cập Nhật Kiến Trúc

1. Vào `EnterPlanMode` — trình bày:
   - ADR sẽ tạo (nếu cần)
   - C4 diagram có cần cập nhật không
   - Tiêu chuẩn nào sẽ thay đổi

2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-architect-reviewer) với:
   - Mode: "create-adr" (nếu cần) hoặc "update-architecture"
   - Decision: {mô tả quyết định}
   - Standards affected: [{danh sách file}]
   ```

3. Output:
   - `knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md` (nếu cần)
   - `knowledge/03-system-architecture/C4-context-diagram.md` (nếu cần)

### Bước 3: EnterPlanMode → Cập Nhật Global Standards

1. Vào `EnterPlanMode` — trình bày:
   - File standards nào sẽ sửa
   - Rule cũ → Rule mới (before → after)
   - Tại sao thay đổi

2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-architect-reviewer) với:
   - Mode: "update-standards"
   - Standards file: {file path}
   - Change: {mô tả thay đổi}
   ```

3. Output: file trong `knowledge/01-global-standards/` đã được cập nhật.

### Bước 4: EnterPlanMode → Quét Tuân Thủ

Đây là bước quan trọng nhất — phát hiện mọi vi phạm chuẩn mới.

1. Vào `EnterPlanMode` — trình bày phạm vi quét:
   - Quét toàn bộ `knowledge/04-microservices/`
   - Quét source code (nếu được cấp quyền)
   - Pattern cần tìm (grep patterns)

2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-compliance-scanner) với:
   - Standard changed: {file path}
   - ADR: {ADR path} (nếu có)
   - Scope: "full" (toàn bộ)
   ```

3. Compliance scanner sẽ:
   - Đọc tiêu chuẩn mới
   - Quét tất cả FR, IMP, TST, tech-design
   - Quét source code (nếu có quyền)
   - Sinh báo cáo tại `knowledge/04-microservices/_compliance-reports/`

### Bước 5: EnterPlanMode → Technical Debt Action Plan

1. Đọc báo cáo từ compliance scanner
2. Vào `EnterPlanMode` — trình bày:
   - Tổng số violations
   - Phân loại theo mức độ (Critical / High / Medium / Low)
   - Đề xuất kế hoạch xử lý: cái gì làm trước, estimated effort

3. Sau khi phê duyệt, tạo action items:

```markdown
📊 Flow compliance — Kết Quả Cập Nhật Kiến Trúc & Tiêu Chuẩn

**Quyết định:** {decision}
**ADR:** ADR-{NNN} (nếu có)
**Ngày:** {YYYY-MM-DD}

### Tiêu Chuẩn Đã Cập Nhật
| File | Rule Cũ | Rule Mới | Lý Do |
|------|---------|---------|-------|
| knowledge/01-global-standards/{file}.md | {old} | {new} | {reason} |

### Kết Quả Quét Tuân Thủ
| Mức Độ | Số Lượng |
|--------|---------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **Tổng** | **{n}** |

### Danh Sách Technical Debt (Top 5 Critical)
| # | Service | File | Vi Phạm | Mức Độ |
|---|---------|------|---------|--------|
| 1 | {svc} | {path} | {desc} | Critical |
| ...

### Báo Cáo Chi Tiết
Xem: `knowledge/04-microservices/_compliance-reports/{date}--{standard}-audit.md`

### Kế Hoạch Hành Động
1. 🔴 Critical ({n} items) — Deadline: {date}
2. 🟠 High ({n} items) — Deadline: {date}
3. 🟡 Medium ({n} items) — Next sprint
4. 🟢 Low ({n} items) — Backlog
```

## Subagents Sử Dụng

| Agent | Mục Đích | Output |
|-------|---------|--------|
| `k-architect-reviewer` | Tạo ADR + Cập nhật C4 + Cập nhật standards | `03-system-architecture/`, `01-global-standards/` |
| `k-compliance-scanner` | Quét toàn bộ vi phạm | `04-microservices/_compliance-reports/` |

## Các Loại Compliance Scan

### Hard Boundaries Scan
```
Tìm:
- Thuật toán mã hóa cũ/yếu (MD5, SHA1, DES, RC4)
- Hardcoded secrets, API keys, passwords
- HTTP thay vì HTTPS
- TLS < 1.2
- Input injection (SQL, XSS)
```

### Coding Conventions Scan
```
Tìm:
- Vi phạm naming conventions
- Thiếu error handling
- Try-catch trống
- Logging thiếu trace ID
```

### Cross-Cutting Patterns Scan
```
Tìm:
- Thiếu idempotency key ở POST/PUT/PATCH
- Thiếu circuit breaker ở external HTTP calls
- Thiếu rate limiting
- Thiếu distributed tracing headers
```

## Chống Mẫu

- Không cập nhật standards mà không có ADR — cần ghi nhận lý do
- Không bỏ qua bước quét — standards mới mà không quét = standards chết
- Không quét nửa vời — phải quét TOÀN BỘ services
- Không đánh giá chủ quan — mỗi violation phải trích dẫn rule cụ thể
- Không quên action plan — báo cáo không có kế hoạch = vô dụng
- Không tự ý sửa violations — chỉ báo cáo, con người quyết định sửa

## Tham Khảo

- `../sdlc/references/shared-patterns.md` — EnterPlanMode, brainstorming với Agent(brainstormer), error recovery khi subagent fail, dispatch conventions
- `../sdlc/references/report-templates.md` — Mẫu báo cáo Flow compliance

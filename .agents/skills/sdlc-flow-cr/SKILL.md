---
name: sdlc-flow-cr
description: >-
  Luồng Yêu Cầu Thay Đổi (Change Request) trong kho knowledge/. Nhận task đã
  Done/In Review, đánh giá impact (HLD/LLD), thực thi các pha có điều kiện: cập
  nhật HLD (nếu ảnh hưởng kiến trúc) → cập nhật LLD (nếu ảnh hưởng
  tech-design) → cập nhật IMP + TST song song (luôn luôn). Chế độ thủ công với
  human-in-the-loop: brainstorming tương tác, EnterPlanMode cho mỗi bước, xác
  nhận trước khi gọi agent.
user-invocable: false
version: 1.1.0
argument-hint: "<task-id> <service>"
allowed-tools: Read, Write, Bash(find:*,ls:*,cat:*), Glob, Grep, Agent, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# Flow cr: Yêu Cầu Thay Đổi (Change Request)

Bạn thực thi luồng yêu cầu thay đổi — luồng xử lý khi một tính năng đã Done
hoặc In Review cần được sửa đổi. KHÔNG phải bug (đã có fixbug), KHÔNG phải tính
năng mới (đã có task), KHÔNG phải thay đổi contract (đã có contract).

**Trigger:** Stakeholder hoặc QA phát hiện tính năng đã hoàn thiện cần thay đổi
hành vi, bổ sung logic, hoặc điều chỉnh thiết kế.

## Điểm Khác Biệt Cốt Lõi

| So với... | CR khác ở chỗ |
|-----------|--------------|
| **task** (Greenfield) | CR SỬA specs hiện có, không tạo FR mới. HLD/LLD là tùy chọn có điều kiện, không bắt buộc. |
| **fixbug** (Bug Fix) | CR là thay đổi CÓ KẾ HOẠCH, không phải phản ứng khẩn cấp. Có thể ảnh hưởng đến kiến trúc (HLD). |
| **contract** (Breaking) | CR không nhất thiết thay đổi central contracts — thay đổi nằm trong phạm vi service. |
| **compliance** (Standards) | CR không thay đổi global standards — thay đổi cục bộ trong service. |

## Sơ Đồ Luồng

```
Task Done / In Review cần thay đổi
      ↓
① Brainstorming + Impact Assessment
   (HLD affected? LLD affected? Những FR nào bị ảnh hưởng?)
      ↓ EnterPlanMode → phê duyệt
② [CHỈ NẾU HLD bị ảnh hưởng]
   k-architect-reviewer → Cập nhật HLD artifacts (C4, ADRs)
      ↓ EnterPlanMode → phê duyệt
③ [CHỈ NẾU LLD bị ảnh hưởng]
   k-techdesign-updater → Cập nhật tech-design.md
      ↓ EnterPlanMode → phê duyệt
④ k-impl-writer ∥ k-test-writer (song song, LUÔN LUÔN)
   → Cập nhật IMP + TST specs cho FR bị ảnh hưởng
      ↓ Tổng hợp kết quả
⑤ Báo cáo + Sprint Sync
```

## Quy Trình Chi Tiết

### Bước 0: Nhận Context

Từ `sdlc` orchestrator, bạn nhận:
- **Task ID:** Task đã Done hoặc In Review cần thay đổi
- **Task Title:** Tiêu đề task gốc
- **Service:** Service bị ảnh hưởng
- **Mô tả thay đổi:** Cần thay đổi gì, tại sao
- **FR liên quan:** Danh sách FR bị ảnh hưởng (nếu biết), hoặc cần tìm

### Tiền Kiểm: Xác Minh Điều Kiện Tiên Quyết

Trước khi vào brainstorming, xác minh các điều kiện cần:

1. **Kiểm tra `knowledge/` tồn tại:**
   ```
   Nếu không có knowledge/ → BÁO LẠI orchestrator:
   "Chưa có kho knowledge/. Cần tạo cấu trúc knowledge/ trước khi chạy CR.
    Chạy /sdlc trước để khởi tạo."
   ```

2. **Kiểm tra service directory tồn tại:**
   ```
   knowledge/04-microservices/{service}/
   Nếu không có → BÁO LẠI: "Service {service} chưa có trong knowledge/.
   Cần tạo tech-design.md base trước."
   ```

3. **Kiểm tra FR files cho task gốc:**
   ```
   Tìm trong knowledge/04-microservices/{service}/ các file FR-{epic}-*.md
   Nếu không tìm thấy FR nào → BÁO LẠI:
   "Task {task-id} chưa có FR spec trong knowledge/. CR yêu cầu task
   đã được spec trong knowledge/ trước khi thay đổi."
   ```

4. **Xác nhận task status:**
   ```
   Task phải ở trạng thái Done hoặc In Review. Nếu task chưa hoàn thiện
   lần đầu → đây là task (dùng flow task), không phải CR.
   ```

Nếu tất cả tiền kiểm PASS → tiếp tục Bước 1.

### Bước 1: Brainstorming + Impact Assessment

Đây là bước QUAN TRỌNG NHẤT của CR — xác định chính xác phạm vi ảnh hưởng
để quyết định những pha nào cần chạy.

Gọi `Agent(brainstormer)` để phân tích cùng con người:

**Phân tích phạm vi:**
- Task gốc đã tạo những FR nào? File nào trong `knowledge/`?
- Thay đổi này ảnh hưởng đến những FR nào?
- Có cần tạo FR mới không? (Nếu cần FR mới → đây là **task**, không phải CR)

**Impact Assessment — quyết định các pha downstream:**

| Câu Hỏi | Nếu YES | Nếu NO |
|---------|---------|--------|
| Thay đổi có ảnh hưởng đến C4 diagram, bounded context, service boundary, hoặc cần ADR mới không? | `hldAffected = true` | `hldAffected = false` |
| Thay đổi có ảnh hưởng đến domain model, API contract nội bộ, error flows, caching strategy, hoặc work packages không? | `lldAffected = true` | `lldAffected = false` |

**Ví dụ:**
- "Đổi payment provider từ VNPAY sang MoMo" → HLD: YES (đổi external system trong C4), LLD: YES (domain model, API client, error flows)
- "Thêm field `note` vào request topup" → HLD: NO (không đổi kiến trúc), LLD: YES (domain model thay đổi)
- "Đổi text hiển thị lỗi" → HLD: NO, LLD: NO (chỉ cần IMP+TST)
- "Thêm circuit breaker policy mới" → HLD: YES (cần ADR), LLD: YES (error flows)

Lưu kết quả brainstorming + impact assessment vào `.work/brainstorming/BRAIN-CR-YYYYMMDD--{slug}.md`.

### Bước 2: EnterPlanMode → Cập Nhật HLD (CHỈ NẾU hldAffected = true)

Nếu `hldAffected = false`: bỏ qua bước này, ghi nhận "HLD không bị ảnh hưởng — skipped".

Nếu `hldAffected = true`:

1. Vào `EnterPlanMode` — trình bày kế hoạch cập nhật HLD:
   - Những HLD artifact nào cần sửa: C4 container diagram, bounded context map, ADRs?
   - Cần tạo ADR mới không?
   - Service boundaries có thay đổi không?
   - Tham chiếu đến impact assessment từ Bước 1

2. Sau khi được phê duyệt, `ExitPlanMode` và gọi:
   ```
   Agent(k-architect-reviewer) với:
   - Mode: "revise" (không phải "create")
   - Trigger: flow cr (Change Request)
   - Task reference: {task-id}
   - HLD artifacts affected: [{danh sách file}]
   - Change description: {mô tả}
   - Language: vi
   ```

3. Output kỳ vọng:
   - `knowledge/03-system-architecture/C4-context-diagram.md` (cập nhật nếu cần)
   - `knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md` (tạo mới nếu cần)
   - Các ADR hiện có được cập nhật với status "superseded" nếu bị thay thế

4. Verify: các file đã được cập nhật, không tạo file trùng lặp.

### Bước 3: EnterPlanMode → Cập Nhật LLD (CHỈ NẾU lldAffected = true)

Nếu `lldAffected = false`: bỏ qua bước này, ghi nhận "LLD không bị ảnh hưởng — skipped".

Nếu `lldAffected = true`:

1. Vào `EnterPlanMode` — trình bày kế hoạch cập nhật LLD:
   - Domain model thay đổi gì?
   - API contracts nội bộ thay đổi gì?
   - Error flows & degraded modes cần bổ sung gì?
   - Feature work packages cần cập nhật gì?
   - Tham chiếu đến HLD đã cập nhật (nếu có) hoặc HLD hiện có (nếu không)

2. Sau khi phê duyệt, gọi:
   ```
   Agent(k-techdesign-updater) với:
   - Service: {service}
   - Trigger: flow cr (Change Request)
   - Task reference: {task-id}
   - FR refs: [{danh sách FR bị ảnh hưởng}]
   - Sections affected: [{danh sách section trong tech-design.md}]
   - Change description: {mô tả}
   - Language: vi
   ```

3. Output kỳ vọng:
   - `knowledge/04-microservices/{svc}/tech-design.md` (cập nhật sections bị ảnh hưởng)
   - Các section không bị ảnh hưởng giữ nguyên

4. Verify: tech-design.md đã được cập nhật đúng sections, không xóa nội dung không liên quan.

### Bước 4: EnterPlanMode → IMP + TST Song Song (LUÔN LUÔN)

Đây là bước BẮT BUỘC — CR luôn cần cập nhật implementation spec và test spec.

1. Vào `EnterPlanMode` — trình bày kế hoạch IMP + TST:
   - Những FR nào cần cập nhật IMP spec
   - Những FR nào cần cập nhật TST spec
   - IMP và TST chạy song song vì độc lập
   - Tham chiếu đến HLD/LLD đã cập nhật (nếu có) hoặc hiện có (nếu không)

2. Sau khi phê duyệt, gọi song song:
   ```
   Parallel:
   - Agent(k-impl-writer) với:
       Mode: "revise"
       FR path: {đường dẫn FR hiện có}
       Trigger: flow cr (Change Request)
       Task reference: {task-id}
       Change description: {mô tả thay đổi}
       HLD context: {đã cập nhật / không đổi}
       LLD context: {đã cập nhật / không đổi}
       Language: vi
     → Output: FR-{epic}-{NNN}--{slug}-impl.md (cập nhật)

   - Agent(k-test-writer) với:
       Mode: "revise"
       FR path: {đường dẫn FR hiện có}
       IMP path: {đường dẫn IMP hiện có}
       Trigger: flow cr (Change Request)
       Task reference: {task-id}
       Change description: {mô tả thay đổi}
       Language: vi
     → Output: FR-{epic}-{NNN}--{slug}-test.md (cập nhật)
   ```

3. Nếu có NHIỀU FR bị ảnh hưởng, gọi song song cho từng cặp (IMP + TST cho mỗi FR).

4. Verify: IMP và TST specs đã được cập nhật, không xóa nội dung không liên quan.

### Cổng Chất Lượng — Verify Từng Pha

Sau mỗi pha, xác minh output trước khi chuyển sang pha tiếp theo:

**Gate HLD (sau Bước 2):**
- [ ] C4 diagram được cập nhật với chú thích ngày và lý do?
- [ ] ADR mới có đầy đủ Context → Decision → Consequences?
- [ ] ADR cũ bị thay thế đã được đánh dấu "Superseded" (không xóa)?
- [ ] Không có implementation details trong C4/ADR?
- [ ] Tất cả file được lưu đúng thư mục `knowledge/03-system-architecture/`?
- Nếu GATE FAIL → quay lại agent, mô tả tiêu chí chưa đạt, yêu cầu sửa.

**Gate LLD (sau Bước 3):**
- [ ] tech-design.md vẫn giữ nguyên cấu trúc 10 sections?
- [ ] Chỉ sections bị ảnh hưởng được sửa — sections khác không đổi?
- [ ] Domain model, error flows, work packages đã cập nhật đúng?
- [ ] Ngày cập nhật và lý do được ghi trong metadata?
- Nếu GATE FAIL → quay lại agent với phản hồi cụ thể.

**Gate IMP+TST (sau Bước 4):**
- [ ] IMP spec: execution flows, business rules, error handling đã cập nhật?
- [ ] IMP spec: không xóa flows hiện có, chỉ sửa phần thay đổi?
- [ ] TST spec: test case mới/cập nhật phủ đúng FR scenarios thay đổi?
- [ ] TST spec: Regression Risk section có CR reference?
- [ ] Cả IMP và TST đều có đánh dấu `<!-- CR: {task-id} — Revised {date} -->`?
- [ ] Không file nào bị rewrite toàn bộ — chỉ revise?
- Nếu GATE FAIL → quay lại agent bị lỗi, giữ agent còn lại nếu đạt.

**Nguyên tắc gate:**
- Mỗi gate là điều kiện CỨNG — không vượt qua nếu chưa đạt
- Gate failure KHÔNG dừng toàn bộ flow — chỉ quay lại pha bị lỗi
- Với IMP+TST song song: một agent fail không chặn agent kia
- Sau 2 lần retry vẫn fail → báo cáo cho operator, hỏi cách xử lý

### Bước 5: Tổng Hợp & Báo Cáo

```markdown
📊 Flow cr — Kết Quả Yêu Cầu Thay Đổi

**CR:** {task-id}: {task-title}
**Service:** {service}
**Ngày:** {YYYY-MM-DD}

### Impact Assessment
| Pha | Bị Ảnh Hưởng? | Lý Do |
|-----|---------------|-------|
| HLD | YES / NO | {rationale} |
| LLD | YES / NO | {rationale} |
| IMP | YES (luôn luôn) | — |
| TST | YES (luôn luôn) | — |

### Files Đã Sửa
| File | Hành Động | Agent | Trạng Thái |
|------|----------|-------|-----------|
| knowledge/03-system-architecture/C4-context-diagram.md | Cập nhật bounded context | k-architect-reviewer | ✅ / ⊘ skipped |
| knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md | Tạo ADR mới | k-architect-reviewer | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/tech-design.md | Cập nhật sections: {list} | k-techdesign-updater | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md | Cập nhật execution flow, error handling | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | Bổ sung test case cho thay đổi | k-test-writer | ✅ |

### Tóm Tắt
- HLD: {đã cập nhật / không bị ảnh hưởng}
- LLD: {đã cập nhật / không bị ảnh hưởng}
- IMP: {n} FR specs đã cập nhật
- TST: {n} test specs đã cập nhật

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code với các specs đã cập nhật.
   CR có thể yêu cầu regression test cho các FR không bị ảnh hưởng.
```

## Subagents Sử Dụng

| Agent | Mục Đích | Khi Nào Dùng |
|-------|---------|-------------|
| `k-architect-reviewer` (mode: revise) | Cập nhật C4, ADRs | Chỉ khi `hldAffected = true` |
| `k-techdesign-updater` | Cập nhật tech-design.md | Chỉ khi `lldAffected = true` |
| `k-impl-writer` (mode: revise) | Cập nhật IMP specs | Luôn luôn |
| `k-test-writer` (mode: revise) | Cập nhật TST specs | Luôn luôn |

## Bảng Quyết Định Nhanh

| Tình Huống | hldAffected | lldAffected | Các Pha Chạy |
|-----------|-------------|-------------|-------------|
| Thay đổi external system / bounded context / ADR mới | YES | YES | HLD → LLD → IMP+TST |
| Thay đổi domain model / error flows / work package | NO | YES | LLD → IMP+TST |
| Thay đổi logic xử lý / validation / error mapping | NO | NO | IMP+TST |
| Thêm field đơn giản vào request/response | NO | YES | LLD → IMP+TST |

## Xử Lý Lỗi & Phục Hồi

### Agent Fail — Quy Trình Chung

Khi một `Agent(k-*)` thất bại:

1. **Đọc thông báo lỗi** — xác định nguyên nhân:
   - File không tìm thấy? → Kiểm tra đường dẫn, tên file
   - Permission denied? → Báo operator kiểm tra quyền
   - Tool error? → Thử lại với input đã sửa
   - Timeout? → Giảm phạm vi, thử lại

2. **Retry với phản hồi cụ thể:**
   ```
   Agent trước thất bại với lỗi: {error message}
   Vui lòng thử lại với điều chỉnh: {specific fix}
   ```

3. **Sau 2 lần retry thất bại:**
   - Ghi log lỗi vào `.work/brainstorming/BRAIN-CR-YYYYMMDD--{slug}.md`
   - Báo cáo cho operator: agent nào fail, lỗi gì, đã thử những gì
   - Hỏi operator: "Tiếp tục với agent khác? Bỏ qua pha này? Hủy CR?"

### Các Tình Huống Cụ Thể

**Brainstorming thất bại:**
- Operator không trả lời AskUserQuestion? → Đợi, không tự quyết
- Impact assessment không rõ ràng? → Mặc định an toàn: `hldAffected=true, lldAffected=true`

**k-architect-reviewer thất bại (HLD):**
- Thiếu input về kiến trúc hiện tại? → Đọc C4/ADR hiện có, cung cấp lại
- Không tìm thấy ADR cần supersede? → Tạo ADR mới, không sửa ADR cũ

**k-techdesign-updater thất bại (LLD):**
- tech-design.md không tồn tại? → Tạo mới từ template trước khi cập nhật
- Section không rõ cần sửa? → Mặc định: cập nhật Section 9 + Section 10

**k-impl-writer / k-test-writer thất bại (IMP+TST):**
- IMP fail, TST pass → Giữ TST, retry IMP một mình
- TST fail, IMP pass → Giữ IMP, retry TST một mình
- Cả hai fail → Retry song song với input đã sửa
- FR file không tồn tại? → CR không thể tiếp tục nếu không có FR gốc

### Partial Success

CR có thể thành công một phần:
- HLD fail nhưng LLD+IMP+TST vẫn có ý nghĩa? → Ghi nhận "HLD skipped due to error"
- IMP fail nhưng TST pass? → Ghi nhận, báo operator quyết định
- Luôn báo cáo rõ: pha nào thành công, pha nào thất bại, lý do

## Chống Mẫu

- Không tạo FR mới trong CR — nếu cần FR mới, đây là **task**, không phải CR
- Không bỏ qua impact assessment — đây là bước quyết định toàn bộ luồng
- Không chạy HLD/LLD "cho chắc" — chỉ chạy nếu THỰC SỰ bị ảnh hưởng
- Không sửa trực tiếp specs — luôn dispatch đến đúng k-* agent
- Không xóa nội dung hiện có trong specs — CR là revise, không phải rewrite
- Không bỏ qua EnterPlanMode ở mỗi bước — con người phải xác nhận từng pha
- Không nhầm CR với fixbug — bug là lỗi khẩn cấp, CR là thay đổi có kế hoạch
- Không nhầm CR với contract — nếu thay đổi API/Event tập trung, dùng flow contract
- Không nhầm CR với task — nếu cần FR mới hoàn toàn, dùng flow task

## Kịch Bản Kiểm Thử

Dùng các kịch bản sau để xác minh skill hoạt động đúng:

### Test 1: CR Nhỏ — Chỉ IMP+TST

```
Input:  "Thay đổi text validation error từ 'Invalid' → 'Không hợp lệ' trong API topup"
Output kỳ vọng:
  - Impact Assessment: hldAffected=false, lldAffected=false
  - HLD: ⊘ skipped
  - LLD: ⊘ skipped
  - IMP: k-impl-writer cập nhật error handling section trong IMP spec
  - TST: k-test-writer cập nhật error scenario tests
  - Báo cáo ghi rõ "HLD: không bị ảnh hưởng", "LLD: không bị ảnh hưởng"
```

### Test 2: CR Trung Bình — LLD + IMP+TST

```
Input:  "Thêm field 'ghi_chu' vào request topup, lưu vào DB"
Output kỳ vọng:
  - Impact Assessment: hldAffected=false, lldAffected=true
  - HLD: ⊘ skipped
  - LLD: k-techdesign-updater cập nhật Section 4 (Domain Model) + Section 10 (Work Packages)
  - IMP: k-impl-writer (revise) cập nhật execution flow + data impact
  - TST: k-test-writer (revise) bổ sung test case cho field mới
  - Không tạo FR mới (đây là CR, không phải task)
```

### Test 3: CR Lớn — HLD + LLD + IMP+TST

```
Input:  "Đổi payment provider từ VNPAY sang MoMo"
Output kỳ vọng:
  - Impact Assessment: hldAffected=true, lldAffected=true
  - HLD: k-architect-reviewer (revise) cập nhật C4 diagram + tạo ADR mới
  - LLD: k-techdesign-updater cập nhật Section 3, 4, 7, 8, 9, 10
  - IMP: k-impl-writer (revise) cập nhật execution flow, integration points
  - TST: k-test-writer (revise) cập nhật integration tests
  - ADR cũ về VNPAY được đánh dấu "Superseded"
```

### Test 4: Không Phải CR — Phân Biệt Flow

```
Input:  "Thêm tính năng rút tiền mới" → Phải phát hiện đây là TASK (FR mới), không phải CR
Input:  "API xác thực bị crash khi token hết hạn" → Phải phát hiện đây là FIXBUG (lỗi)
Input:  "Đổi format event từ JSON sang Avro" → Phải phát hiện đây là CONTRACT (central contract change)
```

### Test 5: Lỗi Phục Hồi

```
Input:  CR bình thường, nhưng k-architect-reviewer timeout
Output kỳ vọng:
  - Retry k-architect-reviewer 1 lần
  - Nếu vẫn fail → ghi log, báo operator
  - Hỏi: "HLD fail — tiếp tục LLD+IMP+TST hay dừng?"
  - Các pha sau không bị chặn bởi HLD fail
```

## Tham Khảo

- `../sdlc/references/shared-patterns.md` — EnterPlanMode, brainstorming với Agent(brainstormer), error recovery khi subagent fail, dispatch conventions
- `../sdlc/references/report-templates.md` — Mẫu báo cáo Flow cr

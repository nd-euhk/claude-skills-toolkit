---
name: subagent-refiner
description: >-
  Refine và cải thiện Claude Code subagents cho độ tin cậy và hiệu quả tối ưu.
  Đánh giá toàn diện về hooks, model, tools, permission mode, prompt và cấu hình.
  Sử dụng khi: refine subagent, cải thiện subagent, kiểm tra subagent có phù hợp
  không, tối ưu subagent, đánh giá subagent. Luôn dùng EnterPlanMode để lập kế
  hoạch và ExitPlanMode để chờ phê duyệt trước khi thực thi thay đổi.
version: 1.1.0
allowed-tools: Read,Edit,Write,Glob,Grep,AskUserQuestion,EnterPlanMode,ExitPlanMode,Task(*)
---

# Subagent Refiner

Cải thiện subagent Claude Code một cách hệ thống, đánh giá toàn diện về hooks, model, tools và cấu hình trước khi thực hiện thay đổi.

## Quick Start

**Step 0: Phát hiện ngữ cảnh có sẵn (Escape Hatch)**

Kiểm tra lịch sử hội thoại:
- Người dùng đã cung cấp file subagent hoặc chia sẻ code?
- Người dùng đã mô tả vấn đề cần cải thiện?
- Người dùng đang thảo luận về vấn đề của subagent?

**NẾU CÓ NGỮ CẢNH CÓ SẴN** → Đưa ra escape hatch ngay lập tức:

```
questions: [
  {
    question: "Tôi đã xem xét subagent và ngữ cảnh bạn cung cấp. Bạn muốn tiến hành như thế nào?",
    header: "Phong cách",
    options: [
      {
        label: "Suy luận từ ngữ cảnh",
        description: "Tôi sẽ suy luận nhu cầu cải thiện từ những gì bạn đã chia sẻ (nhanh hơn)"
      },
      {
        label: "Xác định rõ ràng",
        description: "Tôi sẽ phỏng vấn bạn để xác định rõ các khu vực cần cải thiện (đầy đủ)"
      }
    ],
    multiSelect: false
  }
]
```

Sau đó điều hướng:
- **"Suy luận từ ngữ cảnh"** → Chuyển thẳng đến Bước 1 (Locate), bỏ qua phỏng vấn chi tiết
- **"Xác định rõ ràng"** → Phỏng vấn đầy đủ BATCH 1 + BATCH 2

**NẾU KHÔNG CÓ NGỮ CẢNH** → Tiếp tục Bước 1 bên dưới

**Step 1:** Dùng AskUserQuestion để hỏi: **"Bạn muốn làm việc với subagent nào?"** (nhập tên hoặc đường dẫn)

**Step 2:** Dùng AskUserQuestion để hỏi:

```
questions: [
  {
    question: "Bạn muốn làm gì với subagent này?",
    header: "Hành động",
    options: [
      {
        label: "Refine",
        description: "Cải thiện hooks, model, tools, prompt, permission mode, hoặc cấu hình"
      },
      {
        label: "Validate",
        description: "Kiểm tra subagent đã sẵn sàng cho production chưa (cấu hình, tool scoping, hooks)"
      }
    ],
    multiSelect: false
  }
]
```

**Step 3:** Điều hướng dựa trên lựa chọn:
- **Nếu "Refine"** → Tiến hành **Core Workflow: Refinement**
- **Nếu "Validate"** → Tiến hành **Core Workflow: Validation**

---

## Core Workflow: Refinement

**Khi người dùng yêu cầu refinement:**

### 1. Xác định vị trí subagent (BẮT BUỘC)

Tìm kiếm subagent cần refine:
- Dự án hiện tại: `.claude/agents/` hoặc `agents/` (nếu là plugin project)
- Nếu không tìm thấy → Hỏi người dùng cung cấp đường dẫn
- Nếu subagent nằm trong `~/.claude/plugins/cache/` → TỪ CHỐI: "Đây là bản copy đã cài đặt (read-only)"
- Nếu subagent nằm trong `~/.claude/agents/` → CẢNH BÁO: "Subagent này ảnh hưởng đến tất cả dự án. Tiếp tục?"

### 2. Phỏng vấn yêu cầu (Nếu chọn "Xác định rõ ràng")

**🔴 BATCH 1: Trọng tâm cải thiện**

Hỏi từng câu một (progressive disclosure):

#### Câu hỏi 1: Khía cạnh nào cần cải thiện?

```
questions: [
  {
    question: "Khía cạnh nào của subagent cần cải thiện?",
    header: "Trọng tâm",
    options: [
      { label: "Hooks", description: "Cấu hình hooks, matcher, exit codes, error handling" },
      { label: "Model", description: "Lựa chọn model (sonnet/opus/haiku/inherit) có phù hợp với task không" },
      { label: "Tools", description: "Tool scoping, principle of least privilege, công cụ phù hợp" },
      { label: "Permission Mode", description: "Chế độ permission có phù hợp với use case không" }
    ],
    multiSelect: true
  }
]
```

#### Câu hỏi 2: Bạn thấy vấn đề cụ thể gì?

```
questions: [
  {
    question: "Bạn thấy vấn đề cụ thể gì với subagent này?",
    header: "Vấn đề"
  }
]
```

(Ví dụ: "Hook không kích hoạt đúng", "Model quá mạnh cho task đơn giản", "Tool scope quá rộng")

#### Câu hỏi 3: Thành công trông như thế nào?

```
questions: [
  {
    question: "Thành công trông như thế nào sau khi refine?",
    header: "Mục tiêu"
  }
]
```

(Ví dụ: "Hook bảo vệ đúng các thao tác", "Model phù hợp với task", "Tools đúng nguyên tắc least privilege")

**🟢 BATCH 2: Chi tiết triển khai**

```
questions: [
  {
    question: "Có khu vực nào cần giữ nguyên không?",
    header: "Phạm vi",
    options: [
      { label: "Giữ nguyên hooks", description: "Không thay đổi cấu hình hooks hiện tại" },
      { label: "Giữ nguyên model", description: "Không thay đổi model đang dùng" },
      { label: "Giữ nguyên tools", description: "Không thay đổi tool access" },
      { label: "Không có ràng buộc", description: "Có thể thay đổi tất cả" }
    ],
    multiSelect: true
  },
  {
    question: "Subagent này dùng cho môi trường nào?",
    header: "Môi trường",
    options: [
      { label: "Personal", description: "Dùng cá nhân, ưu tiên sự tiện lợi" },
      { label: "Team", description: "Dùng cho team, cần ổn định và an toàn" },
      { label: "Production", description: "Môi trường production, yêu cầu cao nhất về bảo mật" }
    ],
    multiSelect: false
  }
]
```

---

### 3. VÀO PLAN MODE (BẮT BUỘC)

**⚠️ LUÔN dùng EnterPlanMode trước khi đánh giá hoặc lên kế hoạch thay đổi.**

Trong plan mode, thực hiện đánh giá toàn diện subagent:

#### 3.1 Đọc và phân tích subagent

Đọc toàn bộ file subagent `.md`, bao gồm frontmatter và system prompt body.

#### 3.2 Đánh giá tổng quát (6 chiều)

**CHIỀU 1: Hooks** — Event, matcher, type (command/prompt), exit codes (0/1/2), timeout, onError, cấu trúc JSON (nested `hooks` array), script safety. Xem `references/hooks-evaluation.md` cho bảng đánh giá chi tiết về từng tiêu chí và common mistake patterns.

**CHIỀU 2: Model** — Phù hợp task complexity: Haiku (đơn giản), Sonnet (trung bình), Opus (phức tạp), inherit (linh hoạt). Xem https://code.claude.com/docs/en/sub-agents#choose-a-model để biết thứ tự ưu tiên khi resolve model.

**CHIỀU 3: Tools** — Least privilege, allowlist vs denylist, tool dư thừa/thiếu, Bash scoping (`Bash(git:*)`). Xem https://code.claude.com/docs/en/tools-reference cho danh sách tools đầy đủ và permission requirements.

**CHIỀU 4: Permission Mode** — default/acceptEdits/auto/dontAsk/bypassPermissions/plan. Phù hợp use case và môi trường? Plugin subagents: permissionMode bị ignore.

**CHIỀU 5: Prompt** — Rõ ràng, có cấu trúc (Purpose → Behaviors → Constraints → Examples), delegation signals mạnh, token hiệu quả.

**CHIỀU 6: Cấu hình khác** — memory (user/project/local), skills preload, mcpServers, maxTurns, isolation (worktree), background, effort.

#### 3.3 Xác định vấn đề và cơ hội cải thiện

Tạo danh sách các vấn đề tìm thấy, phân loại theo mức độ:
- **🔴 Critical:** Vi phạm bảo mật, hook sai có thể gây hại, tool access quá rộng
- **🟡 Important:** Cấu hình chưa tối ưu, model không phù hợp, thiếu error handling
- **🟢 Nice-to-have:** Cải thiện prompt clarity, tối ưu token

#### 3.4 Lập kế hoạch thay đổi

Với mỗi vấn đề, đề xuất thay đổi cụ thể:
- Thay đổi gì? Tại sao?
- Rủi ro của thay đổi?
- Có cần giữ lại behavior cũ không?

### 4. THOÁT PLAN MODE

**⚠️ Dùng ExitPlanMode để trình bày kế hoạch cho người dùng phê duyệt.**

Kế hoạch phải bao gồm:
1. Tóm tắt đánh giá (6 chiều)
2. Danh sách vấn đề tìm thấy (có phân loại mức độ)
3. Đề xuất thay đổi cụ thể
4. Rủi ro và mitigation

Sau khi người dùng phê duyệt, tiến hành thực thi.

### 5. Thực thi thay đổi

Áp dụng các thay đổi đã được phê duyệt:

1. **Tạo bản backup** - Ghi lại nội dung gốc trước khi thay đổi
2. **Thực hiện thay đổi** - Theo thứ tự ưu tiên: Critical → Important → Nice-to-have
3. **Xác minh syntax** - Kiểm tra YAML frontmatter hợp lệ, JSON hooks đúng cấu trúc
4. **Xác minh tính toàn vẹn** - File vẫn đọc được, không mất nội dung quan trọng

**Movement Pattern (khi di chuyển nội dung):**
```
1. CREATE/UPDATE destination (file mới, section cập nhật)
2. LINK - cập nhật pointers đến destination mới
3. DELETE old source (chỉ sau khi links đã được xác minh)

KHÔNG BAO GIỜ: DELETE → LINK → CREATE
```

### 6. Xác nhận kết quả

Sau khi thực hiện thay đổi:
1. Đọc lại toàn bộ file subagent
2. Kiểm tra từng thay đổi đã được áp dụng đúng
3. So sánh với bản backup để xác nhận không mất mát ngoài ý muốn
4. Tổng kết những gì đã thay đổi và lý do

---

## Post-Refinement: Kiểm thử với Subagent Tester

**Sau khi refine hoàn tất, LUÔN hỏi người dùng có muốn kiểm thử không:**

```
questions: [
  {
    question: "Subagent đã được refine xong. Bạn có muốn kiểm thử subagent này không?",
    header: "Kiểm thử",
    options: [
      {
        label: "Có, kiểm thử ngay",
        description: "Chạy subagent-tester (Quick Workflow) để xác nhận subagent hoạt động đúng"
      },
      {
        label: "Không, hoàn tất",
        description: "Refine xong. Bạn có thể kiểm thử sau với lệnh /subagent-tester"
      }
    ],
    multiSelect: false
  }
]
```

**Nếu người dùng chọn "Có, kiểm thử ngay":**

Thông báo: "Đang khởi chạy subagent-tester (Quick Workflow)."

Dùng Skill tool để gọi trực tiếp subagent-tester — đây là skill, không phải subagent:

```
Skill: subagent-tester
Args: subagent-refiner vừa hoàn thành refine subagent tại <subagent_path>. Chạy Quick Workflow để kiểm thử.
```

Subagent-tester sẽ phỏng vấn người dùng về test scenarios, chạy Quick Workflow và hiển thị kết quả pass/fail. Workspace evals/ được tạo tại `./evals/<subagent-name>/`.

**Nếu người dùng chọn "Không, hoàn tất":**

Xác nhận: "Subagent đã được refine xong. Bạn có thể kiểm thử bất kỳ lúc nào với lệnh `/subagent-tester`."

---

## Core Workflow: Validation

**Khi người dùng yêu cầu validation (không refine):**

1. **Xác định vị trí subagent** (giống như refinement step 1)

2. **VÀO PLAN MODE** - Dùng EnterPlanMode

3. **Chạy validation 7 pha:**

   - **Pha 1: Cấu hình** - Kiểm tra YAML frontmatter hợp lệ, các trường bắt buộc (name, description)
   - **Pha 2: Delegation** - Description có trigger phrases rõ ràng không? Claude có nhận diện được không?
   - **Pha 3: Prompt** - System prompt có rõ ràng, có cấu trúc, có hiệu quả không?
   - **Pha 4: Tools** - Tool access có tuân thủ least privilege không? Có tool nào không cần thiết không?
   - **Pha 5: Permissions** - Permission mode có phù hợp với use case không?
   - **Pha 6: Hooks** - Nếu có hooks, cấu hình có đúng không? Matcher, exit codes, error handling?
   - **Pha 7: Testing** - Subagent có sẵn sàng cho production không?

4. **THOÁT PLAN MODE** - Dùng ExitPlanMode để trình bày kết quả validation

5. **Tạo báo cáo validation:**
   - Trạng thái: ✅ Production Ready / ⚠️ Needs Review / ❌ Issues Found
   - Chi tiết: Phát hiện từ tất cả 7 pha
   - Đề xuất: Cải thiện cụ thể nếu có vấn đề
   - Mức độ ưu tiên: Critical vs Important vs Nice-to-have

---

## Key Rules (Không thể thương lượng)

### Luôn dùng EnterPlanMode/ExitPlanMode

**⚠️ CRITICAL: Mọi thay đổi subagent PHẢI được lập kế hoạch trước.**

- **EnterPlanMode** - Trước khi đánh giá hoặc lập kế hoạch thay đổi
- **ExitPlanMode** - Để trình bày kế hoạch và chờ phê duyệt trước khi thực thi
- Không bao giờ thực hiện thay đổi trực tiếp mà không có plan được phê duyệt

### Phạm vi làm việc

✅ **ĐƯỢC PHÉP** - Project-scoped subagents:
- `.claude/agents/` trong dự án
- `agents/` trong plugin project

⚠️ **CÓ ĐIỀU KIỆN** - User-space subagents:
- `~/.claude/agents/` - CẢNH BÁO: "Ảnh hưởng đến tất cả dự án"
- Yêu cầu xác nhận rõ ràng trước khi chỉnh sửa

❌ **TỪ CHỐI** - Không bao giờ chỉnh sửa:
- `~/.claude/plugins/cache/*` (đã cài đặt - read-only)
- Đường dẫn chứa `/cache/` (luôn read-only)

### Movement Pattern (khi thay đổi nội dung)

```
SEQUENCE (không được vi phạm thứ tự):
1. CREATE/UPDATE destination file(s)
2. LINK - Cập nhật pointers đến destination mới
3. DELETE old source (chỉ sau khi links đã được xác minh)

KHÔNG BAO GIỜ: DELETE → LINK → CREATE (tạo broken links và mất nội dung)
```

### Nguyên tắc đánh giá

1. **Bảo mật trên hết** - Critical issues (tool access quá rộng, hooks nguy hiểm) phải được fix trước
2. **Least Privilege** - Subagent chỉ nên có tools cần thiết để hoàn thành task
3. **Phù hợp với use case** - Model, permission mode, hooks phải phản ánh đúng môi trường sử dụng
4. **Token hiệu quả** - Prompt phải súc tích, không lãng phí context window
5. **Production-ready** - Error handling, validation, và fallback phải được cân nhắc

---

## Reference Guide

### Đánh giá Hooks

Hooks cho phép subagent validate tool calls, chạy scripts, và kiểm soát hành vi. Đánh giá từng hook về event, matcher, exit codes, và error handling.
→ `references/hooks-evaluation.md` cho bảng đánh giá 9 tiêu chí, common mistake patterns, và security checklist
→ https://code.claude.com/docs/en/hooks cho tài liệu hooks chính thức (event types, input schema, exit code behavior)

### Đánh giá Model

Chọn model phù hợp ảnh hưởng đến chi phí, tốc độ, và chất lượng. Đánh giá model alias (sonnet/opus/haiku/inherit) và full model IDs.
→ https://code.claude.com/docs/en/sub-agents#choose-a-model cho thứ tự resolve model và bảng so sánh

### Đánh giá Tools

Tool scoping là cơ chế bảo mật chính cho subagent. Áp dụng least privilege: allowlist chính xác hoặc denylist tools nguy hiểm.
→ https://code.claude.com/docs/en/tools-reference cho danh sách tools đầy đủ, permission requirements, và Bash scoping syntax

### Đánh giá Permission Mode

Permission mode kiểm soát cách subagent xử lý permission prompts. Mỗi mode có use case và rủi ro riêng.
→ https://code.claude.com/docs/en/sub-agents#permission-modes cho bảng so sánh các mode và precedence rules

### Đánh giá Cấu hình

Các trường frontmatter nâng cao: memory (persistent knowledge), skills (preloaded context), mcpServers (scoped tools), maxTurns, isolation (worktree), background, effort.
→ https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields cho bảng tham khảo đầy đủ tất cả các trường

### Validation Toàn diện

Quy trình validation 7 pha đảm bảo subagent sẵn sàng cho production.
→ `references/validation-checklist.md` cho bảng kiểm tra chi tiết từng pha và severity classification

---

## Outcome Metrics

Đo lường thành công bằng việc subagent sẽ hoạt động đáng tin cậy và hiệu quả:

✅ **Hooks** - Cấu hình đúng event, matcher chính xác, exit codes chuẩn, error handling đầy đủ
✅ **Model** - Phù hợp với task complexity, cân bằng chi phí/hiệu suất
✅ **Tools** - Tuân thủ least privilege, không thừa không thiếu
✅ **Permission Mode** - Phù hợp với use case và môi trường
✅ **Prompt** - Rõ ràng, có cấu trúc, delegation signals mạnh
✅ **Cấu hình** - Tất cả frontmatter fields được cấu hình đúng
✅ **An toàn** - Không có lỗ hổng bảo mật, hooks không gây hại

---

## Pro Tips

**Tìm subagent hiệu quả:**
- Dùng Glob pattern: `**/*.md` trong `.claude/agents/` hoặc `agents/`
- Subagent project-scoped có thể ở `.claude/agents/` hoặc `agents/` (plugin)
- Không bao giờ tìm trong cache paths

**Plan mode pattern:**
- Vào plan mode → Đánh giá 6 chiều → Lập kế hoạch → ExitPlanMode → Chờ phê duyệt → Thực thi
- Plan mode bảo vệ khỏi thay đổi không mong muốn
- Người dùng luôn có cơ hội xem xét trước khi thay đổi được áp dụng

**Post-refinement:**
- Luôn đề xuất kiểm thử với subagent-tester (dùng Skill tool, không cần Agent tool)
- Quick Workflow cho validation nhanh, Full Pipeline cho benchmarking
- Integration: subagent-creator → subagent.md → subagent-refiner → subagent-tester → iterate

**Bảo toàn chức năng:**
- Refinement cải thiện chức năng hiện có, không bao giờ làm giảm
- Khi nghi ngờ về việc xóa, hỏi người dùng trước
- Movement an toàn hơn deletion (luôn có thể link back)

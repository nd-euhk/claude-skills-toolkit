# SDLC Fable-Thinking

Fable-thinking là reasoning protocol giúp model suy luận có bằng chứng, đa giả
thuyết, tự phản biện. Xem `fable-thinking` skill để biết protocol đầy
đủ (Floor → Proportionality Gate → Constraint Loop → Five Moves → Self-Review
Gate). Rule này chỉ định **khi nào** áp dụng protocol trong SDLC pipeline — không
thay thế procedure, chỉ verify quyết định trước khi thực thi.

## Iron Law

```
KHÔNG QUYẾT ĐỊNH MÀ KHÔNG CÓ EVIDENCE.
MỌI DECISION POINT DƯỚI ĐÂY → FABLE-THINKING TRƯỚC KHI HÀNH ĐỘNG.
```

**Violating the letter of this rule is violating the spirit of this rule.**

Kết quả fable-thinking là recommendation cho human — **không** auto-execute.
Protocol hoạt động trên mọi model tier, không cần `model: fable`.

---

## Decision Points

### Đã tích hợp

| # | Decision Point | Rule áp dụng | Trigger |
|---|---|---|---|
| D1 | Flow Detection | `sdlc-routing`, orchestrator, automation | Input khớp ≥2 flow, leftover details mâu thuẫn, hoặc ambiguous routing |
| D2 | Pipeline Scope | `sdlc-pipeline`, orchestrator, automation | Quyết định skip/run HLD, LLD, hoặc CROSS-CUTTING |
| D3 | Foundation Gate Fail | `sdlc-entry-gate`, orchestrator, automation | Preflight không tạo được required files |
| D4 | Escalation | `sdlc-routing`, orchestrator, automation, quick | Bất kỳ escalation trigger nào bắn |
| D5 | Grilling Exit | automation | Sau grilling rounds, không chắc đã đủ info |
| D6 | Fail-Safe | automation | Workflow dispatch fail hoặc runtime error |

### Đề xuất (sắp xếp theo priority)

| # | Decision Point | Rule áp dụng | Trigger |
|---|---|---|---|
| P1 | CR Blast Radius | `sdlc-routing`, orchestrator | Change request — impact analysis có bỏ sót file nào không? |
| P2 | TDD Interference | `sdlc-pipeline` | TC mới làm vỡ TC cũ — real interference hay false positive? |
| P3 | Flow-Scope Mismatch | `sdlc-entry-gate` | Scope thực tế vượt quá flow đã chọn |
| P4 | Gate Failure Strategy | `sdlc-pipeline` | Gate fail sau 3 retry — skip, continue manual, hay abort? |
| P5 | CROSS-CUTTING Scope | `sdlc-pipeline` | Auto-detect scope từ architecture.md + SRS NFRs — verify scope đúng? |
| P6 | Bug vs False Positive | `sdlc-routing`, automation | Input chứa "bug"/"lỗi"/"fix" — genuine bug hay false positive? |
| P7 | DONE_WITH_CONCERNS | `sdlc-orchestration` | Phase agent hoàn thành nhưng có concerns — severity thế nào? |
| P8 | Spec Deviation | `sdlc-development-rules`, TDD agents | TDD agent deviates từ spec — justified adaptation hay scope creep? |
| P9 | Severity Classification | `sdlc-review-rules`, gate agents | Gate finding classification không rõ ràng (borderline giữa 2 mức) |
| P10 | Audit vs Human Decision | `sdlc-review-rules`, orchestrator | Audit suggest đảo ngược human decision |
| P11 | Trivial Gate | `sdlc-routing`, `sdlc-quick` | Quick flow — task có thực sự ≤2 file, không API/schema/security? |

---

## Execution Guide

### Skill vs Agent — Decision Tree

```
Cần verify facts mới không?
  ├─ Không — facts đã OBSERVED trong session hiện tại
  │   → Dùng Skill("fable-thinking", ...)
  │
  └─ Có — cần đọc file, chạy test, scout codebase
      ├─ Context caller ≤50% capacity
      │   → Dùng Agent("sdlc-fable-thinking", ...)
      │
      └─ Context caller >50% capacity
          → Dùng Agent (giữ context caller sạch)
```

**Mặc định dùng Skill.** Agent chỉ khi cần GROUND (Move 2: thu thập evidence mới)
hoặc context caller sắp đầy.

### Skill Invoke Format

```
Skill("fable-thinking", "<decision-type>: <key facts OBSERVED>. Options: <danh sách>. Goal: <end-state>.")
```

Context PHẢI gồm 4 trường, không thiếu trường nào:

| Trường | Bắt buộc | Nội dung |
|---|---|---|
| `decision-type` | CÓ | Loại quyết định — khớp với tên trong Decision Points table |
| `key facts` | CÓ | Dùng Claim Discipline: OBSERVED (đã thấy session này) / PRIOR (training knowledge) / ASSUMED (chưa verify) |
| `options` | CÓ | Ít nhất 2 options. Mỗi option có nhãn ngắn + 1 câu trade-off |
| `goal` | CÓ | End-state của world khi quyết định đúng được thực thi — không mention option nào |

**Ví dụ đúng:**
```
Skill("fable-thinking", "Flow Detection: OBSERVED: user nói 'sửa cái form đăng nhập' nhưng cũng đề cập 'thêm OAuth flow mới'. PRIOR: form đăng nhập thường là quick fix. ASSUMED: OAuth là scope creep, không phải intent chính. Options: A) quick (chỉ sửa form) — nhanh nhưng rủi ro bỏ sót OAuth, B) task (coi như feature mới) — chậm nhưng an toàn, C) cr (change request) — nếu OAuth đã có code. Goal: human chọn đúng flow không bị thiếu scope.")
```

**Ví dụ sai:**
```
# Thiếu goal end-state
Skill("fable-thinking", "Flow Detection: ambiguous giữa task và cr. Options: task, cr.")
# → Không có goal để verify quyết định

# Facts không dùng Claim Discipline
Skill("fable-thinking", "Flow Detection: user muốn sửa feature. Options: A, B. Goal: chọn flow.")
# → "user muốn sửa feature" là ASSUMED mặc OBSERVED grammar
```

### Agent Invoke Format

```
Agent("sdlc-fable-thinking", {prompt: "Decision: <decision-type>. Context: <key facts với Claim Discipline>. Options: <danh sách>. Goal: <end-state>. Verify: <files cần đọc hoặc commands cần chạy>."})
```

Additional fields so với Skill:

| Trường | Nội dung |
|---|---|
| `Verify` | Danh sách file paths hoặc commands agent cần chạy để GROUND facts trước khi reasoning |

---

## Rationalization Defense

### Khi Nào KHÔNG Được Invoke

Chỉ skip fable-thinking khi task là **mechanical** — không có judgment call:

| Được skip (mechanical) | Không được skip (có judgment) |
|---|---|
| `git status`, `git branch` | "Có nên stash hay commit không?" |
| Kiểm tra file exists | "Thiếu file này có block pipeline không?" |
| `sprint` skill update | "Feature này priority thế nào?" |
| Đọc file theo path đã biết | "Đọc file nào để verify assumption này?" |

**Nguyên tắc:** Nếu task có thể thực hiện bằng một shell command với exit code
rõ ràng → mechanical. Nếu task cần cân nhắc giữa 2+ options → PHẢI invoke.

### Rationalization Table

Khi bạn nghĩ "không cần fable-thinking cho việc này" — đọc bảng này trước:

| Excuse | Reality |
|---|---|
| "Rõ ràng quá, ai cũng thấy" | Rõ ràng với agent ≠ đúng. Template hijack là có thật. |
| "Tôi đã verify bằng tool rồi" | Tool verify facts. Fable-thinking verify QUYẾT ĐỊNH dựa trên facts đó. |
| "Chỉ là implementation detail" | Implementation detail làm vỡ production. Hỏi human. |
| "Human bảo 'cứ làm đi'" | Approval cho task trước ≠ approval cho decision này. |
| "Không đủ thời gian" | 30s fable-thinking rẻ hơn 2h sửa sai. |
| "Context đã đủ evidence" | Evidence là OBSERVED có thể trỏ đến file/dòng. Không phải "có vẻ đủ". |
| "Protocol unavailable" | Protocol unavailable CHỈ khi đáp ứng observable predicates bên dưới. |

### Red Flags — STOP, Bạn Đang Định Skip

- "Quyết định này quá rõ ràng"
- "Tôi không cần protocol cho việc đơn giản"
- "Đây không phải decision point trong bảng"
- "Tôi có thể tự reasoning được"
- "Skill fable-thinking chắc không cần cho việc này"
- "Kết quả sẽ giống nhau thôi"
- "Tôi đã làm việc này trăm lần rồi"

**Tất cả = invoke fable-thinking. Không ngoại lệ.**

### Hard Gate — Không Auto-Execute

```
<HARD-GATE>
Fable-thinking recommendation LÀ INPUT CHO HUMAN — không phải quyết định cuối cùng.

KHÔNG ĐƯỢC thực thi bất kỳ hành động nào dựa trên recommendation cho đến khi:
  a) Human đã đọc recommendation, VÀ
  b) Human đã xác nhận bằng văn bản ("làm đi", "OK chọn A", v.v.)

"Tôi nghĩ human sẽ đồng ý" không phải là xác nhận.
"Recommendation quá rõ ràng" không phải là xác nhận.
"Human đã approve từ trước" không áp dụng cho decision này.
</HARD-GATE>
```

### No Loop — Định Nghĩa Bằng Observable Predicate

Một lần invoke cho mỗi decision point. Không loop.

**Được phép re-invoke CHỈ KHI** human cung cấp evidence mới làm thay đổi premise
của quyết định. Observable predicate: human message chứa thông tin chưa có trong
lần invoke đầu, VÀ thông tin đó thay đổi ít nhất một OBSERVED fact.

**Không được re-invoke vì:**
- "Tôi muốn chắc chắn hơn" → không phải evidence mới
- "Kết quả không như tôi mong đợi" → không phải evidence mới
- "Góc nhìn khác" trên cùng một input → không phải evidence mới
- "Lần này context đầy đủ hơn" → lần đầu phải đầy đủ rồi

### Protocol Unavailable — Observable Predicates

Protocol unavailable CHỈ KHI thỏa mãn MỘT trong các điều kiện sau:

| Điều kiện | Fallback |
|---|---|
| `fable-thinking` skill not installed trong runtime catalog | Dùng `sequential-thinking` skill hoặc manual 5 moves compact |
| Context usage >80% (không đủ token cho Agent mode) | Dùng Skill mode (nhẹ hơn Agent) |
| Model không hỗ trợ extended thinking VÀ không có private reasoning space | Chạy 5 moves compact trong không gian reasoning có sẵn |

Tất cả các trường hợp khác → protocol available → PHẢI invoke. "Tôi đoán là
unavailable" không phải là observable predicate.

---

## Worked Examples

### Example 1: Flow Detection Ambiguous → Fable-Thinking → Chọn Orchestrator

**Tình huống:** User nói: "Thêm tính năng export báo cáo — à mà cái vụ phân
quyền admin tui thấy đang có bug, sửa luôn đi."

**Không có fable-thinking (lỗi):**
Agent pattern-match "export báo cáo" → task flow. Bỏ qua bug mention. Kết quả:
pipeline tạo feature specs nhưng không fix bug.

**Có fable-thinking (đúng):**

```
Skill("fable-thinking", "Flow Detection:
  OBSERVED: user request có 2 phần — (1) 'thêm export báo cáo' (feature mới),
  (2) 'phân quyền admin đang có bug, sửa luôn' (bug fix). Đây là 2 intent
  khác loại trong cùng một message.
  PRIOR: export thường là task flow. Bug fix thường là fixbug flow.
  ASSUMED: user muốn làm cả 2 trong cùng 1 session.
  Options:
    A) Tách làm 2 — task flow cho export, fixbug cho phân quyền (qua orchestrator)
    B) Gộp vào task flow — coi bug fix là một phần của feature
    C) Quick — bỏ qua bug, chỉ làm export đơn giản
  Goal: user nhận được export feature hoạt động VÀ bug phân quyền được fix,
  không bỏ sót intent nào.")
```

→ Recommendation: chọn A, escalate lên orchestrator để xử lý cả 2 flow.

### Example 2: Gate Fail Sau 3 Retry → Fable-Thinking → Skip Với Điều Kiện

**Tình huống:** `sdlc-gate` fail lần thứ 3 trên IMP spec. Finding: "Thiếu
error handling cho edge case network timeout." Đã retry 3 lần, mỗi lần
IMP agent đều báo "đã thêm error handling" nhưng gate vẫn fail.

**Không có fable-thinking (lỗi):**
Agent hoặc loop vô hạn (retry lần 4, 5, ...) hoặc tự ý skip gate.

**Có fable-thinking (đúng):**

```
Skill("fable-thinking", "Gate Failure Strategy:
  OBSERVED: IMP spec (agent_docs/features/export-report/imp.md) đã được update
  3 lần. Gate finding duy nhất: 'network timeout error handling'. IMP agent
  đã thêm section Error Handling với timeout scenario. Gate vẫn fail cùng
  criteria. Codebase hiện tại đã có axios interceptor xử lý timeout global.
  ASSUMED: gate criteria quá strict cho case này — error handling đã được
  cover ở tầng infrastructure, không cần lặp lại trong từng IMP.
  Options:
    A) Skip gate với caveat — document rằng error handling nằm ở interceptor
    B) Retry lần 4 với instruction chi tiết hơn
    C) Abort pipeline, nhờ human viết error handling thủ công
  Goal: pipeline tiếp tục mà không bỏ sót genuine error handling gap.")
```

→ Recommendation: chọn A — skip gate, thêm comment trong IMP spec trỏ đến
interceptor. Trình bày human: "Gate fail 3 lần trên cùng 1 criteria. Error
handling đã có ở `src/interceptors/network.ts`. Đề xuất skip gate với caveat."

### Example 3: TDD Interference → Fable-Thinking → Confirm False Positive

**Tình huống:** RED agent báo INTERFERENCE: TC-07 ("user uploads file > 10MB")
làm vỡ TC-03 ("user uploads file thành công"). Cả 2 test đều dùng chung
`uploadService`.

**Không có fable-thinking (lỗi):**
Agent hoặc dừng pipeline (coi interference là thật) hoặc ignore interference
(coi là false positive không cần verify).

**Có fable-thinking (đúng):**

```
Agent("sdlc-fable-thinking", {prompt: "Decision: TDD Interference.
  Context:
    OBSERVED: RED phase cho TC-07. TC-07 test 'rejects file > 10MB'.
    TC-03 test 'successful upload with valid file'. Cả 2 dùng uploadService.
    TC-03 failure output: 'Expected: {status: 200}, Received: {status: 413}'.
    TC-07 thêm validation size check trong uploadService — thay đổi shared code.
    PRIOR: interference thường là real bug khi shared code thay đổi.
    ASSUMED: TC-03 fail vì TC-07 validation code path làm thay đổi behavior
    của uploadService cho file nhỏ.
  Options:
    A) Real interference — TC-07 validation code vô tình block file hợp lệ
    B) False positive — TC-03 đang dùng file >10MB từ trước nhưng không ai để ý
    C) TC-03 cần update — behavior mới đúng, TC-03 cần được sửa expectation
  Goal: xác định interference là thật hay không, pipeline không dừng oan.
  Verify: đọc code uploadService sau khi TC-07 được implement (src/services/upload.ts),
  đọc TC-03 test file (tests/upload.test.ts), chạy TC-03 với file size = 1MB.")
```

→ Agent đọc file, verify: TC-03 thực ra đang dùng file 15MB (không ai để ý size
cũ). TC-07 không làm vỡ gì — false positive. Pipeline tiếp tục.

---

## Decision Method Mapping

Áp dụng "Match the Form to the Failure" từ superpowers — mỗi decision point
có failure mode chính khác nhau, cần form phù hợp:

| Decision Point | Failure Mode Chính | Form |
|---|---|---|
| D1 Flow Detection, D4 Escalation, P11 Trivial Gate | **Discipline** — agent skip vì "rõ ràng" | Prohibition + rationalization table |
| D2 Pipeline Scope, P1 CR Blast Radius, P3 Flow-Scope Mismatch | **Omission** — bỏ sót file/service/phase | Structural: REQUIRED fields trong Verify list |
| D3 Foundation Gate Fail, D6 Fail-Safe, P4 Gate Failure Strategy | **Discipline** — agent tự quyết định skip/abort | Prohibition + hard gate |
| D5 Grilling Exit, P6 Bug vs False Positive, P7 DONE_WITH_CONCERNS, P9 Severity Classification | **Shaping** — output không rõ ràng, thiếu trade-off | Positive recipe: format string với Options rõ ràng |
| P2 TDD Interference, P5 CROSS-CUTTING Scope | **Omission + Shaping** — vừa bỏ sót file vừa output mơ hồ | Structural fields + recipe |
| P8 Spec Deviation, P10 Audit vs Human Decision | **Discipline** — agent tự ý đảo ngược quyết định | Hard gate + rationalization table |

---

## Nguyên Tắc

- **Không** invoke cho mechanical tasks — nếu task có thể hoàn thành bằng một
  shell command với exit code rõ ràng, đó không phải decision point
- **Không** thay thế human judgment — recommendation là input, human là người
  quyết định cuối cùng
- **Không** auto-execute — xem Hard Gate ở trên
- **Một lần** invoke cho mỗi decision point — re-invoke chỉ khi human cung cấp
  evidence mới làm thay đổi premise. Xem No Loop ở trên
- **Protocol unavailable** — chỉ khi thỏa mãn observable predicates. Xem
  Protocol Unavailable ở trên. Fallback tương ứng, không block pipeline
- **Không nuance clauses** — mọi quy tắc phải có observable predicate. "Trừ
  khi thực sự cần thiết" không phải là predicate

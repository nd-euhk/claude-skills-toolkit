# Escalation Patterns — SDLC Quick

Pattern và message templates cho escalation từ `sdlc-quick` sang
`sdlc-orchestrator` hoặc `sdlc-automation`.

## Nguyên tắc escalation

- **Fail-safe default**: Khi không chắc → escalate. An toàn hơn nhanh.
- **Rõ lý do**: Luôn nói rõ criteria nào fail hoặc tại sao borderline.
- **Không tự động escalate** — luôn hỏi human xác nhận trước khi chuyển.
- **Giữ context**: Truyền thông tin đã grill được để orchestrator/automation không hỏi lại.

---

## Escalation Triggers

### Trigger 1: Trivial Gate Fail (Preflight Bước 2)

Xảy ra trước khi grill. Không cần hỏi human — thông báo và đề xuất.

```
🔴 Quick Flow không phù hợp — Trivial Gate FAIL:

   Tiêu chí fail:
   [G1] File count > 2: [danh sách file hoặc lý do]
   [G3] Security impact: [mô tả]

   Task này cần full SDLC pipeline với human review.

   Đề xuất:
   - /sdlc-orchestrator (flow task) — nếu muốn review từng phase
   - /sdlc-automation — nếu đã rõ requirements, muốn autonomous

   Bạn muốn chọn hướng nào?
```

### Trigger 2: Triage Grill — Safety Check Fail (Round 2)

Xảy ra khi human xác nhận có API/schema hoặc security/billing impact.

```
⚠️  Quick Flow không phù hợp — Safety Check:

   Bạn xác nhận thay đổi có liên quan đến:
   [API endpoints / Database schema / Auth/Billing/Data integrity]

   Đây là khu vực cần traceability và review cẩn thận.

   Đề xuất: /sdlc-orchestrator (flow task)
   - SRS để document chính xác thay đổi API/schema
   - HITL review từng phase để đảm bảo không regression
   - Full test suite qua cook flow

   Chuyển sang orchestrator?
```

### Trigger 3: Triage Grill — Borderline (Round 3 hoặc ambiguous)

Xảy ra khi human không chắc về scope hoặc impact.

```
⚠️  Quick Flow không được khuyến nghị — Scope không rõ:

   Sau triage grill, không thể xác nhận chắc chắn:
   - [liệt kê những gì chưa chắc]

   "Không chắc" = escalate. Đây là nguyên tắc fail-safe.

   Đề xuất:
   - /sdlc-orchestrator (flow task) — human review từng phase để làm rõ scope
   - /sdlc-automation — nếu sau khi research, bạn thấy scope đã rõ

   Bạn muốn:
   1. Chuyển sang orchestrator ngay
   2. Tự research thêm rồi quay lại quick flow
   3. Chuyển sang automation
```

### Trigger 4: GATE-light Fail

Xảy ra sau khi đã implement. Gate fail gợi ý scope lớn hơn dự kiến.

```
🚦 GATE-light FAIL — [N]/4 criteria không đạt:

   Fail: [danh sách criteria fail với lý do]

   Gate fail sau implement thường có nghĩa scope lớn hơn trivial.
   Không an toàn để tiếp tục trong quick flow.

   Đề xuất: /sdlc-orchestrator
   - Review code đã implement
   - Nếu cần, chạy flow cr để update specs
   - Hoặc flow fixbug nếu gate fail chỉ ra regression

   Options:
   1. Chuyển sang orchestrator để xử lý gate failures
   2. Tự fix gate failures và chạy GATE-light lại (không khuyến nghị)
   3. Revert thay đổi và bắt đầu lại với flow task
```

### Trigger 5: Code Review Phát Hiện Vấn Đề Lớn

```
👀 Code Review phát hiện vấn đề ngoài phạm vi quick flow:

   [Danh sách findings với mức độ]

   Những vấn đề này yêu cầu:
   - Specs documentation (SRS/IMP)
   - Hoặc refactor rộng hơn dự kiến
   - Hoặc security review độc lập

   Đề xuất: /sdlc-orchestrator (flow cr) để xử lý từng finding có cấu trúc.
```

---

## Handoff sang Orchestrator

Khi human đồng ý escalate, cung cấp context đã có để orchestrator không grill lại từ đầu:

```
📋 Context cho orchestrator:

   Git branch: [branch name]
   Mô tả task: [tóm tắt từ triage grill]
   Quick flow đã làm:
   - Trivial gate: [PASS/FAIL criteria]
   - Triage grill: [kết quả round 1-3]
   - [Nếu đã implement] Code đã viết: [danh sách file + mô tả]
   - [Nếu đã chạy test] Test status: [pass/fail]

   Lý do escalate: [trigger + chi tiết]

   Đề xuất flow: [task | cr | fixbug]
```

Human có thể copy-paste context này hoặc orchestrator sẽ tự đọc từ conversation.

---

## Handoff sang Automation

Tương tự như orchestrator nhưng nhấn mạnh requirements đã rõ:

```
📋 Context cho automation:

   Git branch: [branch name]
   Mô tả task: [tóm tắt]
   Requirements đã rõ: [từ triage grill]
   Lý do escalate từ quick: [trigger]

   Đề xuất flow: [task | cr]
```

---

## Borderline Decision Tree

```
Task được mô tả
    │
    ├─ File count rõ ràng ≤2? ──── Không ──→ ESCALATE
    │
    ├─ Rõ ràng không API/schema/auth/billing? ──── Không ──→ ESCALATE
    │
    ├─ Human tự tin về scope? ──── Không ──→ ESCALATE
    │
    └─ Tất cả PASS ──→ PROCEED (Path A hoặc B)

QUY TẮC: Bất kỳ nhánh "Không" hoặc "Không chắc" → ESCALATE.
```

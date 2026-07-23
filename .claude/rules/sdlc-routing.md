# SDLC Routing & Escalation

Ánh xạ intent của người dùng đến SDLC flow và entry point phù hợp, và xử lý
escalation khi flow hiện tại không thể xử lý được yêu cầu. Route dựa trên
installed-skill catalog của runtime — không hardcode tên skill có thể khác
nhau giữa các installation.

## Intent → Flow Resolution

Khớp primary intent của người dùng với flow, không khớp keyword. Cùng một
intent được diễn đạt bằng từ ngữ khác nhau phải resolve về cùng một flow.

| Intent của người dùng | Flow | Có sẵn qua | Pipeline (xem `sdlc-pipeline.md`) |
|---|---|---|---|
| Xây dựng feature mới, greenfield work, major change, tạo specs từ đầu | `task` | orchestrator, automation | Forward pipeline |
| Thay đổi hành vi hiện có, sửa feature, cập nhật specs cho code đã tồn tại | `cr` | orchestrator, automation | CR flow (impact analysis + selective re-spec) |
| Sửa defect, sửa lỗi, khắc phục bug | `fixbug` | **chỉ orchestrator** | Scout → diagnose → fix → verify |
| Viết code từ specs có sẵn, implement từ agent_docs, thực thi TDD cycle | `cook` | orchestrator, automation | TDD cycle |
| Reverse-engineer specs từ codebase có sẵn, document những gì code làm | `reverse` | orchestrator, sdlc-codebase skill | Reverse pipeline |

## Entry Point Selection

Sau khi xác định flow, route đến entry point skill phù hợp dựa trên mức độ
cần human involvement.

| Tình huống | Entry point |
|---|---|
| Domain mới, requirements chưa rõ, thay đổi rủi ro cao, hoặc human muốn review từng phase | **orchestrator** — human-in-the-loop tại mỗi phase gate |
| Requirements đã rõ, human muốn một buổi phỏng vấn upfront rồi autonomous execution | **automation** — grill một lần, dispatch workflow, monitor |
| Thay đổi giới hạn trong ≤2 file, không ảnh hưởng API/schema/security/auth/billing, không có service boundary mới | **quick** — triage grill, guard test only, GATE-light |

## Priority Rules

Khi intent ambiguous hoặc overlap:

1. **Safety first** — nếu bất kỳ tín hiệu nào cho thấy task KHÔNG trivial, từ chối quick. Khi không chắc chắn (borderline), dùng `Skill("fable-thinking")` để verify task có thực sự ≤2 file, không API/schema/security không
2. **Evidence over assumption** — nếu không thể xác nhận scope từ context, mặc định chọn orchestrator
3. **Borderline luôn escalate** — "có thể là quick" = orchestrator; "có thể là cr" = task flow
4. **Explicit user request ghi đè inference** — nếu người dùng chỉ định entry point cụ thể, dùng nó

## Resolution Procedure

Khi intent ambiguous hoặc input khớp ≥2 flow, dùng `Skill("fable-thinking")` để
verify flow detection trước khi chọn entry point.

1. Đọc yêu cầu của người dùng và xác định primary intent
2. Khớp intent với flow dùng bảng capability ở trên, không dùng keyword grep
3. Đánh giá nhu cầu human involvement: mức độ quen thuộc với domain, rủi ro, scope clarity
4. Chọn entry point skill từ installed-skill catalog của runtime
5. Nạp toàn bộ hướng dẫn của skill đó trước khi hành động
6. Nếu skill được chọn không được cài đặt, escalate lên entry point nặng hơn kế tiếp

## fixbug Flow: Chỉ Dành cho Orchestrator

Flow `fixbug` **chỉ có sẵn qua orchestrator** — yêu cầu human diagnosis judgment
(phân tích stack trace, root cause hypothesis, đánh giá fix scope) mà automation
và quick không thể cung cấp an toàn. Entry-gate có hard block cho non-orchestrator
(xem `sdlc-entry-gate.md` Bước 3).

- **Không escalate từ quick đến fixbug** — nếu phát hiện bug trong quick flow, escalate lên orchestrator với `flow=fixbug`
- **Không escalate từ automation đến fixbug** — nếu input chứa "bug"/"lỗi"/"fix": trước tiên dùng `Skill("fable-thinking")` để verify genuine bug vs false positive, sau đó escalate lên orchestrator với `flow=fixbug` nếu confirm là bug thật
- **Orchestrator xử lý fixbug trực tiếp** — không cần escalation thêm

## Escalation Lanes (nhẹ nhất → nặng nhất)

```
quick → automation → orchestrator
  │         │            │
  └─────────┴────────────┘
         reverse
```

- **quick** chỉ xử lý task trivial (≤2 file, không API/schema/security/billing)
- **automation** xử lý autonomous execution cho công việc đã hiểu rõ
- **orchestrator** xử lý mọi thứ với full human-in-the-loop safety
- **reverse** là lane ngang hàng cho codebase→specs work, có thể escalate lên orchestrator

## Khi nào Escalate

### Từ quick → orchestrator (hoặc automation)

| Trigger | Hành động |
|---|---|
| Trivial gate fail (bất kỳ trong 5 criteria) | Dừng, đề xuất orchestrator với flow=task |
| Triage grill phát hiện scope không trivial | Dừng, đề xuất orchestrator hoặc automation |
| GATE-light fail (bất kỳ trong 4 checks) | Dừng — gate failure báo hiệu scope bị đánh giá thấp |
| Review phát hiện bugs hoặc security issues | Escalate — thay đổi có impact rộng hơn dự kiến |
| Human không chắc về scope khi grill | Mặc định chọn orchestrator |

### Từ automation → orchestrator

| Trigger | Hành động |
|---|---|
| Grilling không đạt exit criteria sau 2 rounds | Fallback về orchestrator để discovery sâu hơn |
| Workflow dispatch fail (script missing, timeout) | Báo cáo failure, đề xuất orchestrator làm fallback |
| Bất kỳ phase gate nào trả về FAIL | Báo cáo phase + criteria, đề xuất orchestrator |
| Human yêu cầu nhiều quyền kiểm soát hơn khi đang grilling | Tôn trọng ngay lập tức, chuyển context |
| Requirements quá ambiguous cho autonomous execution | Đề xuất orchestrator trước khi làm bất kỳ việc gì |

### Từ orchestrator (lane cuối cùng)

Orchestrator không có upward escalation — nó xử lý mọi thứ. Nếu orchestrator
không thể tiếp tục:
- **Thiếu foundation**: gọi `sdlc-preflight`, dừng nếu không resolve được
- **Requirements chưa rõ**: tiếp tục HITL discovery đến khi rõ ràng
- **Technical blocker**: báo cáo human với các options cụ thể

## Escalation Protocol

Trước khi escalate, dùng `Skill("fable-thinking")` để verify escalation decision — xác nhận trigger là chính đáng, target lane phù hợp, không bỏ sót context.

Khi escalate:

1. **Giữ context** — tóm tắt những gì đã thu thập (user intent, kết quả grilling, files đã xác định)
2. **Nêu lý do** — trigger nào đã bắn, bằng chứng gì hỗ trợ
3. **Đề xuất target** — entry point + flow được khuyến nghị
4. **Hỏi một lần** — không lặp lại đề xuất escalation nếu human từ chối

```
⚠️  [current lane] không phù hợp: [lý do cụ thể]
   Đề xuất: [target lane] với flow [flow-type].
   [tóm tắt context nếu có].
   Bạn có muốn chuyển không?
```

## Fail-Safe Principles

- **Không bao giờ downgrade safety** — escalate lên lane nặng hơn, không bao giờ từ orchestrator xuống quick
- **Borderline = escalate** — "có thể" không đủ. Cần chắc chắn
- **Một quyết định escalation** — hỏi một lần, tôn trọng câu trả lời, không loop
- **Context đi cùng** — khi chuyển lane, mang theo context đã thu thập để human không bị phỏng vấn lại
- **Crash = escalate** — nếu subagent hoặc workflow crash không thể phục hồi, fallback về orchestrator
